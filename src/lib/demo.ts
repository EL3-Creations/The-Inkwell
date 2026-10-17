/**
 * DEMO MODE: a fake in-memory "Supabase" so the app can be tried with no database.
 * Turned on only when VITE_DEMO=true. Any email/password signs in. Nothing is saved.
 * The real app never touches this file. It mirrors the database rules that matter
 * (stock checks, one open Live, no un-cancelling) so demo behaviour matches production.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, any>
type Store = Record<string, Row[]>

const uuid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()
const ago = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString()

function svgPhoto(hue: number, label: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'>
    <rect width='300' height='300' fill='hsl(${hue} 60% 92%)'/>
    <circle cx='150' cy='150' r='95' fill='hsl(${hue} 55% 60%)'/>
    <rect x='60' y='140' width='180' height='22' rx='11' fill='#111' transform='rotate(-35 150 150)'/>
    <text x='150' y='280' text-anchor='middle' font-size='22' font-family='sans-serif' fill='#333'>${label}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function seed(): { store: Store; urls: Map<string, string> } {
  const urls = new Map<string, string>()
  const names = ['Midnight Galaxy', 'Cherry Blossom', 'Honeycomb Bee', 'Spooky Season', 'Fan Art Pen', 'Ocean Glass', 'Lavender Fields', 'Candy Cane', 'Golden Hour', 'Ink Splash', 'Polka Bow', 'Starry Night']
  const designs: Row[] = names.map((name, i) => ({
    id: uuid(), number: i + 1, name,
    type: i % 3 === 2 ? 'keychain' : 'pen',
    tier: i % 4 === 0 ? 'premium' : 'standard',
    price_override: i === 3 ? 22 : null,
    quantity: [1, 3, 6, 1, 1, 0, 2, 5, 0, 1, 4, 2][i],
    shop_safe: i !== 4,
    notes: i === 3 ? 'Small bubble near clip' : '',
    archived: false, created_at: ago(200 - i), updated_at: ago(10),
  }))
  const photos: Row[] = designs.flatMap((d, i) => {
    if (i === 10) return []
    const path = `demo/${d.id}.jpg`
    urls.set(path, svgPhoto((i * 37) % 360, `#${d.number}`))
    return [{ id: uuid(), design_id: d.id, storage_path: path, sort_order: 0, created_at: d.created_at }]
  })
  const session = { id: uuid(), label: 'Thursday Live', started_at: ago(30), ended_at: ago(28) }
  const sale = (i: number, status: string, h: number, extra: Row = {}): Row => ({
    id: uuid(), design_id: designs[i].id, quantity: 1, buyer_handle: extra.buyer_handle ?? '@pencollector',
    channel: extra.channel ?? 'live', unit_price: designs[i].price_override ?? (designs[i].tier === 'premium' ? 40 : 25),
    status, claimed_at: ago(h),
    paid_at: status === 'paid' || status === 'shipped' ? ago(h - 1) : null,
    shipped_at: status === 'shipped' ? ago(h - 5) : null,
    cancelled_at: status === 'cancelled' ? ago(h - 1) : null,
    live_session_id: extra.channel && extra.channel !== 'live' ? null : session.id,
    notes: '', created_at: ago(h), updated_at: ago(h),
  })
  const sales = [
    sale(5, 'shipped', 29), sale(8, 'paid', 29, { buyer_handle: '@inkjunkie' }),
    sale(1, 'claimed', 28), sale(2, 'claimed', 28, { buyer_handle: '@craftymom' }),
    sale(7, 'claimed', 50, { buyer_handle: '@craftymom' }),
    sale(0, 'paid', 100, { channel: 'shop', buyer_handle: '@sparklepen' }),
    sale(6, 'shipped', 300, { channel: 'shop', buyer_handle: '@sparklepen' }),
    sale(9, 'cancelled', 29, { buyer_handle: '@ghosted' }),
  ]
  return {
    store: {
      settings: [{ id: 1, shop_name: 'The Inkwell', standard_price: 25, premium_price: 40, week_starts_on: 0, updated_at: nowIso() }],
      designs, design_photos: photos, live_sessions: [session], sales,
    },
    urls,
  }
}

export function createDemoClient(): SupabaseClient {
  const { store, urls } = seed()
  const listeners: ((p: { table: string }) => void)[] = []
  const emit = (table: string) => listeners.forEach((l) => l({ table }))
  let session: Row | null = null
  const authListeners: ((ev: string, s: Row | null) => void)[] = []
  const setSession = (s: Row | null) => { session = s; authListeners.forEach((l) => l(s ? 'SIGNED_IN' : 'SIGNED_OUT', s)) }

  /** The database rules that schema.sql enforces with constraints and triggers. */
  function check(table: string, op: 'insert' | 'update', row: Row, patch: Row): string | null {
    if (table === 'sales' && op === 'update' && row.status === 'cancelled' && patch.status && patch.status !== 'cancelled') {
      return 'This sale was already cancelled and its stock returned. Record a new sale instead.'
    }
    if (table === 'live_sessions' && op === 'insert' && store.live_sessions.some((s) => !s.ended_at)) {
      return 'duplicate key value violates unique constraint "live_sessions_one_open_idx"'
    }
    if (table === 'designs' && op === 'insert' && store.designs.some((d) => !d.archived && d.number === patch.number)) {
      return 'duplicate key value violates unique constraint "designs_active_number_idx"'
    }
    return null
  }

  class Query {
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    private filters: [string, unknown][] = []
    private orderBy: { col: string; asc: boolean } | null = null
    private slice: [number, number] | null = null
    private payload: unknown = null
    private mode: 'many' | 'single' | 'maybe' = 'many'
    constructor(private table: string) {}
    select() { return this }
    insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = rows; return this }
    update(patch: Row) { this.op = 'update'; this.payload = patch; return this }
    delete() { this.op = 'delete'; return this }
    eq(col: string, val: unknown) { this.filters.push([col, val]); return this }
    order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this }
    range(from: number, to: number) { this.slice = [from, to]; return this }
    single() { this.mode = 'single'; return this }
    maybeSingle() { this.mode = 'maybe'; return this }
    returns() { return this }
    private run() {
      const rows = store[this.table] ?? (store[this.table] = [])
      const match = (r: Row) => this.filters.every(([c, v]) => r[c] === v)
      let out: Row[]
      if (this.op === 'insert') {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[]
        for (const r of list) { const err = check(this.table, 'insert', r, r); if (err) return { data: null, error: { message: err, code: '23505' } } }
        out = list.map((r) => ({ id: uuid(), created_at: nowIso(), updated_at: nowIso(), ...(this.table === 'live_sessions' ? { started_at: nowIso(), ended_at: null } : {}), ...r }))
        rows.push(...out)
        emit(this.table)
      } else if (this.op === 'update') {
        out = rows.filter(match)
        for (const r of out) { const err = check(this.table, 'update', r, this.payload as Row); if (err) return { data: null, error: { message: err } } }
        out.forEach((r) => Object.assign(r, this.payload as Row, { updated_at: nowIso() }))
        emit(this.table)
      } else if (this.op === 'delete') {
        out = rows.filter(match)
        store[this.table] = rows.filter((r) => !match(r))
        emit(this.table)
      } else {
        out = rows.filter(match)
        if (this.orderBy) {
          const { col, asc } = this.orderBy
          out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1))
        }
        if (this.slice) out = out.slice(this.slice[0], this.slice[1] + 1)
      }
      const data = this.mode === 'many' ? out.map((r) => ({ ...r })) : out[0] ? { ...out[0] } : null
      if (this.mode === 'single' && !data) return { data: null, error: { message: 'Row not found' } }
      return { data, error: null }
    }
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve().then(() => this.run()).then(resolve, reject)
    }
  }

  const rpc = async (fn: string, args: Row) => {
    const designs = store.designs, sales = store.sales
    const err = (message: string) => ({ data: null, error: { message } })
    if (fn === 'claim_design') {
      const d = designs.find((x) => x.id === args.p_design_id && !x.archived)
      if (!d) return err('Design not found')
      if (d.quantity < args.p_quantity) return err(`Only ${d.quantity} left in stock`)
      d.quantity -= args.p_quantity
      const paid = args.p_status === 'paid' || args.p_status === 'shipped'
      const s: Row = {
        id: uuid(), design_id: d.id, quantity: args.p_quantity, buyer_handle: args.p_buyer_handle ?? '', channel: args.p_channel,
        unit_price: args.p_unit_price, status: args.p_status, claimed_at: args.p_claimed_at ?? nowIso(),
        paid_at: paid ? args.p_claimed_at : null, shipped_at: args.p_status === 'shipped' ? args.p_claimed_at : null, cancelled_at: null,
        live_session_id: args.p_live_session_id ?? null, notes: args.p_notes ?? '', created_at: nowIso(), updated_at: nowIso(),
      }
      sales.push(s); emit('designs'); emit('sales')
      return { data: { ...s }, error: null }
    }
    if (fn === 'cancel_sale') {
      const s = sales.find((x) => x.id === args.p_sale_id)
      if (!s) return err('Sale not found')
      if (s.status !== 'cancelled') {
        const d = designs.find((x) => x.id === s.design_id)
        if (d) d.quantity += s.quantity
        Object.assign(s, { status: 'cancelled', cancelled_at: nowIso() })
        emit('designs'); emit('sales')
      }
      return { data: { ...s }, error: null }
    }
    if (fn === 'set_sale_quantity') {
      const s = sales.find((x) => x.id === args.p_sale_id)
      if (!s) return err('Sale not found')
      if (s.status === 'cancelled') return err('Sale is cancelled')
      const d = designs.find((x) => x.id === s.design_id)!
      const diff = args.p_quantity - s.quantity
      if (d.quantity - diff < 0) return err(`Only ${d.quantity} left in stock`)
      d.quantity -= diff; s.quantity = args.p_quantity
      emit('designs'); emit('sales')
      return { data: { ...s }, error: null }
    }
    return err(`Unknown function ${fn}`)
  }

  const client = {
    from: (table: string) => new Query(table),
    rpc,
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb: (ev: string, s: Row | null) => void) => {
        authListeners.push(cb)
        return { data: { subscription: { unsubscribe: () => authListeners.splice(authListeners.indexOf(cb), 1) } } }
      },
      signInWithPassword: async ({ email }: { email: string }) => {
        setSession({ user: { email: email || 'demo@example.com' } })
        return { error: null }
      },
      signOut: async () => { setSession(null) },
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path: string, file: Blob) => { urls.set(path, URL.createObjectURL(file)); return { error: null } },
        remove: async (paths: string[]) => { paths.forEach((p) => urls.delete(p)); return { error: null } },
        getPublicUrl: (path: string) => ({ data: { publicUrl: urls.get(path) ?? '' } }),
      }),
    },
    channel: () => {
      const ch = {
        on: (_e: string, _f: unknown, cb: (p: { table: string }) => void) => { listeners.push(cb); return ch },
        subscribe: (cb?: (status: string) => void) => { cb?.('SUBSCRIBED'); return ch },
      }
      return ch
    },
    removeChannel: async () => { listeners.length = 0 },
  }
  return client as unknown as SupabaseClient
}
