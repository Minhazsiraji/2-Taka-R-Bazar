\set ON_ERROR_STOP on
begin;

create temp table e2e_state(k text primary key,v text) on commit drop;

create or replace function pg_temp.assert_true(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then
    raise exception 'E2E ASSERTION FAILED: %',p_message;
  end if;
end;
$$;

create or replace function pg_temp.expect_error(p_sql text,p_contains text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'EXPECTED ERROR NOT RAISED: %',p_contains;
  exception when others then
    if position(p_contains in sqlerrm)=0 then
      raise;
    end if;
  end;
end;
$$;

-- Synthetic users. The auth trigger creates customer profiles/roles automatically.
insert into auth.users(id,email,phone,created_at,updated_at) values
('a0000000-0000-0000-0000-000000000001','e2e-admin1@invalid.test','+8801999000001',now(),now()),
('a0000000-0000-0000-0000-000000000002','e2e-admin2@invalid.test','+8801999000002',now(),now()),
('b0000000-0000-0000-0000-000000000001','e2e-supplier-owner@invalid.test','+8801999000011',now(),now()),
('b0000000-0000-0000-0000-000000000002','e2e-supplier-analyst@invalid.test','+8801999000012',now(),now()),
('c0000000-0000-0000-0000-000000000001','e2e-storekeeper@invalid.test','+8801999000021',now(),now()),
('d0000000-0000-0000-0000-000000000001','e2e-community-ops@invalid.test','+8801999000031',now(),now()),
('e0000000-0000-0000-0000-000000000001','e2e-carrier@invalid.test','+8801999000041',now(),now()),
('f0000000-0000-0000-0000-000000000001','e2e-outsider@invalid.test','+8801999000051',now(),now());

update public.profiles
set full_name=case id
 when 'a0000000-0000-0000-0000-000000000001'::uuid then 'E2E Admin 1'
 when 'a0000000-0000-0000-0000-000000000002'::uuid then 'E2E Admin 2'
 when 'b0000000-0000-0000-0000-000000000001'::uuid then 'E2E Supplier Owner'
 when 'b0000000-0000-0000-0000-000000000002'::uuid then 'E2E Supplier Analyst'
 when 'c0000000-0000-0000-0000-000000000001'::uuid then 'E2E Storekeeper'
 when 'd0000000-0000-0000-0000-000000000001'::uuid then 'E2E Community Ops'
 when 'e0000000-0000-0000-0000-000000000001'::uuid then 'E2E Carrier'
 else 'E2E Outsider' end
where id in (
'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
'c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',
'e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001'
);

insert into public.user_roles(user_id,role) values
('a0000000-0000-0000-0000-000000000001','admin'),
('a0000000-0000-0000-0000-000000000002','admin')
on conflict do nothing;

insert into public.communities(id,name,slug,active,sort_order)
values('11111111-1111-1111-1111-111111111111','E2E Synthetic Community','e2e-synthetic-community',true,999);

insert into public.products(id,name,brand,category,package_size,unit,sku,active,is_demo)
values
('22222222-2222-2222-2222-222222222221','E2E Oil','Synthetic','Grocery','5 L','bottle','E2E-OIL-5L',true,true),
('22222222-2222-2222-2222-222222222222','E2E Rice','Synthetic','Grocery','5 KG','bag','E2E-RICE-5KG',true,true);

insert into public.suppliers(id,business_name,reliability_status,active)
values('33333333-3333-3333-3333-333333333333','E2E Synthetic Supplier','reliable',true);

-- Admin setup.
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_link_supplier_account('33333333-3333-3333-3333-333333333333','b0000000-0000-0000-0000-000000000001','owner');
select public.admin_link_supplier_account('33333333-3333-3333-3333-333333333333','b0000000-0000-0000-0000-000000000002','analyst');
select public.admin_link_supplier_product('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222221','supplier','SUP-OIL');
select public.admin_link_supplier_product('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','supplier','SUP-RICE');
select public.admin_assign_community_operator('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
insert into e2e_state values('store_location',public.admin_create_supply_location('E2E 2TBR Store','store','Synthetic address')::text);
select public.admin_assign_supply_location_member((select v::uuid from e2e_state where k='store_location'),'c0000000-0000-0000-0000-000000000001','storekeeper');

-- Access controls.
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000002',true);
select pg_temp.expect_error(
  $$select public.create_supply_dispatch(
    'supplier','33333333-3333-3333-3333-333333333333','E2E-ANALYST-001',
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":10}]'::jsonb,'analyst'
  )$$,
  'Dispatch permission required'
);

select set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000001',true);
select pg_temp.expect_error(
  $$select public.create_supply_dispatch(
    'supplier','33333333-3333-3333-3333-333333333333','E2E-OUTSIDER-001',
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":1}]'::jsonb,'outsider'
  )$$,
  'Dispatch permission required'
);

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select pg_temp.expect_error(
  $$select public.create_supply_dispatch(
    'supplier','33333333-3333-3333-3333-333333333333','E2E-ADMIN-AS-SOURCE',
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":1}]'::jsonb,'admin should not inherit source permission'
  )$$,
  'Dispatch permission required'
);

-- Day 1: external supplier happy path.
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('day1',public.start_community_ops_day('11111111-1111-1111-1111-111111111111','2099-01-01')::text);

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('happy_dispatch',public.create_supply_dispatch(
  'supplier','33333333-3333-3333-3333-333333333333','E2E-HAPPY-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":10},
    {"product_id":"22222222-2222-2222-2222-222222222222","quantity":5}]'::jsonb,'happy'
)::text);

select pg_temp.expect_error(
  format('select public.seal_supply_dispatch(%L::uuid,2,%L)',(select v from e2e_state where k='happy_dispatch'),'SEAL-HAPPY'),
  'requires Admin authorization'
);

select pg_temp.expect_error(
  $$select public.create_supply_dispatch(
    'supplier','33333333-3333-3333-3333-333333333333','E2E-HAPPY-001',
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":1}]'::jsonb,'duplicate'
  )$$,
  'already been used'
);

-- Even if a supplier owner also holds Admin role, they cannot authorize their own source dispatch.
insert into public.user_roles(user_id,role) values('b0000000-0000-0000-0000-000000000001','admin') on conflict do nothing;
select pg_temp.expect_error(
  format('select public.admin_authorize_supply_dispatch(%L::uuid,%L)',(select v from e2e_state where k='happy_dispatch'),'self approve'),
  'dispatch creator or supplier staff cannot authorize'
);
delete from public.user_roles where user_id='b0000000-0000-0000-0000-000000000001' and role='admin';

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_authorize_supply_dispatch((select v::uuid from e2e_state where k='happy_dispatch'),'independent approval');
select public.admin_assign_supply_carrier((select v::uuid from e2e_state where k='happy_dispatch'),'e0000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('happy_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='happy_dispatch'),2,'SEAL-HAPPY'));

select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000001',true);
select public.carrier_acknowledge_supply_dispatch((select v::uuid from e2e_state where k='happy_dispatch'));

-- Blind receiving model must not leak source counts/seal/package declarations.
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
do $$
declare r record;
begin
  select * into r from public.get_my_inbound_supply_dispatches((select v::uuid from e2e_state where k='day1'))
  where dispatch_id=(select v::uuid from e2e_state where k='happy_dispatch');
  perform pg_temp.assert_true(r.dispatch_id is not null,'blind inbound dispatch missing');
  perform pg_temp.assert_true(r.package_count is null,'blind receiver can see sender package count');
  perform pg_temp.assert_true(r.seal_reference is null,'blind receiver can see sender seal');
  perform pg_temp.assert_true(not ((r.items->0) ? 'dispatched_quantity'),'blind receiver can see sender item quantity');
end $$;

insert into e2e_state values('happy_result',public.receive_supply_dispatch(
  (select v::uuid from e2e_state where k='day1'),
  (select v::uuid from e2e_state where k='happy_dispatch'),
  (select v from e2e_state where k='happy_code'),
  2,'SEAL-HAPPY',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","received_quantity":10,"damaged_quantity":0,"returned_quantity":0},
    {"product_id":"22222222-2222-2222-2222-222222222222","received_quantity":5,"damaged_quantity":0,"returned_quantity":0}]'::jsonb,
  'exact count'
));

select pg_temp.assert_true((select v from e2e_state where k='happy_result')='verified','happy supplier receipt did not verify');
select pg_temp.assert_true(
  (select count(*)=2 from public.community_ops_inbound where source_dispatch_id=(select v::uuid from e2e_state where k='happy_dispatch')),
  'happy supplier receipt did not post exactly two inbound rows'
);
select pg_temp.assert_true(
  (select community_ops_day_id=(select v::uuid from e2e_state where k='day1') from public.supply_dispatches where id=(select v::uuid from e2e_state where k='happy_dispatch')),
  'verified dispatch is not bound to original Community Ops day'
);

-- Inbound-only inventory must be visible and must block report until explicitly accounted.
do $$
declare detail jsonb;
begin
  detail:=public.get_community_ops_day((select v::uuid from e2e_state where k='day1'));
  perform pg_temp.assert_true(jsonb_array_length(detail->'products')=2,'inbound-only products are missing from Community Ops product reconciliation');
end $$;

select pg_temp.expect_error(
  format('select public.submit_community_ops_report(%L::uuid,%L)',(select v from e2e_state where k='day1'),'unaccounted stock'),
  'product(s) still have stock variance'
);

select public.record_community_ops_stock_adjustment((select v::uuid from e2e_state where k='day1'),'22222222-2222-2222-2222-222222222221','retained_at_point',10,'Synthetic retained stock','E2E');
select public.record_community_ops_stock_adjustment((select v::uuid from e2e_state where k='day1'),'22222222-2222-2222-2222-222222222222','retained_at_point',5,'Synthetic retained stock','E2E');
select public.submit_community_ops_report((select v::uuid from e2e_state where k='day1'),'day1 reconciled');
select pg_temp.assert_true(
  (select status='submitted' from public.community_ops_days where id=(select v::uuid from e2e_state where k='day1')),
  'day1 did not submit after full stock reconciliation'
);

-- A consumed code reused after completion must be audited even though day1 is now submitted.
do $$
declare before_count bigint; after_count bigint; res text;
begin
  select count(*) into before_count from private.supply_fraud_events
  where dispatch_id=(select v::uuid from e2e_state where k='happy_dispatch') and event_type='handover_code_reuse';

  res:=public.receive_supply_dispatch(
    (select v::uuid from e2e_state where k='day1'),
    (select v::uuid from e2e_state where k='happy_dispatch'),
    (select v from e2e_state where k='happy_code'),
    2,'SEAL-HAPPY',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","received_quantity":10,"damaged_quantity":0,"returned_quantity":0},
      {"product_id":"22222222-2222-2222-2222-222222222222","received_quantity":5,"damaged_quantity":0,"returned_quantity":0}]'::jsonb,
    'reuse'
  );

  select count(*) into after_count from private.supply_fraud_events
  where dispatch_id=(select v::uuid from e2e_state where k='happy_dispatch') and event_type='handover_code_reuse';

  perform pg_temp.assert_true(res='code_already_used','used code did not return code_already_used');
  perform pg_temp.assert_true(after_count=before_count+1,'used handover code was not audited');
end $$;

-- A new dispatch cannot be received into the already-submitted day.
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('late_dispatch',public.create_supply_dispatch(
  'supplier','33333333-3333-3333-3333-333333333333','E2E-LATE-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":3}]'::jsonb,'late'
)::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_authorize_supply_dispatch((select v::uuid from e2e_state where k='late_dispatch'),'late approval');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('late_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='late_dispatch'),1,'SEAL-LATE'));
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
select pg_temp.expect_error(
  format(
    'select public.receive_supply_dispatch(%L::uuid,%L::uuid,%L,1,%L,%L::jsonb,%L)',
    (select v from e2e_state where k='day1'),
    (select v from e2e_state where k='late_dispatch'),
    (select v from e2e_state where k='late_code'),
    'SEAL-LATE',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","received_quantity":3,"damaged_quantity":0,"returned_quantity":0}]',
    'late receive'
  ),
  'open Community Ops day'
);

-- Day 2: shortage variance must bind to day2 and block the report.
insert into e2e_state values('day2',public.start_community_ops_day('11111111-1111-1111-1111-111111111111','2099-01-02')::text);
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('variance_dispatch',public.create_supply_dispatch(
  'supplier','33333333-3333-3333-3333-333333333333','E2E-VAR-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":10}]'::jsonb,'shortage'
)::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_authorize_supply_dispatch((select v::uuid from e2e_state where k='variance_dispatch'),'variance approval');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('variance_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='variance_dispatch'),1,'SEAL-VAR'));
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true(
  public.receive_supply_dispatch(
    (select v::uuid from e2e_state where k='day2'),
    (select v::uuid from e2e_state where k='variance_dispatch'),
    (select v from e2e_state where k='variance_code'),
    1,'SEAL-VAR',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","received_quantity":9,"damaged_quantity":0,"returned_quantity":0}]'::jsonb,
    '1 short'
  )='variance',
  'shortage did not enter variance state'
);

select pg_temp.expect_error(
  format('select public.submit_community_ops_report(%L::uuid,%L)',(select v from e2e_state where k='day2'),'unresolved variance'),
  'supply handover(s) still need Admin resolution'
);

-- Day 3 exists only to prove Admin cannot redirect day2 receipt into another same-community day.
insert into e2e_state values('day3',public.start_community_ops_day('11111111-1111-1111-1111-111111111111','2099-01-03')::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.expect_error(
  format(
    'select public.admin_resolve_supply_variance(%L::uuid,%L,%L,%L,%L::uuid)',
    (select v from e2e_state where k='variance_dispatch'),
    'accept_receiver_count','source','wrong-day attempt',
    (select v from e2e_state where k='day3')
  ),
  'original Community Ops day'
);

-- Null day means "use the immutable original receipt day".
select public.admin_resolve_supply_variance(
  (select v::uuid from e2e_state where k='variance_dispatch'),
  'accept_receiver_count','source','Supplier short by one; accept receiver physical count',null
);
select pg_temp.assert_true(
  (select status='resolved' and community_ops_day_id=(select v::uuid from e2e_state where k='day2')
   from public.supply_dispatches where id=(select v::uuid from e2e_state where k='variance_dispatch')),
  'variance did not resolve into original day'
);
select pg_temp.assert_true(
  (select reliability_status='watch' from public.suppliers where id='33333333-3333-3333-3333-333333333333'),
  'supplier responsibility did not move supplier reliability to watch'
);

select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
select public.record_community_ops_stock_adjustment((select v::uuid from e2e_state where k='day2'),'22222222-2222-2222-2222-222222222221','retained_at_point',9,'Accepted receiver count retained','E2E');
select public.submit_community_ops_report((select v::uuid from e2e_state where k='day2'),'variance resolved and stock accounted');

-- Day 4: damaged/returned units must always require Admin review even when net equals dispatched.
insert into e2e_state values('day4',public.start_community_ops_day('11111111-1111-1111-1111-111111111111','2099-01-04')::text);
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('damage_dispatch',public.create_supply_dispatch(
  'supplier','33333333-3333-3333-3333-333333333333','E2E-DAMAGE-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":10}]'::jsonb,'damage'
)::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_authorize_supply_dispatch((select v::uuid from e2e_state where k='damage_dispatch'),'damage approval');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('damage_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='damage_dispatch'),1,'SEAL-DAMAGE'));
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true(
  public.receive_supply_dispatch(
    (select v::uuid from e2e_state where k='day4'),
    (select v::uuid from e2e_state where k='damage_dispatch'),
    (select v from e2e_state where k='damage_code'),
    1,'SEAL-DAMAGE',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","received_quantity":11,"damaged_quantity":1,"returned_quantity":0}]'::jsonb,
    'net is 10 but one damaged'
  )='variance',
  'damaged units incorrectly auto-verified because net matched'
);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.admin_resolve_supply_variance((select v::uuid from e2e_state where k='damage_dispatch'),'return_entire_batch','source','Return damaged/anomalous batch',null);

-- Day 5: five wrong handover-code attempts must trigger security hold; independent Admin can reset and source can reseal.
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('day5',public.start_community_ops_day('11111111-1111-1111-1111-111111111111','2099-01-05')::text);
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('codefail_dispatch',public.create_supply_dispatch(
  'supplier','33333333-3333-3333-3333-333333333333','E2E-CODEFAIL-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":2}]'::jsonb,'wrong-code'
)::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_authorize_supply_dispatch((select v::uuid from e2e_state where k='codefail_dispatch'),'codefail approval');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('codefail_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='codefail_dispatch'),1,'SEAL-CODEFAIL'));
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
do $$
declare i integer; res text;
begin
  for i in 1..5 loop
    res:=public.receive_supply_dispatch(
      (select v::uuid from e2e_state where k='day5'),
      (select v::uuid from e2e_state where k='codefail_dispatch'),
      'WRONG999',
      1,'SEAL-CODEFAIL',
      '[{"product_id":"22222222-2222-2222-2222-222222222221","received_quantity":2,"damaged_quantity":0,"returned_quantity":0}]'::jsonb,
      'wrong code attempt'
    );
    if i<5 then
      perform pg_temp.assert_true(res='invalid_code','wrong code attempt before threshold did not return invalid_code');
    else
      perform pg_temp.assert_true(res='security_hold','fifth wrong code did not trigger security_hold');
    end if;
  end loop;
end $$;
select pg_temp.assert_true(
  (select status='security_hold' from public.supply_dispatches where id=(select v::uuid from e2e_state where k='codefail_dispatch')),
  'invalid-code threshold did not persist security hold'
);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.admin_resolve_supply_variance((select v::uuid from e2e_state where k='codefail_dispatch'),'reset_for_reseal','none','Verified operational code reset',null);
select pg_temp.assert_true(
  (select status='draft' from public.supply_dispatches where id=(select v::uuid from e2e_state where k='codefail_dispatch')),
  'security-held unreceived dispatch did not reset to draft'
);
select pg_temp.assert_true(
  not exists(select 1 from private.supply_dispatch_secrets where dispatch_id=(select v::uuid from e2e_state where k='codefail_dispatch')),
  'reset-for-reseal did not invalidate prior handover secret'
);

-- Lost-code operational recovery while sealed (without first manufacturing a security hold).
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('lost_dispatch',public.create_supply_dispatch(
  'supplier','33333333-3333-3333-3333-333333333333','E2E-LOSTCODE-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":1}]'::jsonb,'lost code'
)::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_authorize_supply_dispatch((select v::uuid from e2e_state where k='lost_dispatch'),'lost-code approval');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('lost_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='lost_dispatch'),1,'SEAL-LOST'));
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.admin_resolve_supply_variance((select v::uuid from e2e_state where k='lost_dispatch'),'reset_for_reseal','none','Sender lost one-time code before receipt',null);
select pg_temp.assert_true(
  (select status='draft' and sealed_at is null from public.supply_dispatches where id=(select v::uuid from e2e_state where k='lost_dispatch')),
  'sealed lost-code dispatch could not be safely reset before receipt'
);

-- Day 6: internal 2TBR Store path does not need external supplier authorization.
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('day6',public.start_community_ops_day('11111111-1111-1111-1111-111111111111','2099-01-06')::text);
select set_config('request.jwt.claim.sub','c0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('store_dispatch',public.create_supply_dispatch(
  '2tbr_store',(select v::uuid from e2e_state where k='store_location'),'E2E-STORE-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222222","quantity":4}]'::jsonb,'internal transfer'
)::text);
insert into e2e_state values('store_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='store_dispatch'),1,'SEAL-STORE'));
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true(
  public.receive_supply_dispatch(
    (select v::uuid from e2e_state where k='day6'),
    (select v::uuid from e2e_state where k='store_dispatch'),
    (select v from e2e_state where k='store_code'),
    1,'SEAL-STORE',
    '[{"product_id":"22222222-2222-2222-2222-222222222222","received_quantity":4,"damaged_quantity":0,"returned_quantity":0}]'::jsonb,
    'internal store exact'
  )='verified',
  '2TBR Store exact handover did not verify'
);

-- Day 7: source staff cannot also receive the same batch even if Admin assigns them Community Ops scope.
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_assign_community_operator('b0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('day7',public.start_community_ops_day('11111111-1111-1111-1111-111111111111','2099-01-07')::text);
insert into e2e_state values('sod_dispatch',public.create_supply_dispatch(
  'supplier','33333333-3333-3333-3333-333333333333','E2E-SOD-001',
  '11111111-1111-1111-1111-111111111111',
  '[{"product_id":"22222222-2222-2222-2222-222222222221","quantity":1}]'::jsonb,'SOD test'
)::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.admin_authorize_supply_dispatch((select v::uuid from e2e_state where k='sod_dispatch'),'SOD approval');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('sod_code',public.seal_supply_dispatch((select v::uuid from e2e_state where k='sod_dispatch'),1,'SEAL-SOD'));
select pg_temp.assert_true(
  public.receive_supply_dispatch(
    (select v::uuid from e2e_state where k='day7'),
    (select v::uuid from e2e_state where k='sod_dispatch'),
    (select v from e2e_state where k='sod_code'),
    1,'SEAL-SOD',
    '[{"product_id":"22222222-2222-2222-2222-222222222221","received_quantity":1,"damaged_quantity":0,"returned_quantity":0}]'::jsonb,
    'self receive attempt'
  )='security_hold',
  'source staff self-receipt did not trigger security hold'
);
select pg_temp.assert_true(
  exists(select 1 from private.supply_fraud_events where dispatch_id=(select v::uuid from e2e_state where k='sod_dispatch') and event_type='separation_of_duties_violation'),
  'SOD violation was not recorded as a fraud event'
);


-- FINANCE/TREASURY INTEGRATION: same disposable tenant, prior verified supplier delivery.
insert into public.user_roles(user_id,role)
values('a0000000-0000-0000-0000-000000000002','super_admin') on conflict do nothing;

insert into public.pools(id,community_id,title,status,created_by)
values('f1000000-0000-4000-8000-000000000001',
 '11111111-1111-1111-1111-111111111111','E2E procurement cost-linked pool','pricing',
 'a0000000-0000-0000-0000-000000000001');
insert into public.pool_items(id,pool_id,product_id,benchmark_price_snapshot,final_customer_price,
 frozen_committed_quantity,active)
values('f2000000-0000-4000-8000-000000000001',
 'f1000000-0000-4000-8000-000000000001',
 '22222222-2222-2222-2222-222222222221',1000,980,10,true);
insert into public.supplier_quotes(id,pool_item_id,supplier_id,quote_phase,quantity,
 quoted_unit_price,landed_unit_price,delivery_cost,delivery_included,
 selected,valid_until,customer_ceiling_price)
values('f3000000-0000-4000-8000-000000000001',
 'f2000000-0000-4000-8000-000000000001',
 '33333333-3333-3333-3333-333333333333','final',10,950,950,0,true,
 true,current_date+30,990);
update public.pool_items set selected_supplier_quote_id='f3000000-0000-4000-8000-000000000001'
where id='f2000000-0000-4000-8000-000000000001';
update public.pools set status='ordered' where id='f1000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values ('matched_po',public.procurement_submit_po(
 'f3000000-0000-4000-8000-000000000001','Synthetic pool frozen-demand purchase order')::text);
select pg_temp.expect_error(
 format('select public.procurement_submit_po(%L::uuid,%L)',
  'f3000000-0000-4000-8000-000000000001','replay'),
 'already has a purchase order');

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.procurement_review_po(
 (select v::uuid from e2e_state where k='matched_po'),true,'Checked supplier quote and frozen demand')='approved',
 'PO approval failed');

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values ('po_dispatch_link',
 public.procurement_link_dispatch((select v::uuid from e2e_state where k='matched_po'),
 (select v::uuid from e2e_state where k='happy_dispatch'))::text);

select pg_temp.expect_error(
 format('select public.procurement_link_dispatch(%L::uuid,%L::uuid)',
 (select v from e2e_state where k='matched_po'),
 (select v from e2e_state where k='damage_dispatch')),
 'Dispatch supplier, destination or status does not match PO');

select pg_temp.assert_true(
 private.procurement_accepted_quantity((select v::uuid from e2e_state where k='matched_po'))=10,
 'Invoice match quantity not taken from independently verified supply receipt');

insert into storage.objects(bucket_id,name)
values ('finance-evidence','a0000000-0000-0000-0000-000000000001/supplier-qa-proof.pdf');

select pg_temp.expect_error(
 format('select public.procurement_submit_bill(%L::uuid,%L,current_date,10,980,%L,%L)',
  (select v from e2e_state where k='matched_po'),'QA-EXPENSIVE-INV',
  'a0000000-0000-0000-0000-000000000001/supplier-qa-proof.pdf',
  repeat('a',64)),
 'must match approved PO');

select pg_temp.expect_error(
 format('select public.procurement_submit_bill(%L::uuid,%L,current_date,11,950,%L,%L)',
  (select v from e2e_state where k='matched_po'),'QA-OVERQTY-INV',
  'a0000000-0000-0000-0000-000000000001/supplier-qa-proof.pdf',
  repeat('b',64)),
 'exceeds verified accepted');

insert into e2e_state values ('supplier_bill',public.procurement_submit_bill(
 (select v::uuid from e2e_state where k='matched_po'),'QA-SUPPLIER-INV-9500',
 current_date,10,950,'a0000000-0000-0000-0000-000000000001/supplier-qa-proof.pdf',
 repeat('c',64))::text);

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.procurement_review_bill(
  (select v::uuid from e2e_state where k='supplier_bill'),true,
  'Full PO, independent goods and vendor invoice match')='posted',
  'Supplier bill did not post inventory liability after independent match');

select pg_temp.assert_true(
 (select sum(debit) from public.finance_journal_lines where account_code='1200')=9500,
 'Matched supplier bill did not debit inventory by actual verified cost');
select pg_temp.assert_true(
 (select sum(credit) from public.finance_journal_lines where account_code='2100')=9500,
 'Approved supplier bill did not credit accounts payable exactly once');

insert into e2e_state values('bank_acct',public.treasury_create_account(
 'Synthetic Supplier Bank','bank','E2E Bank','7842',current_date,100000,'E2E-OPEN-BANK',0,null)::text);
insert into e2e_state values('cash_acct',public.treasury_create_account(
 'Synthetic Community Cash','cash','E2E Community','',current_date,0,'E2E-OPEN-CASH',0,null)::text);

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values ('supplier_payment',public.treasury_request_supplier_payment(
 (select v::uuid from e2e_state where k='supplier_bill'),
 (select v::uuid from e2e_state where k='bank_acct'),'E2E-BANK-SUPPLIER-9500',current_date)::text);
select pg_temp.expect_error(
 format('select public.treasury_request_supplier_payment(%L::uuid,%L::uuid,%L,current_date)',
 (select v from e2e_state where k='supplier_bill'),(select v from e2e_state where k='bank_acct'),
 'E2E-DOUBLE-PAY'),
 'treasury_one_supplier_bill_payment');

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.treasury_review_transaction(
 (select v::uuid from e2e_state where k='supplier_payment'),true,'Bank payment checked')='posted',
 'Supplier bill payment did not debit payable and credit physical bank');
select pg_temp.assert_true((select status='settled' from public.procurement_supplier_bills
 where id=(select v::uuid from e2e_state where k='supplier_bill')),
 'Supplier bill remains open after verified Treasury authorization');
select pg_temp.assert_true((select private.treasury_account_balance((select v::uuid from e2e_state where k='bank_acct')))=90500,
 'Treasury bank did not reconcile after supplier payable settlement');
select pg_temp.assert_true(
 (select coalesce(sum(debit-credit),0)=0 from public.finance_journal_lines),
 'Procurement and Treasury ledger lost double-entry balance');

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('supplier_statement',public.treasury_import_statement_line(
 (select v::uuid from e2e_state where k='bank_acct'),'QA-STATEMENT-SUPPLIER-9500',
 current_date,-9500,'E2E-BANK-SUPPLIER-9500')::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.treasury_match_statement(
 (select v::uuid from e2e_state where k='supplier_statement'),
 (select v::uuid from e2e_state where k='supplier_payment'))='matched',
 'Physical supplier bank payment did not independently match its statement');

-- A prior Community Ops acceptance is synthetic: this validates the Treasury boundary,
-- while earlier tests exercise full real handover and variance gates.
insert into public.community_ops_days(id,community_id,business_date,primary_operator_id,
 status,accepted_with_exception,admin_accepted_by,admin_accepted_at)
values('f4000000-0000-4000-8000-000000000001',
 '11111111-1111-1111-1111-111111111111',current_date,
 'd0000000-0000-0000-0000-000000000001','closed',false,
 'a0000000-0000-0000-0000-000000000001',now());
insert into public.community_ops_cash_handovers(day_id,product_cod_submitted,delivery_fees_submitted,
 submitted_by,submitted_at,product_cod_received,delivery_fees_received,received_by,received_at,status)
values('f4000000-0000-4000-8000-000000000001',2000,30,
 'd0000000-0000-0000-0000-000000000001',now(),2000,30,
 'a0000000-0000-0000-0000-000000000001',now(),'accepted');

select pg_temp.assert_true(
 public.treasury_post_verified_community_cash(
 'f4000000-0000-4000-8000-000000000001',
 (select v::uuid from e2e_state where k='cash_acct'),
 'E2E-CASH-CUSTODY-2030') is not null,
 'Accepted physical community cash was not posted');
select pg_temp.assert_true(
 (select private.treasury_account_balance((select v::uuid from e2e_state where k='cash_acct')))=2030,
 'Community COD did not increase a separate physical cash account');
select pg_temp.assert_true(
 (select coalesce(sum(credit),0) from public.finance_journal_lines where account_code='2210')=2000,
 'Unapplied product COD should be a separate suspense liability, not fake net profit');
select pg_temp.assert_true(
 (select coalesce(sum(credit),0) from public.finance_journal_lines where account_code='2211')=30,
 'Community delivery fee collection must be separately classified');
select pg_temp.expect_error(
 format('select public.treasury_post_verified_community_cash(%L::uuid,%L::uuid,%L)',
 'f4000000-0000-4000-8000-000000000001',(select v from e2e_state where k='cash_acct'),
 'E2E-REPLAY-CASH'),'already posted');

select pg_temp.assert_true(
 (select (public.treasury_dashboard(current_date)->>'cash_total')::numeric)=92530,
 'Bank minus supplier payment plus accepted COD does not equal true combined cash');

\echo 'FINANCE_TREASURY_PROCUREMENT_COD_INTEGRATION_E2E_PASS'

-- All assertions passed. Roll back every synthetic row.
\echo 'SUPPLY_HANDOVER_SYNTHETIC_E2E_PASS'
rollback;
