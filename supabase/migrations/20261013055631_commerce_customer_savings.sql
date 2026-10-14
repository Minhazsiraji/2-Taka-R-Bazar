-- Customer-owned read-only savings projection. Never a wallet or accounting book.
create function public.commerce_savings_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Sign in required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('order_id',q.id,'order_code',q.order_code,'completed_at',q.completed_at,'product_saving',q.product_saving,'delivery_charge',q.delivery_charge,'net_saving',q.product_saving-q.delivery_charge,'is_synthetic',q.is_synthetic) order by q.completed_at desc) from (
 select o.id,o.order_code,o.completed_at,o.is_synthetic,
 coalesce((select sum(greatest(0,coalesce(i.reference_price,0)-i.unit_price)*greatest(0,i.quantity-greatest(i.returned_quantity,coalesce((select sum((rl->>'quantity')::integer) from public.commerce_requests r cross join lateral jsonb_array_elements(r.received_lines) rl where r.order_id=o.id and r.kind='return' and r.status in ('received','completed') and rl->>'line_id'=i.id::text),0)))) from public.commerce_order_items i where i.order_id=o.id and i.fulfilled),0) product_saving,
 greatest(0,o.delivery_fee-coalesce((select sum(c.delivery_amount) from public.finance_customer_events s join public.finance_customer_events c on c.source_id=s.id and c.kind='credit' and c.status='posted' where s.kind='sale' and s.source_kind='commerce_order' and s.source_id=o.id and s.status='posted'),0)) delivery_charge
 from public.commerce_orders o where o.customer_id=auth.uid() and o.status='completed'
 )q),'[]'::jsonb);
end $$;
revoke all on function public.commerce_savings_summary() from public,anon,authenticated,service_role;
grant execute on function public.commerce_savings_summary() to authenticated;
