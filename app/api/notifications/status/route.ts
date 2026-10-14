import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store, max-age=0'}
export async function GET(){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)return NextResponse.json({authenticated:false,unread:0,latest:null},{headers})
 const [unread,latest]=await Promise.all([
  supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null),
  supabase.from('notifications').select('created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1),
 ])
 if(unread.error||latest.error)return NextResponse.json({error:'Notification status is temporarily unavailable.'},{status:503,headers})
 return NextResponse.json({authenticated:true,unread:unread.count??0,latest:latest.data?.[0]?.created_at??null},{headers})
}
