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
// Two real database sessions compete for the same spendable cash.
const requests=sql(asActor(maker,`select public.treasury_request_transaction('owner_draw','${bank}',null,null,null,60000,0,0,current_date,'RACE-DRAW-ONE','Synthetic concurrent draw one'); select public.treasury_request_transaction('owner_draw','${bank}',null,null,null,60000,0,0,current_date,'RACE-DRAW-TWO','Synthetic concurrent draw two')`))
const ids=sql("select id from public.treasury_transactions where external_reference in ('RACE-DRAW-ONE','RACE-DRAW-TWO') order by id").split('\n')
assert.equal(ids.length,2)
const results=await Promise.all(ids.map(id=>run(asActor(checker,`select public.treasury_review_transaction('${id}',true,'Independent simultaneous synthetic review')`))))
assert.equal(results.filter(r=>r.code===0).length,1,'Exactly one racing draw must post')
assert.match(results.find(r=>r.code!==0).error,/Insufficient unrestricted cash/)
assert.equal(sql("select count(*) from public.treasury_transactions where external_reference like 'RACE-DRAW-%' and status='posted'"),'1')
assert.equal(sql("select count(*) from public.finance_journals j join public.finance_journal_lines l on l.journal_id=j.id group by j.id having sum(l.debit)<>sum(l.credit)"),'')
console.log('CONCURRENT_CASH_SPEND_PASS one winner; loser retains pending request; no overdraw or imbalance')
// Same posted request cannot be approved again by a concurrent second session.
const posted=sql("select id from public.treasury_transactions where external_reference like 'RACE-DRAW-%' and status='posted'")
const replay=await run(asActor(checker,`select public.treasury_review_transaction('${posted}',true,'Synthetic duplicate review attempt')`))
assert.notEqual(replay.code,0);assert.match(replay.error,/not pending/)
console.log('CONCURRENT_REPLAY_PASS immutable one-post journal')
// Backup includes schema, RLS, grants, original audit history and financial rows.
// It stays in /tmp and is never uploaded as an Actions artifact.
mkdirSync('/tmp/issue57-restore',{recursive:true})
const dbContainer=execFileSync('docker',['ps','--filter','name=supabase_db_','--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n')[0]
assert.match(dbContainer,/^supabase_db_[a-zA-Z0-9_-]+$/)
const image=execFileSync('docker',['inspect','--format','{{.Config.Image}}',dbContainer],{encoding:'utf8'}).trim()
const backup='/tmp/issue57-restore/database.dump'
writeFileSync(backup,execFileSync('docker',['exec',dbContainer,'pg_dump','-U','postgres','-d','postgres','-Fc','--no-owner'],{stdio:'pipe'}))
const roles=execFileSync('docker',['exec',dbContainer,'pg_dumpall','-U','postgres','--roles-only'],{encoding:'utf8',stdio:'pipe'}).replace(/^CREATE ROLE postgres;\n/m,'')
writeFileSync('/tmp/issue57-restore/roles.sql',roles)
const fingerprint=`select md5(string_agg(row_hash,'' order by row_hash)) from (
 select md5(row_to_json(j)::text) row_hash from public.finance_journals j union all
 select md5(row_to_json(l)::text) from public.finance_journal_lines l union all
 select md5(row_to_json(a)::text) from public.audit_events a union all
 select md5(row_to_json(d)::text) from public.finance_document_attachments d union all
 select md5(row_to_json(e)::text) from public.finance_document_events e union all
 select md5(row_to_json(u)::text) from auth.users u) x`
const before=sql(fingerprint)
const restoreName='issue57-isolated-restore'
try{
 execFileSync('docker',['run','-d','--name',restoreName,'-e','POSTGRES_PASSWORD=postgres','-v','/tmp/issue57-restore:/restore:ro',image],{encoding:'utf8',stdio:'pipe'})
 let ready=false
 for(let i=0;i<45;i++){
  try{execFileSync('docker',['exec',restoreName,'pg_isready','-U','postgres'],{stdio:'pipe'});ready=true;break}catch{}
  await new Promise(r=>setTimeout(r,1000))
 }
 assert.ok(ready,'Isolated restore database did not become ready')
 execFileSync('docker',['exec',restoreName,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-f','/restore/roles.sql'],{stdio:'pipe'})
 execFileSync('docker',['exec',restoreName,'pg_restore','-U','postgres','-d','postgres','--no-owner','--exit-on-error','/restore/database.dump'],{stdio:'pipe'})
 const restored=s=>execFileSync('docker',['exec',restoreName,'psql','-U','postgres','-d','postgres','-tAX','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim()
 assert.equal(restored(fingerprint),before,'Restore changed financial rows, identities, original document metadata or audit history')
 assert.equal(restored("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'finance\\_%' escape '\\' and c.relkind='r' and not c.relrowsecurity"),'0')
 assert.equal(restored("select has_table_privilege('authenticated','public.finance_journals','INSERT')::text"),'false')
 console.log('ISOLATED_BACKUP_RESTORE_PASS exact financial/audit/document/auth fingerprint; RLS and financial privilege checks retained')
}finally{
 try{execFileSync('docker',['rm','-f',restoreName],{stdio:'pipe'})}catch{}
}
