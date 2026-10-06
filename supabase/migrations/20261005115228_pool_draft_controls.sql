-- Draft pool product controls, safe pause/resume and reasoned cancellation.
alter table public.pools add column if not exists is_paused boolean not null default false;
alter table public.pools add column if not exists paused_at timestamptz;
alter table public.pools add column if not exists pause_reason text;
alter table public.pools add column if not exists paused_by uuid;
alter table public.pools add column if not exists cancelled_at timestamptz;
alter table public.pools add column if not exists cancellation_reason text;
alter table public.pools add column if not exists cancelled_by uuid;

create or replace function public.admin_configure_own_pool_item(p_pool_id uuid,p_product_id uuid,p_pricing_mode text,p_fixed_price numeric,p_target_quantity integer,p_target_price numeric,p_min_quantity integer,p_max_quantity integer,p_tiers jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_pool public.pools%rowtype; v_benchmark public.market_price_benchmarks%rowtype;
  v_item uuid; v_landed numeric:=0; r jsonb; v_q int; v_price numeric;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  if not private.is_own_product(p_product_id) then raise exception 'Own product required'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update;
  if not found or v_pool.status<>'draft' then raise exception 'Own product can only be configured while pool is Draft'; end if;
  select * into v_benchmark from public.market_price_benchmarks where product_id=p_product_id and community_id=v_pool.community_id and approved and superseded_at is null;
  if not found then raise exception 'Approve a current market benchmark first'; end if;
  select coalesce((select total_landed_cost from public.own_product_costs where product_id=p_product_id),0) into v_landed;
  if p_pricing_mode not in ('FIXED_POOL_PRICE','QUANTITY_TIER','TARGET_PRICE') then raise exception 'Invalid pricing mode'; end if;
  if coalesce(p_min_quantity,1)<1 or p_max_quantity<coalesce(p_min_quantity,1) then raise exception 'Invalid quantity limits'; end if;
  if p_pricing_mode='FIXED_POOL_PRICE' and coalesce(p_fixed_price,0)<=0 then raise exception 'Fixed price required'; end if;
  if p_pricing_mode='TARGET_PRICE' and (coalesce(p_target_quantity,0)<=0 or coalesce(p_target_price,0)<=0 or coalesce(p_fixed_price,0)<=0) then raise exception 'Target quantity, target price and pre-target price required'; end if;
  if p_pricing_mode in ('FIXED_POOL_PRICE','TARGET_PRICE') and (p_fixed_price<v_landed or p_fixed_price>v_benchmark.benchmark_price) then raise exception 'Pre-target/fixed price must be between landed cost % and market benchmark %',v_landed,v_benchmark.benchmark_price; end if;
  if p_pricing_mode='TARGET_PRICE' and (p_target_price<v_landed or p_target_price>v_benchmark.benchmark_price) then raise exception 'Target price must be between landed cost % and market benchmark %',v_landed,v_benchmark.benchmark_price; end if;

  select id into v_item from public.pool_items where pool_id=p_pool_id and product_id=p_product_id for update;
  if v_item is not null and exists(select 1 from public.commitments where pool_item_id=v_item and status in ('active','confirmed')) then raise exception 'Cannot reconfigure an item after customer commitments exist'; end if;
  if v_item is null then
    insert into public.pool_items(pool_id,product_id,benchmark_id,benchmark_price_snapshot,expected_pool_price,min_quantity,max_quantity,pricing_mode,own_fixed_price,own_target_quantity,own_target_price)
    values(p_pool_id,p_product_id,v_benchmark.id,v_benchmark.benchmark_price,case when p_pricing_mode='QUANTITY_TIER' then null else p_fixed_price end,greatest(coalesce(p_min_quantity,1),1),p_max_quantity,p_pricing_mode,p_fixed_price,p_target_quantity,p_target_price)
    returning id into v_item;
  else
    update public.pool_items set benchmark_id=v_benchmark.id,benchmark_price_snapshot=v_benchmark.benchmark_price,
      expected_pool_price=case when p_pricing_mode='QUANTITY_TIER' then null else p_fixed_price end,
      min_quantity=greatest(coalesce(p_min_quantity,1),1),max_quantity=p_max_quantity,pricing_mode=p_pricing_mode,
      own_fixed_price=p_fixed_price,own_target_quantity=p_target_quantity,own_target_price=p_target_price,active=true
    where id=v_item;
    delete from public.own_product_price_tiers where pool_item_id=v_item;
  end if;

  if p_pricing_mode='QUANTITY_TIER' then
    if jsonb_array_length(coalesce(p_tiers,'[]'::jsonb))=0 then raise exception 'At least one quantity tier required'; end if;
    for r in select value from jsonb_array_elements(p_tiers) loop
      v_q:=(r->>'min_quantity')::int; v_price:=(r->>'unit_price')::numeric;
      if v_q<1 or v_price<=0 then raise exception 'Each quantity tier needs a positive quantity and price'; end if;
      if v_price<v_landed or v_price>v_benchmark.benchmark_price then raise exception 'Every tier price must be between landed cost % and market benchmark %',v_landed,v_benchmark.benchmark_price; end if;
      insert into public.own_product_price_tiers(pool_item_id,min_quantity,unit_price) values(v_item,v_q,v_price);
    end loop;
    update public.pool_items set expected_pool_price=private.resolve_own_product_price(v_item,greatest(coalesce(p_min_quantity,1),1)) where id=v_item;
  end if;
  if private.resolve_own_product_price(v_item,greatest(coalesce(p_min_quantity,1),1)) is null then raise exception 'Pricing does not provide a valid starting price'; end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'own_product_pool_configured','pool_item',v_item,jsonb_build_object('pricing_mode',p_pricing_mode,'landed_cost',v_landed,'benchmark',v_benchmark.benchmark_price));
  return v_item;
end; $$;
revoke all on function public.admin_configure_own_pool_item(uuid,uuid,text,numeric,integer,numeric,integer,integer,jsonb) from public,anon;
grant execute on function public.admin_configure_own_pool_item(uuid,uuid,text,numeric,integer,numeric,integer,integer,jsonb) to authenticated;

create or replace function public.admin_remove_draft_pool_item(p_pool_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_item public.pool_items%rowtype; v_status text;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  select * into v_item from public.pool_items where id=p_pool_item_id for update;
  if not found then raise exception 'Pool item not found'; end if;
  select status into v_status from public.pools where id=v_item.pool_id for update;
  if v_status<>'draft' then raise exception 'Products can only be removed while the pool is Draft'; end if;
  if exists(select 1 from public.commitments where pool_item_id=p_pool_item_id) then raise exception 'Cannot remove an item that already has commitment history'; end if;
  delete from public.pool_items where id=p_pool_item_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'draft_pool_item_removed','pool_item',p_pool_item_id,jsonb_build_object('pool_id',v_item.pool_id,'product_id',v_item.product_id));
end; $$;
revoke all on function public.admin_remove_draft_pool_item(uuid) from public,anon;
grant execute on function public.admin_remove_draft_pool_item(uuid) to authenticated;

create or replace function public.admin_set_pool_pause(p_pool_id uuid,p_paused boolean,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_pool public.pools%rowtype; v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update; if not found then raise exception 'Pool not found'; end if;
  if v_pool.status<>'open' then raise exception 'Only an Open pool can be paused or resumed'; end if;
  if p_paused and v_reason is null then raise exception 'Pause reason required'; end if;
  if p_paused then
    update public.pools set is_paused=true,paused_at=now(),pause_reason=v_reason,paused_by=v_user where id=p_pool_id;
  else
    update public.pools set is_paused=false,paused_at=null,pause_reason=null,paused_by=null where id=p_pool_id;
  end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,case when p_paused then 'pool_paused' else 'pool_resumed' end,'pool',p_pool_id,jsonb_build_object('reason',v_reason));
end; $$;
revoke all on function public.admin_set_pool_pause(uuid,boolean,text) from public,anon;
grant execute on function public.admin_set_pool_pause(uuid,boolean,text) to authenticated;

create or replace function public.admin_cancel_pool(p_pool_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_reason text:=nullif(btrim(coalesce(p_reason,'')),''); v_status text;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  if v_reason is null then raise exception 'Cancellation reason required'; end if;
  select status into v_status from public.pools where id=p_pool_id for update; if not found then raise exception 'Pool not found'; end if;
  if v_status='completed' then raise exception 'Completed pool cannot be cancelled'; end if;
  if v_status='cancelled' then return; end if;
  perform public.admin_set_pool_status(p_pool_id,'cancelled');
  update public.pools set is_paused=false,paused_at=null,pause_reason=null,paused_by=null,cancelled_at=now(),cancellation_reason=v_reason,cancelled_by=v_user where id=p_pool_id;
  update public.orders set cancellation_reason=v_reason where pool_id=p_pool_id and status='cancelled';
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pool_cancelled_with_reason','pool',p_pool_id,jsonb_build_object('from',v_status,'reason',v_reason));
end; $$;
revoke all on function public.admin_cancel_pool(uuid,text) from public,anon;
grant execute on function public.admin_cancel_pool(uuid,text) to authenticated;

-- Paused Open pools remain visible, but customer commitment writes are blocked.
create or replace function public.commit_to_pool(p_pool_item_id uuid,p_quantity integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_commitment uuid; v_pool_status text; v_pool_paused boolean; v_pool_community uuid; v_user_community uuid; v_max integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_quantity<1 then raise exception 'Quantity must be positive'; end if;
  select po.status,po.is_paused,po.community_id,pi.max_quantity into v_pool_status,v_pool_paused,v_pool_community,v_max
  from public.pool_items pi join public.pools po on po.id=pi.pool_id
  where pi.id=p_pool_item_id and pi.active=true for update of pi;
  if not found then raise exception 'Pool item not found'; end if;
  if v_pool_status<>'open' then raise exception 'Pool is not accepting commitments'; end if;
  if v_pool_paused then raise exception 'Pool is temporarily paused. Existing commitments are safe; try again after operations resumes the pool.'; end if;
  if p_quantity>v_max then raise exception 'Quantity exceeds pool limit'; end if;
  select community_id into v_user_community from public.profiles where id=v_user;
  if v_user_community is distinct from v_pool_community then raise exception 'Pool is outside your community'; end if;
  insert into public.commitments(pool_item_id,customer_id,quantity,status,committed_at)
  values(p_pool_item_id,v_user,p_quantity,'active',now())
  on conflict(pool_item_id,customer_id) do update set quantity=excluded.quantity,status='active',committed_at=now(),confirmed_at=null
  returning id into v_commitment;
  perform private.refresh_pool_item_unlock(p_pool_item_id);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'commitment_upserted','commitment',v_commitment,jsonb_build_object('quantity',p_quantity,'business_model','procurement_margin'));
  return v_commitment;
end; $$;
revoke all on function public.commit_to_pool(uuid,integer) from public,anon;
grant execute on function public.commit_to_pool(uuid,integer) to authenticated;

create or replace function private.guard_paused_pool_stage_change()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='open' and old.is_paused and new.status is distinct from old.status and new.status<>'cancelled' then
    raise exception 'Resume the paused pool before changing its workflow stage';
  end if;
  if new.status<>'open' then
    new.is_paused:=false; new.paused_at:=null; new.pause_reason:=null; new.paused_by:=null;
  end if;
  return new;
end; $$;
drop trigger if exists guard_paused_pool_stage_change on public.pools;
create trigger guard_paused_pool_stage_change before update on public.pools for each row execute function private.guard_paused_pool_stage_change();
