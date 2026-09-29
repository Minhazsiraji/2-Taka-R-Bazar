import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('active pool editor permits only operational fields',()=>{
  const action=readFileSync(new URL('../app/actions/pool-ops-edit.ts',import.meta.url),'utf8')
  assert.match(action,/\['open','pricing','final_price','confirmation'\]/)
  assert.match(action,/commitment_closes_at/)
  assert.match(action,/confirmation_closes_at/)
  assert.match(action,/supplier_delivery_at/)
  assert.match(action,/pickup_at/)
  assert.match(action,/receiving_pickup_point_id/)
  assert.doesNotMatch(action,/community_id:t\(/)
  assert.doesNotMatch(action,/benchmark_price/)
  assert.doesNotMatch(action,/customer_ceiling_price/)
})

test('focused pool details expose the safe active pool editor',()=>{
  const details=readFileSync(new URL('../app/admin/pools/[id]/page.tsx',import.meta.url),'utf8')
  assert.equal(details.includes('/admin/pools/edit?pool=${pool.id}'),true)
  assert.match(details,/Edit pool details/)
})
