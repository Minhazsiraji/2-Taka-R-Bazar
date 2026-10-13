-- Budget approval and expense attribution are separate immutable source records.
create table public.finance_campaign_budgets (
 id uuid primary key default gen_random_uuid(),
 code text not null check(length(btrim(code)) between 4 and 80),
 month_start date not null check(extract(day from month_start)=1),
 channel text not null check(channel in ('offline','facebook','google','youtube','other_online')),
 amount numeric(16,2) not null check(amount>0),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 requested_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 check(reviewed_by is null or reviewed_by<>requested_by)
);
create unique index finance_campaign_budget_once on public.finance_campaign_budgets(upper(btrim(code)),month_start) where status<>'rejected';
create table public.finance_expense_attributions (
 id uuid primary key default gen_random_uuid(),
 expense_id uuid not null references public.finance_expenses(id) on delete restrict,
 allocations jsonb not null check(jsonb_typeof(allocations)='array'),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 requested_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 check(reviewed_by is null or reviewed_by<>requested_by)
);
create unique index finance_expense_attribution_once on public.finance_expense_attributions(expense_id) where status<>'rejected';
do $$ declare t text; begin
 foreach t in array array['finance_campaign_budgets','finance_expense_attributions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger finance_database_write_lock before insert or update or delete on public.%I for each row execute function private.finance_write_lock()',t);
 end loop;
end $$;
create function private.finance_attribution_source_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(old)-array['status','reviewed_by']) is distinct from (to_jsonb(new)-array['status','reviewed_by'])
 or old.status<>'pending' then raise exception 'Financial attribution source is immutable'; end if;
 return new;
end $$;
revoke all on function private.finance_attribution_source_guard() from public,anon,authenticated,service_role;
create trigger finance_campaign_source_immutable before update or delete on public.finance_campaign_budgets for each row execute function private.finance_attribution_source_guard();
create trigger finance_expense_attribution_source_immutable before update or delete on public.finance_expense_attributions for each row execute function private.finance_attribution_source_guard();

create function public.finance_request_campaign_budget(p_code text,p_month date,p_channel text,p_amount numeric,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed(); perform private.finance_require_open(p_month);
 if p_amount is null or p_amount<=0 or p_amount>100000000 or round(p_amount,2)<>p_amount then raise exception 'Invalid BDT budget amount'; end if;
 insert into public.finance_campaign_budgets(code,month_start,channel,amount,reason,requested_by)
 values(btrim(p_code),p_month,p_channel,p_amount,btrim(p_reason),auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'campaign_budget_requested','finance_campaign_budget',v_id,jsonb_build_object('amount',p_amount,'code',p_code,'month',p_month,'channel',p_channel));
 return v_id;
end $$;
create function public.finance_review_campaign_budget(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare b public.finance_campaign_budgets%rowtype;v_status text;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into b from public.finance_campaign_budgets where id=p_id for update;
 if not found or b.status<>'pending' then raise exception 'Budget not pending'; end if;
 if b.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Budget review reason required'; end if;
 perform private.finance_require_open(b.month_start);
 v_status=case when p_approve then 'approved' else 'rejected' end;
 update public.finance_campaign_budgets set status=v_status,reviewed_by=auth.uid() where id=b.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'campaign_budget_'||v_status,'finance_campaign_budget',b.id,jsonb_build_object('note',p_note,'amount',b.amount));
 return v_status;
end $$;

create function private.finance_validate_attribution(p_expense uuid,p_rows jsonb,p_current uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare e public.finance_expenses%rowtype;x jsonb;b public.finance_campaign_budgets%rowtype;
 v_total numeric:=0;v_value numeric;v_reserved numeric;v_budget uuid;
begin
 select * into e from public.finance_expenses where id=p_expense for update;
 if not found or e.status not in ('posted','settlement_requested','settled') then raise exception 'Approved expense required'; end if;
 perform private.finance_require_open(e.incurred_on);
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 50 then raise exception 'One to fifty attribution rows required'; end if;
 -- Lock all campaign resources in deterministic order; reserve pending budgets too.
 perform id from public.finance_campaign_budgets where id in (
 select (v->>'budget_id')::uuid from jsonb_array_elements(p_rows) v where nullif(v->>'budget_id','') is not null) order by id for update;
 for x in select value from jsonb_array_elements(p_rows) loop
 v_value=(x->>'amount')::numeric;
 if v_value is null or v_value<=0 or round(v_value,2)<>v_value then raise exception 'Invalid exact BDT allocation'; end if;
 if coalesce(x->>'cost_center','') not in ('staff','technology','marketing','logistics','commission','operations','company') then raise exception 'Controlled cost center required'; end if;
 if nullif(x->>'community_id','') is not null and not exists(select 1 from public.communities where id=(x->>'community_id')::uuid) then raise exception 'Invalid community attribution'; end if;
 if nullif(x->>'pool_id','') is not null and not exists(select 1 from public.pools where id=(x->>'pool_id')::uuid and (nullif(x->>'community_id','') is null or community_id=(x->>'community_id')::uuid)) then raise exception 'Pool and community attribution mismatch'; end if;
 if nullif(x->>'product_id','') is not null and not exists(select 1 from public.products where id=(x->>'product_id')::uuid) then raise exception 'Invalid product attribution'; end if;
 if nullif(x->>'staff_user_id','') is not null and not exists(select 1 from public.user_roles where user_id=(x->>'staff_user_id')::uuid and role<>'customer') then raise exception 'Staff or commission beneficiary required'; end if;
 if e.category='commissions' and nullif(x->>'staff_user_id','') is null then raise exception 'Commission beneficiary required'; end if;
 v_budget=nullif(x->>'budget_id','')::uuid;
 if e.category in ('marketing_offline','marketing_online') and v_budget is null then raise exception 'Approved marketing budget required'; end if;
 if v_budget is not null then
 select * into b from public.finance_campaign_budgets where id=v_budget and status='approved';
 if not found or b.month_start<>date_trunc('month',e.incurred_on)::date then raise exception 'Approved budget in expense month required'; end if;
 if e.category='marketing_offline' and b.channel<>'offline' or e.category='marketing_online' and b.channel='offline' then raise exception 'Campaign channel and expense category mismatch'; end if;
 select coalesce(sum((r->>'amount')::numeric),0) into v_reserved from public.finance_expense_attributions a
 cross join lateral jsonb_array_elements(a.allocations) r where a.status in ('pending','approved')
 and (p_current is null or a.id<>p_current) and nullif(r->>'budget_id','')::uuid=b.id;
 if v_reserved+(select sum((r->>'amount')::numeric) from jsonb_array_elements(p_rows) r where nullif(r->>'budget_id','')::uuid=b.id)>b.amount then raise exception 'Campaign budget exceeded including pending reservations'; end if;
 end if;
 v_total=v_total+v_value;
 end loop;
 if v_total<>e.amount then raise exception 'Allocation total must exactly equal source expense'; end if;
end $$;
revoke all on function private.finance_validate_attribution(uuid,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.finance_request_expense_attribution(p_expense uuid,p_rows jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 perform private.finance_validate_attribution(p_expense,p_rows);
 insert into public.finance_expense_attributions(expense_id,allocations,reason,requested_by)
 values(p_expense,p_rows,btrim(p_reason),auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'expense_attribution_requested','finance_expense_attribution',v_id,jsonb_build_object('expense_id',p_expense,'reason',p_reason));
 return v_id;
end $$;
create function public.finance_review_expense_attribution(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.finance_expense_attributions%rowtype;v_status text;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into a from public.finance_expense_attributions where id=p_id for update;
 if not found or a.status<>'pending' then raise exception 'Attribution not pending'; end if;
 if a.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Attribution review reason required'; end if;
 if p_approve then perform private.finance_validate_attribution(a.expense_id,a.allocations,a.id); end if;
 v_status=case when p_approve then 'approved' else 'rejected' end;
 update public.finance_expense_attributions set status=v_status,reviewed_by=auth.uid() where id=a.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'expense_attribution_'||v_status,'finance_expense_attribution',a.id,jsonb_build_object('expense_id',a.expense_id,'note',p_note));
 return v_status;
end $$;
create function public.finance_attribution_source() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 return jsonb_build_object('budgets',coalesce((select jsonb_agg(to_jsonb(b)) from public.finance_campaign_budgets b),'[]'::jsonb),
 'attributions',coalesce((select jsonb_agg(to_jsonb(a)) from public.finance_expense_attributions a),'[]'::jsonb),
 'expense_sources',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'category',e.category,'description',e.description,'amount',e.amount,'incurred_on',e.incurred_on,
 'attributed',exists(select 1 from public.finance_expense_attributions a where a.expense_id=e.id and a.status in ('pending','approved')))) from public.finance_expenses e where e.status in ('posted','settled','settlement_requested')),'[]'::jsonb));
end $$;
revoke all on function public.finance_request_campaign_budget(text,date,text,numeric,text),public.finance_review_campaign_budget(uuid,boolean,text),public.finance_request_expense_attribution(uuid,jsonb,text),public.finance_review_expense_attribution(uuid,boolean,text),public.finance_attribution_source() from public,anon,authenticated;
grant execute on function public.finance_request_campaign_budget(text,date,text,numeric,text),public.finance_review_campaign_budget(uuid,boolean,text),public.finance_request_expense_attribution(uuid,jsonb,text),public.finance_review_expense_attribution(uuid,boolean,text),public.finance_attribution_source() to authenticated;
