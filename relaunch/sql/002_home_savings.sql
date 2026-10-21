-- Read-only verified storefront savings for the isolated clean v2 ordering schema.
-- Do NOT apply directly to Production. Install only with the independently qualified relaunch.
begin;

-- Historical price snapshots prevent today’s product price changes from rewriting savings.
alter table public.store_order_items
 add column reference_price_each numeric(12,2) check(reference_price_each is null or reference_price_each>=0),
 add column refunded_quantity numeric(12,3) not null default 0
  check(refunded_quantity>=0 and refunded_quantity<=quantity);

create function public.store_capture_order_reference()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reference_price_each is null then
  select p.regular_price into new.reference_price_each
  from public.store_products p where p.id=new.product_id;
 end if;
 return new;
end $$;
create trigger store_order_reference_snapshot
 before insert on public.store_order_items
 for each row execute function public.store_capture_order_reference();
revoke all on function public.store_capture_order_reference() from public,anon,authenticated;

-- Customer only; never publicly reveal individual customer purchasing histories.
-- Community figure remains NULL until a verified community ID is captured per order.
-- Returns are excluded through refunded_quantity; staff refund workflow must update it
-- atomically with a documented refund before recovered savings may be shown.
create function public.store_home_savings()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_customer uuid:=auth.uid(); v_result jsonb;
begin
 if v_customer is null then
  raise exception using errcode='42501',message='Customer sign-in required';
 end if;
 with eligible as (
  select (o.completed_at at time zone 'Asia/Dhaka') as done_local,
   greatest(0,coalesce(i.reference_price_each,i.price_each)-i.price_each)*
    greatest(0,i.quantity-i.refunded_quantity) as saved
  from public.store_orders o
  join public.store_order_items i on i.order_id=o.id
  where o.customer_id=v_customer
   and o.status='completed' and o.payment_status='verified'
   and o.completed_at is not null
   and exists(
    select 1 from public.store_payment_receipts r where r.order_id=o.id
     and r.verified_at is not null and r.amount=o.total_amount
   )
 )
 select jsonb_build_object(
  'this_month',coalesce(sum(saved) filter (
    where date_trunc('month',done_local)=date_trunc('month',now() at time zone 'Asia/Dhaka')),0),
  'previous_month',coalesce(sum(saved) filter (
    where date_trunc('month',done_local)=date_trunc('month',(now() at time zone 'Asia/Dhaka')-interval '1 month')),0),
  'lifetime',coalesce(sum(saved),0),
  'community',null
 ) into v_result from eligible;
 return v_result;
end $$;
revoke all on function public.store_home_savings() from public,anon;
grant execute on function public.store_home_savings() to authenticated;
commit;
