import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { addPhoto, createDesign, deleteDesign, removePhoto, setArchived, setCoverPhoto, updateDesign, type DesignInput } from '../lib/api'
import { errMsg, useToast } from '../lib/toast'
import { fmtMoney, fmtDateTime, parseMoney } from '../lib/format'
import { photoUrl } from '../lib/supabase'
import { CHANNEL_LABEL, STATUS_LABEL, type Design, type DesignPhoto, type DesignType, type Tier } from '../lib/types'
import { Badge, Button, Field, PageHeader, Segmented, Spinner } from '../components/ui'
import SaleModal from '../components/SaleModal'

export default function DesignDetail() {
  const { id } = useParams()
  const isNew = !id
  const nav = useNavigate()
  const toast = useToast()
  const { designs, designById, photosByDesign, sales, settings, loading, priceOf } = useData()
  const existing = id ? designById.get(id) : undefined

  const [form, setForm] = useState<DesignInput>({
    number: 0, name: '', type: 'pen', tier: 'standard', price_override: null, quantity: 1, shop_safe: true, notes: '',
  })
  const [priceStr, setPriceStr] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sell, setSell] = useState(false)
  const [uploading, setUploading] = useState(0)
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const suggested = useRef(false)

  // Load the existing design into the form (once, or when it changes on the other phone and we haven't edited).
  useEffect(() => {
    if (!existing || dirty) return
    setForm({
      number: existing.number, name: existing.name, type: existing.type, tier: existing.tier,
      price_override: existing.price_override, quantity: existing.quantity, shop_safe: existing.shop_safe, notes: existing.notes,
    })
    setPriceStr(existing.price_override != null ? Number(existing.price_override).toFixed(2) : '')
  }, [existing, dirty])

  // Suggest the next free pegboard number for a new design, once, so the field can still be cleared and retyped.
  useEffect(() => {
    if (!isNew || loading || suggested.current) return
    suggested.current = true
    const used = new Set(designs.filter((d) => !d.archived).map((d) => d.number))
    let n = 1
    while (used.has(n)) n++
    setForm((f) => ({ ...f, number: n }))
  }, [isNew, loading, designs])

  const set = <K extends keyof DesignInput>(k: K, v: DesignInput[K]) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true) }

  const numberTaken = useMemo(
    () => designs.some((d) => !d.archived && d.number === form.number && d.id !== id),
    [designs, form.number, id],
  )
  const tierPrice = settings ? Number(form.tier === 'premium' ? settings.premium_price : settings.standard_price) : 0
  const priceValue = priceStr.trim() === '' ? null : parseMoney(priceStr)
  const priceInvalid = priceStr.trim() !== '' && priceValue === null
  const photos = id ? photosByDesign.get(id) ?? [] : []
  const history = useMemo(() => sales.filter((s) => s.design_id === id), [sales, id])

  async function save() {
    if (numberTaken) { toast(`Number ${form.number} is already used by another active design`, 'error'); return }
    if (priceInvalid) { toast('Enter a price like 22.00, or leave it blank for the tier price', 'error'); return }
    setBusy(true)
    try {
      const payload: DesignInput = { ...form, price_override: priceValue }
      if (isNew) {
        const d = await createDesign(payload)
        toast('Design added. Now add photos.')
        nav(`/designs/${d.id}`, { replace: true })
      } else {
        await updateDesign(id!, payload)
        toast('Saved')
      }
      setDirty(false)
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || !existing) return
    const list = Array.from(files)
    setUploading(list.length)
    const start = photos.length
    for (const [i, f] of list.entries()) {
      try {
        await addPhoto(existing, f, start + i)
      } catch (e) {
        toast(`Photo failed: ${errMsg(e)}`, 'error')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (cameraRef.current) cameraRef.current.value = ''
    if (uploadRef.current) uploadRef.current.value = ''
  }

  async function onRemovePhoto(p: DesignPhoto) {
    if (!confirm('Delete this photo?')) return
    try { await removePhoto(p) } catch (e) { toast(errMsg(e), 'error') }
  }

  async function onArchive(archived: boolean) {
    if (!existing) return
    try {
      await setArchived(existing.id, archived)
      toast(archived ? `Archived. Number ${existing.number} is free again.` : 'Restored')
      if (archived) nav('/inventory')
    } catch (e) { toast(errMsg(e), 'error') }
  }

  async function onDelete() {
    if (!existing) return
    if (history.length) { toast('This design has sales, so it can\'t be deleted. Archive it instead.', 'error'); return }
    if (!confirm(`Delete #${existing.number} ${existing.name} for good?`)) return
    try {
      await Promise.all(photos.map(removePhoto))
      await deleteDesign(existing.id)
      nav('/inventory')
    } catch (e) { toast(errMsg(e), 'error') }
  }

  if (loading) return <Spinner />
  if (!isNew && !existing) return <div><p>Design not found.</p><Link to="/inventory" className="underline">Back to inventory</Link></div>

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isNew ? 'New design' : `#${existing!.number} ${existing!.name}`}
        sub={existing?.archived ? 'Archived' : undefined}
        right={!isNew && !existing?.archived && <Button variant="accent" onClick={() => setSell(true)} disabled={existing!.quantity === 0}>Sell</Button>}
      />

      {/* Photos */}
      {!isNew && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-brand text-2xl">Photos</h2>
            <div className="flex gap-2">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFiles(e.target.files)} />
              <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
              <Button size="sm" onClick={() => cameraRef.current?.click()}>📷 Take photo</Button>
              <Button size="sm" variant="secondary" onClick={() => uploadRef.current?.click()}>Upload</Button>
            </div>
          </div>
          {uploading > 0 && <p className="mb-2 text-sm text-neutral-600">Compressing and uploading {uploading} photo{uploading > 1 ? 's' : ''}…</p>}
          {photos.length === 0 && uploading === 0 ? (
            <div className="dots-light rounded-2xl border-2 border-dashed border-neutral-300 p-6 text-center text-neutral-500">No photos yet. Tap “Take photo”.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <div key={p.id} className="relative overflow-hidden rounded-xl border-2 border-black">
                  <img src={photoUrl(p.storage_path)} alt="" className="aspect-square w-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-black px-2 text-xs font-bold text-white">Cover</span>}
                  <div className="flex">
                    {i !== 0 && <button type="button" className="min-h-10 flex-1 text-xs font-semibold hover:bg-neutral-100" onClick={() => setCoverPhoto(photos, p.id)}>Make cover</button>}
                    <button type="button" className="min-h-10 flex-1 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => onRemovePhoto(p)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Form */}
      <section className="space-y-4 rounded-2xl border-2 border-black p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pegboard number" hint={numberTaken ? `Already used by an active design` : undefined}>
            <input className={`field text-2xl font-bold ${numberTaken ? 'border-red-600' : ''}`} inputMode="numeric" value={form.number || ''} onChange={(e) => set('number', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)} />
          </Field>
          <Field label="Quantity in stock">
            <div className="flex">
              <button type="button" className="min-h-12 w-12 rounded-l-xl border-2 border-black text-xl font-bold" onClick={() => set('quantity', Math.max(0, form.quantity - 1))}>−</button>
              <input className="field rounded-none border-x-0 text-center text-2xl font-bold" inputMode="numeric" value={form.quantity} onChange={(e) => set('quantity', Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0))} />
              <button type="button" className="min-h-12 w-12 rounded-r-xl border-2 border-black text-xl font-bold" onClick={() => set('quantity', form.quantity + 1)}>+</button>
            </div>
          </Field>
        </div>
        <Field label="Name">
          <input className="field" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Midnight Galaxy" />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Field label="Type">
            <Segmented<DesignType> value={form.type} onChange={(v) => set('type', v)} options={[{ value: 'pen', label: 'Pen' }, { value: 'keychain', label: 'Keychain' }]} />
          </Field>
          <Field label="Tier">
            <Segmented<Tier> value={form.tier} onChange={(v) => set('tier', v)} options={[{ value: 'standard', label: `Standard` }, { value: 'premium', label: `Premium` }]} />
          </Field>
        </div>
        <Field
          label="Price"
          hint={priceInvalid ? 'That is not a price. Type a number like 22.00, or clear it to use the tier price.'
            : priceStr.trim() === '' ? `Using the ${form.tier} tier price, ${fmtMoney(tierPrice)}. Type a price to override it.`
            : `Overriding the tier price (${fmtMoney(tierPrice)}). Clear to use the tier price.`}
        >
          <input className={`field ${priceInvalid ? 'border-red-600' : ''}`} inputMode="decimal" placeholder={tierPrice.toFixed(2)} value={priceStr} onChange={(e) => { setPriceStr(e.target.value); setDirty(true) }} />
        </Field>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-black px-3">
          <input type="checkbox" className="h-6 w-6" checked={form.shop_safe} onChange={(e) => set('shop_safe', e.target.checked)} />
          <span className="whitespace-nowrap font-semibold">Shop-safe</span>
          <span className="text-sm text-neutral-600">(uncheck for licensed characters or brand logos)</span>
        </label>
        <Field label="Notes">
          <textarea className="field" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={save} disabled={busy || !form.number || numberTaken || priceInvalid}>{busy ? 'Saving…' : isNew ? 'Add design' : 'Save changes'}</Button>
          {!isNew && dirty && <Button size="lg" variant="secondary" onClick={() => setDirty(false)}>Discard</Button>}
        </div>
      </section>

      {/* History + danger zone */}
      {!isNew && existing && (
        <>
          <section className="mt-6">
            <h2 className="mb-2 font-brand text-2xl">Sales history</h2>
            {history.length === 0 ? <p className="text-neutral-500">No sales yet.</p> : (
              <div className="divide-y-2 divide-neutral-200 rounded-2xl border-2 border-black">
                {history.map((s) => (
                  <Link key={s.id} to="/sales" className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-neutral-50">
                    <div>
                      <div className="font-semibold">{s.buyer_handle || 'no handle'} · {CHANNEL_LABEL[s.channel]}{s.quantity > 1 ? ` ×${s.quantity}` : ''}</div>
                      <div className="text-neutral-500">{fmtDateTime(s.claimed_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{fmtMoney(Number(s.unit_price) * s.quantity)}</span>
                      <Badge tone={s.status === 'cancelled' ? 'gray' : s.status === 'claimed' ? 'rose' : s.status === 'paid' ? 'black' : 'green'}>{STATUS_LABEL[s.status]}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 flex flex-wrap gap-2">
            {existing.archived
              ? <Button variant="secondary" onClick={() => onArchive(false)}>Restore from archive</Button>
              : <Button variant="secondary" onClick={() => onArchive(true)}>Archive (frees number {existing.number})</Button>}
            <Button variant="danger" onClick={onDelete}>Delete</Button>
          </section>

          <SaleModal open={sell} onClose={() => setSell(false)} preset={existing as Design} />
          <p className="mt-4 text-xs text-neutral-400">Current sale price: {fmtMoney(priceOf(existing))}</p>
        </>
      )}
    </div>
  )
}
