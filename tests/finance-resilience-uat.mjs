// Executed only against disposable local Supabase. Never a hosted DB.
import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
const args=['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tAX']
const env={...process.env,PGPASSWORD:'postgres'}
if(process.env.ISSUE57_DISPOSABLE_DB!=='true')throw new Error('Disposable DB qualification opt-in required')
const sql=s=>execFileSync('psql',[...args,'-c',s],{env,encoding:'utf8'}).trim()
// Seed a fully asserted chain, retaining synthetic data only in the disposable DB.
const fixture=readFileSync('tests/supply-handover-e2e.sql','utf8').replace('\\ir finance-customer-lifecycle-e2e.sql','\\i tests/finance-customer-lifecycle-e2e.sql').replace(/rollback;\s*$/,'set constraints all immediate; commit;')
execFileSync('psql',args,{input:fixture,env,encoding:'utf8',stdio:['pipe','pipe','pipe']})
const maker='a0000000-0000-0000-0000-000000000001',checker='a0000000-0000-0000-0000-000000000002'
const bank=sql("select id from public.treasury_accounts where name='Synthetic Supplier Bank'")
assert.match(bank,/^[0-9a-f-]{36}$/)
const run=s=>new Promise(resolve=>{
 const child=spawn('psql',[...args,'-c',s],{env});let out='',error=''
 child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>error+=b)
 child.on('close',code=>resolve({code,out,error}))
})
function asActor(actor,s){return `begin; select set_config('request.jwt.claim.sub','${actor}',true); ${s}; set constraints all immediate; commit;`}
const lastUuid=out=>out.split('\n').map(v=>v.trim()).filter(v=>/^[0-9a-f-]{36}$/.test(v)).at(-1)
// Two real database sessions compete to reserve the same spendable cash at request creation.
const raceBank=lastUuid(sql(asActor(checker,`select public.treasury_create_account('Request Reservation Race Bank','bank','Synthetic','9001',current_date,100000,'RACE-OPEN-100K',0,null)`)))
assert.match(raceBank,/^[0-9a-f-]{36}$/)
const requestRace=await Promise.all(['ONE','TWO'].map(suffix=>run(asActor(maker,`select public.treasury_request_transaction('owner_draw','${raceBank}',null,null,null,60000,0,0,current_date,'RACE-DRAW-${suffix}','Synthetic concurrent draw ${suffix}')`))))
assert.equal(requestRace.filter(r=>r.code===0).length,1,'Only one racing request may reserve insufficient shared cash')
assert.match(requestRace.find(r=>r.code!==0).error,/Insufficient unrestricted cash/)
assert.equal(sql("select count(*) from public.treasury_transactions where external_reference like 'RACE-DRAW-%' and status='pending'"),'1')
const pending=sql("select id from public.treasury_transactions where external_reference like 'RACE-DRAW-%' and status='pending'")
assert.match(pending,/^[0-9a-f-]{36}$/)
sql(asActor(checker,`select public.treasury_review_transaction('${pending}',true,'Independent synthetic review after request-time reservation')`))
assert.equal(sql("select count(*) from public.treasury_transactions where external_reference like 'RACE-DRAW-%' and status='posted'"),'1')
assert.equal(sql("select count(*) from public.finance_journals j join public.finance_journal_lines l on l.journal_id=j.id group by j.id having sum(l.debit)<>sum(l.credit)"),'')
console.log('CONCURRENT_CASH_RESERVATION_PASS one request queued; competing request rejected before approval')
// Same posted request cannot be approved again by a concurrent second session.
const posted=sql("select id from public.treasury_transactions where external_reference like 'RACE-DRAW-%' and status='posted'")
const replay=await run(asActor(checker,`select public.treasury_review_transaction('${posted}',true,'Synthetic duplicate review attempt')`))
assert.notEqual(replay.code,0);assert.match(replay.error,/not pending/)
console.log('CONCURRENT_REPLAY_PASS immutable one-post journal')
// Approval still rechecks posted cash if the balance changes after a valid request.
const staleBank=lastUuid(sql(asActor(checker,`select public.treasury_create_account('Stale Approval Guard Bank','bank','Synthetic','9002',current_date,1000,'STALE-OPEN-1K',0,null)`)))
assert.match(staleBank,/^[0-9a-f-]{36}$/)
const staleLedger=sql(`select ledger_code from public.treasury_accounts where id='${staleBank}'`)
const staleRequest=lastUuid(sql(asActor(maker,`select public.treasury_request_transaction('owner_draw','${staleBank}',null,null,null,800,0,0,current_date,'STALE-BALANCE-REQ','Valid when submitted, stale before approval')`)))
assert.match(staleRequest,/^[0-9a-f-]{36}$/)
sql(asActor(checker,`select private.treasury_post('STALE-BALANCE-DRAIN',gen_random_uuid(),current_date,'Synthetic posted drain after request',jsonb_build_array(jsonb_build_object('account','3200','debit',300),jsonb_build_object('account','${staleLedger}','credit',300)),auth.uid())`))
const staleReview=await run(asActor(checker,`select public.treasury_review_transaction('${staleRequest}',true,'Independent stale-balance approval attempt')`))
assert.notEqual(staleReview.code,0);assert.match(staleReview.error,/Insufficient unrestricted cash/)
assert.equal(sql(`select status||':'||coalesce(journal_id::text,'none') from public.treasury_transactions where id='${staleRequest}'`),'pending:none')
console.log('STALE_BALANCE_APPROVAL_GUARD_PASS valid request later rejected after posted cash changed')
// Reservations must serialize before approval, across two actual connections.
const unpaidBill=sql("select id from public.procurement_supplier_bills where invoice_reference='DIRECT-SUPPLIER-INVOICE-4000'")
assert.match(unpaidBill,/^[0-9a-f-]{36}$/)
const payableRace=await Promise.all(['ONE','TWO'].map(suffix=>run(asActor(maker,`select public.treasury_request_supplier_payment('${unpaidBill}','${bank}','RACE-SUPPLIER-${suffix}',current_date,3000)`))))
assert.equal(payableRace.filter(r=>r.code===0).length,1,'Pending payments must reserve AP atomically')
assert.match(payableRace.find(r=>r.code!==0).error,/exceeds unreserved payable/)
console.log('CONCURRENT_SUPPLIER_RESERVATION_PASS one request reserves AP; overpayment denied before posting')
const originalSale=sql("select id from public.finance_customer_events where source_id='f5000000-0000-4000-8000-000000000001' and kind='sale'")
sql(`insert into storage.objects(bucket_id,name) values('finance-evidence','${maker}/race-credit.pdf')`)
const creditRace=await Promise.all(['ONE','TWO'].map(suffix=>run(asActor(maker,`select public.finance_request_customer_credit('${originalSale}','[{"line_index":1,"quantity":1}]',0,true,current_date,'Synthetic simultaneous remaining unit return ${suffix}','${maker}/race-credit.pdf','${'f'.repeat(64)}')`))))
assert.equal(creditRace.filter(r=>r.code===0).length,1,'The remaining sold unit cannot be reserved twice')
assert.match(creditRace.find(r=>r.code!==0).error,/exceeds uncredited sold quantity/)
console.log('CONCURRENT_CUSTOMER_RETURN_PASS one remaining sold unit reserved; duplicate return denied')
// Posting and close contend on the same month lock in two real sessions.
sql("insert into public.user_roles(user_id,role) values('a0000000-0000-0000-0000-000000000001','super_admin') on conflict do nothing")
sql(asActor(checker,"select public.finance_request_period_close('2002-01-01','Synthetic simultaneous close and posting qualification','')"))
const closeId=sql("select id from public.finance_period_close_requests where month_start='2002-01-01'")
const closing=await Promise.all([
 run(asActor(maker,`select public.finance_review_period_close('${closeId}',true,'Independent unchanged ended month snapshot checked')`)),
 run(asActor(checker,"select private.treasury_post('CONCURRENT-CLOSE-POST',gen_random_uuid(),'2002-01-15','Synthetic posting versus close race',jsonb_build_array(jsonb_build_object('account','1100','debit',1),jsonb_build_object('account','4000','credit',1)),auth.uid())"))])
// Fixture maker is admin; assign Super Admin only in this disposable DB for close review.
assert.equal(closing.filter(r=>r.code===0).length,1,'Only close or competing posting may qualify')
assert.match(closing.find(r=>r.code!==0).error,/Finance period is locked|Period sources changed/)
console.log('CONCURRENT_PERIOD_CLOSE_PASS serialized month posting; snapshot change or locked period rejects loser')
// Backup includes schema, RLS, grants, original audit history and financial rows.
// It stays in /tmp and is never uploaded as an Actions artifact.
mkdirSync('/tmp/issue57-restore',{recursive:true})
const dbContainer=execFileSync('docker',['ps','--filter','name=supabase_db_','--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n')[0]
assert.match(dbContainer,/^supabase_db_[a-zA-Z0-9_-]+$/)
const image=execFileSync('docker',['inspect','--format','{{.Config.Image}}',dbContainer],{encoding:'utf8'}).trim()
const backup='/tmp/issue57-restore/database.dump'
writeFileSync(backup,execFileSync('docker',['exec',dbContainer,'pg_dump','-U','postgres','-d','postgres','-Fc','--no-owner'],{stdio:'pipe',maxBuffer:256*1024*1024}))
const roles=execFileSync('docker',['exec',dbContainer,'pg_dumpall','-U','postgres','--roles-only'],{encoding:'utf8',stdio:'pipe'}).replace(/^CREATE ROLE postgres;\n/m,'')
writeFileSync('/tmp/issue57-restore/roles.sql',roles)
const fingerprintTables=sql("select n.nspname||'.'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and ((n.nspname='public' and (c.relname like 'finance\\_%' escape '\\' or c.relname like 'treasury\\_%' escape '\\' or c.relname in ('audit_events','procurement_purchase_orders','procurement_dispatch_links','procurement_supplier_bills','own_product_inventory','own_product_inventory_movements','user_roles'))) or (n.nspname='private' and c.relname in ('finance_uat_leases','finance_uat_entities')) or (n.nspname='auth' and c.relname='users') or (n.nspname='storage' and c.relname='objects')) order by 1").split('\n')
assert.ok(fingerprintTables.length>=25)
const fingerprint="select md5(string_agg(row_hash,'' order by row_hash)) from ("+fingerprintTables.map(table=>"select md5('"+table+"'||row_to_json(t)::text) row_hash from "+table+" t").join(' union all ')+") x"
const before=sql(fingerprint)
const restoreName='issue57-isolated-restore'
try{
 execFileSync('docker',['run','-d','--network','none','--name',restoreName,'-e','POSTGRES_PASSWORD=postgres','-v','/tmp/issue57-restore:/restore:ro',image],{encoding:'utf8',stdio:'pipe'})
 let ready=false
 for(let i=0;i<45;i++){
  try{execFileSync('docker',['exec',restoreName,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'pipe'});ready=true;break}catch{}
  await new Promise(r=>setTimeout(r,1000))
 }
 assert.ok(ready,'Isolated restore database did not become ready')
 const existingRoles=execFileSync('docker',['exec',restoreName,'psql','-U','supabase_admin','-d','postgres','-tAX','-c','select rolname from pg_roles'],{encoding:'utf8'}).trim().split('\n')
 const roleRestore=roles.split('\n').filter(line=>!existingRoles.some(role=>line==='CREATE ROLE '+role+';'||line==='CREATE ROLE "'+role+'";')).join('\n')
 execFileSync('docker',['exec','-i',restoreName,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:roleRestore,stdio:['pipe','pipe','pipe']})
 execFileSync('docker',['exec',restoreName,'createdb','-U','supabase_admin','-T','template0','issue57_restore'],{stdio:'pipe'})
 // pg_cron is bound to one database name at server startup. Restore its real
 // schema too, using the isolated server's target DB rather than excluding it.
 execFileSync('docker',['exec',restoreName,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',"alter system set cron.database_name='issue57_restore'"],{stdio:'pipe'})
 execFileSync('docker',['restart',restoreName],{stdio:'pipe'})
 ready=false
 for(let i=0;i<45;i++){
  try{execFileSync('docker',['exec',restoreName,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'pipe'});ready=true;break}catch{}
  await new Promise(r=>setTimeout(r,1000))
 }
 assert.ok(ready,'Isolated restore database did not restart with cron configuration')
 // template0 supplies the standard public namespace; pg_dump may omit its
 // CREATE statement. Keep that empty namespace for the restored public objects.
 execFileSync('docker',['exec',restoreName,'pg_restore','-U','supabase_admin','-d','issue57_restore','--no-owner','--exit-on-error','/restore/database.dump'],{stdio:'pipe'})
 const restored=s=>execFileSync('docker',['exec',restoreName,'psql','-U','supabase_admin','-d','issue57_restore','-tAX','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim()
 assert.equal(restored(fingerprint),before,'Restore changed financial rows, identities, original document metadata or audit history')
 assert.equal(restored("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'finance\\_%' escape '\\' and c.relkind='r' and not c.relrowsecurity"),'0')
 assert.equal(restored("select has_table_privilege('authenticated','public.finance_journals','INSERT')::text"),'false')
 console.log('ISOLATED_BACKUP_RESTORE_PASS exact financial/audit/document/auth fingerprint; RLS and financial privilege checks retained')
}finally{
 try{execFileSync('docker',['rm','-f',restoreName],{stdio:'pipe'})}catch{}
}
