'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOnboardedUser } from '@/lib/auth'

function text(fd: FormData, key: string) { return String(fd.get(key) ?? '').trim() }
function monthOf(fd: FormData) { const value=text(fd,'month'); return /^\d{4}-\d{2}$/.test(value)?value:'' }
function moneyUrl(fd:FormData,kind:'error'|'notice',message:string){
  const month=monthOf(fd); const params=new URLSearchParams(); if(month)params.set('month',month); params.set(kind,message)
  return `/money?${params.toString()}`
}
function fail(fd:FormData,message:string):never{redirect(moneyUrl(fd,'error',message))}
function ok(fd:FormData,message:string):never{revalidatePath('/money');revalidatePath('/home');redirect(moneyUrl(fd,'notice',message))}

const transactionSchema=z.object({
  transaction_type:z.enum(['expense','income']),
  amount:z.coerce.number().positive().max(100000000),
  category_id:z.string().uuid(),
  transaction_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method:z.enum(['cash','mobile_wallet','bank','card','other']),
  note:z.string().max(300),
})

export async function saveMoneyTransaction(formData:FormData){
  const {supabase,user}=await requireOnboardedUser()
  const parsed=transactionSchema.safeParse({
    transaction_type:text(formData,'transaction_type'), amount:text(formData,'amount'),
    category_id:text(formData,'category_id'), transaction_date:text(formData,'transaction_date'),
    payment_method:text(formData,'payment_method'), note:text(formData,'note'),
  })
  if(!parsed.success)fail(formData,'Please check the transaction details')

  const values=parsed.data
  const {data:category}=await supabase.from('money_categories').select('id,kind').eq('id',values.category_id).eq('user_id',user.id).eq('active',true).maybeSingle()
  if(!category||category.kind!==values.transaction_type)fail(formData,'Choose a matching category')
  const {error}=await supabase.from('money_transactions').insert({
    user_id:user.id, transaction_type:values.transaction_type, amount:values.amount,
    category_id:values.category_id, transaction_date:values.transaction_date,
    payment_method:values.payment_method, note:values.note||null, source:'manual',
  })
  if(error)fail(formData,error.message)
  ok(formData,values.transaction_type==='expense'?'Expense added':'Income added')
}

export async function deleteMoneyTransaction(formData:FormData){
  const {supabase,user}=await requireOnboardedUser(); const id=text(formData,'id')
  if(!z.string().uuid().safeParse(id).success)fail(formData,'Transaction not found')
  const {error}=await supabase.from('money_transactions').delete().eq('id',id).eq('user_id',user.id)
  if(error)fail(formData,error.message)
  ok(formData,'Transaction deleted')
}

const budgetSchema=z.object({category_id:z.string().uuid(),amount:z.coerce.number().positive().max(100000000),month:z.string().regex(/^\d{4}-\d{2}$/)})

export async function saveMoneyBudget(formData:FormData){
  const {supabase,user}=await requireOnboardedUser()
  const parsed=budgetSchema.safeParse({category_id:text(formData,'category_id'),amount:text(formData,'amount'),month:text(formData,'month')})
  if(!parsed.success)fail(formData,'Please check the budget details')
  const values=parsed.data
  const {data:category}=await supabase.from('money_categories').select('id').eq('id',values.category_id).eq('user_id',user.id).eq('kind','expense').eq('active',true).maybeSingle()
  if(!category)fail(formData,'Choose an expense category')
  const {error}=await supabase.from('money_budgets').upsert({
    user_id:user.id, category_id:values.category_id, month:`${values.month}-01`, amount:values.amount,
  },{onConflict:'user_id,category_id,month'})
  if(error)fail(formData,error.message)
  ok(formData,'Monthly budget saved')
}

export async function deleteMoneyBudget(formData:FormData){
  const {supabase,user}=await requireOnboardedUser(); const id=text(formData,'id')
  if(!z.string().uuid().safeParse(id).success)fail(formData,'Budget not found')
  const {error}=await supabase.from('money_budgets').delete().eq('id',id).eq('user_id',user.id)
  if(error)fail(formData,error.message)
  ok(formData,'Budget removed')
}

const categorySchema=z.object({
  kind:z.enum(['expense','income']),
  name:z.string().min(1).max(60),
  icon:z.string().max(8),
})

export async function createMoneyCategory(formData:FormData){
  const {supabase,user}=await requireOnboardedUser()
  const parsed=categorySchema.safeParse({kind:text(formData,'kind'),name:text(formData,'name'),icon:text(formData,'icon')})
  if(!parsed.success)fail(formData,'Please check the category details')
  const {error}=await supabase.from('money_categories').insert({
    user_id:user.id,kind:parsed.data.kind,name:parsed.data.name,icon:parsed.data.icon||null,is_default:false,
  })
  if(error){if(error.code==='23505')fail(formData,'That category already exists');fail(formData,error.message)}
  ok(formData,'Category added')
}
