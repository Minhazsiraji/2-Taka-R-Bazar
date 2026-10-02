import 'server-only'

export function dhakaToday(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??''
  const today=`${get('year')}-${get('month')}-${get('day')}`
  return {today,month:today.slice(0,7)}
}
export function moneyMonthLabel(month:string){const [year,number]=month.split('-').map(Number);return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,number-1,1)))}
export function moneyAccountTypeLabel(value:string){return ({cash:'Cash',bank:'Bank',credit_card:'Credit card',mobile_wallet:'Mobile wallet',other:'Other'} as Record<string,string>)[value]??value}
export async function loadMoneyReference(supabase:any,userId:string){
  const [{data:categories},{data:accounts},{data:people}]=await Promise.all([
    supabase.from('money_categories').select('id,name,kind,icon,is_default,active,sort_order').eq('user_id',userId).eq('active',true).order('kind').order('sort_order').order('name'),
    supabase.from('money_accounts').select('id,name,account_type,opening_balance,active,sort_order').eq('user_id',userId).eq('active',true).order('sort_order').order('name'),
    supabase.from('money_people').select('id,name,is_default,active,sort_order').eq('user_id',userId).eq('active',true).order('sort_order').order('name'),
  ])
  return {categories:categories??[],accounts:accounts??[],people:people??[]}
}
