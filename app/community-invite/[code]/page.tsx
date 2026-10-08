import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { confirmCommunityQrJoin } from '@/app/actions/community-qr'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { SubmitButton } from '@/components/submit-button'
import { createClient } from '@/lib/supabase/server'
import { normalizeCommunityQrCode } from '@/lib/community-qr'
import { SITE_NAME, SITE_TAGLINE_BN, SITE_TAGLINE_EN } from '@/lib/site'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'

export async function generateMetadata({params}:{params:Promise<{code:string}>}):Promise<Metadata>{
  const {code:rawCode}=await params
  const code=normalizeCommunityQrCode(rawCode)
  return {
    title: code?code+' Community Join · '+SITE_NAME:'Community Join · '+SITE_NAME,
    robots:{index:false,follow:false},
  }
}

export default async function CommunityInvitePage({
  params,
  searchParams,
}:{params:Promise<{code:string}>;searchParams:Promise<{error?:string;notice?:string}>}){
  const [{code:rawCode},{error,notice}]=await Promise.all([params,searchParams])
  const code=normalizeCommunityQrCode(rawCode)
  if(!code)notFound()

  const supabase=await createClient()
  const [{data:qrRows,error:qrError},{data:{user}}]=await Promise.all([
    supabase.rpc('get_public_community_qr',{p_code:code}),
    supabase.auth.getUser(),
  ])
  const qr=Array.isArray(qrRows)?qrRows[0]:null
  if(qrError||!qr)notFound()

  let profile:any=null
  if(user){
    const result=await supabase.from('profiles').select('community_id,onboarding_completed_at,full_name,phone').eq('id',user.id).maybeSingle()
    profile=result.data
  }

  const sameCommunity=Boolean(profile?.community_id&&profile.community_id===qr.community_id)
  const onboarded=Boolean(profile?.community_id&&profile?.onboarding_completed_at&&profile?.full_name&&profile?.phone)
  const differentCommunity=Boolean(onboarded&&profile.community_id!==qr.community_id)

  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <PublicHeader actionHref={user?'/home':'/login'} actionLabel={user?'Open app':'Sign in'}/>
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="overflow-hidden rounded-[28px] border border-cyan-200/80 bg-[radial-gradient(circle_at_88%_10%,rgba(103,232,249,.28),transparent_30%),linear-gradient(135deg,rgba(255,255,255,.98),rgba(236,254,255,.90))] p-5 shadow-[0_18px_50px_rgba(14,165,233,.10)] sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-black text-emerald-700">Community QR · {code}</span>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600">Verified launch link</span>
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-cyan-700">{SITE_TAGLINE_EN}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Join {qr.community_name}</h1>
        <p className="mt-2 text-lg font-bold text-emerald-700">{SITE_TAGLINE_BN}</p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">This QR remembers that you came from the {qr.community_name} launch. Scanning does not create an account or an order. Verify your mobile, confirm your community, then choose what you want to buy.</p>

        {notice&&<div className="success mt-5">{notice}</div>}
        {error&&<div className="error mt-5">{error}</div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/90 bg-white/70 p-4"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Active Pools</div><div className="mt-1 text-3xl font-black">{Number(qr.active_pool_count??0)}</div><p className="mt-1 text-xs text-slate-500">Community buying opportunities</p></div>
          <div className="rounded-2xl border border-white/90 bg-white/70 p-4"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Neighbour Deals</div><div className="mt-1 text-3xl font-black">{Number(qr.active_group_deal_count??0)}</div><p className="mt-1 text-xs text-slate-500">Nearby verified buyer deals</p></div>
          <div className="rounded-2xl border border-white/90 bg-white/70 p-4"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Community saving this month</div><div className="mt-1 text-3xl font-black text-emerald-700">{taka(Number(qr.month_verified_saving??0))}</div><p className="mt-1 text-xs text-slate-500">Verified after fulfilment</p></div>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-100 bg-white/70 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ['1','Scan QR','Community source remembered'],
              ['2','Verify mobile','New users register by OTP'],
              ['3','Join community','Confirm '+qr.community_name],
              ['4','Start saving','Browse Pools & Group Deals'],
            ].map(([n,title,desc])=><div key={n} className="min-w-0"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-black text-cyan-800">{n}</div><b className="mt-2 block text-sm">{title}</b><p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p></div>)}
          </div>
        </div>

        <div className="mt-6">
          {!user&&<div className="grid gap-3 sm:grid-cols-2">
            <Link className="btn-primary min-h-12 text-center" href="/signup">Register with mobile</Link>
            <Link className="btn-secondary min-h-12 text-center" href="/login">I already have an account</Link>
          </div>}

          {user&&!onboarded&&<Link className="btn-primary inline-flex min-h-12 items-center justify-center px-5" href="/onboarding">Complete profile & join {qr.community_name}</Link>}

          {user&&sameCommunity&&onboarded&&<form action={confirmCommunityQrJoin}>
            <input type="hidden" name="community_code" value={code}/>
            <SubmitButton className="min-h-12 px-5">Confirm & open {qr.community_name}</SubmitButton>
          </form>}

          {user&&differentCommunity&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><b>Your account already belongs to another community.</b><p className="mt-1">For safety, a QR code cannot silently move your household. Contact Operations if your community needs to be changed.</p><Link href="/home" className="mt-3 inline-flex font-black underline">Return to your current community →</Link></div>}
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><b>FREE community pickup</b><p className="mt-1 text-sm text-slate-500">Collect from the community delivery point at no delivery charge.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><b>Optional home delivery</b><p className="mt-1 text-sm text-slate-500">৳20 for baskets up to ৳1,000; ৳30 above ৳1,000.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><b>Transparent savings</b><p className="mt-1 text-sm text-slate-500">Product savings stay separate from optional delivery cost.</p></div>
      </section>
    </div>
    <PublicFooter/>
  </main>
}
