import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const guest=readFileSync('components/public-marketplace.tsx','utf8');
const qr=readFileSync('app/community-invite/[code]/page.tsx','utf8');
const checkout=readFileSync('components/fulfillment-choice.tsx','utf8');
const action=readFileSync('app/actions/customer.ts','utf8');
const sql=readFileSync('supabase/migrations/20261013110000_smart_location_saved_addresses.sql','utf8');

test('guest browsing never launches location prompt during initial render',()=>{
 assert.doesNotMatch(guest,/initialLocationRequested/);
 assert.doesNotMatch(guest,/useEffect\(\(\)=>\{[^}]*useLocation\(\)/);
 assert.match(guest,/onClick=\{useLocation\}/);
 assert.match(guest,/2tbr-browsing-area-v1/);
 assert.match(qr,/Browse community offers without signing in/);
});
test('only server-published community identifiers are accepted for QR and preferences',()=>{
 const page=readFileSync('app/page.tsx','utf8');
 assert.match(page,/areas\.some\(a=>a\.community_id===requestedArea\)/);
 assert.match(guest,/pickStoredBrowsingArea/);
});
test('address saved after explicit home-delivery checkout and rejected GPS is not bundled',()=>{
 assert.match(checkout,/name="save_address"/);
 assert.match(checkout,/name="building_label"/);
 assert.match(checkout,/name="delivery_address_id"/);
 assert.match(action,/\.eq\('customer_id',user\.id\)/);
 assert.match(action,/p_delivery_address: deliveryAddress/);
 assert.match(action,/save_my_delivery_address/);
});
test('address writes are restricted, customer cannot forge verified building or bundle',()=>{
 assert.match(sql,/alter table public\.customer_delivery_addresses enable row level security/i);
 assert.match(sql,/revoke all on public\.customer_delivery_addresses from public,anon,authenticated/i);
 assert.match(sql,/customer_delivery_addresses_own_read/i);
 assert.match(sql,/verification_status.*customer_confirmed/s);
 assert.match(sql,/if auth\.role\(\) <> 'service_role'/i);
 assert.match(sql,/a\.verification_status='operator_verified'/i);
 assert.match(sql,/b\.verified_at is not null/i);
 assert.match(sql,/p_delivery_date date/i);
 assert.match(sql,/for update/i);
});
