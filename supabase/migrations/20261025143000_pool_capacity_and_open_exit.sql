-- Qualify and enable the published 1-20-item Community Pool promise.
-- No data migrations, customer/order changes, or financial writes.
do $pool_capacity$
declare original text; rewritten text;
begin
 select pg_get_functiondef('public.admin_save_simple_offer_with_tiers(uuid,text,uuid[],text,jsonb,boolean,timestamptz,jsonb)'::regprocedure)
 into original;
 if original is null or position('jsonb_array_length(p_items) not between 1 and 6' in original)=0
 then raise exception 'Admin offer validator changed: review Pool capacity migration';end if;
 rewritten:=replace(original,
  'jsonb_array_length(p_items) not between 1 and 6',
  'jsonb_array_length(p_items) not between 1 and case when p_kind=''COMMUNITY_POOL'' then 20 else 6 end');
 rewritten:=replace(rewritten,'Select 1–6 products',
  'Select 1–20 Pool products, or 1–6 products for other offers');
 execute rewritten;

 select pg_get_functiondef('private.join_simple_sale_cycle_impl(uuid,jsonb,uuid,uuid)'::regprocedure)
 into original;
 if original is null or position('jsonb_array_length(p_lines) not between 1 and 6' in original)=0
 then raise exception 'Community-cycle validator changed: review Pool capacity migration';end if;
 rewritten:=replace(original,
  'jsonb_array_length(p_lines) not between 1 and 6',
  'jsonb_array_length(p_lines) not between 1 and 20');
 rewritten:=replace(rewritten,'Choose 1–6 products','Choose 1–20 Pool products');
 execute rewritten;
 -- The existing GROUP_DEAL=one-product constraint remains in that function.
end $pool_capacity$;

-- Atomic full-basket withdrawal while a Pool round is still OPEN.
-- This does not modify a closed round's immutable quote or prior order.
create or replace function public.leave_simple_sale_pool(p_offer uuid)
returns boolean language plpgsql security definer set search_path='' as $pool_leave$
declare
 u uuid:=auth.uid(); pool_cycle uuid; pool_area uuid; removed integer;
begin
 if u is null then raise exception 'Sign in first';end if;
 select cy.id,cy.community_id into pool_cycle,pool_area
 from public.simple_sale_cycles cy
 join public.simple_sale_cycle_members m on m.cycle_id=cy.id and m.customer_id=u
 join public.simple_sale_offers o on o.id=cy.offer_id and o.kind='COMMUNITY_POOL'
 where cy.offer_id=p_offer and cy.status='open'
 order by cy.opened_at desc limit 1;
 if pool_cycle is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||pool_area::text,84199));
 perform 1 from public.simple_sale_cycles
 where id=pool_cycle and status='open' for update;
 if not found then return false;end if;
 delete from public.simple_sale_cycle_items
 where cycle_id=pool_cycle and customer_id=u;
 get diagnostics removed=row_count;
 if removed=0 then return false;end if;
 delete from public.simple_sale_cycle_members
 where cycle_id=pool_cycle and customer_id=u;
 update public.simple_sale_offer_joins set status='cancelled',updated_at=now()
 where offer_id=p_offer and customer_id=u and status='active';
 delete from public.simple_sale_commitment_items
 where offer_id=p_offer and customer_id=u;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(u,'pool_left','Open Pool commitment cancelled',
  'Your open Pool commitment was withdrawn without an order or payment.',
  '/account/commitments','normal','pool_leave:'||pool_cycle::text||':'||u::text)
 on conflict(user_id,dedupe_key) do update set read_at=null,created_at=now();
 return true;
end $pool_leave$;
revoke all on function public.leave_simple_sale_pool(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.leave_simple_sale_pool(uuid) to authenticated;
