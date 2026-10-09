import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20261009123000_supply_handover_fraud_control.sql','utf8')
const supplyPage=fs.readFileSync('app/supply/page.tsx','utf8')
const communityPage=fs.readFileSync('app/community-ops/page.tsx','utf8')
const adminPage=fs.readFileSync('app/admin/supply-control/page.tsx','utf8')
const actions=fs.readFileSync('app/actions/supply.ts','utf8')

test('supply actors are authenticated and scoped to supplier or internal location memberships',()=>{
  assert.match(migration,/supply_location_memberships/i)
  assert.match(migration,/supplier_memberships/i)
  assert.match(migration,/private\.can_manage_supply_source/i)
  assert.match(migration,/sm\.role in \('owner','manager'\)/i)
  assert.match(migration,/lm\.role in \('manager','storekeeper'\)/i)
  assert.match(migration,/revoke all on public\.supply_locations,public\.supply_location_memberships,public\.supply_dispatches/i)
})

test('sealed dispatch quantities are immutable and protected by a one-time hashed code',()=>{
  assert.match(migration,/supply_dispatch_items/i)
  assert.match(migration,/Only a draft dispatch can be sealed/i)
  assert.match(migration,/extensions\.digest\(v_code,'sha256'\)/i)
  assert.match(migration,/expires_at[\s\S]*24 hours/i)
  assert.match(migration,/consumed_at/i)
  assert.match(supplyPage,/Seal & generate code/i)
  assert.match(supplyPage,/one-time receiving code/i)
})

test('separation of duties blocks sender carrier receiver self-verification',()=>{
  assert.match(migration,/Dispatch creator cannot also be the carrier/i)
  assert.match(migration,/Separation of duties violation at receiving/i)
  assert.match(migration,/Independent Admin required: source staff, sender, receiver or carrier cannot resolve the same dispatch/i)
})

test('Community Ops independently counts package seal and every product',()=>{
  assert.match(migration,/Count every product in the dispatch before verifying/i)
  assert.match(migration,/Package count mismatch/i)
  assert.match(migration,/Seal reference mismatch/i)
  assert.match(migration,/Product quantity\/damage\/return mismatch/i)
  assert.match(communityPage,/Observed package count/i)
  assert.match(communityPage,/Observed seal reference/i)
  assert.match(communityPage,/Verify physical handover/i)
})

test('exact match posts verified stock while variance stays blocked',()=>{
  assert.match(migration,/private\.post_verified_dispatch_to_community/i)
  assert.match(migration,/source_dispatch_id/i)
  assert.match(migration,/return 'verified'/i)
  assert.match(migration,/return 'variance'/i)
  assert.match(communityPage,/blocked from verified Community Ops stock/i)
})

test('invalid codes trigger persisted fraud signals and a security hold',()=>{
  assert.match(migration,/failed_attempts=failed_attempts\+1/i)
  assert.match(migration,/handover_code_failed/i)
  assert.match(migration,/five_invalid_handover_codes/i)
  assert.match(migration,/status='security_hold'/i)
  assert.match(migration,/private\.supply_actor_risk_profiles/i)
  assert.match(migration,/Separation of duties violation at receiving/i)
  assert.match(adminPage,/Fraud & risk signals/i)
})

test('variance resolution is independent, reasoned and responsibility-aware',()=>{
  assert.match(migration,/accept_receiver_count/i)
  assert.match(migration,/replacement_pending/i)
  assert.match(migration,/return_entire_batch/i)
  assert.match(migration,/fraud_hold/i)
  assert.match(migration,/reset_for_reseal/i)
  assert.match(migration,/Resolution reason is required/i)
  assert.match(migration,/p_responsibility not in \('source','receiver','carrier','none','unknown'\)/i)
  assert.match(migration,/reliability_status=.*watch/i)
  assert.match(adminPage,/Save independent resolution/i)
})

test('supply chain events and audit events are retained',()=>{
  assert.match(migration,/supply_chain_events/i)
  assert.match(migration,/supply_dispatch_created/i)
  assert.match(migration,/supply_dispatch_sealed/i)
  assert.match(migration,/supply_dispatch_verified/i)
  assert.match(migration,/supply_variance_resolved/i)
})

test('server actions use guarded RPC workflows rather than direct supply-table writes',()=>{
  assert.match(actions,/requireUser/i)
  assert.match(actions,/requirePickupOperator/i)
  assert.match(actions,/requireAdmin/i)
  assert.match(actions,/create_supply_dispatch/i)
  assert.match(actions,/receive_supply_dispatch/i)
  assert.match(actions,/admin_resolve_supply_variance/i)
  assert.doesNotMatch(actions,/\.from\('supply_/i)
})
