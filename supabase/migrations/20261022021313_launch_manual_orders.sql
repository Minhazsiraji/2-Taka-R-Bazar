-- Owner-authorized six-product launch. Additive, isolated from Finance/Treasury.
alter table public.pilot_vendor_product_listings
 add column launch_enabled boolean not null default false,
 add column available_quantity integer not null default 0 check(available_quantity>=0),
 add column old_price numeric(12,2) not null default 0 check(old_price>=0);

create function public.get_public_launch_catalog(p_product_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('available_quantity',l.available_quantity,'old_price',l.old_price,'launch_enabled',l.launch_enabled) order by c.name),'[]'::jsonb)
 from public.get_public_pilot_vendor_catalog(p_product_id) c join public.pilot_vendor_product_listings l on l.product_id=c.product_id;
$$;
revoke all on function public.get_public_launch_catalog(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_launch_catalog(uuid) to anon,authenticated;

create table public.launch_orders(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references auth.users(id),
 request_key uuid not null,payload_hash text not null,contact_name text not null,contact_phone text not null,address text not null,
 fulfillment text not null check(fulfillment in ('pickup','home_delivery')),
 status text not null default 'requested' check(status in ('requested','confirmed','cancelled')),
 subtotal numeric(12,2) not null check(subtotal>0),delivery_fee numeric(12,2) check(delivery_fee>=0),
 total_amount numeric(12,2) generated always as (subtotal+coalesce(delivery_fee,0)) stored,
 payment_status text not null default 'pending' check(payment_status in ('pending','submitted','verified')),
 recipient_id uuid references public.pilot_payment_recipients(id),payment_reference text,
 staff_note text not null default '',reviewed_by uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(customer_id,request_key),check(payment_reference is null or char_length(payment_reference) between 6 and 80)
);
create unique index launch_payment_reference_unique on public.launch_orders(recipient_id,lower(payment_reference)) where payment_reference is not null;
create index launch_orders_inbox on public.launch_orders(status,created_at desc);
create table public.launch_order_items(
 order_id uuid not null references public.launch_orders(id),product_id uuid not null references public.products(id),
 product_name text not null,package_size text not null,quantity integer not null check(quantity between 1 and 100),
 unit_price numeric(12,2) not null check(unit_price>0),primary key(order_id,product_id)
);
create index launch_order_items_product_idx on public.launch_order_items(product_id);
alter table public.launch_orders enable row level security;
alter table public.launch_order_items enable row level security;
revoke all on public.launch_orders,public.launch_order_items from public,anon,authenticated,service_role;
grant select on public.launch_orders,public.launch_order_items to authenticated;
create policy launch_order_read on public.launch_orders for select to authenticated using(customer_id=(select auth.uid()) or private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy launch_item_read on public.launch_order_items for select to authenticated using(exists(select 1 from public.launch_orders o where o.id=order_id));

create function public.launch_submit_order(p_items jsonb,p_request_key uuid,p_name text,p_phone text,p_address text,p_method text,p_terms boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();oid uuid;prior public.launch_orders%rowtype;r record;c record;total numeric:=0;fingerprint text;
begin
 if u is null then raise exception 'Sign in to place your order';end if;
 if p_terms is distinct from true or p_request_key is null then raise exception 'Accept the terms before placing an order';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid cart';end if;
 if jsonb_array_length(p_items) not between 1 and 6 then raise exception 'Choose 1–6 products';end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 100 or coalesce(p_phone,'') !~ '^\+?[0-9]{10,15}$' or char_length(btrim(coalesce(p_address,''))) not between 10 and 350 or p_method not in ('pickup','home_delivery') or p_method is null then raise exception 'Enter your name, mobile number, address and delivery method';end if;
 fingerprint=md5(p_items::text||btrim(p_name)||p_phone||btrim(p_address)||p_method);
 perform pg_advisory_xact_lock(hashtextextended(u::text,71439));
 select * into prior from public.launch_orders where customer_id=u and request_key=p_request_key;
 if prior.id is not null then
  if prior.payload_hash<>fingerprint then raise exception 'This checkout was already submitted with different details';end if;
  return prior.id;
 end if;
 if (select count(distinct (x->>'product_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'Duplicate cart product';end if;
 -- Lock inventory in a deterministic order, then read authoritative public prices.
 for r in select (x->>'product_id')::uuid pid,(x->>'quantity')::integer qty from jsonb_array_elements(p_items) x order by 1 loop
  if r.qty is null or r.qty not between 1 and 100 then raise exception 'Choose a quantity from 1 to 100';end if;
  perform 1 from public.pilot_vendor_product_listings where product_id=r.pid for update;
  select * into c from public.get_public_pilot_vendor_catalog(r.pid);
  if c.product_id is null or not exists(select 1 from public.pilot_vendor_product_listings l where l.product_id=r.pid and l.launch_enabled and l.available_quantity>=r.qty) then raise exception 'A selected product or quantity is unavailable';end if;
  total=total+c.approved_unit_price*r.qty;
 end loop;
 insert into public.launch_orders(customer_id,request_key,payload_hash,contact_name,contact_phone,address,fulfillment,subtotal)
 values(u,p_request_key,fingerprint,btrim(p_name),p_phone,btrim(p_address),p_method,total) returning id into oid;
 for r in select (x->>'product_id')::uuid pid,(x->>'quantity')::integer qty from jsonb_array_elements(p_items) x loop
  select * into c from public.get_public_pilot_vendor_catalog(r.pid);
  insert into public.launch_order_items values(oid,r.pid,c.name,c.package_size,r.qty,c.approved_unit_price);
  update public.pilot_vendor_product_listings set available_quantity=available_quantity-r.qty where product_id=r.pid;
 end loop;
 return oid;
end $$;
revoke all on function public.launch_submit_order(jsonb,uuid,text,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.launch_submit_order(jsonb,uuid,text,text,text,text,boolean) to authenticated;

create function public.launch_payment_options(p_order uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'method',p.method,'account_name',p.account_name,'account_number',p.account_number,'bank_name',p.bank_name,'branch_name',p.branch_name)),'[]'::jsonb)
 from public.pilot_payment_recipients p where p.active and exists(select 1 from public.launch_orders o where o.id=p_order and o.customer_id=auth.uid() and o.status='confirmed');
$$;
revoke all on function public.launch_payment_options(uuid) from public,anon,authenticated,service_role;
grant execute on function public.launch_payment_options(uuid) to authenticated;

create function public.launch_submit_payment(p_order uuid,p_recipient uuid,p_reference text) returns void language plpgsql security definer set search_path='' as $$
declare o public.launch_orders%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in';end if;
 select * into o from public.launch_orders where id=p_order and customer_id=auth.uid() for update;
 if o.id is null or o.status<>'confirmed' or o.payment_status='verified' then raise exception 'This order is not awaiting payment';end if;
 if not exists(select 1 from public.pilot_payment_recipients where id=p_recipient and active) or coalesce(p_reference,'') !~ '^[A-Za-z0-9/_-]{6,80}$' then raise exception 'Choose a receiving account and enter the transaction ID';end if;
 update public.launch_orders set recipient_id=p_recipient,payment_reference=p_reference,payment_status='submitted' where id=o.id;
end $$;
revoke all on function public.launch_submit_payment(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.launch_submit_payment(uuid,uuid,text) to authenticated;

create function public.launch_review_order(p_order uuid,p_decision text,p_delivery_fee numeric,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();o public.launch_orders%rowtype;r record;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin')) then raise exception 'Staff access required';end if;
 if p_delivery_fee is null or p_delivery_fee<0 or char_length(coalesce(p_note,''))>500 then raise exception 'Invalid delivery fee or note';end if;
 select * into o from public.launch_orders where id=p_order for update;
 if o.id is null then raise exception 'Order not found';end if;
 if p_decision='confirm' and o.status='requested' then
  update public.launch_orders set status='confirmed',delivery_fee=p_delivery_fee,reviewed_by=u,staff_note=coalesce(p_note,'') where id=o.id;
 elsif p_decision='cancel' and o.status<>'cancelled' and o.payment_status='pending' then
  for r in select * from public.launch_order_items where order_id=o.id order by product_id loop
   update public.pilot_vendor_product_listings set available_quantity=available_quantity+r.quantity where product_id=r.product_id;
  end loop;
  update public.launch_orders set status='cancelled',reviewed_by=u,staff_note=coalesce(p_note,'') where id=o.id;
 elsif p_decision='verify_payment' and o.status='confirmed' and o.payment_status='submitted' then
  if u=o.customer_id then raise exception 'Another staff member must verify the transfer';end if;
  update public.launch_orders set payment_status='verified',reviewed_by=u,staff_note=coalesce(p_note,'') where id=o.id;
 else raise exception 'This action is not available for the current order state';end if;
end $$;
revoke all on function public.launch_review_order(uuid,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.launch_review_order(uuid,text,numeric,text) to authenticated;

-- The owner authorized 100 available and an optional, zero old price for the
-- six existing published listings. No fake vendor or warehouse stock is created.
update public.pilot_vendor_product_listings l set launch_enabled=true,available_quantity=100,old_price=0
where l.published and l.product_id in(select product_id from public.get_public_pilot_vendor_catalog(null));
