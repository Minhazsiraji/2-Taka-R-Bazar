alter table public.subscription_coupons
  add column if not exists new_customers_only boolean not null default true;

create or replace function public.admin_create_subscription_coupon(
  p_code text,p_months integer,p_max_redemptions integer default null,
  p_expires_at timestamptz default null,p_notes text default null,p_new_customers_only boolean default true
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_code text:=upper(regexp_replace(trim(p_code),'[^A-Za-z0-9_-]','','g'));
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required'; end if;
  if length(v_code)<4 then raise exception 'Coupon code must be at least 4 characters'; end if;
  if p_months not in (1,2,3) then raise exception 'Free coupon must grant 1, 2, or 3 months'; end if;
  insert into public.subscription_coupons(code,months_free,max_redemptions,expires_at,notes,created_by,new_customers_only)
  values(v_code,p_months,p_max_redemptions,p_expires_at,nullif(trim(p_notes),''),auth.uid(),coalesce(p_new_customers_only,true))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.admin_create_subscription_coupon(text,integer,integer,timestamptz,text,boolean) from public,anon;
grant execute on function public.admin_create_subscription_coupon(text,integer,integer,timestamptz,text,boolean) to authenticated;
create or replace function public.redeem_subscription_coupon(p_code text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_coupon public.subscription_coupons%rowtype; v_start timestamptz; v_until timestamptz;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_coupon from public.subscription_coupons where upper(code)=upper(trim(p_code)) for update;
  if not found or not v_coupon.active then raise exception 'Coupon is not valid'; end if;
  if v_coupon.starts_at>now() or (v_coupon.expires_at is not null and v_coupon.expires_at<now()) then raise exception 'Coupon is not currently valid'; end if;
  if v_coupon.max_redemptions is not null and v_coupon.redeemed_count>=v_coupon.max_redemptions then raise exception 'Coupon redemption limit reached'; end if;
  if exists(select 1 from public.subscription_coupon_redemptions where coupon_id=v_coupon.id and user_id=v_user) then raise exception 'You already used this coupon'; end if;
  if v_coupon.new_customers_only and (
    exists(select 1 from public.subscription_coupon_redemptions where user_id=v_user)
    or exists(select 1 from public.subscription_invoices where customer_id=v_user and status='paid')
  ) then raise exception 'This coupon is only for new customers'; end if;
  select greatest(now(),coalesce(valid_until,now())) into v_start from public.subscription_memberships where user_id=v_user;
  if v_start is null then v_start:=now(); end if;
  v_until:=v_start+make_interval(months=>v_coupon.months_free);
  insert into public.subscription_coupon_redemptions(coupon_id,user_id,months_granted,valid_from,valid_until)
  values(v_coupon.id,v_user,v_coupon.months_free,v_start,v_until);
  update public.subscription_coupons set redeemed_count=redeemed_count+1 where id=v_coupon.id;
  insert into public.subscription_memberships(user_id,valid_until,source,updated_at)
  values(v_user,v_until,'coupon:'||v_coupon.code,now())
  on conflict(user_id) do update set valid_until=excluded.valid_until,source=excluded.source,updated_at=now();
  update public.subscription_invoices set status='waived',updated_at=now(),admin_note='Covered by coupon redemption'
    where customer_id=v_user and status='unpaid' and period_end<=v_until;
  perform private.enqueue_notification(v_user,'subscription_coupon','Free membership activated',v_coupon.months_free||' month(s) of pool access are active.','/subscription','subscription:coupon:'||v_coupon.id,'normal',null,null);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'subscription_coupon_redeemed','subscription_coupon',v_coupon.id,jsonb_build_object('months',v_coupon.months_free,'valid_until',v_until));
  return v_until;
end; $$;
