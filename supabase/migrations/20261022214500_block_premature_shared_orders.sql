-- Safety stop: Pool/Group Deal joins are commitments, not payable checkout orders.
-- Do not modify existing orders or inventory. Direct and SOLO orders remain available.
create or replace function public.block_unsettled_shared_offer_order_item()
returns trigger language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if new.offer_id is null then return new; end if;
 select o.kind into k from public.simple_sale_offers o where o.id=new.offer_id;
 if k in ('GROUP_DEAL','COMMUNITY_POOL') then
   raise exception 'Group Deal and Pool are commitments only. Wait for final tier pricing, delivery quote, customer consent and verified payment before an order is created.';
 end if;
 return new;
end $$;
revoke all on function public.block_unsettled_shared_offer_order_item() from public,anon,authenticated;
drop trigger if exists block_unsettled_shared_offer_order_item on public.launch_order_items;
create trigger block_unsettled_shared_offer_order_item
 before insert or update of offer_id on public.launch_order_items
 for each row execute function public.block_unsettled_shared_offer_order_item();

-- Existing prematurely requested shared orders cannot be approved or paid by staff.
-- Cancellation remains possible. Preservation of historical data is intentional.
create or replace function public.prevent_unsettled_shared_order_approval()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.launch_order_items i
  join public.simple_sale_offers o on o.id=i.offer_id
  where i.order_id=new.id and o.kind in ('GROUP_DEAL','COMMUNITY_POOL'))
  and (new.status='confirmed' or new.payment_status is distinct from old.payment_status) then
   raise exception 'This legacy Group Deal or Pool order predates final-price consent. Do not approve or collect payment.';
 end if;
 return new;
end $$;
revoke all on function public.prevent_unsettled_shared_order_approval() from public,anon,authenticated;
drop trigger if exists prevent_unsettled_shared_order_approval on public.launch_orders;
create trigger prevent_unsettled_shared_order_approval before update of status,payment_status on public.launch_orders
 for each row execute function public.prevent_unsettled_shared_order_approval();
