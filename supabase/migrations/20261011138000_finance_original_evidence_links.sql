alter table public.finance_document_attachments drop constraint finance_document_attachments_entity_type_check;
alter table public.finance_document_attachments add constraint finance_document_attachments_entity_type_check check(entity_type in ('po','bill','customer_event','supplier_credit_note','cash_transaction','statement'));
alter table public.finance_document_attachments drop constraint finance_document_attachments_kind_check;
alter table public.finance_document_attachments add constraint finance_document_attachments_kind_check check(kind in ('signed_po','supplier_invoice','goods_receipt','delivery_note','credit_note','payment_proof','bank_statement','other'));

create or replace function public.finance_attach_document(
 p_entity_type text,p_entity_id uuid,p_kind text,p_name text,p_path text,p_sha256 text
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid();v_id uuid;
begin
 if not private.finance_authorized(v_user) then raise exception 'Finance role required'; end if;
 if p_entity_type not in ('po','bill','customer_event','supplier_credit_note','cash_transaction','statement') or p_kind not in
 ('signed_po','supplier_invoice','goods_receipt','delivery_note','credit_note','payment_proof','bank_statement','other')
 or length(btrim(coalesce(p_name,''))) not between 3 and 140
 or p_sha256 !~ '^[a-f0-9]{64}$' or p_path not like v_user::text||'/%'
 then raise exception 'Invalid evidence metadata'; end if;
 if not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path)
 then raise exception 'Private evidence file was not uploaded'; end if;
 if p_entity_type='po' and not exists(select 1 from public.procurement_purchase_orders where id=p_entity_id)
 then raise exception 'PO not found'; end if;
 if p_entity_type='bill' and not exists(select 1 from public.procurement_supplier_bills where id=p_entity_id)
 then raise exception 'Bill not found'; end if;
 if p_entity_type='customer_event' and not exists(select 1 from public.finance_customer_events where id=p_entity_id) then raise exception 'Customer event not found'; end if;
 if p_entity_type='supplier_credit_note' and not exists(select 1 from public.finance_supplier_credit_notes where id=p_entity_id) then raise exception 'Supplier credit note not found'; end if;
 if p_entity_type='cash_transaction' and not exists(select 1 from public.treasury_transactions where id=p_entity_id) then raise exception 'Cash transaction not found'; end if;
 if p_entity_type='statement' and not exists(select 1 from public.treasury_statement_lines where id=p_entity_id) then raise exception 'Statement not found'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_entity_type||':'||p_entity_id::text||':'||p_sha256,0));
 if exists(
   select 1 from public.finance_document_attachments
   where entity_type=p_entity_type and entity_id=p_entity_id and evidence_sha256=p_sha256
 ) then raise exception 'Identical evidence already attached to this record'; end if;
 insert into public.finance_document_attachments(entity_type,entity_id,kind,display_name,evidence_path,evidence_sha256,uploaded_by)
 values(p_entity_type,p_entity_id,p_kind,btrim(p_name),p_path,p_sha256,v_user) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_user,'finance_document_attached','finance_document_attachment',v_id,
 jsonb_build_object('linked_type',p_entity_type,'linked_id',p_entity_id,'sha256',p_sha256,'kind',p_kind));
 return v_id;
end $fn$;

create function private.finance_link_original_document() returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text;v_id uuid;v_kind text;
begin
 if tg_table_name='finance_customer_events' then v_type='customer_event';v_id=new.id;v_kind=case when new.kind='credit' then 'credit_note' else 'goods_receipt' end;
 elsif tg_table_name='finance_supplier_credit_notes' then v_type='supplier_credit_note';v_id=new.id;v_kind='credit_note';
 else v_type='cash_transaction';v_id=new.transaction_id;v_kind='payment_proof'; end if;
 perform public.finance_attach_document(v_type,v_id,v_kind,'Original '||replace(v_type,'_',' ')||' evidence',new.evidence_path,new.evidence_sha256);
 return new;
end $$;
revoke all on function private.finance_link_original_document() from public,anon,authenticated,service_role;
create trigger finance_customer_original_link after insert on public.finance_customer_events for each row execute function private.finance_link_original_document();
create trigger finance_supplier_credit_original_link after insert on public.finance_supplier_credit_notes for each row execute function private.finance_link_original_document();
create trigger finance_customer_cash_original_link after insert on public.finance_customer_cash_evidence for each row execute function private.finance_link_original_document();
create function public.finance_original_descriptor(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_path text;v_hash text;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 if p_kind='customer_event' then select evidence_path,evidence_sha256 into v_path,v_hash from public.finance_customer_events where id=p_id;
 elsif p_kind='supplier_credit_note' then select evidence_path,evidence_sha256 into v_path,v_hash from public.finance_supplier_credit_notes where id=p_id;
 elsif p_kind='cash_transaction' then select evidence_path,evidence_sha256 into v_path,v_hash from public.finance_customer_cash_evidence where transaction_id=p_id;
 elsif p_kind='attachment' then select evidence_path,evidence_sha256 into v_path,v_hash from public.finance_document_attachments where id=p_id;
 elsif p_kind='bill' then select evidence_path,evidence_sha256 into v_path,v_hash from public.procurement_supplier_bills where id=p_id;
 else raise exception 'Unsupported original record type'; end if;
 if v_path is null then return null; end if;
 return jsonb_build_object('path',v_path,'sha256',v_hash);
end $$;
revoke all on function public.finance_original_descriptor(text,uuid) from public,anon,authenticated;
grant execute on function public.finance_original_descriptor(text,uuid) to authenticated;

create or replace function private.finance_fulfilled_source(p_kind text,p_source uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.orders%rowtype;g public.group_deal_commitments%rowtype;v_community uuid;v_product uuid;v_lines jsonb;
begin
 if p_kind='order' then
 select * into o from public.orders where id=p_source;
 if not found or o.status<>'completed' or o.completed_at is null then raise exception 'Completed customer order required'; end if;
 if o.payment_status='waived_test_order' then raise exception 'Waived test orders cannot create revenue'; end if;
 select community_id into v_community from public.pools where id=o.pool_id;
 select jsonb_agg(jsonb_build_object('line_id',i.id,'product_id',i.product_id,'quantity',i.quantity,'unit_price',i.unit_price,
 'model',case when p.source_type='SUPPLIER_POOL' then 'pool' else 'direct_product' end) order by i.id) into v_lines
 from public.order_items i join public.products p on p.id=i.product_id where i.order_id=o.id;
 if exists(select 1 from public.order_items i join public.products p on p.id=i.product_id where i.order_id=o.id and p.source_type<>'SUPPLIER_POOL' and not exists(select 1 from public.own_product_inventory_movements m where m.order_item_id=i.id and m.movement_type='SALE_FULFILMENT' and m.quantity=i.quantity)) then raise exception 'Direct product physical fulfilment proof missing'; end if;
 if v_lines is null then raise exception 'Order has no source lines'; end if;
 if o.fulfillment_method='home_delivery' and o.delivery_actual_cost is null then raise exception 'Actual delivery cost required'; end if;
 return jsonb_build_object('kind',p_kind,'source_id',o.id,'community_id',v_community,'pool_id',o.pool_id,
 'business_date',(o.completed_at at time zone 'Asia/Dhaka')::date,'delivery_amount',o.delivery_fee,'delivery_actual_cost',coalesce(o.delivery_actual_cost,0),'lines',v_lines);
 elsif p_kind='group_commitment' then
 select * into g from public.group_deal_commitments where id=p_source;
 if not found or g.status<>'fulfilled' or g.fulfilled_at is null or g.fulfilled_unit_price is null then raise exception 'Fulfilled Group Deal with immutable completion terms required'; end if;
 select community_id into v_community from public.group_circles where id=g.circle_id;
 select product_id into v_product from public.group_deals where id=g.group_deal_id;
 return jsonb_build_object('kind',p_kind,'source_id',g.id,'community_id',v_community,'group_deal_id',g.group_deal_id,
 'business_date',(g.fulfilled_at at time zone 'Asia/Dhaka')::date,'delivery_amount',0,'delivery_actual_cost',0,
 'lines',jsonb_build_array(jsonb_build_object('line_id',g.id,'product_id',v_product,'quantity',g.quantity,'unit_price',g.fulfilled_unit_price,'model','group_deal')));
 end if;
 raise exception 'Unsupported completed customer source';
end $$;

create or replace function public.finance_review_customer_credit(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.finance_customer_events%rowtype;s public.finance_customer_events%rowtype;v_lines jsonb:='[]';v_ar numeric;v_refund numeric;v_journal uuid;x record;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into e from public.finance_customer_events where id=p_id for update;
 if not found or e.kind<>'credit' or e.status<>'pending' then raise exception 'Customer credit not pending'; end if;
 if e.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Credit review reason required'; end if;
 if p_approve then
 perform private.finance_require_open(e.business_date);
 select * into s from public.finance_customer_events where id=e.source_id for update;
 if exists(select 1 from public.treasury_transactions where customer_event_id=s.id and status='pending') or exists(select 1 from public.finance_customer_cod_allocations where sale_id=s.id and status='pending') then raise exception 'Resolve pending customer payment before credit'; end if;
 v_ar=least(e.product_amount+e.delivery_amount,greatest(0,private.finance_customer_balance(s.id,'1100')));
 v_refund=e.product_amount+e.delivery_amount-v_ar;
 if e.product_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','4000','debit',e.product_amount)); end if;
 if e.delivery_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','4010','debit',e.delivery_amount)); end if;
 if v_ar>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','1100','credit',v_ar)); end if;
 if v_refund>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','2300','credit',v_refund)); end if;
 if e.restock and e.cogs_amount>0 then
 perform bill_id from public.finance_inventory_lots where bill_id in(select (r->>'bill_id')::uuid from jsonb_array_elements(e.allocations) r) order by bill_id for update;
 v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','1200','debit',e.cogs_amount),jsonb_build_object('account','5000','credit',e.cogs_amount)); end if;
 v_journal=private.treasury_post('customer:credit:'||e.id,e.id,e.business_date,e.reason,v_lines,auth.uid());
 if e.restock and s.source_kind='order' then
 for x in select (r->>'line_id')::uuid item_id,(r->>'product_id')::uuid product_id,sum((r->>'quantity')::integer)::integer qty
 from jsonb_array_elements(e.allocations) r join public.products p on p.id=(r->>'product_id')::uuid where p.source_type<>'SUPPLIER_POOL'
 group by r->>'line_id',r->>'product_id' order by r->>'product_id',r->>'line_id' loop
 perform product_id from public.own_product_inventory where product_id=x.product_id and fulfilled_quantity>=x.qty for update;
 if not found then raise exception 'Physical own inventory requires return reconciliation'; end if;
 update public.own_product_inventory set stock_on_hand=stock_on_hand+x.qty,fulfilled_quantity=fulfilled_quantity-x.qty,updated_at=now() where product_id=x.product_id;
 insert into public.own_product_inventory_movements(product_id,order_item_id,movement_type,quantity,event_key,reason,actor_user_id)
 values(x.product_id,x.item_id,'RETURN',x.qty,'finance:customer:return:'||e.id||':'||x.item_id,e.reason,auth.uid());
 end loop;
 end if;
 if e.restock then
 for x in select (r->>'bill_id')::uuid bill_id,sum((r->>'quantity')::integer)::integer qty,sum((r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost from jsonb_array_elements(e.allocations) r group by r->>'bill_id' loop
 insert into public.finance_inventory_movements(bill_id,event_key,quantity,value,journal_id) values(x.bill_id,'customer:credit:'||e.id||':'||x.bill_id,x.qty,x.cost,v_journal);
 end loop;
 end if;
 end if;
 update public.finance_customer_events set status=case when p_approve then 'posted' else 'rejected' end,reviewed_by=auth.uid(),journal_id=v_journal where id=e.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_credit_'||case when p_approve then 'posted' else 'rejected' end,'finance_customer_event',e.id,
 jsonb_build_object('note',p_note,'journal_id',v_journal,'ar_reduction',v_ar,'refund_payable',v_refund,'restocked',e.restock));
 return case when p_approve then 'posted' else 'rejected' end;
end $$;

