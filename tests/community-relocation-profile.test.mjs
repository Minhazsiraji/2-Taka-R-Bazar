import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=path=>readFileSync(path,'utf8')
test('relocation appears on the existing profile and requires an explicit residence declaration',()=>{
 const page=source('app/profile/page.tsx')
 assert.match(page,/action=\{moveMyCommunity\}/)
 assert.match(page,/Change community \/ কমিউনিটি পরিবর্তন/)
 assert.match(page,/name="community_id"/)
 assert.match(page,/name="address_hint"[^>]*required/)
 assert.match(page,/name="confirm_move" value="yes" required/)
 assert.match(page,/availableCommunities\?\.filter\(c=>c\.id!==profile\.community_id\)/)
})
test('relocation is bound to signed-in profile and clears stale pickup and location data',()=>{
 const src=source('app/actions/auth.ts')
 const move=src.split('export async function moveMyCommunity')[1].split('export async function updateProfile')[0]
 assert.match(move,/requireUser\(\)/)
 assert.match(move,/\.eq\('id',user\.id\)\.eq\('community_id',current\.community_id\)/)
 assert.match(move,/\.eq\('active',true\)/)
 assert.match(move,/pickup_point_id:null,google_maps_url:null/)
 assert.match(move,/confirm_move:z\.literal\('yes'\)/)
 assert.match(move,/revalidatePath\('\/',\s*'layout'\)/)
 assert.doesNotMatch(move,/service_role|supabaseAdmin|\bdelete\(/)
})
test('database protects active commitments, accepted quotes, and maintains private move audit',()=>{
 const sql=source('supabase/migrations/20261023095240_safe_household_community_relocation.sql')
 for(const marker of ['simple_sale_cycle_members','simple_sale_offer_joins','group_deal_commitments','simple_sale_cycle_quotes','private.profile_community_move_audit','new.pickup_point_id:=null','new.google_maps_url:=null','security definer set search_path', 'validate_cycle_member_current_community'])
   assert.ok(sql.includes(marker),marker)
 assert.match(sql,/revoke all on private\.profile_community_move_audit from public, anon, authenticated/)
 assert.doesNotMatch(sql,/drop table public\.|disable row level security|delete from auth\.users/i)
 const t=source('supabase/tests/community-relocation-guard.sql')
 assert.match(t,/rollback;/)
 assert.match(t,/Active commitment was transferred/)
 assert.match(t,/Former community membership could be forged/)
})
