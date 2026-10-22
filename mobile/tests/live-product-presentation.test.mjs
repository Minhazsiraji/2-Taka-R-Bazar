import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

test('all product card images fill their existing image holders with glossy rims',()=>{
 const photo=between('function ProductPhoto(', 'function Shop(');
 assert.doesNotMatch(photo,/isPublishedImage/);
 assert.match(photo,/resizeMode="cover"/);
 assert.match(photo,/borderWidth:1/);
 assert.match(photo,/\.\.\.gloss\.rim/);
 assert.match(photo,/onError=\{\(\)=>setFailed\(true\)\}/);
});

test('exclusive cards retain approved thumbnail proportions and fit prices',()=>{
 const exclusive=between('function ExclusiveCard(', 'function PoolCard(');
 assert.match(exclusive,/width:'49%'/);
 assert.match(exclusive,/minWidth:0,justifyContent:'space-around'/);
 assert.match(exclusive,/numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.73\}/);
 assert.match(exclusive,/height=\{128\}/);
 assert.match(exclusive,/styles\.exclusiveCard/);
 assert.match(exclusive,/styles\.exclusiveCard,glass\.outer/);
});

test('View details opens the locked photo-first native retail page and can return',()=>{
 const offer=between('function OfferDetails()', 'function PoolDetails()');
 const retail=between('function RetailDetails()', 'function OfferDetails()');
 assert.match(offer,/button\(t\.details,\(\)=>setScreen\('retail'\),false\)/);
 assert.doesNotMatch(offer,/button\(t\.details,\(\)=>link\(/);
 assert.match(app,/case 'retail':return <RetailDetails\/>/);
 assert.match(retail,/<View style=\{\{marginBottom:12\}\}><ProductPhoto item=\{product\} height=\{small\?330:360\}\/>\<\/View\>/);
 assert.match(retail,/productInfoSections\.map\(section=>/);
 assert.match(retail,/Back to Group Deal/);
 assert.match(offer,/<View style=\{\{marginBottom:12\}\}><ProductPhoto item=\{p\} height=\{260\}\/><\/View>/);
 assert.match(retail,/\.\.\.glass\.outer,borderRadius:12,marginBottom:8/);
});

test('scroll content stays inside reserved bottom-tab viewport',()=>{
 assert.match(app,/<ScrollView key=\{screen\} style=\{\{flex:1\}\}/);
 assert.match(app,/paddingBottom:screen==='pool'\?110:30/);
 assert.match(app,/<View style=\{\[styles\.bottom,/);
});

test('shared panels have clear glass fills, white rims, and frozen layout',()=>{
 assert.match(app,/const glass=dark\?glassSurfaces\.dark:glassSurfaces\.light/);
 assert.match(app,/const panel=.*\[styles\.panel,glass\.outer\]/);
 assert.match(app,/styles\.panel/);
 assert.match(app,/\.\.\.gloss\.rim/);
 assert.match(app,/paddingBottom:screen==='pool'\?110:30/);
});

test('all Savings tiles, inner product sections and bars use one translucent glass system',()=>{
 const theme=readFileSync(new URL('../src/theme.ts',import.meta.url),'utf8');
 assert.match(theme,/export const glassSurfaces=/);
 for(const token of ['outer:','inset:','control:','selected:'])assert.ok(theme.includes(token));
 const savings=between('const savingTile=', 'function DealCard(');
 assert.match(savings,/styles\.savingTile,glass\.inset/);
 assert.doesNotMatch(savings,/backgroundColor:dark\?theme\.field:tint/);
 assert.match(app,/styles\.priceOption,\{\.\.\.glass\.inset/);
 assert.match(app,/styles\.search,glass\.control/);
 assert.match(app,/styles\.bottom,\{\.\.\.glass\.outer/);
 assert.match(app,/styles\.headerIcon,glass\.control/);
 assert.match(app,/styles\.menuRow,glass\.outer/);
 assert.match(app,/style=\{\[styles\.panel,glass\.outer\]\}/);
});
