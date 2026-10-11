-- Fulfilment snapshots are operational metadata; they do not post money and do
-- not block Production fulfilment when finance remains locked.
alter table public.group_deal_commitments add column fulfilled_at timestamptz;
alter table public.group_deal_commitments add column fulfilled_unit_price numeric(16,2);
create function private.finance_group_completion_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.fulfilled_at is not null then
 new.fulfilled_at=old.fulfilled_at;new.fulfilled_unit_price=old.fulfilled_unit_price;
 elsif new.status='fulfilled' and (tg_op='INSERT' or old.status<>'fulfilled') then
 new.fulfilled_at=clock_timestamp();
 select locked_unit_price into new.fulfilled_unit_price from public.group_deals where id=new.group_deal_id;
 else new.fulfilled_at=null;new.fulfilled_unit_price=null;
 end if;
 return new;
end $$;
revoke all on function private.finance_group_completion_snapshot() from public,anon,authenticated,service_role;
create trigger finance_group_completion_snapshot before insert or update on public.group_deal_commitments
 for each row execute function private.finance_group_completion_snapshot();

insert into public.finance_accounts(code,title,kind) values('2300','Customer refund payable','liability') on conflict do nothing;
create table public.finance_customer_events (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('sale','credit')),
 source_kind text not null check(source_kind in ('order','group_commitment','sale')),
 source_id uuid not null,
 community_id uuid not null references public.communities(id) on delete restrict,
 source_snapshot jsonb not null,
 allocations jsonb not null check(jsonb_typeof(allocations)='array'),
 product_amount numeric(16,2) not null check(product_amount>0),
 delivery_amount numeric(16,2) not null default 0 check(delivery_amount>=0),
 cogs_amount numeric(16,2) not null check(cogs_amount>=0),
 restock boolean not null default false,
 business_date date not null,
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 evidence_path text not null unique,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 requested_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','posted','rejected')),
 journal_id uuid unique references public.finance_journals(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(reviewed_by is null or reviewed_by<>requested_by),
 check((kind='credit')=(source_kind='sale'))
);
create unique index finance_customer_sale_once on public.finance_customer_events(source_kind,source_id) where kind='sale' and status<>'rejected';
create unique index finance_customer_source_evidence on public.finance_customer_events(evidence_sha256) where status<>'rejected';
create index finance_customer_event_date on public.finance_customer_events(business_date,status);
alter table public.finance_customer_events enable row level security;
revoke all on public.finance_customer_events from public,anon,authenticated,service_role;
create trigger finance_database_write_lock before insert or update or delete on public.finance_customer_events
 for each row execute function private.finance_write_lock();
create trigger finance_customer_source_immutable before update or delete on public.finance_customer_events
 for each row execute function private.finance_supplier_credit_immutable_source();

create function private.finance_fulfilled_source(p_kind text,p_source uuid) returns jsonb
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
revoke all on function private.finance_fulfilled_source(text,uuid) from public,anon,authenticated,service_role;

create function public.finance_request_customer_sale(p_source_kind text,p_source uuid,p_rows jsonb,p_reason text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s jsonb;v_rows jsonb:='[]';x jsonb;line jsonb;l public.finance_inventory_lots%rowtype;
 v_quantity integer;v_stock integer;v_pending integer;v_revenue numeric:=0;v_cogs numeric:=0;v_id uuid;v_idx integer:=0;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 perform pg_advisory_xact_lock(hashtextextended('finance:sale:'||p_source_kind||':'||p_source::text,0));
 s=private.finance_fulfilled_source(p_source_kind,p_source);
 perform private.finance_require_open((s->>'business_date')::date);
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 50 then raise exception 'Inventory allocations required'; end if;
 if p_path is null or p_path not like auth.uid()::text||'/%' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or
 not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path) then raise exception 'Original fulfilment proof required'; end if;
 perform bill_id from public.finance_inventory_lots where bill_id in(select (v->>'bill_id')::uuid from jsonb_array_elements(p_rows) v) order by bill_id for update;
 for x in select value from jsonb_array_elements(p_rows) loop
 v_idx=v_idx+1;v_quantity=(x->>'quantity')::integer;
 select value into line from jsonb_array_elements(s->'lines') where value->>'line_id'=x->>'line_id';
 if line is null or v_quantity is null or v_quantity<=0 then raise exception 'Invalid source line or quantity'; end if;
 select * into l from public.finance_inventory_lots where bill_id=(x->>'bill_id')::uuid;
 if not found or l.product_id<>(line->>'product_id')::uuid then raise exception 'Inventory lot and sold product mismatch'; end if;
 select coalesce(sum((r->>'quantity')::integer),0) into v_pending from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) r where e.kind='sale' and e.status='pending' and r->>'bill_id'=l.bill_id::text;
 v_stock=l.received_quantity+coalesce((select sum(quantity) from public.finance_inventory_movements where bill_id=l.bill_id),0)-v_pending-
 coalesce((select sum(quantity) from public.finance_supplier_credit_notes where bill_id=l.bill_id and status='pending'),0);
 if (select sum((r->>'quantity')::integer) from jsonb_array_elements(p_rows) r where r->>'bill_id'=l.bill_id::text)>v_stock then raise exception 'Sale exceeds unreserved inventory'; end if;
 v_revenue=v_revenue+v_quantity*(line->>'unit_price')::numeric;v_cogs=v_cogs+v_quantity*l.unit_cost;
 v_rows=v_rows||jsonb_build_array(jsonb_build_object('line_index',v_idx,'line_id',line->>'line_id','bill_id',l.bill_id,'product_id',l.product_id,
 'quantity',v_quantity,'unit_price',(line->>'unit_price')::numeric,'unit_cost',l.unit_cost,'model',line->>'model'));
 end loop;
 for line in select value from jsonb_array_elements(s->'lines') loop
 if (select coalesce(sum((r->>'quantity')::integer),0) from jsonb_array_elements(v_rows) r where r->>'line_id'=line->>'line_id')<>(line->>'quantity')::integer then raise exception 'Every completed source quantity must be allocated exactly'; end if;
 end loop;
 insert into public.finance_customer_events(kind,source_kind,source_id,community_id,source_snapshot,allocations,product_amount,delivery_amount,cogs_amount,business_date,reason,evidence_path,evidence_sha256,requested_by)
 values('sale',p_source_kind,p_source,(s->>'community_id')::uuid,s,v_rows,v_revenue,(s->>'delivery_amount')::numeric,v_cogs,(s->>'business_date')::date,btrim(p_reason),p_path,p_sha256,auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_sale_requested','finance_customer_event',v_id,jsonb_build_object('source_kind',p_source_kind,'source_id',p_source,'revenue',v_revenue,'cogs',v_cogs));
 return v_id;
end $$;

create table public.finance_customer_delivery_expenses (
 event_id uuid primary key references public.finance_customer_events(id) on delete restrict,
 expense_id uuid not null unique references public.finance_expenses(id) on delete restrict
);
alter table public.finance_customer_delivery_expenses enable row level security;
revoke all on public.finance_customer_delivery_expenses from public,anon,authenticated,service_role;
create trigger finance_database_write_lock before insert or update or delete on public.finance_customer_delivery_expenses for each row execute function private.finance_write_lock();
create trigger finance_customer_delivery_expenses_immutable before update or delete on public.finance_customer_delivery_expenses for each row execute function private.finance_reject_journal_mutation();

create function public.finance_review_customer_sale(p_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.finance_customer_events%rowtype;l public.finance_inventory_lots%rowtype;x record;
 v_lines jsonb;v_journal uuid;v_stock integer;v_delivery_expense uuid;v_attribution uuid;v_delivery_cost numeric;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Independent Super Admin reviewer required'; end if;
 perform private.finance_assert_write_allowed();
 select * into e from public.finance_customer_events where id=p_id for update;
 if not found or e.kind<>'sale' or e.status<>'pending' then raise exception 'Customer sale not pending'; end if;
 if e.requested_by=auth.uid() then raise exception 'Independent maker-checker required'; end if;
 if p_approve is null or length(btrim(coalesce(p_note,'')))<10 then raise exception 'Sale review reason required'; end if;
 if p_approve then
 perform private.finance_require_open(e.business_date);
 if private.finance_fulfilled_source(e.source_kind,e.source_id)<>e.source_snapshot then raise exception 'Completed customer source changed since request'; end if;
 for x in select (r->>'bill_id')::uuid bill_id,sum((r->>'quantity')::integer)::integer qty,sum((r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost from jsonb_array_elements(e.allocations) r group by r->>'bill_id' order by r->>'bill_id' loop
 select * into l from public.finance_inventory_lots where bill_id=x.bill_id for update;
 v_stock=l.received_quantity+coalesce((select sum(quantity) from public.finance_inventory_movements where bill_id=l.bill_id),0);
 if x.qty>v_stock then raise exception 'Allocated stock no longer available'; end if;
 end loop;
 v_lines=jsonb_build_array(jsonb_build_object('account','1100','debit',e.product_amount+e.delivery_amount),
 jsonb_build_object('account','4000','credit',e.product_amount),jsonb_build_object('account','5000','debit',e.cogs_amount),jsonb_build_object('account','1200','credit',e.cogs_amount));
 if e.delivery_amount>0 then v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','4010','credit',e.delivery_amount)); end if;
 v_journal=private.treasury_post('customer:sale:'||e.id,e.id,e.business_date,e.reason,v_lines,auth.uid());
 v_delivery_cost=coalesce((e.source_snapshot->>'delivery_actual_cost')::numeric,0);
 if v_delivery_cost>0 then
  insert into public.finance_expenses(category,description,vendor_name,document_reference,evidence_path,evidence_sha256,amount,incurred_on,community_id,created_by)
  values('logistics','Actual delivery for completed sale '||e.id,'Delivery service','DELIVERY-'||e.id,e.evidence_path,e.evidence_sha256,v_delivery_cost,e.business_date,e.community_id,e.requested_by) returning id into v_delivery_expense;
  -- Uses the existing independent reviewer and large/dual expense approval rules.
  perform public.finance_review_expense(v_delivery_expense,true,p_note);
  insert into public.finance_customer_delivery_expenses(event_id,expense_id) values(e.id,v_delivery_expense);
  insert into public.finance_expense_attributions(expense_id,allocations,reason,requested_by)
  values(v_delivery_expense,jsonb_build_array(jsonb_build_object('amount',v_delivery_cost,'cost_center','logistics','community_id',e.community_id,'pool_id',e.source_snapshot->>'pool_id')),
   'Direct actual delivery attribution to original completed sale',e.requested_by) returning id into v_attribution;
  perform public.finance_review_expense_attribution(v_attribution,true,p_note);
 end if;
 for x in select (r->>'bill_id')::uuid bill_id,sum((r->>'quantity')::integer)::integer qty,sum((r->>'quantity')::numeric*(r->>'unit_cost')::numeric) cost from jsonb_array_elements(e.allocations) r group by r->>'bill_id' loop
 insert into public.finance_inventory_movements(bill_id,event_key,quantity,value,journal_id) values(x.bill_id,'customer:sale:'||e.id||':'||x.bill_id,-x.qty,-x.cost,v_journal);
 end loop;
 end if;
 update public.finance_customer_events set status=case when p_approve then 'posted' else 'rejected' end,reviewed_by=auth.uid(),journal_id=v_journal where id=e.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'customer_sale_'||case when p_approve then 'posted' else 'rejected' end,'finance_customer_event',e.id,jsonb_build_object('note',p_note,'journal_id',v_journal,'revenue',e.product_amount,'delivery',e.delivery_amount,'cogs',e.cogs_amount));
 return case when p_approve then 'posted' else 'rejected' end;
end $$;
revoke all on function public.finance_request_customer_sale(text,uuid,jsonb,text,text,text),public.finance_review_customer_sale(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finance_request_customer_sale(text,uuid,jsonb,text,text,text),public.finance_review_customer_sale(uuid,boolean,text) to authenticated;

create or replace function public.finance_request_supplier_return(p_bill uuid,p_quantity integer,p_reference text,p_date date,p_reason text,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.procurement_supplier_bills%rowtype;l public.finance_inventory_lots%rowtype;v_available integer;v_id uuid;
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 perform private.finance_assert_write_allowed();
 select * into b from public.procurement_supplier_bills where id=p_bill for update;
 if not found or b.status not in ('posted','settled') then raise exception 'Posted supplier bill required'; end if;
 select * into l from public.finance_inventory_lots where bill_id=b.id for update;
 if not found then raise exception 'Reconciled inventory lot required'; end if;
 v_available=l.received_quantity+coalesce((select sum(quantity) from public.finance_inventory_movements where bill_id=b.id),0)
 -coalesce((select sum(quantity) from public.finance_supplier_credit_notes where bill_id=b.id and status='pending'),0)
 -coalesce((select sum((a->>'quantity')::integer) from public.finance_customer_events e cross join lateral jsonb_array_elements(e.allocations) a where e.kind='sale' and e.status='pending' and a->>'bill_id'=b.id::text),0);
 if p_quantity is null or p_quantity<=0 or p_quantity>v_available then raise exception 'Return exceeds unreserved inventory'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Dhaka')::date or p_date<b.invoice_date then raise exception 'Invalid return date'; end if;
 perform private.finance_require_open(p_date);
 if p_path is null or p_path not like auth.uid()::text||'/%' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
 or not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_path)
 then raise exception 'Uploaded original supplier credit and return evidence required'; end if;
 if exists(select 1 from public.treasury_transactions where supplier_bill_id=b.id and status='pending') then
 raise exception 'Resolve pending supplier payment before return'; end if;
 insert into public.finance_supplier_credit_notes(bill_id,quantity,reference,business_date,reason,evidence_path,evidence_sha256,requested_by)
 values(b.id,p_quantity,btrim(p_reference),p_date,btrim(p_reason),p_path,p_sha256,auth.uid()) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'supplier_return_requested','finance_supplier_credit_note',v_id,jsonb_build_object('bill_id',b.id,'quantity',p_quantity,'reference',p_reference));
 return v_id;
end $$;

