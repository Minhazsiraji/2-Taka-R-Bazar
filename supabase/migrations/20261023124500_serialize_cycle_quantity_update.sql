-- Serialize cart-quantity updates with community close/reopen, so no updates
-- can slip between the locked price snapshot and the cycle status transition.
create or replace function public.set_simple_sale_commitment_quantity(
 p_offer uuid,p_product uuid,p_quantity integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();community uuid;active_cycle uuid;
begin
 if u is null then raise exception 'Sign in first';end if;
 if p_quantity is null or p_quantity not between 1 and 100 then
  raise exception 'Choose 1–100 units';end if;
 select cy.community_id into community from public.simple_sale_cycles cy
 join public.simple_sale_cycle_items ci on ci.cycle_id=cy.id
 where ci.customer_id=u and ci.product_id=p_product and cy.offer_id=p_offer
 order by cy.cycle_number desc limit 1;
 if community is null then raise exception 'No commitment found';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||community::text,84199));
 select cy.id into active_cycle from public.simple_sale_cycles cy
 join public.simple_sale_cycle_items ci on ci.cycle_id=cy.id
 where ci.customer_id=u and ci.product_id=p_product and cy.offer_id=p_offer
 and cy.community_id=community and cy.status='open'
 and (cy.closes_at is null or cy.closes_at>now())
 order by cy.cycle_number desc
 limit 1 for update of cy,ci;
 if active_cycle is null then
  raise exception 'Your community cycle has closed. Review your locked final quote instead';end if;
 update public.simple_sale_cycle_items
 set quantity=p_quantity,updated_at=now()
 where cycle_id=active_cycle and customer_id=u and product_id=p_product;
 update public.simple_sale_commitment_items
 set quantity=p_quantity,updated_at=now()
 where offer_id=p_offer and customer_id=u and product_id=p_product;
 return true;
end $$;
revoke all on function public.set_simple_sale_commitment_quantity(uuid,uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.set_simple_sale_commitment_quantity(uuid,uuid,integer) to authenticated;
