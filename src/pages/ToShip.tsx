import { useMemo } from 'react'
import { useData } from '../lib/data'
import { markShipped } from '../lib/api'
import { errMsg, useToast } from '../lib/toast'
import { fmtMoney, timeAgo } from '../lib/format'
import { useNow } from '../lib/hooks'
import type { Sale } from '../lib/types'
import { Button, Empty, PageHeader, Spinner } from '../components/ui'
import SaleRow from '../components/SaleRow'
import CopyButton from '../components/CopyButton'

/** Paid but not shipped, grouped by buyer so one package covers several pieces. */
export default function ToShip() {
  const { sales, loading, designById } = useData()
  const toast = useToast()
  const now = useNow()

  const groups = useMemo(() => {
    const paid = sales.filter((s) => s.status === 'paid').sort((a, b) => (a.paid_at ?? a.claimed_at).localeCompare(b.paid_at ?? b.claimed_at))
    const map = new Map<string, typeof paid>()
    for (const s of paid) {
      const k = s.buyer_handle || '(no handle)'
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return [...map.entries()]
  }, [sales])
  const count = groups.reduce((n, [, l]) => n + l.length, 0)

  async function ship(ids: string[]) {
    try { for (const id of ids) await markShipped(id); toast(ids.length > 1 ? `Marked ${ids.length} shipped` : 'Marked shipped') } catch (e) { toast(errMsg(e), 'error') }
  }

  /** One line per piece, for the packing slip or a "your order shipped" message. */
  function packingList(handle: string, list: Sale[]): string {
    const lines = list.map((s) => {
      const d = designById.get(s.design_id)
      return `• #${d?.number ?? '?'} ${d?.name ?? ''}${s.quantity > 1 ? ` ×${s.quantity}` : ''}`.trim()
    })
    return `${handle}\n${lines.join('\n')}`
  }

  if (loading) return <Spinner />
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="To ship" sub={count ? `${count} pieces for ${groups.length} buyers` : 'Nothing waiting'} />
      {groups.length === 0 ? <Empty title="Nothing to ship">Paid sales show up here until you mark them shipped.</Empty> : (
        <div className="space-y-6">
          {groups.map(([handle, list]) => (
            <section key={handle}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-bold">{handle} <span className="font-normal text-neutral-600">· {list.length} piece{list.length > 1 ? 's' : ''} · {fmtMoney(list.reduce((n, s) => n + Number(s.unit_price) * s.quantity, 0))}</span></div>
                <div className="flex gap-2">
                  <CopyButton label="Copy list" text={() => packingList(handle, list)} done="Packing list copied." />
                  {list.length > 1 && <Button size="sm" onClick={() => ship(list.map((s) => s.id))}>Ship all</Button>}
                </div>
              </div>
              <div className="space-y-2">
                {list.map((s) => (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    meta={`Paid ${timeAgo(s.paid_at ?? s.claimed_at, now)}`}
                    actions={<Button size="sm" onClick={() => ship([s.id])}>Mark shipped</Button>}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
