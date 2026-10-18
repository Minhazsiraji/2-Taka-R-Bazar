import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const copy=readFileSync(new URL('../src/content.ts',import.meta.url),'utf8');
test('approved navigation: account only in header, five bottom tabs',()=>{
 assert.match(app,/\['home','home-outline'\]/);
 assert.match(app,/\['pools','people-outline'\]/);
 assert.match(app,/\['deals','pricetag-outline'\]/);
 assert.match(app,/\['exclusive','basket-outline'\]/);
 assert.match(app,/\['cart','cart-outline'\]/);
 assert.match(app,/headerAction\('person-outline'/);
 assert.doesNotMatch(app,/\['account','person-outline'\]/);
});
test('approved homepage content order preserved',()=>{
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 const keys=['<Hero/>','<Savings home/>',"t.groups","t.exclusive","t.pools"];
 const positions=keys.map(key=>home.indexOf(key));
 assert.ok(positions.every(p=>p>=0),JSON.stringify(positions));
 assert.ok(positions.every((p,i)=>i===0||p>positions[i-1]),JSON.stringify(positions));
});
test('hero uses original four website message pairs and permanent slogans',()=>{
 assert.match(app,/setSlide\(s=>\(s\+1\)%heroMessages.length\),9000/);
 assert.match(copy,/Smart people make smart decisions/);
 assert.match(copy,/A smarter way to shop/);
 assert.match(copy,/Your neighbours. Your Pool/);
 assert.match(copy,/every taka count/);
 assert.match(app,/Smart shopping\. Real savings!/);
 assert.match(app,/একসাথে কিনি, কম দামে পাই!/);
});
test('savings and cart cannot silently behave like paid verified orders',()=>{
 assert.match(app,/demo\?money\(demoSavings.thisMonth\):'—'/);
 assert.match(app,/No real order or savings transaction has been created/);
 assert.match(app,/cartLineCount\(cart\)/);
});

test('Group Deal card visibly shows a people icon and deadline clock',()=>{
 assert.ok(app.includes('name="people" size={14} color="#149be7"'));
 assert.ok(app.includes('name="time-outline" size={14}'));
 assert.ok(app.includes('Ends in {offer.daysLeft} day'));
});
test('Exclusive card keeps image-first layout, price and available inventory',()=>{
 assert.match(app,/function ExclusiveCard/);
 assert.ok(app.includes('height={128}'));
 assert.match(app,/offer.stock\|\|0} available/);
});
test('Pools show product count, weekly-monthly modes and Explore Pool action',()=>{
 assert.match(app,/function PoolCard/);
 assert.match(app,/pool.productIds.length/);
 assert.match(app,/pool.frequency==='weekly'/);
 assert.match(app,/Explore Pool →/);
});
test('Footer contact details are horizontally split and separate',()=>{
 assert.match(app,/Contact us/);
 assert.match(app,/business@2takarbazar.com/);
 assert.match(app,/support@2takarbazar.com/);
 assert.match(app,/flexDirection:'row',gap:12,marginTop:4/);
});
test('Hero cart excludes fresh produce and keeps pantry product names',()=>{
 const art=readFileSync(new URL('../src/nonperishable-cart.tsx',import.meta.url),'utf8');
 for(const name of ['RICE','DAL','OIL','TEA','SUGAR'])assert.match(art,new RegExp(name));
 for(const prohibited of ['TOMATO','CARROT','LETTUCE','CABBAGE'])assert.doesNotMatch(art,new RegExp(prohibited));
});

test('Home keeps approved headings without numbered eyebrow labels or extra demo notice',()=>{
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 for(const label of ['01 · COMMUNITY SAVINGS','02 · CURATED FOR YOU','03 · BUY IN A POOL'])assert.ok(!home.includes(label));
 assert.ok(home.includes("title('',t.groups"));
 assert.ok(home.includes("title('',t.exclusive"));
 assert.ok(home.includes("title('',t.pools"));
 assert.ok(home.includes('<Savings home/>'));
 assert.ok(app.includes('{!home&&<Text'));
 assert.ok(home.includes("pill(t.demo,true)"));
});

test('Group Deal detail opens a distinct retail-only product page',()=>{
 assert.match(app,/function GroupDealDetails/);
 assert.match(app,/function RetailDetails/);
 assert.match(app,/Product Details →/);
 assert.match(app,/onPress=\{\(\)=>setScreen\('retail'\)\}/);
 assert.match(app,/case 'retail':return <RetailDetails\/>/);
 assert.match(app,/Retail reference only. Group Deal and Pool tier prices are not displayed/);
});
test('Group Deal price tier display is demo-only; Home remains locked',()=>{
 assert.match(app,/if\(!demo\|\|offer.mode!=='GROUP_DEAL'\)return null/);
 assert.match(app,/Current qualifying tier · Price not final/);
 assert.match(app,/Potential saving:/);
 assert.match(app,/Next tier at/);
 assert.match(app,/height=\{small\?330:360\}/);
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 assert.match(home,/<Hero\/>/);
 assert.match(home,/<Savings home\/>/);
});
