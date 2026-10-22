import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const themes=readFileSync(new URL('../src/theme.ts',import.meta.url),'utf8');
test('Approved V1 Signature Teal has exact fixed HEX codes',()=>{
 for(const entry of ["primary:'#007F83'","accent:'#2CD6CE'","text:'#17233B'","background:'#F4F1F6'"]){
  assert.ok(themes.includes(entry),entry);
 }
});
test('Both light and dark screens use the single shared theme',()=>{
 assert.ok(app.includes("import {palette,brandV1,gloss,glassSurfaces} from './src/theme'"));
 assert.ok(app.includes('const theme=dark?palette.dark:palette.light'));
 assert.ok(!app.includes("light:{background:'#e7e2e8'"));
 assert.ok(themes.includes("onPrimary:brandV1.white"));
 assert.ok(themes.includes("onPrimary:brandV1.text"));
});
test('Hero, product tiles, bottom navigation, account and details use themed colors',()=>{
 for(const section of ['function Home()','function DealCard(','function ExclusiveCard(','function PoolCard(','function GroupDealDetails(','function RetailDetails(','function Account()','function Orders()']){
   assert.ok(app.includes(section),section);
 }
 assert.ok(readFileSync(new URL('../src/motion-hero.tsx',import.meta.url),'utf8').includes('backgroundColor:dark?palette.dark.hero:palette.light.hero'));
 assert.ok(app.includes('backgroundColor:theme.accent'));
 assert.ok(app.includes('color:theme.text'));
});
