-- Commerce fulfillment facts remain separate from Finance postings.
alter table public.commerce_order_items add column returned_quantity integer not null default 0 check(returned_quantity between 0 and quantity);
alter table public.commerce_requests add column received_lines jsonb;
alter table public.commerce_requests add column evidence_path text;
alter table public.commerce_requests add column evidence_sha256 text;
alter table public.commerce_orders add column handover_reference text;
alter table public.commerce_orders add column handover_sha256 text;
alter table public.commerce_orders add column handover_evidence_path text;
create function private.commerce_sync_sku() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.commerce_skus(product_id,sku,active) values(new.id,new.sku,new.active) on conflict(product_id) do update set sku=excluded.sku,active=excluded.active; return new;
end $$;
create trigger commerce_product_sku after insert or update of sku,active on public.products for each row execute function private.commerce_sync_sku();
create function private.commerce_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Commerce history is immutable';end $$;
create trigger commerce_order_events_immutable before update or delete on public.commerce_order_events for each row execute function private.commerce_immutable();
create function private.commerce_order_terms() returns trigger language plpgsql set search_path='' as $$ begin
 if (to_jsonb(new)-array['status','payment_status','accepted_by','completed_at','delivery_actual_cost','cancellation_reason','handover_reference','handover_sha256','handover_evidence_path']) is distinct from (to_jsonb(old)-array['status','payment_status','accepted_by','completed_at','delivery_actual_cost','cancellation_reason','handover_reference','handover_sha256','handover_evidence_path']) then raise exception 'Confirmed order terms are immutable';end if;
 if old.status in ('completed','cancelled') and new.status<>old.status then raise exception 'Final order status is immutable';end if;return new;
end $$;
create trigger commerce_order_terms before update on public.commerce_orders for each row execute function private.commerce_order_terms();
create function private.commerce_access_order(p_order uuid,p_staff boolean default false) returns public.commerce_orders language plpgsql stable security definer set search_path='' as $$ declare o public.commerce_orders%rowtype;begin
 select * into o from public.commerce_orders where id=p_order;
 if auth.uid() is null or o.id is null or not ((not p_staff and o.customer_id=auth.uid()) or private.commerce_admin() or private.commerce_supplier(o.supplier_id) or private.commerce_operator(o.community_id)) then raise exception using errcode='42501',message='Order not accessible';end if;return o;
end $$;
create function public.commerce_orders_list(p_staff boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception using errcode='42501',message='Sign in required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'order_code',o.order_code,'status',o.status,'payment_status',o.payment_status,'total_amount',o.total_amount,'fulfillment_method',o.fulfillment_method,'mode',o.mode,'created_at',o.created_at) order by o.created_at desc) from public.commerce_orders o where (not p_staff and o.customer_id=auth.uid()) or (p_staff and (private.commerce_admin() or private.commerce_supplier(o.supplier_id) or private.commerce_operator(o.community_id)))),'[]');end $$;
create function public.commerce_get_order(p_order uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare o public.commerce_orders%rowtype;v_pii boolean;begin
 o=private.commerce_access_order(p_order);
 v_pii=o.customer_id=auth.uid() or private.commerce_admin() or private.commerce_operator(o.community_id);
 return jsonb_build_object('order',to_jsonb(o)-array['customer_id','accepted_by','handover_sha256','handover_evidence_path','delivery_address']||jsonb_build_object('delivery_address',case when v_pii then o.delivery_address else null end),
 'items',coalesce((select jsonb_agg(to_jsonb(i)-array['cart_item_id','commitment_id','group_commitment_id']) from public.commerce_order_items i where order_id=o.id),'[]'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'note',note,'created_at',created_at) order by id) from public.commerce_order_events where order_id=o.id),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-array['customer_id','requested_by','reviewed_by','evidence_path','evidence_sha256']) from public.commerce_requests r where order_id=o.id),'[]'));
end $$;
create function public.commerce_get_quote(p_quote uuid,p_proof text) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare q public.commerce_quotes%rowtype;begin
 perform private.commerce_assert_preview(p_proof);select * into q from public.commerce_quotes where id=p_quote and customer_id=auth.uid();if not found then raise exception 'Quote not accessible';end if;return to_jsonb(q)-'customer_id';end $$;
create function public.commerce_request(p_order uuid,p_kind text,p_reason text,p_proof text) returns uuid language plpgsql security definer set search_path='' as $$ declare o public.commerce_orders%rowtype;v_id uuid;begin
 perform private.commerce_assert_preview(p_proof);select * into o from public.commerce_orders where id=p_order and customer_id=auth.uid() for update;
 if not found then raise exception 'Order not accessible';end if;
 if p_kind not in ('cancel','return','refund') or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Choose a request type and explain the reason';end if;
 if p_kind='cancel' and o.status not in ('awaiting_supplier','confirmed','preparing') then raise exception 'Cancellation is unavailable after dispatch';end if;
 if p_kind in ('return','refund') and (o.status<>'completed' or o.completed_at<now()-interval '7 days') then raise exception 'Completed order within the return period required';end if;
 insert into public.commerce_requests(order_id,customer_id,kind,reason,requested_by) values(o.id,auth.uid(),p_kind,btrim(p_reason),auth.uid()) returning id into v_id;
 perform private.commerce_event(o.id,'request_submitted',p_kind||' request submitted for independent review.');return v_id;
end $$;
create function public.commerce_review_request(p_request uuid,p_approve boolean,p_note text,p_proof text) returns text language plpgsql security definer set search_path='' as $$ declare r public.commerce_requests%rowtype;o public.commerce_orders%rowtype;begin
 perform private.commerce_assert_preview(p_proof);
 if not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required';end if;
 select * into r from public.commerce_requests where id=p_request for update;select * into o from public.commerce_orders where id=r.order_id for update;
 if r.id is null or r.status<>'pending' or r.requested_by=auth.uid() or length(btrim(p_note))<10 then raise exception 'Independent review of a pending request with a reason required';end if;
 if p_approve and r.kind='cancel' then
 if o.status not in ('awaiting_supplier','confirmed','preparing') or o.payment_status<>'unpaid' then raise exception 'Dispatched or paid orders require Finance exception handling';end if;
 perform private.commerce_release_order(o.id,'Approved customer cancellation');end if;
 update public.commerce_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=p_note where id=r.id;
 perform private.commerce_event(o.id,'request_reviewed',r.kind||case when p_approve then ' approved' else ' rejected' end||': '||p_note);
 return case when p_approve then 'approved' else 'rejected' end;end $$;
-- Evidence has private storage ownership. A client-supplied path alone is not proof.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('commerce-evidence','commerce-evidence',false,1572864,array['image/png','image/jpeg','application/pdf']) on conflict(id) do nothing;
create policy commerce_evidence_insert on storage.objects for insert to authenticated with check(bucket_id='commerce-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create policy commerce_evidence_read on storage.objects for select to authenticated using(bucket_id='commerce-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
create function private.commerce_evidence(p_path text,p_sha text) returns void language plpgsql stable security definer set search_path='' as $$ begin
 if p_sha is null or p_sha!~'^[a-f0-9]{64}$' or not exists(select 1 from storage.objects where bucket_id='commerce-evidence' and name=p_path and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Owned original handover evidence required';end if;end $$;
create function public.commerce_fulfill(p_order uuid,p_action text,p_note text,p_reference text,p_path text,p_sha text,p_delivery_cost numeric,p_proof text) returns text language plpgsql security definer set search_path='' as $$
declare o public.commerce_orders%rowtype;r record;begin
 perform private.commerce_assert_preview(p_proof);o=private.commerce_access_order(p_order,true);select * into o from public.commerce_orders where id=o.id for update;
 if length(btrim(p_note))<10 then raise exception 'Operational reason required';end if;
 if p_action in ('accept','reject') then
 if o.status<>'awaiting_supplier' or o.supplier_deadline<=now() or not private.commerce_supplier(o.supplier_id) then raise exception 'Assigned supplier must respond before the deadline';end if;
 if p_action='reject' then perform private.commerce_release_order(o.id,'Supplier rejected: '||p_note);return 'cancelled';end if;
 update public.commerce_orders set status='confirmed',accepted_by=auth.uid() where id=o.id;
 elsif p_action='prepare' then
 if o.status<>'confirmed' or not(private.commerce_admin() or private.commerce_supplier(o.supplier_id)) then raise exception 'Assigned processor and confirmed order required';end if;
 update public.commerce_orders set status='preparing' where id=o.id;
 elsif p_action='dispatch' then
 if o.status<>'preparing' or not(private.commerce_admin() or private.commerce_supplier(o.supplier_id)) then raise exception 'Prepared order and assigned processor required';end if;
 update public.commerce_orders set status=case when o.fulfillment_method='pickup' then 'ready_for_pickup' else 'out_for_delivery' end where id=o.id;
 elsif p_action='complete' then
 if o.status not in ('ready_for_pickup','out_for_delivery') or not(private.commerce_admin() or private.commerce_operator(o.community_id)) then raise exception 'Assigned custody operator and dispatched order required';end if;
 if length(btrim(p_reference))<5 or (o.fulfillment_method='home_delivery' and (p_delivery_cost is null or p_delivery_cost<0)) then raise exception 'Handover reference and actual delivery cost required';end if;
 perform private.commerce_evidence(p_path,p_sha);
 for r in select i.*,f.supplier_stock_id from public.commerce_order_items i join public.commerce_offers f on f.id=i.offer_id where i.order_id=o.id order by i.sku_id,i.offer_id for update of i loop
 if not r.reserved or r.fulfilled then raise exception 'Reserved physical stock required';end if;
 if o.supplier_id is null then
 update public.own_product_inventory set stock_on_hand=stock_on_hand-r.quantity,reserved_quantity=reserved_quantity-r.quantity,fulfilled_quantity=fulfilled_quantity+r.quantity,updated_at=now() where product_id=r.product_id and reserved_quantity>=r.quantity and stock_on_hand>=r.quantity;
 if not found then raise exception 'Physical stock reconciliation required';end if;
 insert into public.own_product_inventory_movements(product_id,movement_type,quantity,event_key,reason,actor_user_id) values(r.product_id,'SALE_FULFILMENT',r.quantity,'commerce:fulfill:'||r.id,p_note,auth.uid());
 else
 update public.commerce_supplier_stock set available_quantity=available_quantity-r.quantity,reserved_quantity=reserved_quantity-r.quantity where id=r.supplier_stock_id and reserved_quantity>=r.quantity;
 if not found then raise exception 'Supplier stock reconciliation required';end if;end if;
 update public.commerce_order_items set reserved=false,fulfilled=true where id=r.id;

 end loop;
 update public.commerce_orders set status='completed',completed_at=now(),delivery_actual_cost=case when fulfillment_method='home_delivery' then p_delivery_cost else 0 end,handover_reference=p_reference,handover_evidence_path=p_path,handover_sha256=p_sha where id=o.id;
 update public.group_deal_commitments g set status='fulfilled',fulfilled_at=fulfilled_order.completed_at,fulfilled_unit_price=i.unit_price from public.commerce_order_items i join public.commerce_orders fulfilled_order on fulfilled_order.id=i.order_id where i.order_id=p_order and i.group_commitment_id=g.id and i.fulfilled and fulfilled_order.status='completed';
 else raise exception 'Unsupported fulfillment action';end if;
 perform private.commerce_event(o.id,p_action,p_note);return (select status from public.commerce_orders where id=o.id);end $$;
create function public.commerce_record_cod(p_order uuid,p_product numeric,p_delivery numeric,p_reference text,p_path text,p_sha text,p_proof text) returns uuid language plpgsql security definer set search_path='' as $$ declare o public.commerce_orders%rowtype;v_id uuid;begin
 perform private.commerce_assert_preview(p_proof);o=private.commerce_access_order(p_order,true);select * into o from public.commerce_orders where id=o.id for update;
 if not(private.commerce_admin() or private.commerce_operator(o.community_id)) or o.status<>'completed' or o.payment_status<>'unpaid' or p_product is distinct from o.product_subtotal or p_delivery is distinct from o.delivery_fee or length(btrim(p_reference))<5 then raise exception 'Completed order, assigned cash custodian and exact COD breakdown required';end if;
 perform private.commerce_evidence(p_path,p_sha);
 insert into public.commerce_cod_receipts(order_id,product_amount,delivery_amount,reference,evidence_path,evidence_sha256,recorded_by) values(o.id,p_product,p_delivery,p_reference,p_path,p_sha,auth.uid()) returning id into v_id;
 update public.commerce_orders set payment_status='custody_recorded' where id=o.id;
 perform private.commerce_event(o.id,'cod_custody','COD custody recorded. Finance verification remains pending.');return v_id;end $$;
-- Extend source eligibility only. The original Finance write lock, leases,
-- source allowlist, evidence, inventory allocations and independent approvals remain intact.
alter table public.finance_customer_events drop constraint finance_customer_events_source_kind_check;
alter table public.finance_customer_events add constraint finance_customer_events_source_kind_check check(source_kind in ('order','group_commitment','sale','commerce_order'));
alter table private.finance_uat_entities drop constraint finance_uat_entities_entity_type_check;
alter table private.finance_uat_entities add constraint finance_uat_entities_entity_type_check check(entity_type in ('order','group_commitment','ops_day','commerce_order'));
alter function private.finance_fulfilled_source(text,uuid) rename to finance_fulfilled_source_legacy;
create function private.finance_fulfilled_source(p_kind text,p_source uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare o public.commerce_orders%rowtype;v_lines jsonb;begin
 if p_kind='commerce_order' then
 select * into o from public.commerce_orders where id=p_source;
 if not found or o.status<>'completed' or o.completed_at is null or o.handover_sha256 is null then raise exception 'Completed commerce order with handover proof required';end if;
 if exists(select 1 from public.commerce_order_items i where order_id=o.id and (not fulfilled or reserved)) then raise exception 'All physical lines must be fulfilled';end if;
 if exists(select 1 from public.commerce_order_items i where order_id=o.id and o.supplier_id is null and not exists(select 1 from public.own_product_inventory_movements m where m.event_key='commerce:fulfill:'||i.id and m.quantity=i.quantity and m.movement_type='SALE_FULFILMENT')) then raise exception 'Physical inventory evidence missing';end if;
 if o.fulfillment_method='home_delivery' and o.delivery_actual_cost is null then raise exception 'Actual delivery cost required';end if;
 select jsonb_agg(jsonb_build_object('line_id',id,'product_id',product_id,'quantity',quantity,'unit_price',unit_price,'model',case when o.mode='GROUP_DEAL' then 'group_deal' when o.supplier_id is null then 'direct_product' else 'pool' end) order by id) into v_lines from public.commerce_order_items where order_id=o.id;
 if v_lines is null then raise exception 'Fulfilled source lines required';end if;
 return jsonb_build_object('kind',p_kind,'source_id',o.id,'community_id',o.community_id,'pool_id',null,'business_date',(o.completed_at at time zone 'Asia/Dhaka')::date,'delivery_amount',o.delivery_fee,'delivery_actual_cost',coalesce(o.delivery_actual_cost,0),'lines',v_lines);
 end if;
 if p_kind='group_commitment' and exists(select 1 from public.commerce_order_items where group_commitment_id=p_source) then raise exception 'Unified commerce source must be booked once as commerce_order';end if;
 return private.finance_fulfilled_source_legacy(p_kind,p_source);end $$;
-- Legacy Pool checkout cannot book a commitment that already has a unified order.
create function private.commerce_legacy_checkout_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.commerce_order_items i join public.commitments c on c.id=i.commitment_id join public.orders o on o.id=new.order_id where c.customer_id=o.customer_id and c.pool_item_id=new.pool_item_id) then raise exception 'Commitment already checked out through unified commerce';end if;return new;end $$;
create trigger commerce_legacy_checkout_guard before insert on public.order_items for each row execute function private.commerce_legacy_checkout_guard();
-- Lock down every new function, including trigger helpers.
do $$declare r record;begin for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'commerce_%' or p.proname='finance_fulfilled_source' or p.proname='finance_fulfilled_source_legacy') or n.nspname='public' and p.proname in ('commerce_orders_list','commerce_get_order','commerce_get_quote','commerce_request','commerce_review_request','commerce_fulfill','commerce_record_cod') loop execute 'revoke all on function '||r.signature||' from public,anon,authenticated,service_role';end loop;end $$;
grant execute on function public.commerce_orders_list(boolean),public.commerce_get_order(uuid),public.commerce_get_quote(uuid,text),public.commerce_request(uuid,text,text,text),public.commerce_review_request(uuid,boolean,text,text),public.commerce_fulfill(uuid,text,text,text,text,text,numeric,text),public.commerce_record_cod(uuid,numeric,numeric,text,text,text,text) to authenticated;
