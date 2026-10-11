-- Cash before fulfilment is a liability, never earned revenue.
insert into public.finance_accounts(code,title,kind) values('2200','Unallocated customer advances','liability') on conflict(code) do nothing;
alter table public.treasury_transactions add column customer_source_kind text check(customer_source_kind in ('order','group_commitment'));
alter table public.treasury_transactions add column customer_source_id uuid;
alter table public.treasury_transactions drop constraint treasury_transactions_kind_check;
alter table public.treasury_transactions add constraint treasury_transactions_kind_check check(kind in
 ('transfer','loan_draw','loan_repay','card_bill','expense_cash','expense_card','owner_capital','owner_draw','supplier_payment','customer_receipt','customer_refund','supplier_credit_receipt','customer_deposit','cancellation_refund'));
create index treasury_customer_source on public.treasury_transactions(customer_source_kind,customer_source_id,status);
create table public.finance_customer_deposit_applications (
 sale_id uuid primary key references public.finance_customer_events(id) on delete restrict,
 source_kind text not null,source_id uuid not null,amount numeric(16,2) not null check(amount>0),
 journal_id uuid not null unique references public.finance_journals(id) on delete restrict,
 applied_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now()
);
alter table public.finance_customer_deposit_applications enable row level security;
revoke all on public.finance_customer_deposit_applications from public,anon,authenticated,service_role;
create trigger finance_database_write_lock before insert or update or delete on public.finance_customer_deposit_applications for each row execute function private.finance_write_lock();
create trigger finance_customer_deposits_immutable before update or delete on public.finance_customer_deposit_applications for each row execute function private.finance_reject_journal_mutation();
create function private.finance_customer_deposit_balance(p_kind text,p_id uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce((select sum(case when kind='customer_deposit' then amount else -amount end) from public.treasury_transactions where customer_source_kind=p_kind and customer_source_id=p_id and status='posted' and kind in ('customer_deposit','cancellation_refund')),0)-coalesce((select sum(amount) from public.finance_customer_deposit_applications where source_kind=p_kind and source_id=p_id),0)
$$;
revoke all on function private.finance_customer_deposit_balance(text,uuid) from public,anon,authenticated,service_role;
create function private.finance_deposit_source(p_kind text,p_id uuid,p_cancelled boolean,p_review boolean default false) returns numeric
language plpgsql security definer set search_path='' as $$
declare v_state text;v_amount numeric;
begin
 if not exists(select 1 from private.finance_uat_entities where entity_type=p_kind and entity_id=p_id) then raise exception using errcode='42501',message='UAT scope denied: customer source is not operator-registered'; end if;
 if p_kind='order' then select status,total_amount into v_state,v_amount from public.orders where id=p_id for update;
 elsif p_kind='group_commitment' then select g.status,g.quantity*d.locked_unit_price into v_state,v_amount from public.group_deal_commitments g join public.group_deals d on d.id=g.group_deal_id where g.id=p_id for update of g;
 else raise exception 'Unsupported customer deposit source'; end if;
 if v_amount is null or v_amount<=0 then raise exception 'Locked customer purchase amount required'; end if;
 if p_cancelled then
 if v_state<>'cancelled' or exists(select 1 from public.finance_customer_events where kind='sale' and source_kind=p_kind and source_id=p_id and status='posted') then raise exception 'Unfulfilled cancelled source required for deposit refund'; end if;
 else
 if v_state='cancelled' or not p_review and v_state in ('completed','fulfilled') or exists(select 1 from public.finance_customer_events where kind='sale' and source_kind=p_kind and source_id=p_id and status='posted') then raise exception 'Unfulfilled active source required for customer deposit'; end if;
 end if;
 return v_amount;
end $$;
revoke all on function private.finance_deposit_source(text,uuid,boolean,boolean) from public,anon,authenticated,service_role;
create function public.finance_request_customer_deposit(p_source_kind text,p_source uuid,p_refund boolean,p_account uuid,p_amount numeric,p_date date,p_reference text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_amount numeric;v_remaining numeric;v_id uuid;v_kind text;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();perform private.finance_require_open(p_date);
 if p_date is null or p_date>(now() at time zone 'Asia/Dhaka')::date or p_refund is null then raise exception 'Valid customer cash date and operation required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('finance:customer-source:'||p_source_kind||':'||p_source,0));
 v_amount=private.finance_deposit_source(p_source_kind,p_source,p_refund,false);
 v_kind=case when p_refund then 'cancellation_refund' else 'customer_deposit' end;
 if exists(select 1 from public.treasury_transactions where customer_source_kind=p_source_kind and customer_source_id=p_source and status='pending' and kind<>v_kind) then raise exception 'Resolve other pending customer deposit operation'; end if;
 if p_refund then v_remaining=private.finance_customer_deposit_balance(p_source_kind,p_source);
 else v_remaining=v_amount-coalesce((select sum(amount) from public.treasury_transactions where customer_source_kind=p_source_kind and customer_source_id=p_source and kind='customer_deposit' and status='posted'),0); end if;
 v_remaining=v_remaining-coalesce((select sum(amount) from public.treasury_transactions where customer_source_kind=p_source_kind and customer_source_id=p_source and kind=v_kind and status='pending'),0);
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount or p_amount>v_remaining then raise exception 'Customer deposit cash exceeds unreserved source entitlement'; end if;
 if not exists(select 1 from public.treasury_accounts where id=p_account and active and account_kind<>'credit_card') then raise exception 'Liquid customer cash account required'; end if;
 if length(btrim(coalesce(p_reference,'')))<4 or p_path not like auth.uid()::text||'/%' or p_sha256 !~ '^[a-f0-9]{64}$' or not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path) then raise exception 'Original customer deposit cash proof required'; end if;
 insert into public.treasury_transactions(kind,source_account_id,target_account_id,customer_source_kind,customer_source_id,amount,business_date,external_reference,memo,requested_by)
 values(v_kind,case when p_refund then p_account end,case when not p_refund then p_account end,p_source_kind,p_source,p_amount,p_date,btrim(p_reference),'Actual customer advance / cancelled source refund',auth.uid()) returning id into v_id;
 insert into public.finance_customer_cash_evidence(transaction_id,evidence_path,evidence_sha256) values(v_id,p_path,p_sha256);
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'finance_customer_deposit_requested','treasury_transaction',v_id,jsonb_build_object('source_kind',p_source_kind,'source_id',p_source,'amount',p_amount,'refund',p_refund));
 return v_id;
end $$;
revoke all on function public.finance_request_customer_deposit(text,uuid,boolean,uuid,numeric,date,text,text,text) from public,anon,authenticated;
grant execute on function public.finance_request_customer_deposit(text,uuid,boolean,uuid,numeric,date,text,text,text) to authenticated;
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
 elsif t.kind in ('customer_deposit','cancellation_refund') then
   perform pg_advisory_xact_lock(hashtextextended('finance:customer-source:'||t.customer_source_kind||':'||t.customer_source_id,0));
   perform private.finance_deposit_source(t.customer_source_kind,t.customer_source_id,t.kind='cancellation_refund',true);
   if t.kind='customer_deposit' then
    if dst.account_kind='credit_card' then raise exception 'Customer deposit requires liquid account'; end if;
    v_lines=jsonb_build_array(jsonb_build_object('account',dst.ledger_code,'debit',t.amount),jsonb_build_object('account','2200','credit',t.amount));
   else
    if src.account_kind='credit_card' or t.amount>private.finance_customer_deposit_balance(t.customer_source_kind,t.customer_source_id) then raise exception 'Cancellation refund exceeds actual unallocated customer deposit'; end if;
    v_lines=jsonb_build_array(jsonb_build_object('account','2200','debit',t.amount),jsonb_build_object('account',src.ledger_code,'credit',t.amount));
   end if;
 elsif t.kind='supplier_credit_receipt' then
   perform id from public.finance_supplier_credit_notes where id=t.supplier_credit_note_id and status='posted' for update;
   if not found or t.amount>private.finance_supplier_credit_balance(t.supplier_credit_note_id) then raise exception 'Supplier recovery exceeds remaining credit receivable'; end if;
   if dst.account_kind='credit_card' then raise exception 'Supplier recovery requires liquid account'; end if;
   v_lines=jsonb_build_array(jsonb_build_object('account',dst.ledger_code,'debit',t.amount),jsonb_build_object('account','1300','credit',t.amount));
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




create or replace function public.finance_review_customer_sale(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.finance_customer_events%rowtype;l public.finance_inventory_lots%rowtype;x record;
 v_lines jsonb;v_journal uuid;v_stock integer;v_delivery_expense uuid;v_attribution uuid;v_delivery_cost numeric;v_deposit numeric;v_deposit_journal uuid;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into e from public.finance_customer_events where id=p_id for update;
 if not found or e.kind<>'sale' or e.status<>'pending' then raise exception 'Customer sale not pending'; end if;
 if e.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Sale review reason required'; end if;
 if p_approve then
 perform private.finance_require_open(e.business_date);
 perform pg_advisory_xact_lock(hashtextextended('finance:customer-source:'||e.source_kind||':'||e.source_id,0));
 if exists(select 1 from public.treasury_transactions where customer_source_kind=e.source_kind and customer_source_id=e.source_id and status='pending') then raise exception 'Resolve pending customer deposits before earning sale'; end if;
 if private.finance_fulfilled_source(e.source_kind,e.source_id)<>e.source_snapshot then raise exception 'Completed customer source changed since request'; end if;
 for x in select (r->>'bill_id')::uuid bill_id,sum((r->>'quantity')::integer)::integer qty,sum((r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost from jsonb_array_elements(e.allocations) r group by r->>'bill_id' order by r->>'bill_id' loop
 select * into l from public.finance_inventory_lots where bill_id=x.bill_id for update;
 v_stock=l.received_quantity+coalesce((select sum(quantity) from public.finance_inventory_movements where bill_id=l.bill_id),0);
 if x.qty>v_stock then raise exception 'Allocated stock no longer available'; end if;
 end loop;
 v_lines=jsonb_build_array(jsonb_build_object('account','1100','debit',e.product_amount+e.delivery_amount),
 jsonb_build_object('account','4000','credit',e.product_amount),jsonb_build_object('account','5000','debit',e.cogs_amount),jsonb_build_object('account','1200','credit',e.cogs_amount));
 if e.delivery_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','4010','credit',e.delivery_amount)); end if;
 v_journal=private.treasury_post('customer:sale:'||e.id,e.id,e.business_date,e.reason,v_lines,auth.uid());
 v_deposit=least(e.product_amount+e.delivery_amount,greatest(0,private.finance_customer_deposit_balance(e.source_kind,e.source_id)));
 if v_deposit>0 then
 v_deposit_journal=private.treasury_post('customer:deposit:apply:'||e.id,e.id,e.business_date,'Apply actual customer advance to earned source AR',jsonb_build_array(jsonb_build_object('account','2200','debit',v_deposit),jsonb_build_object('account','1100','credit',v_deposit)),auth.uid());
 insert into public.finance_customer_deposit_applications(sale_id,source_kind,source_id,amount,journal_id,applied_by) values(e.id,e.source_kind,e.source_id,v_deposit,v_deposit_journal,auth.uid());
 end if;
 v_delivery_cost=coalesce((e.source_snapshot->>'delivery_actual_cost')::numeric,0);
 if v_delivery_cost>0 then
  insert into public.finance_expenses(category,description,vendor_name,document_reference,evidence_path,evidence_sha256,amount,incurred_on,community_id,created_by)
  values('logistics','Actual delivery for completed sale '||e.id,'Delivery service','DELIVERY-'||e.id,e.evidence_path,e.evidence_sha256,v_delivery_cost,e.business_date,e.community_id,e.requested_by) returning id into v_delivery_expense;
  -- Uses the existing independent reviewer and large/dual expense approval rules.
  perform public.finance_review_expense(v_delivery_expense,true,p_note);
  insert into public.finance_customer_delivery_expenses(event_id,expense_id) values(e.id,v_delivery_expense);
  insert into public.finance_expense_attributions(expense_id,allocations,reason,requested_by)
  values(v_delivery_expense,jsonb_build_array(jsonb_build_object('amount',v_delivery_cost,'cost_center','logistics','community_id',e.community_id,'pool_id',e.source_snapshot->>'pool_id')),
   'Direct actual delivery attribution to original completed sale',e.requested_by) returning id into v_attribution;
  perform public.finance_review_expense_attribution(v_attribution,true,p_note);
 end if;
 for x in select (r->>'bill_id')::uuid bill_id,sum((r->>'quantity')::integer)::integer qty,sum((r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost from jsonb_array_elements(e.allocations) r group by r->>'bill_id' loop
 insert into public.finance_inventory_movements(bill_id,event_key,quantity,value,journal_id) values(x.bill_id,'customer:sale:'||e.id||':'||x.bill_id,-x.qty,-x.cost,v_journal);
 end loop;
 end if;
 update public.finance_customer_events set status=case when p_approve then 'posted' else 'rejected' end,reviewed_by=auth.uid(),journal_id=v_journal where id=e.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_sale_'||case when p_approve then 'posted' else 'rejected' end,'finance_customer_event',e.id,jsonb_build_object('note',p_note,'journal_id',v_journal,'revenue',e.product_amount,'delivery',e.delivery_amount,'cogs',e.cogs_amount));
 return case when p_approve then 'posted' else 'rejected' end;
end $$;

create function public.finance_customer_deposit_workbench() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 return coalesce((select jsonb_agg(x.source order by x.source->>'label') from (
 select jsonb_build_object('kind','order','id',o.id,'label',o.order_code,'status',o.status,'amount',o.total_amount,'unallocated_deposit',private.finance_customer_deposit_balance('order',o.id)) source from public.orders o where o.status<>'completed' and o.payment_status<>'waived_test_order'
 union all select jsonb_build_object('kind','group_commitment','id',g.id,'label',d.title||' · '||left(g.id::text,8),'status',g.status,'amount',g.quantity*d.locked_unit_price,'unallocated_deposit',private.finance_customer_deposit_balance('group_commitment',g.id)) from public.group_deal_commitments g join public.group_deals d on d.id=g.group_deal_id where g.status<>'fulfilled' and d.locked_unit_price is not null) x),'[]'::jsonb);
end $$;
revoke all on function public.finance_customer_deposit_workbench() from public,anon,authenticated;
grant execute on function public.finance_customer_deposit_workbench() to authenticated;
create or replace function private.finance_customer_balance(p_sale uuid,p_account text) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when p_account='2300' then l.credit-l.debit else l.debit-l.credit end),0)
 from public.finance_journal_lines l where l.account_code=p_account and l.journal_id in (
 select journal_id from public.finance_customer_events where (id=p_sale or source_kind='sale' and source_id=p_sale) and status='posted'
 union all select journal_id from public.treasury_transactions where customer_event_id=p_sale and status='posted'
 union all select journal_id from public.finance_customer_cod_allocations where sale_id=p_sale and status='posted'
 union all select journal_id from public.finance_customer_deposit_applications where sale_id=p_sale)
$$;
