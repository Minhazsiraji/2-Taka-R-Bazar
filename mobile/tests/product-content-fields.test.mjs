import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../src/data.ts',import.meta.url),'utf8');
const fields=readFileSync(new URL('../src/product-content.ts',import.meta.url),'utf8');
const live=readFileSync(new URL('../src/live.ts',import.meta.url),'utf8');
test('Product Brand is an optional master field; empty is not invented',()=>{
 assert.ok(catalog.includes('brand?:string;content?:ProductContent'));
 assert.ok(app.includes('Product brand'));
 assert.ok(app.includes('productMissing(product.brand,lang)'));
 assert.ok(fields.includes("'Not provided yet'"));
 assert.ok(live.includes("typeof x.brand==='string'"));
});
test('SEO/AEO/GEO optional sections use admin fields and are expandable',()=>{
 for(const phrase of ['Description & specifications (SEO)','Questions & answers (AEO)','Local availability (GEO)'])assert.ok(fields.includes(phrase));
 for(const phrase of ['descriptionEn','faqQuestionEn','serviceAreasEn','seoTitleEn','canonicalUrl','imageAltEn'])assert.ok(fields.includes(phrase));
 assert.ok(app.includes('productInfoSections.map(section=>'));
 assert.ok(app.includes('accessibilityState={{expanded:!!productInfoOpen[section.id]}}'));
});
test('retail details and homepage remain conceptually independent',()=>{
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 assert.ok(home.includes('<Savings home/>'));
 assert.ok(home.includes("title('',t.groups"));
 assert.ok(!home.includes('productInfoSections.map'));
 assert.ok(app.includes('Retail reference only. Group Deal and Pool tier prices are not displayed'));
});
