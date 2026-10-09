import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20261007100000_secure_group_deals_supplier_network.sql','utf8')
const customerPage=fs.readFileSync('app/group-deals/page.tsx','utf8')
const supplierPage=fs.readFileSync('app/supplier/page.tsx','utf8')
const geoComponent=fs.readFileSync('components/community-location-verifier.tsx','utf8')
const groupActions=fs.readFileSync('app/actions/group-deals.ts','utf8')
const runtimeFix=fs.readFileSync('supabase/migrations/20261007143000_group_location_uat_supplier_fix.sql','utf8')
const joinAmbiguityFix=fs.readFileSync('supabase/migrations/20261007150000_join_group_deal_column_ambiguity_fix.sql','utf8')
const groupProgress=fs.readFileSync('components/group-deal-unlock-progress.tsx','utf8')
const nextConfig=fs.readFileSync('next.config.ts','utf8')
const autoCloseMigration=fs.readFileSync('supabase/migrations/20261009093000_group_deal_auto_close_contact.sql','utf8')
const adminPage=fs.readFileSync('app/admin/group-deals/page.tsx','utf8')

test('Group Deals cannot unlock below five qualified buyers',()=>{
  assert.match(migration,/min_group_size integer not null default 5 check\(min_group_size>=5\)/i)
  assert.match(migration,/buyer_threshold integer not null check\(buyer_threshold>=5\)/i)
  assert.match(migration,/if p_min_group_size is null or p_min_group_size<5/i)
  assert.match(migration,/having count\(distinct gc\.customer_id\)>=5/i)
  assert.match(migration,/default 'forming' check\(status in \('forming','qualified','cancelled','fulfilled'\)\)/i)
  assert.match(migration,/v_circle_members>=v_deal\.min_group_size[\s\S]*set status='qualified'/i)
  assert.ok(migration.includes("coalesce(v_remaining,0)<v_min_group_size"))
  assert.match(migration,/set status='forming'/i)
  assert.match(migration,/circle_below_minimum_at_lock/i)
  assert.match(migration,/Deal cannot be locked before the advertised close time/i)
  assert.match(migration,/Cancellation reason required/i)
  assert.match(customerPage,/One verified person counts once/i)
})

test('nearby matching uses private precise locations without exposing coordinates',()=>{
  assert.match(migration,/private\.customer_location_verifications/i)
  assert.match(migration,/private\.group_circle_locations/i)
  assert.match(migration,/extensions\.geography\(Point,4326\)/i)
  assert.match(migration,/extensions\.st_distance/i)
  assert.match(migration,/circle_radius_m integer not null default 750 check\(circle_radius_m between 100 and 3000\)/i)
  assert.equal((migration.match(/extensions\.st_dwithin\(gl\.anchor_location,v_location,v_deal\.circle_radius_m\)/gi)??[]).length,2)
  assert.match(migration,/revoke all on table private\.customer_location_verifications from public,anon,authenticated,service_role/i)
  assert.doesNotMatch(supplierPage,/latitude|longitude|address_hint|google_maps_url/i)
  assert.match(geoComponent,/Other customers and suppliers never receive your coordinates/i)
})

test('location and group joins have server-side rate and risk gates',()=>{
  assert.match(migration,/event_type='location_verify'.*created_at>now\(\)-interval '1 hour'/is)
  assert.match(migration,/if v_attempts>12/i)
  assert.match(migration,/event_type='group_join'.*created_at>now\(\)-interval '1 hour'/is)
  assert.match(migration,/if v_attempts>20/i)
  assert.match(migration,/v_trust='blocked' or v_risk>=70/i)
  assert.match(migration,/v_trust='restricted' or v_risk>=50/i)
})

test('supplier access is product-scoped and aggregate-only',()=>{
  assert.match(migration,/create table if not exists public\.supplier_memberships/i)
  assert.match(migration,/create table if not exists public\.supplier_products/i)
  assert.match(migration,/join public\.supplier_products sp on sp\.supplier_id=sm\.supplier_id and sp\.active/i)
  assert.match(migration,/get_supplier_open_demand/i)
  assert.match(migration,/having count\(distinct c\.customer_id\)>=5/i)
  assert.match(migration,/o\.status='completed' and coalesce\(o\.completed_at,o\.created_at\)::date=d\.day/i)
  assert.match(supplierPage,/Customer names, phones, exact locations and individual baskets are never exposed/i)
})

test('new tables and RPCs remain fail-closed by default',()=>{
  assert.match(migration,/alter table public\.group_deals enable row level security/i)
  assert.match(migration,/alter table public\.group_deal_commitments enable row level security/i)
  assert.match(migration,/revoke all on function public\.join_group_deal\(uuid,integer\) from public,anon,authenticated,service_role/i)
  assert.match(migration,/grant execute on function public\.join_group_deal\(uuid,integer\) to authenticated/i)
  assert.match(migration,/grant execute on function private\.is_ops\(uuid\) to authenticated/i)
  assert.match(migration,/d\.status in \('open','locked','procurement','fulfilling','completed'\)/i)
  assert.match(migration,/private\.can_read_group_deal\(p_deal uuid\)[\s\S]*as \$\$[\s\S]*\$\$;/i)
  assert.match(migration,/alter default privileges for role postgres in schema public[\s\S]*revoke select,insert,update,delete on tables from anon,authenticated,service_role/i)
})


test('preview UAT fallback is demo-only and cannot qualify live deals',()=>{
  assert.match(runtimeFix,/verification_scope in \('all','demo_only'\)/i)
  assert.match(runtimeFix,/admin_verify_my_uat_location/i)
  assert.match(runtimeFix,/p\.is_demo/i)
  assert.match(runtimeFix,/'admin-uat-preview','demo_only'/i)
  assert.match(runtimeFix,/Secure device GPS verification is required for live Group Deals/i)
  assert.match(groupActions,/process\.env\.VERCEL_ENV!=='preview'/i)
  assert.match(geoComponent,/Admin UAT fallback/i)
})

test('desktop geolocation diagnostics retry safely without weakening server proof',()=>{
  assert.match(geoComponent,/enableHighAccuracy:true/i)
  assert.match(geoComponent,/enableHighAccuracy:false/i)
  assert.match(geoComponent,/navigator\.permissions\.query\(\{name:'geolocation'\}\)/i)
  assert.match(geoComponent,/Location permission is allowed, but this device could not provide a usable position/i)
  assert.match(runtimeFix,/values\(v_user,v_community,v_point,p_accuracy_m,v_distance,'gps-community','all'/i)
})

test('supplier open demand UNION is wrapped before ordering',()=>{
  assert.match(runtimeFix,/combined as \(/i)
  assert.match(runtimeFix,/from combined c\s+order by c\.closes_at/is)
})


test('join_group_deal qualifies commitment columns that collide with RETURNS TABLE names',()=>{
  assert.match(joinAmbiguityFix,/select gc\.id,gc\.circle_id,gc\.status into v_commitment,v_circle,v_existing_status/i)
  assert.match(joinAmbiguityFix,/where gc\.circle_id=v_circle and gc\.status in \('forming','qualified'\)/i)
  assert.match(joinAmbiguityFix,/update public\.group_deal_commitments gc[\s\S]*where gc\.circle_id=v_circle and gc\.status='forming'/i)
  assert.doesNotMatch(joinAmbiguityFix,/select id,circle_id,status into/i)
})


test('Group Deal UI shows compact buyer progress toward the next price tier',()=>{
  assert.match(groupProgress,/First unlock/i)
  assert.match(groupProgress,/progressBuyers\/nextThreshold/i)
  assert.match(groupProgress,/more →/i)
  assert.match(groupProgress,/price-target-track/i)
  assert.match(groupProgress,/Each verified person counts once/i)
  assert.match(customerPage,/unlockProgressBuyers=buyers===0&&joined/i)
  assert.match(customerPage,/unlockBuyersNeeded=next\?Math\.max\(next-unlockProgressBuyers,0\):0/i)
  assert.match(customerPage,/Invite neighbours/i)
})

test('mobile Group Deal location requests automatically once when verification is needed',()=>{
  assert.match(geoComponent,/useEffect/i)
  assert.match(geoComponent,/Android\|iPhone\|iPad\|iPod\|Mobile/i)
  assert.match(geoComponent,/pointer: coarse/i)
  assert.match(geoComponent,/2tbr-group-location-auto-requested-v1/i)
  assert.match(geoComponent,/await verify\(true\)/i)
  assert.match(geoComponent,/sessionStorage/i)
  assert.match(customerPage,/location\?\.verified[\s\S]*Community location verified/i)
  assert.match(customerPage,/initialVerified=\{false\}/i)
})


test('security headers allow only same-origin geolocation while camera and microphone stay blocked',()=>{
  assert.match(nextConfig,/camera=\(\), microphone=\(\), geolocation=\(self\)/i)
  assert.doesNotMatch(nextConfig,/geolocation=\(\)/i)
})


test('expired Group Deals auto-lock or auto-cancel at the minimum buyer threshold',()=>{
  assert.match(autoCloseMigration,/create or replace function private\.process_expired_group_deals/i)
  assert.match(autoCloseMigration,/where status='open' and closes_at<=now\(\)/i)
  assert.match(autoCloseMigration,/if v_buyers<d\.min_group_size then/i)
  assert.match(autoCloseMigration,/cancellation_reason=v_reason/i)
  assert.match(autoCloseMigration,/Minimum buyer threshold not reached/i)
  assert.match(autoCloseMigration,/status='locked'/i)
  assert.match(autoCloseMigration,/locked_buyer_count=v_buyers/i)
  assert.match(autoCloseMigration,/locked_unit_price=v_price/i)
  assert.match(autoCloseMigration,/cron\.schedule\([\s\S]*'2taka-group-deal-expiry'[\s\S]*'\* \* \* \* \*'/i)
})

test('failed Group Deal customers are notified and can ask to buy at the initial price',()=>{
  assert.match(autoCloseMigration,/group_deal_minimum_not_reached/i)
  assert.match(autoCloseMigration,/No order was created and no payment is due/i)
  assert.match(autoCloseMigration,/request_failed_group_deal_initial_price/i)
  assert.match(autoCloseMigration,/requested_unit_price[\s\S]*v_deal\.market_price_snapshot/i)
  assert.match(autoCloseMigration,/group_deal_purchase_requests/i)
  assert.match(customerPage,/get_my_failed_group_deals/i)
  assert.match(customerPage,/I still want this product/i)
  assert.match(customerPage,/minimum verified-buyer threshold was not reached/i)
})

test('failed-deal purchase requests create an admin follow-up queue and notifications',()=>{
  assert.match(autoCloseMigration,/admin_get_group_deal_purchase_requests/i)
  assert.match(autoCloseMigration,/admin_set_group_deal_purchase_request_status/i)
  assert.match(autoCloseMigration,/group_deal_purchase_request/i)
  assert.match(autoCloseMigration,/ur\.role in \('admin','super_admin'\)/i)
  assert.match(adminPage,/Customers who still want the product/i)
  assert.match(adminPage,/customer_phone/i)
  assert.match(adminPage,/Contacted/i)
  assert.match(adminPage,/Closed/i)
})
