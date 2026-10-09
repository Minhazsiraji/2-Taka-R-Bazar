import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20261009111000_community_ops_reconciliation.sql','utf8')
const officerPage=fs.readFileSync('app/community-ops/page.tsx','utf8')
const adminPage=fs.readFileSync('app/admin/community-ops/page.tsx','utf8')
const actions=fs.readFileSync('app/actions/community-ops.ts','utf8')
const appShell=fs.readFileSync('components/app-shell.tsx','utf8')
const adminShell=fs.readFileSync('components/admin-shell.tsx','utf8')

test('community operations access is community-scoped and fail-closed',()=>{
  assert.match(migration,/create table if not exists public\.community_ops_assignments/i)
  assert.match(migration,/private\.is_community_operator/i)
  assert.match(migration,/a\.user_id=p_user and a\.community_id=p_community and a\.active/i)
  assert.match(migration,/alter table public\.community_ops_days enable row level security/i)
  assert.match(migration,/revoke all on public\.community_ops_assignments,public\.community_ops_days/i)
  assert.match(migration,/User must have the pickup_operator role first/i)
})

test('manifest snapshots account-wise cash and payment mode separately',()=>{
  assert.match(migration,/community_ops_day_orders/i)
  assert.match(migration,/expected_product_cash/i)
  assert.match(migration,/expected_delivery_cash/i)
  assert.match(migration,/payment_mode text not null check\(payment_mode in \('cod','prepaid','payment_pending','waived'\)\)/i)
  assert.match(migration,/private\.ops_payment_mode/i)
  assert.match(migration,/product_subtotal else 0/i)
  assert.match(migration,/fulfillment_method='home_delivery' then o\.delivery_fee else 0/i)
})

test('successful fulfilment requires verified goods and exact two-bucket cash reconciliation',()=>{
  assert.match(migration,/Verify the customer order goods before handover/i)
  assert.match(migration,/Product COD must reconcile exactly/i)
  assert.match(migration,/Delivery-fee cash must reconcile exactly/i)
  assert.match(migration,/payment_method='community_ops_cod'/i)
  assert.match(migration,/status='collected'/i)
  assert.match(migration,/status='delivered'/i)
  assert.match(migration,/private\.complete_order_accounting/i)
})

test('exception workflow supports operational, customer, payment and cash cases',()=>{
  for(const code of ['customer_unavailable','customer_refused','damaged_goods','short_goods','partial_delivery','wrong_item','payment_issue','address_issue','return_requested','cash_variance','other_exception']){
    assert.match(migration,new RegExp(code,'i'))
  }
  assert.match(migration,/Exception reason is required/i)
  assert.match(migration,/operational_issues/i)
  assert.match(migration,/community_ops_order_exception/i)
  assert.match(officerPage,/Record exception instead/i)
})

test('inbound reconciliation supports supplier store delivery agent transfer return and variance reasons',()=>{
  for(const source of ['supplier','2tbr_store','delivery_agent','transfer','return','other']){
    assert.match(migration,new RegExp(source,'i'))
  }
  assert.match(migration,/Inbound variance requires an exception reason/i)
  assert.match(migration,/damaged_quantity/i)
  assert.match(migration,/returned_quantity/i)
  assert.match(migration,/community_ops_stock_adjustments/i)
  assert.match(migration,/retained_at_point/i)
  assert.match(migration,/returned_to_office/i)
  assert.match(migration,/product\(s\) still have stock variance/i)
  assert.match(officerPage,/Receive and reconcile products/i)
  assert.match(officerPage,/Account stock variance/i)
})

test('daily report and cash handover are gated before Admin close',()=>{
  assert.match(migration,/submit_community_ops_report/i)
  assert.match(migration,/ready customer orders still need handover or an exception/i)
  assert.match(migration,/submit_community_ops_cash_handover/i)
  assert.match(migration,/Cash handover variance requires a written reason/i)
  assert.match(migration,/admin_accept_community_ops_cash/i)
  assert.match(migration,/explicitly accept exceptions with a reason/i)
  assert.match(migration,/accepted_with_exception/i)
  assert.match(officerPage,/Product COD cash/i)
  assert.match(officerPage,/Home delivery fees/i)
  assert.match(adminPage,/Accept cash & close day/i)
})

test('Admin has a live community reconciliation read model and officer assignment UI',()=>{
  assert.match(migration,/admin_get_community_ops_days/i)
  assert.match(migration,/admin_get_community_ops_assignments/i)
  assert.match(adminPage,/Daily transaction result/i)
  assert.match(adminPage,/Assign Community Operations Officer/i)
  assert.match(adminPage,/Product COD physically received/i)
  assert.match(adminPage,/Delivery fees physically received/i)
})

test('Community Ops is reachable from officer and Admin navigation',()=>{
  assert.match(appShell,/href="\/community-ops"/i)
  assert.match(appShell,/Community Ops/i)
  assert.match(adminShell,/\/admin\/community-ops/i)
})

test('server actions use guarded RPCs instead of direct financial table writes',()=>{
  assert.match(actions,/requirePickupOperator/i)
  assert.match(actions,/requireAdmin/i)
  assert.match(actions,/record_community_ops_stock_adjustment/i)
  assert.match(actions,/complete_community_ops_order/i)
  assert.match(actions,/record_community_ops_order_exception/i)
  assert.match(actions,/admin_accept_community_ops_cash/i)
  assert.doesNotMatch(actions,/\.from\('community_ops_/i)
})
