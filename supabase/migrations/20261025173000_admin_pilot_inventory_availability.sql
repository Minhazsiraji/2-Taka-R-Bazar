-- Pilot vendor availability is a sellable on-demand allocation, NOT a warehouse
-- on-hand quantity. Operations may update it with a reason and an audit record.
-- Existing product, order, locked quote and finance rows are never rewritten.
create table if not exists private.pilot_listing_availability_audit (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id),
 changed_by uuid not null references auth.users(id),
 previous_quantity integer not null,
 available_quantity integer not null,
 reason text not null,
 changed_at timestamptz not null default now()
);
alter table private.pilot_listing_availability_audit enable row level security;
revoke all on private.pilot_listing_availability_audit from public,anon,authenticated;
create index if not exists pilot_availability_audit_product_time
 on private.pilot_listing_availability_audit(product_id,changed_at desc);

create or replace function public.admin_get_pilot_inventory()
returns table(product_id uuid,name text,sku text,package_size text,image_url text,
 launch_enabled boolean,available_quantity integer,unit_price numeric,reference_price numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (
   private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin')
 ) then raise exception 'Administrator access required';end if;
 return query
 select p.id,p.name,p.sku,p.package_size,p.image_url,
        l.launch_enabled,l.available_quantity,l.approved_unit_price,l.old_price
 from public.products p
 left join public.pilot_vendor_product_listings l on l.product_id=p.id
 where p.active and not p.is_demo
 order by p.name,p.id;
end;
$$;
revoke all on function public.admin_get_pilot_inventory() from public,anon,authenticated,service_role;
grant execute on function public.admin_get_pilot_inventory() to authenticated;

create or replace function public.admin_set_pilot_listing_availability(
 p_product_id uuid,p_expected_quantity integer,p_available_quantity integer,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare old_quantity integer; actor uuid:=auth.uid();
begin
 if actor is null or not (
   private.has_role(actor,'admin') or private.has_role(actor,'super_admin')
 ) then raise exception 'Administrator access required';end if;
 if p_product_id is null or p_expected_quantity is null or
    p_available_quantity is null or p_available_quantity < 0 or
    p_available_quantity > 100000 then
    raise exception 'Enter an available quantity from 0 to 100000';
 end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 300 then
    raise exception 'Enter a reason (8–300 characters) for the availability change';
 end if;
 select available_quantity into old_quantity from public.pilot_vendor_product_listings
 where product_id=p_product_id for update;
 if not found then raise exception 'This product has no approved pilot supplier listing';end if;
 if old_quantity<>p_expected_quantity then
   raise exception 'Availability changed since loading. Refresh and enter the latest value';
 end if;
 if old_quantity=p_available_quantity then return old_quantity;end if;
 update public.pilot_vendor_product_listings
 set available_quantity=p_available_quantity where product_id=p_product_id;
 insert into private.pilot_listing_availability_audit
 (product_id,changed_by,previous_quantity,available_quantity,reason)
 values(p_product_id,actor,old_quantity,p_available_quantity,btrim(p_reason));
 return p_available_quantity;
end;
$$;
revoke all on function public.admin_set_pilot_listing_availability(uuid,integer,integer,text)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_set_pilot_listing_availability(uuid,integer,integer,text)
 to authenticated;
