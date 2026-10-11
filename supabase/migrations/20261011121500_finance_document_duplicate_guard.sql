-- Existing duplicate evidence remains immutable. Reject new same-content uploads per document.
-- Lock protects the check/insert from concurrent identical uploads.
create or replace function public.finance_attach_document(
 p_entity_type text,p_entity_id uuid,p_kind text,p_name text,p_path text,p_sha256 text
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid();v_id uuid;
begin
 if not private.finance_authorized(v_user) then raise exception 'Finance role required'; end if;
 if p_entity_type not in ('po','bill') or p_kind not in
 ('signed_po','supplier_invoice','goods_receipt','delivery_note','other')
 or length(btrim(coalesce(p_name,''))) not between 3 and 140
 or p_sha256 !~ '^[a-f0-9]{64}$' or p_path not like v_user::text||'/%'
 then raise exception 'Invalid evidence metadata'; end if;
 if not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path)
 then raise exception 'Private evidence file was not uploaded'; end if;
 if p_entity_type='po' and not exists(select 1 from public.procurement_purchase_orders where id=p_entity_id)
 then raise exception 'PO not found'; end if;
 if p_entity_type='bill' and not exists(select 1 from public.procurement_supplier_bills where id=p_entity_id)
 then raise exception 'Bill not found'; end if;
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
revoke all on function public.finance_attach_document(text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finance_attach_document(text,uuid,text,text,text,text) to authenticated;
