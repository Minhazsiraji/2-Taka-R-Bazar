-- Disposable CI only; all fixture mutations roll back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
select ok((select relrowsecurity from pg_class where oid='private.notification_broadcasts'::regclass),'Broadcast audit has RLS');
select ok(not has_table_privilege('authenticated','private.notification_broadcasts','SELECT'),'Broadcast audit is not directly exposed');
select ok(not has_function_privilege('anon','public.admin_notification_broadcast_history()','EXECUTE'),'Guest cannot read delivery history');
select ok(not has_function_privilege('anon','public.admin_broadcast_notification(text,text,text,text,uuid,uuid,uuid)','EXECUTE'),'Guest cannot broadcast');
select throws_ok($$select public.admin_notification_broadcast_history()$$,'P0001','Admin access required','No-session history rejected');
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000941','00000000-0000-0000-0000-000000000000','authenticated','authenticated','notification-admin@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000942','00000000-0000-0000-0000-000000000000','authenticated','authenticated','notification-customer@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values('00000000-0000-4000-8000-000000000941','admin');
insert into public.communities(id,name,slug) values('00000000-0000-4000-8000-000000000948','Synthetic empty announcement community','notification-empty-948');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000942',true);
select throws_ok($$select public.admin_notification_broadcast_history()$$,'P0001','Admin access required','Customer cannot read history');
select throws_ok($$select public.admin_broadcast_notification('Test','Test','/notifications','normal',null,null,'00000000-0000-4000-8000-000000000943')$$,'P0001','Admin access required','Customer cannot send announcements');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000941',true);
select throws_ok($$select public.admin_broadcast_notification('Test','Test','//evil.example','normal',null,null,'00000000-0000-4000-8000-000000000943')$$,'P0001','Invalid notification destination','External destination blocked');
select throws_ok($$select public.admin_broadcast_notification('Test','Test','/notifications','bad',null,null,'00000000-0000-4000-8000-000000000943')$$,'P0001','Invalid notification priority','Invalid priority blocked');
select throws_ok($$select public.admin_broadcast_notification('Test','Test','/notifications','normal','00000000-0000-4000-8000-000000000949',null,'00000000-0000-4000-8000-000000000943')$$,'P0001','Active community required','Unknown audience blocked');
select is(public.admin_broadcast_notification('No audience yet','Synthetic only','/notifications','normal','00000000-0000-4000-8000-000000000948',null,'00000000-0000-4000-8000-000000000943'),0,'Zero recipients is a recorded result');
select is(public.admin_broadcast_notification('No audience yet','Synthetic only','/notifications','normal','00000000-0000-4000-8000-000000000948',null,'00000000-0000-4000-8000-000000000943'),0,'Retry preserves zero-recipient result');
select throws_ok($$select public.admin_broadcast_notification('Changed title','Synthetic only','/notifications','normal','00000000-0000-4000-8000-000000000948',null,'00000000-0000-4000-8000-000000000943')$$,'P0001','Request ID already belongs to a different announcement','Request reuse cannot change payload');
select is((select count(*) from public.admin_notification_broadcast_history()),1::bigint,'One audit entry, without duplicate requests');
select * from finish();
rollback;
