-- Financial read-only proof-of-concept source RPCs. Preview only. No journal posting
-- and no certification of net profit. Super Admin only; no customer PII.
-- All dates are Bangladesh business dates; recognized sales require completion.
create or replace function public.finance_profit_source(
 p_month date,p_community_id uuid default null,p_product_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
 v_start date:=date_trunc('month',p_month)::date;
 v_end date:=(date_trunc('month',p_month)+interval '1 month')::date;
 v_rows jsonb;
 v_exp jsonb;
 v_fee numeric;
 v_delivery_cost numeric;
 v_unpriced_delivery bigint;
 v_finance_cost numeric;
 v_qualifying bigint;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 if p_month is null or p_month<>v_start then raise exception 'First day of month required'; end if;
 if p_month>(now() at time zone 'Asia/Dhaka')::date then raise exception 'Future accounting month not supported'; end if;
 -- Only recognize fulfilled orders in their immutable completed_at month;
 -- quote cost and estimated margin do not prove inventory COGS.
 with sold as (
  select oi.pool_item_id, oi.product_id, o.pool_id,p.community_id,
   o.id order_id,oi.quantity,oi.unit_price,oi.benchmark_price_snapshot,
   o.payment_status,
   not exists(select 1 from public.payment_records pr where pr.order_id=o.id and pr.status='refunded') refund_clear
  from public.orders o
  join public.pools p on p.id=o.pool_id
  join public.order_items oi on oi.order_id=o.id
  where o.status='completed' and o.completed_at>=v_start::timestamp
    and o.completed_at<v_end::timestamp
    and (p_community_id is null or p.community_id=p_community_id)
    and (p_product_id is null or oi.product_id=p_product_id)
 ),
 invoices as (
  select po.pool_item_id, sum(b.quantity)::integer verified_qty,
   case when sum(b.quantity)>0 then round(sum(b.amount)/sum(b.quantity),2) end invoice_unit
  from public.procurement_purchase_orders po
  join public.procurement_supplier_bills b on b.po_id=po.id
  where po.status in ('approved','closed') and b.status in ('posted','settled')
    and b.journal_id is not null
  group by po.pool_item_id
 ),
 lines as (
  select oi.pool_item_id,oi.product_id,oi.pool_id,oi.community_id,
   pr.name as product_name,p.title as pool_name,c.name as community_name,
   count(distinct oi.order_id)::integer order_count,sum(oi.quantity)::integer quantity,
   round(sum(oi.unit_price*oi.quantity),2) as sale_revenue,
   round(sum(greatest(0,oi.benchmark_price_snapshot-oi.unit_price)*oi.quantity),2) as customer_saving,
   min(oi.unit_price) as customer_unit,
   min(oi.benchmark_price_snapshot) as benchmark_unit,
   coalesce(inv.verified_qty,0) invoice_qty,inv.invoice_unit,
   bool_and(oi.payment_status in ('paid_manually','cash_on_pickup')) payment_recorded,
   bool_and(oi.refund_clear) refund_clear,
   count(distinct oi.unit_price) uniform_sale_price,
   count(distinct oi.benchmark_price_snapshot) uniform_benchmark_price
  from sold oi
  join public.products pr on pr.id=oi.product_id
  join public.pools p on p.id=oi.pool_id
  join public.communities c on c.id=oi.community_id
  left join invoices inv on inv.pool_item_id=oi.pool_item_id
  group by oi.pool_item_id,oi.product_id,oi.pool_id,oi.community_id,
   pr.name,p.title,c.name,inv.verified_qty,inv.invoice_unit
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',l.pool_item_id,'poolId',l.pool_id,'poolName',l.pool_name,
  'communityId',l.community_id,'communityName',l.community_name,
  'productId',l.product_id,'productName',l.product_name,
  'orderCount',l.order_count,'quantity',l.quantity,
  'benchmarkUnit',l.benchmark_unit,'customerUnit',l.customer_unit,
  'acceptedInvoiceQuantity',l.invoice_qty,'verifiedLandedUnit',l.invoice_unit,
  'recordedSaleRevenue',l.sale_revenue,'recordedCustomerSaving',l.customer_saving,
  'invoiceRef','independently_approved_supplier_invoice_aggregate',
  'isCompleted',true,'isPaymentReconciled',false,'isRefundClear',l.refund_clear,
  'sourceNote',case when l.uniform_sale_price>1 or l.uniform_benchmark_price>1
    then 'Multiple customer/benchmark prices: use order-level amounts, not a single unit quote'
    else 'Invoice unit cost is an approved invoice average, not an inventory-lot allocation' end
 ) order by l.pool_name,l.product_name),'[]'::jsonb)
 into v_rows from lines l;
 -- Expenses are recognized once on accrual, not when the bank clears them.
 -- Shared company costs cannot be allocated fairly to one pool/product here.
 select coalesce(jsonb_agg(jsonb_build_object('category',category,
  'amount',total,'source','approved_finance_expense_accrual')),'[]'::jsonb)
 into v_exp
 from (select category,sum(amount) total from public.finance_expenses
       where incurred_on>=v_start and incurred_on<v_end
       and status in ('posted','settlement_requested','settled')
       and p_community_id is null and p_product_id is null
       group by category) ex;
 -- Fees/costs belong to the ORDER, not one order item. Never duplicate delivery
 -- charges when an order contains several SKUs. A product scope is unallocated.
 select count(*),
   coalesce(sum(o.delivery_fee),0),coalesce(sum(o.delivery_actual_cost),0),
   count(*) filter(where o.fulfillment_method='home_delivery' and o.delivery_actual_cost is null)
 into v_qualifying,v_fee,v_delivery_cost,v_unpriced_delivery
 from public.orders o join public.pools p on p.id=o.pool_id
 where o.status='completed' and o.completed_at>=v_start::timestamp
  and o.completed_at<v_end::timestamp
  and (p_community_id is null or p.community_id=p_community_id)
  and (p_product_id is null or exists(
    select 1 from public.order_items oi where oi.order_id=o.id and oi.product_id=p_product_id));
 if p_product_id is not null then v_delivery_cost:=null; end if;
 if v_unpriced_delivery>0 then v_delivery_cost:=null; end if;
 select coalesce(sum(l.debit-l.credit),0) into v_finance_cost
 from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id
 where j.posting_date>=v_start and j.posting_date<v_end
   and l.account_code in ('6600','6605')
   and p_community_id is null and p_product_id is null;
 return jsonb_build_object('month',to_char(v_start,'YYYY-MM'),'lines',v_rows,
  'operatingExpenses',v_exp,'deliveryRevenue',coalesce(v_fee,0),
  'deliveryActualCost',v_delivery_cost,
  'financeCosts',coalesce(v_finance_cost,0),'taxRate',null,
  'expensesFullyAllocated',false,'journalSalesPosted',false,
  'bankCollectionsMatched',false,'inventoryLedgerMatched',false,
  'taxPolicyVerified',false,'isSynthetic',false,
  'paymentCaveat','Manual status does not prove bank settlement. Customer COD remains suspense until separately reconciled.',
  'scopeCaveat','Scoped overhead, delivery and financing are not allocated without a documented policy.',
  'eligibleOrders',v_qualifying,'missingDeliveryActualCosts',v_unpriced_delivery);
end $fn$;
revoke all on function public.finance_profit_source(date,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.finance_profit_source(date,uuid,uuid) to authenticated;

-- Actual ledger physical cash bridge, unlike profit: every entry is a cash
-- debit or credit. Bank internal transfers net to zero.
create or replace function public.treasury_cash_bridge_source(p_month date)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
 v_start date:=date_trunc('month',p_month)::date;
 v_end date:=(date_trunc('month',p_month)+interval '1 month')::date;
 v_open numeric;v_close numeric;v_in numeric;v_out numeric;v_transfer numeric;
 v_cod numeric;v_delivery numeric;v_sup numeric;v_op numeric;v_loan numeric;
 v_finance numeric;v_owner numeric;v_other numeric;v_unmatched integer;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 if p_month is null or p_month<>v_start then raise exception 'First day of month required'; end if;
 -- Physical accounts only. Credit card entries are NON-CASH obligations.
 select
  coalesce(sum(case when j.posting_date<v_start then l.debit-l.credit else 0 end),0),
  coalesce(sum(case when j.posting_date<v_end then l.debit-l.credit else 0 end),0),
  coalesce(sum(case when j.posting_date>=v_start and j.posting_date<v_end then l.debit else 0 end),0),
  coalesce(sum(case when j.posting_date>=v_start and j.posting_date<v_end then l.credit else 0 end),0)
 into v_open,v_close,v_in,v_out
 from public.finance_journal_lines l
 join public.treasury_accounts a on a.ledger_code=l.account_code and a.account_kind<>'credit_card'
 join public.finance_journals j on j.id=l.journal_id;
 select coalesce(sum(amount),0) into v_transfer from public.treasury_transactions
  where status='posted' and kind='transfer' and business_date>=v_start and business_date<v_end
   and source_account_id in (select id from public.treasury_accounts where account_kind<>'credit_card')
   and target_account_id in (select id from public.treasury_accounts where account_kind<>'credit_card');
 select coalesce(sum(product_cash),0),coalesce(sum(delivery_cash),0)
 into v_cod,v_delivery
 from public.treasury_community_cash_receipts r
 join public.finance_journals j on j.id=r.journal_id
 where j.posting_date>=v_start and j.posting_date<v_end;
 select coalesce(sum(amount) filter(where kind='supplier_payment'),0),
  coalesce(sum(amount) filter(where kind='expense_cash'),0),
  coalesce(sum(amount) filter(where kind='loan_repay'),0),
  coalesce(sum(interest_amount+fee_amount) filter(where kind='loan_repay'),0),
  coalesce(sum(amount) filter(where kind in ('owner_capital','loan_draw')),0)
 into v_sup,v_op,v_loan,v_finance,v_owner
 from public.treasury_transactions
 where status='posted' and business_date>=v_start and business_date<v_end;
 select count(*) into v_unmatched
 from public.treasury_statement_lines s
 where s.statement_date>=v_start and s.statement_date<v_end and s.matched_transaction_id is null;
 -- Other external receipts/outflows are NOT forced into profit or sales.
 v_other:=greatest(0,v_in-v_transfer-v_cod-v_delivery-v_owner);
 return jsonb_build_object(
   'month',to_char(v_start,'YYYY-MM'),'openingCash',v_open,'closingCash',v_close,
   'grossBankDebits',v_in,'grossBankCredits',v_out,
   'internalTransfers',v_transfer,'customerCod',v_cod,'deliveryCollections',v_delivery,
   'supplierPayments',v_sup,'operatingCashPayments',v_op,
   'loanPrincipalPaid',v_loan,'financeCashPaid',v_finance,
   'ownerFinancingInflows',v_owner,'otherExternalReceipts',v_other,
   'unclassifiedOutflow',greatest(0,v_out-v_transfer-v_sup-v_op-v_loan-v_finance),
   'unmatchedStatements',v_unmatched,
   'cashAccountsReconciled',false,
   'note','Book balances, not bank-certified. Non-linked receipts and payments remain unclassified, cash is not net profit.');
end $fn$;
revoke all on function public.treasury_cash_bridge_source(date) from public,anon,authenticated,service_role;
grant execute on function public.treasury_cash_bridge_source(date) to authenticated;
