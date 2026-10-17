import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../lib/data'
import { cancelSale, claim, endLive, markPaid, startLive } from '../lib/api'
import { errMsg, useToast } from '../lib/toast'
import { fmtMoney, fmtTime, fmtDateTime, normalizeHandle } from '../lib/format'
import { Button, Card, Field, PageHeader } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { useNow } from '../lib/hooks'

/**
 * Phone-first screen for use during a TikTok Live.
 * Big keypad -> design preview -> buyer handle -> one big Claim button.
 */
export default function Live() {
  const { activeSession, sessions, sales, designByNumber, designById, priceOf } = useData()
  const toast = useToast()
  const now = useNow(1000 * 30)

  const [numberStr, setNumberStr] = useState('')
  const [handle, setHandle] = useState('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')
  const handleRef = useRef<HTMLInputElement>(null)

  const design = useMemo(() => {
    const n = parseInt(numberStr, 10)
    return Number.isFinite(n) ? designByNumber.get(n) : undefined
  }, [numberStr, designByNumber])

  const claims = useMemo(
    () => (activeSession ? sales.filter((s) => s.live_session_id === activeSession.id && s.status !== 'cancelled') : []),
    [sales, activeSession],
  )
  const total = claims.reduce((n, s) => n + Number(s.unit_price) * s.quantity, 0)
  const pieces = claims.reduce((n, s) => n + s.quantity, 0)
  const recentHandles = useMemo(() => {
    const seen: string[] = []
    for (const s of claims) if (s.buyer_handle && !seen.includes(s.buyer_handle)) seen.push(s.buyer_handle)
    return seen.slice(0, 6)
  }, [claims])

  useEffect(() => { setQty(1) }, [numberStr])

  const canClaim = !!design && design.quantity >= qty && !busy && normalizeHandle(handle) !== ''

  async function doClaim() {
    if (!design || !activeSession || !canClaim) return
    setBusy(true)
    try {
      await claim({
        designId: design.id, quantity: qty, buyerHandle: normalizeHandle(handle), channel: 'live',
        unitPrice: priceOf(design), liveSessionId: activeSession.id, status: 'claimed',
      })
      toast(`Claimed #${design.number} for ${normalizeHandle(handle)}`)
      setNumberStr(''); setHandle(''); setQty(1)
      handleRef.current?.blur()   // put the keyboard away so the keypad is ready for the next number
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doUndo(saleId: string) {
    if (!confirm('Release this claim back to stock?')) return
    try { await cancelSale(saleId); toast('Released') } catch (e) { toast(errMsg(e), 'error') }
  }

  async function doStart() {
    try { await startLive(label.trim()); setLabel('') } catch (e) { toast(errMsg(e), 'error') }
  }

  async function doEnd() {
    if (!activeSession) return
    if (!confirm(`End this Live? ${claims.length} claims, ${fmtMoney(total)}.`)) return
    try { await endLive(activeSession.id); toast('Live ended') } catch (e) { toast(errMsg(e), 'error') }
  }

  function key(k: string) {
    if (k === '⌫') setNumberStr((s) => s.slice(0, -1))
    else if (k === 'C') setNumberStr('')
    else setNumberStr((s) => (s.length < 4 ? s + k : s))
  }

  // ---------- Not live: start screen + past Lives ----------
  if (!activeSession) {
    const past = sessions.filter((s) => s.ended_at).slice(0, 8)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Live mode" />
        <Card className="dots-rose">
          <Field label="Label (optional)">
            <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Friday night Live" />
          </Field>
          <Button size="xl" className="mt-3 w-full" onClick={doStart}>● Start Live</Button>
        </Card>
        {past.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-brand text-2xl">Past Lives</h2>
            <div className="space-y-2">
              {past.map((s) => {
                const list = sales.filter((x) => x.live_session_id === s.id && x.status !== 'cancelled')
                const t = list.reduce((n, x) => n + Number(x.unit_price) * x.quantity, 0)
                const unpaid = list.filter((x) => x.status === 'claimed').length
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-2xl border-2 border-black p-3">
                    <div>
                      <div className="font-semibold">{s.label || 'Live'}</div>
                      <div className="text-sm text-neutral-600">{fmtDateTime(s.started_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{fmtMoney(t)}</div>
                      <div className="text-sm text-neutral-600">{list.length} claims{unpaid ? <span className="font-semibold text-red-700"> · {unpaid} unpaid</span> : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    )
  }

  // ---------- Live ----------
  const mins = Math.max(0, Math.floor((now - new Date(activeSession.started_at).getTime()) / 60000))
  return (
    <div className="mx-auto max-w-5xl md:grid md:grid-cols-2 md:gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 font-brand text-3xl"><span className="text-red-600">●</span> {activeSession.label || 'Live'}</div>
            <div className="text-sm text-neutral-600">{mins} min · {pieces} pieces · {fmtMoney(total)}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={doEnd}>End Live</Button>
        </div>

        {/* Design preview */}
        <div className={`mb-3 flex min-h-24 items-center gap-3 rounded-2xl border-2 p-2 ${design ? 'border-black' : 'border-dashed border-neutral-300'}`}>
          {design ? (
            <>
              <PhotoImg designId={design.id} className="h-20 w-20 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-bold">#{design.number} {design.name}</div>
                <div className="text-base">{fmtMoney(priceOf(design))} · <span className={design.quantity === 0 ? 'font-bold text-red-700' : ''}>{design.quantity} left</span>{!design.shop_safe && <span className="ml-2 rounded-full bg-red-600 px-2 text-xs font-bold text-white">No Shop</span>}</div>
                {design.quantity > 1 && (
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    Qty
                    <button type="button" className="h-9 w-9 rounded-lg border-2 border-black font-bold" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                    <span className="w-6 text-center text-lg font-bold">{qty}</span>
                    <button type="button" className="h-9 w-9 rounded-lg border-2 border-black font-bold" onClick={() => setQty((q) => Math.min(design.quantity, q + 1))}>+</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 text-center text-neutral-500">
              {numberStr ? <span className="font-semibold text-red-700">No active design #{numberStr}</span> : 'Tap a pegboard number'}
            </div>
          )}
        </div>

        {/* Number display + keypad */}
        <div className="mb-2 flex min-h-16 items-center justify-center rounded-2xl border-2 border-black text-4xl font-bold tracking-widest">
          {numberStr ? `#${numberStr}` : <span className="text-neutral-300">#</span>}
        </div>
        <div className="no-select grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => key(k)}
              className={`min-h-16 rounded-2xl border-2 border-black text-3xl font-bold active:bg-black active:text-white ${k === 'C' || k === '⌫' ? 'bg-neutral-100 text-xl' : 'bg-white'}`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Handle + Claim */}
        <div className="mt-3">
          <input
            ref={handleRef}
            className="field text-xl"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@buyer handle"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void doClaim() } }}
          />
          {recentHandles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {recentHandles.map((h) => (
                <button key={h} type="button" onClick={() => setHandle(h)} className="min-h-10 rounded-full border-2 border-black px-3 text-sm font-semibold hover:bg-neutral-100">{h}</button>
              ))}
            </div>
          )}
        </div>
        <Button size="xl" variant="accent" className="mt-3 w-full" disabled={!canClaim} onClick={doClaim}>
          {busy ? 'Claiming…'
            : !design ? 'Claim'
            : design.quantity < qty ? 'Sold out'
            : !normalizeHandle(handle) ? `Enter handle for #${design.number}`
            : `Claim #${design.number}${qty > 1 ? ` ×${qty}` : ''} · ${fmtMoney(priceOf(design) * qty)}`}
        </Button>
      </div>

      {/* Running list */}
      <div className="mt-6 md:mt-0">
        <h2 className="mb-2 flex items-center justify-between font-brand text-2xl">
          <span>This Live's claims</span>
          <span>{claims.length} · {fmtMoney(total)}</span>
        </h2>
        {claims.length === 0 ? (
          <p className="text-neutral-500">No claims yet.</p>
        ) : (
          <div className="space-y-2">
            {claims.map((s) => {
              const d = designById.get(s.design_id)
              return (
                <div key={s.id} className="rounded-2xl border-2 border-black p-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate font-bold">#{d?.number} {d?.name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}</div>
                    <div className="shrink-0 font-bold">{fmtMoney(Number(s.unit_price) * s.quantity)}</div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate text-sm text-neutral-700">{s.buyer_handle} · {fmtTime(s.claimed_at)}</div>
                    {s.status === 'claimed' ? (
                      <>
                        <Button size="sm" onClick={() => markPaid(s.id).then(() => toast('Marked paid')).catch((e) => toast(errMsg(e), 'error'))}>Paid</Button>
                        <Button size="sm" variant="danger" onClick={() => doUndo(s.id)}>Undo</Button>
                      </>
                    ) : (
                      <span className="rounded-full bg-green-600 px-2 py-1 text-xs font-bold uppercase text-white">{s.status}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
