import { useRef, useState } from 'react'
import { useData } from '../lib/data'
import { importDesigns } from '../lib/api'
import { designsToCsvRows, downloadText, parseDesignsCsv, toCsv, type ImportResult } from '../lib/csv'
import { localDate } from '../lib/format'
import { errMsg, useToast } from '../lib/toast'
import { CHANNEL_LABEL, STATUS_LABEL } from '../lib/types'
import { Button, Card, PageHeader } from '../components/ui'

const SAMPLE = `number,name,type,tier,price,quantity,shop_safe,notes
1,Midnight Galaxy,pen,premium,,1,yes,Blue and purple swirl with silver flake
2,Cherry Blossom,pen,standard,,3,yes,Pink petals in clear resin
3,Honeycomb Bee,keychain,standard,,6,yes,Batch of 6
4,Spooky Season,pen,standard,22,1,yes,Discounted - small bubble near clip
5,Fan Art Pen,pen,premium,,1,no,Licensed character - Live and markets only
`

export default function ImportExport() {
  const { designs, sales, designById, photosByDesign, priceOf } = useData()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)

  const active = designs.filter((d) => !d.archived)
  const activeNumbers = new Set(active.map((d) => d.number))

  async function onFile(f: File | null) {
    if (!f) return
    setPreview(parseDesignsCsv(await f.text()))
  }

  async function doImport() {
    if (!preview) return
    setBusy(true)
    try {
      const r = await importDesigns(preview.rows, active)
      toast(`Imported: ${r.inserted} new, ${r.updated} updated`)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportInventory() {
    const rows = designsToCsvRows(designs, priceOf, (d) => photosByDesign.get(d.id)?.length ?? 0)
    downloadText(`inkwell-inventory-${localDate(new Date())}.csv`, toCsv(rows))
  }

  function exportSales() {
    const rows = sales.map((s) => {
      const d = designById.get(s.design_id)
      return {
        date: localDate(s.claimed_at),
        time: new Date(s.claimed_at).toLocaleTimeString('en-US'),
        number: d?.number ?? '',
        design: d?.name ?? '',
        type: d?.type ?? '',
        tier: d?.tier ?? '',
        quantity: s.quantity,
        price_each: Number(s.unit_price).toFixed(2),
        total: (Number(s.unit_price) * s.quantity).toFixed(2),
        buyer: s.buyer_handle,
        channel: CHANNEL_LABEL[s.channel],
        status: STATUS_LABEL[s.status],
        paid_date: localDate(s.paid_at),
        shipped_date: localDate(s.shipped_at),
        cancelled_date: localDate(s.cancelled_at),
        notes: s.notes,
      }
    })
    downloadText(`inkwell-sales-${localDate(new Date())}.csv`, toCsv(rows))
  }

  const newRows = preview?.rows.filter((r) => !activeNumbers.has(r.number)).length ?? 0
  const updRows = (preview?.rows.length ?? 0) - newRows
  const keepQty = preview?.rows.filter((r) => activeNumbers.has(r.number) && r.quantity == null).length ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Import / Export" />

      <Card>
        <h2 className="font-brand text-2xl">Import designs from CSV</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Columns: <code>number, name, type, tier, price, quantity, shop_safe, notes</code>. Leave <code>price</code> blank to use the tier price.
          Rows whose number matches an existing active design update it; the rest are added. Leave <code>quantity</code> blank to keep an existing design's stock as it is.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadText('inkwell-sample-import.csv', SAMPLE)}>Download sample CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <Button onClick={() => fileRef.current?.click()}>Choose CSV file…</Button>
        </div>

        {preview && (
          <div className="mt-4">
            {preview.errors.length > 0 && (
              <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <b>{preview.errors.length} problem{preview.errors.length > 1 ? 's' : ''} (those rows will be skipped):</b>
                <ul className="mt-1 list-disc pl-5">{preview.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <p className="font-semibold">{preview.rows.length} rows ready: {newRows} new, {updRows} updates{keepQty ? ` (${keepQty} keep their current stock)` : ''}.</p>
            {updRows > 0 && updRows !== keepQty && (
              <p className="mt-1 text-sm text-neutral-600">Updates with a quantity in the file will <b>replace</b> that design's stock count. Clear the quantity cells first if you only meant to fix names or prices.</p>
            )}
            <div className="mt-2 max-h-64 overflow-auto rounded-xl border-2 border-black text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-black text-left text-white"><tr>{['#', 'Name', 'Type', 'Tier', 'Price', 'Qty', 'Shop-safe'].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const upd = activeNumbers.has(r.number)
                    return (
                      <tr key={r.number} className={`border-t ${upd ? 'bg-accent-soft' : ''}`}>
                        <td className="px-2 py-1 font-bold">{r.number}</td><td className="px-2 py-1">{r.name}</td><td className="px-2 py-1">{r.type}</td>
                        <td className="px-2 py-1">{r.tier}</td><td className="px-2 py-1">{r.price_override ?? 'tier'}</td>
                        <td className="px-2 py-1">{r.quantity ?? (upd ? 'keep' : 1)}</td><td className="px-2 py-1">{r.shop_safe ? 'yes' : 'no'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="lg" onClick={doImport} disabled={busy || preview.rows.length === 0}>{busy ? 'Importing…' : `Import ${preview.rows.length} rows`}</Button>
              <Button size="lg" variant="secondary" onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-brand text-2xl">Export for records and taxes</h2>
        <p className="mt-1 text-sm text-neutral-600">Downloads open in Excel, Numbers or Google Sheets. Dates are in your local time.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportInventory}>Export inventory ({designs.length})</Button>
          <Button variant="secondary" onClick={exportSales}>Export sales ({sales.length})</Button>
        </div>
      </Card>
    </div>
  )
}
