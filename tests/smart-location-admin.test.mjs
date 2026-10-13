import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261013113000_delivery_location_admin_review.sql','utf8');
const attach=readFileSync('supabase/migrations/20261013114500_attach_confirmed_order_address.sql','utf8');
const actions=readFileSync('app/actions/delivery-location-admin.ts','utf8');
const page=readFileSync('app/admin/delivery-locations/page.tsx','utf8');
const customer=readFileSync('app/actions/customer.ts','utf8');
test('only authenticated admin roles may review personal delivery locations',()=>{
 assert.match(sql,/role in \('admin','super_admin'\)/);
 assert.match(sql,/admin_list_delivery_address_reviews/);
 assert.match(sql,/not private\.is_delivery_location_admin\(\)/);
 assert.match(sql,/revoke all on public\.delivery_location_review_audit from public,anon,authenticated/);
 assert.match(actions,/requireAdmin\(\)/);
});
test('admin verification is evidence-backed, cross-community and self-verification blocked',()=>{
 assert.match(sql,/length\(v_note\) not between 10 and 500/);
 assert.match(sql,/v_address\.customer_id=auth\.uid\(\)/);
 assert.match(sql,/community_id=v_address\.community_id/);
 assert.match(sql,/verification_status='operator_verified'/);
 assert.match(sql,/delivery_location_review_audit/);
 assert.match(page,/Match to verified building/);
});
test('only a matching confirmed home-delivery order can link owned address',()=>{
 assert.match(attach,/c\.status='confirmed'/);
 assert.match(attach,/o\.customer_id=v_uid/);
 assert.match(attach,/a\.customer_id=v_uid/);
 assert.match(attach,/a\.community_id=p\.community_id/);
 assert.match(attach,/o\.delivery_address=a\.address_text/);
 assert.match(attach,/o\.fulfillment_method='home_delivery'/);
 assert.match(customer,/attach_my_delivery_address_to_order/);
});
