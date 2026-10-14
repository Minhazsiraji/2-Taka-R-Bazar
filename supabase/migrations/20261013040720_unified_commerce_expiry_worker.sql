-- Private scheduler performs operational synthetic expiry only. No financial writes.
create function private.commerce_refresh_cart(p_cart uuid) returns void language plpgsql security definer set search_path='' as $$ declare r record;st jsonb;u uuid;v_changed boolean:=false;v_next text;begin
 select customer_id into u from public.commerce_carts where id=p_cart for update;
 for r in select * from public.commerce_cart_items where cart_id=p_cart and state in ('waiting','ready') order by id for update loop
 st=private.commerce_offer_state(r.offer_id);v_next=r.state;
 if st->>'phase'='unavailable' then v_next='expired';
 elsif r.state='waiting' and st->>'phase'='ready' and (r.group_commitment_id is null or exists(select 1 from public.group_deal_commitments where id=r.group_commitment_id and status='qualified')) and (r.commitment_id is null or exists(select 1 from public.commitments where id=r.commitment_id and status='active')) then v_next='ready';end if;
 if v_next<>r.state then
 update public.commerce_cart_items set state=v_next where id=r.id;v_changed=true;
 if u is not null then insert into public.notifications(user_id,kind,title,body,href,dedupe_key) values(u,'commerce',case when v_next='ready' then 'Price unlocked' else 'Offer expired' end,case when v_next='ready' then 'Review the final price and explicitly confirm checkout. No payment has been taken.' else 'The commitment is no longer payable. No payment has been taken.' end,'/cart','commerce:'||v_next||':'||r.id) on conflict(user_id,dedupe_key) do nothing;end if;
 end if;end loop;
 if v_changed then update public.commerce_carts set revision=revision+1,updated_at=now() where id=p_cart;end if;end $$;
create function private.commerce_expiry_worker() returns integer language plpgsql security definer set search_path='' as $$ declare r record;n integer:=0;begin
 if not exists(select 1 from private.commerce_configuration where preview_secret_hash is not null) then return 0;end if;
 for r in select id from public.commerce_orders where is_synthetic and status='awaiting_supplier' and payment_status='unpaid' and supplier_deadline<=now() order by id for update skip locked loop perform private.commerce_release_order(r.id,'Supplier acceptance deadline expired');n=n+1;end loop;
 for r in select c.id from public.commerce_carts c where exists(select 1 from public.commerce_cart_items i where i.cart_id=c.id and i.state in ('waiting','ready')) order by c.id for update skip locked loop perform private.commerce_refresh_cart(r.id);end loop;
 return n;end $$;
create or replace function public.commerce_expire(p_proof text) returns integer language plpgsql security definer set search_path='' as $$ begin
 perform private.commerce_assert_preview(p_proof);if not private.commerce_admin() then raise exception 'Admin required';end if;return private.commerce_expiry_worker();end $$;
revoke all on function private.commerce_refresh_cart(uuid),private.commerce_expiry_worker(),public.commerce_expire(text) from public,anon,authenticated,service_role;
grant execute on function public.commerce_expire(text) to authenticated;
select cron.schedule('commerce-synthetic-expiry','* * * * *','select private.commerce_expiry_worker();');
