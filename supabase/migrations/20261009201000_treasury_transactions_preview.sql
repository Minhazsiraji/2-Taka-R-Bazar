-- Treasury transaction state machine and statement reconciliation.
-- Do not mark any ledger-posted cash as bank-verified without explicit statement matching.
create or replace function public.treasury_request_transaction(
 p_kind text,p_source uuid,p_target uuid,p_facility uuid,p_expense uuid,
 p_amount numeric,p_interest numeric,p_fee numeric,p_date date,p_reference text,p_memo text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_src public.treasury_accounts%rowtype;v_tgt public.treasury_accounts%rowtype;
  v_exp public.finance_expenses%rowtype;v_debt public.treasury_facilities%rowtype;v_id uuid;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance role required'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Transaction date cannot be future'; end if;
 perform private.finance_require_open(p_date);
 if p_amount is null or p_amount<=0 or p_amount>100000000 or round(p_amount,2)<>p_amount
    or p_interest is null or p_interest<0 or round(p_interest,2)<>p_interest
    or p_fee is null or p_fee<0 or round(p_fee,2)<>p_fee then raise exception 'Invalid BDT amount or precision'; end if;
 if p_interest+p_fee+p_amount>100000000 then raise exception 'Transaction total exceeds permitted limit'; end if;
 if length(btrim(coalesce(p_reference,'')))<4 or length(btrim(coalesce(p_memo,'')))<6 then
   raise exception 'Transaction reference and memo required'; end if;
 if p_source is not null then
   select * into v_src from public.treasury_accounts where id=p_source and active;
   if not found then raise exception 'Source account inactive or missing'; end if;
 end if;
 if p_target is not null then
   select * into v_tgt from public.treasury_accounts where id=p_target and active;
   if not found then raise exception 'Target account inactive or missing'; end if;
 end if;
 if p_facility is not null then
   select * into v_debt from public.treasury_facilities where id=p_facility and active;
   if not found then raise exception 'Facility inactive or missing'; end if;
 end if;
 if p_expense is not null then
   select * into v_exp from public.finance_expenses where id=p_expense;
   if not found or v_exp.status<>'posted' or v_exp.amount<>p_amount then
      raise exception 'Only fully approved, unpaid expense can be settled for exact value'; end if;
   if exists(select 1 from public.finance_settlement_requests
      where expense_id=p_expense and status in ('pending','verified'))
   then raise exception 'Expense already has an active legacy settlement'; end if;
 end if;
 if p_kind='transfer' then
   if p_source is null or p_target is null or p_source=p_target or
      v_src.account_kind='credit_card' or v_tgt.account_kind='credit_card' or
      p_facility is not null or p_expense is not null
   then raise exception 'Transfer requires two distinct liquid accounts'; end if;
 elsif p_kind='loan_draw' then
   if p_target is null or v_tgt.account_kind='credit_card' or p_facility is null or
      p_source is not null or p_expense is not null then raise exception 'Loan draw requires facility and liquid destination'; end if;
 elsif p_kind='loan_repay' then
   if p_source is null or v_src.account_kind='credit_card' or p_facility is null or
     p_target is not null or p_expense is not null then raise exception 'Loan repayment requires liquid account and facility'; end if;
 elsif p_kind='card_bill' then
   if p_source is null or v_src.account_kind='credit_card' or p_target is null or
      v_tgt.account_kind<>'credit_card' or p_facility is not null or p_expense is not null
   then raise exception 'Credit card bill requires cash source and credit card'; end if;
 elsif p_kind='expense_cash' then
   if p_source is null or v_src.account_kind='credit_card' or p_expense is null or
      p_target is not null or p_facility is not null then raise exception 'Cash expense must use approved expense and cash account'; end if;
 elsif p_kind='expense_card' then
   if p_target is null or v_tgt.account_kind<>'credit_card' or p_expense is null or
      p_source is not null or p_facility is not null then raise exception 'Card purchase must use approved expense and credit card'; end if;
 elsif p_kind='owner_capital' then
   if p_target is null or v_tgt.account_kind='credit_card' or
      p_source is not null or p_facility is not null or p_expense is not null
   then raise exception 'Owner capital requires liquid destination'; end if;
 elsif p_kind='owner_draw' then
   if p_source is null or v_src.account_kind='credit_card' or
      p_target is not null or p_facility is not null or p_expense is not null
   then raise exception 'Owner drawing requires liquid source'; end if;
 else raise exception 'Unsupported treasury operation'; end if;
 if p_kind not in ('loan_repay') and (p_interest<>0 or p_fee<>0)
 then raise exception 'Interest and fees only allowed in loan repayments'; end if;
 insert into public.treasury_transactions(kind,source_account_id,target_account_id,facility_id,
 expense_id,amount,interest_amount,fee_amount,business_date,external_reference,memo,requested_by)
 values(p_kind,p_source,p_target,p_facility,p_expense,p_amount,p_interest,p_fee,
 p_date,btrim(p_reference),btrim(p_memo),v_actor) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_transaction_requested','treasury_transaction',v_id,
 jsonb_build_object('kind',p_kind,'amount',p_amount,'interest',p_interest,'fee',p_fee));
 return v_id;
end $$;
revoke all on function public.treasury_request_transaction(text,uuid,uuid,uuid,uuid,numeric,numeric,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.treasury_request_transaction(text,uuid,uuid,uuid,uuid,numeric,numeric,numeric,date,text,text) to authenticated;

create or replace function public.treasury_review_transaction(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); t public.treasury_transactions%rowtype;
 src public.treasury_accounts%rowtype; dst public.treasury_accounts%rowtype;
 facility public.treasury_facilities%rowtype; ex public.finance_expenses%rowtype;
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
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_transaction_posted','treasury_transaction',t.id,
  jsonb_build_object('kind',t.kind,'amount',t.amount,'interest',t.interest_amount,
   'fee',t.fee_amount,'journal_id',v_id,'bank_verified',false));
 return 'posted';
end $$;
revoke all on function public.treasury_review_transaction(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.treasury_review_transaction(uuid,boolean,text) to authenticated;

create or replace function public.treasury_import_statement_line(
 p_account uuid,p_external_id text,p_date date,p_amount numeric,p_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance role required'; end if;
 if not exists(select 1 from public.treasury_accounts where id=p_account and active) then raise exception 'Account inactive or missing'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Statement date invalid'; end if;
 if p_amount is null or p_amount=0 or round(p_amount,2)<>p_amount then raise exception 'Statement amount invalid'; end if;
 insert into public.treasury_statement_lines(account_id,external_line_id,statement_date,signed_amount,reference,imported_by)
 values(p_account,btrim(p_external_id),p_date,p_amount,btrim(p_reference),v_actor)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.treasury_import_statement_line(uuid,text,date,numeric,text) from public,anon,authenticated;
grant execute on function public.treasury_import_statement_line(uuid,text,date,numeric,text) to authenticated;

create or replace function public.treasury_match_statement(p_line_id uuid,p_transaction_id uuid,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();s public.treasury_statement_lines%rowtype;
 t public.treasury_transactions%rowtype;v_expected numeric;
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin required for bank matching'; end if;
 select * into s from public.treasury_statement_lines where id=p_line_id for update;
 if not found or s.matched_transaction_id is not null then raise exception 'Statement line already matched or missing'; end if;
 if s.imported_by=v_actor then raise exception 'Independent reconciliation required'; end if;
 select * into t from public.treasury_transactions where id=p_transaction_id for update;
 if not found or t.status<>'posted' then raise exception 'Cannot reconcile an unposted transaction'; end if;
 if t.source_account_id=s.account_id then
   v_expected= -(t.amount+t.interest_amount+t.fee_amount);
 elsif t.target_account_id=s.account_id then
   v_expected= t.amount;
   if t.kind='card_bill' then v_expected= -t.amount; end if;
 else raise exception 'Statement account is unrelated to the transaction'; end if;
 -- Card expenses INCREASE a liability; card bills DECREASE it.
 if s.signed_amount<>v_expected then raise exception 'Statement amount does not match journal cash or credit movement'; end if;
 if abs(s.statement_date-t.business_date)>5 then raise exception 'Statement date is outside the five-day reconciliation window'; end if;
 if lower(btrim(s.reference))<>lower(btrim(t.external_reference))
    and length(btrim(coalesce(p_note,'')))<8 then
    raise exception 'Reference differs: independent explanation required'; end if;
 update public.treasury_statement_lines
 set matched_transaction_id=t.id,matched_by=v_actor,matched_at=now() where id=s.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_statement_matched','treasury_statement_line',s.id,
  jsonb_build_object('transaction_id',t.id,'amount',s.signed_amount,'review_note',p_note));
 return 'matched';
end $$;
revoke all on function public.treasury_match_statement(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.treasury_match_statement(uuid,uuid,text) to authenticated;

create or replace function public.treasury_create_forecast(
 p_date date,p_amount numeric,p_kind text,p_description text,p_reference text,p_confidence text default 'provisional'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid;
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin required'; end if;
 if p_date is null or p_date<(now() at time zone 'Asia/Dhaka')::date or
   p_amount is null or p_amount=0 or round(p_amount,2)<>p_amount then raise exception 'Forecast date or value invalid'; end if;
 insert into public.treasury_forecast_events(due_date,expected_cash_change,event_kind,description,source_reference,confidence,created_by)
 values(p_date,p_amount,p_kind,btrim(p_description),btrim(p_reference),p_confidence,v_actor) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.treasury_create_forecast(date,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function public.treasury_create_forecast(date,numeric,text,text,text,text) to authenticated;

create or replace function public.treasury_set_minimum_reserve(p_amount numeric)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin required'; end if;
 if p_amount is null or p_amount<0 or round(p_amount,2)<>p_amount then raise exception 'Invalid reserve amount'; end if;
 update public.treasury_reserve_policy set minimum_operating_reserve=p_amount,updated_by=v_actor,updated_at=now()
 where singleton;
 insert into public.audit_events(actor_user_id,event_type,entity_type,metadata)
 values(v_actor,'treasury_reserve_updated','treasury_reserve',jsonb_build_object('minimum_reserve',p_amount));
end $$;
revoke all on function public.treasury_set_minimum_reserve(numeric) from public,anon,authenticated;
grant execute on function public.treasury_set_minimum_reserve(numeric) to authenticated;

-- A physical treasury account must be selected once Treasury is active.
-- Prevent legacy cash expense settlement from posting to the generic 'cash' or 'bank' account.
create or replace function private.treasury_assert_no_legacy_settlement()
returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.treasury_accounts) then
   raise exception 'Use Treasury settlement with a specific cash account; generic finance payments are disabled';
 end if;
 return new;
end $$;
revoke all on function private.treasury_assert_no_legacy_settlement() from public,anon,authenticated;
create trigger treasury_disable_generic_finance_cash
 before insert on public.finance_settlement_requests
 for each row execute function private.treasury_assert_no_legacy_settlement();
