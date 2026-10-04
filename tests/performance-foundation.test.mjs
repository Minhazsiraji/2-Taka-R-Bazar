import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(rel)=>readFileSync(new URL(`../${rel}`,import.meta.url),'utf8')

test('Vercel functions are colocated with the Mumbai Supabase region',()=>{
  const config=JSON.parse(read('vercel.json'))
  assert.deepEqual(config.regions,['bom1'])
})

test('bulk latency migration adds hot-path indexes and cached auth uid policies',()=>{
  const sql=read('supabase/migrations/202610042310_latency_bulk_performance.sql')
  for(const expected of [
    'orders_pool_id_idx',
    'order_items_pool_item_id_idx',
    'pool_items_product_id_idx',
    'market_price_observations_community_product_observed_idx',
    'notifications_pool_id_idx',
    'payment_records_order_id_idx',
    'savings_ledger_order_id_idx',
  ]) assert.match(sql,new RegExp(expected))
  assert.match(sql,/\(select auth\.uid\(\)\)/)
})
