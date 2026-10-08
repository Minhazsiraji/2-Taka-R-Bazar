import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { OpportunityCard } from '@/components/opportunity-card'
import { PriceComparison } from '@/components/price-comparison'

export const dynamic='force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } }

type DemoView='home'|'pools'|'deals'|'orders'|'savings'
const views:DemoView[]=['home','pools','deals','orders','savings']

function DemoNav({active}:{active:DemoView}){
  const labels:Record<DemoView,string>={home:'Home',pools:'Pools',deals:'Deals',orders:'Orders',savings:'Savings'}
  return <nav className="app-mobile-nav" aria-label="Preview demo navigation">
    <div className="app-mobile-nav-inner">
      {views.map(view=><Link
        key={view}
        href={'/preview-demo?view='+view}
        className={'app-mobile-nav-link'+(active===view?' is-active':'')}
        aria-current={active===view?'page':undefined}
      ><span>{labels[view]}</span></Link>)}
    </div>
  </nav>
}

function DemoHeader({active}:{active:DemoView}){
  const labels:Record<DemoView,string>={home:'Home',pools:'Pools',deals:'Group Deals',orders:'Orders',savings:'Savings'}
  return <header className="app-shell-header sticky top-0 z-40 w-full px-3 pt-2 sm:px-5">
    <div className="app-shell-header-bar mx-auto w-full max-w-6xl rounded-[20px] border border-sky-200/80 bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_white,0_10px_30px_rgba(14,165,233,.08)] backdrop-blur-xl sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/preview-demo" className="flex shrink-0 items-center gap-2" aria-label="2-TAKA-R-BAZAR Preview home">
          <BrandLogo size={44}/>
          <div className="hidden sm:block"><div className="text-sm font-black">2-TAKA-R-BAZAR</div><div className="text-[10px] text-slate-500">Preview UAT · no OTP</div></div>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 sm:inline-flex">Synthetic Preview</span>
          <ThemeToggle className="cx-header-theme"/>
        </div>
      </div>
      <nav className="mt-2 hidden items-center gap-1 border-t border-sky-100 pt-2 md:flex" aria-label="Preview demo sections">
        {views.map(view=><Link key={view} href={'/preview-demo?view='+view} className={'rounded-xl px-4 py-2 text-xs font-black '+(active===view?'bg-cyan-50 text-cyan-800':'text-slate-700 hover:bg-sky-50')}>{labels[view]}</Link>)}
      </nav>
    </div>
  </header>
}

function HomeDemo(){
  return <div className="grid min-w-0 gap-4 sm:gap-5">
    <section className="cx-savings-hero p-4 sm:p-6">
      <div className="cx-compact-strip">
        <span className="cx-compact-chip">📍 Amin Model Town</span>
        <span className="cx-compact-chip">👥 12 households</span>
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-cyan-700">Savings pulse</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">Your community is buying smarter.</h1>
      <p className="muted mt-2 max-w-2xl text-sm">See what is close to a lower price, commit only what you need, and keep delivery separate from product savings.</p>

      <Link href="/preview-demo?view=savings" className="cx-saving-stat mt-4">
        <div className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-700">You saved this month</div>
        <div className="mt-1 text-3xl font-black text-emerald-700">৳340</div>
        <div className="mt-1 text-xs font-bold text-slate-500">৳1,420 lifetime verified saving →</div>
      </Link>

      <div className="cx-opportunity-grid">
        <OpportunityCard href="/preview-demo?view=pools" title="Pools" count={1}/>
        <OpportunityCard href="/preview-demo?view=deals" title="Group Deals" count={1}/>
      </div>
    </section>

    <section className="cx-mission-card p-4 sm:p-5">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Best next saving move</p>
      <h2 className="mt-1 text-lg font-black sm:text-xl">Pusti Atta 2kg</h2>
      <p className="muted mt-1 text-xs sm:text-sm">Amin Model Town 5+ Neighbour Deal</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div><div className="text-xl font-black">4 / 5 buyers</div><div className="mt-1 text-sm font-black text-emerald-700">1 more → ৳145</div></div>
        <div className="text-sm font-black text-slate-500">80%</div>
      </div>
      <div className="price-target-track mt-2 h-3 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={80}>
        <div className="price-target-fill h-full" style={{width:'80%'}}/>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/preview-demo?view=deals" className="btn-primary min-h-10 px-4">Open opportunity</Link>
        <button className="cx-share-button" type="button">Invite neighbours</button>
      </div>
    </section>

    <section>
      <div className="cx-section-head"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-sky-700">Shop now</p><h2 className="mt-1 text-xl font-black">Community pools</h2></div><Link href="/preview-demo?view=pools" className="cx-section-link">View all →</Link></div>
      <article className="card cx-glass-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div><div className="flex gap-2"><span className="chip">Monthly Pool</span><span className="chip">Open</span></div><h3 className="mt-2 text-lg font-black">Amin Model Town Oct monthly pool</h3><p className="muted mt-1 text-xs">1 item · fulfilment Nov 1, 2026</p></div>
          <Link href="/preview-demo?view=pools" className="btn-secondary min-h-10 px-3 text-sm">Open</Link>
        </div>
        <div className="cx-compact-strip mt-3"><span className="cx-compact-chip">👥 12 households</span><span className="cx-compact-chip">📦 38 units</span><span className="cx-compact-chip text-emerald-700">↓ ৳570 current saving</span></div>
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/35 p-3">
          <div className="flex justify-between gap-2 text-xs font-black"><span>38/50 units</span><span className="text-emerald-700">12 more → ৳970</span></div>
          <div className="price-target-track mt-2 h-2 overflow-hidden"><div className="price-target-fill h-full" style={{width:'76%'}}/></div>
        </div>
      </article>
    </section>

    <section>
      <div className="cx-section-head"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-sky-700">Nearby</p><h2 className="mt-1 text-xl font-black">Neighbour deals</h2></div><Link href="/preview-demo?view=deals" className="cx-section-link">View all →</Link></div>
      <article className="card cx-glass-card p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">Pusti Atta 2kg</h3><p className="muted mt-1 text-xs">2 kg · closes Oct 10, 2026</p></div><span className="chip">Joined</span></div>
        <div className="mt-3 flex items-end justify-between gap-3"><div><span className="muted text-xs">Current price</span><div className="text-xl font-black text-emerald-700">Unlocking</div></div><div className="text-right"><span className="muted text-xs">Next</span><div className="font-black">4/5 buyers</div><div className="text-xs font-black text-emerald-700">1 more → ৳145</div></div></div>
      </article>
    </section>
  </div>
}

function PoolsDemo(){
  return <div className="grid gap-4">
    <section><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Community buying</p><h1 className="mt-1 text-2xl font-black">Available pools</h1><p className="muted mt-1 text-sm">Choose essentials, watch the price fall as community volume grows.</p></section>
    <section className="card cx-glass-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex gap-2"><span className="chip">Monthly Pool</span><span className="chip">Open</span></div><h2 className="mt-2 text-xl font-black">Amin Model Town Oct monthly pool</h2><p className="muted mt-1 text-sm">Fulfilment target · Nov 1, 2026</p></div><button className="btn-secondary">♡ 0</button></div>
      <div className="cx-compact-strip mt-3"><span className="cx-compact-chip">👥 12 households</span><span className="cx-compact-chip">📦 38 units</span><span className="cx-compact-chip">Basket max ৳985</span><span className="cx-compact-chip text-emerald-700">↓ Save ৳15/unit</span></div>
    </section>

    <article className="card cx-glass-card cx-product-card p-4 sm:p-5">
      <div className="cx-product-layout">
        <div className="cx-product-media">
          <div className="flex h-[190px] w-[190px] items-center justify-center rounded-[18px] border border-cyan-100 bg-white text-7xl shadow-sm" aria-label="Soybean oil demo product">🛢️</div>
          <div className="cx-compact-strip justify-center"><span className="cx-compact-chip">ID</span><span className="cx-compact-chip">10 units</span></div>
        </div>
        <div className="cx-product-main">
          <div className="cx-product-title-row"><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pool item</p><h3 className="mt-1 text-xl font-black">Rupchanda Soybean Oil 5L</h3></div><span className="chip">Active</span></div>
          <PriceComparison market="৳1,000" current="৳985" saving="৳15" />
          <div className="price-target-progress mt-3 rounded-xl border border-emerald-100 bg-emerald-50/35 p-3">
            <div className="cx-progress-head"><div><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Next price tier</div><div className="mt-1 text-sm font-black">৳985 unlocked · 38/50 units</div><div className="muted mt-1 text-[11px]">12 households joined</div></div><div className="text-right"><div className="text-xs font-black text-emerald-700">12 more → ৳970</div><div className="muted mt-1 text-[10px]">save ৳30/unit</div></div></div>
            <div className="price-target-track mt-2 h-2 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={50} aria-valuenow={38}><div className="price-target-fill h-full" style={{width:'76%'}}/></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/35 p-3"><div><b className="text-sm">12 more units can unlock ৳970</b><p className="muted mt-1 text-xs">Share the target with neighbours; quantity still comes from real commitments.</p></div><button type="button" className="cx-share-button">Share target</button></div>
          <div className="cx-commitment"><div><div className="text-[10px] font-black uppercase text-sky-700">Your commitment</div><b>10 units</b></div><span className="chip">Active</span></div>
          <div className="cx-quantity-form"><label><span className="label">Quantity</span><input className="input" type="number" defaultValue={10}/></label><button className="btn-primary">Update quantity</button></div>
        </div>
      </div>
    </article>
  </div>
}

function DealsDemo(){
  return <div className="grid gap-4">
    <section><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Neighbour-powered buying</p><h1 className="mt-1 text-2xl font-black">Group Deals</h1><p className="muted mt-1 text-sm">Real nearby people unlock the price together. One verified person counts once.</p></section>
    <div className="card cx-glass-card flex flex-wrap items-center justify-between gap-2 p-4"><div className="flex items-center gap-2"><span>📍</span><div><b>Community location verified</b><p className="muted text-xs">Nearby matching active; exact GPS stays private.</p></div></div><span className="chip text-emerald-700">Verified ✓</span></div>
    <article className="card cx-glass-card p-4 sm:p-5">
      <div className="cx-product-heading"><div className="flex h-[180px] w-[180px] items-center justify-center rounded-[18px] border border-cyan-100 bg-white text-7xl">🌾</div><div><div className="flex flex-wrap gap-2"><span className="chip">Open</span><span className="chip">4 qualified</span><span className="chip text-emerald-700">Joined</span></div><h2 className="mt-2 text-xl font-black">Pusti Atta 2kg</h2><p className="muted mt-1 text-xs">Pusti · 2 kg · closes Oct 10, 2026</p><p className="mt-1 text-xs font-bold text-slate-600">Amin Model Town 5+ Neighbour Deal</p></div></div>
      <PriceComparison market="৳150" current="Unlocking" currentLabel="Current price" savingLabel="Next unlock" saving="1 more" note="৳145"/>
      <div className="price-target-progress mt-3 rounded-xl border border-emerald-100 bg-emerald-50/35 p-3"><div className="cx-progress-head"><div><div className="text-[9px] font-black uppercase text-slate-500">First unlock</div><div className="mt-1 text-sm font-black">4/5 verified buyers</div><div className="muted mt-1 text-[11px]">4 qualified community buyers</div></div><div className="text-right"><div className="text-xs font-black text-emerald-700">1 more → ৳145</div><div className="muted mt-1 text-[10px]">save ৳5/unit</div></div></div><div className="price-target-track mt-2 h-2 overflow-hidden"><div className="price-target-fill h-full" style={{width:'80%'}}/></div></div>
      <div className="cx-compact-strip mt-3"><span className="cx-compact-chip">👥 Nearby circle 4/10</span><span className="cx-compact-chip">📍 within 750 m</span><span className="cx-compact-chip">Your qty 1</span></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/35 p-3"><div><b className="text-sm">1 more verified neighbour can unlock ৳145</b><p className="muted mt-1 text-xs">Only separately verified people count.</p></div><button className="cx-share-button">Invite neighbours</button></div>
    </article>
  </div>
}

function OrdersDemo(){
  return <div className="grid gap-4">
    <section><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Your buying journey</p><h1 className="mt-1 text-2xl font-black">Orders</h1><p className="muted mt-1 text-sm">Track final confirmation and fulfilment without mixing delivery cost into product savings.</p></section>
    <div className="cx-compact-strip"><span className="cx-compact-chip text-emerald-700">✓ Community pickup FREE</span><span className="cx-compact-chip">Home delivery ৳20 up to ৳1,000</span><span className="cx-compact-chip">৳30 above ৳1,000</span></div>
    <article className="card cx-glass-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">2TBR-20261008-001</h2><p className="muted mt-1 text-xs">Confirmed Oct 8, 2026</p></div><span className="chip text-emerald-700">Preparing</span></div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-black"><div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2">✓ Confirmed</div><div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2">● Preparing</div><div className="rounded-xl border border-slate-200 p-2">Ready</div><div className="rounded-xl border border-slate-200 p-2">Collected</div></div>
      <PriceComparison market="৳1,000" current="৳985" currentLabel="2TBR products" saving="৳15" savingLabel="Product saving"/>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/35 p-3"><div><b>Community pickup</b><p className="muted mt-1 text-xs">Amin Model Town Gate</p></div><b className="text-emerald-700">FREE</b></div>
      <div className="mt-3 flex items-end justify-between"><div><div className="text-[10px] font-black uppercase text-slate-500">Total payable</div><div className="mt-1 text-2xl font-black">৳985</div></div><div className="text-right text-xs font-black text-emerald-700">You keep ৳15 saving</div></div>
    </article>
  </div>
}

function SavingsDemo(){
  return <div className="grid gap-4">
    <section className="cx-savings-hero p-4 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Proof of value</p><h1 className="mt-1 text-2xl font-black">Your real savings</h1><p className="muted mt-1 text-sm">Product savings are verified after fulfilment. Optional home-delivery fees remain separate.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="card cx-glass-card p-4"><div className="text-[10px] font-black uppercase text-slate-500">Net saving this month</div><div className="mt-1 text-4xl font-black text-emerald-700">৳340</div><p className="muted mt-1 text-xs">Product saving ৳380 − delivery ৳40</p></div><div className="card cx-glass-card p-4"><div className="text-[10px] font-black uppercase text-slate-500">Lifetime net saving</div><div className="mt-1 text-2xl font-black">৳1,420</div><p className="muted mt-1 text-xs">Verified after fulfilment</p></div></div></section>
    <section><h2 className="text-xl font-black">Where you saved</h2><div className="mt-3 grid gap-3"><article className="card cx-glass-card p-4"><div className="flex items-center justify-between gap-3"><div><b>Rupchanda Soybean Oil 5L</b><p className="muted mt-1 text-xs">Market ৳1,000 → 2TBR ৳985 · Qty 2</p></div><b className="text-xl text-emerald-700">+৳30</b></div></article><article className="card cx-glass-card p-4"><div className="flex items-center justify-between gap-3"><div><b>Pusti Atta 2kg</b><p className="muted mt-1 text-xs">Market ৳150 → 2TBR ৳145 · Qty 4</p></div><b className="text-xl text-emerald-700">+৳20</b></div></article></div></section>
  </div>
}

export default async function PreviewDemoPage({searchParams}:{searchParams:Promise<{view?:string}>}){
  if(process.env.VERCEL_ENV!=='preview')redirect('/login?error=Preview+demo+is+available+only+on+Preview+deployments')
  const sp=await searchParams
  const requested=String(sp.view??'home') as DemoView
  const active=views.includes(requested)?requested:'home'

  return <div className="min-h-screen bg-[linear-gradient(135deg,#f8fdff,#eaf8ff_50%,#f8fdff)] text-slate-950">
    <DemoHeader active={active}/>
    <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-5 sm:pb-8 sm:pt-5">
      <div className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-xs font-bold text-cyan-900">Preview-only synthetic UAT · no SMS/OTP used · no Production customer data shown</div>
      {active==='home'&&<HomeDemo/>}
      {active==='pools'&&<PoolsDemo/>}
      {active==='deals'&&<DealsDemo/>}
      {active==='orders'&&<OrdersDemo/>}
      {active==='savings'&&<SavingsDemo/>}
    </main>
    <DemoNav active={active}/>
  </div>
}
