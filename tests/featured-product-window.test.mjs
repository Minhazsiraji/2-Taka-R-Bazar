import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {featuredProductWindow} from '../lib/featured-product-window.ts'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('featured selection wraps in order and never pads a short collection',()=>{
 assert.deepEqual(featuredProductWindow([],0),[])
 assert.deepEqual(featuredProductWindow(['a'],0),['a'])
 assert.deepEqual(featuredProductWindow(['a','b'],1),['b','a'])
 assert.deepEqual(featuredProductWindow(['a','b','c','d'],3),['d','a','b'])
 assert.deepEqual(featuredProductWindow(['a','b','c','d'],-1),['d','a','b'])
 assert.deepEqual(featuredProductWindow(['a','b','c','d'],NaN),['a','b','c'])
})
test('compact featured cards reuse approved card structure and offer data without enabling checkout',()=>{
 const component=read('components/featured-products-carousel.tsx')
 assert.match(component,/featuredProductWindow\(products,start\)/)
 for(const name of ['market-product-image','market-product-title','market-product-prices','market-product-count','market-product-progress','market-product-actions'])assert.ok(component.includes(name),name)
 assert.match(component,/o.product_id===item.product_id&&\(!selectedArea\|\|o.community_id===selectedArea\)/)
 assert.match(component,/disabled aria-disabled="true"/)
 assert.match(component,/hasCurrentPrice/)
 assert.match(component,/Conditional price or quote pending/)
 assert.match(component,/onMouseEnter/)
 assert.match(component,/onFocusCapture/)
 assert.match(component,/if\(!document.hidden\)/)
 assert.match(component,/prefers-reduced-motion: reduce/)
 assert.ok(!component.includes('min-h-[490px]'))
})
test('exclusive section has three desktop cards, two tablet cards and one mobile card',()=>{
 const css=read('app/marketplace-exclusive-cards.css')
 assert.match(css,/repeat\(3,minmax\(0,1fr\)\)/)
 assert.match(css,/@media\(max-width:1099px\)/)
 assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/)
 assert.match(css,/@media\(max-width:640px\)/)
 assert.match(css,/market-showcase-product:nth-child\(n\+2\)/)
 assert.ok(!css.includes('.market-flat-header'))
 assert.ok(!css.includes('.market-hero-message'))
 assert.ok(!css.includes('.market-products-grid'))
})
