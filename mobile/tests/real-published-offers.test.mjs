import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectPublicSimpleOffers} from '../src/public-simple-offers.mjs';

const ids=['c9808ad6-42aa-4574-b604-ff54258a2946','a14e2ef5-4325-4dca-8e14-8359076e2244',
 '694af490-9cba-4cb7-b6c3-062e88cea0ea','741d446c-c47d-4e1b-9386-8c4501d4eb5c',
 '8905c604-e7e0-4539-9ab4-74b13ceec2e1','ded02dd7-7e55-4e3d-9c07-083b22f6e88b'];
const base={products:[{id:ids[0],name:'Brown Rice',nameBn:'Brown Rice',unit:'1 Kg',
 image:'https://example.com/rice.webp',referencePrice:120,category:'Rice'}],
 offers:[{id:'launch:'+ids[0],productId:ids[0],mode:'SOLO',price:120,
 phase:'ready',exclusive:true,stock:100,community:'All areas'}]};
const items=ids.map((id,i)=>({product_id:id,name:['Brown Rice','Deshi goose meat','Mustered Oil','Para Sondesh','Pure Butter','Pure Ghee'][i],
 image_url:'https://example.com/'+id+'.webp',price:[110.01,850,1350,650,1200,1450][i],
 old_price:[120,950,1500,800,1250.03,1600][i],package_size:i===2?'5L':'1 Kg',
 available_quantity:100}));
const published=[
 {id:'f5e9500e-85d2-4e35-990f-64eb7203147f',kind:'GROUP_DEAL',title:'Amin model Town GD-BR-001',
  community_name:'Amin Model Town-AMT-01',closes_at:null,buyer_count:0,items:[{...items[0],price:110}]},
 {id:'a93c2b2d-70ea-41e7-9d65-fc98359ab730',kind:'COMMUNITY_POOL',
  title:'Amin Model Town NOV-Monthly Pool (11-2026)',community_name:'Amin Model Town-AMT-01',
  buyer_count:0,closes_at:'2026-11-08T07:13:00+00:00',items}
];
test('published 1 Group Deal and 1 six-product Pool projected into approved native cards',()=>{
 const data=projectPublicSimpleOffers(published,base);
 assert.equal(data.products.length,6);
 assert.equal(data.pools.length,1);
 assert.equal(data.pools[0].productIds.length,6);
 assert.equal(data.pools[0].frequency,'monthly');
 assert.equal(data.pools[0].name,'Amin Model Town NOV-Monthly Pool (11-2026)');
 assert.equal(data.pools[0].participants,0);
 assert.equal(data.pools[0].nextTier,0);
 assert.equal(data.offers.filter(x=>x.mode==='GROUP_DEAL').length,1);
 assert.equal(data.offers.filter(x=>x.mode==='POOL').length,6);
 assert.equal(data.offers.filter(x=>x.mode==='SOLO').length,1);
 assert.equal(data.offers.find(x=>x.mode==='GROUP_DEAL').price,110);
 assert.equal(data.offers.find(x=>x.productId===ids[0]&&x.mode==='POOL').price,110.01);
 assert.equal(data.offers.find(x=>x.mode==='GROUP_DEAL').groupSize,undefined);
 assert.equal(data.offers.find(x=>x.mode==='GROUP_DEAL').daysLeft,undefined);
});
test('do not invent a threshold, missing price, savings, expired offer or orphan item',()=>{
 assert.throws(()=>projectPublicSimpleOffers({},base),/Invalid public simple offers/);
 const incomplete={...published[0],items:[{...items[0],price:null}]};
 assert.equal(projectPublicSimpleOffers([incomplete],base).offers.length,1);
 const invalid={...published[1],items:[items[0],{...items[1],product_id:'bad'}]};
 assert.equal(projectPublicSimpleOffers([invalid],base).pools.length,0);
 const duplicate=projectPublicSimpleOffers([...published,...published],base);
 assert.equal(duplicate.pools.length,1);
 assert.equal(duplicate.offers.filter(x=>x.mode==='GROUP_DEAL').length,1);
 assert.equal(duplicate.offers.filter(x=>x.mode==='POOL').length,6);
});
test('real offers feed is public read-only, refreshed when foregrounded and original design locked',()=>{
 const code=readFileSync(new URL('../src/live.ts',import.meta.url),'utf8');
 const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
 assert.match(code,/get_public_launch_catalog/);
 assert.match(code,/get_public_simple_offers/);
 for(const forbidden of ['service_role','admin_save_simple_offer','.insert(','.update(','.delete('])assert.ok(!code.includes(forbidden));
 assert.match(app,/setPools\(result\.pools\)/);
 assert.match(app,/AppState\.addEventListener\('change'/);
 assert.match(app,/height:174,minHeight:174,maxHeight:174/);
 assert.match(app,/resizeMode="cover"/);
 assert.match(app,/glassSurfaces/);
 assert.match(app,/paddingBottom:screen==='pool'\?110:30/);
});

test('real published buyer goals drive progress, never pending or cart drafts',()=>{
 const live=[
  {...published[0],buyer_count:1,pending_buyers:2,buyer_target:5},
  {...published[1],buyer_count:2,pending_buyers:3,buyer_target:10}
 ];
 const data=projectPublicSimpleOffers(live,base);
 const deal=data.offers.find(x=>x.mode==='GROUP_DEAL');
 assert.equal(deal.joined,1);
 assert.equal(deal.pendingBuyers,2);
 assert.equal(deal.groupSize,5);
 assert.equal(data.pools[0].participants,2);
 assert.equal(data.pools[0].nextTier,10);
});
test('real Deals and Pools require native verified identity before server-authoritative commitment',()=>{
 const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
 const api=readFileSync(new URL('../src/customer/api.ts',import.meta.url),'utf8');
 assert.match(app,/const openPublishedOffer/);
 assert.match(app,/const openPublishedPool/);
 assert.match(app,/if\(!auth\.user\)\{setScreen\('signIn'\);return\}/);
 assert.match(app,/joinCustomerDeal\(id,o\.productId,null\)/);
 assert.match(app,/joinCustomerPool\(p\.id,lines,null\)/);
 assert.match(app,/demo\?draftGroup\(offer\):openPublishedOffer\(offer\)/);
 assert.match(app,/demo\?draftPool\(pool,quantities\):openPublishedPool\(pool\)/);
 assert.match(api,/join_simple_sale_group_deal_quantified/);
 assert.match(api,/join_simple_sale_pool_quantified/);
 assert.match(api,/await client\.auth\.getUser\(\)/);
 assert.doesNotMatch(api,/service_role|private\.has_role|admin_/);
});
