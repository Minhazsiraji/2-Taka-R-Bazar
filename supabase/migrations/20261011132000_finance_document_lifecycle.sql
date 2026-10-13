-- Lifecycle is an append-only overlay. Original bytes, fingerprints and links
-- never change, and document voiding never reverses a posted financial journal.
create table public.finance_document_events (
 id uuid primary key default gen_random_uuid(),
 attachment_id uuid not null references public.finance_document_attachments(id) on delete restrict,
 action text not null check(action in ('void','archive')),
 stage text not null check(stage in ('requested','approved','rejected')),
 request_id uuid unique references public.finance_document_events(id) on delete restrict,
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 actor_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 check((stage='requested')=(request_id is null))
);
alter table public.finance_document_events enable row level security;
revoke all on public.finance_document_events from public,anon,authenticated,service_role;
create trigger finance_database_write_lock before insert or update or delete on public.finance_document_events
 for each row execute function private.finance_write_lock();
create trigger finance_document_events_immutable before update or delete on public.finance_document_events
 for each row execute function private.finance_reject_journal_mutation();
create trigger finance_document_attachments_immutable before update or delete on public.finance_document_attachments
 for each row execute function private.finance_reject_journal_mutation();

create function public.finance_request_document_lifecycle(p_attachment uuid,p_action text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 perform id from public.finance_document_attachments where id=p_attachment for update;
 if not found then raise exception 'Document not found'; end if;
 if p_action not in ('void','archive') or p_action is null or length(btrim(coalesce(p_reason,''))) not between 10 and 1000
 then raise exception 'Document action and reason required'; end if;
 if exists(select 1 from public.finance_document_events e where e.attachment_id=p_attachment and
   (e.stage='approved' and e.action=p_action or e.stage='requested' and not exists(
    select 1 from public.finance_document_events r where r.request_id=e.id)))
 then raise exception 'Document already has this action or a pending review'; end if;
 insert into public.finance_document_events(attachment_id,action,stage,reason,actor_id)
 values(p_attachment,p_action,'requested',btrim(p_reason),auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'finance_document_lifecycle_requested','finance_document_attachment',p_attachment,
 jsonb_build_object('request_id',v_id,'action',p_action,'reason',btrim(p_reason)));
 return v_id;
end $$;

create function public.finance_review_document_lifecycle(p_request uuid,p_approve boolean,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.finance_document_events%rowtype;v_stage text;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into r from public.finance_document_events where id=p_request and stage='requested' for update;
 if not found then raise exception 'Document request not found'; end if;
 if r.actor_id=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if exists(select 1 from public.finance_document_events where request_id=r.id) then raise exception 'Document request already reviewed'; end if;
 if p_approve is null or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception 'Review decision and reason required'; end if;
 v_stage=case when p_approve then 'approved' else 'rejected' end;
 insert into public.finance_document_events(attachment_id,action,stage,request_id,reason,actor_id)
 values(r.attachment_id,r.action,v_stage,r.id,btrim(p_reason),auth.uid());
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'finance_document_lifecycle_'||v_stage,'finance_document_attachment',r.attachment_id,
 jsonb_build_object('request_id',r.id,'action',r.action,'reason',btrim(p_reason)));
 return v_stage;
end $$;

create or replace function public.finance_document_attachment_index()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_authorized(auth.uid()) then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'entity_type',a.entity_type,
 'entity_id',a.entity_id,'kind',a.kind,'name',a.display_name,'uploaded_at',a.uploaded_at,
 'state',coalesce((select case action when 'archive' then 'archived' else 'voided' end
  from public.finance_document_events where attachment_id=a.id and stage='approved' order by created_at desc,id desc limit 1),'active'),
 'pending_request',(select e.id from public.finance_document_events e where e.attachment_id=a.id
  and e.stage='requested' and not exists(select 1 from public.finance_document_events r where r.request_id=e.id) limit 1)
 ) order by a.uploaded_at desc) from (select * from public.finance_document_attachments order by uploaded_at desc limit 150) a),'[]'::jsonb);
end $$;

create function public.finance_original_fingerprint(p_entity_type text,p_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_hash text;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 if p_entity_type='attachment' then
 select evidence_sha256 into v_hash from public.finance_document_attachments where id=p_id;
 elsif p_entity_type='bill' then
 select evidence_sha256 into v_hash from public.procurement_supplier_bills where id=p_id;
 else raise exception 'Invalid original document type'; end if;
 return v_hash;
end $$;
revoke all on function public.finance_request_document_lifecycle(uuid,text,text),public.finance_review_document_lifecycle(uuid,boolean,text),public.finance_original_fingerprint(text,uuid) from public,anon,authenticated;
grant execute on function public.finance_request_document_lifecycle(uuid,text,text),public.finance_review_document_lifecycle(uuid,boolean,text),public.finance_original_fingerprint(text,uuid) to authenticated;
