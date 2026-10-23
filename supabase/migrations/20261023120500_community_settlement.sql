-- Final quote -> explicit customer consent -> transfer reference -> independent verification -> order.
-- Production migration intentionally has NO DML on real orders and schedules NO cron jobs.
grant select on public.simple_sale_cycles, public.simple_sale_cycle_members,
 public.simple_sale_cycle_items,public.simple_sale_cycle_quotes,
 public.simple_sale_cycle_quote_items to service_role;

create or replace function public.customer_set_simple_sale_quote_delivery(
 p_quote uuid,p_fulfillment text,p_pickup_point uuid default null,p_home_address text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;c public.simple_sale_cycles%rowtype;
 address_text text; point_uuid uuid;
begin
 if u is null then raise exception 'Sign in first';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote and customer_id=u for update;
 if q.id is null or q.status not in ('awaiting_delivery','quoted') then
  raise exception 'Delivery selection is closed';end if;
 select * into c from public.simple_sale_cycles where id=q.cycle_id and status='closed';
 if c.id is null then raise exception 'Cycle is not yet closed';end if;
 if p_fulfillment='pickup' then
  select p.id into point_uuid from public.pickup_points p
  where p.id=p_pickup_point and p.active and p.community_id=c.community_id;
  if point_uuid is null then raise exception 'Choose an active community pickup point';end if;
  address_text=null;
 elsif p_fulfillment='home_delivery' then
  address_text=btrim(coalesce(p_home_address,''));
  if char_length(address_text) not between 10 and 350 then
   raise exception 'Enter a valid home address';end if;
  point_uuid=null;
 else raise exception 'Choose pickup or home delivery';end if;
 update public.simple_sale_cycle_quotes set status='awaiting_delivery',
  fulfillment=p_fulfillment,pickup_point_id=point_uuid,home_address=address_text,
  delivery_fee=null,quoted_by=null,quoted_at=null,accepted_at=null,
  updated_at=now() where id=p_quote;
 return true;
end $$;
revoke all on function public.customer_set_simple_sale_quote_delivery(uuid,text,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.customer_set_simple_sale_quote_delivery(uuid,text,uuid,text) to authenticated;

create or replace function public.admin_quote_simple_sale_delivery(p_quote uuid,p_delivery_fee numeric)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin'))
 then raise exception 'Admin access required';end if;
 if p_delivery_fee is null or p_delivery_fee::text in ('NaN','Infinity','-Infinity')
  or p_delivery_fee<0 or p_delivery_fee>10000 or p_delivery_fee<>round(p_delivery_fee,2)
 then raise exception 'Enter a valid delivery charge';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote for update;
 if q.id is null or q.status not in ('awaiting_delivery','quoted') or q.fulfillment is null
 then raise exception 'Customer delivery preference is missing or quote is locked';end if;
 update public.simple_sale_cycle_quotes set delivery_fee=p_delivery_fee,
  quoted_by=u,quoted_at=now(),status='quoted',accepted_at=null,updated_at=now() where id=q.id;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(q.customer_id,'offer_quote','Review your confirmed community price',
  'Your final tier price and delivery fee are ready. Accept the total or cancel before paying.',
  '/account/commitments','normal','shared_quote_ready:'||q.id::text)
 on conflict(user_id,dedupe_key) do update set read_at=null,body=excluded.body,created_at=now();
 return true;
end $$;
revoke all on function public.admin_quote_simple_sale_delivery(uuid,numeric)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_quote_simple_sale_delivery(uuid,numeric) to authenticated;

create or replace function public.customer_decide_simple_sale_quote(
 p_quote uuid,p_decision text,p_name text default null,p_phone text default null,p_terms boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;
begin
 if u is null then raise exception 'Sign in first';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote and customer_id=u for update;
 if q.id is null or q.status not in ('quoted','awaiting_delivery')
 then raise exception 'This quote is not awaiting customer decision';end if;
 if p_decision='cancel' then
  update public.simple_sale_cycle_quotes set status='cancelled',updated_at=now() where id=q.id;
  return true;
 end if;
 if p_decision<>'accept' or q.status<>'quoted' or q.delivery_fee is null
 then raise exception 'A complete staff quote must be available';end if;
 if p_terms is distinct from true then raise exception 'Explicitly accept the final price and terms';end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 100 or
  coalesce(p_phone,'') !~ '^\+?[0-9]{10,15}$'
 then raise exception 'Enter a valid name and mobile number';end if;
 update public.simple_sale_cycle_quotes set status='accepted',accepted_at=now(),
  contact_name=btrim(p_name),contact_phone=p_phone,updated_at=now() where id=q.id;
 return true;
end $$;
revoke all on function public.customer_decide_simple_sale_quote(uuid,text,text,text,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.customer_decide_simple_sale_quote(uuid,text,text,text,boolean) to authenticated;

create or replace function public.simple_sale_quote_payment_options(p_quote uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'method',p.method,
  'account_name',p.account_name,'account_number',p.account_number,
  'bank_name',p.bank_name,'branch_name',p.branch_name)),'[]'::jsonb)
 from public.pilot_payment_recipients p where p.active
 and exists(select 1 from public.simple_sale_cycle_quotes q
  where q.id=p_quote and q.customer_id=auth.uid() and q.status='accepted');
$$;
revoke all on function public.simple_sale_quote_payment_options(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.simple_sale_quote_payment_options(uuid) to authenticated;

create or replace function public.customer_submit_simple_sale_payment(
 p_quote uuid,p_recipient uuid,p_reference text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;
begin
 if u is null then raise exception 'Sign in first';end if;
 select * into q from public.simple_sale_cycle_quotes
  where id=p_quote and customer_id=u for update;
 if q.id is null or q.status<>'accepted' or q.accepted_at is null then
  raise exception 'Accept the final quote before submitting payment';end if;
 if not exists(select 1 from public.pilot_payment_recipients p
  where p.id=p_recipient and p.active) then raise exception 'Payment account is unavailable';end if;
 if char_length(btrim(coalesce(p_reference,''))) not between 6 and 80
 then raise exception 'Enter a valid transaction reference';end if;
 update public.simple_sale_cycle_quotes set status='payment_submitted',
  payment_recipient_id=p_recipient,payment_reference=btrim(p_reference),
  payment_submitted_at=now(),updated_at=now() where id=q.id;
 return true;
end $$;
revoke all on function public.customer_submit_simple_sale_payment(uuid,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.customer_submit_simple_sale_payment(uuid,uuid,text) to authenticated;

-- Independent bank-transfer verification. This RPC attests a human staff check, not
-- a bank API reconciliation; calling it must be auditable by the independent reviewer.
create or replace function public.admin_verify_simple_sale_payment(p_quote uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;
 c public.simple_sale_cycles%rowtype; item record; order_uuid uuid; delivery_address text;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin'))
 then raise exception 'Admin access required';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote for update;
 if q.id is null then raise exception 'Quote not found';end if;
 if q.status='verified' and q.order_id is not null then return q.order_id;end if;
 if q.status<>'payment_submitted' or q.accepted_at is null or q.delivery_fee is null
  or q.payment_recipient_id is null or q.payment_reference is null
 then raise exception 'Price acceptance and submitted payment are required';end if;
 if q.quoted_by=u then raise exception 'Independent reviewer required';end if;
 if not exists(select 1 from public.pilot_payment_recipients p where p.id=q.payment_recipient_id)
 then raise exception 'Payment recipient is invalid';end if;
 select * into c from public.simple_sale_cycles where id=q.cycle_id and status='closed';
 if c.id is null then raise exception 'Cycle must be closed';end if;
 if q.fulfillment='pickup' then
  select ('Community pickup: '||p.name||' — '||p.address) into delivery_address
  from public.pickup_points p where p.id=q.pickup_point_id and p.community_id=c.community_id;
 else delivery_address:=q.home_address;end if;
 if delivery_address is null or length(btrim(delivery_address))<10
 then raise exception 'Delivery address is incomplete';end if;
 -- Lock product stock consistently. If stock is insufficient, leave the payment
 -- awaiting manual resolution: do NOT create an order, forge inventory or claim a refund.
 for item in select product_id,quantity from public.simple_sale_cycle_quote_items
  where quote_id=q.id order by product_id loop
  perform pg_advisory_xact_lock(hashtextextended(item.product_id::text,71540));
  perform 1 from public.pilot_vendor_product_listings
   where product_id=item.product_id and launch_enabled for update;
  if found then
   if not exists(select 1 from public.pilot_vendor_product_listings
    where product_id=item.product_id and launch_enabled
      and available_quantity>=item.quantity)
   then raise exception 'Stock shortage: payment needs independent resolution';end if;
  else
   perform 1 from public.launch_product_stock where product_id=item.product_id for update;
   if not found or not exists(select 1 from public.launch_product_stock
    where product_id=item.product_id and available_quantity>=item.quantity)
   then raise exception 'Stock shortage: payment needs independent resolution';end if;
  end if;
 end loop;
 insert into public.launch_orders
  (customer_id,request_key,payload_hash,contact_name,contact_phone,address,
   fulfillment,status,subtotal,delivery_fee,total_amount,payment_status,
   recipient_id,payment_reference,reviewed_by,staff_note)
 values(q.customer_id,q.id,md5('community_quote:'||q.id::text),q.contact_name,
  q.contact_phone,left(delivery_address,350),q.fulfillment,'confirmed',
  q.product_total,q.delivery_fee,q.product_total+q.delivery_fee,
  'verified',q.payment_recipient_id,q.payment_reference,u,
  'Locked community quote accepted; independently verified transfer')
 returning id into order_uuid;
 for item in select i.product_id,i.quantity,i.unit_price,p.name,p.package_size
  from public.simple_sale_cycle_quote_items i
  join public.products p on p.id=i.product_id where i.quote_id=q.id
  order by i.product_id loop
  -- Legacy early-order protection rejects offer_id. Final order remains traceable
  -- through the immutable quote -> cycle -> original published offer.
  insert into public.launch_order_items(order_id,product_id,product_name,
   package_size,quantity,unit_price,offer_id)
  values(order_uuid,item.product_id,item.name,item.package_size,item.quantity,item.unit_price,null);
  update public.pilot_vendor_product_listings
  set available_quantity=available_quantity-item.quantity
  where product_id=item.product_id and launch_enabled;
  if not found then
   update public.launch_product_stock
   set available_quantity=available_quantity-item.quantity where product_id=item.product_id;
  end if;
 end loop;
 update public.simple_sale_cycle_quotes set status='verified',payment_verified_by=u,
  payment_verified_at=now(),order_id=order_uuid,updated_at=now() where id=q.id;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key,order_id)
 values(q.customer_id,'shared_order_verified','Payment verified — order confirmed',
  'Your payment has been checked and the order was created at the locked price.',
  '/launch-orders/'||order_uuid::text,'normal','shared_order:'||q.id::text,order_uuid)
 on conflict(user_id,dedupe_key) do nothing;
 return order_uuid;
end $$;
revoke all on function public.admin_verify_simple_sale_payment(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_verify_simple_sale_payment(uuid) to authenticated;
-- Automatic database scheduling and production finance activation require separate release approval.
