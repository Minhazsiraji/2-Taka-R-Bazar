import test from 'node:test'
import assert from 'node:assert/strict'
import {loadSource} from './helpers/load-tsx.mjs'
const {wholePoolTierTotals}=await loadSource('lib/whole-pool-tier-totals.ts')
const data=[
 [120,110,[110,105,100]],
 [950,850,[850,840,830]],
 [1500,1350,[1350,1340,1320]],
 [800,650,[650,640,630]],
 [1250,1200,[1200,1190,1180]],
 [1600,1450,[1450,1440,1435]],
]
const lines=data.map(([retail,current,prices])=>({
 retail,opening:current,current,
 steps:[3,5,10].map((_,i)=>({minimum:[5,10,20][i],price:prices[i]}))
}))
test('saved six-product Pool tiers show aggregate bundle price and savings, not an item minimum',()=>{
 const result=wholePoolTierTotals(lines,0)
 assert.equal(result.retail,6220)
 assert.deepEqual(JSON.parse(JSON.stringify(result.stages)),[
  {target:5,total:5610,savings:610},
  {target:10,total:5555,savings:665},
  {target:20,total:5495,savings:725},
 ])
 assert.equal(result.next?.target,5)
 assert.equal(wholePoolTierTotals(lines,5).next?.target,10)
 assert.equal(wholePoolTierTotals(lines,20).next,null)
})
test('customer-selected quantities determine Pool savings and every configured tier',()=>{
 const twoOil=[{...lines[0],quantity:1},{...lines[2],quantity:2}]
 const result=wholePoolTierTotals(twoOil,5)
 assert.equal(result.retail,3120)
 assert.deepEqual(Array.from(result.stages.map(t=>t.total)),[2810,2785,2740])
 assert.deepEqual(Array.from(result.stages.map(t=>t.savings)),[310,335,380])
 assert.equal(result.next?.target,10)
})
test('no unknown reference or missing product-tier price may be counted as savings',()=>{
 const missing=wholePoolTierTotals([{...lines[0],retail:null},lines[1]],0)
 assert.equal(missing.retail,null)
 assert.equal(missing.stages[0].savings,null)
 const partial=wholePoolTierTotals([lines[0],{...lines[1],steps:[]}],0)
 assert.equal(partial.stages.length,0)
 assert.equal(partial.next,null)
})
