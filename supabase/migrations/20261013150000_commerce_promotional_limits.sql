-- Issue #64 / promotional quantity caps. Preview-only, independently approved.
-- No Finance, production-purchase enablement, auth account, or inventory changes.
create table public.commerce_offer_purchase_limits(
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.commerce_offers(id) on delete restrict,
 campaign_key text not null check(campaign_key ~ '^[A-Z0-9_-]{3,64}$'),
 max_per_account integer check(max_per_account between 1 and 100),
 max_per_household integer check(max_per_household between 1 and 100),
 status text not null default 'pending' check(status in ('pending','approved','rejected','superseded')),
 requested_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reason text not null check(length(reason) between 10 and 500),
 review_note text,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 check(max_per_account is not null or max_per_household is not null),
 check(reviewed_by is null or reviewed_by <> requested_by)
);
create unique index commerce_limit_one_approved_per_offer on public.commerce_offer_purchase_limits(offer_id) where status='approved';
create index commerce_limit_lookup on public.commerce_offer_purchase_limits(campaign_key,status,offer_id);
alter table public.commerce_offer_purchase_limits enable row level security;
revoke all on public.commerce_offer_purchase_limits from public,anon,authenticated,service_role;

-- Admin-verified household keys, NOT household names typed in a registration form.
-- Existing account and address are not modified by this facility.
create table public.commerce_verified_households(
 id uuid primary key default gen_random_uuid(),
 community_id uuid not null references public.communities(id),
 building_id uuid not null references public.delivery_buildings(id),
 unit_key text not null check(length(unit_key) between 1 and 80),
 created_at timestamptz not null default now(),
 unique(community_id,building_id,unit_key)
);
create table public.commerce_verified_household_members(
 customer_id uuid primary key references auth.users(id) on delete cascade,
 household_id uuid not null references public.commerce_verified_households(id),
 verified_by uuid not null references auth.users(id),
 evidence_note text not null check(length(evidence_note) between 10 and 500),
 verified_at timestamptz not null default now()
);
create index commerce_household_members_household_idx on public.commerce_verified_household_members(household_id);
alter table public.commerce_verified_households enable row level security;
alter table public.commerce_verified_household_members enable row level security;
revoke all on public.commerce_verified_households from public,anon,authenticated,service_role;
revoke all on public.commerce_verified_household_members from public,anon,authenticated,service_role;

create function public.commerce_request_purchase_limit(
 p_offer uuid,p_campaign text,p_account integer,p_household integer,
 p_reason text,p_proof text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_offer public.commerce_offers%rowtype;v_campaign text:=upper(btrim(coalesce(p_campaign,'')));
begin
 perform private.commerce_assert_preview(p_proof);
 if not private.commerce_admin() then raise exception 'Admin required';end if;
 select * into v_offer from public.commerce_offers where id=p_offer for update;
 if v_offer.id is null or not v_offer.is_synthetic or v_offer.status<>'approved' then
  raise exception 'Approved synthetic offer required';end if;
 if v_campaign !~ '^[A-Z0-9_-]{3,64}$'
    or (p_account is null and p_household is null)
    or (p_account is not null and p_account not between 1 and 100)
    or (p_household is not null and p_household not between 1 and 100)
    or length(btrim(coalesce(p_reason,''))) not between 10 and 500 then
  raise exception 'Campaign, caps and evidence note are required';end if;
 if exists(select 1 from public.commerce_offer_purchase_limits where offer_id=p_offer and status='pending') then
  raise exception 'A purchase-limit request is already pending';end if;
 insert into public.commerce_offer_purchase_limits(
  offer_id,campaign_key,max_per_account,max_per_household,requested_by,reason)
 values(p_offer,v_campaign,p_account,p_household,auth.uid(),btrim(p_reason))
 returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'commerce_purchase_limit_requested','commerce_offer',p_offer,
  jsonb_build_object('rule_id',v_id,'campaign',v_campaign,'per_account',p_account,'per_household',p_household));
 return v_id;
end $$;
revoke all on function public.commerce_request_purchase_limit(uuid,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.commerce_request_purchase_limit(uuid,text,integer,integer,text,text) to authenticated;

create function public.commerce_review_purchase_limit(
 p_id uuid,p_approve boolean,p_note text,p_proof text
) returns text language plpgsql security definer set search_path='' as $$
declare v_rule public.commerce_offer_purchase_limits%rowtype;
begin
 perform private.commerce_assert_preview(p_proof);
 if not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required';end if;
 select * into v_rule from public.commerce_offer_purchase_limits where id=p_id for update;
 if v_rule.id is null or v_rule.status<>'pending' or
    v_rule.requested_by=auth.uid() or p_approve is null or
    length(btrim(coalesce(p_note,''))) not between 10 and 500 then
  raise exception 'Independent pending limit review with reason required';end if;
 if p_approve then
  perform id from public.commerce_offers where id=v_rule.offer_id and status='approved'
    and is_synthetic for update;
  if not found then raise exception 'Approved synthetic offer required';end if;
  -- Cannot change an approved campaign identity to evade order history.
  if exists(select 1 from public.commerce_offer_purchase_limits old
   where old.offer_id=v_rule.offer_id and old.status='approved'
     and old.campaign_key<>v_rule.campaign_key) then
   raise exception 'Changing the campaign key requires a new offer and independent review';end if;
  update public.commerce_offer_purchase_limits
   set status='superseded' where offer_id=v_rule.offer_id and status='approved';
 end if;
 update public.commerce_offer_purchase_limits
 set status=case when p_approve then 'approved' else 'rejected' end,
     reviewed_by=auth.uid(),review_note=btrim(p_note),reviewed_at=now()
 where id=p_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'commerce_purchase_limit_reviewed','commerce_offer',v_rule.offer_id,
   jsonb_build_object('rule_id',p_id,'approved',p_approve,'reason',p_note));
 return case when p_approve then 'approved' else 'rejected' end;
end $$;
revoke all on function public.commerce_review_purchase_limit(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.commerce_review_purchase_limit(uuid,boolean,text,text) to authenticated;

-- Background operational verification. Never infer a shared household from GPS.
create function public.commerce_verify_household_address(
 p_address uuid,p_evidence text,p_proof text
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.customer_delivery_addresses%rowtype;v_household uuid;v_unit text;
begin
 perform private.commerce_assert_preview(p_proof);
 if not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required';end if;
 if length(btrim(coalesce(p_evidence,''))) not between 10 and 500 then
  raise exception 'Independent household verification note required';end if;
 select * into a from public.customer_delivery_addresses
 where id=p_address and verification_status='operator_verified' and building_id is not null
 for update;
 if a.id is null or a.customer_id=auth.uid() or not exists(select 1 from public.delivery_buildings b where b.id=a.building_id and b.community_id=a.community_id and b.active and b.verified_at is not null) then raise exception 'Independently verified delivery address required';end if;
 if exists(select 1 from public.commerce_verified_household_members where customer_id=a.customer_id) then
  raise exception 'Account already assigned a verified household; independent correction required';end if;
 v_unit=lower(btrim(a.unit_label));
 if length(v_unit) not between 1 and 80 then raise exception 'Valid unit required';end if;
 insert into public.commerce_verified_households(community_id,building_id,unit_key)
 values(a.community_id,a.building_id,v_unit)
 on conflict(community_id,building_id,unit_key) do nothing;
 select id into v_household from public.commerce_verified_households
 where community_id=a.community_id and building_id=a.building_id and unit_key=v_unit for update;
 insert into public.commerce_verified_household_members(customer_id,household_id,verified_by,evidence_note)
 values(a.customer_id,v_household,auth.uid(),btrim(p_evidence));
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'commerce_household_verified','customer_delivery_address',a.id,
  jsonb_build_object('household_id',v_household,'customer_id',a.customer_id));
 return v_household;
end $$;
revoke all on function public.commerce_verify_household_address(uuid,text,text) from public,anon,authenticated;
grant execute on function public.commerce_verify_household_address(uuid,text,text) to authenticated;

-- Read-only staff dashboard: no public exposure of addresses, users or household membership.
create function public.commerce_purchase_limit_workbench()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.commerce_admin() and not private.has_role(auth.uid(),'super_admin') then
  raise exception 'Admin only';end if;
 return jsonb_build_object(
  'limits',coalesce((select jsonb_agg(jsonb_build_object(
   'id',l.id,'offer_id',l.offer_id,'campaign_key',l.campaign_key,
   'max_per_account',l.max_per_account,'max_per_household',l.max_per_household,
   'status',l.status,'reason',l.reason,'requested_by',l.requested_by))
   from public.commerce_offer_purchase_limits l where l.status in ('pending','approved')),'[]'::jsonb),
  'household_addresses',coalesce((select jsonb_agg(jsonb_build_object(
   'id',a.id,'community_id',a.community_id,'building_label',a.building_label,
   'unit_label',a.unit_label,'verified',a.verification_status))
   from public.customer_delivery_addresses a
   where a.verification_status='operator_verified' and a.building_id is not null
     and not exists(select 1 from public.commerce_verified_household_members m where m.customer_id=a.customer_id)),'[]'::jsonb)
 );
end $$;
revoke all on function public.commerce_purchase_limit_workbench() from public,anon,authenticated;
grant execute on function public.commerce_purchase_limit_workbench() to authenticated;

-- Effective rule = strictest active cap for the same SKU, community and campaign.
-- Purchased quantities remain counted even on cancellation/return (no automatic cap reset).
create function private.commerce_assert_purchase_limit(
 p_offer uuid,p_quantity integer,p_customer uuid,p_cart uuid default null,p_exclude_item uuid default null,
 p_include_cart boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare r record;v_used integer;v_cart_used integer;v_household uuid;v_account_used integer:=0;v_household_used integer:=0;
begin
 select o.sku_id,o.community_id,o.mode,l.campaign_key,
  (select min(z.max_per_account) from public.commerce_offer_purchase_limits z
   join public.commerce_offers zo on zo.id=z.offer_id
   where z.status='approved' and z.campaign_key=l.campaign_key
     and zo.sku_id=o.sku_id and zo.community_id=o.community_id) as account_cap,
  (select min(z.max_per_household) from public.commerce_offer_purchase_limits z
   join public.commerce_offers zo on zo.id=z.offer_id
   where z.status='approved' and z.campaign_key=l.campaign_key
     and zo.sku_id=o.sku_id and zo.community_id=o.community_id) as household_cap
 into r from public.commerce_offers o
 join public.commerce_offer_purchase_limits l on l.offer_id=o.id and l.status='approved'
 where o.id=p_offer;
 if not found then return;end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Positive quantity required';end if;
 if r.account_cap is not null and p_quantity>r.account_cap then
  raise exception 'Promotion limit: maximum % item(s) per account',r.account_cap;end if;
 if r.household_cap is not null and p_quantity>r.household_cap then
  raise exception 'Promotion limit: maximum % item(s) per verified household',r.household_cap;end if;
 if p_customer is not null then
  -- This function is always reached from privileged triggers, not direct user SQL.
  select coalesce(sum(i.quantity),0) into v_used
  from public.commerce_order_items i join public.commerce_orders ord on ord.id=i.order_id
  join public.commerce_offers o on o.id=i.offer_id
  join public.commerce_offer_purchase_limits l on l.offer_id=o.id and l.status='approved'
  where ord.customer_id=p_customer and o.sku_id=r.sku_id and o.community_id=r.community_id
    and l.campaign_key=r.campaign_key;
  v_account_used:=v_used;
  if r.account_cap is not null and v_used+p_quantity>r.account_cap then
   raise exception 'Promotion limit reached for this account (% item total)',r.account_cap;end if;
 end if;
 if r.household_cap is not null and p_customer is not null then
  select household_id into v_household from public.commerce_verified_household_members
  where customer_id=p_customer;
  if v_household is null then
   -- SOLO cart browse is non-binding; staff verification remains mandatory before quote.
   -- Pool/Group commitments must never count unverified households toward unlocks.
   if not (p_include_cart and r.mode='SOLO') then
    raise exception 'Verified household required for this limited offer';
   end if;
  else
   select coalesce(sum(i.quantity),0) into v_used
  from public.commerce_order_items i join public.commerce_orders ord on ord.id=i.order_id
  join public.commerce_verified_household_members m on m.customer_id=ord.customer_id
  join public.commerce_offers o on o.id=i.offer_id
  join public.commerce_offer_purchase_limits l on l.offer_id=o.id and l.status='approved'
  where m.household_id=v_household and o.sku_id=r.sku_id
   and o.community_id=r.community_id and l.campaign_key=r.campaign_key;
  v_household_used:=v_used;
  if v_used+p_quantity>r.household_cap then
    raise exception 'Promotion limit reached for this verified household (% item total)',r.household_cap;end if;
  end if;
 end if;
 if p_include_cart and p_cart is not null then
  select coalesce(sum(ci.quantity),0) into v_cart_used
  from public.commerce_cart_items ci
  join public.commerce_offers o on o.id=ci.offer_id
  join public.commerce_offer_purchase_limits l on l.offer_id=o.id and l.status='approved'
  where ci.cart_id=p_cart and ci.state in ('ready','waiting') and
   (p_exclude_item is null or ci.id<>p_exclude_item) and
   o.sku_id=r.sku_id and o.community_id=r.community_id and l.campaign_key=r.campaign_key;
  if r.account_cap is not null and v_account_used+v_cart_used+p_quantity>r.account_cap then
   raise exception 'Promotion cart limit: maximum % item(s) per account',r.account_cap;end if;
  if r.household_cap is not null and v_household_used+v_cart_used+p_quantity>r.household_cap then
   raise exception 'Promotion cart limit: maximum % item(s) per household',r.household_cap;end if;
 end if;
end $$;
revoke all on function private.commerce_assert_purchase_limit(uuid,integer,uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

-- Cart guard also covers guest sessions; upon login it additionally checks prior purchases.
create function private.commerce_cart_limit_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare v_customer uuid;r record;v_household uuid;v_committed integer;
begin
 if new.state not in ('ready','waiting') then return new;end if;
 select customer_id into v_customer from public.commerce_carts where id=new.cart_id;
 select o.sku_id,o.community_id,o.mode,l.campaign_key,l.max_per_household into r
 from public.commerce_offers o join public.commerce_offer_purchase_limits l on l.offer_id=o.id and l.status='approved'
 where o.id=new.offer_id;
 if found and r.mode<>'SOLO' and r.max_per_household is not null then
  perform pg_advisory_xact_lock(hashtextextended('commerce:promotion:'||r.sku_id||':'||r.community_id||':'||r.campaign_key,0));
  select household_id into v_household from public.commerce_verified_household_members where customer_id=coalesce(v_customer,auth.uid());
  select coalesce(sum(ci.quantity),0) into v_committed
  from public.commerce_cart_items ci join public.commerce_carts c on c.id=ci.cart_id
  join public.commerce_verified_household_members m on m.customer_id=c.customer_id
  join public.commerce_offers o on o.id=ci.offer_id
  join public.commerce_offer_purchase_limits l on l.offer_id=o.id and l.status='approved'
  where m.household_id=v_household and ci.cart_id<>new.cart_id and ci.state in ('ready','waiting')
   and o.mode<>'SOLO' and o.sku_id=r.sku_id and o.community_id=r.community_id and l.campaign_key=r.campaign_key;
  if v_committed+new.quantity>r.max_per_household then
   raise exception 'Promotion limit: verified household already committed to this campaign';end if;
 end if;
 perform private.commerce_assert_purchase_limit(
  new.offer_id,new.quantity,coalesce(v_customer,auth.uid()),new.cart_id,
  case when tg_op='UPDATE' then old.id else null end,true);
 return new;
end $$;
create trigger commerce_cart_limit_before before insert or update of offer_id,quantity,state,cart_id
 on public.commerce_cart_items for each row execute function private.commerce_cart_limit_guard();

-- Quote recheck handles old/open carts and cross-offer promotions even if rules changed.
create function private.commerce_quote_limit_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 for r in select l.campaign_key,o.sku_id,o.community_id,
    (array_agg(o.id order by o.id))[1] as offer_id,
    sum((line.value->>'quantity')::integer)::integer as requested
   from jsonb_array_elements(new.lines) line
   join public.commerce_offers o on o.id=(line.value->>'offer_id')::uuid
   join public.commerce_offer_purchase_limits l on l.offer_id=o.id and l.status='approved'
   group by l.campaign_key,o.sku_id,o.community_id
 loop
   perform private.commerce_assert_purchase_limit(r.offer_id,r.requested,new.customer_id);
 end loop;
 return new;
end $$;
create trigger commerce_quote_limit_before before insert on public.commerce_quotes
 for each row execute function private.commerce_quote_limit_guard();

-- Final atomic gate: every order line locks its campaign, preventing concurrent
-- duplicate checkouts from different accounts in the same verified household.
create function private.commerce_order_limit_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;v_customer uuid;
begin
 select l.campaign_key,o.sku_id,o.community_id into r
 from public.commerce_offer_purchase_limits l join public.commerce_offers o on o.id=l.offer_id
 where o.id=new.offer_id and l.status='approved';
 if not found then return new;end if;
 select customer_id into v_customer from public.commerce_orders where id=new.order_id;
 if v_customer is null or v_customer<>auth.uid() then raise exception 'Checkout owner required';end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'commerce:promotion:'||r.sku_id||':'||r.community_id||':'||r.campaign_key,0));
 perform private.commerce_assert_purchase_limit(new.offer_id,new.quantity,v_customer);
 return new;
end $$;
create trigger commerce_order_limit_before before insert on public.commerce_order_items
 for each row execute function private.commerce_order_limit_guard();
revoke all on function private.commerce_cart_limit_guard() from public,anon,authenticated,service_role;
revoke all on function private.commerce_quote_limit_guard() from public,anon,authenticated,service_role;
revoke all on function private.commerce_order_limit_guard() from public,anon,authenticated,service_role;

-- Public read-only offer copy: show buyer the independently approved promotion cap.
create or replace function public.commerce_catalog(p_include_synthetic boolean default false,p_community uuid default null,p_product uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x.row order by x.name,x.id),'[]') from (
 select o.id,p.name,jsonb_build_object('offer_id',o.id,'product_id',p.id,'sku_id',s.id,'sku',s.sku,'product_name',p.name,'category',p.category,'brand',p.brand,'package_size',p.package_size,'unit',p.unit,'image_url',p.image_url,
 'community_id',o.community_id,'community_name',c.name,'mode',o.mode,'supplier_id',o.supplier_id,'phase',st->>'phase','unit_price',st->'price','version',o.version,'valid_until',o.valid_until,'is_synthetic',o.is_synthetic,
 'pool_item_id',o.pool_item_id,'group_deal_id',o.group_deal_id,'allows_pickup',o.allows_pickup,'allows_delivery',o.allows_delivery,'reference_price',b.benchmark_price,
 'max_per_account',caps.account_cap,'max_per_household',caps.household_cap,
 'available_quantity',case when o.supplier_id is null then greatest(0,coalesce(i.stock_on_hand-i.reserved_quantity,0)) else greatest(0,ss.available_quantity-ss.reserved_quantity) end) row
 from public.commerce_offers o join public.commerce_skus s on s.id=o.sku_id join public.products p on p.id=s.product_id join public.communities c on c.id=o.community_id
 cross join lateral (select private.commerce_offer_state(o.id) as st) states
 left join public.own_product_inventory i on i.product_id=p.id left join public.commerce_supplier_stock ss on ss.id=o.supplier_stock_id
 left join public.market_price_benchmarks b on b.product_id=p.id and b.community_id=o.community_id and b.approved and b.superseded_at is null and b.effective_from<=current_date
 left join lateral (select min(m.max_per_account) account_cap,min(m.max_per_household) household_cap
  from public.commerce_offer_purchase_limits l join public.commerce_offer_purchase_limits m
  on m.campaign_key=l.campaign_key and m.status='approved'
  join public.commerce_offers co on co.id=m.offer_id and co.sku_id=o.sku_id and co.community_id=o.community_id
  where l.offer_id=o.id and l.status='approved') caps on true
 where st->>'phase'<>'unavailable' and (not o.is_synthetic or p_include_synthetic) and (p_community is null or o.community_id=p_community) and (p_product is null or p.id=p_product)
 order by p.name,o.id limit 200
 ) x;
$$;
