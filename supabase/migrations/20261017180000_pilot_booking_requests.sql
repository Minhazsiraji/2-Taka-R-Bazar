-- Pilot booking requests: 17 Oct - 31 Dec 2026 (Bangladesh local date).
-- These are customer service requests, NOT Commerce orders/quotes,
-- confirmed stock reservations, sales, payment receipts or Finance journals.
-- Checkout/Finance production gates remain unchanged and default-deny.
create table public.pilot_booking_requests (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id),
 community_id uuid not null references public.communities(id),
 product_id uuid not null references public.products(id),
 product_name text not null,
 quantity integer not null check (quantity between 1 and 20),
 fulfillment_method text not null check (fulfillment_method in ('pickup','home_delivery')),
 delivery_address text,
 contact_name text not null,
 contact_phone text not null,
 customer_note text not null default '' check (char_length(customer_note)<=500),
 request_key uuid not null,
 status text not null default 'requested'
  check (status in ('requested','contacted','confirmed','cancelled')),
 confirmed_unit_price numeric(12,2) check (confirmed_unit_price>0),
 confirmed_delivery_fee numeric(12,2) check (confirmed_delivery_fee>=0),
 staff_note text not null default '' check (char_length(staff_note)<=500),
 last_action_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 terms_accepted_at timestamptz not null,
 unique (customer_id,request_key),
 check (fulfillment_method='pickup' or (delivery_address is not null and char_length(delivery_address) between 10 and 350)),
 check (status<>'confirmed' or (confirmed_unit_price is not null and confirmed_delivery_fee is not null))
);
create index pilot_booking_inbox on public.pilot_booking_requests(status,created_at desc);
create index pilot_booking_customer_recent on public.pilot_booking_requests(customer_id,created_at desc);

create table public.pilot_booking_events (
 id bigint generated always as identity primary key,
 booking_id uuid not null references public.pilot_booking_requests(id),
 actor_user_id uuid not null references auth.users(id),
 from_status text,
 to_status text not null,
 note text not null default '',
 created_at timestamptz not null default now()
);
create index pilot_booking_events_history on public.pilot_booking_events(booking_id,created_at desc);

alter table public.pilot_booking_requests enable row level security;
alter table public.pilot_booking_events enable row level security;
revoke all on public.pilot_booking_requests from public,anon,authenticated,service_role;
revoke all on public.pilot_booking_events from public,anon,authenticated,service_role;
revoke all on sequence public.pilot_booking_events_id_seq from public,anon,authenticated,service_role;
grant select on public.pilot_booking_requests to authenticated;
create policy pilot_booking_select_scoped on public.pilot_booking_requests for select
 to authenticated using (
  customer_id=(select auth.uid())
  or private.has_role((select auth.uid()),'admin')
  or private.has_role((select auth.uid()),'super_admin')
 );

-- Authenticated users may submit their own booking request, never impersonate
-- another customer or directly edit status, price, payment or financial fields.
create function public.pilot_request_booking(
 p_product_id uuid,p_quantity integer,p_method text,p_delivery_address text,
 p_customer_note text,p_request_key uuid,p_terms_accepted boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_profile public.profiles%rowtype;
 v_product public.products%rowtype;
 v_existing uuid;
 v_booking uuid;
 v_note text:=btrim(coalesce(p_customer_note,''));
 v_address text:=nullif(btrim(coalesce(p_delivery_address,'')),'');
begin
 if v_user is null then
  raise exception using errcode='42501',message='Sign in to request a booking';
 end if;
 if (now() at time zone 'Asia/Dhaka')::date not between date '2026-10-17' and date '2026-12-31'
 then raise exception 'The 2026 booking pilot is not open';end if;
 if p_terms_accepted is distinct from true or p_request_key is null
 then raise exception 'Accept current terms before booking';end if;
 if p_quantity is null or p_quantity not between 1 and 20
 then raise exception 'Choose a quantity between 1 and 20';end if;
 if p_method is null or p_method not in ('pickup','home_delivery')
 then raise exception 'Choose pickup or home delivery';end if;
 if char_length(v_note)>500 or (p_method='home_delivery' and (v_address is null or char_length(v_address) not between 10 and 350))
 then raise exception 'Provide a valid address and short note';end if;
 select * into v_profile from public.profiles where id=v_user;
 if v_profile.id is null or nullif(btrim(coalesce(v_profile.full_name,'')),'') is null
    or nullif(btrim(coalesce(v_profile.phone,'')),'') is null or v_profile.community_id is null
 then raise exception 'Finish household onboarding before booking';end if;
 select * into v_product from public.products where id=p_product_id and active and not is_demo;
 if v_product.id is null then raise exception 'This product is not open for requests';end if;

 -- Serialize a user's own submissions for deterministic per-day throttling.
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,69112));
 select id into v_existing from public.pilot_booking_requests
 where customer_id=v_user and request_key=p_request_key;
 if v_existing is not null then return v_existing;end if;
 if (select count(*) from public.pilot_booking_requests
     where customer_id=v_user and created_at>now()-interval '24 hours')>=12
 then raise exception 'Daily booking request limit reached; contact support';end if;

 insert into public.pilot_booking_requests(
  customer_id,community_id,product_id,product_name,quantity,fulfillment_method,
  delivery_address,contact_name,contact_phone,customer_note,request_key,terms_accepted_at
 ) values (
  v_user,v_profile.community_id,v_product.id,v_product.name,p_quantity,p_method,
  case when p_method='home_delivery' then v_address else null end,
  btrim(v_profile.full_name),btrim(v_profile.phone),v_note,p_request_key,now()
 ) returning id into v_booking;
 insert into public.pilot_booking_events(booking_id,actor_user_id,to_status,note)
 values(v_booking,v_user,'requested','Customer submitted a non-payable booking request');
 return v_booking;
end $$;

-- Operator updates are service statuses only. A confirmed booking includes
-- an explicit human-quoted unit price and delivery fee, but records NO payment.
create function public.pilot_staff_update_booking(
 p_booking_id uuid,p_status text,p_unit_price numeric,p_delivery_fee numeric,p_staff_note text
) returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v public.pilot_booking_requests%rowtype;
 v_note text:=btrim(coalesce(p_staff_note,''));
begin
 if v_user is null or not (
  private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')
 ) then raise exception using errcode='42501',message='Admin access required';end if;
 if p_status not in ('contacted','confirmed','cancelled') or char_length(v_note)>500
 then raise exception 'Invalid pilot booking update';end if;
 select * into v from public.pilot_booking_requests where id=p_booking_id for update;
 if v.id is null then raise exception 'Booking not found';end if;
 if v.status='cancelled' or (v.status='confirmed' and p_status<>'cancelled')
 then raise exception 'The booking is finalized; use the supported follow-up process';end if;
 if p_status='confirmed' and (
  p_unit_price is null or p_unit_price<=0 or p_delivery_fee is null or p_delivery_fee<0
 ) then raise exception 'Confirm customer price and delivery fee before acceptance';end if;
 update public.pilot_booking_requests set
  status=p_status,
  confirmed_unit_price=case when p_status='confirmed' then p_unit_price else confirmed_unit_price end,
  confirmed_delivery_fee=case when p_status='confirmed' then p_delivery_fee else confirmed_delivery_fee end,
  staff_note=v_note,last_action_by=v_user,updated_at=now()
 where id=v.id;
 insert into public.pilot_booking_events(booking_id,actor_user_id,from_status,to_status,note)
 values(v.id,v_user,v.status,p_status,v_note);
 return p_status;
end $$;

create function public.pilot_cancel_my_booking(p_booking_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v public.pilot_booking_requests%rowtype;
begin
 if v_user is null then raise exception using errcode='42501',message='Sign in required';end if;
 select * into v from public.pilot_booking_requests where id=p_booking_id for update;
 if v.id is null or v.customer_id<>v_user then
  raise exception using errcode='42501',message='This booking does not belong to your account';end if;
 if v.status not in ('requested','contacted') then
  raise exception 'Contact customer support to change a confirmed booking';end if;
 update public.pilot_booking_requests set status='cancelled',updated_at=now(),last_action_by=v_user where id=v.id;
 insert into public.pilot_booking_events(booking_id,actor_user_id,from_status,to_status,note)
 values(v.id,v_user,v.status,'cancelled','Cancelled by customer before confirmation');
 return 'cancelled';
end $$;

revoke all on function public.pilot_request_booking(uuid,integer,text,text,text,uuid,boolean) from public,anon,service_role;
revoke all on function public.pilot_staff_update_booking(uuid,text,numeric,numeric,text) from public,anon,service_role;
revoke all on function public.pilot_cancel_my_booking(uuid) from public,anon,service_role;
grant execute on function public.pilot_request_booking(uuid,integer,text,text,text,uuid,boolean) to authenticated;
grant execute on function public.pilot_staff_update_booking(uuid,text,numeric,numeric,text) to authenticated;
grant execute on function public.pilot_cancel_my_booking(uuid) to authenticated;
