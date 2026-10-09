-- Controlled read-model for procurement/treasury operational workflow.
-- Read-only to finance staff; all mutations go through explicit authenticated RPCs.
create or replace function public.procurement_workbench()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance staff role required'; end if;
 return jsonb_build_object(
  'selected_quotes',coalesce((select jsonb_agg(jsonb_build_object(
     'id',q.id,'product_id',pi.product_id,'product_name',pr.name,'supplier_name',s.business_name,
     'pool_title',p.title,'quantity',q.quantity,'unit_cost',q.landed_unit_price,
     'expiry',q.valid_until,'pool_status',p.status) order by q.created_at desc)
    from (select q.* from public.supplier_quotes q
          where q.quote_phase='final' and q.selected=true
          and not exists(select 1 from public.procurement_purchase_orders po where po.supplier_quote_id=q.id)
          order by q.created_at desc limit 100) q
     join public.pool_items pi on pi.id=q.pool_item_id
     join public.products pr on pr.id=pi.product_id
     join public.suppliers s on s.id=q.supplier_id
     join public.pools p on p.id=pi.pool_id),'[]'::jsonb),
  'purchase_orders',coalesce((select jsonb_agg(jsonb_build_object(
     'id',po.id,'code',po.po_code,'supplier_id',po.supplier_id,'supplier',s.business_name,
     'product_id',po.product_id,'product',pr.name,'quantity',po.quantity,
     'unit_cost',po.unit_landed_cost,'value',po.total_value,
     'received_quantity',private.procurement_accepted_quantity(po.id),
     'status',po.status,'created_by',po.created_by,'approved_by',po.approved_by)
     order by po.created_at desc)
    from (select * from public.procurement_purchase_orders order by created_at desc limit 100) po
    join public.suppliers s on s.id=po.supplier_id
    join public.products pr on pr.id=po.product_id),'[]'::jsonb),
  'dispatches',coalesce((select jsonb_agg(jsonb_build_object(
     'id',d.id,'code',d.dispatch_code,'supplier_id',d.source_supplier_id,
     'destination_community_id',d.destination_community_id,'status',d.status,
     'product_ids',(select coalesce(jsonb_agg(di.product_id),'[]'::jsonb)
                     from public.supply_dispatch_items di where di.dispatch_id=d.id))
     order by d.created_at desc)
     from (select * from public.supply_dispatches where source_kind='supplier'
           and status in ('draft','sealed','in_transit','verified','resolved')
           order by created_at desc limit 100) d),'[]'::jsonb),
  'bills',coalesce((select jsonb_agg(jsonb_build_object(
     'id',b.id,'po_id',b.po_id,'ref',b.invoice_reference,'vendor',s.business_name,
     'quantity',b.quantity,'amount',b.amount,'status',b.status,
     'submitted_by',b.submitted_by,'reviewed_by',b.reviewed_by,'evidence_path',b.evidence_path)
     order by b.created_at desc)
     from (select * from public.procurement_supplier_bills order by created_at desc limit 100) b
     join public.suppliers s on s.id=b.supplier_id),'[]'::jsonb),
  'liquid_accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,
       'kind',a.account_kind) order by a.name)
       from public.treasury_accounts a where a.active and a.account_kind<>'credit_card'),'[]'::jsonb),
  'cash_receipts_pending',coalesce((select jsonb_agg(jsonb_build_object(
     'day_id',d.id,'date',d.business_date,'community_id',d.community_id,
     'community',c.name,'product_cash',h.product_cod_received,'delivery_cash',h.delivery_fees_received)
     order by d.business_date desc)
     from public.community_ops_days d
     join public.community_ops_cash_handovers h on h.day_id=d.id and h.status='accepted'
     join public.communities c on c.id=d.community_id
     where d.status='closed' and not d.accepted_with_exception
       and not exists(select 1 from public.treasury_community_cash_receipts t where t.day_id=d.id)
     ),'[]'::jsonb)
 );
end $fn$;
revoke all on function public.procurement_workbench() from public,anon,authenticated;
grant execute on function public.procurement_workbench() to authenticated;
