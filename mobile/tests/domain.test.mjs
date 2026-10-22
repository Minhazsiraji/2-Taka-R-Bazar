import test from 'node:test';
import assert from 'node:assert/strict';
import {customerSaving,cartLineCount,cartQuantity,cartSubtotal,nextPoolTier,verifiedTotals} from '../src/domain.mjs';
test('a retail snapshot yields positive but never negative savings',()=>{
 assert.equal(customerSaving(1240,1075,2),330);
 assert.equal(customerSaving(100,120,3),0);
 assert.equal(customerSaving(NaN,50,2),0);
});
test('cart badge counts product lines, not unit quantity',()=>{
 const cart={one:3,two:8,three:0};
 assert.equal(cartLineCount(cart),2);
 assert.equal(cartQuantity(cart),11);
 assert.equal(cartSubtotal(cart,[{id:'one',price:100,phase:'ready'},{id:'two',price:25,phase:'ready'}]),500);
});
test('pool milestones are thresholds, not a limit on participant count',()=>{
 assert.equal(nextPoolTier(12,[10,20,50]),20);
 assert.equal(nextPoolTier(75,[10,20,50]),null);
});
test('only fulfilled, non-synthetic, customer-owned orders earn savings',()=>{
 const lines=[{referencePrice:1240,unitPrice:1075,fulfilledQuantity:3,returnedQuantity:1}];
 const orders=[{customerId:'me',status:'completed',synthetic:false,lines},
 {customerId:'me',status:'confirmed',synthetic:false,lines},
 {customerId:'me',status:'completed',synthetic:true,lines},
 {customerId:'someoneelse',status:'completed',synthetic:false,lines}];
 assert.equal(verifiedTotals(orders,'me'),330);
});
