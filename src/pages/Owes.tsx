import { useMemo } from 'react'
import { useData } from '../lib/data'
import { cancelSale, markPaid } from '../lib/api'
import { errMsg, useToast } from '../lib/toast'
import { fmtMoney, timeAgo } from '../lib/format'
import { useNow } from '../lib/hooks'
import { Button, Empty, PageHeader, Spinner } from '../components/ui'
import SaleRow from '../components/SaleRow'

/** Claims that haven't been paid yet, grouped by buyer, oldest first. */
export default function Owes() {
  const { sales, loading } = useData()
  const toast = useToast()
  const now = useNow()

  const groups = useMemo(() => {
    const unpaid = sales.filter((s) => s.status === 'claimed').sort((a, b) => a.claimed_at.localeCompare(b.claimed_at))
    const map = new Map<string, typeof unpaid>()
    for (const s of unpaid) {
      const k = s.buyer_handle || '(no handle)'
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return [...map.entries()]
  }, [sales])

  const total = groups.flatMap(([, l]) => l).reduce((n, s) => n + Number(s.unit_price) * s.quantity, 0)
  const count = groups.reduce((n, [, l]) => n + l.length, 0)

  async function paid(ids: string[]) {
    try { for (const id of ids) await markPaid(id); toast(ids.length > 1 ? `Marked ${ids.length} paid` : 'Marked paid') } catch (e) { toast(errMsg(e), 'error') }
  }
  async function release(id: string) {
    if (!confirm('Release this piece back to stock?')) return
    try { await cancelSale(id); toast('Back in stock') } catch (e) { toast(errMsg(e), 'error') }
  }

  if (loading) return <Spinner />
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Who still owes me" sub={count ? `${count} claims · ${fmtMoney(total)} unpaid` : 'All caught up'} />
      {groups.length === 0 ? <Empty title="Nobody owes you anything">Claims from Live mode show up here until you mark them paid.</Empty> : (
        <div className="space-y-6">
          {groups.map(([handle, list]) => {
            const sub = list.reduce((n, s) => n + Number(s.unit_price) * s.quantity, 0)
            return (
              <section key={handle}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-lg font-bold">{handle} <span className="font-normal text-neutral-600">· {fmtMoney(sub)}</span></div>
                  {list.length > 1 && <Button size="sm" onClick={() => paid(list.map((s) => s.id))}>Mark all paid</Button>}
                </div>
                <div className="space-y-2">
                  {list.map((s) => (
                    <SaleRow
                      key={s.id}
                      sale={s}
                      meta={<span className={now - new Date(s.claimed_at).getTime() > 24 * 3600 * 1000 ? 'font-semibold text-red-700' : ''}>Claimed {timeAgo(s.claimed_at, now)}</span>}
                      actions={
                        <>
                          <Button size="sm" onClick={() => paid([s.id])}>Mark paid</Button>
                          <Button size="sm" variant="danger" onClick={() => release(s.id)}>Release</Button>
                        </>
                      }
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
