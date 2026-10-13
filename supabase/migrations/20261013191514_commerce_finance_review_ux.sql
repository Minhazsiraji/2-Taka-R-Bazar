-- Read-model changes only. Posting, receipt and maker-checker guards are unchanged.
alter function public.commerce_workbench() rename to commerce_workbench_before_review_ux;
alter function public.commerce_workbench_before_review_ux() set schema private;
revoke all on function private.commerce_workbench_before_review_ux() from public,anon,authenticated,service_role;
create function public.commerce_workbench() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d jsonb; v_requests jsonb;
begin
 d=private.commerce_workbench_before_review_ux();
 select coalesce(jsonb_agg(x.value||jsonb_build_object(
  'can_review',coalesce((d->>'can_review')::boolean,false) and r.requested_by<>auth.uid(),
  'can_receive',(private.commerce_admin() or private.commerce_operator(o.community_id)) and r.requested_by<>auth.uid()
 ) order by x.ordinality),'[]'::jsonb) into v_requests
 from jsonb_array_elements(d->'requests') with ordinality x(value,ordinality)
 join public.commerce_requests r on r.id=(x.value->>'id')::uuid
 join public.commerce_orders o on o.id=r.order_id;
 return jsonb_set(d,'{requests}',v_requests);
end $$;
revoke all on function public.commerce_workbench() from public,anon,authenticated,service_role;
grant execute on function public.commerce_workbench() to authenticated;

alter function public.finance_customer_workbench() rename to finance_customer_workbench_before_review_ux;
alter function public.finance_customer_workbench_before_review_ux() set schema private;
revoke all on function private.finance_customer_workbench_before_review_ux() from public,anon,authenticated,service_role;
create function public.finance_customer_workbench() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d jsonb; v_events jsonb;
begin
 d=private.finance_customer_workbench_before_review_ux();
 select coalesce(jsonb_agg(x.value||jsonb_build_object('label',
  case when o.order_code is not null then
   case when e.kind='credit' then 'Credit' else 'Sale' end||' · '||o.order_code
  else x.value->>'label' end
 ) order by x.ordinality),'[]'::jsonb) into v_events
 from jsonb_array_elements(d->'events') with ordinality x(value,ordinality)
 join public.finance_customer_events e on e.id=(x.value->>'id')::uuid
 left join public.finance_customer_events original on e.kind='credit' and original.id=e.source_id
 left join public.commerce_orders o on o.id=case
  when e.source_kind='commerce_order' then e.source_id
  when e.kind='credit' and original.source_kind='commerce_order' then original.source_id end;
 return jsonb_set(d,'{events}',v_events);
end $$;
revoke all on function public.finance_customer_workbench() from public,anon,authenticated,service_role;
grant execute on function public.finance_customer_workbench() to authenticated;
