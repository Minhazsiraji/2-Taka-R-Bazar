-- Group Deal expiry automation + failed-deal purchase-contact workflow.
-- 0..(minimum-1) qualified buyers at close => auto-cancel.
-- minimum+ qualified buyers at close => auto-lock at the earned tier.
-- Failed participants may request the same product at the original market/reference price.

create table if not exists public.group_deal_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  group_deal_id uuid not null references public.group_deals(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  requested_quantity integer not null check (requested_quantity between 1 and 100),
  requested_unit_price numeric(12,2) not null check (requested_unit_price > 0),
  status text not null default 'requested'
    check (status in ('requested','contacted','closed','cancelled')),
  customer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_deal_id,customer_id)
);
create index if not exists group_deal_purchase_requests_status_idx
  on public.group_deal_purchase_requests(status,created_at desc);
create index if not exists group_deal_purchase_requests_customer_idx
  on public.group_deal_purchase_requests(customer_id,created_at desc);

alter table public.group_deal_purchase_requests enable row level security;
revoke all on public.group_deal_purchase_requests from anon,authenticated,service_role;

create or replace function private.process_expired_group_deals()
returns table(locked_count integer,cancelled_count integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  d public.group_deals%rowtype;
  r record;
  v_buyers bigint;
  v_units bigint;
  v_price numeric;
  v_locked integer:=0;
  v_cancelled integer:=0;
  v_reason constant text:='Minimum buyer threshold not reached';
begin
  for d in
    select *
    from public.group_deals
    where status='open' and closes_at<=now()
    order by closes_at,id
    for update skip locked
  loop
    -- A forming circle never reached the minimum nearby-person threshold.
    update public.group_deal_commitments
      set status='cancelled',
          cancelled_at=coalesce(cancelled_at,now()),
          cancellation_reason='circle_below_minimum_at_close',
          updated_at=now()
    where group_deal_id=d.id and status='forming';

    select count(distinct customer_id),coalesce(sum(quantity),0)
      into v_buyers,v_units
    from public.group_deal_commitments
    where group_deal_id=d.id and status='qualified';

    if v_buyers<d.min_group_size then
      update public.group_deal_commitments
        set status='cancelled',
            cancelled_at=coalesce(cancelled_at,now()),
            cancellation_reason='minimum_buyer_threshold_not_reached',
            updated_at=now()
      where group_deal_id=d.id and status='qualified';

      update public.group_deals
        set status='cancelled',
            cancellation_reason=v_reason,
            updated_at=now()
      where id=d.id and status='open';

      for r in
        select distinct gc.customer_id
        from public.group_deal_commitments gc
        where gc.group_deal_id=d.id
          and gc.cancellation_reason in ('circle_below_minimum_at_close','minimum_buyer_threshold_not_reached')
      loop
        perform private.enqueue_notification(
          r.customer_id,
          'group_deal_minimum_not_reached',
          'Group Deal not unlocked',
          d.title||' closed with fewer than '||d.min_group_size||' verified buyers. No order was created and no payment is due. If you still want the product at the initial price of ৳'||trim(to_char(d.market_price_snapshot,'FM999999990D00'))||', open Group Deals and send us a request.',
          '/group-deals?failed='||d.id::text,
          'group-deal:'||d.id::text||':minimum-not-reached',
          'high',
          null,
          null
        );
      end loop;

      insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
      values(null,'group_deal_auto_cancelled','group_deal',d.id,
        jsonb_build_object(
          'reason',v_reason,
          'qualified_buyers',v_buyers,
          'minimum_buyers',d.min_group_size,
          'market_price',d.market_price_snapshot
        ));
      v_cancelled:=v_cancelled+1;
    else
      v_price:=private.group_deal_price(d.id,v_buyers);
      if v_price is null then
        -- Fail safely instead of inventing a price.
        update public.group_deals
          set status='cancelled',
              cancellation_reason='No unlocked price existed for the qualified buyer count',
              updated_at=now()
        where id=d.id and status='open';
        update public.group_deal_commitments
          set status='cancelled',
              cancelled_at=coalesce(cancelled_at,now()),
              cancellation_reason='no_unlocked_price_at_close',
              updated_at=now()
        where group_deal_id=d.id and status='qualified';

        for r in
          select distinct customer_id
          from public.group_deal_commitments
          where group_deal_id=d.id and cancellation_reason='no_unlocked_price_at_close'
        loop
          perform private.enqueue_notification(
            r.customer_id,
            'group_deal_cancelled',
            'Group Deal cancelled',
            d.title||' could not be locked safely because no valid unlocked price was available. No order was created and no payment is due.',
            '/group-deals',
            'group-deal:'||d.id::text||':no-price-cancelled',
            'high',
            null,
            null
          );
        end loop;
        v_cancelled:=v_cancelled+1;
      else
        update public.group_deals
          set status='locked',
              locked_buyer_count=v_buyers,
              locked_unit_quantity=v_units,
              locked_unit_price=v_price,
              locked_at=now(),
              updated_at=now()
        where id=d.id and status='open';

        for r in
          select distinct customer_id
          from public.group_deal_commitments
          where group_deal_id=d.id and status='qualified'
        loop
          perform private.enqueue_notification(
            r.customer_id,
            'group_deal_locked',
            'Group Deal unlocked — price locked',
            d.title||' reached '||v_buyers||' verified buyers. Your unlocked unit price is ৳'||trim(to_char(v_price,'FM999999990D00'))||'. Operations will now move the deal into procurement.',
            '/group-deals',
            'group-deal:'||d.id::text||':auto-locked',
            'high',
            null,
            null
          );
        end loop;

        insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
        values(null,'group_deal_auto_locked','group_deal',d.id,
          jsonb_build_object('qualified_buyers',v_buyers,'units',v_units,'locked_price',v_price));
        v_locked:=v_locked+1;
      end if;
    end if;
  end loop;

  return query select v_locked,v_cancelled;
end
$$;
revoke all on function private.process_expired_group_deals() from public,anon,authenticated,service_role;

create or replace function public.get_my_failed_group_deals()
returns table(
  deal_id uuid,
  title text,
  product_name text,
  brand text,
  package_size text,
  image_url text,
  initial_price numeric,
  cancellation_reason text,
  my_quantity integer,
  request_id uuid,
  request_status text,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select
    d.id,
    d.title,
    p.name,
    p.brand,
    p.package_size,
    p.image_url,
    d.market_price_snapshot,
    d.cancellation_reason,
    gc.quantity,
    req.id,
    req.status,
    req.created_at
  from public.group_deal_commitments gc
  join public.group_deals d on d.id=gc.group_deal_id
  join public.products p on p.id=d.product_id
  left join public.group_deal_purchase_requests req
    on req.group_deal_id=d.id and req.customer_id=gc.customer_id
  where gc.customer_id=auth.uid()
    and d.status='cancelled'
    and d.cancellation_reason='Minimum buyer threshold not reached'
    and gc.cancellation_reason in ('circle_below_minimum_at_close','minimum_buyer_threshold_not_reached')
    and d.updated_at>=now()-interval '90 days'
  order by d.updated_at desc;
$$;
revoke all on function public.get_my_failed_group_deals() from public,anon,authenticated,service_role;
grant execute on function public.get_my_failed_group_deals() to authenticated;

create or replace function public.request_failed_group_deal_initial_price(
  p_group_deal_id uuid,
  p_quantity integer default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_deal public.group_deals%rowtype;
  v_commitment public.group_deal_commitments%rowtype;
  v_qty integer;
  v_request uuid;
  a record;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_deal
  from public.group_deals
  where id=p_group_deal_id
    and status='cancelled'
    and cancellation_reason='Minimum buyer threshold not reached';
  if not found then raise exception 'This failed Group Deal is not eligible for an initial-price request'; end if;

  select * into v_commitment
  from public.group_deal_commitments
  where group_deal_id=p_group_deal_id
    and customer_id=v_user
    and cancellation_reason in ('circle_below_minimum_at_close','minimum_buyer_threshold_not_reached')
  limit 1;
  if not found then raise exception 'You did not participate in this failed Group Deal'; end if;

  v_qty:=coalesce(p_quantity,v_commitment.quantity);
  if v_qty<1 or v_qty>v_deal.max_quantity_per_buyer then
    raise exception 'Choose a quantity between 1 and %',v_deal.max_quantity_per_buyer;
  end if;

  insert into public.group_deal_purchase_requests(
    group_deal_id,customer_id,requested_quantity,requested_unit_price,status,customer_note,updated_at
  ) values(
    p_group_deal_id,v_user,v_qty,v_deal.market_price_snapshot,'requested',nullif(btrim(coalesce(p_note,'')),''),now()
  )
  on conflict(group_deal_id,customer_id) do update set
    requested_quantity=excluded.requested_quantity,
    requested_unit_price=excluded.requested_unit_price,
    status='requested',
    customer_note=excluded.customer_note,
    updated_at=now()
  returning id into v_request;

  perform private.enqueue_notification(
    v_user,
    'group_deal_initial_price_request',
    'Request sent to 2-TAKA-R-BAZAR',
    'We received your request for '||v_qty||' unit(s) of '||v_deal.title||' at the initial price of ৳'||trim(to_char(v_deal.market_price_snapshot,'FM999999990D00'))||'. Our team will contact you.',
    '/group-deals',
    'group-deal:'||p_group_deal_id::text||':initial-price-request:'||v_request::text,
    'normal',
    null,
    null
  );

  for a in
    select distinct ur.user_id
    from public.user_roles ur
    where ur.role in ('admin','super_admin')
  loop
    perform private.enqueue_notification(
      a.user_id,
      'group_deal_purchase_request',
      'Customer wants failed Group Deal product',
      'A customer requested '||v_qty||' unit(s) from '||v_deal.title||' at the initial price of ৳'||trim(to_char(v_deal.market_price_snapshot,'FM999999990D00'))||'. Open Group Deal admin to contact them.',
      '/admin/group-deals',
      'group-deal-request:'||v_request::text,
      'high',
      null,
      null
    );
  end loop;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'group_deal_initial_price_requested','group_deal',p_group_deal_id,
    jsonb_build_object('request_id',v_request,'quantity',v_qty,'unit_price',v_deal.market_price_snapshot));

  return v_request;
end
$$;
revoke all on function public.request_failed_group_deal_initial_price(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.request_failed_group_deal_initial_price(uuid,integer,text) to authenticated;

create or replace function public.admin_get_group_deal_purchase_requests()
returns table(
  request_id uuid,
  group_deal_id uuid,
  deal_title text,
  product_name text,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  requested_quantity integer,
  requested_unit_price numeric,
  request_status text,
  customer_note text,
  admin_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not private.is_ops(auth.uid()) then raise exception 'Admin required'; end if;
  return query
  select
    req.id,req.group_deal_id,d.title,p.name,req.customer_id,
    pr.full_name,pr.phone,req.requested_quantity,req.requested_unit_price,
    req.status,req.customer_note,req.admin_note,req.created_at,req.updated_at
  from public.group_deal_purchase_requests req
  join public.group_deals d on d.id=req.group_deal_id
  join public.products p on p.id=d.product_id
  join public.profiles pr on pr.id=req.customer_id
  order by case req.status when 'requested' then 0 when 'contacted' then 1 else 2 end,req.created_at desc;
end
$$;
revoke all on function public.admin_get_group_deal_purchase_requests() from public,anon,authenticated,service_role;
grant execute on function public.admin_get_group_deal_purchase_requests() to authenticated;

create or replace function public.admin_set_group_deal_purchase_request_status(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_req public.group_deal_purchase_requests%rowtype;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if p_status not in ('requested','contacted','closed','cancelled') then raise exception 'Invalid request status'; end if;

  select * into v_req from public.group_deal_purchase_requests where id=p_request_id for update;
  if not found then raise exception 'Purchase request not found'; end if;

  update public.group_deal_purchase_requests
    set status=p_status,admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),updated_at=now()
  where id=p_request_id;

  if p_status='contacted' then
    perform private.enqueue_notification(
      v_req.customer_id,
      'group_deal_request_contacted',
      'We are contacting you about your product request',
      'Our team has started handling your request to buy the failed Group Deal product at the initial price.',
      '/group-deals',
      'group-deal-request:'||p_request_id::text||':contacted',
      'normal',null,null
    );
  elsif p_status='closed' then
    perform private.enqueue_notification(
      v_req.customer_id,
      'group_deal_request_closed',
      'Product request completed',
      'Your request related to the failed Group Deal has been closed by our team.',
      '/group-deals',
      'group-deal-request:'||p_request_id::text||':closed',
      'normal',null,null
    );
  end if;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'group_deal_purchase_request_status_changed','group_deal_purchase_request',p_request_id,
    jsonb_build_object('status',p_status,'note',p_admin_note));
end
$$;
revoke all on function public.admin_set_group_deal_purchase_request_status(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_set_group_deal_purchase_request_status(uuid,text,text) to authenticated;

do $$ begin
  perform cron.unschedule('2taka-group-deal-expiry');
exception when others then null; end $$;

select cron.schedule(
  '2taka-group-deal-expiry',
  '*/5 * * * *',
  $$select * from private.process_expired_group_deals();$$
);
