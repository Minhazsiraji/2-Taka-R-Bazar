-- Generated with Supabase migration new; ordered after the Smart Location prerequisites.
alter table public.commerce_quotes add column delivery_address_id uuid references public.customer_delivery_addresses(id);
alter table public.commerce_orders add column delivery_address_id uuid references public.customer_delivery_addresses(id);
alter function public.commerce_create_quote(text,text,uuid,text,text) rename to commerce_create_quote_legacy;
alter function public.commerce_create_quote_legacy(text,text,uuid,text,text) set schema private;
revoke all on function private.commerce_create_quote_legacy(text,text,uuid,text,text) from public,anon,authenticated,service_role;
create function public.commerce_create_quote(p_guest text,p_method text,p_pickup uuid,p_address text,p_proof text,p_address_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$ declare a public.customer_delivery_addresses%rowtype;q jsonb;begin
 perform private.commerce_assert_preview(p_proof);
 if p_method='home_delivery' and p_address_id is not null then
 select * into a from public.customer_delivery_addresses where id=p_address_id and customer_id=auth.uid() and verification_status<>'rejected';
 if a.id is null or not exists(select 1 from public.profiles where id=auth.uid() and community_id=a.community_id) then raise exception 'Complete delivery address in your verified community required';end if;
 q=private.commerce_create_quote_legacy(p_guest,p_method,p_pickup,a.address_text,p_proof);
 update public.commerce_quotes set delivery_address_id=a.id where id=(q->>'id')::uuid;
 return q||jsonb_build_object('delivery_address_id',a.id);
 end if;
 return private.commerce_create_quote_legacy(p_guest,p_method,p_pickup,p_address,p_proof);
end $$;
revoke all on function public.commerce_create_quote(text,text,uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.commerce_create_quote(text,text,uuid,text,text,uuid) to authenticated;
-- Copy the validated quote linkage at INSERT, before immutable confirmed terms apply.
create function private.commerce_address_snapshot() returns trigger language plpgsql security definer set search_path='' as $$ declare q public.commerce_quotes%rowtype;begin
 select q2.* into q from public.commerce_quotes q2 join public.commerce_checkouts c on c.quote_id=q2.id where c.id=new.checkout_id;
 if q.delivery_address_id is not null then
 if not exists(select 1 from public.customer_delivery_addresses where id=q.delivery_address_id and customer_id=new.customer_id and community_id=new.community_id and verification_status<>'rejected' and address_text=q.delivery_address) then raise exception 'Complete delivery address changed; review a fresh quote';end if;
 new.delivery_address_id=q.delivery_address_id;
 end if;return new;end $$;
create trigger commerce_address_snapshot before insert on public.commerce_orders for each row execute function private.commerce_address_snapshot();
revoke all on function private.commerce_address_snapshot() from public,anon,authenticated,service_role;
