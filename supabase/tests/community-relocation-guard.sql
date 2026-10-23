-- Rollback-only synthetic scenario; never changes live users or communities.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
do $scenario$
declare
  buyer uuid:=gen_random_uuid(); maker uuid:=gen_random_uuid();
  area_a uuid:=gen_random_uuid(); area_b uuid:=gen_random_uuid();
  item_id uuid:=gen_random_uuid(); scenario_offer uuid; cycle_id uuid;
  rejected boolean; old_name text;
begin
  insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
  select user_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'house-move-'||user_id||'@example.invalid',now(),now()
  from unnest(array[buyer,maker]) as users(user_id);
  insert into public.user_roles(user_id,role) values(maker,'admin');
  insert into public.communities(id,name,slug,active) values
    (area_a,'Test move A','move-a-'||area_a,true),
    (area_b,'Test move B','move-b-'||area_b,true);
  update public.profiles set community_id=area_a,
    full_name='Fictional relocating member',household_name='Test household',
    phone='01700199101',address_hint='Old Road, Test A',onboarding_completed_at=now()
  where id=buyer;
  if not found then raise exception 'Missing hypothetical profile';end if;
  insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
  values(item_id,'Synthetic butter','Dairy','1 kg','kg','MOVING-'||item_id,'SUPPLIER_POOL',true,false);
  perform set_config('request.jwt.claim.sub',maker::text,true);
  scenario_offer:=public.admin_save_simple_offer_with_tiers(
    null,'GROUP_DEAL',array[area_a,area_b],'House relocation test',
    jsonb_build_array(jsonb_build_object('product_id',item_id,'price',100,
      'old_price',130,'available_quantity',100)),
    true,now()+interval '7 days',
    jsonb_build_array(jsonb_build_object('threshold',5,'prices',
      jsonb_build_array(jsonb_build_object('product_id',item_id,'price',90)))));
  if scenario_offer is null then raise exception 'Cannot publish synthetic Deal';end if;
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  perform public.join_simple_sale_group_deal_quantified(scenario_offer,item_id,area_a,1);
  select c.id into cycle_id from public.simple_sale_cycles c
   where c.offer_id=scenario_offer and c.community_id=area_a and c.status='open';
  if cycle_id is null then raise exception 'Synthetic cycle not created';end if;
  rejected:=false;
  begin
    update public.profiles set community_id=area_b,address_hint='New Road, Test B' where id=buyer;
  exception when others then rejected:=true;end;
  if not rejected then raise exception 'Active commitment was transferred to another area';end if;
  if (select community_id from public.profiles where id=buyer)<>area_a then
    raise exception 'Rejected relocation changed the household anyway';end if;
  perform public.leave_simple_sale_group_deal(scenario_offer,item_id);
  update public.profiles set community_id=area_b,address_hint='New Road, Test B',
    pickup_point_id=null where id=buyer;
  if (select community_id from public.profiles where id=buyer)<>area_b then
    raise exception 'Resolved member could not move';end if;
  if (select count(*) from private.profile_community_move_audit where profile_id=buyer
      and previous_community_id=area_a and new_community_id=area_b)<>1 then
    raise exception 'Relocation audit was not recorded exactly once';end if;
  rejected:=false;
  begin
    insert into public.simple_sale_cycle_members(cycle_id,customer_id)
    values(cycle_id,buyer);
  exception when others then rejected:=true;end;
  if not rejected then raise exception 'Former community membership could be forged after moving';end if;
  if exists(select 1 from public.simple_sale_cycle_members m where m.customer_id=buyer) then
    raise exception 'Former area membership unexpectedly returned';end if;
  if exists(select 1 from public.simple_sale_cycle_quotes q where q.customer_id=buyer) then
    raise exception 'Moving created an unwanted payment quote';end if;
end
$scenario$;
select pass('fictional relocation preserves identity and order history, rejects active commitments and cross-area rejoin, logs resolved move');
select * from finish();
rollback;
