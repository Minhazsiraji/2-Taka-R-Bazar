import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function esc(value:unknown){const s=String(value??'');return `"${s.replaceAll('"','""')}"`}
function startFor(range:string){const now=new Date();const year=now.getUTCFullYear(),month=now.getUTCMonth();if(range==='year')return `${year}-01-01`;if(range==='quarter'){const q=Math.floor(month/3)*3;return `${year}-${String(q+1).padStart(2,'0')}-01`}return `${year}-${String(month+1).padStart(2,'0')}-01`}

export async function GET(request:NextRequest){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return new Response('Unauthorized',{status:401})
  const range=request.nextUrl.searchParams.get('range')??'month',format=request.nextUrl.searchParams.get('format')??'csv';const start=startFor(range)
  const [{data:rows},{data:categories},{data:accounts},{data:people}]=await Promise.all([
    supabase.from('money_transactions').select('transaction_date,transaction_type,amount,category_id,account_id,person_id,description,note').eq('user_id',user.id).gte('transaction_date',start).order('transaction_date'),
    supabase.from('money_categories').select('id,name').eq('user_id',user.id),supabase.from('money_accounts').select('id,name').eq('user_id',user.id),supabase.from('money_people').select('id,name').eq('user_id',user.id),
  ])
  const name=(list:any[]|null,id:string)=>list?.find(x=>x.id===id)?.name??'';const header=['Date','Type','Amount BDT','Category','Account','Person','Description','Note'];const data=(rows??[]).map((r:any)=>[r.transaction_date,r.transaction_type,r.amount,name(categories,r.category_id),name(accounts,r.account_id),name(people,r.person_id),r.description??'',r.note??''])
  if(format==='xls'){
    const html=`<table><tr>${header.map(h=>`<th>${h}</th>`).join('')}</tr>${data.map(row=>`<tr>${row.map(cell=>`<td>${String(cell).replaceAll('&','&amp;').replaceAll('<','&lt;')}</td>`).join('')}</tr>`).join('')}</table>`
    return new Response(html,{headers:{'content-type':'application/vnd.ms-excel; charset=utf-8','content-disposition':`attachment; filename="my-money-${range}.xls"`}})
  }
  const csv='\uFEFF'+[header,...data].map(row=>row.map(esc).join(',')).join('\r\n')
  return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="my-money-${range}.csv"`}})
}
