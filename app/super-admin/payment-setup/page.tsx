import Link from 'next/link'
import {requireSuperAdmin} from '@/lib/auth'
import {SuperAdminShell} from '@/components/super-admin-shell'
import {MANUAL_PAYMENT_DESTINATIONS as accounts} from '@/lib/manual-payment-destinations'

export const dynamic='force-dynamic'

export default async function PaymentSetupPage(){
  await requireSuperAdmin()
  return <SuperAdminShell>
    <h1 className="text-3xl font-black">Real payment setup</h1>
    <p className="muted mt-3">Receiving details supplied by the owner. These destinations are prepared for launch; entering account details does not open customer purchases or verify a payment.</p>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <section className="card"><h2 className="text-xl font-black">{accounts.bkash.name}</h2>
        <dl className="mt-4 grid gap-2"><dt className="text-sm">Receiving number</dt><dd className="font-black">{accounts.bkash.displayNumber}</dd><dt className="text-sm">Customer operation</dt><dd>{accounts.bkash.operation}</dd></dl>
        <p className="mt-4 text-sm">Use bKash Payment and confirm the recipient name in the bKash app. An approved PRA QR can be added when supplied. Do not ask a customer for their PIN or OTP.</p>
        <a className="mt-4 inline-block underline" href="https://www.bkash.com/en/page/personal-retail-account" target="_blank" rel="noopener noreferrer">Official bKash PRA guidance</a>
      </section>
      <section className="card"><h2 className="text-xl font-black">Bank transfer</h2>
        <dl className="mt-4 grid gap-2"><dt className="text-sm">Bank</dt><dd>{accounts.bank.institution}</dd><dt className="text-sm">Branch</dt><dd>{accounts.bank.branch}</dd><dt className="text-sm">Account holder</dt><dd>{accounts.bank.accountHolder}</dd><dt className="text-sm">Account number</dt><dd className="font-black">{accounts.bank.accountNumber}</dd></dl>
        <p className="mt-4 text-sm">A routing number has not been supplied. Confirm it with the bank before enabling a transfer method that requires it.</p>
      </section>
    </div>
    <section className="card mt-6"><h2 className="text-xl font-black">Before the first real sale</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5">
        <li>Sign in to the existing owner account and save a password privately.</li>
        <li>Add the real product, pack size, photo, landed cost, actual stock and selling price.</li>
        <li>Approve the offer independently, select the operating community and assign fulfillment staff.</li>
        <li>Register the business opening balances with evidence and keep the older synthetic accounting records identified separately.</li>
        <li>Qualify the Production checkout and Finance release mode. Current Preview-only write controls remain active until that release is completed.</li>
        <li>For each payment, record the exact order reference, transaction ID, amount and original evidence. Staff verification, independent Treasury approval and bank reconciliation remain separate steps.</li>
      </ol>
    </section>
    <nav className="mt-6 flex flex-wrap gap-4"><Link className="btn-primary" href="/admin/payment-recipients">Activate existing receiving accounts for confirmed pilot bookings →</Link><Link className="btn-secondary" href="/account/security">Set my password</Link><Link className="btn-secondary" href="/admin/own-products">Own products</Link><Link className="btn-secondary" href="/super-admin/treasury">Treasury accounts</Link><Link className="btn-secondary" href="/commerce">Commerce operations</Link></nav>
  </SuperAdminShell>
}
