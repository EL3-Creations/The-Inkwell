import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { fmtMoney } from '../lib/format'
import { Badge, Button, Empty, PageHeader, Segmented, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { TIER_LABEL } from '../lib/types'

type Tri = 'all' | 'standard' | 'premium'
type TypeF = 'all' | 'pen' | 'keychain'
type SafeF = 'all' | 'yes' | 'no'
type StockF = 'all' | 'in' | 'out'

export default function Inventory() {
  const { designs, loading, priceOf } = useData()
  const [q, setQ] = useState('')
  const [tier, setTier] = useState<Tri>('all')
  const [type, setType] = useState<TypeF>('all')
  const [safe, setSafe] = useState<SafeF>('all')
  const [stock, setStock] = useState<StockF>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return designs.filter((d) => {
      if (d.archived !== showArchived) return false
      if (tier !== 'all' && d.tier !== tier) return false
      if (type !== 'all' && d.type !== type) return false
      if (safe !== 'all' && d.shop_safe !== (safe === 'yes')) return false
      if (stock === 'in' && d.quantity === 0) return false
      if (stock === 'out' && d.quantity > 0) return false
      if (needle) {
        if (/^\d+$/.test(needle)) return String(d.number).startsWith(needle)
        return d.name.toLowerCase().includes(needle) || d.notes.toLowerCase().includes(needle)
      }
      return true
    })
  }, [designs, q, tier, type, safe, stock, showArchived])

  const filtersOn = tier !== 'all' || type !== 'all' || safe !== 'all' || stock !== 'all' || showArchived

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Inventory"
        sub={`${list.length} of ${designs.filter((d) => !d.archived).length} designs`}
        right={<Link to="/designs/new"><Button variant="accent">+ Add design</Button></Link>}
      />

      <div className="flex gap-2">
        <input
          className="field flex-1"
          placeholder="Search number or name"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button variant={filtersOn ? 'primary' : 'secondary'} onClick={() => setShowFilters((v) => !v)}>Filters</Button>
      </div>

      {showFilters && (
        <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border-2 border-black p-3">
          <Segmented value={tier} onChange={setTier} options={[{ value: 'all', label: 'All tiers' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }]} />
          <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'All types' }, { value: 'pen', label: 'Pens' }, { value: 'keychain', label: 'Keychains' }]} />
          <Segmented value={safe} onChange={setSafe} options={[{ value: 'all', label: 'Any' }, { value: 'yes', label: 'Shop-safe' }, { value: 'no', label: 'Not Shop-safe' }]} />
          <Segmented value={stock} onChange={setStock} options={[{ value: 'all', label: 'All stock' }, { value: 'in', label: 'In stock' }, { value: 'out', label: 'Sold out' }]} />
          <label className="flex min-h-11 items-center gap-2 px-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
          </label>
        </div>
      )}

      {list.length === 0 ? (
        <div className="mt-6">
          <Empty title={designs.length === 0 ? 'No designs yet' : 'Nothing matches'}>
            {designs.length === 0 ? <>Add one with the button above, or <Link to="/import" className="underline">import a CSV</Link>.</> : 'Try clearing the search or filters.'}
          </Empty>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((d) => (
            <Link key={d.id} to={`/designs/${d.id}`} className="group overflow-hidden rounded-2xl border-2 border-black bg-white hover:shadow-md">
              <div className="relative aspect-square">
                <PhotoImg designId={d.id} className="h-full w-full" />
                <span className="absolute left-2 top-2 rounded-full bg-black px-2.5 py-1 text-base font-bold text-white">#{d.number}</span>
                {d.quantity === 0 && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xl font-bold uppercase tracking-widest">Sold out</div>}
                {!d.shop_safe && <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">No Shop</span>}
              </div>
              <div className="p-2">
                <div className="truncate font-semibold">{d.name || <span className="text-neutral-400">Untitled</span>}</div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <Badge tone={d.tier === 'premium' ? 'rose' : 'outline'}>{TIER_LABEL[d.tier]}</Badge>
                  <span className="text-sm font-bold">{fmtMoney(priceOf(d))}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">{d.type === 'pen' ? 'Pen' : 'Keychain'} · {d.quantity} in stock</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
