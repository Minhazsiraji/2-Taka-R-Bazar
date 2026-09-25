import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { supabase: db } = await requireAdmin()
  const { data: rows } = await db
    .from('commitments')
    .select('*,pool_items(products(name,package_size),pools(title,status,communities(name)))')
    .order('updated_at', { ascending: false })
    .limit(200)

  const customerIds = [...new Set((rows ?? []).map((r: any) => r.customer_id))]
  const { data: profiles } = customerIds.length
    ? await db.from('profiles').select('id,full_name,phone,household_name').in('id', customerIds)
    : { data: [] as any[] }
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  return <AdminShell>
    <h1 className="text-3xl font-black mb-1">Commitments</h1>
    <p className="muted mb-4">Aggregated demand monitoring. A commitment is not a purchase.</p>
    <div className="table-wrap"><table><thead><tr><th>Household</th><th>Community / Pool</th><th>Product</th><th>Qty</th><th>Status</th></tr></thead><tbody>
      {rows?.map((r: any) => {
        const profile = profileMap.get(r.customer_id) as any
        return <tr key={r.id}>
          <td><b>{profile?.full_name ?? 'Customer'}</b><br/><span className="muted">{profile?.household_name ?? '—'} · {profile?.phone ?? '—'}</span></td>
          <td>{r.pool_items?.pools?.communities?.name}<br/><span className="muted">{r.pool_items?.pools?.title}</span></td>
          <td>{r.pool_items?.products?.name} · {r.pool_items?.products?.package_size}</td>
          <td className="font-black">{r.quantity}</td><td>{r.status}</td>
        </tr>
      })}
    </tbody></table></div>
  </AdminShell>
}
