import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../supabase/migrations/20261022084050_simple_offer_confirmed_progress.sql',import.meta.url),'utf8');
const action=readFileSync(new URL('../app/actions/simple-offers.ts',import.meta.url),'utf8');
const form=readFileSync(new URL('../components/admin-simple-offer-form.tsx',import.meta.url),'utf8');
const read=readFileSync(new URL('../lib/simple-offers.ts',import.meta.url),'utf8');
test('confirmed count never includes draft carts or pending requests',()=>{
 assert.match(migration,/ord\.status='confirmed'/);
 assert.match(migration,/ord\.status='requested'/);
 assert.match(migration,/count\(distinct ord\.customer_id\)/);
 assert.match(migration,/'buyer_count',counts\.buyers/);
 assert.match(migration,/'pending_buyers',counts\.pending_buyers/);
 assert.match(migration,/'buyer_target',o\.buyer_target/);
 assert.doesNotMatch(migration,/localStorage|cart-updated/);
});
test('published buyer targets have the approved minimum and no fabricated Pool milestone',()=>{
 assert.match(migration,/UPDATE public\.simple_sale_offers SET buyer_target=5/);
 assert.match(migration,/WHERE kind='GROUP_DEAL' AND buyer_target IS NULL/);
 assert.match(migration,/p_kind='GROUP_DEAL' AND \(p_target IS NULL OR p_target NOT BETWEEN 5 AND 100000\)/);
 assert.match(migration,/p_kind='SOLO' AND p_target IS NOT NULL/);
 assert.match(form,/Participation target · confirmed buyers/);
 assert.match(form,/required=\{kind==='GROUP_DEAL'\}/);
 assert.match(read,/buyer_target\?:number\|null/);
});
test('admin save is atomic and respects existing community and price checks',()=>{
 assert.match(action,/admin_save_simple_offer_with_target/);
 assert.match(action,/p_target:kind==='SOLO'\?null:buyerTarget/);
 assert.match(migration,/oid:=public\.admin_save_simple_offer_areas\(/);
 assert.match(migration,/private\.has_role\(u,'super_admin'\)/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.admin_save_simple_offer_with_target/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.admin_save_simple_offer_with_target[^;]*TO authenticated/);
});
