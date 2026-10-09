'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, requireSuperAdmin } from '@/lib/auth'

// An ordinary Vercel Preview URL may inherit the live Supabase connection.
// Refuse ALL writes unless explicitly connected to a separate, approved finance test database.
export function requireIsolatedTreasuryDatabase() {
  const current = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const approved = process.env.FINANCE_PREVIEW_SUPABASE_URL ?? ''
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.FINANCE_WRITES_ENABLED !== 'true' ||
      !current || !approved || current !== approved ||
      current.includes('sukabonfjcnaavjgjyuy')) {
    throw new Error('Treasury writes locked: an isolated Preview Supabase database is required.')
  }
}

const get = (fd:FormData,name:string) => String(fd.get(name)??'').trim()
const blank = (fd:FormData,name:string) => get(fd,name)||null
function amount(fd:FormData,key:string) {
 const s=get(fd,key)
 const v=s===''?0:Number(s)
 if (!Number.isFinite(v)) throw new Error('Invalid number: '+key)
 return v
}
function done(where:string,message:string,kind:'notice'|'error'='notice'):never {
 revalidatePath('/super-admin/treasury')
 revalidatePath('/super-admin/finance')
 redirect(where+(where.includes('?')?'&':'?')+kind+'='+encodeURIComponent(message))
}
const owner='/super-admin/treasury'
const maker='/admin/treasury'
const err=(e:unknown)=>e instanceof Error?e.message:'Treasury request failed'

export async function treasuryAddAccount(fd:FormData) {
 const {supabase}=await requireSuperAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_create_account',{
   p_name:get(fd,'name'),p_kind:get(fd,'account_kind'),
   p_institution:get(fd,'institution'),p_last_four:get(fd,'last_four')||null,
   p_open_date:get(fd,'opened_on'),p_opening_balance:amount(fd,'opening_balance'),
   p_opening_reference:get(fd,'opening_reference'),
   p_restricted:amount(fd,'restricted_amount'),
   p_credit_limit:blank(fd,'credit_limit')?amount(fd,'credit_limit'):null,
  })
  if(error)throw new Error(error.message)
 } catch(e){errorMessage=err(e)}
 if(errorMessage)done(owner,errorMessage,'error')
 done(owner,'Account registered and opening journal posted')
}

export async function treasuryAddFacility(fd:FormData) {
 const {supabase}=await requireSuperAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_create_facility',{
   p_lender:get(fd,'lender'),p_kind:get(fd,'facility_kind'),
   p_principal:amount(fd,'original_principal'),
   p_opening_outstanding:amount(fd,'opening_outstanding'),
   p_apr:amount(fd,'interest_apr'),p_due_day:blank(fd,'due_day')?Number(get(fd,'due_day')):null,
   p_maturity:blank(fd,'maturity_date'),p_open_date:get(fd,'opened_on'),
   p_agreement_reference:get(fd,'agreement_reference')
  })
  if(error)throw new Error(error.message)
 } catch(e){errorMessage=err(e)}
 if(errorMessage)done(owner,errorMessage,'error')
 done(owner,'Loan or borrowing facility registered')
}

export async function treasurySubmitTransaction(fd:FormData) {
 const {supabase}=await requireAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_request_transaction',{
   p_kind:get(fd,'kind'),p_source:blank(fd,'source_account_id'),p_target:blank(fd,'target_account_id'),
   p_facility:blank(fd,'facility_id'),p_expense:blank(fd,'expense_id'),
   p_amount:amount(fd,'amount'),p_interest:amount(fd,'interest_amount'),
   p_fee:amount(fd,'fee_amount'),p_date:get(fd,'business_date'),
   p_reference:get(fd,'external_reference'),p_memo:get(fd,'memo')
  })
  if(error)throw new Error(error.message)
 }catch(e){errorMessage=err(e)}
 const path=get(fd,'return_path')===owner?owner:maker
 if(errorMessage)done(path,errorMessage,'error')
 done(path,'Transaction submitted for independent financial review')
}

export async function treasuryReviewTransaction(fd:FormData) {
 const {supabase}=await requireSuperAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_review_transaction',{
   p_id:get(fd,'transaction_id'),p_approve:get(fd,'decision')==='approve',
   p_note:get(fd,'note')
  })
  if(error)throw new Error(error.message)
 }catch(e){errorMessage=err(e)}
 if(errorMessage)done(owner,errorMessage,'error')
 done(owner,'Treasury review recorded; approved entries remain bank-unreconciled until matched')
}

export async function treasuryImportStatement(fd:FormData) {
 const {supabase}=await requireAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_import_statement_line',{
   p_account:get(fd,'account_id'),p_external_id:get(fd,'external_line_id'),
   p_date:get(fd,'statement_date'),p_amount:amount(fd,'signed_amount'),
   p_reference:get(fd,'reference')
  })
  if(error)throw new Error(error.message)
 }catch(e){errorMessage=err(e)}
 const path=get(fd,'return_path')===owner?owner:maker
 if(errorMessage)done(path,errorMessage,'error')
 done(path,'Statement line imported as unmatched — independent review required')
}

export async function treasuryMatchStatement(fd:FormData) {
 const {supabase}=await requireSuperAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_match_statement',{
   p_line_id:get(fd,'statement_id'),p_transaction_id:get(fd,'transaction_id'),
   p_note:blank(fd,'note')
  })
  if(error)throw new Error(error.message)
 }catch(e){errorMessage=err(e)}
 if(errorMessage)done(owner,errorMessage,'error')
 done(owner,'Statement line matched to posted ledger transaction')
}

export async function treasuryAddForecast(fd:FormData) {
 const {supabase}=await requireSuperAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_create_forecast',{
   p_date:get(fd,'due_date'),p_amount:amount(fd,'expected_cash_change'),
   p_kind:get(fd,'event_kind'),p_description:get(fd,'description'),
   p_reference:get(fd,'source_reference'),p_confidence:get(fd,'confidence')
  })
  if(error)throw new Error(error.message)
 }catch(e){errorMessage=err(e)}
 if(errorMessage)done(owner,errorMessage,'error')
 done(owner,'Forecast event recorded, kept separate from verified bank cash')
}

export async function treasurySetReserve(fd:FormData) {
 const {supabase}=await requireSuperAdmin()
 let errorMessage=''
 try {
  requireIsolatedTreasuryDatabase()
  const {error}=await supabase.rpc('treasury_set_minimum_reserve',{
   p_amount:amount(fd,'minimum_operating_reserve')
  })
  if(error)throw new Error(error.message)
 }catch(e){errorMessage=err(e)}
 if(errorMessage)done(owner,errorMessage,'error')
 done(owner,'Minimum cash reserve updated with audit event')
}
