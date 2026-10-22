import test from 'node:test'
import assert from 'node:assert/strict'
import {loadSource} from './helpers/load-tsx.mjs'
const adapters=await loadSource('lib/simple-offers.ts')
const data=await loadSource('lib/approved-live-detail-data.ts')
const wholePool=await loadSource('lib/whole-pool-tier-totals.ts')
const views=await loadSource('lib/approved-card-view.ts',{'./approved-live-detail-data':data,'./whole-pool-tier-totals':wholePool})
const pid='11111111-1111-4111-8111-111111111111',area='22222222-2222-4222-8222-222222222222'
const item={product_id:pid,name:'Real loose rice',brand:null,category:'Rice',package_size:'1 kg',unit:'kg',image_url:'https://example.com/rice.jpg',price:100,old_price:0,available_quantity:10}
const direct={id:'33333333-3333-4333-8333-333333333333',kind:'SOLO',community_id:area,community_name:'Area A',title:'Direct',closes_at:null,buyer_count:0,items:[item]}
const group={...direct,id:'44444444-4444-4444-8444-444444444444',kind:'GROUP_DEAL',title:'Deal',items:[{...item,price:90}]}
const pool={...direct,id:'55555555-5555-4555-8555-555555555555',kind:'COMMUNITY_POOL',title:'Pool',items:[{...item,price:80,old_price:120}]}
test('three offer kinds reuse the master image and shared availability with independent prices',()=>{
 const catalog=adapters.simpleCartCatalog([direct,group,pool])
 assert.deepEqual(Array.from(catalog,p=>p.approved_unit_price),[100,90,80])
 assert.ok(catalog.every(p=>p.image_url===item.image_url&&p.available_quantity===10&&p.product_id===pid))
 assert.equal(catalog[1].offer_id,group.id)
})
test('approved cards receive real offer IDs and no invented thresholds',()=>{
 const offers=adapters.simpleStorefrontOffers([direct,group,pool]),pools=adapters.simpleFeaturedPools([pool])
 const home=views.approvedHomeView({offers,pools,products:[],catalog:[]},area)
 assert.equal(home.products[0].launchOfferId,direct.id)
 assert.equal(home.products[0].oldPrice,0)
 assert.equal(home.deals[0].launchOfferId,group.id)
 assert.equal(home.deals[0].target,0)
 assert.equal(home.deals[0].price,90)
 assert.equal(home.pools[0].launchOfferId,pool.id)
 assert.equal(views.approvedPoolView(pools[0]).lines[0].product.stock,10)
 assert.equal(views.approvedPoolView(pools[0]).lines[0].tiers.current,80)
})
test('product selector preserves requested Pool context and does not invent a Direct offer',()=>{
 const offers=adapters.simpleStorefrontOffers([group,pool])
 const source=data.productFromPublicSources(pid,offers,null,null)
 const view=views.approvedProductView(source,pool.id)
 assert.equal(view.initialOfferId,pool.id)
 assert.equal(view.offers.find(o=>o.id===pool.id).price,80)
 assert.equal(view.offers.find(o=>o.id===pool.id).oldPrice,120)
 assert.equal(view.offers.find(o=>o.id===pool.id).purchasable,true)
 assert.equal(view.offers.find(o=>o.kind==='solo').empty,true)
})
test('community filtering keeps another area Direct offer out of Exclusive cards',()=>{
 const home=views.approvedHomeView({offers:adapters.simpleStorefrontOffers([direct]),pools:[],products:[],catalog:[],vendorProducts:adapters.simpleCartCatalog([direct])},'66666666-6666-4666-8666-666666666666')
 assert.ok(home.products.every(p=>p.empty))
})

test('one multi-area offer appears once in each selected community and never in other areas',()=>{
 const second='77777777-7777-4777-8777-777777777777'
 const shared=[direct,group,pool].map(o=>({...o,community_ids:[area,second],community_name:'Area A, Area B'}))
 const offers=adapters.simpleStorefrontOffers(shared),pools=adapters.simpleFeaturedPools(shared)
 for(const selected of ['',area,second]){
  const home=views.approvedHomeView({offers,pools,products:[],catalog:[],vendorProducts:adapters.simpleCartCatalog(shared)},selected)
  assert.equal(home.products.filter(p=>!p.empty).length,1)
  assert.equal(home.deals.filter(p=>!p.empty).length,1)
  assert.equal(home.pools.filter(p=>!p.empty).length,1)
  assert.equal(home.deals[0].launchOfferId,group.id)
 }
 const other=views.approvedHomeView({offers,pools,products:[],catalog:[],vendorProducts:adapters.simpleCartCatalog(shared)},'88888888-8888-4888-8888-888888888888')
 assert.ok([...other.products,...other.deals,...other.pools].every(p=>p.empty))
})

test('published deal progress uses configured thresholds and verified buyers, not cart activity',()=>{
 const configured={...group,buyer_count:1,buyer_target:3,pending_buyers:2}
 const offers=adapters.simpleStorefrontOffers([configured])
 assert.equal(offers[0].buyer_count,1)
 assert.equal(offers[0].next_threshold,3)
 const home=views.approvedHomeView({offers,pools:[],products:[],catalog:[]},area,'','Area A')
 assert.equal(home.deals[0].joined,1)
 assert.equal(home.deals[0].target,3)
 assert.equal(home.deals[0].community,'Community: Area A')
 assert.equal(views.approvedHomeView({offers,pools:[],products:[],catalog:[]}).deals[0].community,'Community: All')
})
