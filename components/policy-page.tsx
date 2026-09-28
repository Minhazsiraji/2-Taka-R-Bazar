import type { ReactNode } from 'react'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { POLICY_EFFECTIVE_DATE_BN, POLICY_EFFECTIVE_DATE_EN } from '@/lib/legal'

type PolicySection = { titleEn: string; titleBn: string; bodyEn: ReactNode; bodyBn: ReactNode }

export function PolicyPage({titleEn,titleBn,summaryEn,summaryBn,sections}:{
  titleEn:string; titleBn:string; summaryEn:string; summaryBn:string; sections:PolicySection[]
}) {
  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <PublicHeader actionHref="/" actionLabel="Home" />
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">2-TAKA-R-BAZAR · Pilot policy</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{titleEn}</h1>
        <p className="mt-1 text-xl font-bold text-slate-700" lang="bn">{titleBn}</p>
        <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p>{summaryEn}</p><p lang="bn">{summaryBn}</p></div>
        <p className="mt-4 text-xs text-slate-500">Effective / কার্যকর: {POLICY_EFFECTIVE_DATE_EN} · {POLICY_EFFECTIVE_DATE_BN}</p>
      </section>
      <div className="mt-5 grid gap-4">
        {sections.map((s,index)=><section key={s.titleEn} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black">{index+1}. {s.titleEn}</h2><h3 className="mt-1 font-bold text-slate-700" lang="bn">{s.titleBn}</h3>
          <div className="mt-3 grid gap-4 leading-7 text-slate-700 md:grid-cols-2"><div>{s.bodyEn}</div><div lang="bn">{s.bodyBn}</div></div>
        </section>)}
      </div>
    </div>
    <PublicFooter />
  </main>
}
