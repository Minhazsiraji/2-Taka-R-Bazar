-- Inventory layers come only from newly posted, three-way-matched invoices.
-- Historical invoices need explicit opening-stock reconciliation; no invented lots.
insert into public.finance_accounts(code,title,kind) values('1300','Supplier credit receivable','asset') on conflict do nothing;
create table public.finance_inventory_lots (
 bill_id uuid primary key references public.procurement_supplier_bills(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 received_quantity integer not null check(received_quantity>0),
 unit_cost numeric(16,2) not null check(unit_cost>0),
 created_at timestamptz not null default now()
);
create table public.finance_inventory_movements (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.finance_inventory_lots(bill_id) on delete restrict,
 event_key text not null unique,
 quantity integer not null check(quantity<>0),
 value numeric(16,2) not null check(value<>0),
 journal_id uuid not null references public.finance_journals(id) on delete restrict,
 created_at timestamptz not null default now(),
 check((quantity>0)=(value>0))
);
create table public.finance_supplier_credit_notes (
 id uuid primary key default gen_random_uuid(),
 bill_id uuid not null references public.procurement_supplier_bills(id) on delete restrict,
 reference text not null check(length(btrim(reference)) between 4 and 100),
 quantity integer not null check(quantity>0),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 evidence_path text not null unique,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 business_date date not null,
 requested_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','posted','rejected')),
 journal_id uuid unique references public.finance_journals(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(reviewed_by is null or reviewed_by<>requested_by)
);
create unique index finance_supplier_credit_reference on public.finance_supplier_credit_notes(bill_id,upper(btrim(reference))) where status<>'rejected';
create unique index finance_supplier_credit_hash on public.finance_supplier_credit_notes(evidence_sha256) where status<>'rejected';
do $$ declare t text; begin
 foreach t in array array['finance_inventory_lots','finance_inventory_movements','finance_supplier_credit_notes'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger finance_database_write_lock before insert or update or delete on public.%I for each row execute function private.finance_write_lock()',t);
 end loop;
end $$;
create trigger finance_inventory_lots_immutable before update or delete on public.finance_inventory_lots
 for each row execute function private.finance_reject_journal_mutation();
create trigger finance_inventory_movements_immutable before update or delete on public.finance_inventory_movements
 for each row execute function private.finance_reject_journal_mutation();

create function private.finance_capture_inventory_lot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='submitted' and new.status='posted' and new.journal_id is not null then
 insert into public.finance_inventory_lots(bill_id,product_id,received_quantity,unit_cost)
 select new.id,p.product_id,new.quantity,new.unit_price from public.procurement_purchase_orders p where p.id=new.po_id;
 end if;
 return new;
end $$;
revoke all on function private.finance_capture_inventory_lot() from public,anon,authenticated,service_role;
create trigger finance_inventory_on_invoice_post after update on public.procurement_supplier_bills
 for each row execute function private.finance_capture_inventory_lot();

create function private.finance_bill_credit_total(p_bill uuid) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce(sum(c.quantity*b.unit_price),0) from public.finance_supplier_credit_notes c
 join public.procurement_supplier_bills b on b.id=c.bill_id where c.bill_id=p_bill and c.status='posted'
$$;
revoke all on function private.finance_bill_credit_total(uuid) from public,anon,authenticated,service_role;

create function public.finance_request_supplier_return(p_bill uuid,p_quantity integer,p_reference text,p_date date,p_reason text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.procurement_supplier_bills%rowtype;l public.finance_inventory_lots%rowtype;v_available integer;v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 select * into b from public.procurement_supplier_bills where id=p_bill for update;
 if not found or b.status not in ('posted','settled') then raise exception 'Posted supplier bill required'; end if;
 select * into l from public.finance_inventory_lots where bill_id=b.id for update;
 if not found then raise exception 'Reconciled inventory lot required'; end if;
 v_available=l.received_quantity+coalesce((select sum(quantity) from public.finance_inventory_movements where bill_id=b.id),0)
 -coalesce((select sum(quantity) from public.finance_supplier_credit_notes where bill_id=b.id and status='pending'),0);
 if p_quantity is null or p_quantity<=0 or p_quantity>v_available then raise exception 'Return exceeds unreserved inventory'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Dhaka')::date or p_date<b.invoice_date then raise exception 'Invalid return date'; end if;
 perform private.finance_require_open(p_date);
 if p_path is null or p_path not like auth.uid()::text||'/%' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
 or not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path)
 then raise exception 'Uploaded original supplier credit and return evidence required'; end if;
 if exists(select 1 from public.treasury_transactions where supplier_bill_id=b.id and status='pending') then
 raise exception 'Resolve pending supplier payment before return'; end if;
 insert into public.finance_supplier_credit_notes(bill_id,quantity,reference,business_date,reason,evidence_path,evidence_sha256,requested_by)
 values(b.id,p_quantity,btrim(p_reference),p_date,btrim(p_reason),p_path,p_sha256,auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'supplier_return_requested','finance_supplier_credit_note',v_id,jsonb_build_object('bill_id',b.id,'quantity',p_quantity,'reference',p_reference));
 return v_id;
end $$;

create function public.finance_review_supplier_return(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare c public.finance_supplier_credit_notes%rowtype;b public.procurement_supplier_bills%rowtype;
 l public.finance_inventory_lots%rowtype;v_stock integer;v_amount numeric;v_ap numeric;v_receivable numeric;v_lines jsonb;v_journal uuid;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into c from public.finance_supplier_credit_notes where id=p_id for update;
 if not found or c.status<>'pending' then raise exception 'Supplier return not pending'; end if;
 if c.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Return review reason required'; end if;
 select * into b from public.procurement_supplier_bills where id=c.bill_id for update;
 select * into l from public.finance_inventory_lots where bill_id=b.id for update;
 if not p_approve then
 update public.finance_supplier_credit_notes set status='rejected',reviewed_by=auth.uid() where id=c.id;
 else
 perform private.finance_require_open(c.business_date);
 if exists(select 1 from public.treasury_transactions where supplier_bill_id=b.id and status='pending') then raise exception 'Resolve pending supplier payment before return'; end if;
 v_stock=l.received_quantity+coalesce((select sum(quantity) from public.finance_inventory_movements where bill_id=b.id),0);
 if c.quantity>v_stock then raise exception 'Returned stock already allocated or unavailable'; end if;
 v_amount=c.quantity*l.unit_cost;
 v_ap=least(v_amount,greatest(0,b.amount-private.finance_bill_credit_total(b.id)-coalesce((select sum(amount) from public.treasury_transactions where supplier_bill_id=b.id and status='posted'),0)));
 v_receivable=v_amount-v_ap;
 v_lines=jsonb_build_array(jsonb_build_object('account','1200','credit',v_amount));
 if v_ap>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','2100','debit',v_ap)); end if;
 if v_receivable>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','1300','debit',v_receivable)); end if;
 v_journal=private.treasury_post('supplier:return:'||c.id,c.id,c.business_date,c.reason,v_lines,auth.uid());
 insert into public.finance_inventory_movements(bill_id,event_key,quantity,value,journal_id)
 values(b.id,'supplier:return:'||c.id,-c.quantity,-v_amount,v_journal);
 update public.finance_supplier_credit_notes set status='posted',reviewed_by=auth.uid(),journal_id=v_journal where id=c.id;
 if b.amount-private.finance_bill_credit_total(b.id)-coalesce((select sum(amount) from public.treasury_transactions where supplier_bill_id=b.id and status='posted'),0)<=0 then
 update public.procurement_supplier_bills set status='settled' where id=b.id; end if;
 end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'supplier_return_'||case when p_approve then 'posted' else 'rejected' end,'finance_supplier_credit_note',c.id,
 jsonb_build_object('note',btrim(p_note),'journal_id',v_journal,'credit_receivable',v_receivable));
 return case when p_approve then 'posted' else 'rejected' end;
end $$;
revoke all on function public.finance_request_supplier_return(uuid,integer,text,date,text,text,text),public.finance_review_supplier_return(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finance_request_supplier_return(uuid,integer,text,date,text,text,text),public.finance_review_supplier_return(uuid,boolean,text) to authenticated;

-- Credits reduce subsequent cash reservations and settlement balances.
create or replace function public.treasury_request_supplier_payment(
 p_bill_id uuid,p_bank_account uuid,p_reference text,p_payment_date date,p_amount numeric
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid(); b public.procurement_supplier_bills%rowtype;
 a public.treasury_accounts%rowtype;v_id uuid;v_available numeric;v_amount numeric;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff role required'; end if;
 select * into b from public.procurement_supplier_bills where id=p_bill_id for update;
 if not found or b.status<>'posted' then raise exception 'Independently approved supplier invoice required'; end if;
 if exists(select 1 from public.finance_supplier_credit_notes where bill_id=b.id and status='pending') then raise exception 'Resolve pending supplier return before payment'; end if;
 v_available=b.amount-private.finance_bill_credit_total(b.id)-coalesce((select sum(amount) from public.treasury_transactions
 where supplier_bill_id=b.id and status in ('pending','posted')),0);
 v_amount=coalesce(p_amount,v_available);
 if v_amount is null or v_amount<=0 or round(v_amount,2)<>v_amount or v_amount>v_available then
 raise exception 'Supplier payment exceeds unreserved payable or has invalid precision'; end if;
 select * into a from public.treasury_accounts where id=p_bank_account and active;
 if not found or a.account_kind='credit_card' then raise exception 'An active liquid payment account is required'; end if;
 if p_payment_date is null or p_payment_date>(now() at time zone 'Asia/Dhaka')::date then
 raise exception 'Cannot settle supplier invoice on a future date'; end if;
 perform private.finance_require_open(p_payment_date);
 if length(btrim(coalesce(p_reference,'')))<4 then raise exception 'Bank payment reference required'; end if;
 insert into public.treasury_transactions(kind,source_account_id,supplier_bill_id,amount,
 interest_amount,fee_amount,business_date,external_reference,memo,requested_by)
 values('supplier_payment',p_bank_account,p_bill_id,v_amount,0,0,p_payment_date,
 btrim(p_reference),'Payment for matched supplier bill '||b.invoice_reference,v_actor) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'supplier_payment_requested','procurement_supplier_bill',b.id,
 jsonb_build_object('treasury_transaction_id',v_id,'amount',v_amount,'account_id',a.id));
 return v_id;
end $fn$;
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


create function private.finance_supplier_credit_immutable_source() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(old)-array['status','reviewed_by','journal_id']) is distinct from
 (to_jsonb(new)-array['status','reviewed_by','journal_id']) then raise exception 'Supplier credit source is immutable'; end if;
 if old.status<>'pending' then raise exception 'Reviewed supplier credit is immutable'; end if;
 return new;
end $$;
revoke all on function private.finance_supplier_credit_immutable_source() from public,anon,authenticated,service_role;
create trigger finance_supplier_credit_source_immutable before update or delete on public.finance_supplier_credit_notes
 for each row execute function private.finance_supplier_credit_immutable_source();

create function public.finance_inventory_source() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 return jsonb_build_object(
 'lots',coalesce((select jsonb_agg(jsonb_build_object('bill_id',l.bill_id,'product_id',l.product_id,'product',p.name,
 'reference',b.invoice_reference,'unit_cost',l.unit_cost,'received',l.received_quantity,
 'available',l.received_quantity+coalesce((select sum(quantity) from public.finance_inventory_movements where bill_id=l.bill_id),0),
 'reserved_returns',coalesce((select sum(quantity) from public.finance_supplier_credit_notes where bill_id=l.bill_id and status='pending'),0)))
 from public.finance_inventory_lots l join public.products p on p.id=l.product_id join public.procurement_supplier_bills b on b.id=l.bill_id),'[]'::jsonb),
 'credits',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'bill_id',c.bill_id,'reference',c.reference,'quantity',c.quantity,
 'amount',c.quantity*b.unit_price,'reason',c.reason,'status',c.status,'requested_by',c.requested_by,'journal_id',c.journal_id))
 from public.finance_supplier_credit_notes c join public.procurement_supplier_bills b on b.id=c.bill_id),'[]'::jsonb),
 'unreconciled_historical_bills',(select count(*) from public.procurement_supplier_bills b where b.status in ('posted','settled') and not exists(select 1 from public.finance_inventory_lots l where l.bill_id=b.id)));
end $$;
revoke all on function public.finance_inventory_source() from public,anon,authenticated;
grant execute on function public.finance_inventory_source() to authenticated;
