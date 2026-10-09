-- Additional immutable, privately stored manual and generated document evidence.
-- No historic finance migration is modified. All access is finance-role checked.
create table public.finance_document_attachments (
 id uuid primary key default gen_random_uuid(),
 entity_type text not null check(entity_type in ('po','bill')),
 entity_id uuid not null,
 kind text not null check(kind in ('signed_po','supplier_invoice','goods_receipt','delivery_note','other')),
 display_name text not null check(length(display_name) between 3 and 140),
 evidence_path text not null unique,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 uploaded_by uuid not null references auth.users(id) on delete restrict,
 uploaded_at timestamptz not null default now()
);
create index finance_document_attachment_entity on public.finance_document_attachments(entity_type,entity_id,uploaded_at desc);
alter table public.finance_document_attachments enable row level security;
revoke all on public.finance_document_attachments from public,anon,authenticated,service_role;

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
 insert into public.finance_document_attachments(entity_type,entity_id,kind,display_name,evidence_path,evidence_sha256,uploaded_by)
 values(p_entity_type,p_entity_id,p_kind,btrim(p_name),p_path,p_sha256,v_user) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_user,'finance_document_attached','finance_document_attachment',v_id,
 jsonb_build_object('linked_type',p_entity_type,'linked_id',p_entity_id,'sha256',p_sha256,'kind',p_kind));
 return v_id;
end $fn$;
revoke all on function public.finance_attach_document(text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finance_attach_document(text,uuid,text,text,text,text) to authenticated;

create or replace function public.finance_document_attachment_index()
returns jsonb language sql stable security definer set search_path='' as $fn$
 select case when private.finance_authorized(auth.uid())
 then coalesce((select jsonb_agg(jsonb_build_object('id',id,'entity_type',entity_type,'entity_id',entity_id,
 'kind',kind,'name',display_name,'uploaded_at',uploaded_at) order by uploaded_at desc)
 from (select * from public.finance_document_attachments order by uploaded_at desc limit 150) a),'[]'::jsonb)
 else '[]'::jsonb end
$fn$;
revoke all on function public.finance_document_attachment_index() from public,anon,authenticated;
grant execute on function public.finance_document_attachment_index() to authenticated;

create or replace function public.finance_attachment_download_path(p_id uuid)
returns text language plpgsql stable security definer set search_path='' as $fn$
declare v_path text;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 select evidence_path into v_path from public.finance_document_attachments where id=p_id;
 return v_path;
end $fn$;
revoke all on function public.finance_attachment_download_path(uuid) from public,anon,authenticated;
grant execute on function public.finance_attachment_download_path(uuid) to authenticated;
