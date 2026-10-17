import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import PhotoImg from './PhotoImg'
import { Button, Field } from './ui'
import { useData } from '../lib/data'
import { claim } from '../lib/api'
import { errMsg, useToast } from '../lib/toast'
import { fmtMoney, normalizeHandle, parseMoney, toLocalInputValue } from '../lib/format'
import { CHANNEL_LABEL, type Channel, type Design, type SaleStatus } from '../lib/types'

/**
 * "Add sale" form used from the Sales page and the design page.
 * TikTok Shop and market sales are usually already paid, so the status defaults accordingly.
 */
export default function SaleModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: Design }) {
  const { designByNumber, priceOf, activeSession } = useData()
  const toast = useToast()
  const [numberStr, setNumberStr] = useState('')
  const [qty, setQty] = useState(1)
  const [handle, setHandle] = useState('')
  const [channel, setChannel] = useState<Channel>('shop')
  const [price, setPrice] = useState('')
  const [status, setStatus] = useState<Exclude<SaleStatus, 'cancelled'>>('paid')
  const [when, setWhen] = useState(toLocalInputValue(new Date()))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const design = useMemo(() => {
    if (preset) return preset
    const n = parseInt(numberStr, 10)
    return Number.isFinite(n) ? designByNumber.get(n) : undefined
  }, [preset, numberStr, designByNumber])

  useEffect(() => {
    if (!open) return
    setNumberStr(preset ? String(preset.number) : '')
    setQty(1); setHandle(''); setChannel('shop'); setStatus('paid'); setNotes('')
    setWhen(toLocalInputValue(new Date()))
    setPrice(preset ? priceOf(preset).toFixed(2) : '')
  }, [open, preset, priceOf])

  // Default price follows the chosen design until the user edits it.
  useEffect(() => {
    if (design && !preset) setPrice(priceOf(design).toFixed(2))
  }, [design, preset, priceOf])

  // Live channel usually means "claimed, not yet paid".
  useEffect(() => { setStatus(channel === 'live' ? 'claimed' : 'paid') }, [channel])

  const unit = parseMoney(price)
  const when_ = new Date(when)
  const badWhen = Number.isNaN(when_.getTime())

  async function submit() {
    if (!design || unit === null || badWhen) return
    setBusy(true)
    try {
      await claim({
        designId: design.id,
        quantity: qty,
        buyerHandle: normalizeHandle(handle),
        channel,
        unitPrice: unit,
        status,
        notes,
        claimedAt: when_,
        liveSessionId: channel === 'live' ? activeSession?.id ?? null : null,
      })
      toast(`Sale recorded: #${design.number} ${design.name}`)
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add sale">
      <div className="space-y-4">
        {!preset && (
          <Field label="Pegboard number">
            <input className="field text-2xl font-bold" inputMode="numeric" value={numberStr} onChange={(e) => setNumberStr(e.target.value.replace(/\D/g, ''))} autoFocus />
          </Field>
        )}
        {design ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-black p-2">
            <PhotoImg designId={design.id} className="h-16 w-16 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">#{design.number} {design.name}</div>
              <div className="text-sm text-neutral-600">{design.quantity} in stock · {fmtMoney(priceOf(design))}</div>
            </div>
          </div>
        ) : numberStr ? (
          <p className="text-sm text-red-700">No active design with that number.</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input className="field" type="number" min={1} max={design?.quantity ?? 99} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} />
          </Field>
          <Field label="Price each">
            <input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <Field label="Buyer's TikTok handle">
          <input className="field" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@buyer" autoCapitalize="none" autoCorrect="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel">
            <select className="field" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value as Exclude<SaleStatus, 'cancelled'>)}>
              <option value="claimed">Claimed (unpaid)</option>
              <option value="paid">Paid</option>
              <option value="shipped">Shipped / handed over</option>
            </select>
          </Field>
        </div>
        <Field label="Date">
          <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Notes">
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button size="lg" className="w-full" disabled={!design || busy || design.quantity < qty || unit === null || badWhen} onClick={submit}>
          {busy ? 'Saving…' : design && design.quantity < qty ? `Only ${design.quantity} in stock` : unit === null ? 'Enter a price' : badWhen ? 'Pick a date' : `Record sale · ${fmtMoney(unit * qty)}`}
        </Button>
      </div>
    </Modal>
  )
}
