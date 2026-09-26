create or replace function private.run_notification_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare poolrec record; userrec record; orderrec record; n integer:=0; v_joined boolean; v_review_done boolean;
begin
  for poolrec in select * from public.pools where status='open' and commitment_closes_at is not null and commitment_closes_at>now() and commitment_closes_at<=now()+interval '24 hours' loop
    for userrec in select id from public.profiles where community_id=poolrec.community_id and onboarding_completed_at is not null loop
      select exists(select 1 from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=poolrec.id and c.customer_id=userrec.id and c.status in ('active','confirmed')) into v_joined;
      if poolrec.commitment_closes_at<=now()+interval '3 hours' then
        if private.enqueue_notification(userrec.id,'commitment_deadline',case when v_joined then '3 hours left — review your commitment' else '3 hours left to join this pool' end,poolrec.title||case when v_joined then ': check your quantities before commitment closes.' else ': commit any items you want before the window closes.' end,'/pool','pool:'||poolrec.id||':commitment-3h','high',poolrec.id,null) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(userrec.id,'commitment_deadline',case when v_joined then 'Commitment closes within 24 hours' else 'Last day to join this pool' end,poolrec.title||case when v_joined then ': review your quantities while changes are still open.' else ': review target prices and join before demand closes.' end,'/pool','pool:'||poolrec.id||':commitment-24h','normal',poolrec.id,null) is not null then n:=n+1; end if;
    end loop;
  end loop;

  for poolrec in select * from public.pools where status='confirmation' and confirmation_closes_at is not null and confirmation_closes_at>now() and confirmation_closes_at<=now()+interval '24 hours' loop
    for userrec in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=poolrec.id and c.status='active' and not exists(select 1 from public.orders o where o.pool_id=poolrec.id and o.customer_id=c.customer_id and o.status<>'cancelled') loop
      if poolrec.confirmation_closes_at<=now()+interval '3 hours' then
        if private.enqueue_notification(userrec.customer_id,'confirmation_deadline','3 hours left to confirm purchase',poolrec.title||': confirm your purchase and pickup point before the deadline.','/orders','pool:'||poolrec.id||':confirm-3h','high',poolrec.id,null) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(userrec.customer_id,'confirmation_deadline','Purchase confirmation closes within 24 hours',poolrec.title||': review final prices, savings, and pickup choices.','/orders','pool:'||poolrec.id||':confirm-24h','high',poolrec.id,null) is not null then n:=n+1; end if;
    end loop;
  end loop;

  for orderrec in select o.*,pooldata.pickup_at,pooldata.title as pool_title,pp.name as pickup_name from public.orders o join public.pools pooldata on pooldata.id=o.pool_id left join public.pickup_points pp on pp.id=o.pickup_point_id where o.status in ('confirmed','ordered','ready_for_pickup') and pooldata.pickup_at is not null and pooldata.pickup_at>now() and pooldata.pickup_at<=now()+interval '24 hours' loop
    if orderrec.pickup_at<=now()+interval '3 hours' then
      if private.enqueue_notification(orderrec.customer_id,'pickup_reminder','Pickup in about 3 hours','Order '||orderrec.order_code||' · '||coalesce(orderrec.pickup_name,'selected pickup point')||'.','/pickup','order:'||orderrec.id||':pickup-3h','high',orderrec.pool_id,orderrec.id) is not null then n:=n+1; end if;
    elsif private.enqueue_notification(orderrec.customer_id,'pickup_reminder','Pickup is within 24 hours','Order '||orderrec.order_code||' will be collected at '||coalesce(orderrec.pickup_name,'your selected pickup point')||'.','/pickup','order:'||orderrec.id||':pickup-24h','normal',orderrec.pool_id,orderrec.id) is not null then n:=n+1; end if;
  end loop;

  for orderrec in select o.* from public.orders o where o.status='completed' and o.completed_at is not null and o.completed_at>now()-interval '30 days' and o.completed_at<=now()-interval '2 hours' loop
    select exists(select 1 from public.pool_reviews pr where pr.user_id=orderrec.customer_id and pr.pool_id=orderrec.pool_id) and not exists(select 1 from public.order_items oi where oi.order_id=orderrec.id and not exists(select 1 from public.pool_item_reviews pir where pir.user_id=orderrec.customer_id and pir.pool_item_id=oi.pool_item_id)) into v_review_done;
    if not v_review_done then
      if orderrec.completed_at<=now()-interval '24 hours' then
        if private.enqueue_notification(orderrec.customer_id,'review_reminder','How was your pool?','Your verified-buyer review helps neighbors decide what to join next. Rate the pool and purchased items.','/pool','order:'||orderrec.id||':review-24h','normal',orderrec.pool_id,orderrec.id) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(orderrec.customer_id,'review_reminder','Rate your completed pickup','Your savings are verified. Take a moment to rate the pool and the items you collected.','/pool','order:'||orderrec.id||':review-2h','normal',orderrec.pool_id,orderrec.id) is not null then n:=n+1; end if;
    end if;
  end loop;
  return n;
end; $$;
revoke all on function private.run_notification_reminders() from public;