-- Synthetic E2E hardening discovered 2026-10-09.
-- Fixes:
-- 1) bind each physical receipt to its original Community Ops day;
-- 2) prohibit supply receiving after the day is no longer open;
-- 3) block day report submission while a bound supply variance/security hold is unresolved;
-- 4) require any damaged/returned quantity to enter variance review even if net accepted happens to match;
-- 5) audit actual reuse of a consumed handover code;
-- 6) reconcile inbound-only products, not only products that already appear in customer orders;
-- 7) allow independent Admin reset-for-reseal for lost/invalidated handover codes before any receipt is recorded.

alter table public.supply_dispatches
  add column if not exists community_ops_day_id uuid references public.community_ops_days(id) on delete restrict;

create index if not exists supply_dispatch_ops_day_status_idx
  on public.supply_dispatches(community_ops_day_id,status)
  where community_ops_day_id is not null;

create or replace function private.post_verified_dispatch_to_community(p_dispatch_id uuid,p_day_id uuid)
returns void language plpgsql security definer set search_path='' as $fn$
declare
  d public.supply_dispatches%rowtype;
  od public.community_ops_days%rowtype;
  r record;
  v_name text;
begin
  select * into d from public.supply_dispatches where id=p_dispatch_id;
  if not found then raise exception 'Dispatch not found'; end if;

  select * into od from public.community_ops_days where id=p_day_id;
  if not found then raise exception 'Community operations day not found'; end if;
  if d.destination_community_id<>od.community_id then
    raise exception 'Dispatch and Community Ops day belong to different communities';
  end if;
  if d.community_ops_day_id is distinct from p_day_id then
    raise exception 'Dispatch receipt is not bound to this Community Ops day';
  end if;
  if od.status<>'open' then
    raise exception 'Verified supply can only post into an open Community Ops day';
  end if;

  v_name=private.supply_source_name(d.source_kind,d.source_supplier_id,d.source_location_id);

  for r in
    select di.product_id,di.dispatched_quantity,dr.received_quantity,dr.damaged_quantity,dr.returned_quantity
    from public.supply_dispatch_items di
    join public.supply_dispatch_receipts dr on dr.dispatch_id=di.dispatch_id and dr.product_id=di.product_id
    where di.dispatch_id=p_dispatch_id
  loop
    insert into public.community_ops_inbound(
      day_id,product_id,source_type,source_name,expected_quantity,received_quantity,damaged_quantity,returned_quantity,
      exception_code,exception_reason,notes,received_by,source_dispatch_id
    ) values(
      p_day_id,r.product_id,d.source_kind,v_name,r.dispatched_quantity,r.received_quantity,r.damaged_quantity,r.returned_quantity,
      case when r.received_quantity-r.damaged_quantity-r.returned_quantity<>r.dispatched_quantity
              or r.damaged_quantity>0 or r.returned_quantity>0
           then 'verified_dispatch_variance' else null end,
      d.resolution_reason,'Verified supply handover '||d.dispatch_code,d.received_by,p_dispatch_id
    )
    on conflict(source_dispatch_id,product_id) where source_dispatch_id is not null do nothing;
  end loop;
end;
$fn$;
revoke all on function private.post_verified_dispatch_to_community(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.receive_supply_dispatch(
  p_day_id uuid,p_dispatch_id uuid,p_handover_code text,p_observed_package_count integer,
  p_observed_seal_reference text,p_items jsonb,p_receiver_note text default null
)
returns text language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid:=auth.uid();
  d public.supply_dispatches%rowtype;
  dday public.community_ops_days%rowtype;
  sec private.supply_dispatch_secrets%rowtype;
  x jsonb;
  v_product uuid;
  v_received integer;
  v_damaged integer;
  v_returned integer;
  v_expected_count integer;
  v_payload_count integer;
  v_distinct integer;
  v_variance boolean:=false;
  v_reason text:='';
  v_input_hash bytea;
begin
  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;

  select * into dday from public.community_ops_days where id=p_day_id;
  if not found then raise exception 'Community operations day not found'; end if;
  if dday.community_id<>d.destination_community_id then
    raise exception 'Dispatch belongs to a different community';
  end if;
  if not private.is_community_operator(v_user,dday.community_id) then
    raise exception 'Community assignment required';
  end if;

  if d.created_by=v_user or d.sealed_by=v_user or d.carrier_user_id=v_user
     or (d.source_kind='supplier' and exists(
          select 1 from public.supplier_memberships sm
          where sm.supplier_id=d.source_supplier_id and sm.user_id=v_user and sm.active
        ))
     or (d.source_kind='2tbr_store' and exists(
          select 1 from public.supply_location_memberships lm
          where lm.location_id=d.source_location_id and lm.user_id=v_user and lm.active
        )) then
    update public.supply_dispatches
      set status='security_hold',variance_reason='Separation of duties violation at receiving'
      where id=d.id;
    perform private.raise_supply_risk(v_user,25,'separation_of_duties_violation',d.id,jsonb_build_object('stage','receive','day_id',p_day_id));
    perform private.notify_supply_admins('supply_security_hold','Supply dispatch blocked by separation-of-duties control',
      d.dispatch_code||' was presented for receiving by a sender/source/carrier identity.',
      '/admin/supply-control','supply:'||d.id::text||':sod-receive');
    return 'security_hold';
  end if;

  -- A genuinely reused consumed code should be recorded even though the dispatch is no longer receivable.
  select * into sec from private.supply_dispatch_secrets where dispatch_id=d.id for update;
  if found and sec.consumed_at is not null then
    v_input_hash:=extensions.digest(upper(btrim(coalesce(p_handover_code,''))),'sha256');
    if v_input_hash=sec.code_hash then
      perform private.raise_supply_risk(v_user,10,'handover_code_reuse',d.id,
        jsonb_build_object('consumed_at',sec.consumed_at,'day_id',p_day_id));
      insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
      values(d.id,v_user,'handover_code_reuse_attempt',d.status,jsonb_build_object('day_id',p_day_id));
      return 'code_already_used';
    end if;
  end if;

  if d.status not in ('sealed','in_transit') then
    raise exception 'Dispatch is not available for receiving';
  end if;
  if d.community_ops_day_id is not null and d.community_ops_day_id<>p_day_id then
    raise exception 'Dispatch is already bound to another Community Ops day';
  end if;
  if dday.status<>'open' then
    raise exception 'Supply receiving requires an open Community Ops day';
  end if;

  if p_observed_package_count is null or p_observed_package_count<0 then
    raise exception 'Observed package count is required';
  end if;
  if jsonb_typeof(p_items)<>'array' then
    raise exception 'Receipt items are required';
  end if;

  select count(*) into v_expected_count from public.supply_dispatch_items where dispatch_id=d.id;
  v_payload_count=jsonb_array_length(p_items);
  if v_payload_count<>v_expected_count then
    raise exception 'Count every product in the dispatch before verifying';
  end if;

  create temporary table if not exists pg_temp.supply_receipt_input(
    product_id uuid primary key,received integer,damaged integer,returned integer
  ) on commit drop;
  truncate pg_temp.supply_receipt_input;

  for x in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product=(x->>'product_id')::uuid;
      v_received=(x->>'received_quantity')::integer;
      v_damaged=coalesce((x->>'damaged_quantity')::integer,0);
      v_returned=coalesce((x->>'returned_quantity')::integer,0);
    exception when others then
      raise exception 'Invalid receipt quantity';
    end;

    if v_received<0 or v_damaged<0 or v_returned<0 or v_damaged+v_returned>v_received then
      raise exception 'Invalid received/damaged/returned quantities';
    end if;
    if not exists(
      select 1 from public.supply_dispatch_items
      where dispatch_id=d.id and product_id=v_product
    ) then
      raise exception 'Receipt contains a product not in this dispatch';
    end if;

    insert into pg_temp.supply_receipt_input values(v_product,v_received,v_damaged,v_returned);
  end loop;

  select count(*) into v_distinct from pg_temp.supply_receipt_input;
  if v_distinct<>v_expected_count then
    raise exception 'Duplicate or missing receipt products';
  end if;

  if not found then null; end if; -- keep plpgsql FOUND use isolated from the earlier secret lookup
  if sec.dispatch_id is null then
    select * into sec from private.supply_dispatch_secrets where dispatch_id=d.id for update;
  end if;
  if sec.dispatch_id is null then
    raise exception 'Handover verification code is missing. Contact Admin.';
  end if;

  if sec.expires_at<=now() then
    update public.supply_dispatches
      set status='security_hold',variance_reason='Handover code expired before verification'
      where id=d.id;
    perform private.raise_supply_risk(d.created_by,10,'handover_code_expired',d.id,jsonb_build_object('day_id',p_day_id));
    perform private.notify_supply_admins('supply_security_hold','Supply dispatch on security hold',
      d.dispatch_code||' has an expired handover code. Admin review is required.',
      '/admin/supply-control','supply:'||d.id::text||':expired');
    return 'security_hold';
  end if;

  if extensions.digest(upper(btrim(coalesce(p_handover_code,''))),'sha256')<>sec.code_hash then
    update private.supply_dispatch_secrets
      set failed_attempts=failed_attempts+1,last_attempt_at=now()
      where dispatch_id=d.id;
    perform private.raise_supply_risk(v_user,5,'handover_code_failed',d.id,
      jsonb_build_object('attempt',sec.failed_attempts+1,'day_id',p_day_id));

    if sec.failed_attempts+1>=5 then
      update public.supply_dispatches
        set status='security_hold',variance_reason='Too many invalid handover-code attempts'
        where id=d.id;
      perform private.raise_supply_risk(v_user,25,'fraud_hold',d.id,
        jsonb_build_object('reason','five_invalid_handover_codes','day_id',p_day_id));
      perform private.notify_supply_admins('supply_security_hold','Supply dispatch locked after invalid codes',
        d.dispatch_code||' reached the maximum invalid handover-code attempts.',
        '/admin/supply-control','supply:'||d.id::text||':invalid-code-hold');
      return 'security_hold';
    end if;

    return 'invalid_code';
  end if;

  update private.supply_dispatch_secrets
    set consumed_at=now(),last_attempt_at=now()
    where dispatch_id=d.id;

  delete from public.supply_dispatch_receipts where dispatch_id=d.id;
  insert into public.supply_dispatch_receipts(
    dispatch_id,product_id,received_quantity,damaged_quantity,returned_quantity
  )
  select d.id,product_id,received,damaged,returned
  from pg_temp.supply_receipt_input;

  if p_observed_package_count<>coalesce(d.package_count,0) then
    v_variance:=true;
    v_reason:=v_reason||'Package count mismatch. ';
  end if;

  if coalesce(nullif(btrim(d.seal_reference),''),'')<>
     coalesce(nullif(btrim(p_observed_seal_reference),''),'') then
    v_variance:=true;
    v_reason:=v_reason||'Seal reference mismatch. ';
  end if;

  if exists(
    select 1
    from public.supply_dispatch_items di
    join public.supply_dispatch_receipts dr
      on dr.dispatch_id=di.dispatch_id and dr.product_id=di.product_id
    where di.dispatch_id=d.id
      and dr.net_accepted_quantity<>di.dispatched_quantity
  ) then
    v_variance:=true;
    v_reason:=v_reason||'Product quantity mismatch. ';
  end if;

  if exists(
    select 1 from public.supply_dispatch_receipts dr
    where dr.dispatch_id=d.id
      and (dr.damaged_quantity>0 or dr.returned_quantity>0)
  ) then
    v_variance:=true;
    v_reason:=v_reason||'Damaged or returned units require Admin review. ';
  end if;

  update public.supply_dispatches set
    community_ops_day_id=p_day_id,
    received_by=v_user,
    received_at=now(),
    observed_package_count=p_observed_package_count,
    observed_seal_reference=nullif(btrim(coalesce(p_observed_seal_reference,'')),''),
    receiver_note=nullif(btrim(coalesce(p_receiver_note,'')),''),
    status=case when v_variance then 'variance' else 'verified' end,
    variance_reason=case when v_variance then btrim(v_reason) else null end
  where id=d.id;

  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(
    d.id,v_user,'community_receipt_recorded',
    case when v_variance then 'variance' else 'verified' end,
    jsonb_build_object(
      'community_ops_day_id',p_day_id,
      'observed_packages',p_observed_package_count,
      'variance',v_variance,
      'reason',nullif(btrim(v_reason),'')
    )
  );

  if v_variance then
    insert into private.supply_fraud_events(dispatch_id,actor_user_id,event_type,severity,metadata)
    values(
      d.id,v_user,'supply_variance','medium',
      jsonb_build_object('reason',btrim(v_reason),'community_ops_day_id',p_day_id)
    );
    perform private.notify_supply_admins('supply_variance','Supply handover variance needs review',
      d.dispatch_code||' was received with a mismatch: '||btrim(v_reason),
      '/admin/supply-control','supply:'||d.id::text||':variance');
    perform private.enqueue_notification(d.created_by,'supply_variance','Dispatch received with variance',
      d.dispatch_code||' was received with a mismatch. Admin review is required.',
      '/supply','supply:'||d.id::text||':sender-variance','high',null,null);
    return 'variance';
  end if;

  perform private.post_verified_dispatch_to_community(d.id,p_day_id);

  perform private.enqueue_notification(d.created_by,'supply_verified','Dispatch handover verified',
    d.dispatch_code||' was independently received and matched the sealed dispatch.',
    '/supply','supply:'||d.id::text||':verified','normal',null,null);
  perform private.enqueue_notification(v_user,'supply_verified','Inbound supply verified',
    d.dispatch_code||' matched the sender record and was posted into Community Ops stock.',
    '/community-ops?day='||p_day_id::text,
    'supply:'||d.id::text||':receiver-verified','normal',null,null);

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(
    v_user,'supply_dispatch_verified','supply_dispatch',d.id,
    jsonb_build_object('day_id',p_day_id)
  );

  return 'verified';
end;
$fn$;
revoke all on function public.receive_supply_dispatch(uuid,uuid,text,integer,text,jsonb,text)
  from public,anon,authenticated,service_role;
grant execute on function public.receive_supply_dispatch(uuid,uuid,text,integer,text,jsonb,text)
  to authenticated;

create or replace function public.submit_community_ops_report(p_day_id uuid,p_report_note text default null)
returns void language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid:=auth.uid();
  d public.community_ops_days%rowtype;
  v_pending integer;
  v_bad_inbound integer;
  v_stock_variance integer;
  v_supply_unresolved integer;
begin
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then
    raise exception 'Community assignment required';
  end if;
  if d.status<>'open' then
    raise exception 'Only an open day can be submitted';
  end if;

  perform private.community_ops_refresh_manifest_internal(p_day_id);

  select count(*) into v_supply_unresolved
  from public.supply_dispatches sd
  where sd.community_ops_day_id=p_day_id
    and sd.status in ('variance','security_hold');
  if v_supply_unresolved>0 then
    raise exception '% supply handover(s) still need Admin resolution before the daily report can be submitted',v_supply_unresolved;
  end if;

  select count(*) into v_pending
  from public.community_ops_day_orders m
  join public.orders o on o.id=m.order_id
  where m.day_id=p_day_id
    and o.status='ready_for_pickup'
    and m.state not in ('completed','exception');
  if v_pending>0 then
    raise exception '% ready customer orders still need handover or an exception',v_pending;
  end if;

  select count(*) into v_bad_inbound
  from public.community_ops_inbound i
  where i.day_id=p_day_id
    and (i.received_quantity-i.damaged_quantity-i.returned_quantity)<>i.expected_quantity
    and nullif(btrim(coalesce(i.exception_reason,'')),'') is null;
  if v_bad_inbound>0 then
    raise exception 'Inbound variances require reasons';
  end if;

  -- Reconcile every product that appears anywhere in the day's physical stock flow,
  -- including inbound-only products that do not yet appear in a customer order.
  select count(*) into v_stock_variance
  from (
    select product_id,
      coalesce((
        select sum(i.received_quantity-i.damaged_quantity-i.returned_quantity)
        from public.community_ops_inbound i
        where i.day_id=p_day_id and i.product_id=ids.product_id
      ),0)
      - coalesce((
        select sum(oi.quantity)
        from public.community_ops_day_orders m
        join public.order_items oi on oi.order_id=m.order_id
        where m.day_id=p_day_id
          and m.state='completed'
          and oi.product_id=ids.product_id
      ),0)
      - coalesce((
        select sum(sa.quantity)
        from public.community_ops_stock_adjustments sa
        where sa.day_id=p_day_id and sa.product_id=ids.product_id
      ),0) as variance
    from (
      select i.product_id from public.community_ops_inbound i where i.day_id=p_day_id
      union
      select oi.product_id
      from public.community_ops_day_orders m
      join public.order_items oi on oi.order_id=m.order_id
      where m.day_id=p_day_id
      union
      select sa.product_id from public.community_ops_stock_adjustments sa where sa.day_id=p_day_id
    ) ids
  ) s
  where s.variance<>0;

  if v_stock_variance>0 then
    raise exception '% product(s) still have stock variance. Account remaining/returned/damaged/missing stock before submitting.',v_stock_variance;
  end if;

  update public.community_ops_days
  set status='submitted',
      report_note=nullif(btrim(coalesce(p_report_note,'')),''),
      submitted_at=now(),
      submitted_by=v_user,
      updated_at=now()
  where id=p_day_id;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(
    v_user,'community_ops_report_submitted','community_ops_day',p_day_id,
    jsonb_build_object(
      'pending_ready_orders',v_pending,
      'unresolved_supply_handovers',v_supply_unresolved
    )
  );
end;
$fn$;
revoke all on function public.submit_community_ops_report(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.submit_community_ops_report(uuid,text)
  to authenticated;

create or replace function public.admin_resolve_supply_variance(
  p_dispatch_id uuid,p_resolution text,p_responsibility text,p_reason text,p_day_id uuid default null
)
returns void language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid:=auth.uid();
  d public.supply_dispatches%rowtype;
  od public.community_ops_days%rowtype;
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  v_actor uuid;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;

  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;

  if d.status not in ('variance','security_hold','sealed','in_transit') then
    raise exception 'Dispatch is not awaiting Admin resolution';
  end if;

  if d.status in ('sealed','in_transit') and p_resolution<>'reset_for_reseal' then
    raise exception 'Only reset-for-reseal is allowed before a physical receipt is recorded';
  end if;

  if v_user in (
       coalesce(d.created_by,'00000000-0000-0000-0000-000000000000'::uuid),
       coalesce(d.received_by,'00000000-0000-0000-0000-000000000000'::uuid),
       coalesce(d.carrier_user_id,'00000000-0000-0000-0000-000000000000'::uuid)
     )
     or (d.source_kind='supplier' and exists(
          select 1 from public.supplier_memberships sm
          where sm.supplier_id=d.source_supplier_id and sm.user_id=v_user and sm.active
        ))
     or (d.source_kind='2tbr_store' and exists(
          select 1 from public.supply_location_memberships lm
          where lm.location_id=d.source_location_id and lm.user_id=v_user and lm.active
        )) then
    raise exception 'Independent Admin required: source staff, sender, receiver or carrier cannot resolve the same dispatch';
  end if;

  if p_resolution not in (
    'accept_receiver_count','replacement_pending','return_entire_batch',
    'fraud_hold','cancelled','reset_for_reseal'
  ) then
    raise exception 'Invalid resolution';
  end if;

  if p_responsibility not in ('source','receiver','carrier','none','unknown') then
    raise exception 'Invalid responsibility';
  end if;
  if v_reason is null then
    raise exception 'Resolution reason is required';
  end if;

  if p_resolution='reset_for_reseal' then
    if d.status not in ('security_hold','sealed','in_transit') then
      raise exception 'Only an unreceived sealed/in-transit/security-held dispatch can be reset for resealing';
    end if;
    if d.received_by is not null
       or d.community_ops_day_id is not null
       or exists(select 1 from public.supply_dispatch_receipts r where r.dispatch_id=d.id) then
      raise exception 'A dispatch with recorded receiver quantities cannot be reset; resolve the variance instead';
    end if;

    delete from private.supply_dispatch_secrets where dispatch_id=d.id;

    update public.supply_dispatches set
      status='draft',
      package_count=null,
      seal_reference=null,
      sealed_by=null,
      sealed_at=null,
      carrier_acknowledged_at=null,
      variance_reason=null,
      resolution=p_resolution,
      resolution_reason=v_reason,
      resolved_by=v_user,
      resolved_at=now()
    where id=d.id;

  elsif p_resolution='accept_receiver_count' then
    if d.status<>'variance' then
      raise exception 'Receiver count can only be accepted from a variance state';
    end if;
    if d.received_by is null or d.community_ops_day_id is null then
      raise exception 'No bound receiver count exists';
    end if;
    if p_day_id is not null and p_day_id<>d.community_ops_day_id then
      raise exception 'Variance must be resolved into the original Community Ops day';
    end if;

    select * into od from public.community_ops_days where id=d.community_ops_day_id for update;
    if not found then raise exception 'Original Community Ops day not found'; end if;
    if od.community_id<>d.destination_community_id then
      raise exception 'Original Community Ops day does not match destination';
    end if;
    if od.status<>'open' then
      raise exception 'Original Community Ops day must remain open until the supply variance is resolved';
    end if;

    update public.supply_dispatches
    set status='resolved',
        resolution=p_resolution,
        resolution_reason=v_reason,
        resolved_by=v_user,
        resolved_at=now()
    where id=d.id;

    perform private.post_verified_dispatch_to_community(d.id,d.community_ops_day_id);

  elsif p_resolution='replacement_pending' then
    if d.status<>'variance' then raise exception 'Replacement can only be requested from a variance state'; end if;
    update public.supply_dispatches
    set status='variance',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;

  elsif p_resolution='return_entire_batch' then
    if d.status not in ('variance','security_hold') then raise exception 'Return requires a received variance or security hold'; end if;
    update public.supply_dispatches
    set status='returned',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;

  elsif p_resolution='fraud_hold' then
    update public.supply_dispatches
    set status='security_hold',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;

  else
    update public.supply_dispatches
    set status='cancelled',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;
  end if;

  v_actor=case p_responsibility
    when 'source' then d.created_by
    when 'receiver' then d.received_by
    when 'carrier' then d.carrier_user_id
    else null
  end;

  if v_actor is not null then
    perform private.raise_supply_risk(
      v_actor,
      case when p_resolution='fraud_hold' then 30 else 15 end,
      case when p_resolution='fraud_hold' then 'fraud_hold' else 'confirmed_variance' end,
      d.id,
      jsonb_build_object(
        'responsibility',p_responsibility,
        'resolution',p_resolution,
        'reason',v_reason,
        'community_ops_day_id',d.community_ops_day_id
      )
    );
  end if;

  if p_responsibility='source' and d.source_supplier_id is not null then
    update public.suppliers
    set reliability_status=case when reliability_status='blocked' then 'blocked' else 'watch' end
    where id=d.source_supplier_id;
  end if;

  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(
    d.id,v_user,'admin_variance_resolution',
    case when p_resolution='accept_receiver_count' then 'resolved' else p_resolution end,
    jsonb_build_object(
      'resolution',p_resolution,
      'responsibility',p_responsibility,
      'reason',v_reason,
      'community_ops_day_id',d.community_ops_day_id
    )
  );

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(
    v_user,'supply_variance_resolved','supply_dispatch',d.id,
    jsonb_build_object(
      'resolution',p_resolution,
      'responsibility',p_responsibility,
      'reason',v_reason,
      'community_ops_day_id',d.community_ops_day_id
    )
  );

  perform private.enqueue_notification(
    d.created_by,'supply_resolution','Supply dispatch review updated',
    d.dispatch_code||' review result: '||replace(p_resolution,'_',' ')||'.',
    '/supply','supply:'||d.id::text||':resolution:'||p_resolution,'high',null,null
  );

  if d.received_by is not null then
    perform private.enqueue_notification(
      d.received_by,'supply_resolution','Inbound dispatch review updated',
      d.dispatch_code||' review result: '||replace(p_resolution,'_',' ')||'.',
      '/community-ops','supply:'||d.id::text||':receiver-resolution:'||p_resolution,'high',null,null
    );
  end if;
end;
$fn$;
revoke all on function public.admin_resolve_supply_variance(uuid,text,text,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.admin_resolve_supply_variance(uuid,text,text,text,uuid)
  to authenticated;

create or replace function public.get_community_ops_day(p_day_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
  d public.community_ops_days%rowtype;
  result jsonb;
begin
  select * into d from public.community_ops_days where id=p_day_id;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(auth.uid(),d.community_id) then
    raise exception 'Community assignment required';
  end if;

  select jsonb_build_object(
    'day',jsonb_build_object(
      'id',d.id,'community_id',d.community_id,'community_name',c.name,'business_date',d.business_date,
      'status',d.status,'report_note',d.report_note,'submitted_at',d.submitted_at,
      'cash_submitted_at',d.cash_submitted_at,'admin_accepted_at',d.admin_accepted_at,
      'admin_note',d.admin_note,'accepted_with_exception',d.accepted_with_exception
    ),
    'summary',(
      select jsonb_build_object(
        'orders',count(*),
        'ready_orders',count(*) filter(where o.status='ready_for_pickup'),
        'completed_orders',count(*) filter(where m.state='completed'),
        'exception_orders',count(*) filter(where m.state='exception'),
        'pending_orders',count(*) filter(where o.status='ready_for_pickup' and m.state not in ('completed','exception')),
        'pickup_orders',count(*) filter(where o.fulfillment_method='pickup'),
        'home_delivery_orders',count(*) filter(where o.fulfillment_method='home_delivery'),
        'expected_product_cod',coalesce(sum(m.expected_product_cash) filter(where m.state='completed'),0),
        'product_cod_collected',coalesce(sum(m.product_cash_received),0),
        'expected_delivery_fees',coalesce(sum(m.expected_delivery_cash) filter(where m.state='completed'),0),
        'delivery_fees_collected',coalesce(sum(m.delivery_cash_received),0)
      )
      from public.community_ops_day_orders m
      join public.orders o on o.id=m.order_id
      where m.day_id=d.id
    ),
    'products',coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id',p2.id,
        'product_name',p2.name,
        'package_size',p2.package_size,
        'required_quantity',coalesce((
          select sum(oi.quantity)
          from public.community_ops_day_orders m
          join public.order_items oi on oi.order_id=m.order_id
          where m.day_id=d.id and oi.product_id=p2.id
        ),0),
        'fulfilled_quantity',coalesce((
          select sum(oi.quantity)
          from public.community_ops_day_orders m
          join public.order_items oi on oi.order_id=m.order_id
          where m.day_id=d.id and m.state='completed' and oi.product_id=p2.id
        ),0),
        'exception_quantity',coalesce((
          select sum(oi.quantity)
          from public.community_ops_day_orders m
          join public.order_items oi on oi.order_id=m.order_id
          where m.day_id=d.id and m.state='exception' and oi.product_id=p2.id
        ),0),
        'inbound_received',coalesce((
          select sum(i.received_quantity-i.damaged_quantity-i.returned_quantity)
          from public.community_ops_inbound i
          where i.day_id=d.id and i.product_id=p2.id
        ),0),
        'stock_accounted',coalesce((
          select sum(sa.quantity)
          from public.community_ops_stock_adjustments sa
          where sa.day_id=d.id and sa.product_id=p2.id
        ),0),
        'stock_variance',
          coalesce((
            select sum(i.received_quantity-i.damaged_quantity-i.returned_quantity)
            from public.community_ops_inbound i
            where i.day_id=d.id and i.product_id=p2.id
          ),0)
          - coalesce((
            select sum(oi.quantity)
            from public.community_ops_day_orders m
            join public.order_items oi on oi.order_id=m.order_id
            where m.day_id=d.id and m.state='completed' and oi.product_id=p2.id
          ),0)
          - coalesce((
            select sum(sa.quantity)
            from public.community_ops_stock_adjustments sa
            where sa.day_id=d.id and sa.product_id=p2.id
          ),0)
      ) order by p2.name)
      from public.products p2
      where p2.id in (
        select i.product_id from public.community_ops_inbound i where i.day_id=d.id
        union
        select oi.product_id
        from public.community_ops_day_orders m
        join public.order_items oi on oi.order_id=m.order_id
        where m.day_id=d.id
        union
        select sa.product_id from public.community_ops_stock_adjustments sa where sa.day_id=d.id
      )
    ),'[]'::jsonb),
    'orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id',o.id,'order_code',o.order_code,'customer_id',o.customer_id,'customer_name',pr.full_name,'phone',pr.phone,
        'status',o.status,'fulfillment_method',o.fulfillment_method,'delivery_address',o.delivery_address,
        'product_subtotal',o.product_subtotal,'delivery_fee',o.delivery_fee,'total_amount',o.total_amount,
        'payment_status',o.payment_status,'payment_mode',m.payment_mode,
        'expected_product_cash',m.expected_product_cash,'expected_delivery_cash',m.expected_delivery_cash,
        'goods_verified_at',m.goods_verified_at,'state',m.state,'outcome',m.outcome,
        'product_cash_received',m.product_cash_received,'delivery_cash_received',m.delivery_cash_received,
        'exception_code',m.exception_code,'exception_reason',m.exception_reason,'notes',m.notes,
        'items',(
          select coalesce(jsonb_agg(jsonb_build_object(
            'name',p3.name,'package_size',p3.package_size,'quantity',oi.quantity,'unit_price',oi.unit_price
          )),'[]'::jsonb)
          from public.order_items oi
          join public.products p3 on p3.id=oi.product_id
          where oi.order_id=o.id
        )
      ) order by o.order_code)
      from public.community_ops_day_orders m
      join public.orders o on o.id=m.order_id
      join public.profiles pr on pr.id=o.customer_id
      where m.day_id=d.id
    ),'[]'::jsonb),
    'inbound',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'product_id',i.product_id,'product_name',p4.name,'package_size',p4.package_size,
        'source_type',i.source_type,'source_name',i.source_name,'expected_quantity',i.expected_quantity,
        'received_quantity',i.received_quantity,'damaged_quantity',i.damaged_quantity,'returned_quantity',i.returned_quantity,
        'exception_code',i.exception_code,'exception_reason',i.exception_reason,'notes',i.notes,'received_at',i.received_at
      ) order by i.received_at desc)
      from public.community_ops_inbound i
      join public.products p4 on p4.id=i.product_id
      where i.day_id=d.id
    ),'[]'::jsonb),
    'stock_adjustments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sa.id,'product_id',sa.product_id,'product_name',p5.name,'disposition',sa.disposition,
        'quantity',sa.quantity,'reason',sa.reason,'notes',sa.notes,'recorded_at',sa.recorded_at
      ) order by sa.recorded_at desc)
      from public.community_ops_stock_adjustments sa
      join public.products p5 on p5.id=sa.product_id
      where sa.day_id=d.id
    ),'[]'::jsonb),
    'cash_handover',(
      select case when h.day_id is null then null else jsonb_build_object(
        'product_cod_submitted',h.product_cod_submitted,'delivery_fees_submitted',h.delivery_fees_submitted,
        'product_cod_received',h.product_cod_received,'delivery_fees_received',h.delivery_fees_received,
        'status',h.status,'officer_note',h.officer_note,'admin_note',h.admin_note,'variance_reason',h.variance_reason,
        'submitted_at',h.submitted_at,'received_at',h.received_at
      ) end
      from (select * from public.community_ops_cash_handovers where day_id=d.id) h
    )
  ) into result
  from public.communities c
  where c.id=d.community_id;

  return result;
end;
$fn$;
revoke all on function public.get_community_ops_day(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.get_community_ops_day(uuid)
  to authenticated;
