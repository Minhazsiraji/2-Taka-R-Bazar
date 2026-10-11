begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000981','uat-active@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000982','uat-unleased@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000000981','super_admin'),
 ('00000000-0000-4000-8000-000000000982','admin');
insert into private.finance_uat_leases(actor_id,expires_at,reason) values
 ('00000000-0000-4000-8000-000000000981',clock_timestamp()+interval '1 hour','Disposable authorized reviewer sign-in qualification');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000981',true);
select ok(public.finance_uat_session_active(),'Active role and operator lease qualify the caller');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000982',true);
select ok(not public.finance_uat_session_active(),'Unleased admin cannot borrow another reviewer lease');
select set_config('request.jwt.claim.sub','',true);
select ok(not public.finance_uat_session_active(),'Anonymous identity cannot qualify');
update private.finance_uat_leases set issued_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where actor_id='00000000-0000-4000-8000-000000000981';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000981',true);
select ok(not public.finance_uat_session_active(),'Expired reviewer lease no longer qualifies');
select ok(not has_function_privilege('anon','public.finance_uat_session_active()','EXECUTE'),'Anonymous RPC execution denied');
select ok(not has_table_privilege('authenticated','private.finance_uat_leases','INSERT'),'Reviewer cannot grant own authorization');
select * from finish();
rollback;
