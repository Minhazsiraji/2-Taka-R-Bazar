import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20261007100000_secure_group_deals_supplier_network.sql','utf8')
const customerPage=fs.readFileSync('app/group-deals/page.tsx','utf8')
const supplierPage=fs.readFileSync('app/supplier/page.tsx','utf8')
const geoComponent=fs.readFileSync('components/community-location-verifier.tsx','utf8')

test('Group Deals cannot unlock below five qualified buyers',()=>{
  assert.match(migration,/min_group_size integer not null default 5 check\(min_group_size>=5\)/i)
  assert.match(migration,/buyer_threshold integer not null check\(buyer_threshold>=5\)/i)
  assert.match(migration,/if p_min_group_size is null or p_min_group_size<5/i)
  assert.match(migration,/having count\(distinct gc\.customer_id\)>=5/i)
  assert.match(migration,/default 'forming' check\(status in \('forming','qualified','cancelled','fulfilled'\)\)/i)
  assert.match(migration,/v_circle_members>=v_deal\.min_group_size[\s\S]*set status='qualified'/i)
  assert.ok(migration.includes("coalesce(v_remaining,0)<v_min_group_size"))
  assert.match(migration,/set status='forming'/i)
  assert.match(customerPage,/A deal never unlocks below 5 qualified people/i)
})

test('nearby matching uses private precise locations without exposing coordinates',()=>{
  assert.match(migration,/private\.customer_location_verifications/i)
  assert.match(migration,/private\.group_circle_locations/i)
  assert.match(migration,/extensions\.geography\(Point,4326\)/i)
  assert.match(migration,/extensions\.st_distance/i)
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
  assert.match(supplierPage,/Customer names, phones, exact locations and individual baskets are never exposed/i)
})

test('new tables and RPCs remain fail-closed by default',()=>{
  assert.match(migration,/alter table public\.group_deals enable row level security/i)
  assert.match(migration,/alter table public\.group_deal_commitments enable row level security/i)
  assert.match(migration,/revoke all on function public\.join_group_deal\(uuid,integer\) from public,anon,authenticated,service_role/i)
  assert.match(migration,/grant execute on function public\.join_group_deal\(uuid,integer\) to authenticated/i)
  assert.match(migration,/alter default privileges for role postgres in schema public[\s\S]*revoke select,insert,update,delete on tables from anon,authenticated,service_role/i)
})
