-- Disposable-database only: no real account or financial records are modified.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
do $test$
declare
 user_one uuid:=gen_random_uuid(); user_two uuid:=gen_random_uuid();
 req uuid; repeated uuid; other_req uuid; denied boolean:=false;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 values(user_one,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','fictional-delete-a-'||user_one||'@example.invalid',now(),now()),
       (user_two,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','fictional-delete-b-'||user_two||'@example.invalid',now(),now());
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.request_my_account_deletion();
 exception when others then denied:=true;end;
 if not denied then raise exception 'Unauthenticated deletion request accepted';end if;
 perform set_config('request.jwt.claim.sub',user_one::text,true);
 req:=public.request_my_account_deletion();
 repeated:=public.request_my_account_deletion();
 if req<>repeated then raise exception 'Retry generated duplicate deletion request';end if;
 if (select count(*) from public.customer_account_deletion_requests where customer_id=user_one)<>1
  then raise exception 'Exactly one request must exist for customer one';end if;
 perform set_config('request.jwt.claim.sub',user_two::text,true);
 other_req:=public.request_my_account_deletion();
 if req=other_req then raise exception 'Customers shared a deletion request';end if;
 if (select status from public.customer_account_deletion_requests where id=req)<>'pending'
  then raise exception 'Deletion request must require a separate authorized review';end if;
 if not (select relrowsecurity from pg_class where oid='public.customer_account_deletion_requests'::regclass)
  then raise exception 'RLS not enabled';end if;
 if has_table_privilege('anon','public.customer_account_deletion_requests','SELECT')
  then raise exception 'Guest can read deletion queue';end if;
 if has_table_privilege('authenticated','public.customer_account_deletion_requests','INSERT')
  then raise exception 'Customer can insert or fake another deletion request';end if;
end $test$;
select ok(true,'Account deletion: authenticated-only, retry-safe, own RLS, no immediate irreversible erasure');
select * from finish();
rollback;
