-- One master product/image, one shared stock balance, three offer kinds.
-- Existing launch products retain their existing stock rows; new products use
-- launch_product_stock. A product never reserves a separate stock per module.
create table public.launch_product_stock(
 product_id uuid primary key references public.products(id),
 available_quantity integer not null default 0 check(available_quantity>=0)
);
create table public.simple_sale_offers(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('SOLO','GROUP_DEAL','COMMUNITY_POOL')),
 community_id uuid not null references public.communities(id),title text not null check(char_length(title) between 2 and 180),
 published boolean not null default false,closes_at timestamptz,
 created_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create index simple_offers_creator on public.simple_sale_offers(created_by);
create index simple_offers_community on public.simple_sale_offers(community_id,published);
create table public.simple_sale_offer_items(
 offer_id uuid not null references public.simple_sale_offers(id),product_id uuid not null references public.products(id),
 price numeric(12,2) not null check(price>0),old_price numeric(12,2) not null default 0 check(old_price>=0),
 primary key(offer_id,product_id)
);
create index simple_offer_items_product on public.simple_sale_offer_items(product_id);
alter table public.launch_product_stock enable row level security;
alter table public.simple_sale_offers enable row level security;
alter table public.simple_sale_offer_items enable row level security;
revoke all on public.launch_product_stock,public.simple_sale_offers,public.simple_sale_offer_items from public,anon,authenticated,service_role;
grant select on public.launch_product_stock,public.simple_sale_offers,public.simple_sale_offer_items to authenticated;
create policy launch_stock_admin on public.launch_product_stock for select to authenticated using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy simple_offers_admin on public.simple_sale_offers for select to authenticated using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy simple_items_admin on public.simple_sale_offer_items for select to authenticated using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
alter table public.launch_order_items add column offer_id uuid references public.simple_sale_offers(id);
create index launch_order_items_offer on public.launch_order_items(offer_id);

create function public.admin_save_simple_offer(p_id uuid,p_kind text,p_community uuid,p_title text,p_items jsonb,p_published boolean,p_closes timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();oid uuid;r record;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin')) then raise exception 'Admin access required';end if;
 if p_kind is null or p_kind not in ('SOLO','GROUP_DEAL','COMMUNITY_POOL') or char_length(btrim(coalesce(p_title,''))) not between 2 and 180 or not exists(select 1 from public.communities where id=p_community and active) then raise exception 'Choose a sale type, title and community';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 6 then raise exception 'Select 1–6 products and enter their prices';end if;
 if (select count(distinct (x->>'product_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'Select each product once';end if;
 if p_published and p_closes<=now() then raise exception 'Choose a future closing time or leave it empty';end if;
 if p_id is not null then
  select id into oid from public.simple_sale_offers where id=p_id for update;
  if oid is null then raise exception 'Offer not found';end if;
 end if;
 -- Serialise all offer edits and checkouts by product in the same order.
 for r in select (x->>'product_id')::uuid pid,(x->>'price')::numeric price,coalesce((x->>'old_price')::numeric,0) old_price,nullif(x->>'available_quantity','')::integer qty from jsonb_array_elements(p_items) x order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended(r.pid::text,71540));
  if r.price is null or r.price::text in ('NaN','Infinity','-Infinity') or r.old_price::text in ('NaN','Infinity','-Infinity') or r.price<=0 or r.price<>round(r.price,2) or r.old_price<0 or r.old_price<>round(r.old_price,2) or r.qty<0 or not exists(select 1 from public.products where id=r.pid and active and not is_demo) then raise exception 'Choose an active product, positive price and nonnegative stock';end if;
  if exists(select 1 from public.pilot_vendor_product_listings where product_id=r.pid and launch_enabled) then
   if r.qty is not null then update public.pilot_vendor_product_listings set available_quantity=r.qty where product_id=r.pid;end if;
  else
   insert into public.launch_product_stock(product_id,available_quantity) values(r.pid,coalesce(r.qty,0)) on conflict(product_id) do nothing;
   if r.qty is not null then update public.launch_product_stock set available_quantity=r.qty where product_id=r.pid;end if;
  end if;
 end loop;
 if p_id is null then
  insert into public.simple_sale_offers(kind,community_id,title,published,closes_at,created_by) values(p_kind,p_community,btrim(p_title),coalesce(p_published,false),p_closes,u) returning id into oid;
 else
  select id into oid from public.simple_sale_offers where id=p_id for update;
  if oid is null then raise exception 'Offer not found';end if;
  -- Preserve module/area in existing customer requests; create another offer to move it.
  if exists(select 1 from public.launch_order_items where offer_id=oid) and exists(select 1 from public.simple_sale_offers where id=oid and (kind<>p_kind or community_id<>p_community)) then raise exception 'This offer has customer orders. Create another offer to change its type or area';end if;
  update public.simple_sale_offers set kind=p_kind,community_id=p_community,title=btrim(p_title),published=coalesce(p_published,false),closes_at=p_closes,updated_at=now() where id=oid;
  delete from public.simple_sale_offer_items where offer_id=oid;
 end if;
 insert into public.simple_sale_offer_items(offer_id,product_id,price,old_price) select oid,(x->>'product_id')::uuid,(x->>'price')::numeric,coalesce((x->>'old_price')::numeric,0) from jsonb_array_elements(p_items) x;
 return oid;
end $$;
revoke all on function public.admin_save_simple_offer(uuid,text,uuid,text,jsonb,boolean,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_simple_offer(uuid,text,uuid,text,jsonb,boolean,timestamptz) to authenticated;

create function public.get_public_simple_offers() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'community_id',o.community_id,'community_name',c.name,'title',o.title,'updated_at',o.updated_at,'closes_at',o.closes_at,'items',items.rows,'buyer_count',counts.buyers) order by o.updated_at desc),'[]'::jsonb)
 from public.simple_sale_offers o join public.communities c on c.id=o.community_id and c.active
 cross join lateral(select jsonb_agg(jsonb_build_object('product_id',p.id,'name',p.name,'brand',p.brand,'category',p.category,'package_size',p.package_size,'unit',p.unit,'image_url',p.image_url,'price',i.price,'old_price',i.old_price,'available_quantity',coalesce(l.available_quantity,s.available_quantity,0)) order by p.name) rows from public.simple_sale_offer_items i join public.products p on p.id=i.product_id and p.active and not p.is_demo left join public.pilot_vendor_product_listings l on l.product_id=p.id and l.launch_enabled left join public.launch_product_stock s on s.product_id=p.id where i.offer_id=o.id) items
 cross join lateral(select count(distinct ord.customer_id) filter(where ord.status='confirmed') buyers from public.launch_order_items li join public.launch_orders ord on ord.id=li.order_id and ord.status<>'cancelled' where li.offer_id=o.id) counts
 where o.published and exists(select 1 from public.simple_sale_offer_items where offer_id=o.id) and (o.closes_at is null or o.closes_at>now()) and jsonb_array_length(coalesce(items.rows,'[]'::jsonb))=(select count(*) from public.simple_sale_offer_items where offer_id=o.id);
$$;
revoke all on function public.get_public_simple_offers() from public,anon,authenticated,service_role;
grant execute on function public.get_public_simple_offers() to anon,authenticated;

-- Direct offers replace the price of a matching legacy launch listing. Product
-- metadata and photos always come from the master, never an offer copy.
create or replace function public.get_public_launch_catalog(p_product_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with direct as (
  select distinct on (i->>'product_id') i||jsonb_build_object('offer_id',o->>'id','community_id',o->>'community_id') item
  from jsonb_array_elements(public.get_public_simple_offers()) o cross join lateral jsonb_array_elements(o->'items') i
  where o->>'kind'='SOLO' and (p_product_id is null or (i->>'product_id')::uuid=p_product_id)
  order by i->>'product_id',(o->>'updated_at')::timestamptz desc,o->>'id'
 ), rows as (
  select jsonb_build_object('product_id',item->>'product_id','name',item->>'name','category',item->>'category','package_size',item->>'package_size','image_url',item->'image_url','approved_unit_price',item->'price','old_price',item->'old_price','available_quantity',item->'available_quantity','launch_enabled',true,'offer_id',item->>'offer_id','community_id',item->>'community_id','supplier_name','','supplier_handover_days',0) row from direct
  union all
  select to_jsonb(c)||jsonb_build_object('available_quantity',l.available_quantity,'old_price',l.old_price,'launch_enabled',l.launch_enabled)
  from public.get_public_pilot_vendor_catalog(p_product_id) c join public.pilot_vendor_product_listings l on l.product_id=c.product_id
  where not exists(select 1 from direct where item->>'product_id'=c.product_id::text)
 ) select coalesce(jsonb_agg(row order by row->>'name'),'[]'::jsonb) from rows;
$$;

-- Internal price lookup: never use a price sent by the browser.
create function private.launch_order_product(p_product uuid,p_offer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select case when p_offer is null then
  (select x from jsonb_array_elements(public.get_public_launch_catalog(p_product)) x limit 1)
 else
  (select jsonb_build_object('product_id',i->>'product_id','name',i->>'name','package_size',i->>'package_size','approved_unit_price',i->'price','launch_enabled',true,'available_quantity',i->'available_quantity') from jsonb_array_elements(public.get_public_simple_offers()) o cross join lateral jsonb_array_elements(o->'items') i where (o->>'id')::uuid=p_offer and (i->>'product_id')::uuid=p_product limit 1)
 end;
$$;
revoke all on function private.launch_order_product(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.launch_submit_order(p_items jsonb,p_request_key uuid,p_name text,p_phone text,p_address text,p_method text,p_terms boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();oid uuid;prior public.launch_orders%rowtype;r record;c jsonb;total numeric:=0;fingerprint text;
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
 -- Lock referenced offers before products; unpublish/reprice waits for checkout.
 perform 1 from public.simple_sale_offers where id in(select nullif(x->>'offer_id','')::uuid from jsonb_array_elements(p_items) x) order by id for share;
 -- Lock inventory in a deterministic order, then read authoritative public prices.
 for r in select (x->>'product_id')::uuid pid,(x->>'quantity')::integer qty,nullif(x->>'offer_id','')::uuid offer from jsonb_array_elements(p_items) x order by 1 loop
  if r.qty is null or r.qty not between 1 and 100 then raise exception 'Choose a quantity from 1 to 100';end if;
  perform pg_advisory_xact_lock(hashtextextended(r.pid::text,71540));
  perform 1 from public.pilot_vendor_product_listings where product_id=r.pid and launch_enabled for update;
  perform 1 from public.launch_product_stock where product_id=r.pid for update;
  c=private.launch_order_product(r.pid,r.offer);
  if c is null or coalesce((c->>'launch_enabled')::boolean,false) is not true or coalesce((c->>'available_quantity')::integer,0)<r.qty then raise exception 'A selected product or quantity is unavailable';end if;
  total=total+(c->>'approved_unit_price')::numeric*r.qty;
 end loop;
 insert into public.launch_orders(customer_id,request_key,payload_hash,contact_name,contact_phone,address,fulfillment,subtotal)
 values(u,p_request_key,fingerprint,btrim(p_name),p_phone,btrim(p_address),p_method,total) returning id into oid;
 for r in select (x->>'product_id')::uuid pid,(x->>'quantity')::integer qty,nullif(x->>'offer_id','')::uuid offer from jsonb_array_elements(p_items) x loop
  c=private.launch_order_product(r.pid,r.offer);
  insert into public.launch_order_items(order_id,product_id,product_name,package_size,quantity,unit_price,offer_id) values(oid,r.pid,c->>'name',c->>'package_size',r.qty,(c->>'approved_unit_price')::numeric,r.offer);
  update public.pilot_vendor_product_listings set available_quantity=available_quantity-r.qty where product_id=r.pid and launch_enabled;
  if not found then update public.launch_product_stock set available_quantity=available_quantity-r.qty where product_id=r.pid;end if;
 end loop;
 return oid;
end $$;
revoke all on function public.launch_submit_order(jsonb,uuid,text,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.launch_submit_order(jsonb,uuid,text,text,text,text,boolean) to authenticated;


create or replace function public.launch_review_order(p_order uuid,p_decision text,p_delivery_fee numeric,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();o public.launch_orders%rowtype;r record;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin')) then raise exception 'Staff access required';end if;
 if p_delivery_fee is null or p_delivery_fee::text in ('NaN','Infinity','-Infinity') or p_delivery_fee<0 or char_length(coalesce(p_note,''))>500 then raise exception 'Invalid delivery fee or note';end if;
 select * into o from public.launch_orders where id=p_order for update;
 if o.id is null then raise exception 'Order not found';end if;
 if p_decision='confirm' and o.status='requested' then
  update public.launch_orders set status='confirmed',delivery_fee=p_delivery_fee,reviewed_by=u,staff_note=coalesce(p_note,'') where id=o.id;
 elsif p_decision='cancel' and o.status<>'cancelled' and o.payment_status='pending' then
  for r in select * from public.launch_order_items where order_id=o.id order by product_id loop
   perform pg_advisory_xact_lock(hashtextextended(r.product_id::text,71540));
   update public.pilot_vendor_product_listings set available_quantity=available_quantity+r.quantity where product_id=r.product_id and launch_enabled;
   if not found then update public.launch_product_stock set available_quantity=available_quantity+r.quantity where product_id=r.product_id;end if;
  end loop;
  update public.launch_orders set status='cancelled',reviewed_by=u,staff_note=coalesce(p_note,'') where id=o.id;
 elsif p_decision='verify_payment' and o.status='confirmed' and o.payment_status='submitted' then
  if u=o.customer_id then raise exception 'Another staff member must verify the transfer';end if;
  update public.launch_orders set payment_status='verified',reviewed_by=u,staff_note=coalesce(p_note,'') where id=o.id;
 else raise exception 'This action is not available for the current order state';end if;
end $$;
revoke all on function public.launch_review_order(uuid,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.launch_review_order(uuid,text,numeric,text) to authenticated;


notify pgrst, 'reload schema';
