-- Finance/Procurement/Community Treasury bridge | PREVIEW only.
-- Financial controls: PO before liability, verified goods before vendor invoice;
-- physical cash handover before cash book; one immutable event per financial action.

insert into public.finance_accounts(code,title,kind) values
 ('2210','Unapplied customer product collections','liability'),
 ('2211','Unapplied home-delivery fee collections','liability')
on conflict(code) do nothing;
alter table public.finance_journals drop constraint if exists finance_journals_source_type_check;
alter table public.finance_journals add constraint finance_journals_source_type_check
 check(source_type in ('expense_accrual','expense_settlement','treasury_opening','treasury_transaction','procurement_invoice'));

create table public.procurement_purchase_orders (
 id uuid primary key default gen_random_uuid(),
 po_code text not null unique default ('PO-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 pool_item_id uuid not null references public.pool_items(id) on delete restrict,
 supplier_quote_id uuid not null unique references public.supplier_quotes(id) on delete restrict,
 supplier_id uuid not null references public.suppliers(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 quantity integer not null check(quantity>0),
 unit_landed_cost numeric(16,2) not null check(unit_landed_cost>0),
 total_value numeric(16,2) generated always as (quantity*unit_landed_cost) stored,
 delivery_community_id uuid not null references public.communities(id) on delete restrict,
 status text not null default 'submitted' check(status in ('submitted','rejected','approved','closed')),
 note text,
 created_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 approval_note text,
 created_at timestamptz not null default now()
);
create index procurement_po_supplier_status on public.procurement_purchase_orders(supplier_id,status);
create table public.procurement_dispatch_links (
 id uuid primary key default gen_random_uuid(),
 po_id uuid not null references public.procurement_purchase_orders(id) on delete restrict,
 dispatch_id uuid not null references public.supply_dispatches(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 linked_by uuid not null references auth.users(id) on delete restrict,
 linked_at timestamptz not null default now(),
 unique(dispatch_id,product_id)
);
create index procurement_dispatch_po_idx on public.procurement_dispatch_links(po_id);

create table public.procurement_supplier_bills (
 id uuid primary key default gen_random_uuid(),
 po_id uuid not null references public.procurement_purchase_orders(id) on delete restrict,
 supplier_id uuid not null references public.suppliers(id) on delete restrict,
 invoice_reference text not null check(length(btrim(invoice_reference))>=4),
 invoice_date date not null,
 quantity integer not null check(quantity>0),
 unit_price numeric(16,2) not null check(unit_price>0),
 amount numeric(16,2) generated always as (quantity*unit_price) stored,
 evidence_path text not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 status text not null default 'submitted' check(status in ('submitted','rejected','posted','settled')),
 submitted_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 review_note text,
 journal_id uuid unique references public.finance_journals(id) on delete restrict,
 created_at timestamptz not null default now()
);
create unique index procurement_vendor_invoice_active on public.procurement_supplier_bills(supplier_id,lower(btrim(invoice_reference))) where status<>'rejected';
create unique index procurement_invoice_evidence_unique on public.procurement_supplier_bills(evidence_sha256) where status<>'rejected';

alter table public.procurement_purchase_orders enable row level security;
alter table public.procurement_dispatch_links enable row level security;
alter table public.procurement_supplier_bills enable row level security;
revoke all on public.procurement_purchase_orders,public.procurement_dispatch_links,public.procurement_supplier_bills from public,anon,authenticated,service_role;

create or replace function public.procurement_submit_po(p_quote_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid();q public.supplier_quotes%rowtype;i public.pool_items%rowtype;
  pool public.pools%rowtype;v_id uuid;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff role required'; end if;
 select * into q from public.supplier_quotes where id=p_quote_id for update;
 if not found or q.quote_phase<>'final' or not q.selected then raise exception 'Approved selected final supplier quote required'; end if;
 if q.valid_until is not null and q.valid_until<(now() at time zone 'Asia/Dhaka')::date
 then raise exception 'Expired supplier quotation cannot create a PO'; end if;
 select * into i from public.pool_items where id=q.pool_item_id for update;
 if i.selected_supplier_quote_id is distinct from q.id then raise exception 'Pool item selected quote does not match'; end if;
 if i.frozen_committed_quantity is null or i.frozen_committed_quantity<>q.quantity then
 raise exception 'PO quantity must equal frozen, selected quote quantity'; end if;
 select * into pool from public.pools where id=i.pool_id;
 if pool.status not in ('confirmation','ordered','ready_for_pickup','completed') then
 raise exception 'Pool demand and supplier pricing must be finalized'; end if;
 if not exists(select 1 from public.suppliers where id=q.supplier_id and active and reliability_status<>'blocked') then
 raise exception 'Active non-blocked supplier required'; end if;
 if exists(select 1 from public.procurement_purchase_orders where supplier_quote_id=q.id) then
 raise exception 'This selected supplier quote already has a purchase order'; end if;
 insert into public.procurement_purchase_orders(pool_item_id,supplier_quote_id,supplier_id,product_id,quantity,
 unit_landed_cost,delivery_community_id,note,created_by)
 values(i.id,q.id,q.supplier_id,i.product_id,q.quantity,q.landed_unit_price,pool.community_id,
 nullif(btrim(coalesce(p_note,'')),''),v_actor) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'procurement_po_submitted','procurement_purchase_order',v_id,jsonb_build_object(
 'quote_id',q.id,'quantity',q.quantity,'unit_cost',q.landed_unit_price));
 return v_id;
end $fn$;
revoke all on function public.procurement_submit_po(uuid,text) from public,anon,authenticated;
grant execute on function public.procurement_submit_po(uuid,text) to authenticated;

create or replace function public.procurement_review_po(p_po_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid();p public.procurement_purchase_orders%rowtype;q public.supplier_quotes%rowtype;
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin reviewer required'; end if;
 select * into p from public.procurement_purchase_orders where id=p_po_id for update;
 if not found or p.status<>'submitted' then raise exception 'PO is not awaiting approval'; end if;
 if p.created_by=v_actor then raise exception 'Maker cannot approve own procurement PO'; end if;
 if not coalesce(p_approve,false) and length(btrim(coalesce(p_note,'')))<5
 then raise exception 'PO rejection reason is required'; end if;
 if coalesce(p_approve,false) then
   select * into q from public.supplier_quotes where id=p.supplier_quote_id;
   if not q.selected or q.supplier_id<>p.supplier_id or q.quantity<>p.quantity
      or q.landed_unit_price<>p.unit_landed_cost or
      (q.valid_until is not null and q.valid_until<(now() at time zone 'Asia/Dhaka')::date)
   then raise exception 'PO quote or supplier has changed; approval blocked'; end if;
   if not exists(select 1 from public.suppliers where id=p.supplier_id and active and reliability_status<>'blocked')
   then raise exception 'Supplier no longer eligible'; end if;
 end if;
 update public.procurement_purchase_orders set status=case when p_approve then 'approved' else 'rejected' end,
   approved_by=v_actor,reviewed_at=now(),approval_note=nullif(btrim(coalesce(p_note,'')),'')
 where id=p_po_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'procurement_po_reviewed','procurement_purchase_order',p.id,
 jsonb_build_object('approved',p_approve,'note',p_note));
 return case when p_approve then 'approved' else 'rejected' end;
end $fn$;
revoke all on function public.procurement_review_po(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.procurement_review_po(uuid,boolean,text) to authenticated;

create or replace function public.procurement_link_dispatch(p_po_id uuid,p_dispatch_id uuid)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid();p public.procurement_purchase_orders%rowtype;d public.supply_dispatches%rowtype;v_id uuid;
 v_total integer;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff role required'; end if;
 select * into p from public.procurement_purchase_orders where id=p_po_id for update;
 if not found or p.status not in ('approved','closed') then raise exception 'Approved purchase order required'; end if;
 select * into d from public.supply_dispatches where id=p_dispatch_id;
 if not found or d.source_kind<>'supplier' or d.source_supplier_id<>p.supplier_id or
    d.destination_community_id<>p.delivery_community_id or
    d.status not in ('draft','sealed','in_transit','verified','resolved') then
 raise exception 'Dispatch supplier, destination or status does not match PO'; end if;
 if not exists(select 1 from public.supply_dispatch_items
   where dispatch_id=d.id and product_id=p.product_id) then
 raise exception 'Dispatch does not contain the PO product'; end if;
 select coalesce(sum(di.dispatched_quantity),0) into v_total
 from public.procurement_dispatch_links l
 join public.supply_dispatch_items di on di.dispatch_id=l.dispatch_id and di.product_id=l.product_id
 where l.po_id=p.id;
 v_total=v_total+(select dispatched_quantity from public.supply_dispatch_items where dispatch_id=d.id and product_id=p.product_id);
 if v_total>p.quantity then raise exception 'Linked supplier dispatches exceed PO quantity'; end if;
 insert into public.procurement_dispatch_links(po_id,dispatch_id,product_id,linked_by)
 values(p.id,d.id,p.product_id,v_actor) returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'procurement_dispatch_linked','procurement_purchase_order',p.id,
 jsonb_build_object('dispatch_id',d.id,'product_id',p.product_id));
 return v_id;
end $fn$;
revoke all on function public.procurement_link_dispatch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.procurement_link_dispatch(uuid,uuid) to authenticated;

create or replace function private.procurement_accepted_quantity(p_po_id uuid)
returns integer language sql stable security definer set search_path='' as $fn$
 select coalesce(sum(r.net_accepted_quantity),0)::integer
 from public.procurement_dispatch_links l
 join public.supply_dispatches d on d.id=l.dispatch_id
 join public.supply_dispatch_receipts r on r.dispatch_id=l.dispatch_id and r.product_id=l.product_id
 where l.po_id=p_po_id
 and (d.status='verified' or (d.status='resolved' and d.resolution='accept_receiver_count'));
$fn$;
revoke all on function private.procurement_accepted_quantity(uuid) from public,anon,authenticated;

create or replace function public.procurement_submit_bill(
 p_po_id uuid,p_invoice_ref text,p_invoice_date date,p_quantity integer,
 p_unit_price numeric,p_evidence_path text,p_evidence_sha256 text
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid();p public.procurement_purchase_orders%rowtype;v_id uuid;
begin
 if not private.finance_authorized(v_actor) then raise exception 'Finance staff role required'; end if;
 select * into p from public.procurement_purchase_orders where id=p_po_id for update;
 if not found or p.status not in ('approved','closed') then raise exception 'Approved purchase order required'; end if;
 if p_quantity is null or p_quantity<1 or p_unit_price is null or p_unit_price<>p.unit_landed_cost
    or round(p_unit_price,2)<>p_unit_price then
 raise exception 'Supplier invoice quantity and unit cost must match approved PO'; end if;
 if p_invoice_date is null or p_invoice_date>(now() at time zone 'Asia/Dhaka')::date
 then raise exception 'Invoice date must be valid and not future'; end if;
 if p_quantity>private.procurement_accepted_quantity(p.id)-
  (select coalesce(sum(quantity),0) from public.procurement_supplier_bills
   where po_id=p.id and status in ('submitted','posted','settled'))
 then raise exception 'Invoiced quantity exceeds verified accepted and unbilled goods'; end if;
 if p_evidence_sha256 is null or p_evidence_sha256 !~ '^[0-9a-f]{64}$' or
    not (p_evidence_path like v_actor::text||'/%') or
    not exists(select 1 from storage.objects where bucket_id='finance-evidence' and name=p_evidence_path)
 then raise exception 'A real private uploaded supplier invoice PDF/image is required'; end if;
 insert into public.procurement_supplier_bills(
  po_id,supplier_id,invoice_reference,invoice_date,quantity,unit_price,evidence_path,evidence_sha256,submitted_by)
 values(p.id,p.supplier_id,btrim(p_invoice_ref),p_invoice_date,p_quantity,p_unit_price,
  p_evidence_path,p_evidence_sha256,v_actor) returning id into v_id;
 return v_id;
end $fn$;
revoke all on function public.procurement_submit_bill(uuid,text,date,integer,numeric,text,text) from public,anon,authenticated;
grant execute on function public.procurement_submit_bill(uuid,text,date,integer,numeric,text,text) to authenticated;

create or replace function public.procurement_review_bill(p_bill_id uuid,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid();b public.procurement_supplier_bills%rowtype;
 p public.procurement_purchase_orders%rowtype;v_journal uuid;v_remaining integer;
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin reviewer required'; end if;
 select * into b from public.procurement_supplier_bills where id=p_bill_id for update;
 if not found or b.status<>'submitted' then raise exception 'Invoice not awaiting review'; end if;
 if b.submitted_by=v_actor then raise exception 'Maker cannot approve own supplier invoice'; end if;
 if not coalesce(p_approve,false) then
  if length(btrim(coalesce(p_note,'')))<5 then raise exception 'Bill rejection reason required'; end if;
  update public.procurement_supplier_bills set status='rejected',reviewed_by=v_actor,
  reviewed_at=now(),review_note=p_note where id=p_bill_id;
  return 'rejected';
 end if;
 select * into p from public.procurement_purchase_orders where id=b.po_id for update;
 if p.status not in ('approved','closed') or b.supplier_id<>p.supplier_id
   or b.unit_price<>p.unit_landed_cost then raise exception 'Approved PO and invoice no longer match'; end if;
 select private.procurement_accepted_quantity(p.id)-
  coalesce(sum(x.quantity),0) into v_remaining from public.procurement_supplier_bills x
  where x.po_id=p.id and x.id<>b.id and x.status in ('posted','settled','submitted');
 if b.quantity>v_remaining then raise exception 'Supplier bill exceeds actual unbilled received goods'; end if;
 perform private.finance_require_open((now() at time zone 'Asia/Dhaka')::date);
 insert into public.finance_journals(event_key,source_type,source_id,posting_date,memo,posted_by)
 values('procurement:invoice:'||b.id,'procurement_invoice',b.id,(now() at time zone 'Asia/Dhaka')::date,
  'Verified supplier goods receipt and invoice '||b.invoice_reference,v_actor)
 returning id into v_journal;
 insert into public.finance_journal_lines(journal_id,account_code,debit,credit) values
 (v_journal,'1200',b.amount,0),
 (v_journal,'2100',0,b.amount);
 update public.procurement_supplier_bills set status='posted',reviewed_by=v_actor,reviewed_at=now(),
  review_note=nullif(btrim(coalesce(p_note,'')),''),journal_id=v_journal where id=b.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'procurement_invoice_matched','procurement_supplier_bill',b.id,
 jsonb_build_object('po_id',p.id,'verified_units',private.procurement_accepted_quantity(p.id),
   'billed_units',b.quantity,'amount',b.amount));
 return 'posted';
end $fn$;
revoke all on function public.procurement_review_bill(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.procurement_review_bill(uuid,boolean,text) to authenticated;

create table public.treasury_community_cash_receipts (
 day_id uuid primary key references public.community_ops_days(id) on delete restrict,
 cash_account_id uuid not null references public.treasury_accounts(id) on delete restrict,
 product_cash numeric(16,2) not null check(product_cash>=0),
 delivery_cash numeric(16,2) not null check(delivery_cash>=0),
 journal_id uuid not null unique references public.finance_journals(id) on delete restrict,
 posted_by uuid not null references auth.users(id) on delete restrict,
 posted_at timestamptz not null default now()
);
alter table public.treasury_community_cash_receipts enable row level security;
revoke all on public.treasury_community_cash_receipts from public,anon,authenticated,service_role;

create or replace function public.treasury_post_verified_community_cash(
 p_day_id uuid,p_cash_account uuid,p_reference text
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid();d public.community_ops_days%rowtype;
 h public.community_ops_cash_handovers%rowtype;acct public.treasury_accounts%rowtype;
 v_lines jsonb;v_journal uuid;
begin
 if not private.finance_super(v_actor) then raise exception 'Super Admin required'; end if;
 select * into d from public.community_ops_days where id=p_day_id for update;
 if not found or d.status<>'closed' or d.accepted_with_exception then
 raise exception 'Community Ops day must be closed without outstanding exceptions'; end if;
 select * into h from public.community_ops_cash_handovers where day_id=p_day_id for update;
 if not found or h.status<>'accepted' or h.product_cod_received is null or h.delivery_fees_received is null
 then raise exception 'Independently accepted cash handover required'; end if;
 if h.submitted_by=v_actor or h.received_by=v_actor then
 raise exception 'Community cash ledger poster must be independent of cashier and cash receiver'; end if;
 if exists(select 1 from public.treasury_community_cash_receipts where day_id=p_day_id)
 then raise exception 'Community handover already posted in Treasury'; end if;
 select * into acct from public.treasury_accounts where id=p_cash_account for update;
 if not found or not acct.active or acct.account_kind<>'cash' then
 raise exception 'An active physical cash account is required; COD is not yet a bank deposit'; end if;
 if h.product_cod_received+h.delivery_fees_received<=0 then raise exception 'There is no accepted cash to post'; end if;
 if length(btrim(coalesce(p_reference,'')))<4 then raise exception 'Cash custody reference required'; end if;
 v_lines=jsonb_build_array(jsonb_build_object('account',acct.ledger_code,'debit',h.product_cod_received+h.delivery_fees_received));
 if h.product_cod_received>0 then
   v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','2210','credit',h.product_cod_received));
 end if;
 if h.delivery_fees_received>0 then
   v_lines=v_lines||jsonb_build_array(jsonb_build_object('account','2211','credit',h.delivery_fees_received));
 end if;
 v_journal=private.treasury_post('treasury:community_cash:'||p_day_id,p_day_id,
   (now() at time zone 'Asia/Dhaka')::date,
   'Accepted community COD custody: '||btrim(p_reference),v_lines,v_actor);
 insert into public.treasury_community_cash_receipts(day_id,cash_account_id,product_cash,delivery_cash,journal_id,posted_by)
 values(p_day_id,p_cash_account,h.product_cod_received,h.delivery_fees_received,v_journal,v_actor);
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,'treasury_community_cod_recorded','community_ops_day',p_day_id,
 jsonb_build_object('cash_account_id',p_cash_account,'product_cash',h.product_cod_received,
 'delivery_fees',h.delivery_fees_received,'accounting_status','unapplied_pending_order_reconciliation'));
 return v_journal;
end $fn$;
revoke all on function public.treasury_post_verified_community_cash(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.treasury_post_verified_community_cash(uuid,uuid,text) to authenticated;
