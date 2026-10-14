-- Attach only an authenticated customer's own saved address to an already confirmed
-- home-delivery order when the exact immutable delivery-address snapshot matches.
-- An address choice never creates or modifies financial events.
create or replace function public.attach_my_delivery_address_to_order(
 p_commitment_id uuid,p_address_id uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_order_id uuid;
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 select o.id into v_order_id
 from public.commitments c
 join public.pool_items pi on pi.id=c.pool_item_id
 join public.pools p on p.id=pi.pool_id
 join public.orders o on o.customer_id=c.customer_id and o.pool_id=p.id
 join public.customer_delivery_addresses a on a.id=p_address_id
 where c.id=p_commitment_id and c.customer_id=v_uid
  and c.status='confirmed' and o.customer_id=v_uid
  and o.fulfillment_method='home_delivery' and o.status<>'cancelled'
  and a.customer_id=v_uid and a.community_id=p.community_id
  and a.verification_status<>'rejected'
  and o.delivery_address=a.address_text
 for update of o;
 if v_order_id is null then return false;end if;
 update public.orders set delivery_address_id=p_address_id
 where id=v_order_id and customer_id=v_uid;
 return true;
end $$;
revoke all on function public.attach_my_delivery_address_to_order(uuid,uuid) from public,anon;
grant execute on function public.attach_my_delivery_address_to_order(uuid,uuid) to authenticated;
