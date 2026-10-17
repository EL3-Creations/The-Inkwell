import { useMemo, useState } from 'react'
import { useData } from '../lib/data'
import { cancelSale, markPaid, markShipped, setSaleQuantity, stepBack, updateSaleDetails } from '../lib/api'
import { errMsg, useToast } from '../lib/toast'
import { fmtMoney, normalizeHandle, parseMoney, toLocalInputValue } from '../lib/format'
import { CHANNEL_LABEL, STATUS_LABEL, type Channel, type Sale, type SaleStatus } from '../lib/types'
import { Badge, Button, Empty, Field, PageHeader, Segmented, Spinner } from '../components/ui'
import SaleRow from '../components/SaleRow'
import SaleModal from '../components/SaleModal'
import Modal from '../components/Modal'

type StatusF = 'all' | SaleStatus
type ChannelF = 'all' | Channel

export default function Sales() {
  const { sales, designById, loading } = useData()
  const [status, setStatus] = useState<StatusF>('all')
  const [channel, setChannel] = useState<ChannelF>('all')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Sale | null>(null)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return sales.filter((s) => {
      if (status !== 'all' && s.status !== status) return false
      if (channel !== 'all' && s.channel !== channel) return false
      if (needle) {
        const d = designById.get(s.design_id)
        return s.buyer_handle.toLowerCase().includes(needle) || String(d?.number) === needle || (d?.name.toLowerCase().includes(needle) ?? false)
      }
      return true
    })
  }, [sales, status, channel, q, designById])

  const total = list.filter((s) => s.status !== 'cancelled').reduce((n, s) => n + Number(s.unit_price) * s.quantity, 0)

  if (loading) return <Spinner />
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Sales" sub={`${list.length} sales · ${fmtMoney(total)}`} right={<Button variant="accent" onClick={() => setAdding(true)}>+ Add sale</Button>} />
      <input className="field mb-3" placeholder="Search handle, number or name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'claimed', label: 'Claimed' }, { value: 'paid', label: 'Paid' }, { value: 'shipped', label: 'Shipped' }, { value: 'cancelled', label: 'Cancelled' }]} />
        <Segmented value={channel} onChange={setChannel} options={[{ value: 'all', label: 'All channels' }, { value: 'shop', label: 'Shop' }, { value: 'live', label: 'Live' }, { value: 'market', label: 'Market' }, { value: 'other', label: 'Other' }]} />
      </div>
      {list.length === 0 ? <Empty title="No sales here yet" /> : (
        <div className="space-y-2">
          {list.map((s) => (
            <SaleRow key={s.id} sale={s} onClick={() => setEditing(s)} badge={<StatusPill status={s.status} />} />
          ))}
        </div>
      )}
      <SaleModal open={adding} onClose={() => setAdding(false)} />
      {editing && <EditSale sale={sales.find((s) => s.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function StatusPill({ status }: { status: SaleStatus }) {
  const tone = status === 'cancelled' ? 'gray' : status === 'claimed' ? 'rose' : status === 'paid' ? 'black' : 'green'
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>
}

function EditSale({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const toast = useToast()
  const { designById } = useData()
  const d = designById.get(sale.design_id)
  const [handle, setHandle] = useState(sale.buyer_handle)
  const [channel, setChannel] = useState<Channel>(sale.channel)
  const [price, setPrice] = useState(Number(sale.unit_price).toFixed(2))
  const [qty, setQty] = useState(sale.quantity)
  const [when, setWhen] = useState(toLocalInputValue(new Date(sale.claimed_at)))
  const [notes, setNotes] = useState(sale.notes)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await fn(); toast(msg); onClose() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  async function save() {
    const unit = parseMoney(price)
    if (unit === null) { toast('Enter a price like 25.00', 'error'); return }
    const at = new Date(when)
    if (Number.isNaN(at.getTime())) { toast('Pick a date', 'error'); return }
    await run(async () => {
      await updateSaleDetails(sale.id, { buyer_handle: normalizeHandle(handle), channel, unit_price: unit, notes, claimed_at: at.toISOString() })
      if (qty !== sale.quantity && sale.status !== 'cancelled') await setSaleQuantity(sale.id, qty)
    }, 'Saved')
  }

  return (
    <Modal open onClose={onClose} title={`#${d?.number ?? '?'} ${d?.name ?? ''}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <StatusPill status={sale.status} />
          <div className="flex gap-2">
            {sale.status === 'claimed' && <Button size="sm" onClick={() => run(() => markPaid(sale.id), 'Marked paid')} disabled={busy}>Mark paid</Button>}
            {sale.status === 'paid' && <Button size="sm" onClick={() => run(() => markShipped(sale.id), 'Marked shipped')} disabled={busy}>Mark shipped</Button>}
            {(sale.status === 'paid' || sale.status === 'shipped') && <Button size="sm" variant="secondary" onClick={() => run(() => stepBack(sale), 'Moved back')} disabled={busy}>Undo {sale.status}</Button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><input className="field" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} disabled={sale.status === 'cancelled'} /></Field>
          <Field label="Price each"><input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <Field label="Buyer handle"><input className="field" value={handle} onChange={(e) => setHandle(e.target.value)} autoCapitalize="none" /></Field>
        <Field label="Channel">
          <select className="field" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Date"><input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Notes"><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Button size="lg" className="w-full" onClick={save} disabled={busy}>Save</Button>
        {sale.status !== 'cancelled' && (
          <Button variant="danger" className="w-full" disabled={busy} onClick={() => { if (confirm('Cancel this sale and put the piece back in stock?')) void run(() => cancelSale(sale.id), 'Cancelled, back in stock') }}>
            Cancel sale (back to stock)
          </Button>
        )}
      </div>
    </Modal>
  )
}
