-- Make customer notifications fulfilment-aware after home delivery is introduced.

create or replace function private.pool_notification_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status='open' then
    for r in select id from public.profiles where community_id=new.community_id and onboarding_completed_at is not null loop
      perform private.enqueue_notification(r.id,'pool_published','New '||initcap(coalesce(new.cadence,'weekly'))||' pool is live',new.title||' is now open. Review target prices and potential savings, then commit what you want.','/pool','pool:'||new.id||':published','high',new.id,null);
    end loop;
  elsif new.status='pricing' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id and c.status in ('active','confirmed') loop
      perform private.enqueue_notification(r.customer_id,'pricing_started','Demand closed — sourcing started',new.title||' is now being priced with suppliers. We will notify you when the final price is ready.','/pool','pool:'||new.id||':pricing','normal',new.id,null);
    end loop;
  elsif new.status='final_price' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id and c.status in ('active','confirmed') loop
      perform private.enqueue_notification(r.customer_id,'final_price','Final pool prices are ready','Check your final prices and exact expected product savings for '||new.title||'.','/pool','pool:'||new.id||':final-price','high',new.id,null);
    end loop;
  elsif new.status='confirmation' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id and c.status='active' loop
      perform private.enqueue_notification(r.customer_id,'confirmation_open','Confirm your purchase',new.title||' is ready for purchase confirmation. Choose FREE community collection or home delivery, then confirm before the deadline.','/orders','pool:'||new.id||':confirmation-open','high',new.id,null);
    end loop;
  elsif new.status='cancelled' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id loop
      perform private.enqueue_notification(r.customer_id,'pool_cancelled','Pool cancelled',new.title||' has been cancelled. No commitment will become a purchase.','/pool','pool:'||new.id||':cancelled','high',new.id,null);
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.pool_notification_trigger() from public;

create or replace function private.order_notification_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_title text; v_pickup text; v_home boolean;
begin
  select title into v_title from public.pools where id=new.pool_id;
  select name into v_pickup from public.pickup_points where id=new.pickup_point_id;
  v_home:=new.fulfillment_method='home_delivery';
  if tg_op='INSERT' then
    if v_home then
      perform private.enqueue_notification(new.customer_id,'order_confirmed','Purchase confirmed','Order '||new.order_code||' is confirmed for '||coalesce(v_title,'your pool')||'. Home delivery is selected; its service charge is shown separately from product savings.','/orders','order:'||new.id||':confirmed','high',new.pool_id,new.id);
    else
      perform private.enqueue_notification(new.customer_id,'order_confirmed','Purchase confirmed','Order '||new.order_code||' is confirmed for '||coalesce(v_title,'your pool')||'. Community collection: FREE at '||coalesce(v_pickup,'your selected point')||'.','/orders','order:'||new.id||':confirmed','high',new.pool_id,new.id);
    end if;
  elsif new.status is distinct from old.status then
    if new.status='ordered' then
      perform private.enqueue_notification(new.customer_id,'order_placed','Supplier order placed','Your order '||new.order_code||' has been placed for sourcing.','/orders','order:'||new.id||':ordered','normal',new.pool_id,new.id);
    elsif new.status='ready_for_pickup' then
      if v_home then
        perform private.enqueue_notification(new.customer_id,'ready_for_delivery','Your order is ready for home delivery','Order '||new.order_code||' is ready for the home-delivery stage. Operations will deliver to your saved order address.','/orders','order:'||new.id||':ready','high',new.pool_id,new.id);
      else
        perform private.enqueue_notification(new.customer_id,'ready_for_pickup','Your order is ready for FREE collection','Order '||new.order_code||' is ready at '||coalesce(v_pickup,'your selected community point')||'.','/pickup','order:'||new.id||':ready','high',new.pool_id,new.id);
      end if;
    elsif new.status='completed' then
      if v_home then
        perform private.enqueue_notification(new.customer_id,'delivery_completed','Home delivery complete — savings verified','Order '||new.order_code||' was delivered. Your product savings are now verified. Please rate the pool and items to finish the journey.','/pool','order:'||new.id||':completed','high',new.pool_id,new.id);
      else
        perform private.enqueue_notification(new.customer_id,'pickup_completed','Collection complete — savings verified','Order '||new.order_code||' was collected. Your product savings are now verified. Please rate the pool and items to finish the journey.','/pool','order:'||new.id||':completed','high',new.pool_id,new.id);
      end if;
    elsif new.status='cancelled' then
      perform private.enqueue_notification(new.customer_id,'order_cancelled','Order cancelled','Order '||new.order_code||' has been cancelled.','/orders','order:'||new.id||':cancelled','high',new.pool_id,new.id);
    end if;
  end if;
  if tg_op='UPDATE' and new.payment_status is distinct from old.payment_status then
    if new.payment_status='paid_manually' then
      perform private.enqueue_notification(new.customer_id,'payment_recorded','Payment recorded','Payment for order '||new.order_code||' has been recorded.','/orders','order:'||new.id||':payment:paid','normal',new.pool_id,new.id);
    elsif new.payment_status='payment_pending' then
      perform private.enqueue_notification(new.customer_id,'payment_pending','Payment pending','Payment for order '||new.order_code||' is pending.','/orders','order:'||new.id||':payment:pending','normal',new.pool_id,new.id);
    elsif new.payment_status='refunded' then
      perform private.enqueue_notification(new.customer_id,'payment_refunded','Refund recorded','A refund has been recorded for order '||new.order_code||'.','/orders','order:'||new.id||':payment:refunded','high',new.pool_id,new.id);
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.order_notification_trigger() from public;

create or replace function private.run_notification_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare p record; r record; n integer:=0; v_joined boolean; v_review_done boolean;
begin
  for p in select * from public.pools where status='open' and commitment_closes_at is not null and commitment_closes_at>now() and commitment_closes_at<=now()+interval '24 hours' loop
    for r in select id from public.profiles where community_id=p.community_id and onboarding_completed_at is not null loop
      select exists(select 1 from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p.id and c.customer_id=r.id and c.status in ('active','confirmed')) into v_joined;
      if p.commitment_closes_at<=now()+interval '3 hours' then
        if private.enqueue_notification(r.id,'commitment_deadline',case when v_joined then '3 hours left — review your commitment' else '3 hours left to join this pool' end,p.title||case when v_joined then ': check your quantities before commitment closes.' else ': commit any items you want before the window closes.' end,'/pool','pool:'||p.id||':commitment-3h','high',p.id,null) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.id,'commitment_deadline',case when v_joined then 'Commitment closes within 24 hours' else 'Last day to join this pool' end,p.title||case when v_joined then ': review your quantities while changes are still open.' else ': review target prices and join before demand closes.' end,'/pool','pool:'||p.id||':commitment-24h','normal',p.id,null) is not null then n:=n+1; end if;
    end loop;
  end loop;

  for p in select * from public.pools where status='confirmation' and confirmation_closes_at is not null and confirmation_closes_at>now() and confirmation_closes_at<=now()+interval '24 hours' loop
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p.id and c.status='active' loop
      if p.confirmation_closes_at<=now()+interval '3 hours' then
        if private.enqueue_notification(r.customer_id,'confirmation_deadline','3 hours left to confirm purchase',p.title||': review final product prices and choose FREE collection or home delivery.','/orders','pool:'||p.id||':confirm-3h','high',p.id,null) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.customer_id,'confirmation_deadline','Purchase confirmation closes within 24 hours',p.title||': review final product prices, savings, and fulfilment choice.','/orders','pool:'||p.id||':confirm-24h','high',p.id,null) is not null then n:=n+1; end if;
    end loop;
  end loop;

  for r in select o.*,p.pickup_at,p.title as pool_title,pp.name as pickup_name from public.orders o join public.pools p on p.id=o.pool_id left join public.pickup_points pp on pp.id=o.pickup_point_id where o.status in ('confirmed','ordered','ready_for_pickup') and p.pickup_at is not null and p.pickup_at>now() and p.pickup_at<=now()+interval '24 hours' loop
    if r.fulfillment_method='home_delivery' then
      if r.pickup_at<=now()+interval '3 hours' then
        if private.enqueue_notification(r.customer_id,'delivery_reminder','Home-delivery window starts soon','Order '||r.order_code||' is approaching the community fulfilment window. Delivery charge remains separate from product savings.','/orders','order:'||r.id||':delivery-3h','high',r.pool_id,r.id) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.customer_id,'delivery_reminder','Home delivery is within 24 hours','Order '||r.order_code||' is scheduled for the upcoming community fulfilment window.','/orders','order:'||r.id||':delivery-24h','normal',r.pool_id,r.id) is not null then n:=n+1; end if;
    else
      if r.pickup_at<=now()+interval '3 hours' then
        if private.enqueue_notification(r.customer_id,'pickup_reminder','FREE collection in about 3 hours','Order '||r.order_code||' · '||coalesce(r.pickup_name,'selected community point')||'.','/pickup','order:'||r.id||':pickup-3h','high',r.pool_id,r.id) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.customer_id,'pickup_reminder','FREE collection is within 24 hours','Order '||r.order_code||' will be collected at '||coalesce(r.pickup_name,'your selected community point')||'.','/pickup','order:'||r.id||':pickup-24h','normal',r.pool_id,r.id) is not null then n:=n+1; end if;
    end if;
  end loop;

  for r in select o.* from public.orders o where o.status='completed' and o.completed_at is not null and o.completed_at>now()-interval '30 days' and o.completed_at<=now()-interval '2 hours' loop
    select exists(select 1 from public.pool_reviews pr where pr.user_id=r.customer_id and pr.pool_id=r.pool_id) and not exists(select 1 from public.order_items oi where oi.order_id=r.id and not exists(select 1 from public.pool_item_reviews pir where pir.user_id=r.customer_id and pir.pool_item_id=oi.pool_item_id)) into v_review_done;
    if not v_review_done then
      if r.completed_at<=now()-interval '24 hours' then
        if private.enqueue_notification(r.customer_id,'review_reminder','How was your order?','Your verified-buyer review helps neighbors decide what to join next. Rate the pool and purchased items.','/pool','order:'||r.id||':review-24h','normal',r.pool_id,r.id) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.customer_id,'review_reminder','Rate your completed order','Your product savings are verified. Take a moment to rate the pool and the items you received.','/pool','order:'||r.id||':review-2h','normal',r.pool_id,r.id) is not null then n:=n+1; end if;
    end if;
  end loop;
  return n;
end; $$;
revoke all on function private.run_notification_reminders() from public;
