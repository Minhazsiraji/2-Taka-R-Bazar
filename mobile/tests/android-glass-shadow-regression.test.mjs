import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const theme=readFileSync(new URL('../src/theme.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');

test('Android translucent glass avoids rasterized boxShadow and elevation rectangles',()=>{
 assert.doesNotMatch(theme,/boxShadow\s*:/);
 assert.doesNotMatch(app,/elevation\s*:/);
 assert.doesNotMatch(app,/shadowOpacity\s*:/);
 assert.match(theme,/borderTopColor:'#FFFFFF'/);
 assert.match(theme,/borderBottomColor:'rgba\(255,255,255,0\.64\)'/);
});
test('all inner and outer white glass remains truly translucent in light and dark',()=>{
 const palette=theme.slice(theme.indexOf('export const glassSurfaces='));
 for(const name of ['outer','inset','control','selected']){
  const rgx=new RegExp(name+':\\{\\.\\.\\.gloss\\.rim,backgroundColor:\\x27rgba\\([^)]*,0\\.\\d+\\)\\x27,borderWidth:1\\}','g');
  assert.equal((palette.match(rgx)||[]).length,2,name+' should exist with translucent alpha in both themes');
 }
 assert.match(app,/styles\.savingTile,glass\.inset/);
 assert.match(app,/styles\.priceOption,\{\.\.\.glass\.inset/);
 assert.match(app,/styles\.panel,glass\.outer/);
 assert.match(app,/backgroundColor:theme\.accent/);
});
test('no changed dimensions of owner approved homepage or product details image',()=>{
 for(const token of ['height:174,minHeight:174,maxHeight:174','height={128}','height={260}','height={small?330:360}',"width:'49%'","paddingBottom:screen==='pool'?110:30"])
  assert.ok(app.includes(token),token);
 assert.match(app,/resizeMode="cover"/);
});
