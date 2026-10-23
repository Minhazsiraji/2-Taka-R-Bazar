-- Remove PL/pgSQL variable/column ambiguity in Pool join; leave production joins untouched.
create or replace function public.join_simple_sale_pool(p_offer uuid,p_products uuid[],p_area uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); nominated uuid; offer_title text; v_product_id uuid; joined_now boolean:=false;
begin
 if u is null then raise exception 'Sign in to join this Pool'; end if;
 if p_products is null or cardinality(p_products) not between 1 and 6
  or (select count(distinct x.pid) from unnest(p_products) as x(pid))<>cardinality(p_products) then
  raise exception 'Select one to six distinct products';
 end if;
 select p.community_id into nominated from public.profiles p
  where p.id=u and p.onboarding_completed_at is not null;
 if nominated is null then raise exception 'Complete your account community before joining'; end if;
 if p_area is not null and p_area<>nominated then raise exception 'Select your nominated account community'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||u::text,84108));
 select o.title into offer_title from public.simple_sale_offers o
  where o.id=p_offer and o.kind='COMMUNITY_POOL' and o.published
    and (o.closes_at is null or o.closes_at>now()) for share;
 if offer_title is null then raise exception 'This Pool is not open for joining'; end if;
 if not exists(select 1 from public.simple_sale_offer_communities a
  join public.communities c on c.id=a.community_id and c.active
  where a.offer_id=p_offer and a.community_id=nominated) then
  raise exception 'This Pool is not offered in your nominated community';
 end if;
 if (select count(*) from public.simple_sale_offer_items i
    where i.offer_id=p_offer and i.product_id=any(p_products))<>cardinality(p_products) then
  raise exception 'Selected products do not belong to this Pool';
 end if;
 for v_product_id in select unnest(p_products) loop
  if not exists(select 1 from public.simple_sale_offer_joins j where
    j.offer_id=p_offer and j.product_id=v_product_id and j.customer_id=u and j.status='active') then
   insert into public.simple_sale_offer_joins(offer_id,product_id,customer_id,community_id,status)
    values(p_offer,v_product_id,u,nominated,'active')
    on conflict(offer_id,product_id,customer_id)
    do update set community_id=excluded.community_id,status='active',updated_at=now();
   joined_now:=true;
  end if;
 end loop;
 if joined_now then
  insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
  values(u,'pool_joined','Community Pool joined',
   'Your selected products are now part of '||left(offer_title,120)||'. Checkout is still required; no payment was taken.',
   '/preview-live/pool/'||p_offer,'normal','simple_pool_join:'||p_offer::text)
  on conflict(user_id,dedupe_key) do update set
    read_at=null,body=excluded.body,created_at=now();
 end if;
 return joined_now;
end $$;
revoke all on function public.join_simple_sale_pool(uuid,uuid[],uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.join_simple_sale_pool(uuid,uuid[],uuid) to authenticated;
