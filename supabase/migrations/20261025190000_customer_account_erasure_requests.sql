-- Customer account deletion initiation for mobile and web.
-- No financial records, identities, or orders are deleted automatically.
-- The request must be verified and executed by an authorized operator with
-- relevant legal retention rules applied. No customer can review other requests.
create table if not exists public.customer_account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid references auth.users(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','processing','completed','rejected')),
 requested_at timestamptz not null default now(),
 completed_at timestamptz,
 operator_note text
);
create unique index if not exists customer_account_deletion_open_unique
 on public.customer_account_deletion_requests(customer_id)
 where status in ('pending','processing');
create index if not exists customer_account_deletion_requested_at
 on public.customer_account_deletion_requests(requested_at desc);
alter table public.customer_account_deletion_requests enable row level security;
revoke all on public.customer_account_deletion_requests from public,anon,authenticated;
grant select on public.customer_account_deletion_requests to authenticated;
drop policy if exists customer_own_deletion_request_read on public.customer_account_deletion_requests;
create policy customer_own_deletion_request_read on public.customer_account_deletion_requests
 for select to authenticated using(customer_id=(select auth.uid()));
create or replace function public.request_my_account_deletion()
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare u uuid:=auth.uid();existing uuid;created uuid;
begin
 if u is null then raise exception 'Sign in to request deletion';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,925104));
 select id into existing from public.customer_account_deletion_requests
  where customer_id=u and status in ('pending','processing') for update;
 if existing is not null then return existing;end if;
 insert into public.customer_account_deletion_requests(customer_id)
  values(u) returning id into created;
 return created;
end;
$$;
revoke all on function public.request_my_account_deletion() from public,anon;
grant execute on function public.request_my_account_deletion() to authenticated;
comment on table public.customer_account_deletion_requests is
 'Owner-initiated account erasure request queue; fulfillment and lawful retention review are separate authorized operations. No automatic user erasure.';
