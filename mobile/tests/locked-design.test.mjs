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
 const keys=['<Hero/>','<Savings/>',"t.groups","t.exclusive","t.pools"];
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
