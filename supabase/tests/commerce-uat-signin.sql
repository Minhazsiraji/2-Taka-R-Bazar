begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000006901','commerce-uat-one@example.invalid',now(),now(),now()),
 ('00000000-0000-4000-8000-000000006902','commerce-uat-two@example.invalid',now(),now(),now()),
 ('00000000-0000-4000-8000-000000006903','real-looking-account@example.com',now(),now(),now());
insert into private.commerce_uat_signin_leases(actor_id,expires_at,reason) values
 ('00000000-0000-4000-8000-000000006901',clock_timestamp()+interval '1 hour','Disposable test sign-in qualification'),
 ('00000000-0000-4000-8000-000000006903',clock_timestamp()+interval '1 hour','Disposable genuine-account exclusion test');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006901',true);
select ok(public.commerce_uat_session_active(),'Approved verified synthetic email qualifies own identity');
select is((select role::text from public.user_roles where user_id=auth.uid()),'customer','Sign-in lease does not elevate customer role');
select ok(not exists(select 1 from private.finance_uat_leases where actor_id=auth.uid()),'Sign-in lease does not grant financial writes');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006902',true);
select ok(not public.commerce_uat_session_active(),'Another customer cannot borrow a lease');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006903',true);
select ok(not public.commerce_uat_session_active(),'Genuine-looking email is excluded');
select set_config('request.jwt.claim.sub','',true);
select ok(not public.commerce_uat_session_active(),'No anonymous sign-in authorization');
update private.commerce_uat_signin_leases set issued_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where actor_id='00000000-0000-4000-8000-000000006901';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006901',true);
select ok(not public.commerce_uat_session_active(),'Expired lease rejected');
select ok(not has_table_privilege('authenticated','private.commerce_uat_signin_leases','INSERT'),'Customer cannot approve own test access');
select ok(not has_function_privilege('anon','public.commerce_uat_session_active()','EXECUTE'),'Guest cannot call authorization RPC');
select * from finish();rollback;
