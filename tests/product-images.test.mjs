import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('product image actions use managed validated uploads and never accept arbitrary image URLs',()=>{
  const actions=read('app/actions/product-images.ts')
  assert.match(actions,/validateProductImage/)
  assert.match(actions,/randomUUID/)
  assert.match(actions,/upsert:false/)
  assert.match(actions,/PRODUCT_IMAGE_BUCKET/)
  assert.match(actions,/removeManagedImage/)
  assert.doesNotMatch(actions,/t\(fd,'image_url'\)/)
})

test('all admin product types use file upload instead of an external URL field',()=>{
  const products=read('app/admin/products/page.tsx')
  const own=read('app/admin/own-products/page.tsx')
  for(const page of [products,own]){
    assert.match(page,/name="image_file"/)
    assert.match(page,/image\/jpeg,image\/png,image\/webp/)
    assert.doesNotMatch(page,/type="url" name="image_url"/)
    assert.match(page,/ProductImage/)
  }
  assert.match(products,/createProductWithImage/)
  assert.match(own,/upsertOwnProductWithImage/)
})

test('shared product image component is responsive and protects referrer data',()=>{
  const component=read('components/product-image.tsx')
  assert.match(component,/object-contain/)
  assert.match(component,/aspect-\[4\/3\]/)
  assert.match(component,/sm:h-20 sm:w-24/)
  assert.match(component,/referrerPolicy="no-referrer"/)
  assert.match(component,/loading=\{eager\?'eager':'lazy'\}/)
})

test('Pool keeps product master image as the source of truth',()=>{
  const pool=read('app/pool/page.tsx')
  assert.match(pool,/products\(id,name,brand,category,package_size,unit,image_url,source_type\)/)
  assert.match(pool,/product\?\.image_url/)
  assert.match(pool,/object-contain/)
  assert.match(pool,/aspect-\[4\/3\]/)
})

test('orders savings and admin Pool details carry the master product image',()=>{
  const orders=read('app/orders/page.tsx')
  const savings=read('app/savings/page.tsx')
  const adminPool=read('app/admin/pools/[id]/page.tsx')
  assert.match(orders,/products\(name,package_size,image_url\)/)
  assert.match(orders,/ProductImage/)
  assert.match(savings,/products\(name,package_size,image_url\)/)
  assert.match(savings,/ProductImage/)
  assert.match(adminPool,/source_type,image_url/)
  assert.match(adminPool,/ProductImage/)
})
