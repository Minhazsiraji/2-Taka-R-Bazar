alter table public.treasury_transactions add column customer_event_id uuid references public.finance_customer_events(id) on delete restrict;
alter table public.treasury_transactions drop constraint treasury_transactions_kind_check;
alter table public.treasury_transactions add constraint treasury_transactions_kind_check check(kind in
 ('transfer','loan_draw','loan_repay','card_bill','expense_cash','expense_card','owner_capital','owner_draw','supplier_payment','customer_receipt','customer_refund'));
create index treasury_customer_event on public.treasury_transactions(customer_event_id,status);
create table public.finance_customer_cash_evidence (
 transaction_id uuid primary key references public.treasury_transactions(id) on delete restrict,
 evidence_path text not null unique,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$')
);
alter table public.finance_customer_cash_evidence enable row level security;
revoke all on public.finance_customer_cash_evidence from public,anon,authenticated,service_role;
create trigger finance_database_write_lock before insert or update or delete on public.finance_customer_cash_evidence for each row execute function private.finance_write_lock();
create trigger finance_customer_cash_evidence_immutable before update or delete on public.finance_customer_cash_evidence for each row execute function private.finance_reject_journal_mutation();

create function private.finance_customer_balance(p_sale uuid,p_account text) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when p_account='2300' then l.credit-l.debit else l.debit-l.credit end),0)
 from public.finance_journal_lines l where l.account_code=p_account and l.journal_id in (
 select journal_id from public.finance_customer_events where (id=p_sale or source_kind='sale' and source_id=p_sale) and status='posted'
 union all select journal_id from public.treasury_transactions where customer_event_id=p_sale and status='posted')
$$;
revoke all on function private.finance_customer_balance(uuid,text) from public,anon,authenticated,service_role;

alter table public.finance_customer_events drop constraint finance_customer_events_product_amount_check;
alter table public.finance_customer_events add constraint finance_customer_events_product_amount_check check(product_amount>=0 and (kind='credit' or product_amount>0) and product_amount+delivery_amount>0);
create function public.finance_request_customer_credit(p_sale uuid,p_rows jsonb,p_delivery_refund numeric,p_restock boolean,p_date date,p_reason text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.finance_customer_events%rowtype;r jsonb;x jsonb;v_rows jsonb:='[]';v_qty integer;v_used integer;v_amount numeric:=0;v_cost numeric:=0;v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 select * into s from public.finance_customer_events where id=p_sale and kind='sale' and status='posted' for update;
 if not found then raise exception 'Posted customer sale required'; end if;
 if p_date is null or p_date<s.business_date or p_date>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Invalid customer credit date'; end if;
 perform private.finance_require_open(p_date);
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>50 or p_restock is null or p_delivery_refund is null or p_delivery_refund<0 or round(p_delivery_refund,2)<>p_delivery_refund then raise exception 'Invalid credit allocations or delivery refund'; end if;
 if p_path is null or p_path not like auth.uid()::text||'/%' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or
 not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path) then raise exception 'Original return and credit evidence required'; end if;
 if (select count(distinct v->>'line_index') from jsonb_array_elements(p_rows) v)<>jsonb_array_length(p_rows) then raise exception 'Credit source line repeated'; end if;
 for x in select value from jsonb_array_elements(p_rows) loop
 select value into r from jsonb_array_elements(s.allocations) where value->>'line_index'=x->>'line_index';
 v_qty=(x->>'quantity')::integer;
 if r is null or v_qty is null or v_qty<=0 then raise exception 'Invalid original sale allocation'; end if;
 select coalesce(sum((v->>'quantity')::integer),0) into v_used from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) v
 where e.kind='credit' and e.source_id=s.id and e.status in ('pending','posted') and v->>'line_index'=r->>'line_index';
 if v_qty+v_used>(r->>'quantity')::integer then raise exception 'Credit exceeds uncredited sold quantity'; end if;
 v_amount=v_amount+v_qty*(r->>'unit_price')::numeric;
 if p_restock then v_cost=v_cost+v_qty*(r->>'unit_cost')::numeric; end if;
 v_rows=v_rows||jsonb_build_array(r||jsonb_build_object('quantity',v_qty));
 end loop;
 if p_delivery_refund+coalesce((select sum(delivery_amount) from public.finance_customer_events where kind='credit' and source_id=s.id and status in ('pending','posted')),0)>s.delivery_amount then raise exception 'Delivery refund exceeds uncredited delivery charge'; end if;
 if v_amount+p_delivery_refund<=0 then raise exception 'Positive customer credit required'; end if;
 if exists(select 1 from public.treasury_transactions where customer_event_id=s.id and status='pending') or exists(select 1 from public.finance_customer_cod_allocations where sale_id=s.id and status='pending') then raise exception 'Resolve pending customer payment before credit'; end if;
 insert into public.finance_customer_events(kind,source_kind,source_id,community_id,source_snapshot,allocations,product_amount,delivery_amount,cogs_amount,restock,business_date,reason,evidence_path,evidence_sha256,requested_by)
 values('credit','sale',s.id,s.community_id,s.source_snapshot,v_rows,v_amount,p_delivery_refund,v_cost,p_restock,p_date,btrim(p_reason),p_path,p_sha256,auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_credit_requested','finance_customer_event',v_id,jsonb_build_object('sale_id',s.id,'product_refund',v_amount,'delivery_refund',p_delivery_refund,'restock',p_restock));
 return v_id;
end $$;

create function public.finance_review_customer_credit(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.finance_customer_events%rowtype;s public.finance_customer_events%rowtype;v_lines jsonb:='[]';v_ar numeric;v_refund numeric;v_journal uuid;x record;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into e from public.finance_customer_events where id=p_id for update;
 if not found or e.kind<>'credit' or e.status<>'pending' then raise exception 'Customer credit not pending'; end if;
 if e.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Credit review reason required'; end if;
 if p_approve then
 perform private.finance_require_open(e.business_date);
 select * into s from public.finance_customer_events where id=e.source_id for update;
 if exists(select 1 from public.treasury_transactions where customer_event_id=s.id and status='pending') or exists(select 1 from public.finance_customer_cod_allocations where sale_id=s.id and status='pending') then raise exception 'Resolve pending customer payment before credit'; end if;
 v_ar=least(e.product_amount+e.delivery_amount,greatest(0,private.finance_customer_balance(s.id,'1100')));
 v_refund=e.product_amount+e.delivery_amount-v_ar;
 if e.product_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','4000','debit',e.product_amount)); end if;
 if e.delivery_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','4010','debit',e.delivery_amount)); end if;
 if v_ar>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','1100','credit',v_ar)); end if;
 if v_refund>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','2300','credit',v_refund)); end if;
 if e.restock and e.cogs_amount>0 then
 perform bill_id from public.finance_inventory_lots where bill_id in(select (r->>'bill_id')::uuid from jsonb_array_elements(e.allocations) r) order by bill_id for update;
 v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','1200','debit',e.cogs_amount),jsonb_build_object('account','5000','credit',e.cogs_amount)); end if;
 v_journal=private.treasury_post('customer:credit:'||e.id,e.id,e.business_date,e.reason,v_lines,auth.uid());
 if e.restock then
 for x in select (r->>'bill_id')::uuid bill_id,sum((r->>'quantity')::integer)::integer qty,sum((r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost from jsonb_array_elements(e.allocations) r group by r->>'bill_id' loop
 insert into public.finance_inventory_movements(bill_id,event_key,quantity,value,journal_id) values(x.bill_id,'customer:credit:'||e.id||':'||x.bill_id,x.qty,x.cost,v_journal);
 end loop;
 end if;
 end if;
 update public.finance_customer_events set status=case when p_approve then 'posted' else 'rejected' end,reviewed_by=auth.uid(),journal_id=v_journal where id=e.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_credit_'||case when p_approve then 'posted' else 'rejected' end,'finance_customer_event',e.id,
 jsonb_build_object('note',p_note,'journal_id',v_journal,'ar_reduction',v_ar,'refund_payable',v_refund,'restocked',e.restock));
 return case when p_approve then 'posted' else 'rejected' end;
end $$;

create function public.finance_request_customer_cash(p_sale uuid,p_kind text,p_account uuid,p_amount numeric,p_date date,p_reference text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.finance_customer_events%rowtype;a public.treasury_accounts%rowtype;v_due numeric;v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 select * into s from public.finance_customer_events where id=p_sale and kind='sale' and status='posted' for update;
 if not found then raise exception 'Posted sale required'; end if;
 if p_kind is null or p_kind not in ('customer_receipt','customer_refund') then raise exception 'Unsupported customer cash event'; end if;
 if p_date is null or p_date<s.business_date or p_date>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Invalid customer payment date'; end if;
 perform private.finance_require_open(p_date);
 select * into a from public.treasury_accounts where id=p_account and active and account_kind<>'credit_card';
 if not found then raise exception 'Active liquid account required'; end if;
 if exists(select 1 from public.finance_customer_events where kind='credit' and source_id=s.id and status='pending') or exists(select 1 from public.finance_customer_cod_allocations where sale_id=s.id and status='pending') then raise exception 'Resolve pending customer credit or COD before payment'; end if;
 v_due=private.finance_customer_balance(s.id,case when p_kind='customer_receipt' then '1100' else '2300' end)-
 coalesce((select sum(amount) from public.treasury_transactions where customer_event_id=s.id and kind=p_kind and status='pending'),0);
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount or p_amount>v_due then raise exception 'Customer payment exceeds unreserved receivable or refund payable'; end if;
 if p_path is null or p_path not like auth.uid()::text||'/%' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or
 not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path) then raise exception 'Original customer cash evidence required'; end if;
 insert into public.treasury_transactions(kind,customer_event_id,source_account_id,target_account_id,amount,business_date,external_reference,memo,requested_by)
 values(p_kind,s.id,case when p_kind='customer_refund' then a.id end,case when p_kind='customer_receipt' then a.id end,p_amount,p_date,btrim(p_reference),'Customer cash for approved sale '||s.id,auth.uid()) returning id into v_id;
 insert into public.finance_customer_cash_evidence(transaction_id,evidence_path,evidence_sha256) values(v_id,p_path,p_sha256);
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_cash_requested','treasury_transaction',v_id,jsonb_build_object('sale_id',s.id,'kind',p_kind,'amount',p_amount));
 return v_id;
end $$;
revoke all on function public.finance_request_customer_credit(uuid,jsonb,numeric,boolean,date,text,text,text),public.finance_review_customer_credit(uuid,boolean,text),public.finance_request_customer_cash(uuid,text,uuid,numeric,date,text,text,text) from public,anon,authenticated;
grant execute on function public.finance_request_customer_credit(uuid,jsonb,numeric,boolean,date,text,text,text),public.finance_review_customer_credit(uuid,boolean,text),public.finance_request_customer_cash(uuid,text,uuid,numeric,date,text,text,text) to authenticated;

create or replace function public.treasury_review_transaction(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); t public.treasury_transactions%rowtype;
 src public.treasury_accounts%rowtype; dst public.treasury_accounts%rowtype;
 facility public.treasury_facilities%rowtype; ex public.finance_expenses%rowtype; pb public.procurement_supplier_bills%rowtype;
 v_lines jsonb:='[]'::jsonb;v_source_balance numeric;v_card_balance numeric;v_facility_balance numeric;
 v_total numeric;v_id uuid;
begin
 if not private.finance_super(v_actor) then raise exception 'Treasury reviewer requires Super Admin'; end if;
 select * into t from public.treasury_transactions where id=p_id for update;
 if not found or t.status<>'pending' then raise exception 'Treasury request not pending'; end if;
 if t.requested_by=v_actor then raise exception 'Independent maker-checker required'; end if;
 if not coalesce(p_approve,false) then
  if length(btrim(coalesce(p_note,'')))<5 then raise exception 'Treasury rejection reason required'; end if;
  update public.treasury_transactions set status='rejected',approved_by=v_actor,approved_at=now(),
    reviewed_note=btrim(p_note) where id=t.id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(v_actor,'treasury_transaction_rejected','treasury_transaction',t.id,jsonb_build_object('reason',p_note));
  return 'rejected';
 end if;
 perform private.finance_require_open(t.business_date);
 -- Lock resources in deterministic UUID order before balance checks, avoiding simultaneous overspending.
 perform id from public.treasury_accounts
   where id in (t.source_account_id,t.target_account_id) order by id for update;
 if t.source_account_id is not null then
   select * into src from public.treasury_accounts where id=t.source_account_id;
   if not src.active then raise exception 'Source account is no longer active'; end if;
 end if;
 if t.target_account_id is not null then
   select * into dst from public.treasury_accounts where id=t.target_account_id;
   if not dst.active then raise exception 'Target account is no longer active'; end if;
 end if;
 if t.facility_id is not null then
   select * into facility from public.treasury_facilities where id=t.facility_id for update;
   if not facility.active then raise exception 'Facility is no longer active'; end if;
 end if;
 v_total=t.amount+t.interest_amount+t.fee_amount;
 if t.source_account_id is not null then
   v_source_balance=private.treasury_account_balance(src.id);
   if v_source_balance-v_total<src.restricted_amount and t.kind<>'expense_card'
   then raise exception 'Insufficient unrestricted cash at source account'; end if;
 end if;
 if t.kind in ('expense_cash','expense_card') then
   select * into ex from public.finance_expenses where id=t.expense_id for update;
   if ex.status<>'posted' or ex.amount<>t.amount then raise exception 'Expense no longer available for settlement'; end if;
   if exists(select 1 from public.finance_settlement_requests
       where expense_id=t.expense_id and status in ('pending','verified'))
   then raise exception 'Existing verified or pending finance payment'; end if;
 end if;
 if t.kind='transfer' then
   v_lines=jsonb_build_array(
     jsonb_build_object('account',dst.ledger_code,'debit',t.amount),
     jsonb_build_object('account',src.ledger_code,'credit',t.amount));
 elsif t.kind='loan_draw' then
   v_lines=jsonb_build_array(
     jsonb_build_object('account',dst.ledger_code,'debit',t.amount),
     jsonb_build_object('account',facility.ledger_code,'credit',t.amount));
 elsif t.kind='loan_repay' then
   v_facility_balance=private.treasury_facility_balance(facility.id);
   if t.amount>v_facility_balance then raise exception 'Loan principal payment exceeds outstanding principal'; end if;
   v_lines=jsonb_build_array(
     jsonb_build_object('account',facility.ledger_code,'debit',t.amount),
     jsonb_build_object('account',src.ledger_code,'credit',v_total));
   if t.interest_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','6600','debit',t.interest_amount)); end if;
   if t.fee_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','6605','debit',t.fee_amount)); end if;
 elsif t.kind='card_bill' then
   v_card_balance=private.treasury_account_balance(dst.id);
   if t.amount>v_card_balance then raise exception 'Card payment exceeds outstanding card liability'; end if;
   v_lines=jsonb_build_array(
     jsonb_build_object('account',dst.ledger_code,'debit',t.amount),
     jsonb_build_object('account',src.ledger_code,'credit',t.amount));
 elsif t.kind='expense_cash' then
   v_lines=jsonb_build_array(
     jsonb_build_object('account','2000','debit',t.amount),
     jsonb_build_object('account',src.ledger_code,'credit',t.amount));
 elsif t.kind='expense_card' then
   v_card_balance=private.treasury_account_balance(dst.id);
   if v_card_balance+t.amount>dst.credit_limit then raise exception 'Credit card limit exceeded'; end if;
   v_lines=jsonb_build_array(
     jsonb_build_object('account','2000','debit',t.amount),
     jsonb_build_object('account',dst.ledger_code,'credit',t.amount));
 elsif t.kind='supplier_payment' then
   select * into pb from public.procurement_supplier_bills where id=t.supplier_bill_id for update;
   if not found or pb.status<>'posted' or t.amount>pb.amount-private.finance_bill_credit_total(pb.id)-coalesce((select sum(amount) from public.treasury_transactions where supplier_bill_id=pb.id and status='posted'),0) then raise exception 'Supplier payable is missing, altered or already paid'; end if;
   if exists(select 1 from public.finance_supplier_credit_notes where bill_id=pb.id and status='pending') then raise exception 'Resolve pending supplier return before payment'; end if;
   if src.account_kind='credit_card' then raise exception 'Supplier payment must come from liquid account'; end if;
   v_lines=jsonb_build_array(
     jsonb_build_object('account','2100','debit',t.amount),
     jsonb_build_object('account',src.ledger_code,'credit',t.amount));
 elsif t.kind in ('customer_receipt','customer_refund') then
   perform id from public.finance_customer_events where id=t.customer_event_id and kind='sale' and status='posted' for update;
   if not found then raise exception 'Posted customer sale required'; end if;
   if exists(select 1 from public.finance_customer_events where kind='credit' and source_id=t.customer_event_id and status='pending') then raise exception 'Resolve pending customer credit before payment'; end if;
   if t.amount>private.finance_customer_balance(t.customer_event_id,case when t.kind='customer_receipt' then '1100' else '2300' end) then raise exception 'Customer payment exceeds remaining receivable or refund payable'; end if;
   if t.kind='customer_receipt' then
    if dst.account_kind='credit_card' then raise exception 'Customer receipt requires liquid account'; end if;
    v_lines=jsonb_build_array(jsonb_build_object('account',dst.ledger_code,'debit',t.amount),jsonb_build_object('account','1100','credit',t.amount));
   else
    if src.account_kind='credit_card' then raise exception 'Customer refund requires liquid account'; end if;
    v_lines=jsonb_build_array(jsonb_build_object('account','2300','debit',t.amount),jsonb_build_object('account',src.ledger_code,'credit',t.amount));
   end if;
 elsif t.kind='owner_capital' then
   v_lines=jsonb_build_array(
     jsonb_build_object('account',dst.ledger_code,'debit',t.amount),
     jsonb_build_object('account','3000','credit',t.amount));
 elsif t.kind='owner_draw' then
   v_lines=jsonb_build_array(
     jsonb_build_object('account','3200','debit',t.amount),
     jsonb_build_object('account',src.ledger_code,'credit',t.amount));
 end if;
 v_id=private.treasury_post('treasury:transaction:'||t.id,t.id,t.business_date,t.memo,v_lines,v_actor);
 update public.treasury_transactions set status='posted',approved_by=v_actor,approved_at=now(),
  reviewed_note=nullif(btrim(coalesce(p_note,'')),''),journal_id=v_id where id=t.id;
 if t.kind in ('expense_cash','expense_card') then
   update public.finance_expenses set status='settled',updated_at=now() where id=t.expense_id;
 end if;
 if t.kind='supplier_payment' then
   update public.procurement_supplier_bills set status=case when amount-private.finance_bill_credit_total(t.supplier_bill_id)=coalesce((select sum(amount) from public.treasury_transactions where supplier_bill_id=t.supplier_bill_id and status='posted'),0) then 'settled' else 'posted' end where id=t.supplier_bill_id;
 end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_transaction_posted','treasury_transaction',t.id,
  jsonb_build_object('kind',t.kind,'amount',t.amount,'interest',t.interest_amount,
   'fee',t.fee_amount,'journal_id',v_id,'bank_verified',false));
 return 'posted';
end $$;



-- Apply accepted aggregate COD custody to specific completed source orders.
-- This is a liability-to-AR allocation, never another debit to physical cash.
create table public.finance_customer_cod_allocations (
 id uuid primary key default gen_random_uuid(),
 sale_id uuid not null references public.finance_customer_events(id) on delete restrict,
 day_id uuid not null references public.treasury_community_cash_receipts(day_id) on delete restrict,
 product_amount numeric(16,2) not null check(product_amount>=0),
 delivery_amount numeric(16,2) not null check(delivery_amount>=0),
 requested_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','posted','rejected')),
 journal_id uuid unique references public.finance_journals(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(product_amount+delivery_amount>0),check(reviewed_by is null or reviewed_by<>requested_by)
);
create index finance_cod_source_reservations on public.finance_customer_cod_allocations(day_id,status);
alter table public.finance_customer_cod_allocations enable row level security;
revoke all on public.finance_customer_cod_allocations from public,anon,authenticated,service_role;
create trigger finance_database_write_lock before insert or update or delete on public.finance_customer_cod_allocations for each row execute function private.finance_write_lock();
create trigger finance_customer_cod_source_immutable before update or delete on public.finance_customer_cod_allocations for each row execute function private.finance_supplier_credit_immutable_source();
create function public.finance_request_cod_allocation(p_sale uuid,p_day uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.finance_customer_events%rowtype;r public.treasury_community_cash_receipts%rowtype;o public.community_ops_day_orders%rowtype;v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 select * into s from public.finance_customer_events where id=p_sale and kind='sale' and status='posted' for update;
 if not found or s.source_kind<>'order' then raise exception 'Completed posted order sale required for COD allocation'; end if;
 perform private.finance_require_open((now() at time zone 'Asia/Dhaka')::date);
 select * into r from public.treasury_community_cash_receipts where day_id=p_day for update;
 if not found then raise exception 'Posted physical COD custody required'; end if;
 select * into o from public.community_ops_day_orders where day_id=p_day and order_id=s.source_id and state='completed' and payment_mode='cod';
 if not found or o.product_cash_received+o.delivery_cash_received<=0 then raise exception 'Completed source order COD receipt required'; end if;
 if exists(select 1 from public.finance_customer_cod_allocations where sale_id=s.id and status in ('pending','posted')) then raise exception 'Order COD already allocated or pending'; end if;
 if o.product_cash_received>s.product_amount or o.delivery_cash_received>s.delivery_amount or o.product_cash_received+o.delivery_cash_received>private.finance_customer_balance(s.id,'1100') then raise exception 'COD exceeds order source or remaining receivable'; end if;
 if o.product_cash_received+coalesce((select sum(product_amount) from public.finance_customer_cod_allocations where day_id=r.day_id and status in ('pending','posted')),0)>r.product_cash or
 o.delivery_cash_received+coalesce((select sum(delivery_amount) from public.finance_customer_cod_allocations where day_id=r.day_id and status in ('pending','posted')),0)>r.delivery_cash then raise exception 'COD allocation exceeds unreserved accepted custody'; end if;
 if exists(select 1 from public.treasury_transactions where customer_event_id=s.id and status='pending') or exists(select 1 from public.finance_customer_events where kind='credit' and source_id=s.id and status='pending') then raise exception 'Resolve pending customer payment or credit before COD allocation'; end if;
 insert into public.finance_customer_cod_allocations(sale_id,day_id,product_amount,delivery_amount,requested_by)
 values(s.id,r.day_id,o.product_cash_received,o.delivery_cash_received,auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_cod_allocation_requested','finance_customer_cod_allocation',v_id,jsonb_build_object('sale_id',s.id,'day_id',r.day_id));
 return v_id;
end $$;
create function public.finance_review_cod_allocation(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.finance_customer_cod_allocations%rowtype;s public.finance_customer_events%rowtype;v_lines jsonb;v_journal uuid;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into a from public.finance_customer_cod_allocations where id=p_id for update;
 if not found or a.status<>'pending' then raise exception 'COD allocation not pending'; end if;
 if a.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'COD review reason required'; end if;
 if p_approve then
 perform private.finance_require_open((now() at time zone 'Asia/Dhaka')::date);
 select * into s from public.finance_customer_events where id=a.sale_id for update;
 perform day_id from public.treasury_community_cash_receipts where day_id=a.day_id for update;
 if a.product_amount+a.delivery_amount>private.finance_customer_balance(s.id,'1100') then raise exception 'COD exceeds remaining receivable'; end if;
 v_lines=jsonb_build_array(jsonb_build_object('account','1100','credit',a.product_amount+a.delivery_amount));
 if a.product_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','2210','debit',a.product_amount)); end if;
 if a.delivery_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','2211','debit',a.delivery_amount)); end if;
 v_journal=private.treasury_post('customer:cod:'||a.id,a.id,(now() at time zone 'Asia/Dhaka')::date,p_note,v_lines,auth.uid());
 end if;
 update public.finance_customer_cod_allocations set status=case when p_approve then 'posted' else 'rejected' end,reviewed_by=auth.uid(),journal_id=v_journal where id=a.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_cod_allocation_'||case when p_approve then 'posted' else 'rejected' end,'finance_customer_cod_allocation',a.id,jsonb_build_object('note',p_note,'journal_id',v_journal,'cash_movement',0));
 return case when p_approve then 'posted' else 'rejected' end;
end $$;
-- Include applied COD when determining remaining AR. Original physical cash remains unchanged.
create or replace function private.finance_customer_balance(p_sale uuid,p_account text) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when p_account='2300' then l.credit-l.debit else l.debit-l.credit end),0)
 from public.finance_journal_lines l where l.account_code=p_account and l.journal_id in (
 select journal_id from public.finance_customer_events where (id=p_sale or source_kind='sale' and source_id=p_sale) and status='posted'
 union all select journal_id from public.treasury_transactions where customer_event_id=p_sale and status='posted'
 union all select journal_id from public.finance_customer_cod_allocations where sale_id=p_sale and status='posted')
$$;
revoke all on function public.finance_request_cod_allocation(uuid,uuid),public.finance_review_cod_allocation(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finance_request_cod_allocation(uuid,uuid),public.finance_review_cod_allocation(uuid,boolean,text) to authenticated;
