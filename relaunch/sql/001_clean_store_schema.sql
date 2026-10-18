-- 2TBR Clean Relaunch v2. ISOLATED REVIEW ARTIFACT.
-- Deliberately NOT placed in supabase/migrations: DO NOT apply to hosted
-- Production before new system qualification, backup and cutover approval.
-- Depends only on Supabase auth.users; old business/Finance tables untouched.
begin;

create table public.store_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'customer'
    check (role in ('customer','admin','super_admin')),
  name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check(length(btrim(sku)) between 2 and 80),
  title text not null check(length(btrim(title)) between 2 and 180),
  title_bn text not null default '',
  description text not null default '',
  unit text not null check(unit in ('pcs','pack','kg','liter')),
  image_url text,
  regular_price numeric(12,2) not null check(regular_price>0),
  on_hand numeric(12,3) not null default 0 check(on_hand>=0),
  reserved numeric(12,3) not null default 0 check(reserved>=0 and reserved<=on_hand),
  status text not null default 'draft' check(status in ('draft','live','archived')),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.store_offers (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(btrim(title)) between 2 and 160),
  kind text not null check(kind in ('offer','group_deal','pool')),
  description text not null default '',
  min_households integer not null default 1 check(min_households between 1 and 10000),
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  status text not null default 'draft' check(status in ('draft','live','closed')),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check(closes_at is null or closes_at>opens_at),
  check(kind<>'offer' or min_households=1)
);

create table public.store_offer_items (
  offer_id uuid not null references public.store_offers(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete restrict,
  offer_price numeric(12,2) not null check(offer_price>0),
  primary key(offer_id,product_id)
);

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default (
    '2TBR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  customer_id uuid not null references auth.users(id) on delete restrict,
  request_key uuid not null,
  offer_id uuid references public.store_offers(id) on delete restrict,
  customer_name text not null check(length(btrim(customer_name)) between 2 and 120),
  customer_phone text not null check(length(btrim(customer_phone)) between 10 and 22),
  fulfillment_method text not null check(fulfillment_method in ('pickup','home_delivery')),
  delivery_address text,
  status text not null default 'placed' check(status in
    ('placed','confirmed','preparing','ready_for_pickup','out_for_delivery',
     'handed_over','completed','cancelled')),
  payment_status text not null default 'unpaid' check(payment_status in
    ('unpaid','collected_pending_verification','verified')),
  total_amount numeric(12,2) not null default 0 check(total_amount>=0),
  delivery_fee numeric(12,2) not null default 0 check(delivery_fee>=0),
  staff_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handed_over_at timestamptz,
  completed_at timestamptz,
  unique(customer_id,request_key),
  check(fulfillment_method='pickup' or
        (delivery_address is not null and length(btrim(delivery_address)) between 10 and 350))
);

create table public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete restrict,
  product_id uuid not null references public.store_products(id) on delete restrict,
  product_title text not null,
  unit text not null,
  quantity numeric(12,3) not null check(quantity>0 and quantity<=100),
  price_each numeric(12,2) not null check(price_each>0),
  line_total numeric(12,2) generated always as (round(quantity*price_each,2)) stored,
  unique(order_id,product_id)
);

create table public.store_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.store_orders(id) on delete restrict,
  payment_method text not null check(payment_method in ('cash','cod','bkash_manual','nagad_manual','bank_manual')),
  amount numeric(12,2) not null check(amount>0),
  reference text not null default '' check(length(reference)<=120),
  collected_by uuid not null references auth.users(id),
  collected_at timestamptz not null default now(),
  verified_by uuid references auth.users(id),
  verified_at timestamptz
);

create table public.store_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.store_orders(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  event text not null check(length(event) between 2 and 100),
  details text not null default '' check(length(details)<=500),
  created_at timestamptz not null default now()
);

create index store_orders_inbox_idx on public.store_orders(status,created_at desc);
create index store_orders_customer_idx on public.store_orders(customer_id,created_at desc);
create index store_events_order_idx on public.store_order_events(order_id,created_at desc);
create index store_offers_live_idx on public.store_offers(status,closes_at);

-- SECURITY DEFINER only reads current user's staff role, never a caller-supplied ID.
create function public.store_is_staff() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.store_members
  where user_id=(select auth.uid()) and role in ('admin','super_admin'))
$$;
create function public.store_is_super_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.store_members
  where user_id=(select auth.uid()) and role='super_admin')
$$;

alter table public.store_members enable row level security;
alter table public.store_products enable row level security;
alter table public.store_offers enable row level security;
alter table public.store_offer_items enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_payment_receipts enable row level security;
alter table public.store_order_events enable row level security;

revoke all on table public.store_members,public.store_products,
 public.store_offers,public.store_offer_items,public.store_orders,
 public.store_order_items,public.store_payment_receipts,
 public.store_order_events from public,anon,authenticated;
revoke all on sequence public.store_order_events_id_seq from public,anon,authenticated;
grant select on public.store_products,public.store_offers,public.store_offer_items to anon,authenticated;
grant select on public.store_members,public.store_orders,public.store_order_items,
 public.store_payment_receipts,public.store_order_events to authenticated;
grant insert,update on public.store_products,public.store_offers,public.store_offer_items to authenticated;

create policy store_member_read on public.store_members for select to authenticated
 using(user_id=(select auth.uid()) or (select public.store_is_staff()));
create policy store_product_public on public.store_products for select
 using(status='live' or (select public.store_is_staff()));
create policy store_products_staff_write on public.store_products for all to authenticated
 using((select public.store_is_staff()))
 with check((select public.store_is_staff()));
create policy store_offer_public on public.store_offers for select
 using((status='live' and opens_at<=now() and (closes_at is null or closes_at>now()))
   or (select public.store_is_staff()));
create policy store_offers_staff_write on public.store_offers for all to authenticated
 using((select public.store_is_staff()))
 with check((select public.store_is_staff()));
create policy store_offer_items_public on public.store_offer_items for select
 using(exists(
   select 1 from public.store_offers o where o.id=offer_id
   and (o.status='live' and o.opens_at<=now()
     and (o.closes_at is null or o.closes_at>now()) or public.store_is_staff())));
create policy store_offer_items_staff_write on public.store_offer_items for all to authenticated
 using((select public.store_is_staff()))
 with check((select public.store_is_staff()));
create policy store_orders_scoped on public.store_orders for select to authenticated
 using(customer_id=(select auth.uid()) or (select public.store_is_staff()));
create policy store_items_scoped on public.store_order_items for select to authenticated
 using(exists(select 1 from public.store_orders o
  where o.id=order_id and (o.customer_id=(select auth.uid()) or public.store_is_staff())));
create policy store_payments_scoped on public.store_payment_receipts for select to authenticated
 using(exists(select 1 from public.store_orders o
  where o.id=order_id and (o.customer_id=(select auth.uid()) or public.store_is_staff())));
create policy store_events_scoped on public.store_order_events for select to authenticated
 using(exists(select 1 from public.store_orders o
  where o.id=order_id and (o.customer_id=(select auth.uid()) or public.store_is_staff())));

-- Only Super Admin can grant/remove Admin rights. Never a self-signup permission.
create function public.store_set_role(p_user_id uuid,p_role text)
returns text language plpgsql security definer set search_path='' as $$
declare v_prior text;
begin
 if not public.store_is_super_admin() then
  raise exception using errcode='42501',message='Super Admin access required';
 end if;
 if p_role not in ('customer','admin','super_admin') then
  raise exception 'Invalid role';
 end if;
 if not exists(select 1 from auth.users where id=p_user_id) then
  raise exception 'User must create a customer account first';
 end if;
 select role into v_prior from public.store_members where user_id=p_user_id for update;
 if v_prior='super_admin' and p_role<>'super_admin' and
  (select count(*) from public.store_members where role='super_admin')<=1
 then raise exception 'Cannot remove the last Super Admin';end if;
 insert into public.store_members(user_id,role) values(p_user_id,p_role)
 on conflict(user_id) do update set role=excluded.role,updated_at=now();
 return p_role;
end $$;

create function public.store_place_order(
 p_cart jsonb,p_offer_id uuid,p_method text,p_address text,
 p_name text,p_phone text,p_request_key uuid,p_delivery_fee numeric default 0
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_order uuid;v_existing uuid;v_offer public.store_offers%rowtype;
 v_line record;v_product public.store_products%rowtype;
 v_price numeric(12,2);v_total numeric(12,2):=0;v_qty numeric(12,3);
 v_seen uuid[]:='{}';v_count int:=0;
begin
 if v_user is null then raise exception using errcode='42501',message='Sign in before checkout';end if;
 if p_request_key is null then raise exception 'Request key required';end if;
 if p_cart is null or jsonb_typeof(p_cart)<>'array'
   or jsonb_array_length(p_cart) not between 1 and 30
 then raise exception 'Select 1 to 30 cart lines';end if;
 if p_method not in ('pickup','home_delivery') then raise exception 'Choose fulfillment';end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 120 or
    length(btrim(coalesce(p_phone,''))) not between 10 and 22
 then raise exception 'Complete customer name and phone';end if;
 if p_method='home_delivery' and length(btrim(coalesce(p_address,''))) not between 10 and 350
 then raise exception 'Complete delivery address';end if;
 -- Fee MUST be server-defined by an approved delivery rule at implementation;
 -- user input cannot establish arbitrary delivery fees in a production app.
 if p_delivery_fee is distinct from 0 then
  raise exception 'Delivery charge must come from approved server configuration';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,10881));
 select id into v_existing from public.store_orders
 where customer_id=v_user and request_key=p_request_key;
 if v_existing is not null then return v_existing;end if;

 if p_offer_id is not null then
   select * into v_offer from public.store_offers where id=p_offer_id;
   if v_offer.id is null or v_offer.status<>'live' or
    v_offer.opens_at>now() or (v_offer.closes_at is not null and v_offer.closes_at<=now())
   then raise exception 'Offer is not live';end if;
 end if;
 insert into public.store_members(user_id,role,name,phone)
 values(v_user,'customer',btrim(p_name),btrim(p_phone))
 on conflict(user_id) do update set
  name=excluded.name,phone=excluded.phone,updated_at=now();
 insert into public.store_orders(customer_id,request_key,offer_id,customer_name,
 customer_phone,fulfillment_method,delivery_address)
 values(v_user,p_request_key,p_offer_id,btrim(p_name),btrim(p_phone),p_method,
   case when p_method='home_delivery' then btrim(p_address) else null end)
 returning id into v_order;

 -- Canonical product-ID order prevents deadlocks; each stock row locks before
 -- reservation to prevent overselling, even with concurrent customer carts.
 for v_line in
   select e.value as obj from jsonb_array_elements(p_cart) e
   order by e.value->>'product_id'
 loop
   if not (v_line.obj ? 'product_id') or
      (v_line.obj->>'product_id') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or coalesce(v_line.obj->>'quantity','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
   then raise exception 'Invalid cart item';end if;
   v_count:=v_count+1;
   if (v_line.obj->>'product_id')::uuid=any(v_seen) then
     raise exception 'Duplicate cart item';
   end if;
   v_seen:=array_append(v_seen,(v_line.obj->>'product_id')::uuid);
   v_qty:=(v_line.obj->>'quantity')::numeric;
   if v_qty<=0 or v_qty>100 then raise exception 'Invalid quantity';end if;
   select * into v_product from public.store_products
      where id=(v_line.obj->>'product_id')::uuid for update;
   if v_product.id is null or v_product.status<>'live' then
    raise exception 'Product not available';end if;
   if v_product.unit<>'kg' and v_qty<>trunc(v_qty) then
    raise exception 'Only kilogram products permit fractional quantity';end if;
   if v_product.on_hand-v_product.reserved<v_qty then
     raise exception 'Insufficient available stock for %',v_product.title;
   end if;
   if p_offer_id is null then v_price:=v_product.regular_price;
   else
     select i.offer_price into v_price from public.store_offer_items i
      where i.offer_id=p_offer_id and i.product_id=v_product.id;
     if v_price is null then raise exception 'Item not part of selected offer';end if;
   end if;
   update public.store_products set reserved=reserved+v_qty,updated_at=now()
    where id=v_product.id;
   insert into public.store_order_items(order_id,product_id,product_title,unit,quantity,price_each)
   values(v_order,v_product.id,v_product.title,v_product.unit,v_qty,v_price);
   v_total:=v_total+round(v_qty*v_price,2);
 end loop;
 update public.store_orders set total_amount=v_total,updated_at=now() where id=v_order;
 insert into public.store_order_events(order_id,actor_id,event,details)
 values(v_order,v_user,'placed','Customer order created; stock reserved, payment not verified');
 return v_order;
end $$;

-- Order handling: staff can approve normal orders; group/pool orders require
-- minimum distinct customers in the same offer before confirmation.
create function public.store_staff_order_status(p_order_id uuid,p_next text,p_note text default '')
returns text language plpgsql security definer set search_path='' as $$
declare v public.store_orders%rowtype;v_threshold integer;v_people integer;
begin
 if not public.store_is_staff() then
  raise exception using errcode='42501',message='Staff access required';end if;
 if length(coalesce(p_note,''))>500 then raise exception 'Note too long';end if;
 select * into v from public.store_orders where id=p_order_id for update;
 if v.id is null then raise exception 'Order not found';end if;
 if not (
   (v.status='placed' and p_next in ('confirmed','cancelled')) or
   (v.status='confirmed' and p_next in ('preparing','cancelled')) or
   (v.status='preparing' and p_next in ('ready_for_pickup','out_for_delivery','cancelled')) or
   (v.status in ('ready_for_pickup','out_for_delivery') and p_next in ('handed_over','cancelled')) or
   (v.status='handed_over' and p_next='completed')
 ) then raise exception 'Invalid order transition';end if;
 if p_next='confirmed' and v.offer_id is not null then
   select min_households into v_threshold from public.store_offers
   where id=v.offer_id;
   select count(distinct customer_id) into v_people from public.store_orders
   where offer_id=v.offer_id and status<>'cancelled';
   if v_people<v_threshold then raise exception 'Group/Pool target not yet reached';end if;
 end if;
 if p_next='completed' and v.payment_status<>'verified' then
  raise exception 'Verify payment before completion';end if;
 if p_next='cancelled' then
   update public.store_products p set reserved=p.reserved-i.quantity,updated_at=now()
   from public.store_order_items i where i.order_id=v.id and p.id=i.product_id;
 elsif p_next='handed_over' then
   update public.store_products p set
     on_hand=p.on_hand-i.quantity,reserved=p.reserved-i.quantity,updated_at=now()
   from public.store_order_items i where i.order_id=v.id and p.id=i.product_id;
 end if;
 update public.store_orders set
  status=p_next,staff_note=coalesce(p_note,''),updated_at=now(),
  handed_over_at=case when p_next='handed_over' then now() else handed_over_at end,
  completed_at=case when p_next='completed' then now() else completed_at end
 where id=v.id;
 insert into public.store_order_events(order_id,actor_id,event,details)
 values(v.id,auth.uid(),p_next,coalesce(p_note,''));
 return p_next;
end $$;

create function public.store_mark_payment_collected(
 p_order_id uuid,p_method text,p_reference text default ''
) returns text language plpgsql security definer set search_path='' as $$
declare v public.store_orders%rowtype;
begin
 if not public.store_is_staff() then
  raise exception using errcode='42501',message='Staff access required';end if;
 if p_method not in ('cash','cod','bkash_manual','nagad_manual','bank_manual')
 then raise exception 'Unsupported payment method';end if;
 if length(coalesce(p_reference,''))>120 then raise exception 'Reference too long';end if;
 select * into v from public.store_orders where id=p_order_id for update;
 if v.id is null or v.status in ('cancelled','completed') then
  raise exception 'Order not eligible for collection';end if;
 if v.payment_status<>'unpaid' then raise exception 'Payment already recorded';end if;
 insert into public.store_payment_receipts(order_id,payment_method,amount,reference,collected_by)
 values(v.id,p_method,v.total_amount,coalesce(p_reference,''),auth.uid());
 update public.store_orders set payment_status='collected_pending_verification',
   updated_at=now() where id=v.id;
 insert into public.store_order_events(order_id,actor_id,event,details)
 values(v.id,auth.uid(),'payment_collected','Collection recorded; verification pending');
 return 'collected_pending_verification';
end $$;

create function public.store_verify_payment(p_order_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v public.store_orders%rowtype;v_receipt public.store_payment_receipts%rowtype;
begin
 if not public.store_is_staff() then
  raise exception using errcode='42501',message='Staff access required';end if;
 select * into v from public.store_orders where id=p_order_id for update;
 if v.id is null or v.status='cancelled' or v.payment_status<>'collected_pending_verification'
 then raise exception 'No eligible collected payment';end if;
 select * into v_receipt from public.store_payment_receipts
  where order_id=v.id for update;
 if v_receipt.id is null or v_receipt.verified_at is not null or v_receipt.amount<>v.total_amount
 then raise exception 'Payment amount or status mismatch';end if;
 update public.store_payment_receipts set verified_by=auth.uid(),verified_at=now()
  where id=v_receipt.id;
 update public.store_orders set payment_status='verified',updated_at=now() where id=v.id;
 insert into public.store_order_events(order_id,actor_id,event,details)
 values(v.id,auth.uid(),'payment_verified','Manual payment checked by authorized staff');
 return 'verified';
end $$;

revoke all on function public.store_is_staff(),public.store_is_super_admin(),
 public.store_set_role(uuid,text),
 public.store_place_order(jsonb,uuid,text,text,text,text,uuid,numeric),
 public.store_staff_order_status(uuid,text,text),
 public.store_mark_payment_collected(uuid,text,text),
 public.store_verify_payment(uuid) from public,anon;
grant execute on function public.store_is_staff(),public.store_is_super_admin(),
 public.store_set_role(uuid,text),
 public.store_place_order(jsonb,uuid,text,text,text,text,uuid,numeric),
 public.store_staff_order_status(uuid,text,text),
 public.store_mark_payment_collected(uuid,text,text),
 public.store_verify_payment(uuid) to authenticated;

-- Super Admin bootstrap is deliberately NOT automated: run a controlled,
-- reviewed INSERT for the existing owner's UUID only in the isolated target.
-- Example (do not execute verbatim):
-- insert into public.store_members(user_id,role)
-- values ('<verified-owner-auth-uuid>'::uuid,'super_admin');

commit;
