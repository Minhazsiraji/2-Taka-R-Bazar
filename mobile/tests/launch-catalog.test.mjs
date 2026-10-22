import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectPublishedLaunchProducts} from '../src/launch-catalog.mjs';

const a='c9808ad6-42aa-4574-b604-ff54258a2946';
const row={product_id:a,name:'Brown Rice',package_size:'1 Kg',category:'Rice & Grains',
 image_url:'https://sukabonfjcnaavjgjyuy.supabase.co/storage/v1/object/public/product-images/rice.webp',
 approved_unit_price:120,old_price:0,available_quantity:100,launch_enabled:true,
 supplier_unit_cost:45,payment_recipient:'private',supplier_name:'hidden'};

test('six owner-published rows map to real exclusive cards without any demo prices',()=>{
 const items=Array.from({length:6},(_,i)=>({...row,product_id:i===0?a:a.slice(0,-1)+i}));
 const {products,offers}=projectPublishedLaunchProducts(items);
 // a.slice mutation changes UUID version only last digit; still valid hex and unique.
 assert.equal(products.length,6);assert.equal(offers.length,6);
 assert.equal(products[0].name,'Brown Rice');
 assert.equal(products[0].image,row.image_url);
 assert.equal(products[0].referencePrice,120);
 assert.equal(offers[0].price,120);
 assert.equal(offers[0].stock,100);
 assert.ok(offers.every(o=>o.mode==='SOLO'&&o.exclusive&&o.phase==='ready'));
 assert.ok(offers.every(o=>o.id.startsWith('launch:')));
 assert.equal('supplier_unit_cost' in products[0],false);
 assert.equal('payment_recipient' in offers[0],false);
});

test('no fabricated reference savings when old price is zero or below current price',()=>{
 for(const old_price of [0,'0.00',100,null]){
  const o=projectPublishedLaunchProducts([{...row,old_price}]);
  assert.equal(o.products[0].referencePrice,120);
 }
 assert.equal(projectPublishedLaunchProducts([{...row,old_price:165}]).products[0].referencePrice,165);
});

test('unpublished, invalid, duplicate, missing price and negative inventory are rejected',()=>{
 const bad=[{...row,launch_enabled:false},{...row,product_id:'wrong'},
  {...row,approved_unit_price:0},{...row,available_quantity:-1},{...row,name:''}];
 const v=projectPublishedLaunchProducts([row,...bad,row]);
 assert.equal(v.products.length,1);
 assert.throws(()=>projectPublishedLaunchProducts({items:[row]}),/Invalid launch catalog/);
});

test('live native adapter calls only public launch read RPC and has no mutation methods',()=>{
 const live=readFileSync(new URL('../src/live.ts',import.meta.url),'utf8');
 assert.match(live,/rpc\/get_public_launch_catalog/);
 assert.match(live,/p_product_id:null/);
 assert.doesNotMatch(live,/commerce_catalog|service_role|launch_submit_order\s*\(/);
});
