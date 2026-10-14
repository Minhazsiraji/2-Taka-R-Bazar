import Link from 'next/link'
import {CommerceFrame} from '@/components/commerce-frame'
import {requireUser} from '@/lib/auth'
export const dynamic='force-dynamic'
export default async function AccountPage(){await requireUser();return <CommerceFrame title="অ্যাকাউন্ট / Account"><div className="grid gap-3 sm:grid-cols-2">{[['/account/orders','অর্ডার / Orders'],['/cart','পুল ও ডিল / Pools & deals'],['/account/addresses','ঠিকানা / Addresses'],['/profile','কমিউনিটি / Community'],['/account/savings','সাশ্রয়ের রিপোর্ট / Savings report'],['/notifications','বিজ্ঞপ্তি / Notifications'],['/contact','সহায়তা / Support'],['/account/security','নিরাপত্তা / Security']].map(([href,label])=><Link key={label} className="rounded-2xl border p-5 font-black" href={href}>{label}</Link>)}</div><p className="mt-5 text-sm">সাশ্রয় একটি রিপোর্ট, ওয়ালেট নয়। Savings are a report and cannot be spent or withdrawn.</p></CommerceFrame>}
