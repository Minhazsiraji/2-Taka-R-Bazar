-- Operator-only source allowlist prevents a leased test actor from posting real
-- customer sources or restoring real physical stock. No public issuance RPC.
create table private.finance_uat_entities (
 entity_type text not null check(entity_type in ('order','group_commitment','ops_day')),
 entity_id uuid not null,reason text not null check(length(btrim(reason))>=10),
 registered_at timestamptz not null default now(),primary key(entity_type,entity_id)
);
alter table private.finance_uat_entities enable row level security;
revoke all on private.finance_uat_entities from public,anon,authenticated,service_role;
create function private.finance_assert_uat_origin(p_table text,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb;v_actor uuid;
begin
 if p_id is null then return; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into r using p_id;
 v_actor=coalesce(nullif(r->>'created_by',''),nullif(r->>'requested_by',''),nullif(r->>'submitted_by',''),nullif(r->>'uploaded_by',''),nullif(r->>'posted_by',''),nullif(r->>'imported_by',''))::uuid;
 if v_actor is null or not exists(select 1 from private.finance_uat_leases where actor_id=v_actor and expires_at>clock_timestamp()) then
 raise exception using errcode='42501',message='UAT scope denied: financial resource is not an active synthetic fixture'; end if;
end $$;
revoke all on function private.finance_assert_uat_origin(text,uuid) from public,anon,authenticated,service_role;
create or replace function private.finance_write_lock() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb;v_origin uuid;v record;v_kind text;v_id uuid;
begin
 perform private.finance_assert_write_allowed();
 if auth.uid() is null and session_user in ('postgres','supabase_admin') and coalesce(current_setting('role',true),'none') in ('none','postgres','supabase_admin') then
 if tg_op='DELETE' then return old; else return new; end if; end if;
 r=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op<>'INSERT' then
 v_origin=coalesce(nullif(to_jsonb(old)->>'created_by',''),nullif(to_jsonb(old)->>'requested_by',''),nullif(to_jsonb(old)->>'submitted_by',''),nullif(to_jsonb(old)->>'uploaded_by',''),nullif(to_jsonb(old)->>'posted_by',''),nullif(to_jsonb(old)->>'imported_by',''))::uuid;
 else v_origin=coalesce(nullif(r->>'created_by',''),nullif(r->>'requested_by',''),nullif(r->>'submitted_by',''),nullif(r->>'uploaded_by',''),nullif(r->>'posted_by',''),nullif(r->>'imported_by',''))::uuid; end if;
 if v_origin is not null and not exists(select 1 from private.finance_uat_leases where actor_id=v_origin and expires_at>clock_timestamp()) then
 raise exception using errcode='42501',message='UAT scope denied: financial resource is not an active synthetic fixture'; end if;
 if tg_table_name='finance_accounts' and (tg_op<>'INSERT' or r->>'code' !~ '^[TD][a-f0-9]{32}$') then raise exception using errcode='42501',message='UAT scope denied: core chart of accounts is operator-only'; end if;
 -- All referenced cash accounts and financial sources must also be fixtures.
 for v in select * from (values
 ('source_account_id','treasury_accounts'),('target_account_id','treasury_accounts'),('account_id','treasury_accounts'),('cash_account_id','treasury_accounts'),
 ('facility_id','treasury_facilities'),('expense_id','finance_expenses'),('supplier_bill_id','procurement_supplier_bills'),
 ('bill_id','procurement_supplier_bills'),('supplier_credit_note_id','finance_supplier_credit_notes'),('po_id','procurement_purchase_orders'),('journal_id','finance_journals'),
 ('attachment_id','finance_document_attachments'),('transaction_id','treasury_transactions'),
 ('matched_transaction_id','treasury_transactions'),('customer_event_id','finance_customer_events'),('sale_id','finance_customer_events'),('event_id','finance_customer_events')) x(field_name,table_name)
 loop if nullif(r->>v.field_name,'') is not null then perform private.finance_assert_uat_origin(v.table_name,(r->>v.field_name)::uuid); end if; end loop;
 if tg_table_name='finance_customer_events' then
 if r->>'kind'='sale' then
 if not exists(select 1 from private.finance_uat_entities where entity_type=r->>'source_kind' and entity_id=(r->>'source_id')::uuid) then raise exception using errcode='42501',message='UAT scope denied: customer source is not operator-registered'; end if;
 else perform private.finance_assert_uat_origin('finance_customer_events',(r->>'source_id')::uuid); end if;
 end if;
 if tg_table_name in ('finance_customer_cod_allocations','treasury_community_cash_receipts') then
 if not exists(select 1 from private.finance_uat_entities where entity_type='ops_day' and entity_id=(r->>'day_id')::uuid) then raise exception using errcode='42501',message='UAT scope denied: custody source is not operator-registered'; end if; end if;
 if tg_table_name='finance_journal_lines' or tg_table_name='finance_settlement_requests' then
 perform private.finance_assert_uat_origin('treasury_accounts',(select id from public.treasury_accounts where ledger_code=r->>'account_code'));
 perform private.finance_assert_uat_origin('treasury_facilities',(select id from public.treasury_facilities where ledger_code=r->>'account_code'));
 end if;
 if tg_table_name='finance_document_attachments' then
 v_kind=case r->>'entity_type' when 'po' then 'procurement_purchase_orders' when 'bill' then 'procurement_supplier_bills' when 'customer_event' then 'finance_customer_events' when 'supplier_credit_note' then 'finance_supplier_credit_notes' when 'cash_transaction' then 'treasury_transactions' when 'statement' then 'treasury_statement_lines' end;
 perform private.finance_assert_uat_origin(v_kind,(r->>'entity_id')::uuid);
 end if;
 if tg_table_name='finance_periods' and exists(select 1 from public.finance_journals j where j.posting_date<(r->>'month_start')::date+interval '1 month' and not exists(select 1 from private.finance_uat_leases l where l.actor_id=j.posted_by and l.expires_at>clock_timestamp())) then raise exception using errcode='42501',message='UAT scope denied: period contains non-fixture journals'; end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
create function private.finance_uat_operator_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(null,'finance_uat_operator_'||lower(tg_op),tg_table_name,null,jsonb_build_object('operator',session_user,'old',case when tg_op<>'INSERT' then to_jsonb(old) else null end,'new',case when tg_op<>'DELETE' then to_jsonb(new) else null end));
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.finance_uat_operator_audit() from public,anon,authenticated,service_role;
create trigger finance_uat_lease_audit after insert or update or delete on private.finance_uat_leases for each row execute function private.finance_uat_operator_audit();
create trigger finance_uat_source_audit after insert or update or delete on private.finance_uat_entities for each row execute function private.finance_uat_operator_audit();
