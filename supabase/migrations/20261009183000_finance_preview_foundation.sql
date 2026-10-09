-- 2TBR Finance Lane | preview foundation (not applied to production).
-- Purpose: auditable accrual expense ledger, independent approvals, verified payment requests.
-- Sales/COGS and final company net profit remain deliberately UNPOSTED until invoice/fulfilment reconciliation is built.
create table if not exists public.finance_accounts (
  code text primary key,
  title text not null,
  kind text not null check(kind in ('asset','liability','equity','revenue','cogs','expense')),
  active boolean not null default true
);
insert into public.finance_accounts(code,title,kind) values
 ('1000','Cash on hand','asset'),
 ('1010','Business bank','asset'),
 ('1020','Mobile money','asset'),
 ('1100','Customer receivables','asset'),
 ('1200','Inventory','asset'),
 ('2000','Approved expenses payable','liability'),
 ('2100','Supplier payable','liability'),
 ('3000','Owner capital','equity'),
 ('4000','Product revenue','revenue'),
 ('4010','Delivery fee revenue','revenue'),
 ('5000','Product cost of goods sold','cogs'),
 ('6100','Logistics expenses','expense'),
 ('6200','Offline marketing','expense'),
 ('6210','Online marketing','expense'),
 ('6300','Office and staff expenses','expense'),
 ('6400','Infrastructure expenses','expense'),
 ('6500','Commissions and incentives','expense'),
 ('6900','Other operating expenses','expense')
on conflict(code) do nothing;

create table public.finance_periods (
  month_start date primary key check(extract(day from month_start)=1),
  state text not null default 'open' check(state in ('open','locked')),
  locked_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  lock_notes text,
  created_at timestamptz not null default now()
);

create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check(category in ('logistics','marketing_offline','marketing_online','office','infrastructure','commissions','miscellaneous')),
  description text not null check(char_length(btrim(description))>=6),
  vendor_name text not null check(char_length(btrim(vendor_name))>=2),
  document_reference text not null check(char_length(btrim(document_reference))>=3),
  evidence_path text not null,
  evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  amount numeric(16,2) not null check(amount>0 and amount<=100000000),
  incurred_on date not null,
  community_id uuid references public.communities(id) on delete restrict,
  campaign_code text,
  status text not null default 'submitted' check(status in ('submitted','rejected','posted','settlement_requested','settled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_expenses_document_filename_nonblank check(char_length(btrim(evidence_path))>=40),
  constraint finance_expenses_review_provenance check (
    (status='submitted' and reviewed_by is null)
    or (status<>'submitted' and reviewed_by is not null)
  )
);

create table public.finance_journals (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  source_type text not null check(source_type in ('expense_accrual','expense_settlement')),
  source_id uuid not null,
  posting_date date not null,
  memo text not null,
  posted_by uuid not null references auth.users(id) on delete restrict,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.finance_journal_lines (
  id bigint generated always as identity primary key,
  journal_id uuid not null references public.finance_journals(id) on delete restrict,
  account_code text not null references public.finance_accounts(code) on delete restrict,
  debit numeric(16,2) not null default 0 check(debit>=0),
  credit numeric(16,2) not null default 0 check(credit>=0),
  community_id uuid references public.communities(id) on delete restrict,
  constraint finance_journal_line_one_side check(
    (debit>0 and credit=0) or (credit>0 and debit=0)
  )
);

create table public.finance_settlement_requests (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.finance_expenses(id) on delete restrict,
  payment_method text not null check(payment_method in ('cash','bank','mobile')),
  payment_reference text not null check(char_length(btrim(payment_reference))>=4),
  evidence_path text not null,
  evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  account_code text not null references public.finance_accounts(code) on delete restrict,
  payment_date date not null,
  status text not null default 'pending' check(status in ('pending','rejected','verified')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index finance_expenses_vendor_document_unique on public.finance_expenses(lower(btrim(vendor_name)),lower(btrim(document_reference)));
create unique index finance_settlement_one_live on public.finance_settlement_requests(expense_id) where status in ('pending','verified');
create unique index finance_settlement_reference_live on public.finance_settlement_requests(payment_method,upper(btrim(payment_reference))) where status in ('pending','verified');
create index finance_expenses_month_status on public.finance_expenses(incurred_on,status);
create index finance_expenses_community_date on public.finance_expenses(community_id,incurred_on);
create index finance_journals_date on public.finance_journals(posting_date);
create index finance_journal_lines_account on public.finance_journal_lines(account_code,journal_id);

-- Require a balanced pair at transaction commit, even if a future writer is introduced.
create or replace function private.finance_assert_balanced()
returns trigger language plpgsql set search_path='' as $$
declare v_journal uuid:=coalesce(new.journal_id,old.journal_id); v_count integer; v_delta numeric;
begin
 select count(*),coalesce(sum(debit-credit),0) into v_count,v_delta
 from public.finance_journal_lines where journal_id=v_journal;
 if v_count<2 or v_delta<>0 then raise exception 'Unbalanced finance journal %',v_journal; end if;
 return null;
end $$;
revoke all on function private.finance_assert_balanced() from public,anon,authenticated;
create constraint trigger finance_assert_balanced_on_commit
after insert or update or delete on public.finance_journal_lines
deferrable initially deferred for each row execute function private.finance_assert_balanced();

create or replace function private.finance_reject_journal_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
 raise exception 'Posted finance journals are immutable: issue a correcting journal';
end $$;
revoke all on function private.finance_reject_journal_mutation() from public,anon,authenticated;
create trigger finance_headers_immutable before update or delete on public.finance_journals
for each row execute function private.finance_reject_journal_mutation();
create trigger finance_lines_immutable before update or delete on public.finance_journal_lines
for each row execute function private.finance_reject_journal_mutation();

-- Private evidence: authentic stored file, hash, scoped uploader and reviewer access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('finance-evidence','finance-evidence',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy finance_evidence_insert on storage.objects for insert to authenticated with check(
 bucket_id='finance-evidence'
 and (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
 and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy finance_evidence_read on storage.objects for select to authenticated using(
 bucket_id='finance-evidence'
 and (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
);

-- Strict privacy. No direct client mutations; only audited, authorized RPCs.
alter table public.finance_accounts enable row level security;
alter table public.finance_periods enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_journals enable row level security;
alter table public.finance_journal_lines enable row level security;
alter table public.finance_settlement_requests enable row level security;
revoke all on public.finance_accounts,public.finance_periods,public.finance_expenses,
  public.finance_journals,public.finance_journal_lines,public.finance_settlement_requests
  from public,anon,authenticated;
revoke all on sequence public.finance_journal_lines_id_seq from public,anon,authenticated;

create or replace function private.finance_authorized(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and (
   private.has_role(p_user,'admin') or private.has_role(p_user,'super_admin')
 );
$$;
revoke all on function private.finance_authorized(uuid) from public,anon,authenticated;
create or replace function private.finance_super(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and private.has_role(p_user,'super_admin');
$$;
revoke all on function private.finance_super(uuid) from public,anon,authenticated;

create or replace function private.finance_require_open(p_date date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_date is null then raise exception 'Accounting date required'; end if;
 if exists(select 1 from public.finance_periods
           where month_start=date_trunc('month',p_date::timestamp)::date and state='locked')
 then raise exception 'Finance period is locked'; end if;
end $$;
revoke all on function private.finance_require_open(date) from public,anon,authenticated;

-- The only journal writer. Each entry inserts exactly two equal, opposing lines.
create or replace function private.finance_post_pair(
  p_event_key text,p_source_type text,p_source_id uuid,p_date date,p_memo text,
  p_debit text,p_credit text,p_amount numeric,p_community uuid,p_actor uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if p_actor is null or not private.finance_authorized(p_actor) then raise exception 'Finance role required'; end if;
 perform private.finance_require_open(p_date);
 if p_amount is null or p_amount<=0 then raise exception 'Positive amount required'; end if;
 if p_debit=p_credit then raise exception 'Debit and credit accounts must differ'; end if;
 if not exists(select 1 from public.finance_accounts where code=p_debit and active)
    or not exists(select 1 from public.finance_accounts where code=p_credit and active)
 then raise exception 'Invalid finance account'; end if;
 insert into public.finance_journals(event_key,source_type,source_id,posting_date,memo,posted_by)
 values(p_event_key,p_source_type,p_source_id,p_date,p_memo,p_actor) returning id into v_id;
 insert into public.finance_journal_lines(journal_id,account_code,debit,credit,community_id)
 values(v_id,p_debit,p_amount,0,p_community),(v_id,p_credit,0,p_amount,p_community);
 return v_id;
end $$;
revoke all on function private.finance_post_pair(text,text,uuid,date,text,text,text,numeric,uuid,uuid) from public,anon,authenticated;

create or replace function public.finance_submit_expense(
 p_category text,p_description text,p_vendor_name text,p_document_reference text,
 p_amount numeric,p_incurred_on date,p_evidence_path text,p_evidence_sha256 text,
 p_community_id uuid default null,p_campaign_code text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_vendor text:=btrim(coalesce(p_vendor_name,'')); v_document text:=btrim(coalesce(p_document_reference,''));
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff role required'; end if;
 if p_incurred_on is null or p_incurred_on> (now() at time zone 'Asia/Dhaka')::date
 then raise exception 'Expense date cannot be in the future'; end if;
 perform private.finance_require_open(p_incurred_on);
 if p_evidence_path is null or left(p_evidence_path,length(v_actor::text)+1)<>v_actor::text||'/' or
    p_evidence_sha256 is null or p_evidence_sha256 !~ '^[0-9a-f]{64}$' or
    not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_evidence_path)
 then raise exception 'Uploaded receipt or invoice evidence required'; end if;
 if p_category not in ('logistics','marketing_offline','marketing_online','office','infrastructure','commissions','miscellaneous')
 then raise exception 'Invalid expense category'; end if;
 if p_community_id is not null and not exists(select 1 from public.communities where id=p_community_id)
 then raise exception 'Unknown community'; end if;
 insert into public.finance_expenses(category,description,vendor_name,document_reference,evidence_path,evidence_sha256,amount,incurred_on,community_id,campaign_code,created_by)
 values(p_category,btrim(p_description),v_vendor,v_document,p_evidence_path,p_evidence_sha256,p_amount,p_incurred_on,p_community_id,nullif(btrim(p_campaign_code),''),v_actor)
 returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'finance_expense_submitted','finance_expense',v_id,
 jsonb_build_object('category',p_category,'amount',p_amount,'document_reference',v_document));
 return v_id;
end $$;
revoke all on function public.finance_submit_expense(text,text,text,text,numeric,date,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.finance_submit_expense(text,text,text,text,numeric,date,text,text,uuid,text) to authenticated;

create or replace function public.finance_review_expense(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); e public.finance_expenses%rowtype; v_account text;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance approver role required'; end if;
 select * into e from public.finance_expenses where id=p_id for update;
 if not found then raise exception 'Expense not found'; end if;
 if e.status<>'submitted' then raise exception 'Only submitted expense can be reviewed'; end if;
 if e.created_by=v_actor then raise exception 'Maker may not approve their own expense'; end if;
 if not coalesce(p_approve,false) and char_length(btrim(coalesce(p_note,'')))<5
 then raise exception 'Rejection reason required'; end if;
 if p_approve then
   v_account:=case e.category
     when 'logistics' then '6100' when 'marketing_offline' then '6200'
     when 'marketing_online' then '6210' when 'office' then '6300'
     when 'infrastructure' then '6400' when 'commissions' then '6500' else '6900' end;
   perform private.finance_post_pair('finance:accrual:'||e.id,'expense_accrual',e.id,e.incurred_on,
     e.description,v_account,'2000',e.amount,e.community_id,v_actor);
 end if;
 update public.finance_expenses set
  status=case when p_approve then 'posted' else 'rejected' end,
  reviewed_by=v_actor,review_note=nullif(btrim(p_note),''),reviewed_at=now(),updated_at=now()
 where id=e.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,case when p_approve then 'finance_expense_posted' else 'finance_expense_rejected' end,
 'finance_expense',e.id,jsonb_build_object('review_note',coalesce(p_note,''),'amount',e.amount));
 return case when p_approve then 'posted' else 'rejected' end;
end $$;
revoke all on function public.finance_review_expense(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finance_review_expense(uuid,boolean,text) to authenticated;

create or replace function public.finance_request_settlement(
 p_expense_id uuid,p_payment_method text,p_payment_reference text,p_payment_date date,
 p_evidence_path text,p_evidence_sha256 text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); e public.finance_expenses%rowtype; v_id uuid; v_account text;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff required'; end if;
 select * into e from public.finance_expenses where id=p_expense_id for update;
 if not found or e.status<>'posted' then raise exception 'Expense not approved for payment'; end if;
 if p_payment_date is null or p_payment_date>(now() at time zone 'Asia/Dhaka')::date
 then raise exception 'Future payment not allowed'; end if;
 perform private.finance_require_open(p_payment_date);
 if p_evidence_path is null or left(p_evidence_path,length(v_actor::text)+1)<>v_actor::text||'/' or
    p_evidence_sha256 is null or p_evidence_sha256 !~ '^[0-9a-f]{64}$' or
    not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_evidence_path)
 then raise exception 'Verified payment evidence upload required'; end if;
 v_account:=case p_payment_method when 'cash' then '1000' when 'bank' then '1010'
  when 'mobile' then '1020' else null end;
 if v_account is null then raise exception 'Payment method invalid'; end if;
 insert into public.finance_settlement_requests(expense_id,payment_method,payment_reference,
   account_code,payment_date,requested_by,evidence_path,evidence_sha256)
 values(e.id,p_payment_method,btrim(p_payment_reference),v_account,p_payment_date,v_actor,p_evidence_path,p_evidence_sha256)
 returning id into v_id;
 update public.finance_expenses set status='settlement_requested',updated_at=now() where id=e.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'finance_settlement_requested','finance_expense',e.id,
 jsonb_build_object('method',p_payment_method,'reference',p_payment_reference));
 return v_id;
end $$;
revoke all on function public.finance_request_settlement(uuid,text,text,date,text,text) from public,anon,authenticated;
grant execute on function public.finance_request_settlement(uuid,text,text,date,text,text) to authenticated;

create or replace function public.finance_review_settlement(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); s public.finance_settlement_requests%rowtype; e public.finance_expenses%rowtype;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance approver required'; end if;
 select * into s from public.finance_settlement_requests where id=p_id for update;
 if not found or s.status<>'pending' then raise exception 'Settlement not pending'; end if;
 if s.requested_by=v_actor then raise exception 'Payment requester may not verify payment'; end if;
 select * into e from public.finance_expenses where id=s.expense_id for update;
 if e.status<>'settlement_requested' then raise exception 'Expense settlement state mismatch'; end if;
 if p_approve then
  perform private.finance_post_pair('finance:settlement:'||s.id,'expense_settlement',s.id,
   s.payment_date,'Expense settlement: '||e.document_reference,'2000',s.account_code,e.amount,e.community_id,v_actor);
 elsif char_length(btrim(coalesce(p_note,'')))<5 then
  raise exception 'Rejection reason required';
 end if;
 update public.finance_settlement_requests set status=case when p_approve then 'verified' else 'rejected' end,
  reviewed_by=v_actor,review_note=nullif(btrim(p_note),''),reviewed_at=now() where id=s.id;
 update public.finance_expenses set status=case when p_approve then 'settled' else 'posted' end,updated_at=now() where id=e.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,case when p_approve then 'finance_payment_verified' else 'finance_payment_rejected' end,
 'finance_expense',e.id,jsonb_build_object('settlement_id',s.id,'reference',s.payment_reference,'note',coalesce(p_note,'')));
 return case when p_approve then 'verified' else 'rejected' end;
end $$;
revoke all on function public.finance_review_settlement(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finance_review_settlement(uuid,boolean,text) to authenticated;

-- Finance reports are super-admin only; numbers are ledger-backed, and contain no inferred sales.
create or replace function public.finance_report(p_month date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_start date:=date_trunc('month',p_month::timestamp)::date; v_out jsonb;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin role required'; end if;
 if p_month is null then raise exception 'Month required'; end if;
 select jsonb_build_object(
  'month',v_start,
  'posted_expenses',coalesce((select sum(l.debit-l.credit) from public.finance_journal_lines l
    join public.finance_journals j on j.id=l.journal_id
    join public.finance_accounts a on a.code=l.account_code and a.kind='expense'
    where j.posting_date>=v_start and j.posting_date<(v_start+interval '1 month')::date),0),
  'settled_cash_out',coalesce((select sum(l.credit) from public.finance_journal_lines l
    join public.finance_journals j on j.id=l.journal_id
    where j.source_type='expense_settlement' and l.account_code in ('1000','1010','1020')
      and j.posting_date>=v_start and j.posting_date<(v_start+interval '1 month')::date),0),
  'pending_count',(select count(*) from public.finance_expenses
    where incurred_on>=v_start and incurred_on<(v_start+interval '1 month')::date and status='submitted'),
  'payment_pending_count',(select count(*) from public.finance_expenses
    where incurred_on>=v_start and incurred_on<(v_start+interval '1 month')::date and status in ('posted','settlement_requested')),
  'by_category',coalesce((select jsonb_agg(jsonb_build_object('category',cat,'amount',total) order by cat)
    from (select e.category cat,sum(e.amount) total from public.finance_expenses e
          where e.incurred_on>=v_start and e.incurred_on<(v_start+interval '1 month')::date
          and e.status in ('posted','settlement_requested','settled') group by e.category) q),'[]'::jsonb),
  'profit_status','UNAVAILABLE_UNTIL_REVENUE_COGS_RECONCILED'
 ) into v_out;
 return v_out;
end $$;
revoke all on function public.finance_report(date) from public,anon,authenticated;
grant execute on function public.finance_report(date) to authenticated;

create or replace function public.finance_list_expenses(p_month date)
returns table (
 id uuid, category text, description text, vendor_name text, document_reference text,
 amount numeric, incurred_on date, community_id uuid, campaign_code text, evidence_path text, evidence_sha256 text,
 status text, created_by uuid, reviewed_by uuid, created_at timestamptz,
 settlement_id uuid, settlement_status text, settlement_evidence_path text
) language plpgsql stable security definer set search_path='' as $$
declare v_start date:=date_trunc('month',p_month::timestamp)::date;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin role required'; end if;
 if p_month is null then raise exception 'Month required'; end if;
 return query select e.id,e.category,e.description,e.vendor_name,e.document_reference,
  e.amount,e.incurred_on,e.community_id,e.campaign_code,e.evidence_path,e.evidence_sha256,e.status,e.created_by,e.reviewed_by,
  e.created_at,s.id,s.status,s.evidence_path
 from public.finance_expenses e
 left join lateral (
  select s0.* from public.finance_settlement_requests s0
  where s0.expense_id=e.id
  order by s0.created_at desc,s0.id desc limit 1
 ) s on true
 where e.incurred_on>=v_start and e.incurred_on<(v_start+interval '1 month')::date
 order by e.created_at desc limit 500;
end $$;
revoke all on function public.finance_list_expenses(date) from public,anon,authenticated;
grant execute on function public.finance_list_expenses(date) to authenticated;

create or replace function public.finance_ledger(p_month date)
returns table(posted_at timestamptz, posting_date date, event_key text, memo text,
 account_code text, account_title text, debit numeric, credit numeric, community_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare v_start date:=date_trunc('month',p_month::timestamp)::date;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin role required'; end if;
 if p_month is null then raise exception 'Month required'; end if;
 return query select j.posted_at,j.posting_date,j.event_key,j.memo,l.account_code,a.title,l.debit,l.credit,l.community_id
 from public.finance_journals j join public.finance_journal_lines l on l.journal_id=j.id
 join public.finance_accounts a on a.code=l.account_code
 where j.posting_date>=v_start and j.posting_date<(v_start+interval '1 month')::date
 order by j.posted_at desc,l.id desc limit 1000;
end $$;
revoke all on function public.finance_ledger(date) from public,anon,authenticated;
grant execute on function public.finance_ledger(date) to authenticated;
