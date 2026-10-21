-- Preview-first: vendor-held product plans and customer-initiated manual
-- payment references for the existing 2026 pilot booking flow.
-- NOT canonical Commerce orders, stock, financial receipts, treasury ledger,
-- payment gateway activation or a bypass of existing purchasing release gates.
create table public.vendor_offer_drafts (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete restrict,
 supplier_id uuid not null references public.suppliers(id) on delete restrict,
 vendor_unit_cost numeric(12,2) not null check(vendor_unit_cost>0),
 proposed_sale_price numeric(12,2) not null check(proposed_sale_price>vendor_unit_cost),
 supply_mode text not null default 'on_demand' check(supply_mode='on_demand'),
 confirmation_policy text not null default 'confirm_per_order' check(confirmation_policy='confirm_per_order'),
 supplier_handover_days integer not null default 1 check(supplier_handover_days between 1 and 14),
 status text not null default 'draft' check(status='draft'),
 source_audit_id bigint,
 note text not null default '' check(char_length(note)<=500),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(product_id,supplier_id)
);
create index vendor_offer_drafts_supplier_idx on public.vendor_offer_drafts(supplier_id,updated_at desc);
alter table public.vendor_offer_drafts enable row level security;
revoke all on public.vendor_offer_drafts from public,anon,authenticated,service_role;
grant select,insert,update on public.vendor_offer_drafts to authenticated;
create policy vendor_offer_drafts_admin_read on public.vendor_offer_drafts for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy vendor_offer_drafts_admin_insert on public.vendor_offer_drafts for insert to authenticated
 with check ((private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
 and updated_by=(select auth.uid())
 and exists(select 1 from public.products p join public.supplier_products sp on sp.product_id=p.id
  join public.suppliers s on s.id=sp.supplier_id
  where p.id=product_id and p.active and not p.is_demo and p.source_type='SUPPLIER_POOL'
  and sp.supplier_id=supplier_id and sp.active and s.active and s.reliability_status<>'blocked'));
create policy vendor_offer_drafts_admin_update on public.vendor_offer_drafts for update to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
 with check ((private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
  and updated_by=(select auth.uid())
  and status='draft'
  and exists(select 1 from public.products p join public.supplier_products sp on sp.product_id=p.id
   join public.suppliers s on s.id=sp.supplier_id
   where p.id=product_id and p.active and not p.is_demo and sp.supplier_id=supplier_id and sp.active and s.active));
-- Restrict identity and relationship updates in place, even for Admin.
create function private.vendor_offer_draft_identity_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if old.product_id is distinct from new.product_id or old.supplier_id is distinct from new.supplier_id
 or old.source_audit_id is distinct from new.source_audit_id and new.source_audit_id is null
 then raise exception 'Draft identity or source cannot be erased';end if;
 new.updated_at=now();return new;
end $$;
create trigger vendor_offer_draft_identity before update on public.vendor_offer_drafts
 for each row execute function private.vendor_offer_draft_identity_guard();
revoke all on function private.vendor_offer_draft_identity_guard() from public,anon,authenticated,service_role;

-- Payment recipients are deliberately separate from Treasury accounts.
-- Only the verified platform owner may configure a public payee account.
create table public.pilot_payment_recipients (
 id uuid primary key default gen_random_uuid(),
 method text not null check(method in ('bkash','bank')),
 account_name text not null check(char_length(btrim(account_name)) between 2 and 100),
 account_number text not null check(char_length(btrim(account_number)) between 8 and 40),
 bank_name text check(bank_name is null or char_length(bank_name)<=120),
 branch_name text check(branch_name is null or char_length(branch_name)<=120),
 active boolean not null default false,
 configured_by uuid not null references auth.users(id),
 configured_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(method<>'bank' or (bank_name is not null and length(btrim(bank_name))>=2))
);
alter table public.pilot_payment_recipients enable row level security;
revoke all on public.pilot_payment_recipients from public,anon,authenticated,service_role;
grant select,insert,update on public.pilot_payment_recipients to authenticated;
create policy pilot_payment_recipient_owner_read on public.pilot_payment_recipients for select
 to authenticated using(private.is_platform_owner((select auth.uid())));
create policy pilot_payment_recipient_owner_insert on public.pilot_payment_recipients for insert
 to authenticated with check(private.is_platform_owner((select auth.uid())) and configured_by=(select auth.uid()));
create policy pilot_payment_recipient_owner_update on public.pilot_payment_recipients for update
 to authenticated using(private.is_platform_owner((select auth.uid())))
 with check(private.is_platform_owner((select auth.uid())) and configured_by=(select auth.uid()));
-- Client can't reassign the payee identity of an existing entry.
create function private.pilot_payment_recipient_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.configured_by is distinct from new.configured_by or old.method is distinct from new.method
 then raise exception 'Payee identity is immutable; create a new entry';end if;
 new.updated_at=now();return new;
end $$;
create trigger pilot_payment_recipient_identity before update on public.pilot_payment_recipients
 for each row execute function private.pilot_payment_recipient_guard();
revoke all on function private.pilot_payment_recipient_guard() from public,anon,authenticated,service_role;

-- Only confirmed pilot bookings can see real recipient details and only the
-- authenticated booking customer can retrieve their own instructions.
create function public.pilot_payment_options(p_booking uuid)
 returns table(id uuid,method text,account_name text,account_number text,bank_name text,branch_name text)
 language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.pilot_booking_requests b
   where b.id=p_booking and b.customer_id=auth.uid() and b.status='confirmed'
   and b.confirmed_unit_price>0 and b.confirmed_delivery_fee>=0
 ) then return;end if;
 return query select d.id,d.method,d.account_name,d.account_number,d.bank_name,d.branch_name
 from public.pilot_payment_recipients d where d.active order by d.method,d.configured_at;
end $$;
revoke all on function public.pilot_payment_options(uuid) from public,anon,service_role;
grant execute on function public.pilot_payment_options(uuid) to authenticated;

-- A payment reference is only a customer's unverified claim. Never change
-- order.payment_status, payment_records, Finance, Treasury or bank balances.
create table public.pilot_booking_payment_claims (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.pilot_booking_requests(id) on delete restrict,
 customer_id uuid not null references auth.users(id),
 recipient_id uuid not null references public.pilot_payment_recipients(id),
 claimed_amount numeric(12,2) not null check(claimed_amount>0),
 reference_code text not null check(char_length(btrim(reference_code)) between 6 and 80),
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 check(reviewed_by is null or reviewed_by<>customer_id),
 check((status='pending' and reviewed_at is null and reviewed_by is null)
  or (status<>'pending' and reviewed_by is not null and reviewed_at is not null and char_length(btrim(review_note))>=10))
);
create unique index pilot_booking_payment_unique_ref on public.pilot_booking_payment_claims(recipient_id,lower(reference_code));
create index pilot_booking_payment_inbox on public.pilot_booking_payment_claims(status,submitted_at desc);
alter table public.pilot_booking_payment_claims enable row level security;
revoke all on public.pilot_booking_payment_claims from public,anon,authenticated,service_role;
grant select on public.pilot_booking_payment_claims to authenticated;
create policy pilot_payment_claim_scoped_read on public.pilot_booking_payment_claims for select
 to authenticated using(customer_id=(select auth.uid())
 or private.has_role((select auth.uid()),'admin')
 or private.has_role((select auth.uid()),'super_admin'));

create function public.pilot_submit_payment_reference(p_booking uuid,p_recipient uuid,p_reference text)
 returns uuid language plpgsql security definer set search_path='' as $$
declare v public.pilot_booking_requests%rowtype;v_payee public.pilot_payment_recipients%rowtype;
 v_amount numeric; v_ref text:=btrim(coalesce(p_reference,''));v_id uuid;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Sign in required';end if;
 select * into v from public.pilot_booking_requests where id=p_booking for update;
 if v.id is null or v.customer_id<>auth.uid() or v.status<>'confirmed'
 then raise exception 'A confirmed booking belonging to you is required';end if;
 select * into v_payee from public.pilot_payment_recipients where id=p_recipient and active;
 if v_payee.id is null then raise exception 'Payment recipient unavailable';end if;
 if length(v_ref) not between 6 and 80 or v_ref !~ '^[[:alnum:]/_-]+$'
 then raise exception 'Enter your real transfer transaction ID (6-80 letters, numbers, /, _ or -)';end if;
 if (select count(*) from public.pilot_booking_payment_claims c
 where c.booking_id=v.id and c.submitted_at>now()-interval '24 hours')>=5
 then raise exception 'Too many payment reference submissions; contact 2TBR staff';end if;
 if exists(select 1 from public.pilot_booking_payment_claims c
 where c.booking_id=v.id and c.status in ('pending','verified'))
 then raise exception 'Payment reference already pending or reviewed for this booking';end if;
 v_amount=round(v.confirmed_unit_price*v.quantity+v.confirmed_delivery_fee,2);
 insert into public.pilot_booking_payment_claims(booking_id,customer_id,recipient_id,claimed_amount,reference_code)
 values(v.id,auth.uid(),v_payee.id,v_amount,v_ref) returning id into v_id;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 select distinct ur.user_id,'pilot_booking','Manual payment reference pending',
 'A customer has submitted a payment transfer reference for a confirmed booking. Verify externally before approval.',
 '/admin/pilot-bookings','high','pilot:payment:'||v_id
 from public.user_roles ur where ur.role in ('admin','super_admin')
 on conflict(user_id,dedupe_key) do nothing;
 return v_id;
end $$;
revoke all on function public.pilot_submit_payment_reference(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.pilot_submit_payment_reference(uuid,uuid,text) to authenticated;

create function public.pilot_staff_review_payment_reference(p_claim uuid,p_approve boolean,p_note text)
 returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); c public.pilot_booking_payment_claims%rowtype;
 v_note text:=btrim(coalesce(p_note,''));
begin
 if v_user is null or not(private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin'))
 then raise exception using errcode='42501',message='Admin required';end if;
 if p_approve is null or length(v_note)<10 or length(v_note)>500
 then raise exception 'A documented verification decision and note of 10-500 characters are required';end if;
 select * into c from public.pilot_booking_payment_claims where id=p_claim for update;
 if c.id is null or c.status<>'pending' or c.customer_id=v_user
 then raise exception 'Pending customer claim and independent reviewer required';end if;
 if p_approve and not exists(select 1 from public.pilot_booking_requests b
 where b.id=c.booking_id and b.customer_id=c.customer_id and b.status='confirmed')
 then raise exception 'Booking must still be confirmed';end if;
 update public.pilot_booking_payment_claims
 set status=case when p_approve then 'verified' else 'rejected' end,
 reviewed_by=v_user,reviewed_at=now(),review_note=v_note where id=c.id;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(c.customer_id,'pilot_booking','Manual payment reference reviewed',
 'Your payment reference has been '||case when p_approve then 'verified by staff (Finance reconciliation pending)' else 'rejected; contact support' end||'.',
 '/pilot-bookings','normal','pilot:payment:review:'||c.id)
 on conflict(user_id,dedupe_key) do nothing;
 return case when p_approve then 'verified' else 'rejected' end;
end $$;
revoke all on function public.pilot_staff_review_payment_reference(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.pilot_staff_review_payment_reference(uuid,boolean,text) to authenticated;

-- Narrow Admin-only read of latest owner-confirmed draft pricing. Preserve
-- audit_events RLS/default-deny and never expose unrelated audit records.
create function public.vendor_offer_admin_price_snapshot()
 returns table(product_id uuid,sku text,supplier_id uuid,vendor_unit_cost numeric,proposed_sale_price numeric,audit_id bigint)
 language plpgsql stable security definer set search_path='' as $vendor_price_rpc$
declare v_event public.audit_events%rowtype;begin
 if auth.uid() is null or not(private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'))
 then raise exception using errcode='42501',message='Admin required';end if;
 select * into v_event from public.audit_events a where a.event_type in
 ('owner_revised_vendor_product_pricing','owner_proposed_vendor_product_pricing')
 and a.metadata->>'direct_exclusive_price_status'='draft_unpublished'
 and jsonb_typeof(a.metadata->'pricing_lines')='array'
 order by a.id desc limit 1;
 if v_event.id is null then return;end if;
 return query
 select p.id,p.sku,sp.supplier_id,
  x.vendor_unit_cost_bdt,x.proposed_customer_unit_price_bdt,v_event.id
 from jsonb_to_recordset(v_event.metadata->'pricing_lines') x(
   product_id uuid,sku text,selling_package_size text,vendor_unit_cost_bdt numeric,proposed_customer_unit_price_bdt numeric)
 join public.products p on p.id=x.product_id and p.sku=x.sku and p.package_size=x.selling_package_size
 join public.supplier_products sp on sp.product_id=p.id and sp.active
 join public.suppliers su on su.id=sp.supplier_id and su.active
 where sp.supplier_id=(v_event.metadata->>'supplier_id')::uuid
 and p.active and not p.is_demo and p.source_type='SUPPLIER_POOL'
 and x.vendor_unit_cost_bdt>0 and x.proposed_customer_unit_price_bdt>x.vendor_unit_cost_bdt;
end $vendor_price_rpc$;
revoke all on function public.vendor_offer_admin_price_snapshot() from public,anon,service_role;
grant execute on function public.vendor_offer_admin_price_snapshot() to authenticated;

-- Non-destructive bootstrap: import only the six authenticated owner's
-- existing, independently audit-preserved draft prices. No customer-facing
-- offer or stock is created, and no live price is automatically published.
-- Disposable databases without that exact audit simply have zero drafts.
do $bootstrap_vendor_offer_drafts$
declare
 v_lines jsonb;
 v_owner uuid;
 v_count integer;
 v_supplier uuid:='0814a10b-f4dd-4239-a267-aeddadb355d6'::uuid;
begin
 select owner_user_id into v_owner from private.platform_owner_identity where singleton;
 select metadata->'pricing_lines' into v_lines from public.audit_events
 where id=958 and event_type='owner_revised_vendor_product_pricing'
 and metadata->>'supplier_id'=v_supplier::text and metadata->>'direct_exclusive_price_status'='draft_unpublished';
 if v_lines is null then return;end if;
 if v_owner is null or jsonb_array_length(v_lines)<>6
 then raise exception 'Six-line owner pricing draft lacks authorized bootstrap identity';end if;
 select count(*) into v_count
 from jsonb_to_recordset(v_lines) p(
 product_id uuid,sku text,selling_package_size text,vendor_unit_cost_bdt numeric,proposed_customer_unit_price_bdt numeric)
 join public.products master on master.id=p.product_id
 and master.sku=p.sku and master.package_size=p.selling_package_size
 and master.active and not master.is_demo and master.source_type='SUPPLIER_POOL'
 join public.supplier_products sp on sp.product_id=master.id
 and sp.supplier_id=v_supplier and sp.active
 join public.suppliers seller on seller.id=sp.supplier_id and seller.active
 where p.vendor_unit_cost_bdt>0 and p.proposed_customer_unit_price_bdt>p.vendor_unit_cost_bdt;
 if v_count<>6 then raise exception 'Six product/vendor/pricing sources do not match; no drafts seeded';end if;
 insert into public.vendor_offer_drafts(
  product_id,supplier_id,vendor_unit_cost,proposed_sale_price,supply_mode,confirmation_policy,
  supplier_handover_days,status,source_audit_id,updated_by,note)
 select p.product_id,v_supplier,p.vendor_unit_cost_bdt,p.proposed_customer_unit_price_bdt,
 'on_demand','confirm_per_order',1,'draft',958,v_owner,
 'Owner-revised source audit #958. Vendor handover next day; customer delivery separately agreed.'
 from jsonb_to_recordset(v_lines) p(
  product_id uuid,sku text,selling_package_size text,vendor_unit_cost_bdt numeric,proposed_customer_unit_price_bdt numeric)
 on conflict(product_id,supplier_id) do nothing;
end $bootstrap_vendor_offer_drafts$;

-- Explicitly no public/anon read of account numbers, and no Finance mutations.
