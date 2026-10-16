import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {bangladeshInputToUtc,utcToBangladeshInput,displayBangladeshDateTime,displayBangladeshDate} from '../lib/bangladesh-datetime.mjs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('original Amin Model Town schedule is saved as intended Bangladesh clock times',()=>{
 const timepairs=[
  ['2026-10-16T08:37','2026-10-16T02:37:00.000Z'],
  ['2026-10-22T08:37','2026-10-22T02:37:00.000Z'],
  ['2026-10-22T22:40','2026-10-22T16:40:00.000Z'],
  ['2026-10-23T08:38','2026-10-23T02:38:00.000Z'],
  ['2026-10-23T14:40','2026-10-23T08:40:00.000Z'],
 ]
 for(const [input,utc] of timepairs){
  assert.equal(bangladeshInputToUtc(input),utc)
  assert.equal(utcToBangladeshInput(utc),input)
 }
 assert.equal(bangladeshInputToUtc('2026-01-01T00:15'),'2025-12-31T18:15:00.000Z')
 assert.equal(utcToBangladeshInput('2025-12-31T18:15:00.000Z'),'2026-01-01T00:15')
 assert.equal(bangladeshInputToUtc(''),null)
 assert.equal(bangladeshInputToUtc(null),null)
 assert.equal(utcToBangladeshInput(null),'')
})

test('Bangladesh date conversion is independent of server machine timezone',()=>{
 const code="import {bangladeshInputToUtc as convert,utcToBangladeshInput as format} from './lib/bangladesh-datetime.mjs'; console.log(JSON.stringify([convert('2026-10-23T14:40'),format('2026-10-23T08:40:00+00:00')]))"
 for(const timezone of ['UTC','America/New_York','Asia/Dhaka']){
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('../',import.meta.url),env:{...process.env,TZ:timezone},encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
  assert.equal(result.stdout.trim(),JSON.stringify(['2026-10-23T08:40:00.000Z','2026-10-23T14:40']))
 }
})

test('invalid dates rejected instead of silently normalized',()=>{
 for(const value of ['bad','2026-13-10T10:00','2026-02-29T11:12','2026-10-16T24:00','2026-10-16T08:60','2026-10-16T08:37Z','2026-10-16 08:37','2026-10-16T08:37+06:00']){
  assert.throws(()=>bangladeshInputToUtc(value),RangeError,value)
 }
 assert.equal(bangladeshInputToUtc('2028-02-29T12:30'),'2028-02-29T06:30:00.000Z')
})

test('date and time shown in admin match Bangladesh time',()=>{
 const date=displayBangladeshDateTime('2026-10-23T08:40:00.000Z')
 assert.match(date,/23/)
 assert.match(date,/2:40|14:40/)
 assert.ok(date.includes('2026'))
 assert.match(displayBangladeshDate('2026-10-23T23:30:00Z'),/24/)
})

test('all pool datetime-local submission and edit routes use fixed Bangladesh converter',()=>{
 for(const path of ['app/actions/pools.ts','app/actions/pool-ops-edit.ts','app/actions/admin.ts']){
  const action=read(path)
  assert.match(action,/bangladeshInputToUtc/)
  assert.doesNotMatch(action,/new Date\(v\)\.toISOString\(\)/)
 }
 const create=read('app/actions/pools.ts')
 const operations=read('app/actions/pool-ops-edit.ts')
 for(const name of ['opens_at','commitment_closes_at','confirmation_closes_at','supplier_delivery_at','pickup_at']){
  assert.match(create,new RegExp('isoOrNull\\(t\\(fd,\\x27'+name+'\\x27\\),(?:errorPath|returnPath)\\)'))
 }
 for(const name of ['commitment_closes_at','confirmation_closes_at','supplier_delivery_at','pickup_at']){
  assert.match(operations,new RegExp('isoOrNull\\(t\\(fd,\\x27'+name+'\\x27\\),poolId\\)'))
 }
 assert.match(create,/validateTimeline\(/)
 assert.match(operations,/validateTimeline\(/)
})

test('Pool admin edit form is real Bangladesh time and clearly labelled',()=>{
 for(const path of ['app/admin/pools/workflow/page.tsx','app/admin/pools/edit/page.tsx']){
  const page=read(path)
  assert.match(page,/utcToBangladeshInput/)
  assert.doesNotMatch(page,/new Date\(value\)\.toISOString\(\)\.slice\(0,16\)/)
  assert.match(page,/Asia\/Dhaka, UTC\+06/)
 }
 assert.match(read('app/admin/pools/new/page.tsx'),/Asia\/Dhaka, UTC\+06/)
 assert.match(read('app/admin/pools/[id]/page.tsx'),/displayBangladeshDateTime/)
 assert.match(read('app/pool/page.tsx'),/displayBangladeshDate/)
 assert.doesNotMatch(read('app/actions/pools.ts'),/update public\.pool_items|update public\.orders|setCommerceCartItem/)
})
