-- Issue #64. Canonical commerce. No existing accounts, roles, orders or Finance controls are reset.
create table private.commerce_configuration (
 singleton boolean primary key default true check(singleton),
 preview_secret_hash text,
 production_purchases_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into private.commerce_configuration(singleton) values(true);
alter table private.commerce_configuration enable row level security;
revoke all on private.commerce_configuration from public,anon,authenticated,service_role;

create table public.commerce_skus (
 id uuid primary key default gen_random_uuid(), product_id uuid not null unique references public.products(id),
 sku text not null unique, active boolean not null default true
);
insert into public.commerce_skus(product_id,sku,active) select id,sku,active from public.products;
create table public.commerce_supplier_stock (
 id uuid primary key default gen_random_uuid(), sku_id uuid not null references public.commerce_skus(id),
 supplier_id uuid not null references public.suppliers(id),
 available_quantity integer not null default 0 check(available_quantity>=0),
 reserved_quantity integer not null default 0 check(reserved_quantity>=0 and reserved_quantity<=available_quantity),
 verified_at timestamptz not null default now(), verified_by uuid not null references auth.users(id),
 unique(sku_id,supplier_id)
);
create table public.commerce_offers (
 id uuid primary key default gen_random_uuid(), sku_id uuid not null references public.commerce_skus(id),
 community_id uuid not null references public.communities(id),
 mode text not null check(mode in ('SOLO','POOL','GROUP_DEAL')),
 supplier_id uuid references public.suppliers(id), supplier_stock_id uuid references public.commerce_supplier_stock(id),
 pool_item_id uuid references public.pool_items(id), group_deal_id uuid references public.group_deals(id),
 unit_price numeric(16,2) not null check(unit_price>0),
 valid_until timestamptz not null, version integer not null default 1,
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 supplier_sla_minutes integer not null default 60 check(supplier_sla_minutes between 5 and 1440),
 allows_pickup boolean not null default true, allows_delivery boolean not null default true,
 is_synthetic boolean not null default true,
 requested_by uuid not null references auth.users(id), reviewed_by uuid references auth.users(id),
 review_note text, created_at timestamptz not null default now(),
 check(reviewed_by is null or reviewed_by<>requested_by),
 check((mode='POOL')=(pool_item_id is not null)),check((mode='GROUP_DEAL')=(group_deal_id is not null)),
 check((supplier_id is null)=(supplier_stock_id is null)), check(allows_pickup or allows_delivery)
);
create index commerce_offers_catalog_idx on public.commerce_offers(community_id,status,valid_until);
create table public.commerce_carts (
 id uuid primary key default gen_random_uuid(), customer_id uuid references auth.users(id),
 guest_hash text unique, revision integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(customer_id is not null or guest_hash is not null)
);
create unique index commerce_cart_customer_once on public.commerce_carts(customer_id) where customer_id is not null;
create table public.commerce_cart_items (
 id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.commerce_carts(id) on delete cascade,
 offer_id uuid not null references public.commerce_offers(id), quantity integer not null check(quantity between 1 and 100),
 state text not null default 'ready' check(state in ('ready','waiting','cancelled','expired','ordered')),
 commitment_id uuid references public.commitments(id), group_commitment_id uuid references public.group_deal_commitments(id),
 created_at timestamptz not null default now(),
 check(not(commitment_id is not null and group_commitment_id is not null))
);
create unique index commerce_cart_active_offer_once on public.commerce_cart_items(cart_id,offer_id) where state<>'ordered';
create table public.commerce_quotes (
 id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.commerce_carts(id),
 customer_id uuid not null references auth.users(id), revision integer not null,
 community_id uuid not null references public.communities(id),
 fulfillment_method text not null check(fulfillment_method in ('pickup','home_delivery')),
 pickup_point_id uuid references public.pickup_points(id), delivery_address text,
 lines jsonb not null, product_subtotal numeric(16,2) not null check(product_subtotal>0),
 delivery_fee numeric(16,2) not null check(delivery_fee>=0), total_amount numeric(16,2) not null,
 expires_at timestamptz not null default now()+interval '10 minutes', created_at timestamptz not null default now(),
 check(total_amount=product_subtotal+delivery_fee)
);
create table public.commerce_checkouts (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references auth.users(id),
 quote_id uuid not null unique references public.commerce_quotes(id), idempotency_key uuid not null,
 created_at timestamptz not null default now(), unique(customer_id,idempotency_key)
);
create table public.commerce_orders (
 id uuid primary key default gen_random_uuid(), order_code text not null unique default '2T-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
 checkout_id uuid not null references public.commerce_checkouts(id), customer_id uuid not null references auth.users(id),
 community_id uuid not null references public.communities(id), supplier_id uuid references public.suppliers(id),
 mode text not null check(mode in ('SOLO','POOL','GROUP_DEAL')),
 status text not null check(status in ('awaiting_supplier','confirmed','preparing','out_for_delivery','ready_for_pickup','completed','cancelled')),
 product_subtotal numeric(16,2) not null, delivery_fee numeric(16,2) not null, total_amount numeric(16,2) not null,
 payment_method text not null default 'COD' check(payment_method in ('COD','MANUAL_VERIFIED')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','custody_recorded','verified','refund_pending','refunded')),
 fulfillment_method text not null, pickup_point_id uuid references public.pickup_points(id), delivery_address text,
 supplier_deadline timestamptz, accepted_by uuid references auth.users(id),
 completed_at timestamptz, delivery_actual_cost numeric(16,2), cancellation_reason text,
 is_synthetic boolean not null default true, created_at timestamptz not null default now(),
 check(total_amount=product_subtotal+delivery_fee),check(product_subtotal>0 and delivery_fee>=0),
 unique(checkout_id,supplier_id,mode)
);
create index commerce_orders_customer_idx on public.commerce_orders(customer_id,created_at desc);
create index commerce_orders_supplier_idx on public.commerce_orders(supplier_id,status);
create index commerce_orders_community_idx on public.commerce_orders(community_id,status);
create table public.commerce_order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.commerce_orders(id),
 offer_id uuid not null references public.commerce_offers(id), sku_id uuid not null references public.commerce_skus(id),
 product_id uuid not null references public.products(id), quantity integer not null check(quantity>0),
 unit_price numeric(16,2) not null check(unit_price>0), reference_price numeric(16,2), offer_version integer not null,
 name_snapshot text not null, sku_snapshot text not null,
 cart_item_id uuid not null unique references public.commerce_cart_items(id),
 commitment_id uuid unique references public.commitments(id), group_commitment_id uuid unique references public.group_deal_commitments(id),
 reserved boolean not null default true, fulfilled boolean not null default false,
 unique(order_id,offer_id)
);
create index commerce_order_items_order_idx on public.commerce_order_items(order_id);
create table public.commerce_order_events (
 id bigint generated always as identity primary key, order_id uuid not null references public.commerce_orders(id),
 kind text not null, actor_id uuid references auth.users(id), note text not null,
 created_at timestamptz not null default now()
);
create index commerce_order_events_order_idx on public.commerce_order_events(order_id,id);
create table public.commerce_requests (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.commerce_orders(id),
 customer_id uuid not null references auth.users(id), kind text not null check(kind in ('cancel','return','refund')),
 reason text not null check(length(reason) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','received','finance_requested','completed')),
 requested_by uuid not null references auth.users(id), reviewed_by uuid references auth.users(id),
 review_note text, restock boolean not null default false, created_at timestamptz not null default now(),
 check(reviewed_by is null or reviewed_by<>requested_by)
);
create unique index commerce_request_open_once on public.commerce_requests(order_id,kind) where status not in ('rejected','completed');
create table public.commerce_cod_receipts (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.commerce_orders(id),
 product_amount numeric(16,2) not null, delivery_amount numeric(16,2) not null,
 reference text not null unique, evidence_path text not null, evidence_sha256 text not null,
 recorded_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 status text not null default 'custody' check(status in ('custody','finance_requested','verified')),
 check(product_amount>=0 and delivery_amount>=0),check(evidence_sha256 ~ '^[a-f0-9]{64}$')
);
-- No direct access: all reads/writes go through scoped projections and validated RPCs.
do $$ declare t text;begin
 foreach t in array array['commerce_skus','commerce_supplier_stock','commerce_offers','commerce_carts','commerce_cart_items','commerce_quotes','commerce_checkouts','commerce_orders','commerce_order_items','commerce_order_events','commerce_requests','commerce_cod_receipts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
create function private.commerce_admin() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin')); $$;
create function private.commerce_supplier(p_supplier uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.supplier_memberships sm join public.suppliers su on su.id=sm.supplier_id where sm.supplier_id=p_supplier and sm.user_id=auth.uid() and sm.active and su.active and su.reliability_status<>'blocked' and sm.role in ('owner','manager')); $$;
create function private.commerce_operator(p_community uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.community_ops_assignments where user_id=auth.uid() and community_id=p_community and active); $$;
create function private.commerce_assert_preview(p_proof text) returns void language plpgsql stable security definer set search_path='' as $$ begin
 if p_proof is null or length(p_proof)<32 or not exists(select 1 from private.commerce_configuration where preview_secret_hash=encode(extensions.digest(p_proof,'sha256'),'hex')) then raise exception using errcode='42501',message='Commerce purchases are disabled outside authorized synthetic Preview';end if;
end $$;
create function private.commerce_event(p_order uuid,p_kind text,p_note text) returns void language plpgsql security definer set search_path='' as $$ declare u uuid;begin
 insert into public.commerce_order_events(order_id,kind,actor_id,note) values(p_order,p_kind,auth.uid(),p_note);
 select customer_id into u from public.commerce_orders where id=p_order;
 insert into public.notifications(user_id,kind,title,body,href,dedupe_key)
 values(u,'commerce',replace(p_kind,'_',' '),p_note,'/account/orders/'||p_order,'commerce:'||p_order||':'||p_kind||':'||md5(p_note)) on conflict(user_id,dedupe_key) do nothing;
end $$;
create function private.commerce_offer_state(p_offer uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.commerce_offers%rowtype;pi public.pool_items%rowtype;po public.pools%rowtype;g public.group_deals%rowtype;v_price numeric;
begin
 select * into o from public.commerce_offers where id=p_offer;
 if not found or o.status<>'approved' or o.valid_until<=now() or not exists(select 1 from public.commerce_skus s join public.products p on p.id=s.product_id join public.communities c on c.id=o.community_id where s.id=o.sku_id and s.active and p.active and not p.is_demo and c.active) then return jsonb_build_object('phase','unavailable','price',null);end if;
 if o.supplier_id is not null and not exists(select 1 from public.suppliers s join public.supplier_products sp on sp.supplier_id=s.id join public.commerce_skus sk on sk.product_id=sp.product_id where s.id=o.supplier_id and s.active and s.reliability_status<>'blocked' and sp.active and sk.id=o.sku_id) then return jsonb_build_object('phase','unavailable','price',null);end if;
 if o.mode='SOLO' then if o.supplier_id is null and not exists(select 1 from public.own_product_costs c join public.commerce_skus s on s.product_id=c.product_id where s.id=o.sku_id and c.total_landed_cost>0 and o.unit_price>=c.total_landed_cost) then return jsonb_build_object('phase','unavailable','price',null);end if;return jsonb_build_object('phase','ready','price',o.unit_price);end if;
 if o.mode='POOL' then
 select * into pi from public.pool_items where id=o.pool_item_id and active;
 select * into po from public.pools where id=pi.pool_id;
 if pi.id is null or po.is_paused or po.community_id<>o.community_id or po.status in ('draft','cancelled','completed') then return jsonb_build_object('phase','unavailable','price',null);end if;
 if po.status in ('final_price','confirmation') and po.confirmation_closes_at>now() and pi.final_customer_price>0 then return jsonb_build_object('phase','ready','price',pi.final_customer_price);end if;
 if po.status='open' and po.commitment_closes_at>now() then return jsonb_build_object('phase','waiting','price',pi.expected_pool_price);end if;
 else
 if not exists(select 1 from public.group_deal_communities where group_deal_id=o.group_deal_id and community_id=o.community_id) then return jsonb_build_object('phase','unavailable','price',null);end if;
 select * into g from public.group_deals where id=o.group_deal_id;
 if g.status in ('locked','procurement','fulfilling') and g.locked_unit_price>0 and g.pickup_at>now() then return jsonb_build_object('phase','ready','price',g.locked_unit_price);end if;
 if g.status='open' and now() between g.opens_at and g.closes_at then return jsonb_build_object('phase','waiting','price',private.group_deal_price(g.id,(select count(distinct customer_id) from public.group_deal_commitments where group_deal_id=g.id and status='qualified')));end if;
 end if;
 return jsonb_build_object('phase','unavailable','price',null);
end $$;
create function public.commerce_catalog(p_include_synthetic boolean default false,p_community uuid default null,p_product uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x.row order by x.name,x.id),'[]') from (
 select o.id,p.name,jsonb_build_object('offer_id',o.id,'product_id',p.id,'sku_id',s.id,'sku',s.sku,'product_name',p.name,'category',p.category,'brand',p.brand,'package_size',p.package_size,'unit',p.unit,'image_url',p.image_url,
 'community_id',o.community_id,'community_name',c.name,'mode',o.mode,'supplier_id',o.supplier_id,'phase',st->>'phase','unit_price',st->'price','version',o.version,'valid_until',o.valid_until,'is_synthetic',o.is_synthetic,
 'allows_pickup',o.allows_pickup,'allows_delivery',o.allows_delivery,'reference_price',b.benchmark_price,
 'available_quantity',case when o.supplier_id is null then greatest(0,coalesce(i.stock_on_hand-i.reserved_quantity,0)) else greatest(0,ss.available_quantity-ss.reserved_quantity) end) row
 from public.commerce_offers o join public.commerce_skus s on s.id=o.sku_id join public.products p on p.id=s.product_id join public.communities c on c.id=o.community_id
 cross join lateral (select private.commerce_offer_state(o.id) as st) states
 left join public.own_product_inventory i on i.product_id=p.id left join public.commerce_supplier_stock ss on ss.id=o.supplier_stock_id
 left join public.market_price_benchmarks b on b.product_id=p.id and b.community_id=o.community_id and b.approved and b.superseded_at is null and b.effective_from<=current_date
 where st->>'phase'<>'unavailable' and (not o.is_synthetic or p_include_synthetic) and (p_community is null or o.community_id=p_community) and (p_product is null or p.id=p_product)
 order by p.name,o.id limit 200
 ) x;
$$;
create function private.commerce_cart(p_guest text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_guest uuid;v_hash text;u uuid:=auth.uid();r record;
begin
 if p_guest is not null and p_guest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid guest cart session';end if;
 v_hash=case when p_guest is null then null else encode(extensions.digest(p_guest,'sha256'),'hex') end;
 if u is not null then
 perform pg_advisory_xact_lock(hashtextextended('commerce:cart:'||u,0));
 insert into public.commerce_carts(customer_id) values(u) on conflict(customer_id) where customer_id is not null do nothing;
 select id into v_id from public.commerce_carts where customer_id=u for update;
 if v_hash is not null then
 select id into v_guest from public.commerce_carts where guest_hash=v_hash and customer_id is null for update;
 if v_guest is not null then
 for r in select * from public.commerce_cart_items where cart_id=v_guest and state='ready' order by offer_id loop
 if (private.commerce_offer_state(r.offer_id)->>'phase')<>'unavailable' then
 insert into public.commerce_cart_items(cart_id,offer_id,quantity,state) values(v_id,r.offer_id,r.quantity,'ready') on conflict(cart_id,offer_id) where state<>'ordered' do update set quantity=case when public.commerce_cart_items.state='ready' then least(100,public.commerce_cart_items.quantity+excluded.quantity) else excluded.quantity end,state='ready' where public.commerce_cart_items.state in ('ready','expired','cancelled');
 end if;
 end loop;
 delete from public.commerce_carts where id=v_guest;
 update public.commerce_carts set revision=revision+1,updated_at=now() where id=v_id;
 end if;end if;
 else
 if v_hash is null then raise exception 'Guest cart session required';end if;
 insert into public.commerce_carts(guest_hash) values(v_hash) on conflict(guest_hash) do nothing;
 select id into v_id from public.commerce_carts where guest_hash=v_hash and customer_id is null for update;
 end if;
 if v_id is null then raise exception 'Cart not accessible';end if;
 return v_id;
end $$;
create function public.commerce_get_cart(p_guest text default null,p_proof text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid;v_rows jsonb;
begin
 perform private.commerce_assert_preview(p_proof);
 c=private.commerce_cart(p_guest);
 perform private.commerce_refresh_cart(c);
 select coalesce(jsonb_agg(jsonb_build_object('item_id',ci.id,'offer_id',o.id,'product_id',p.id,'name',p.name,'image_url',p.image_url,'quantity',ci.quantity,'mode',o.mode,'state',ci.state,'phase',states.st->>'phase','unit_price',states.st->'price','community_id',o.community_id,'community_name',co.name,'is_synthetic',o.is_synthetic) order by ci.created_at),'[]') into v_rows
 from public.commerce_cart_items ci join public.commerce_offers o on o.id=ci.offer_id join public.commerce_skus sk on sk.id=o.sku_id join public.products p on p.id=sk.product_id join public.communities co on co.id=o.community_id cross join lateral (select private.commerce_offer_state(o.id) as st) states where ci.cart_id=c and ci.state not in ('ordered','cancelled');
 return jsonb_build_object('cart_id',c,'revision',(select revision from public.commerce_carts where id=c),'authenticated',auth.uid() is not null,'items',v_rows);
end $$;
create function public.commerce_set_cart_item(p_guest text,p_offer uuid,p_quantity integer,p_proof text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid;o public.commerce_offers%rowtype;st jsonb;v_commit uuid;v_group uuid;v_result record;v_state text;
begin
 perform private.commerce_assert_preview(p_proof);
 if p_quantity is null or p_quantity not between 0 and 100 then raise exception 'Quantity must be between zero and 100';end if;
 c=private.commerce_cart(p_guest);
 select * into o from public.commerce_offers where id=p_offer for share;
 if not found or not o.is_synthetic then raise exception 'Only authorized synthetic Preview offers may be changed';end if;
 if p_quantity=0 then
 
 select commitment_id,group_commitment_id into v_commit,v_group from public.commerce_cart_items where cart_id=c and offer_id=p_offer and state<>'ordered';
 if v_group is not null then perform public.leave_group_deal(o.group_deal_id);end if;
 if v_commit is not null then update public.commitments set status='withdrawn' where id=v_commit and customer_id=auth.uid() and status='active';end if;
 update public.commerce_cart_items set state='cancelled' where cart_id=c and offer_id=p_offer and state<>'ordered';
 else
 st=private.commerce_offer_state(p_offer);
 if st->>'phase'='unavailable' then raise exception 'Offer expired or unavailable';end if;
 v_state='ready';
 if o.mode<>'SOLO' then
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and community_id=o.community_id and phone is not null and full_name is not null and household_name is not null and onboarding_completed_at is not null) then raise exception 'Sign in and verify the matching community before joining';end if;
 if o.mode='POOL' then
 if st->>'phase'='waiting' then perform public.commit_to_pool(o.pool_item_id,p_quantity);end if;
 select id into v_commit from public.commitments where pool_item_id=o.pool_item_id and customer_id=auth.uid() and status='active' and quantity=p_quantity;
 if v_commit is null then raise exception 'Existing matching Pool commitment required after price lock';end if;
 else
 if st->>'phase'='waiting' then
 select * into v_result from public.join_group_deal(o.group_deal_id,p_quantity);
 if not v_result.accepted then return jsonb_build_object('error',v_result.message);end if;end if;
 select id into v_group from public.group_deal_commitments where group_deal_id=o.group_deal_id and customer_id=auth.uid() and status in ('forming','qualified') and quantity=p_quantity;
 if v_group is null then raise exception 'Existing qualified Group commitment required';end if;
 end if;
 v_state=case when st->>'phase'='ready' then 'ready' else 'waiting' end;
 end if;
 insert into public.commerce_cart_items(cart_id,offer_id,quantity,state,commitment_id,group_commitment_id) values(c,p_offer,p_quantity,v_state,v_commit,v_group)
 on conflict(cart_id,offer_id) where state<>'ordered' do update set quantity=excluded.quantity,state=excluded.state,commitment_id=excluded.commitment_id,group_commitment_id=excluded.group_commitment_id where public.commerce_cart_items.state<>'ordered';
 if not found then raise exception 'Existing order must be cancelled before replacing its cart entry';end if;
 end if;
 update public.commerce_carts set revision=revision+1,updated_at=now() where id=c;
 return public.commerce_get_cart(p_guest,p_proof);
end $$;
create function public.commerce_create_quote(p_guest text,p_method text,p_pickup uuid,p_address text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c uuid;u uuid:=auth.uid();v_community uuid;v_lines jsonb:='[]';r record;st jsonb;v_price numeric;v_sub numeric:=0;v_delivery numeric;v_quote public.commerce_quotes%rowtype;v_reference numeric;
begin
 perform private.commerce_assert_preview(p_proof);
 if u is null then raise exception 'Sign in to checkout';end if;
 select community_id into v_community from public.profiles where id=u and phone is not null and full_name is not null and household_name is not null and onboarding_completed_at is not null;
 if v_community is null then raise exception 'Complete your household and community first';end if;
 perform public.commerce_get_cart(p_guest,p_proof); c=private.commerce_cart(p_guest);
 if p_method not in ('pickup','home_delivery') or p_method is null then raise exception 'Choose pickup or delivery';end if;
 if p_method='pickup' and not exists(select 1 from public.pickup_points where id=p_pickup and community_id=v_community and active) then raise exception 'Active community pickup point required';end if;
 if p_method='home_delivery' and length(btrim(coalesce(p_address,''))) not between 10 and 500 then raise exception 'Complete delivery address required';end if;
 for r in select ci.id as item_id,ci.quantity,ci.commitment_id,ci.group_commitment_id,o.*,s.product_id,s.sku,p.name from public.commerce_cart_items ci join public.commerce_offers o on o.id=ci.offer_id join public.commerce_skus s on s.id=o.sku_id join public.products p on p.id=s.product_id where ci.cart_id=c and ci.state='ready' order by o.sku_id,o.id loop
 if r.community_id<>v_community then raise exception 'Cart has an item outside your verified community';end if;
 if not r.is_synthetic then raise exception 'Production purchases remain disabled';end if;
 if (p_method='pickup' and not r.allows_pickup) or (p_method='home_delivery' and not r.allows_delivery) then raise exception 'Chosen fulfillment is not available for every item';end if;
 st=private.commerce_offer_state(r.id);v_price=(st->>'price')::numeric;
 if st->>'phase'<>'ready' or v_price is null or v_price<=0 then raise exception 'Waiting commitments cannot be charged';end if;
 if r.mode='POOL' and not exists(select 1 from public.commitments where id=r.commitment_id and customer_id=u and status='active' and quantity=r.quantity) then raise exception 'Pool commitment is no longer eligible';end if;
 if r.mode='GROUP_DEAL' and not exists(select 1 from public.group_deal_commitments where id=r.group_commitment_id and customer_id=u and status='qualified' and quantity=r.quantity) then raise exception 'Group commitment is no longer eligible';end if;
 select benchmark_price into v_reference from public.market_price_benchmarks where product_id=r.product_id and community_id=v_community and approved and superseded_at is null and effective_from<=current_date;
 v_lines=v_lines||jsonb_build_array(jsonb_build_object('item_id',r.item_id,'offer_id',r.id,'sku_id',r.sku_id,'product_id',r.product_id,'name',r.name,'sku',r.sku,'quantity',r.quantity,'unit_price',v_price,'reference_price',v_reference,'version',r.version,'supplier_id',r.supplier_id,'mode',r.mode,'commitment_id',r.commitment_id,'group_commitment_id',r.group_commitment_id));
 v_sub=v_sub+v_price*r.quantity;
 end loop;
 if jsonb_array_length(v_lines)=0 then raise exception 'No payable items; waiting commitments remain separate';end if;
 v_delivery=case when p_method='pickup' then 0 when v_sub<=1000 then 20 else 30 end;
 insert into public.commerce_quotes(cart_id,customer_id,revision,community_id,fulfillment_method,pickup_point_id,delivery_address,lines,product_subtotal,delivery_fee,total_amount)
 values(c,u,(select revision from public.commerce_carts where id=c),v_community,p_method,case when p_method='pickup' then p_pickup else null end,case when p_method='home_delivery' then btrim(p_address) else null end,v_lines,v_sub,v_delivery,v_sub+v_delivery) returning * into v_quote;
 return to_jsonb(v_quote)-'customer_id';
end $$;
create function private.commerce_reserve(p_offer uuid,p_quantity integer) returns void language plpgsql security definer set search_path='' as $$
declare o public.commerce_offers%rowtype;v_product uuid;v_available integer;
begin
 select * into o from public.commerce_offers where id=p_offer for share;
 select product_id into v_product from public.commerce_skus where id=o.sku_id;
 if o.supplier_id is null then
 select stock_on_hand-reserved_quantity into v_available from public.own_product_inventory where product_id=v_product for update;
 if v_available is null or v_available<p_quantity then raise exception 'Item sold out or insufficient stock';end if;
 update public.own_product_inventory set reserved_quantity=reserved_quantity+p_quantity,updated_at=now() where product_id=v_product;
 else
 select available_quantity-reserved_quantity into v_available from public.commerce_supplier_stock where id=o.supplier_stock_id and verified_at>now()-interval '1 day' for update;
 if v_available is null or v_available<p_quantity then raise exception 'Supplier availability is stale or insufficient';end if;
 update public.commerce_supplier_stock set reserved_quantity=reserved_quantity+p_quantity where id=o.supplier_stock_id;
 end if;
end $$;
create function public.commerce_confirm_checkout(p_quote uuid,p_key uuid,p_policy text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.commerce_quotes%rowtype;c public.commerce_checkouts%rowtype;o public.commerce_offers%rowtype;line jsonb;grp record;st jsonb;v_order uuid;v_ids jsonb:='[]';v_fee numeric;v_allocated numeric:=0;v_remaining integer;v_revision integer;
begin
 perform private.commerce_assert_preview(p_proof);
 if auth.uid() is null or p_key is null or p_policy is distinct from '2026-10-05' then raise exception 'Sign in and explicitly accept current policies';end if;
 perform pg_advisory_xact_lock(hashtextextended('commerce:checkout:'||auth.uid(),0));
 select * into c from public.commerce_checkouts where customer_id=auth.uid() and idempotency_key=p_key;
 if found then
 if c.quote_id<>p_quote then raise exception 'Idempotency key reused for another checkout';end if;
 return (select jsonb_agg(id order by id) from public.commerce_orders where checkout_id=c.id);
 end if;
 select * into q from public.commerce_quotes where id=p_quote and customer_id=auth.uid() for update;
 if not found then raise exception 'Quote not accessible';end if;
 select * into c from public.commerce_checkouts where quote_id=q.id;
 if found then return (select jsonb_agg(id order by id) from public.commerce_orders where checkout_id=c.id);end if;
 select revision into v_revision from public.commerce_carts where id=q.cart_id and customer_id=auth.uid() for update;
 if v_revision is null or q.expires_at<=now() or v_revision<>q.revision then raise exception 'Quote expired or cart changed; review a fresh quote';end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and community_id=q.community_id and phone is not null and full_name is not null and household_name is not null and onboarding_completed_at is not null) then raise exception 'Verified community changed';end if;
 for line in select value from jsonb_array_elements(q.lines) order by value->>'sku_id',value->>'offer_id' loop
 select * into o from public.commerce_offers where id=(line->>'offer_id')::uuid for share;
 if o.mode='POOL' then perform pi.id from public.pool_items pi join public.pools po on po.id=pi.pool_id where pi.id=o.pool_item_id for share of pi,po;
 elsif o.mode='GROUP_DEAL' then perform id from public.group_deals where id=o.group_deal_id for share;end if;
 st=private.commerce_offer_state(o.id);
 if not o.is_synthetic or o.version<>(line->>'version')::integer or st->>'phase'<>'ready' or (st->>'price')::numeric is distinct from (line->>'unit_price')::numeric then raise exception 'Price or offer changed; review a fresh quote';end if;
 if not exists(select 1 from public.commerce_cart_items where id=(line->>'item_id')::uuid and cart_id=q.cart_id and state='ready' and quantity=(line->>'quantity')::integer) then raise exception 'Cart item changed';end if;
 if line->>'commitment_id' is not null then
 perform id from public.commitments where id=(line->>'commitment_id')::uuid and customer_id=auth.uid() and status='active' for update;
 if not found then raise exception 'Pool commitment no longer payable';end if;
 if exists(select 1 from public.order_items oi join public.orders ord on ord.id=oi.order_id join public.commitments co on co.pool_item_id=oi.pool_item_id and co.customer_id=ord.customer_id where co.id=(line->>'commitment_id')::uuid and ord.status<>'cancelled') then raise exception 'Pool commitment already checked out';end if;
 end if;
 if line->>'group_commitment_id' is not null then
 perform id from public.group_deal_commitments where id=(line->>'group_commitment_id')::uuid and customer_id=auth.uid() and status='qualified' for update;
 if not found then raise exception 'Group commitment no longer payable';end if;
 end if;
 perform private.commerce_reserve(o.id,(line->>'quantity')::integer);
 end loop;
 insert into public.commerce_checkouts(customer_id,quote_id,idempotency_key) values(auth.uid(),q.id,p_key) returning * into c;
 select count(*) into v_remaining from (select distinct value->>'supplier_id',value->>'mode' from jsonb_array_elements(q.lines)) groups;
 for grp in select value->>'supplier_id' supplier_id,value->>'mode' mode,sum((value->>'quantity')::integer*(value->>'unit_price')::numeric) subtotal from jsonb_array_elements(q.lines) group by value->>'supplier_id',value->>'mode' order by value->>'supplier_id' nulls first,value->>'mode' loop
 v_remaining=v_remaining-1;
 v_fee=case when v_remaining=0 then q.delivery_fee-v_allocated else round(q.delivery_fee*grp.subtotal/q.product_subtotal,2) end;v_allocated=v_allocated+v_fee;
 insert into public.commerce_orders(checkout_id,customer_id,community_id,supplier_id,mode,status,product_subtotal,delivery_fee,total_amount,fulfillment_method,pickup_point_id,delivery_address,supplier_deadline)
 values(c.id,auth.uid(),q.community_id,grp.supplier_id::uuid,grp.mode,case when grp.supplier_id is null then 'confirmed' else 'awaiting_supplier' end,grp.subtotal,v_fee,grp.subtotal+v_fee,q.fulfillment_method,q.pickup_point_id,q.delivery_address,
 case when grp.supplier_id is null then null else now()+make_interval(mins => coalesce((select min(supplier_sla_minutes) from public.commerce_offers where supplier_id=grp.supplier_id::uuid and id in(select (x->>'offer_id')::uuid from jsonb_array_elements(q.lines) x)),60)) end) returning id into v_order;
 for line in select value from jsonb_array_elements(q.lines) where (value->>'supplier_id') is not distinct from grp.supplier_id and value->>'mode'=grp.mode loop
 insert into public.commerce_order_items(order_id,offer_id,sku_id,product_id,quantity,unit_price,reference_price,offer_version,cart_item_id,commitment_id,group_commitment_id,name_snapshot,sku_snapshot)
 values(v_order,(line->>'offer_id')::uuid,(line->>'sku_id')::uuid,(line->>'product_id')::uuid,(line->>'quantity')::integer,(line->>'unit_price')::numeric,(line->>'reference_price')::numeric,(line->>'version')::integer,(line->>'item_id')::uuid,(line->>'commitment_id')::uuid,(line->>'group_commitment_id')::uuid,line->>'name',line->>'sku');
 update public.commerce_cart_items set state='ordered' where id=(line->>'item_id')::uuid;
 if line->>'commitment_id' is not null then update public.commitments set status='confirmed',confirmed_at=now() where id=(line->>'commitment_id')::uuid;end if;
 end loop;
 perform private.commerce_event(v_order,case when grp.supplier_id is null then 'confirmed' else 'awaiting_supplier' end,'Order recorded with server-verified totals. COD is unpaid; supplier orders await acceptance.');
 v_ids=v_ids||jsonb_build_array(v_order);
 end loop;
 update public.commerce_carts set revision=revision+1,updated_at=now() where id=q.cart_id;
 return v_ids;
end $$;
create function private.commerce_release_order(p_order uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
 for r in select i.*,o.supplier_stock_id,o.supplier_id from public.commerce_order_items i join public.commerce_offers o on o.id=i.offer_id where i.order_id=p_order and i.reserved and not i.fulfilled order by i.sku_id,i.offer_id for update of i loop
 if r.supplier_id is null then update public.own_product_inventory set reserved_quantity=reserved_quantity-r.quantity,updated_at=now() where product_id=r.product_id and reserved_quantity>=r.quantity;
 else update public.commerce_supplier_stock set reserved_quantity=reserved_quantity-r.quantity where id=r.supplier_stock_id and reserved_quantity>=r.quantity;end if;
 if not found then raise exception 'Reservation reconciliation required';end if;
 update public.commerce_order_items set reserved=false where id=r.id;
 if r.commitment_id is not null then update public.commitments set status='cancelled' where id=r.commitment_id;end if;
 if r.group_commitment_id is not null then update public.group_deal_commitments set status='cancelled' where id=r.group_commitment_id;end if;
 end loop;
 update public.commerce_orders set status='cancelled',cancellation_reason=p_reason where id=p_order;
 perform private.commerce_event(p_order,'cancelled',p_reason||' No verified payment was recorded.');
end $$;
create function public.commerce_expire(p_proof text) returns integer language plpgsql security definer set search_path='' as $$ declare r record;n integer:=0;begin
 perform private.commerce_assert_preview(p_proof);
 if not private.commerce_admin() then raise exception 'Admin required';end if;
 for r in select id from public.commerce_orders where status='awaiting_supplier' and supplier_deadline<=now() order by id for update skip locked loop
 perform private.commerce_release_order(r.id,'Supplier acceptance deadline expired');n=n+1;
 end loop;
 update public.commerce_cart_items ci set state='expired' where state='waiting' and private.commerce_offer_state(ci.offer_id)->>'phase'='unavailable';
 return n;
end $$;
-- Private helpers are never client-callable. Explicit API grants, no anonymous purchase RPCs.
do $$declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname like 'commerce_%' loop
 execute 'revoke all on function '||r.signature||' from public,anon,authenticated,service_role';
 end loop;
end $$;
grant execute on function public.commerce_catalog(boolean,uuid,uuid),public.commerce_get_cart(text,text),public.commerce_set_cart_item(text,uuid,integer,text) to anon,authenticated;
grant execute on function public.commerce_create_quote(text,text,uuid,text,text),public.commerce_confirm_checkout(uuid,uuid,text,text),public.commerce_expire(text) to authenticated;
