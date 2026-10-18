import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const data=readFileSync(new URL('../src/data.ts',import.meta.url),'utf8');
const orderLines=data.split('\n').filter(line=>line.includes("id:'2T-DEMO-")&&line.includes('saving:'));
const records=orderLines.map(line=>{
 const get=(pattern)=>line.match(pattern)?.[1];
 return {id:get(/id:'([^']+)'/),status:get(/status:'([^']+)'/),date:get(/date:'([^']+)'/),saving:Number(get(/saving:(\d+)/))};
});
test('Illustrative savings ledger reconciles with approved unchanged Home tiles',()=>{
 assert.equal(records.length,6);
 const completed=records.filter(o=>o.status==='completed');
 const total=(all)=>all.reduce((n,o)=>n+o.saving,0);
 assert.equal(total(completed),8450);
 assert.equal(total(completed.filter(o=>o.date.startsWith('2026-10'))),1250);
 assert.equal(total(completed.filter(o=>o.date.startsWith('2026-09'))),1060);
 assert.ok(records.filter(o=>o.status!=='completed').every(o=>o.saving===0));
 assert.ok(data.includes('community:248620'));
});
test('Account, filtered Orders, tracking, and Savings are separate native screens',()=>{
 for(const code of ['function Account(){','function Orders(){','function OrderDetail(){','function SavingsReport(){',
   "case 'orderDetail':return <OrderDetail/>","case 'savings':return <SavingsReport/>",
   'setOrderFilter(k)','setSelectedOrderId(o.id)',"text('View tracking & details'","text('How verified savings work'"])
   assert.ok(app.includes(code),code);
});
test('Order tracking does not assert real commerce or earned savings from waiting orders',()=>{
 assert.ok(app.includes("o.status==='completed'?o.saving:0"));
 assert.ok(app.includes("const completed=demoOrders.filter(o=>o.status==='completed')"));
 assert.ok(app.includes("No real order, invoice, refund or delivery tracking is accessed here."));
 assert.ok(app.includes("Sample order, not live tracking"));
 assert.ok(!app.includes('postRealOrder('));
});
test('Locked Home remains unchanged in navigation and layout',()=>{
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 for(const token of ["<Hero/>","<Savings home/>","title('',t.groups","title('',t.exclusive","title('',t.pools"])
 assert.ok(home.includes(token),token);
 assert.ok(!home.includes('OrderDetail'));
});
