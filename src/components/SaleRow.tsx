import type { ReactNode } from 'react'
import PhotoImg from './PhotoImg'
import { Badge } from './ui'
import { useData } from '../lib/data'
import { fmtMoney, fmtDateTime } from '../lib/format'
import { CHANNEL_LABEL, type Sale } from '../lib/types'

/**
 * One sale as a card: photo, design, buyer, amount on top; any page-specific
 * action buttons in a full-width row underneath (big tap targets on phones).
 */
export default function SaleRow({ sale, actions, meta, badge, onClick }: {
  sale: Sale; actions?: ReactNode; meta?: ReactNode; badge?: ReactNode; onClick?: () => void
}) {
  const { designById } = useData()
  const d = designById.get(sale.design_id)
  const total = Number(sale.unit_price) * sale.quantity
  const body = (
    <div className="flex gap-3">
      {d && <PhotoImg designId={d.id} className="h-16 w-16 shrink-0 rounded-xl" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-lg font-bold">#{d?.number ?? '?'}</span>{' '}
            <span className="font-semibold">{d?.name ?? 'Unknown design'}</span>
            {sale.quantity > 1 && <> <Badge tone="gray">×{sale.quantity}</Badge></>}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-bold">{fmtMoney(total)}</div>
            {badge}
          </div>
        </div>
        <div className="truncate text-sm text-neutral-700">
          {sale.buyer_handle || <span className="italic text-neutral-400">no handle</span>} · {CHANNEL_LABEL[sale.channel]}
        </div>
        <div className="text-sm text-neutral-500">{meta ?? fmtDateTime(sale.claimed_at)}</div>
      </div>
    </div>
  )
  return (
    <div className={`rounded-2xl border-2 border-black bg-white p-3 ${sale.status === 'cancelled' ? 'opacity-50' : ''}`}>
      {onClick ? <button type="button" onClick={onClick} className="block w-full text-left">{body}</button> : body}
      {actions && <div className="mt-3 flex gap-2 [&>*]:flex-1">{actions}</div>}
    </div>
  )
}
