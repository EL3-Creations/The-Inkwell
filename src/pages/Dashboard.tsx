import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { fmtMoney, startOfMonth, startOfWeek } from '../lib/format'
import { Card, PageHeader, Spinner, Badge } from '../components/ui'
import PhotoImg from '../components/PhotoImg'

export default function Dashboard() {
  const { settings, designs, sales, loading, priceOf, designById } = useData()

  const stats = useMemo(() => {
    const active = designs.filter((d) => !d.archived)
    const piecesInStock = active.reduce((n, d) => n + d.quantity, 0)
    const inventoryValue = active.reduce((n, d) => n + d.quantity * priceOf(d), 0)
    const weekStart = startOfWeek(settings?.week_starts_on ?? 0).getTime()
    const monthStart = startOfMonth().getTime()
    const paidSales = sales.filter((s) => s.status === 'paid' || s.status === 'shipped')
    const sum = (list: typeof sales) => list.reduce((n, s) => n + Number(s.unit_price) * s.quantity, 0)
    const week = paidSales.filter((s) => new Date(s.claimed_at).getTime() >= weekStart)
    const month = paidSales.filter((s) => new Date(s.claimed_at).getTime() >= monthStart)
    const unpaid = sales.filter((s) => s.status === 'claimed')

    const soldByDesign = new Map<string, number>()
    for (const s of sales) if (s.status !== 'cancelled') soldByDesign.set(s.design_id, (soldByDesign.get(s.design_id) ?? 0) + s.quantity)
    const best = [...soldByDesign.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    const remake = active
      .filter((d) => d.quantity <= 1)
      .map((d) => ({ d, sold: soldByDesign.get(d.id) ?? 0 }))
      .filter((x) => x.sold > 0 || x.d.quantity === 0)
      .sort((a, b) => b.sold - a.sold)

    return {
      piecesInStock, inventoryValue, activeCount: active.length,
      soldOut: active.filter((d) => d.quantity === 0).length,
      week: { n: week.reduce((n, s) => n + s.quantity, 0), total: sum(week) },
      month: { n: month.reduce((n, s) => n + s.quantity, 0), total: sum(month) },
      unpaid: { n: unpaid.length, total: sum(unpaid) },
      toShip: sales.filter((s) => s.status === 'paid').length,
      best, remake,
    }
  }, [designs, sales, settings, priceOf])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Dashboard" sub={settings?.shop_name} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pieces in stock" value={String(stats.piecesInStock)} sub={`${stats.activeCount} designs · ${stats.soldOut} sold out`} to="/inventory" />
        <Stat label="Inventory value" value={fmtMoney(stats.inventoryValue)} sub="at sale price" />
        <Stat label="Sales this week" value={fmtMoney(stats.week.total)} sub={`${stats.week.n} pieces`} to="/sales" />
        <Stat label="Sales this month" value={fmtMoney(stats.month.total)} sub={`${stats.month.n} pieces`} to="/sales" />
        <Stat label="Unpaid claims" value={fmtMoney(stats.unpaid.total)} sub={`${stats.unpaid.n} waiting`} to="/owes" tone={stats.unpaid.n ? 'rose' : undefined} />
        <Stat label="To ship" value={String(stats.toShip)} sub="paid, not shipped" to="/ship" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-brand text-xl font-bold">Best sellers</h2>
          {stats.best.length === 0 ? (
            <p className="text-neutral-500">No sales yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.best.map(([id, n], i) => {
                const d = designById.get(id)
                if (!d) return null
                return (
                  <Link key={id} to={`/designs/${id}`} className="flex items-center gap-3 rounded-2xl border-2 border-black p-2 hover:bg-neutral-50">
                    <span className="w-6 text-center font-bold text-neutral-400">{i + 1}</span>
                    <PhotoImg designId={id} className="h-14 w-14 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">#{d.number} {d.name}</div>
                      <div className="text-sm text-neutral-600">{n} sold · {d.quantity} left</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-brand text-xl font-bold">Consider remaking</h2>
          {stats.remake.length === 0 ? (
            <p className="text-neutral-500">Nothing is running low.</p>
          ) : (
            <div className="space-y-2">
              {stats.remake.slice(0, 10).map(({ d, sold }) => (
                <Link key={d.id} to={`/designs/${d.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-black p-2 hover:bg-neutral-50">
                  <PhotoImg designId={d.id} className="h-14 w-14 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">#{d.number} {d.name}</div>
                    <div className="text-sm text-neutral-600">{sold} sold</div>
                  </div>
                  <Badge tone={d.quantity === 0 ? 'red' : 'rose'}>{d.quantity === 0 ? 'Sold out' : '1 left'}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, to, tone }: { label: string; value: string; sub?: string; to?: string; tone?: 'rose' }) {
  const inner = (
    <Card className={`h-full ${tone === 'rose' ? 'bg-accent-soft' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</div>
      <div className="mt-1 font-brand text-3xl font-bold">{value}</div>
      {sub && <div className="text-sm text-neutral-600">{sub}</div>}
    </Card>
  )
  return to ? <Link to={to} className="block hover:opacity-90">{inner}</Link> : inner
}
