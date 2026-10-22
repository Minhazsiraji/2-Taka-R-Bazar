import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

test('real product images use full containment; approved demo crops and image rim unchanged',()=>{
 const photo=between('function ProductPhoto(', 'function Shop(');
 assert.match(photo,/isPublishedImage=item\.image\.includes\('\.supabase\.co\/storage\/v1\/object\/public\/'\)/);
 assert.match(photo,/resizeMode=\{isPublishedImage\?'contain':'cover'\}/);
 assert.match(photo,/\.\.\.gloss\.rim/);
 assert.match(photo,/onError=\{\(\)=>setFailed\(true\)\}/);
});

test('exclusive cards keep approved two columns without squashing live prices',()=>{
 const exclusive=between('function ExclusiveCard(', 'function PoolCard(');
 assert.match(exclusive,/width:demo\?'49%':'43%'/);
 assert.match(exclusive,/minWidth:0,justifyContent:'space-around'/);
 assert.match(exclusive,/numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.73\}/);
 assert.match(exclusive,/height=\{128\}/);
 assert.match(exclusive,/styles\.exclusiveCard/);
});

test('View details opens the locked photo-first native retail page and can return',()=>{
 const offer=between('function OfferDetails()', 'function PoolDetails()');
 const retail=between('function RetailDetails()', 'function OfferDetails()');
 assert.match(offer,/button\(t\.details,\(\)=>setScreen\('retail'\),false\)/);
 assert.doesNotMatch(offer,/button\(t\.details,\(\)=>link\(/);
 assert.match(app,/case 'retail':return <RetailDetails\/>/);
 assert.match(retail,/ProductPhoto item=\{product\} height=\{small\?330:360\}/);
 assert.match(retail,/productInfoSections\.map\(section=>/);
 assert.match(retail,/Back to Group Deal/);
});

test('scroll content stays inside reserved bottom-tab viewport',()=>{
 assert.match(app,/<ScrollView key=\{screen\} style=\{\{flex:1\}\}/);
 assert.match(app,/paddingBottom:screen==='pool'\?110:30/);
 assert.match(app,/<View style=\{\[styles\.bottom,/);
});
