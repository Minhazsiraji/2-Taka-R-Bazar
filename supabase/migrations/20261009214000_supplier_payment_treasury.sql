-- Supplier payment bridge into Treasury. Full matched PO/invoice -> AP -> physical bank.
alter table public.treasury_transactions
 add column supplier_bill_id uuid references public.procurement_supplier_bills(id) on delete restrict;
alter table public.treasury_transactions drop constraint if exists treasury_transactions_kind_check;
alter table public.treasury_transactions add constraint treasury_transactions_kind_check
 check(kind in ('transfer','loan_draw','loan_repay','card_bill','expense_cash','expense_card',
               'owner_capital','owner_draw','supplier_payment'));
create unique index treasury_one_supplier_bill_payment
 on public.treasury_transactions(supplier_bill_id)
 where supplier_bill_id is not null and status in ('pending','posted');

create or replace function public.treasury_request_supplier_payment(
 p_bill_id uuid,p_bank_account uuid,p_reference text,p_payment_date date
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid(); b public.procurement_supplier_bills%rowtype;
 a public.treasury_accounts%rowtype;v_id uuid;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff role required'; end if;
 select * into b from public.procurement_supplier_bills where id=p_bill_id for update;
 if not found or b.status<>'posted' then raise exception 'Independently approved supplier invoice required'; end if;
 select * into a from public.treasury_accounts where id=p_bank_account and active;
 if not found or a.account_kind='credit_card' then raise exception 'An active liquid payment account is required'; end if;
 if p_payment_date is null or p_payment_date>(now() at time zone 'Asia/Dhaka')::date then
 raise exception 'Cannot settle supplier invoice on a future date'; end if;
 perform private.finance_require_open(p_payment_date);
 if length(btrim(coalesce(p_reference,'')))<4 then raise exception 'Bank payment reference required'; end if;
 insert into public.treasury_transactions(kind,source_account_id,supplier_bill_id,amount,
 interest_amount,fee_amount,business_date,external_reference,memo,requested_by)
 values('supplier_payment',p_bank_account,p_bill_id,b.amount,0,0,p_payment_date,
 btrim(p_reference),'Payment for matched supplier bill '||b.invoice_reference,v_actor) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'supplier_payment_requested','procurement_supplier_bill',b.id,
 jsonb_build_object('treasury_transaction_id',v_id,'amount',b.amount,'account_id',a.id));
 return v_id;
end $fn$;
revoke all on function public.treasury_request_supplier_payment(uuid,uuid,text,date) from public,anon,authenticated;
grant execute on function public.treasury_request_supplier_payment(uuid,uuid,text,date) to authenticated;

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
   if not found or pb.status<>'posted' or pb.amount<>t.amount then raise exception 'Supplier payable is missing, altered or already paid'; end if;
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
   update public.procurement_supplier_bills set status='settled' where id=t.supplier_bill_id;
 end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_transaction_posted','treasury_transaction',t.id,
  jsonb_build_object('kind',t.kind,'amount',t.amount,'interest',t.interest_amount,
   'fee',t.fee_amount,'journal_id',v_id,'bank_verified',false));
 return 'posted';
end $$;

-- Maintain prior explicit function privileges (CREATE OR REPLACE preserves grants).
