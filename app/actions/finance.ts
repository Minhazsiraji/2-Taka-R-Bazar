'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, requireSuperAdmin } from '@/lib/auth'

// A preview URL can otherwise share Production Supabase credentials.
// Finance writes are disabled unless a separate, explicitly approved preview DB is configured.
function assertIsolatedFinancePreview() {
  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const approved = process.env.FINANCE_PREVIEW_SUPABASE_URL ?? ''
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.FINANCE_WRITES_ENABLED !== 'true' ||
      !endpoint || !approved || endpoint !== approved ||
      endpoint.includes('sukabonfjcnaavjgjyuy')) {
    throw new Error('Finance writes are locked: a verified isolated Preview database is required.')
  }
}
const field = (fd:FormData,key:string) => String(fd.get(key) ?? '').trim()
const date = (fd:FormData,key:string) => field(fd,key) || null
const path = '/super-admin/finance'
function outcome(kind:'notice'|'error', message:string):never {
  revalidatePath(path)
  redirect(path + '?' + kind + '=' + encodeURIComponent(message))
}
function errorText(e:unknown) { return e instanceof Error ? e.message : 'Finance operation could not complete' }

export async function createFinanceExpense(fd:FormData) {
  await requireAdmin()
  try {
    assertIsolatedFinancePreview()
    const { supabase } = await requireAdmin()
    const amount = Number(field(fd,'amount'))
    if (!Number.isFinite(amount) || amount<=0 || amount>100000000)
      throw new Error('Enter a valid positive expense amount')
    const {error} = await supabase.rpc('finance_submit_expense', {
      p_category:field(fd,'category'),
      p_description:field(fd,'description'),
      p_vendor_name:field(fd,'vendor_name'),
      p_document_reference:field(fd,'document_reference'),
      p_amount:amount,
      p_incurred_on:date(fd,'incurred_on'),
      p_community_id:field(fd,'community_id') || null,
      p_campaign_code:field(fd,'campaign_code') || null,
    })
    if (error) throw new Error(error.message)
  } catch(e) { outcome('error',errorText(e)) }
  outcome('notice','Expense submitted for independent review')
}

export async function reviewFinanceExpense(fd:FormData) {
  await requireSuperAdmin()
  try {
    assertIsolatedFinancePreview()
    const {supabase} = await requireSuperAdmin()
    const {error} = await supabase.rpc('finance_review_expense',{
      p_id:field(fd,'expense_id'),p_approve:field(fd,'decision')==='approve',p_note:field(fd,'note')
    })
    if(error) throw new Error(error.message)
  } catch(e) { outcome('error',errorText(e)) }
  outcome('notice','Expense review recorded in the audit trail')
}

export async function requestFinanceSettlement(fd:FormData) {
  await requireSuperAdmin()
  try {
    assertIsolatedFinancePreview()
    const {supabase} = await requireSuperAdmin()
    const {error} = await supabase.rpc('finance_request_settlement',{
      p_expense_id:field(fd,'expense_id'),
      p_payment_method:field(fd,'payment_method'),
      p_payment_reference:field(fd,'payment_reference'),
      p_payment_date:date(fd,'payment_date'),
    })
    if(error) throw new Error(error.message)
  } catch(e) { outcome('error',errorText(e)) }
  outcome('notice','Settlement proof submitted for independent verification')
}

export async function reviewFinanceSettlement(fd:FormData) {
  await requireSuperAdmin()
  try {
    assertIsolatedFinancePreview()
    const {supabase} = await requireSuperAdmin()
    const {error} = await supabase.rpc('finance_review_settlement',{
      p_id:field(fd,'settlement_id'),p_approve:field(fd,'decision')==='approve',p_note:field(fd,'note')
    })
    if(error) throw new Error(error.message)
  } catch(e) { outcome('error',errorText(e)) }
  outcome('notice','Settlement decision recorded')
}
