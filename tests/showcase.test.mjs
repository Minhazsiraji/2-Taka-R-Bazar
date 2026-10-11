import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync(new URL('../supabase/migrations/202610110001_exclusive_product_showcase.sql',import.meta.url),'utf8')
const action=readFileSync(new URL('../app/actions/own-product-showcase.ts',import.meta.url),'utf8')
const route=readFileSync(new URL('../app/products/[id]/page.tsx',import.meta.url),'utf8')
const carousel=readFileSync(new URL('../components/featured-products-carousel.tsx',import.meta.url),'utf8')
const media=readFileSync(new URL('../lib/showcase-media.ts',import.meta.url),'utf8')

test('public RPC whitelists safe customer-facing columns and excludes drafts, demos and inactive products',()=>{
  assert.match(sql,/security definer/)
  assert.match(sql,/p\.active=true and p\.is_demo=false/)
  assert.match(sql,/s\.published=true/)
  assert.match(sql,/p\.source_type in \('PRIVATE_LABEL','EXCLUSIVE_PARTNER'\)/)
  assert.match(sql,/s\.featured=true/)
  assert.match(sql,/grant execute on function public\.get_public_own_product_showcase\(uuid,boolean\) to anon,authenticated/)
  assert.doesNotMatch(sql,/select p\.\*/)
  assert.doesNotMatch(sql,/own_product_costs|own_product_inventory/)
})

test('admin-only mutation and no surprise publish or unverified video URL',()=>{
  assert.match(action,/requireAdmin\(\)/)
  assert.match(action,/product\.is_demo \|\| !product\.active/)
  assert.match(action,/publicShowcaseImageUrl/)
  assert.match(action,/showcaseVideo\(rawVideo\)/)
  assert.match(media,/youtube-nocookie\.com/)
  assert.match(media,/res\.cloudinary\.com/)
})

test('public details and carousel use same filtered catalog without inventing prices',()=>{
  assert.match(route,/get_public_own_product_showcase/)
  assert.match(route,/notFound\(\)/)
  assert.match(carousel,/Explore product/)
  assert.doesNotMatch(route,/own_product_costs|own_product_inventory|benchmark_price/)
  assert.doesNotMatch(carousel,/৳[0-9]/)
})
