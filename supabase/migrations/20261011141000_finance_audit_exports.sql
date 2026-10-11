create function public.finance_audit_export(p_month date,p_after bigint default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;v_next bigint;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin audit export required'; end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_after<0 then raise exception 'Valid month and audit cursor required'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'),max(x.id) into rows,v_next from (
 select a.* from public.audit_events a where a.id>p_after and a.created_at>=p_month::timestamp at time zone 'Asia/Dhaka'
 and a.created_at<(p_month+interval '1 month')::timestamp at time zone 'Asia/Dhaka'
 and (a.event_type ~ '^(finance_|treasury_|procurement_|supplier_return_|supplier_credit_|customer_sale_|customer_credit_|customer_cash_|customer_cod_)') order by a.id limit 1000) x;
 return jsonb_build_object('month',p_month,'rows',rows,'next_cursor',v_next,'has_more',exists(select 1 from public.audit_events a where a.id>coalesce(v_next,p_after) and a.created_at>=p_month::timestamp at time zone 'Asia/Dhaka' and a.created_at<(p_month+interval '1 month')::timestamp at time zone 'Asia/Dhaka' and a.event_type ~ '^(finance_|treasury_|procurement_|supplier_return_|supplier_credit_|customer_sale_|customer_credit_|customer_cash_|customer_cod_)'));
end $$;
revoke all on function public.finance_audit_export(date,bigint) from public,anon,authenticated;
grant execute on function public.finance_audit_export(date,bigint) to authenticated;
create function private.finance_audit_immutable() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.event_type ~ '^(finance_|treasury_|procurement_|supplier_return_|supplier_credit_|customer_sale_|customer_credit_|customer_cash_|customer_cod_)' then raise exception 'Financial audit history is immutable'; end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.finance_audit_immutable() from public,anon,authenticated,service_role;
create trigger finance_audit_immutable before update or delete on public.audit_events for each row execute function private.finance_audit_immutable();
create function public.finance_printable_snapshot(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 if p_kind='customer_event' then
 select jsonb_build_object('kind',case when e.kind='credit' then 'credit_note' else 'customer_sale' end,'code',e.id,'supplier','Customer source '||e.source_kind||' '||e.source_id,'product','Recorded product '+e.product_amount||' + delivery '||e.delivery_amount,'quantity',1,'unitPrice',e.product_amount+e.delivery_amount,'amount',e.product_amount+e.delivery_amount,'status',e.status,'reference',e.reason,'date',e.business_date) into r from public.finance_customer_events e where id=p_id;
 elsif p_kind='supplier_credit_note' then
 select jsonb_build_object('kind','credit_note','code',c.reference,'supplier',s.business_name,'product',p.name,'quantity',c.quantity,'unitPrice',b.unit_price,'amount',c.quantity*b.unit_price,'status',c.status,'reference',c.reason,'date',c.business_date) into r from public.finance_supplier_credit_notes c join public.procurement_supplier_bills b on b.id=c.bill_id join public.procurement_purchase_orders po on po.id=b.po_id join public.products p on p.id=po.product_id join public.suppliers s on s.id=b.supplier_id where c.id=p_id;
 elsif p_kind='cash_transaction' then
 select jsonb_build_object('kind','customer_receipt','code',t.external_reference,'supplier','Physical Treasury source / destination','product',replace(t.kind,'_',' '),'quantity',1,'unitPrice',t.amount,'amount',t.amount,'status',t.status,'reference',t.memo,'date',t.business_date) into r from public.treasury_transactions t where id=p_id;
 else raise exception 'Unsupported snapshot'; end if;
 return r;
end $$;
revoke all on function public.finance_printable_snapshot(text,uuid) from public,anon,authenticated;
grant execute on function public.finance_printable_snapshot(text,uuid) to authenticated;
