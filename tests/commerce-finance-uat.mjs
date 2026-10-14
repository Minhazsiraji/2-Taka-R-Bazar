import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
if(!/^http:\/\/127\.0\.0\.1:54321\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL??''))throw new Error('Disposable database required');
const fixture=readFileSync('tests/supply-handover-e2e.sql','utf8').replace('\\ir finance-customer-lifecycle-e2e.sql',readFileSync('tests/finance-customer-lifecycle-e2e.sql','utf8')).replace(/rollback;\s*$/,readFileSync('tests/commerce-finance-e2e.sql','utf8')+'\nrollback;');
const result=execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:fixture,env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8'});
if(!result.includes('UNIFIED_COMMERCE_FINANCE_COD_RETURN_REFUND_E2E_PASS'))throw new Error('Full commerce/Finance bridge did not finish');console.log('PASS canonical checkout -> physical fulfillment -> COD custody -> independently posted sale -> Treasury receipt -> approved received return -> credit/restock -> independent cash refund; Production financial default-deny preserved');
