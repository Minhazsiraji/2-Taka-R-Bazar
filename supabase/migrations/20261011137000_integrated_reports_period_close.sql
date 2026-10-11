-- One lock coordinates posting and close. The lock is held until commit.
create or replace function private.finance_require_open(p_date date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_date is null then raise exception 'Accounting date required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('finance:period:'||date_trunc('month',p_date::timestamp)::date::text,0));
 if exists(select 1 from public.finance_periods where month_start=date_trunc('month',p_date::timestamp)::date and state='locked') then raise exception 'Finance period is locked'; end if;
end $$;
create function private.finance_journal_period_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform private.finance_require_open(new.posting_date);return new;end $$;
revoke all on function private.finance_journal_period_guard() from public,anon,authenticated,service_role;
create trigger finance_journal_period_guard before insert on public.finance_journals for each row execute function private.finance_journal_period_guard();

create function public.finance_integrated_report(p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_end date;v_accounts jsonb;v_models jsonb;v_products jsonb;v_pools jsonb;v_communities jsonb;v_expenses jsonb;v_inventory jsonb;v_campaigns jsonb;
 v_revenue numeric;v_delivery numeric;v_cogs numeric;v_expense numeric;v_cash numeric;v_cash_open numeric;v_stock_ledger numeric;v_stock_source numeric;
 v_ap_ledger numeric;v_ap_source numeric;v_ar numeric;v_unallocated numeric;v_supplier_credit numeric;v_refund numeric;v_blockers jsonb:='[]';v_count bigint;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_month>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Valid first day of accounting month required'; end if;
 v_end=(p_month+interval '1 month')::date;
 select coalesce(jsonb_agg(jsonb_build_object('code',a.code,'title',a.title,'kind',a.kind,'debit',a.debit,'credit',a.credit,'balance',a.debit-a.credit) order by a.code),'[]') into v_accounts
 from (select a.code,a.title,a.kind,coalesce(sum(l.debit),0) debit,coalesce(sum(l.credit),0) credit from public.finance_accounts a
 left join (select l.* from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id where j.posting_date<v_end) l on l.account_code=a.code group by a.code,a.title,a.kind) a;
 select coalesce(sum(case when l.account_code='4000' then l.credit-l.debit else 0 end),0),
 coalesce(sum(case when l.account_code='4010' then l.credit-l.debit else 0 end),0),
 coalesce(sum(case when a.kind='cogs' then l.debit-l.credit else 0 end),0),
 coalesce(sum(case when a.kind='expense' then l.debit-l.credit else 0 end),0)
 into v_revenue,v_delivery,v_cogs,v_expense from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id join public.finance_accounts a on a.code=l.account_code where j.posting_date>=p_month and j.posting_date<v_end;
 select coalesce(sum(l.debit-l.credit),0),coalesce(sum(case when j.posting_date<p_month then l.debit-l.credit else 0 end),0)
 into v_cash,v_cash_open from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id join public.treasury_accounts a on a.ledger_code=l.account_code where a.account_kind<>'credit_card' and j.posting_date<v_end;
 select coalesce(sum(case when l.account_code='1200' then l.debit-l.credit else 0 end),0),
 coalesce(sum(case when l.account_code in ('2000','2100') then l.credit-l.debit else 0 end),0),
 coalesce(sum(case when l.account_code='1100' then l.debit-l.credit else 0 end),0),
 coalesce(sum(case when l.account_code in ('2210','2211') then l.credit-l.debit else 0 end),0),
 coalesce(sum(case when l.account_code='1300' then l.debit-l.credit else 0 end),0),
 coalesce(sum(case when l.account_code='2300' then l.credit-l.debit else 0 end),0)
 into v_stock_ledger,v_ap_ledger,v_ar,v_unallocated,v_supplier_credit,v_refund from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id where j.posting_date<v_end;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',p.product_id,'quantity',p.qty,'value',p.value) order by p.product_id),'[]'),coalesce(sum(p.value),0) into v_inventory,v_stock_source
 from (select l.product_id,sum(l.received_quantity+coalesce(m.qty,0)) qty,sum(l.received_quantity*l.unit_cost+coalesce(m.value,0)) value
 from public.finance_inventory_lots l join public.procurement_supplier_bills b on b.id=l.bill_id
 join public.finance_journals bj on bj.id=b.journal_id and bj.posting_date<v_end
 left join lateral(select sum(m.quantity) qty,sum(m.value) value from public.finance_inventory_movements m join public.finance_journals j on j.id=m.journal_id where m.bill_id=l.bill_id and j.posting_date<v_end) m on true group by l.product_id) p;
 -- Independent source AP, including paid supplier credit receivables and expense/card settlement.
 select coalesce(sum(greatest(0,b.amount-coalesce(c.credits,0)-coalesce(t.paid,0))),0) into v_ap_source
 from public.procurement_supplier_bills b join public.finance_journals j on j.id=b.journal_id and j.posting_date<v_end
 left join lateral(select sum(c.quantity*b.unit_price) credits from public.finance_supplier_credit_notes c join public.finance_journals cj on cj.id=c.journal_id where c.bill_id=b.id and c.status='posted' and cj.posting_date<v_end) c on true
 left join lateral(select sum(amount) paid from public.treasury_transactions t where t.supplier_bill_id=b.id and t.status='posted' and t.business_date<v_end) t on true;
 select v_ap_source+coalesce(sum(greatest(0,e.amount-coalesce(t.paid,0)-coalesce(s.paid,0))),0) into v_ap_source
 from public.finance_expenses e
 left join lateral(select sum(amount) paid from public.treasury_transactions t where t.expense_id=e.id and t.status='posted' and t.business_date<v_end) t on true
 left join lateral(select sum(e.amount) paid from public.finance_settlement_requests s where s.expense_id=e.id and s.status='verified' and s.payment_date<v_end) s on true
 where e.status in ('posted','settled','settlement_requested') and e.incurred_on<v_end;
 select coalesce(jsonb_agg(jsonb_build_object('key',x.key,'product_revenue',x.revenue,'cogs',x.cost,'product_gross_profit',x.revenue-x.cost) order by x.key),'[]') into v_models
 from (select coalesce(r->>'model','unallocated') key,
 sum((case when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_price')::numeric) revenue,
 sum((case when e.kind='credit' and not e.restock then 0 when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost
 from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) r where e.status='posted' and e.business_date>=p_month and e.business_date<v_end group by r->>'model') x;
 select coalesce(jsonb_agg(jsonb_build_object('key',x.key,'product_revenue',x.revenue,'cogs',x.cost,'product_gross_profit',x.revenue-x.cost) order by x.key),'[]') into v_products
 from (select coalesce(r->>'product_id','unallocated') key,
 sum((case when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_price')::numeric) revenue,
 sum((case when e.kind='credit' and not e.restock then 0 when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost
 from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) r where e.status='posted' and e.business_date>=p_month and e.business_date<v_end group by r->>'product_id') x;
 select coalesce(jsonb_agg(jsonb_build_object('key',x.key,'product_revenue',x.revenue,'cogs',x.cost,'product_gross_profit',x.revenue-x.cost) order by x.key),'[]') into v_pools
 from (select coalesce(e.source_snapshot->>'pool_id','unallocated') key,
 sum((case when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_price')::numeric) revenue,
 sum((case when e.kind='credit' and not e.restock then 0 when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost
 from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) r where e.status='posted' and e.business_date>=p_month and e.business_date<v_end group by e.source_snapshot->>'pool_id') x;
 select coalesce(jsonb_agg(jsonb_build_object('key',x.key,'product_revenue',x.revenue,'cogs',x.cost,'product_gross_profit',x.revenue-x.cost) order by x.key),'[]') into v_communities
 from (select coalesce(e.community_id::text,'unallocated') key,
 sum((case when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_price')::numeric) revenue,
 sum((case when e.kind='credit' and not e.restock then 0 when e.kind='credit' then -1 else 1 end)*(r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost
 from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) r where e.status='posted' and e.business_date>=p_month and e.business_date<v_end group by e.community_id::text) x;
 select coalesce(jsonb_agg(jsonb_build_object('cost_center',x.center,'community_id',x.community,'product_id',x.product,'budget_id',x.budget,'staff_user_id',x.staff,'amount',x.amount) order by x.center,x.community,x.product,x.budget,x.staff),'[]') into v_expenses
 from (select r->>'cost_center' center,r->>'community_id' community,r->>'product_id' product,r->>'budget_id' budget,r->>'staff_user_id' staff,sum((r->>'amount')::numeric) amount
 from public.finance_expense_attributions a join public.finance_expenses e on e.id=a.expense_id cross join lateral jsonb_array_elements(a.allocations) r
 where a.status='approved' and e.incurred_on>=p_month and e.incurred_on<v_end group by r->>'cost_center',r->>'community_id',r->>'product_id',r->>'budget_id',r->>'staff_user_id') x;
 select coalesce(jsonb_agg(jsonb_build_object('code',b.code,'channel',b.channel,'approved_budget',b.amount,'attributed_spend',coalesce(a.amount,0),'tracked_completed_buyers',q.buyers,
 'cost_per_tracked_completed_buyer',case when q.buyers>0 then round(coalesce(a.amount,0)/q.buyers,2) else null end,'basis','QR conversion before fulfilment; posted net product purchase required') order by b.code),'[]') into v_campaigns
 from public.finance_campaign_budgets b
 left join lateral(select sum((r->>'amount')::numeric) amount from public.finance_expense_attributions a cross join lateral jsonb_array_elements(a.allocations) r where a.status='approved' and nullif(r->>'budget_id','')::uuid=b.id) a on true
 left join lateral(select count(distinct c.user_id) buyers from public.community_qr_codes qr join public.community_qr_conversions c on c.qr_code_id=qr.id where qr.code=upper(btrim(b.code)) and exists(
 select 1 from public.finance_customer_events s where s.kind='sale' and s.status='posted' and s.community_id=c.community_id and s.business_date>=p_month and s.business_date<v_end
 and s.product_amount>coalesce((select sum(product_amount) from public.finance_customer_events cr where cr.kind='credit' and cr.source_id=s.id and cr.status='posted' and cr.business_date<v_end),0)
 and (s.source_kind='order' and exists(select 1 from public.orders o where o.id=s.source_id and o.customer_id=c.user_id and o.completed_at>=c.converted_at)
 or s.source_kind='group_commitment' and exists(select 1 from public.group_deal_commitments g where g.id=s.source_id and g.customer_id=c.user_id and g.fulfilled_at>=c.converted_at)))) q on true
 where b.month_start=p_month and b.status='approved';
 if v_stock_ledger<>v_stock_source then v_blockers=v_blockers||jsonb_build_array('INVENTORY_LEDGER_SOURCE_MISMATCH'); end if;
 if v_ap_ledger<>v_ap_source then v_blockers=v_blockers||jsonb_build_array('AP_LEDGER_SOURCE_MISMATCH'); end if;
 if exists(select 1 from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id where j.posting_date<v_end group by j.id having sum(l.debit)<>sum(l.credit)) then v_blockers=v_blockers||jsonb_build_array('UNBALANCED_JOURNAL'); end if;
 select count(*) into v_count from public.orders o where o.status='completed' and o.payment_status<>'waived_test_order' and (o.completed_at at time zone 'Asia/Dhaka')::date>=p_month and (o.completed_at at time zone 'Asia/Dhaka')::date<v_end and not exists(select 1 from public.finance_customer_events s where s.source_kind='order' and s.source_id=o.id and s.kind='sale' and s.status='posted');
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('COMPLETED_ORDERS_UNPOSTED:'||v_count); end if;
 select count(*) into v_count from public.group_deal_commitments g where g.status='fulfilled' and (g.fulfilled_at is null or (g.fulfilled_at at time zone 'Asia/Dhaka')::date>=p_month and (g.fulfilled_at at time zone 'Asia/Dhaka')::date<v_end and not exists(select 1 from public.finance_customer_events s where s.source_kind='group_commitment' and s.source_id=g.id and s.status='posted'));
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('GROUP_FULFILMENTS_UNRECONCILED:'||v_count); end if;
 select count(*) into v_count from public.finance_expenses e where e.incurred_on>=p_month and e.incurred_on<v_end and
 (e.status in ('submitted','settlement_requested') or e.status in ('posted','settled') and not exists(select 1 from public.finance_expense_attributions a where a.expense_id=e.id and a.status='approved'));
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('EXPENSES_PENDING_OR_UNALLOCATED:'||v_count); end if;
 select count(*) into v_count from public.treasury_transactions where business_date>=p_month and business_date<v_end and status='pending';
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('TREASURY_REQUESTS_PENDING:'||v_count); end if;
 select count(*) into v_count from public.procurement_supplier_bills where invoice_date>=p_month and invoice_date<v_end and status='submitted';
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('SUPPLIER_INVOICES_PENDING:'||v_count); end if;
 select count(*) into v_count from public.finance_customer_events where business_date>=p_month and business_date<v_end and status='pending';
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('CUSTOMER_EVENTS_PENDING:'||v_count); end if;
 select count(*) into v_count from public.finance_supplier_credit_notes where business_date>=p_month and business_date<v_end and status='pending';
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('SUPPLIER_CREDITS_PENDING:'||v_count); end if;
 select count(*) into v_count from public.finance_customer_cod_allocations a join public.finance_customer_events s on s.id=a.sale_id where s.business_date>=p_month and s.business_date<v_end and a.status='pending';
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('COD_ALLOCATIONS_PENDING:'||v_count); end if;
 select count(*) into v_count from public.treasury_transactions t join public.treasury_accounts a on a.id in(t.source_account_id,t.target_account_id)
 where t.status='posted' and t.business_date>=p_month and t.business_date<v_end and a.account_kind in ('bank','wallet') and not exists(select 1 from public.treasury_statement_lines l where l.account_id=a.id and l.matched_transaction_id=t.id);
 if v_count>0 then v_blockers=v_blockers||jsonb_build_array('BANK_LEGS_UNMATCHED:'||v_count); end if;
 return jsonb_build_object('month',p_month,'basis','Accrual double-entry, verified inventory layers, physical Treasury cash',
 'product_revenue',v_revenue,'delivery_income',v_delivery,'cogs',v_cogs,'product_gross_profit',v_revenue-v_cogs,
 'operating_and_financing_expenses',v_expense,'profit_before_tax',v_revenue+v_delivery-v_cogs-v_expense,
 'tax_amount',null,'profit_after_tax',null,'certification',case when jsonb_array_length(v_blockers)=0 then 'SOURCE_RECONCILED_BEFORE_TAX' else 'PROVISIONAL_BLOCKERS_REMAIN' end,
 'cash_open',v_cash_open,'cash_movement',v_cash-v_cash_open,'cash_close',v_cash,'inventory_ledger',v_stock_ledger,'inventory_source',v_stock_source,
 'ap_ledger',v_ap_ledger,'ap_source',v_ap_source,'customer_ar',v_ar,'customer_refund_payable',v_refund,'supplier_credit_receivable',v_supplier_credit,'unallocated_cod_liability',v_unallocated,
 'by_model',v_models,'by_product',v_products,'by_pool',v_pools,'by_community',v_communities,'expense_attributions',v_expenses,'campaigns',v_campaigns,
 'inventory',v_inventory,'trial_balance',v_accounts,'blockers',v_blockers,'limitations',jsonb_build_array('Product margins exclude delivery and company costs unless explicitly attributed','Bank verification is independent supplied-statement matching; no bank-provider authenticity claim','Tax requires configured policy; profit after tax is unavailable'));
end $$;
revoke all on function public.finance_integrated_report(date) from public,anon,authenticated;
grant execute on function public.finance_integrated_report(date) to authenticated;

create table public.finance_period_close_requests (
 id uuid primary key default gen_random_uuid(),month_start date not null check(extract(day from month_start)=1),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 suspense_explanation text not null default '',snapshot jsonb not null,snapshot_sha256 text not null,
 requested_by uuid not null references auth.users(id) on delete restrict,reviewed_by uuid references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),check(reviewed_by is null or reviewed_by<>requested_by)
);
create unique index finance_close_one_live on public.finance_period_close_requests(month_start) where status<>'rejected';
alter table public.finance_period_close_requests enable row level security;
revoke all on public.finance_period_close_requests from public,anon,authenticated,service_role;
create trigger finance_database_write_lock before insert or update or delete on public.finance_period_close_requests for each row execute function private.finance_write_lock();
create trigger finance_close_source_immutable before update or delete on public.finance_period_close_requests for each row execute function private.finance_attribution_source_guard();
create function public.finance_request_period_close(p_month date,p_reason text,p_suspense_explanation text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r jsonb;v_id uuid;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin close maker required'; end if;
 perform private.finance_assert_write_allowed();perform private.finance_require_open(p_month);
 if p_month>=date_trunc('month',(now() at time zone 'Asia/Dhaka'))::date then raise exception 'Only ended accounting months can close'; end if;
 r=public.finance_integrated_report(p_month);
 if jsonb_array_length(r->'blockers')>0 then raise exception 'Period close blocked: %',r->'blockers'; end if;
 if (r->>'unallocated_cod_liability')::numeric<>0 and length(btrim(coalesce(p_suspense_explanation,'')))<20 then raise exception 'Unallocated custody liability needs documented independent follow-up'; end if;
 insert into public.finance_period_close_requests(month_start,reason,suspense_explanation,snapshot,snapshot_sha256,requested_by)
 values(p_month,btrim(p_reason),coalesce(btrim(p_suspense_explanation),''),r,encode(extensions.digest(r::text,'sha256'),'hex'),auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'finance_period_close_requested','finance_period_close_request',v_id,jsonb_build_object('month',p_month,'sha256',encode(extensions.digest(r::text,'sha256'),'hex')));
 return v_id;
end $$;
create function public.finance_review_period_close(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare c public.finance_period_close_requests%rowtype;r jsonb;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin close reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into c from public.finance_period_close_requests where id=p_id for update;
 if not found or c.status<>'pending' then raise exception 'Close request not pending'; end if;
 if c.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Close review reason required'; end if;
 perform private.finance_require_open(c.month_start);
 if p_approve then
 r=public.finance_integrated_report(c.month_start);
 if jsonb_array_length(r->'blockers')>0 or encode(extensions.digest(r::text,'sha256'),'hex')<>c.snapshot_sha256 then raise exception 'Period sources changed; reject request and qualify a new snapshot'; end if;
 end if;
 update public.finance_period_close_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid() where id=c.id;
 if p_approve then
 insert into public.finance_periods(month_start,state,locked_by,locked_at,lock_notes) values(c.month_start,'locked',auth.uid(),clock_timestamp(),p_note)
 on conflict(month_start) do update set state='locked',locked_by=excluded.locked_by,locked_at=excluded.locked_at,lock_notes=excluded.lock_notes;
 end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'finance_period_close_'||case when p_approve then 'approved' else 'rejected' end,'finance_period_close_request',c.id,jsonb_build_object('month',c.month_start,'sha256',c.snapshot_sha256,'note',p_note));
 return case when p_approve then 'locked' else 'rejected' end;
end $$;
create function public.finance_period_close_index() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c) order by month_start desc) from public.finance_period_close_requests c),'[]'::jsonb);
end $$;
revoke all on function public.finance_request_period_close(date,text,text),public.finance_review_period_close(uuid,boolean,text),public.finance_period_close_index() from public,anon,authenticated;
grant execute on function public.finance_request_period_close(date,text,text),public.finance_review_period_close(uuid,boolean,text),public.finance_period_close_index() to authenticated;

create function public.finance_customer_workbench() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 return jsonb_build_object('sources',coalesce((select jsonb_agg(x.source order by x.source->>'label') from (
 select jsonb_build_object('kind','order','id',o.id,'label',o.order_code,'delivery_amount',o.delivery_fee,
 'lines',(select jsonb_agg(jsonb_build_object('line_id',i.id,'product_id',i.product_id,'name',p.name,'quantity',i.quantity,'unit_price',i.unit_price) order by i.id) from public.order_items i join public.products p on p.id=i.product_id where i.order_id=o.id)) source
 from public.orders o where o.status='completed' and o.payment_status<>'waived_test_order' and not exists(select 1 from public.finance_customer_events e where e.kind='sale' and e.source_kind='order' and e.source_id=o.id and e.status<>'rejected')
 union all select jsonb_build_object('kind','group_commitment','id',g.id,'label',d.title||' · '||left(g.id::text,8),'delivery_amount',0,
 'lines',jsonb_build_array(jsonb_build_object('line_id',g.id,'product_id',d.product_id,'name',p.name,'quantity',g.quantity,'unit_price',g.fulfilled_unit_price)))
 from public.group_deal_commitments g join public.group_deals d on d.id=g.group_deal_id join public.products p on p.id=d.product_id where g.status='fulfilled' and g.fulfilled_at is not null and g.fulfilled_unit_price is not null and not exists(select 1 from public.finance_customer_events e where e.kind='sale' and e.source_kind='group_commitment' and e.source_id=g.id and e.status<>'rejected')) x),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('receivable',case when e.kind='sale' then private.finance_customer_balance(e.id,'1100') else 0 end,
 'refund_payable',case when e.kind='sale' then private.finance_customer_balance(e.id,'2300') else 0 end,
 'label',case when e.source_kind='order' then (select order_code from public.orders where id=e.source_id) when e.source_kind='group_commitment' then 'Group Deal · '||left(e.source_id::text,8) else 'Credit · '||left(e.source_id::text,8) end) order by e.created_at desc) from public.finance_customer_events e),'[]'::jsonb),
 'cod_allocations',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.finance_customer_cod_allocations c),'[]'::jsonb),
 'cod_sources',coalesce((select jsonb_agg(jsonb_build_object('day_id',r.day_id,'date',d.business_date,'community',c.name,'unallocated_products',r.product_cash-coalesce(a.products,0),'unallocated_delivery',r.delivery_cash-coalesce(a.delivery,0)))
 from public.treasury_community_cash_receipts r join public.community_ops_days d on d.id=r.day_id join public.communities c on c.id=d.community_id
 left join lateral(select sum(product_amount) products,sum(delivery_amount) delivery from public.finance_customer_cod_allocations where day_id=r.day_id and status='posted') a on true),'[]'::jsonb),
 'liquid_accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.treasury_accounts where active and account_kind<>'credit_card'),'[]'::jsonb),
 'lots',public.finance_inventory_source()->'lots');
end $$;
revoke all on function public.finance_customer_workbench() from public,anon,authenticated;
grant execute on function public.finance_customer_workbench() to authenticated;
