create table public.commerce_stock_reports(
 id uuid primary key default gen_random_uuid(),sku_id uuid not null references public.commerce_skus(id),supplier_id uuid not null references public.suppliers(id),quantity integer not null check(quantity>=0),requested_by uuid not null references auth.users(id),reviewed_by uuid references auth.users(id),reason text not null,review_note text,status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),check(reviewed_by is null or reviewed_by<>requested_by));
alter table public.commerce_stock_reports enable row level security;
revoke all on public.commerce_stock_reports from public,anon,authenticated,service_role;
create function public.commerce_request_stock(p_sku uuid,p_supplier uuid,p_quantity integer,p_reason text,p_proof text) returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid;begin
 perform private.commerce_assert_preview(p_proof);
 if not(private.commerce_admin() or private.commerce_supplier(p_supplier)) or length(btrim(p_reason))<10 or not exists(select 1 from public.commerce_skus s join public.supplier_products sp on sp.product_id=s.product_id where s.id=p_sku and s.active and sp.supplier_id=p_supplier and sp.active) then raise exception 'Assigned supplier SKU and a stock verification reason required';end if;
 insert into public.commerce_stock_reports(sku_id,supplier_id,quantity,requested_by,reason) values(p_sku,p_supplier,p_quantity,auth.uid(),p_reason) returning id into v_id;return v_id;end $$;
create function public.commerce_review_stock(p_id uuid,p_approve boolean,p_note text,p_proof text) returns text language plpgsql security definer set search_path='' as $$ declare r public.commerce_stock_reports%rowtype;begin
 perform private.commerce_assert_preview(p_proof);if not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required';end if;
 select * into r from public.commerce_stock_reports where id=p_id for update;
 if r.id is null or r.status<>'pending' or r.requested_by=auth.uid() or p_approve is null or length(btrim(p_note))<10 then raise exception 'Independent pending stock review with reason required';end if;
 if p_approve then
 insert into public.commerce_supplier_stock(sku_id,supplier_id,available_quantity,verified_by) values(r.sku_id,r.supplier_id,r.quantity,auth.uid()) on conflict(sku_id,supplier_id) do update set available_quantity=excluded.available_quantity,verified_at=now(),verified_by=auth.uid() where public.commerce_supplier_stock.reserved_quantity<=excluded.available_quantity;
 if not found then raise exception 'Reported stock cannot be below live reservations';end if;end if;
 update public.commerce_stock_reports set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=p_note where id=r.id;return case when p_approve then 'approved' else 'rejected' end;end $$;
create function public.commerce_request_offer(p_sku uuid,p_community uuid,p_mode text,p_supplier uuid,p_pool_item uuid,p_group uuid,p_price numeric,p_until timestamptz,p_pickup boolean,p_delivery boolean,p_sla integer,p_proof text) returns uuid language plpgsql security definer set search_path='' as $$ declare v_product uuid;v_stock uuid;v_id uuid;begin
 perform private.commerce_assert_preview(p_proof);
 if not private.commerce_admin() then raise exception 'Admin required';end if;
 select s.product_id into v_product from public.commerce_skus s join public.products p on p.id=s.product_id where s.id=p_sku and s.active and p.active and not p.is_demo;
 if v_product is null or p_until<=now() or not exists(select 1 from public.communities where id=p_community and active) then raise exception 'Active SKU, community and future expiry required';end if;
 if p_supplier is null and exists(select 1 from public.products where id=v_product and source_type='SUPPLIER_POOL') then raise exception 'Supplier product requires its verified seller';end if;
 if p_supplier is null and not exists(select 1 from public.own_product_costs where product_id=v_product and total_landed_cost>0 and p_price>=total_landed_cost) then raise exception 'Own-product landed cost and price above cost required before commercialization';end if;
 if p_supplier is not null then
 select s.id into v_stock from public.commerce_supplier_stock s join public.supplier_products sp on sp.supplier_id=s.supplier_id and sp.product_id=v_product join public.suppliers su on su.id=s.supplier_id where s.sku_id=p_sku and s.supplier_id=p_supplier and s.verified_at>now()-interval '1 day' and sp.active and su.active and su.reliability_status<>'blocked';
 if v_stock is null then raise exception 'Fresh independently verified seller stock required';end if;end if;
 if p_mode='POOL' and not exists(select 1 from public.pool_items pi join public.pools po on po.id=pi.pool_id where pi.id=p_pool_item and pi.product_id=v_product and po.community_id=p_community and pi.active) then raise exception 'Pool product and community must match';end if;
 if p_mode='GROUP_DEAL' and not exists(select 1 from public.group_deals g join public.group_deal_communities dc on dc.group_deal_id=g.id where g.id=p_group and g.product_id=v_product and dc.community_id=p_community) then raise exception 'Group Deal product must match';end if;
 insert into public.commerce_offers(sku_id,community_id,mode,supplier_id,supplier_stock_id,pool_item_id,group_deal_id,unit_price,valid_until,allows_pickup,allows_delivery,supplier_sla_minutes,requested_by,is_synthetic) values(p_sku,p_community,p_mode,p_supplier,v_stock,p_pool_item,p_group,p_price,p_until,p_pickup,p_delivery,p_sla,auth.uid(),true) returning id into v_id;return v_id;end $$;
create function public.commerce_review_offer(p_id uuid,p_approve boolean,p_note text,p_proof text) returns text language plpgsql security definer set search_path='' as $$ declare o public.commerce_offers%rowtype;begin
 perform private.commerce_assert_preview(p_proof);if not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required';end if;
 select * into o from public.commerce_offers where id=p_id for update;
 if o.id is null or o.status<>'pending' or o.requested_by=auth.uid() or o.valid_until<=now() or p_approve is null or length(btrim(p_note))<10 then raise exception 'Independent pending offer review with reason required';end if;
 update public.commerce_offers set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=p_note,version=version+1 where id=o.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'commerce_offer_reviewed','commerce_offer',o.id,jsonb_build_object('approve',p_approve,'note',p_note));return case when p_approve then 'approved' else 'rejected' end;end $$;
create function public.commerce_workbench() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 return jsonb_build_object('orders',public.commerce_orders_list(true),'can_admin',private.commerce_admin(),'can_review',private.has_role(auth.uid(),'super_admin'),
 'suppliers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',business_name)) from public.suppliers where active and (private.commerce_admin() or private.commerce_supplier(id))),'[]'),
 'communities',case when private.commerce_admin() then coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.communities where active),'[]') else '[]'::jsonb end,
 'supplier_skus',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',p.name,'supplier_id',sp.supplier_id)) from public.commerce_skus s join public.products p on p.id=s.product_id join public.supplier_products sp on sp.product_id=p.id where sp.active and (private.commerce_admin() or private.commerce_supplier(sp.supplier_id))),'[]'),
 'skus',case when private.commerce_admin() then coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('name',p.name)) from public.commerce_skus s join public.products p on p.id=s.product_id where s.active),'[]') else '[]'::jsonb end,
 'stock_reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.commerce_stock_reports r where private.commerce_admin() or private.commerce_supplier(r.supplier_id)),'[]'),
 'offers',coalesce((select jsonb_agg(to_jsonb(o)) from public.commerce_offers o where private.commerce_admin() or private.commerce_supplier(o.supplier_id)),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-array['evidence_path','evidence_sha256','customer_id','requested_by','reviewed_by']||jsonb_build_object('lines',(select jsonb_agg(jsonb_build_object('id',id,'name',name_snapshot,'quantity',quantity-returned_quantity)) from public.commerce_order_items where order_id=r.order_id))) from public.commerce_requests r join public.commerce_orders o on o.id=r.order_id where r.status in ('pending','approved','received') and (private.commerce_admin() or private.commerce_operator(o.community_id))),'[]'));end $$;
create function public.commerce_receive_return(p_request uuid,p_lines jsonb,p_restock boolean,p_path text,p_sha text,p_proof text) returns text language plpgsql security definer set search_path='' as $$ declare r public.commerce_requests%rowtype;o public.commerce_orders%rowtype;x jsonb;begin
 perform private.commerce_assert_preview(p_proof);select * into r from public.commerce_requests where id=p_request for update;o=private.commerce_access_order(r.order_id,true);select * into o from public.commerce_orders where id=o.id for update;
 if r.status<>'approved' or r.kind<>'return' or not(private.commerce_admin() or private.commerce_operator(o.community_id)) or r.requested_by=auth.uid() or p_restock is null or p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Approved return, assigned receiver and returned lines required';end if;
 perform private.commerce_evidence(p_path,p_sha);
 if (select count(distinct value->>'line_id') from jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) then raise exception 'Duplicate return line';end if;
 for x in select value from jsonb_array_elements(p_lines) loop
 if (x->>'quantity')::integer is null or (x->>'quantity')::integer<=0 or not exists(select 1 from public.commerce_order_items where id=(x->>'line_id')::uuid and order_id=o.id and fulfilled and (x->>'quantity')::integer<=quantity-returned_quantity) then raise exception 'Returned quantity exceeds fulfilled source';end if;end loop;
 update public.commerce_requests set status='received',received_lines=p_lines,restock=p_restock,evidence_path=p_path,evidence_sha256=p_sha where id=r.id;
 perform private.commerce_event(o.id,'return_received','Returned goods received. Credit and refund require independent Finance and Treasury approvals.');return 'received';end $$;
-- Prevent Finance credits/restocking without an approved customer exception and physical return.
create function private.commerce_credit_guard() returns trigger language plpgsql security definer set search_path='' as $$ declare s public.finance_customer_events%rowtype;x jsonb;v_received integer;v_used integer;begin
 if new.kind<>'credit' then return new;end if;
 select * into s from public.finance_customer_events where id=new.source_id;
 if s.id is null or s.source_kind is distinct from 'commerce_order' then return new;end if;
 perform id from public.commerce_orders where id=s.source_id for update;
 if not exists(select 1 from public.commerce_requests where order_id=s.source_id and ((kind='return' and status='received') or (kind='refund' and status='approved' and not new.restock))) then raise exception 'Independent approved commerce return or refund required';end if;
 if new.restock then
 for x in select value from jsonb_array_elements(new.allocations) loop
 select coalesce(sum((line->>'quantity')::integer),0) into v_received from public.commerce_requests r cross join lateral jsonb_array_elements(r.received_lines) line where r.order_id=s.source_id and r.kind='return' and r.status in ('received','completed') and r.restock and line->>'line_id'=x->>'line_id';
 select coalesce(sum((line->>'quantity')::integer),0) into v_used from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) line where e.kind='credit' and e.source_id=s.id and e.restock and e.status in ('pending','posted') and line->>'line_id'=x->>'line_id';
 if v_used+(x->>'quantity')::integer>v_received then raise exception 'Credit restock exceeds approved physically received returns';end if;
 end loop;end if;return new;end $$;
create trigger commerce_credit_guard before insert on public.finance_customer_events for each row execute function private.commerce_credit_guard();
create function private.commerce_finance_sync() returns trigger language plpgsql security definer set search_path='' as $$ declare s public.finance_customer_events%rowtype;o public.commerce_orders%rowtype;x jsonb;v_paid numeric;v_refund numeric;v_credit numeric;begin
 if new.status<>'posted' or old.status='posted' then return new;end if;
 if tg_table_name='finance_customer_events' then
 if new.kind<>'credit' then return new;end if;select * into s from public.finance_customer_events where id=new.source_id;
 else select * into s from public.finance_customer_events where id=new.customer_event_id;end if;
 if s.id is null or s.source_kind is distinct from 'commerce_order' then return new;end if;
 select * into o from public.commerce_orders where id=s.source_id for update;
 if tg_table_name='finance_customer_events' and coalesce((to_jsonb(new)->>'restock')::boolean,false) then
 for x in select value from jsonb_array_elements(new.allocations) loop
 update public.commerce_order_items set returned_quantity=returned_quantity+(x->>'quantity')::integer where id=(x->>'line_id')::uuid and order_id=o.id and returned_quantity+(x->>'quantity')::integer<=quantity;
 if not found then raise exception 'Physical return exceeds sold source';end if;
 if o.supplier_id is null then
 update public.own_product_inventory set stock_on_hand=stock_on_hand+(x->>'quantity')::integer,fulfilled_quantity=fulfilled_quantity-(x->>'quantity')::integer,updated_at=now() where product_id=(x->>'product_id')::uuid and fulfilled_quantity>=(x->>'quantity')::integer;
 if not found then raise exception 'Physical inventory return reconciliation required';end if;
 insert into public.own_product_inventory_movements(product_id,movement_type,quantity,event_key,reason,actor_user_id) values((x->>'product_id')::uuid,'RETURN',(x->>'quantity')::integer,'commerce:return:'||new.id||':'||(x->>'line_index'),new.reason,auth.uid());
 else update public.commerce_supplier_stock set available_quantity=available_quantity+(x->>'quantity')::integer where id=(select supplier_stock_id from public.commerce_offers where id=(select offer_id from public.commerce_order_items where id=(x->>'line_id')::uuid));end if;
 end loop;end if;
 select coalesce(sum(amount) filter(where kind='customer_receipt'),0),coalesce(sum(amount) filter(where kind='customer_refund'),0) into v_paid,v_refund from public.treasury_transactions where customer_event_id=s.id and status='posted';
 select coalesce(sum(product_amount+delivery_amount),0) into v_credit from public.finance_customer_events where kind='credit' and source_id=s.id and status='posted';
 update public.commerce_orders set payment_status=case when v_refund>=o.total_amount then 'refunded' when v_credit>v_refund and v_paid>0 then 'refund_pending' when v_refund>0 then 'partially_refunded' when v_paid+v_credit>=o.total_amount and v_paid>0 then 'verified' else payment_status end where id=o.id;
 -- Close a received exception only after all cumulative physically received lines
 -- have posted credits. Preserve its evidence for subsequent partial returns.
 update public.commerce_requests req set status='completed' where req.order_id=o.id and req.kind='return' and req.status='received' and not exists(
 select 1 from jsonb_array_elements(req.received_lines) rl where
 (select coalesce(sum((received_line->>'quantity')::integer),0) from public.commerce_requests rr cross join lateral jsonb_array_elements(rr.received_lines) received_line where rr.order_id=o.id and rr.kind='return' and rr.status in ('received','completed') and received_line->>'line_id'=rl->>'line_id')>
 (select coalesce(sum((credited_line->>'quantity')::integer),0) from public.finance_customer_events ce cross join lateral jsonb_array_elements(ce.allocations) credited_line where ce.kind='credit' and ce.source_id=s.id and ce.status='posted' and credited_line->>'line_id'=rl->>'line_id'));
 if tg_table_name='finance_customer_events' and not coalesce((to_jsonb(new)->>'restock')::boolean,false) then update public.commerce_requests set status='completed' where order_id=o.id and kind='refund' and status='approved';end if;
 if v_paid>=o.total_amount then update public.commerce_cod_receipts set status='verified' where order_id=o.id;end if;
 perform private.commerce_event(o.id,'finance_verified','Independent Finance/Treasury event posted. Payment state reflects verified source amounts.');return new;end $$;
create trigger commerce_finance_sync after update on public.finance_customer_events for each row execute function private.commerce_finance_sync();
create trigger commerce_treasury_sync after update on public.treasury_transactions for each row execute function private.commerce_finance_sync();
do $$declare r record;begin for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in ('commerce_request_stock','commerce_review_stock','commerce_request_offer','commerce_review_offer','commerce_workbench','commerce_receive_return','commerce_credit_guard','commerce_finance_sync') loop execute 'revoke all on function '||r.signature||' from public,anon,authenticated,service_role';end loop;end $$;
grant execute on function public.commerce_request_stock(uuid,uuid,integer,text,text),public.commerce_review_stock(uuid,boolean,text,text),public.commerce_request_offer(uuid,uuid,text,uuid,uuid,uuid,numeric,timestamptz,boolean,boolean,integer,text),public.commerce_review_offer(uuid,boolean,text,text),public.commerce_workbench(),public.commerce_receive_return(uuid,jsonb,boolean,text,text,text) to authenticated;
-- Preserve Finance workbench projections and append only completed unified sources.
alter function public.finance_customer_workbench() rename to finance_customer_workbench_legacy;
alter function public.finance_customer_workbench_legacy() set schema private;
revoke all on function private.finance_customer_workbench_legacy() from public,anon,authenticated,service_role;
create function public.finance_customer_workbench() returns jsonb language plpgsql stable security definer set search_path='' as $$ declare d jsonb;v_sources jsonb;begin
 d=private.finance_customer_workbench_legacy();
 select coalesce(jsonb_agg(source),'[]') into v_sources from (
 select jsonb_build_object('kind','commerce_order','id',o.id,'label',o.order_code,'delivery_amount',o.delivery_fee,'lines',(select jsonb_agg(jsonb_build_object('line_id',id,'product_id',product_id,'name',name_snapshot,'quantity',quantity,'unit_price',unit_price) order by id) from public.commerce_order_items where order_id=o.id)) source from public.commerce_orders o where status='completed' and not exists(select 1 from public.finance_customer_events e where e.kind='sale' and e.source_kind='commerce_order' and e.source_id=o.id and e.status<>'rejected')) x;
 return jsonb_set(d,'{sources}',coalesce((select jsonb_agg(value) from jsonb_array_elements(d->'sources') where value->>'kind'<>'group_commitment' or not exists(select 1 from public.commerce_order_items where group_commitment_id=(value->>'id')::uuid)),'[]')||v_sources);
end $$;
revoke all on function public.finance_customer_workbench() from public,anon,authenticated,service_role;
grant execute on function public.finance_customer_workbench() to authenticated;
create function private.commerce_group_fulfillment_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status='fulfilled' and old.status<>'fulfilled' and exists(select 1 from public.commerce_order_items where group_commitment_id=new.id) and not exists(select 1 from public.commerce_order_items i join public.commerce_orders o on o.id=i.order_id where i.group_commitment_id=new.id and i.fulfilled and o.status='completed' and new.fulfilled_unit_price=i.unit_price) then raise exception 'Unified Group purchase must be fulfilled through its order';end if;return new;end $$;
create trigger commerce_group_fulfillment_guard before update on public.group_deal_commitments for each row execute function private.commerce_group_fulfillment_guard();
revoke all on function private.commerce_group_fulfillment_guard() from public,anon,authenticated,service_role;
