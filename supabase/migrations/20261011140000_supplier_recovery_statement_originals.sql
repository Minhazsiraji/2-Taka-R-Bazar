alter table public.treasury_transactions add column supplier_credit_note_id uuid references public.finance_supplier_credit_notes(id) on delete restrict;
alter table public.treasury_transactions drop constraint treasury_transactions_kind_check;
alter table public.treasury_transactions add constraint treasury_transactions_kind_check check(kind in
 ('transfer','loan_draw','loan_repay','card_bill','expense_cash','expense_card','owner_capital','owner_draw','supplier_payment','customer_receipt','customer_refund','supplier_credit_receipt'));
create index treasury_supplier_credit on public.treasury_transactions(supplier_credit_note_id,status);
create function private.finance_supplier_credit_balance(p_id uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce((select sum(l.debit-l.credit) from public.finance_supplier_credit_notes c join public.finance_journal_lines l on l.journal_id=c.journal_id where c.id=p_id and l.account_code='1300'),0)-coalesce((select sum(amount) from public.treasury_transactions where supplier_credit_note_id=p_id and status='posted'),0)
$$;
revoke all on function private.finance_supplier_credit_balance(uuid) from public,anon,authenticated,service_role;
create function public.finance_request_supplier_credit_recovery(p_credit uuid,p_account uuid,p_amount numeric,p_date date,p_reference text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.finance_supplier_credit_notes%rowtype;v_id uuid;v_remaining numeric;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 select * into c from public.finance_supplier_credit_notes where id=p_credit and status='posted' for update;
 if not found then raise exception 'Posted supplier credit required'; end if;
 if p_date<c.business_date or p_date>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Supplier recovery date invalid'; end if;
 perform private.finance_require_open(p_date);
 if not exists(select 1 from public.treasury_accounts where id=p_account and active and account_kind<>'credit_card') then raise exception 'Liquid recovery account required'; end if;
 v_remaining=private.finance_supplier_credit_balance(c.id)-coalesce((select sum(amount) from public.treasury_transactions where supplier_credit_note_id=c.id and status='pending'),0);
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount or p_amount>v_remaining then raise exception 'Supplier recovery exceeds unreserved credit receivable'; end if;
 if length(btrim(coalesce(p_reference,'')))<4 or p_path not like auth.uid()::text||'/%' or p_sha256 !~ '^[a-f0-9]{64}$' or not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path) then raise exception 'Original supplier recovery proof required'; end if;
 insert into public.treasury_transactions(kind,target_account_id,supplier_credit_note_id,amount,business_date,external_reference,memo,requested_by)
 values('supplier_credit_receipt',p_account,c.id,p_amount,p_date,btrim(p_reference),'Actual supplier credit recovery '||c.reference,auth.uid()) returning id into v_id;
 insert into public.finance_customer_cash_evidence(transaction_id,evidence_path,evidence_sha256) values(v_id,p_path,p_sha256);
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'supplier_credit_cash_requested','treasury_transaction',v_id,jsonb_build_object('credit_id',c.id,'amount',p_amount));
 return v_id;
end $$;
revoke all on function public.finance_request_supplier_credit_recovery(uuid,uuid,numeric,date,text,text,text) from public,anon,authenticated;
grant execute on function public.finance_request_supplier_credit_recovery(uuid,uuid,numeric,date,text,text,text) to authenticated;
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




create function public.treasury_import_statement_original(p_account uuid,p_external_id text,p_date date,p_amount numeric,p_reference text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 v_id=public.treasury_import_statement_line(p_account,p_external_id,p_date,p_amount,p_reference);
 perform public.finance_attach_document('statement',v_id,'bank_statement','Original supplied bank statement',p_path,p_sha256);
 return v_id;
end $$;
revoke all on function public.treasury_import_statement_original(uuid,text,date,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.treasury_import_statement_original(uuid,text,date,numeric,text,text,text) to authenticated;
