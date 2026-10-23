-- Persist the products and quantities selected when joining. Never creates an order,
-- payment, inventory reservation or delivery charge.
create table if not exists public.simple_sale_commitment_items(
 offer_id uuid not null references public.simple_sale_offers(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete restrict,
 community_id uuid not null references public.communities(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(offer_id,customer_id,product_id)
);
create index if not exists simple_sale_commitment_by_area on public.simple_sale_commitment_items(offer_id,community_id);
alter table public.simple_sale_commitment_items enable row level security;
revoke all on public.simple_sale_commitment_items from public,anon,authenticated;
create policy customer_read_own_commitments on public.simple_sale_commitment_items
 for select to authenticated using(customer_id=(select auth.uid()));
grant select on public.simple_sale_commitment_items to authenticated;

create or replace function public.join_simple_sale_group_deal_quantified(
 p_offer uuid,p_product uuid,p_area uuid,p_quantity integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid(); joined boolean; nominated uuid;
begin
 if current_user_id is null then raise exception 'Sign in first'; end if;
 if p_quantity not between 1 and 100 or p_quantity is null then raise exception 'Choose 1–100 units'; end if;
 joined:=public.join_simple_sale_group_deal(p_offer,p_product,p_area);
 select j.community_id into nominated from public.simple_sale_offer_joins j
 where j.offer_id=p_offer and j.product_id=p_product and j.customer_id=current_user_id and j.status='active';
 if nominated is null then raise exception 'Participation was not saved'; end if;
 insert into public.simple_sale_commitment_items(offer_id,customer_id,product_id,community_id,quantity)
 values(p_offer,current_user_id,p_product,nominated,p_quantity)
 on conflict(offer_id,customer_id,product_id)
 do update set quantity=excluded.quantity,community_id=excluded.community_id,updated_at=now();
 update public.notifications set
  body='Your Group Deal commitment is saved. Final tier price and delivery charge require your acceptance before payment. No order has been placed.'
  where user_id=current_user_id and dedupe_key='simple_join:'||p_offer::text||':'||p_product::text;
 return joined;
end $$;
revoke all on function public.join_simple_sale_group_deal_quantified(uuid,uuid,uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.join_simple_sale_group_deal_quantified(uuid,uuid,uuid,integer) to authenticated;

create or replace function public.join_simple_sale_pool_quantified(
 p_offer uuid,p_lines jsonb,p_area uuid default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid();joined boolean;nominated uuid;
begin
 if current_user_id is null then raise exception 'Sign in first'; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 6
 then raise exception 'Select 1–6 products'; end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x where jsonb_typeof(x->'quantity')<>'number'
  or (x->>'quantity')::numeric<>round((x->>'quantity')::numeric)
  or (x->>'quantity')::integer not between 1 and 100 or x->>'product_id' is null)
 then raise exception 'Choose 1–100 units per selected product'; end if;
 if (select count(distinct x->>'product_id') from jsonb_array_elements(p_lines) x)<>jsonb_array_length(p_lines)
 then raise exception 'Duplicate selected products'; end if;
 joined:=public.join_simple_sale_pool(p_offer,
  array(select (x->>'product_id')::uuid from jsonb_array_elements(p_lines) x),p_area);
 select p.community_id into nominated from public.profiles p where p.id=current_user_id;
 if nominated is null then raise exception 'Select an account community'; end if;
 insert into public.simple_sale_commitment_items(offer_id,customer_id,product_id,community_id,quantity)
 select p_offer,current_user_id,(x->>'product_id')::uuid,nominated,(x->>'quantity')::integer
 from jsonb_array_elements(p_lines) x
 on conflict(offer_id,customer_id,product_id)
 do update set quantity=excluded.quantity,community_id=excluded.community_id,updated_at=now();
 update public.notifications set
  body='Your Pool products and quantities are saved as a commitment. Await the final tier and delivery quote before payment. No order was placed.'
  where user_id=current_user_id and dedupe_key='simple_pool_join:'||p_offer::text;
 return joined;
end $$;
revoke all on function public.join_simple_sale_pool_quantified(uuid,jsonb,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.join_simple_sale_pool_quantified(uuid,jsonb,uuid) to authenticated;

create or replace function public.set_simple_sale_commitment_quantity(
 p_offer uuid,p_product uuid,p_quantity integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); nominated uuid;
begin
 if u is null then raise exception 'Sign in first'; end if;
 if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Choose 1–100 units';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||u::text,84108));
 perform 1 from public.simple_sale_offers o where o.id=p_offer and o.published
  and o.kind in ('GROUP_DEAL','COMMUNITY_POOL')
  and (o.closes_at is null or o.closes_at>now()) for share;
 if not found then raise exception 'This commitment is no longer open to updates';end if;
 select j.community_id into nominated from public.simple_sale_offer_joins j
  where j.offer_id=p_offer and j.product_id=p_product and j.customer_id=u and j.status='active';
 if nominated is null then raise exception 'You have not joined this offer';end if;
 insert into public.simple_sale_commitment_items(offer_id,customer_id,product_id,community_id,quantity)
 values(p_offer,u,p_product,nominated,p_quantity)
 on conflict(offer_id,customer_id,product_id)
 do update set quantity=excluded.quantity,updated_at=now();
 return true;
end $$;
revoke all on function public.set_simple_sale_commitment_quantity(uuid,uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.set_simple_sale_commitment_quantity(uuid,uuid,integer) to authenticated;

-- A separate explicit Leave action disables the corresponding quantity snapshot.
create or replace function public.cleanup_left_simple_sale_commitment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='active' and new.status<>'active' then
  delete from public.simple_sale_commitment_items
  where offer_id=new.offer_id and customer_id=new.customer_id and product_id=new.product_id;
 end if;
 return new;
end $$;
revoke all on function public.cleanup_left_simple_sale_commitment() from public,anon,authenticated;
drop trigger if exists cleanup_left_simple_sale_commitment on public.simple_sale_offer_joins;
create trigger cleanup_left_simple_sale_commitment after update of status
 on public.simple_sale_offer_joins for each row
 execute function public.cleanup_left_simple_sale_commitment();
