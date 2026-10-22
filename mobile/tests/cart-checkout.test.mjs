import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cartSubtotal,cartLineCount} from '../src/domain.mjs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
test('direct subtotal cannot include pending Group Deal or Pool offers',()=>{
 const offers=[
  {id:'solo',phase:'ready',mode:'SOLO',price:145},
  {id:'group',phase:'waiting',mode:'GROUP_DEAL',price:1075},
  {id:'pool',phase:'waiting',mode:'POOL',price:1100}
 ];
 assert.equal(cartSubtotal({solo:2,group:3,pool:2},offers),290);
 assert.equal(cartLineCount({solo:2}),1);
});
test('customer cart has three clearly separated lanes',()=>{
 for(const token of ['Group Deal requests · Pending','Community Pool selections · pending','Direct / Exclusive · ready to order',
  'const [groupDrafts,setGroupDrafts]','const [poolDrafts,setPoolDrafts]',
  'const pendingLines=',"cartSubtotal(cart,offers)",'totalBadge>0'])assert.ok(app.includes(token),token);
});
test('checkout cannot transact or claim a final price',()=>{
 for(const token of ["case 'checkout':return <Checkout/>","disabled={!direct.length} onPress={()=>setScreen('checkout')}",
  'Awaiting final quote','Not yet quoted','No money is collected',
  'Group Deals and Pools are excluded until separately qualified'])assert.ok(app.includes(token),token);
 assert.ok(!app.includes('submitNativePayment('));
 assert.ok(!app.includes('reserveNativeStock('));
});
test('new Cart and Checkout have no effect on locked Home layout',()=>{
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 for(const token of ['<Hero/>','<Savings home/>',"title('',t.groups","title('',t.exclusive","title('',t.pools"])assert.ok(home.includes(token));
 const cart=app.slice(app.indexOf('function Cart()'),app.indexOf('function Account()'));
 assert.ok(!home.includes('groupDrafts'));
 assert.ok(cart.includes('drafts.map'));
});

test('Cart badge has a readable breakdown of direct, group and Pool lines',()=>{
 for(const token of ["Cart badge: ","Group Deal requests · Pending","Pool product lines",
   "drafts.reduce((n,[,items])=>n+Object.values(items).filter(q=>q>0).length,0)",
   "= {demoNum(totalBadge)}"]) assert.ok(app.includes(token),token);
});
test('Online future payment is visibly disabled and cannot mutate payment mode',()=>{
 assert.ok(app.includes("disabled={disabled} accessibilityState={{selected:active,disabled}}"));
 assert.ok(app.includes("Online (future) · Unavailable"));
 assert.ok(app.includes("false,()=>{},true"));
 assert.ok(!app.includes("()=>setPayment('online')"));
 assert.ok(app.includes("Cash on delivery"));
});
