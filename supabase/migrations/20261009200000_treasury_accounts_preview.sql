-- 2TBR treasury preview | BDT-only controlled cash, lending and credit card ledger.
-- Deliberately uninstalled on Production. All reporting is partial until operations reconciliation.
insert into public.finance_accounts(code,title,kind) values
 ('3100','Treasury opening balance clearing','equity'),
 ('3200','Owner drawings','equity'),
 ('6600','Financing interest expense','expense'),
 ('6605','Financing fees','expense')
on conflict(code) do nothing;

alter table public.finance_journals drop constraint if exists finance_journals_source_type_check;
alter table public.finance_journals add constraint finance_journals_source_type_check
 check(source_type in ('expense_accrual','expense_settlement','treasury_opening','treasury_transaction'));

create table public.treasury_accounts (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name))>=3),
 account_kind text not null check(account_kind in ('bank','wallet','cash','credit_card')),
 institution text not null check(length(btrim(institution))>=2),
 last_four text check(last_four is null or last_four ~ '^[0-9]{4}$'),
 currency text not null default 'BDT' check(currency='BDT'),
 ledger_code text not null unique references public.finance_accounts(code),
 opening_balance numeric(16,2) not null default 0 check(opening_balance>=0),
 opened_on date not null,
 opening_reference text not null check(length(btrim(opening_reference))>=4),
 restricted_amount numeric(16,2) not null default 0 check(restricted_amount>=0),
 credit_limit numeric(16,2) check(credit_limit is null or credit_limit>0),
 active boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(account_kind='credit_card' or credit_limit is null),
 check(account_kind<>'credit_card' or (credit_limit is not null and credit_limit>=opening_balance)),
 check(account_kind='credit_card' or restricted_amount<=opening_balance)
);

create table public.treasury_facilities (
 id uuid primary key default gen_random_uuid(),
 lender text not null check(length(btrim(lender))>=3),
 facility_kind text not null check(facility_kind in ('bank_loan','private_borrowing')),
 ledger_code text not null unique references public.finance_accounts(code),
 original_principal numeric(16,2) not null check(original_principal>0),
 opening_outstanding numeric(16,2) not null default 0 check(opening_outstanding>=0),
 interest_apr numeric(8,4) not null default 0 check(interest_apr>=0 and interest_apr<=1000),
 due_day integer check(due_day between 1 and 28),
 maturity_date date,
 opened_on date not null,
 agreement_reference text not null check(length(btrim(agreement_reference))>=4),
 notes text,
 active boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(opening_outstanding<=original_principal)
);

create table public.treasury_transactions (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('transfer','loan_draw','loan_repay','card_bill','expense_cash','expense_card','owner_capital','owner_draw')),
 source_account_id uuid references public.treasury_accounts(id) on delete restrict,
 target_account_id uuid references public.treasury_accounts(id) on delete restrict,
 facility_id uuid references public.treasury_facilities(id) on delete restrict,
 expense_id uuid references public.finance_expenses(id) on delete restrict,
 amount numeric(16,2) not null check(amount>0),
 interest_amount numeric(16,2) not null default 0 check(interest_amount>=0),
 fee_amount numeric(16,2) not null default 0 check(fee_amount>=0),
 business_date date not null,
 external_reference text not null check(length(btrim(external_reference))>=4),
 memo text not null check(length(btrim(memo))>=6),
 status text not null default 'pending' check(status in ('pending','rejected','posted')),
 requested_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz,
 reviewed_note text,
 journal_id uuid unique references public.finance_journals(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(source_account_id is null or target_account_id is null or source_account_id<>target_account_id)
);
create unique index treasury_reference_active on public.treasury_transactions(
 lower(btrim(external_reference)),coalesce(source_account_id,target_account_id)
) where status in ('pending','posted');
create unique index treasury_expense_once on public.treasury_transactions(expense_id)
 where expense_id is not null and status in ('pending','posted');
create index treasury_transaction_date on public.treasury_transactions(business_date,status);

create table public.treasury_statement_lines (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.treasury_accounts(id) on delete restrict,
 external_line_id text not null check(length(btrim(external_line_id))>=4),
 statement_date date not null,
 signed_amount numeric(16,2) not null check(signed_amount<>0),
 reference text not null check(length(btrim(reference))>=4),
 matched_transaction_id uuid references public.treasury_transactions(id) on delete restrict,
 matched_by uuid references auth.users(id) on delete set null,
 matched_at timestamptz,
 imported_by uuid not null references auth.users(id) on delete restrict,
 imported_at timestamptz not null default now(),
 unique(account_id,external_line_id),
 check((matched_transaction_id is null and matched_by is null and matched_at is null)
    or (matched_transaction_id is not null and matched_by is not null and matched_at is not null))
);
create unique index treasury_statement_one_match on public.treasury_statement_lines(account_id,matched_transaction_id)
 where matched_transaction_id is not null;

create table public.treasury_forecast_events (
 id uuid primary key default gen_random_uuid(),
 due_date date not null,
 expected_cash_change numeric(16,2) not null check(expected_cash_change<>0),
 event_kind text not null check(event_kind in ('customer_collection','supplier_payment','payroll','rent','marketing','logistics','tax','loan_due','card_due','other')),
 description text not null check(length(btrim(description))>=6),
 source_reference text not null check(length(btrim(source_reference))>=4),
 confidence text not null default 'provisional' check(confidence in ('provisional','contractual')),
 status text not null default 'open' check(status in ('open','cancelled','realized')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(event_kind,source_reference)
);

create table public.treasury_reserve_policy (
 singleton boolean primary key default true check(singleton),
 minimum_operating_reserve numeric(16,2) not null default 0 check(minimum_operating_reserve>=0),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
insert into public.treasury_reserve_policy(singleton,minimum_operating_reserve) values(true,0) on conflict do nothing;

alter table public.treasury_accounts enable row level security;
alter table public.treasury_facilities enable row level security;
alter table public.treasury_transactions enable row level security;
alter table public.treasury_statement_lines enable row level security;
alter table public.treasury_forecast_events enable row level security;
alter table public.treasury_reserve_policy enable row level security;
revoke all on public.treasury_accounts,public.treasury_facilities,public.treasury_transactions,
 public.treasury_statement_lines,public.treasury_forecast_events,public.treasury_reserve_policy
 from public,anon,authenticated;

-- Only authorized server RPCs may record activity. Client has no direct table access.
create or replace function private.treasury_account_balance(p_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when a.account_kind='credit_card' then l.credit-l.debit else l.debit-l.credit end),0)
 from public.treasury_accounts a
 left join public.finance_journal_lines l on l.account_code=a.ledger_code
 where a.id=p_id;
$$;
revoke all on function private.treasury_account_balance(uuid) from public,anon,authenticated;

create or replace function private.treasury_facility_balance(p_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(l.credit-l.debit),0)
 from public.treasury_facilities d
 left join public.finance_journal_lines l on l.account_code=d.ledger_code
 where d.id=p_id;
$$;
revoke all on function private.treasury_facility_balance(uuid) from public,anon,authenticated;

create or replace function private.treasury_post(
 p_key text,p_source uuid,p_date date,p_memo text,p_lines jsonb,p_actor uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; x jsonb; v_debit numeric; v_credit numeric; v_code text; v_total_d numeric:=0; v_total_c numeric:=0; v_count int:=0;
begin
 if not private.finance_super(p_actor) then raise exception 'Treasury posting requires Super Admin'; end if;
 perform private.finance_require_open(p_date);
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 or jsonb_array_length(p_lines)>8
 then raise exception 'Treasury journal must have 2 to 8 lines'; end if;
 insert into public.finance_journals(event_key,source_type,source_id,posting_date,memo,posted_by)
 values(p_key,'treasury_transaction',p_source,p_date,p_memo,p_actor) returning id into v_id;
 for x in select value from jsonb_array_elements(p_lines) loop
   v_code=x->>'account';v_debit=coalesce((x->>'debit')::numeric,0);
   v_credit=coalesce((x->>'credit')::numeric,0);
   if v_debit<0 or v_credit<0 or (v_debit>0 and v_credit>0) or (v_debit=0 and v_credit=0)
     or round(v_debit,2)<>v_debit or round(v_credit,2)<>v_credit then
      raise exception 'Invalid ledger line'; end if;
   if not exists(select 1 from public.finance_accounts where code=v_code and active) then
      raise exception 'Invalid treasury ledger account'; end if;
   insert into public.finance_journal_lines(journal_id,account_code,debit,credit)
   values(v_id,v_code,v_debit,v_credit);
   v_total_d=v_total_d+v_debit;v_total_c=v_total_c+v_credit;v_count=v_count+1;
 end loop;
 if v_count<2 or v_total_d<>v_total_c then raise exception 'Treasury journal imbalance'; end if;
 return v_id;
end $$;
revoke all on function private.treasury_post(text,uuid,date,text,jsonb,uuid) from public,anon,authenticated;

create or replace function public.treasury_create_account(
 p_name text,p_kind text,p_institution text,p_last_four text,p_open_date date,
 p_opening_balance numeric,p_opening_reference text,p_restricted numeric default 0,p_credit_limit numeric default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid:=gen_random_uuid(); v_code text:='T'||replace(v_id::text,'-',''); v_kind text; v_post uuid;
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin required'; end if;
 if p_kind not in ('bank','cash','wallet','credit_card') then raise exception 'Invalid account kind'; end if;
 if p_open_date is null or p_open_date>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Future opening date not allowed'; end if;
 if p_opening_balance is null or p_opening_balance<0 or round(p_opening_balance,2)<>p_opening_balance
    or p_opening_balance>1000000000 then raise exception 'Invalid opening balance'; end if;
 if coalesce(p_restricted,0)<0 or p_kind<>'credit_card' and coalesce(p_restricted,0)>p_opening_balance then raise exception 'Restricted balance invalid'; end if;
 perform private.finance_require_open(p_open_date);
 v_kind=case when p_kind='credit_card' then 'liability' else 'asset' end;
 insert into public.finance_accounts(code,title,kind) values(v_code,'Treasury '||btrim(p_name),v_kind);
 insert into public.treasury_accounts(id,name,account_kind,institution,last_four,ledger_code,opening_balance,
 opened_on,opening_reference,restricted_amount,credit_limit,created_by)
 values(v_id,btrim(p_name),p_kind,btrim(p_institution),nullif(btrim(p_last_four),''),v_code,p_opening_balance,
 p_open_date,btrim(p_opening_reference),coalesce(p_restricted,0),p_credit_limit,v_actor);
 if p_opening_balance>0 then
    if p_kind='credit_card' then
      v_post=private.treasury_post('treasury:open:card:'||v_id,v_id,p_open_date,'Opening card liability',
        jsonb_build_array(jsonb_build_object('account','3100','debit',p_opening_balance),
                          jsonb_build_object('account',v_code,'credit',p_opening_balance)),v_actor);
    else
      v_post=private.treasury_post('treasury:open:cash:'||v_id,v_id,p_open_date,'Opening treasury cash',
        jsonb_build_array(jsonb_build_object('account',v_code,'debit',p_opening_balance),
                          jsonb_build_object('account','3100','credit',p_opening_balance)),v_actor);
    end if;
    update public.finance_journals set source_type='treasury_opening' where id=v_post;
 end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_account_created','treasury_account',v_id,
 jsonb_build_object('kind',p_kind,'opening',p_opening_balance,'reference',p_opening_reference));
 return v_id;
end $$;
-- Special exemption for immutable journal's source_type: treasury_post must set it when inserted; never update posted headers.
revoke all on function public.treasury_create_account(text,text,text,text,date,numeric,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.treasury_create_account(text,text,text,text,date,numeric,text,numeric,numeric) to authenticated;

create or replace function public.treasury_create_facility(
 p_lender text,p_kind text,p_principal numeric,p_opening_outstanding numeric,p_apr numeric,
 p_due_day integer,p_maturity date,p_open_date date,p_agreement_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid:=gen_random_uuid();v_code text:='D'||replace(v_id::text,'-','');v_post uuid;
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin required'; end if;
 if p_kind not in ('bank_loan','private_borrowing') then raise exception 'Invalid debt facility type'; end if;
 if p_open_date is null or p_open_date>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Future opening date not allowed'; end if;
 if p_principal is null or p_principal<=0 or p_opening_outstanding is null or p_opening_outstanding<0 or
    p_opening_outstanding>p_principal or round(p_principal,2)<>p_principal or
    round(p_opening_outstanding,2)<>p_opening_outstanding then raise exception 'Invalid facility principal'; end if;
 perform private.finance_require_open(p_open_date);
 insert into public.finance_accounts(code,title,kind) values(v_code,'Borrowing from '||btrim(p_lender),'liability');
 insert into public.treasury_facilities(id,lender,facility_kind,ledger_code,original_principal,
   opening_outstanding,interest_apr,due_day,maturity_date,opened_on,agreement_reference,created_by)
 values(v_id,btrim(p_lender),p_kind,v_code,p_principal,p_opening_outstanding,
 coalesce(p_apr,0),p_due_day,p_maturity,p_open_date,btrim(p_agreement_reference),v_actor);
 if p_opening_outstanding>0 then
   v_post=private.treasury_post('treasury:open:facility:'||v_id,v_id,p_open_date,'Opening documented borrowing',
     jsonb_build_array(jsonb_build_object('account','3100','debit',p_opening_outstanding),
                       jsonb_build_object('account',v_code,'credit',p_opening_outstanding)),v_actor);
   update public.finance_journals set source_type='treasury_opening' where id=v_post;
 end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_facility_created','treasury_facility',v_id,
 jsonb_build_object('facility_kind',p_kind,'opening_outstanding',p_opening_outstanding));
 return v_id;
end $$;
revoke all on function public.treasury_create_facility(text,text,numeric,numeric,numeric,integer,date,date,text) from public,anon,authenticated;
grant execute on function public.treasury_create_facility(text,text,numeric,numeric,numeric,integer,date,date,text) to authenticated;
