-- Reserve spendable Treasury cash at request time. Approval keeps a second live-balance check.
create or replace function private.treasury_available_request_cash(p_account uuid)
returns numeric language sql stable security definer set search_path='' as $fn$
 select private.treasury_account_balance(a.id)
        - a.restricted_amount
        - coalesce((select sum(t.amount+t.interest_amount+t.fee_amount)
                    from public.treasury_transactions t
                    where t.source_account_id=a.id and t.status='pending'),0)
 from public.treasury_accounts a
 where a.id=p_account and a.active and a.account_kind<>'credit_card'
$fn$;
revoke all on function private.treasury_available_request_cash(uuid) from public,anon,authenticated;


create or replace function public.treasury_request_transaction(
 p_kind text,p_source uuid,p_target uuid,p_facility uuid,p_expense uuid,
 p_amount numeric,p_interest numeric,p_fee numeric,p_date date,p_reference text,p_memo text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_src public.treasury_accounts%rowtype;v_tgt public.treasury_accounts%rowtype;
  v_exp public.finance_expenses%rowtype;v_debt public.treasury_facilities%rowtype;v_id uuid;v_available numeric;v_total numeric;
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
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('treasury-source:'||p_source::text,0));
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
 if p_source is not null then
   v_total=p_amount+p_interest+p_fee;
   v_available=private.treasury_available_request_cash(p_source);
   if v_available is null or v_total>v_available then raise exception 'Insufficient unrestricted cash at source account'; end if;
 end if;
 insert into public.treasury_transactions(kind,source_account_id,target_account_id,facility_id,
 expense_id,amount,interest_amount,fee_amount,business_date,external_reference,memo,requested_by)
 values(p_kind,p_source,p_target,p_facility,p_expense,p_amount,p_interest,p_fee,
 p_date,btrim(p_reference),btrim(p_memo),v_actor) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_transaction_requested','treasury_transaction',v_id,
 jsonb_build_object('kind',p_kind,'amount',p_amount,'interest',p_interest,'fee',p_fee));
 return v_id;
end $$;

create or replace function public.treasury_request_supplier_payment(
 p_bill_id uuid,p_bank_account uuid,p_reference text,p_payment_date date,p_amount numeric
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid(); b public.procurement_supplier_bills%rowtype;
 a public.treasury_accounts%rowtype;v_id uuid;v_available numeric;v_amount numeric;v_cash_available numeric;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff role required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('treasury-source:'||p_bank_account::text,0));
 select * into a from public.treasury_accounts where id=p_bank_account and active;
 if not found or a.account_kind='credit_card' then raise exception 'An active liquid payment account is required'; end if;
 select * into b from public.procurement_supplier_bills where id=p_bill_id for update;
 if not found or b.status<>'posted' then raise exception 'Independently approved supplier invoice required'; end if;
 if exists(select 1 from public.finance_supplier_credit_notes where bill_id=b.id and status='pending') then raise exception 'Resolve pending supplier return before payment'; end if;
 v_available=b.amount-private.finance_bill_credit_total(b.id)-coalesce((select sum(amount) from public.treasury_transactions
 where supplier_bill_id=b.id and status in ('pending','posted')),0);
 v_amount=coalesce(p_amount,v_available);
 if v_amount is null or v_amount<=0 or round(v_amount,2)<>v_amount or v_amount>v_available then
 raise exception 'Supplier payment exceeds unreserved payable or has invalid precision'; end if;
 v_cash_available=private.treasury_available_request_cash(p_bank_account);
 if v_cash_available is null or v_amount>v_cash_available then raise exception 'Insufficient unrestricted cash at source account'; end if;
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

create or replace function public.finance_request_customer_cash(p_sale uuid,p_kind text,p_account uuid,p_amount numeric,p_date date,p_reference text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.finance_customer_events%rowtype;a public.treasury_accounts%rowtype;v_due numeric;v_id uuid;v_cash_available numeric;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 if p_kind='customer_refund' then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('treasury-source:'||p_account::text,0)); end if;
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
 if p_kind='customer_refund' then
  v_cash_available=private.treasury_available_request_cash(p_account);
  if v_cash_available is null or p_amount>v_cash_available then raise exception 'Insufficient unrestricted cash at source account'; end if;
 end if;
 if p_path is null or p_path not like auth.uid()::text||'/%' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or
 not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path) then raise exception 'Original customer cash evidence required'; end if;
 insert into public.treasury_transactions(kind,customer_event_id,source_account_id,target_account_id,amount,business_date,external_reference,memo,requested_by)
 values(p_kind,s.id,case when p_kind='customer_refund' then a.id end,case when p_kind='customer_receipt' then a.id end,p_amount,p_date,btrim(p_reference),'Customer cash for approved sale '||s.id,auth.uid()) returning id into v_id;
 insert into public.finance_customer_cash_evidence(transaction_id,evidence_path,evidence_sha256) values(v_id,p_path,p_sha256);
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_cash_requested','treasury_transaction',v_id,jsonb_build_object('sale_id',s.id,'kind',p_kind,'amount',p_amount));
 return v_id;
end $$;

create or replace function public.finance_request_customer_deposit(p_source_kind text,p_source uuid,p_refund boolean,p_account uuid,p_amount numeric,p_date date,p_reference text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_amount numeric;v_remaining numeric;v_id uuid;v_kind text;v_cash_available numeric;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();perform private.finance_require_open(p_date);
 if p_date is null or p_date>(now() at time zone 'Asia/Dhaka')::date or p_refund is null then raise exception 'Valid customer cash date and operation required'; end if;
 if p_refund then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('treasury-source:'||p_account::text,0)); end if;
 perform pg_advisory_xact_lock(hashtextextended('finance:customer-source:'||p_source_kind||':'||p_source,0));
 v_amount=private.finance_deposit_source(p_source_kind,p_source,p_refund,false);
 v_kind=case when p_refund then 'cancellation_refund' else 'customer_deposit' end;
 if exists(select 1 from public.treasury_transactions where customer_source_kind=p_source_kind and customer_source_id=p_source and status='pending' and kind<>v_kind) then raise exception 'Resolve other pending customer deposit operation'; end if;
 if p_refund then v_remaining=private.finance_customer_deposit_balance(p_source_kind,p_source);
 else v_remaining=v_amount-coalesce((select sum(amount) from public.treasury_transactions where customer_source_kind=p_source_kind and customer_source_id=p_source and kind='customer_deposit' and status='posted'),0); end if;
 v_remaining=v_remaining-coalesce((select sum(amount) from public.treasury_transactions where customer_source_kind=p_source_kind and customer_source_id=p_source and kind=v_kind and status='pending'),0);
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount or p_amount>v_remaining then raise exception 'Customer deposit cash exceeds unreserved source entitlement'; end if;
 if not exists(select 1 from public.treasury_accounts where id=p_account and active and account_kind<>'credit_card') then raise exception 'Liquid customer cash account required'; end if;
 if p_refund then
  v_cash_available=private.treasury_available_request_cash(p_account);
  if v_cash_available is null or p_amount>v_cash_available then raise exception 'Insufficient unrestricted cash at source account'; end if;
 end if;
 if length(btrim(coalesce(p_reference,'')))<4 or p_path not like auth.uid()::text||'/%' or p_sha256 !~ '^[a-f0-9]{64}$' or not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path) then raise exception 'Original customer deposit cash proof required'; end if;
 insert into public.treasury_transactions(kind,source_account_id,target_account_id,customer_source_kind,customer_source_id,amount,business_date,external_reference,memo,requested_by)
 values(v_kind,case when p_refund then p_account end,case when not p_refund then p_account end,p_source_kind,p_source,p_amount,p_date,btrim(p_reference),'Actual customer advance / cancelled source refund',auth.uid()) returning id into v_id;
 insert into public.finance_customer_cash_evidence(transaction_id,evidence_path,evidence_sha256) values(v_id,p_path,p_sha256);
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'finance_customer_deposit_requested','treasury_transaction',v_id,jsonb_build_object('source_kind',p_source_kind,'source_id',p_source,'amount',p_amount,'refund',p_refund));
 return v_id;
end $$;

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
 if t.source_account_id is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('treasury-source:'||t.source_account_id::text,0)); end if;
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