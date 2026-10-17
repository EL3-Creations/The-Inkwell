/**
 * Loads all app data once, keeps it in memory, and refreshes it whenever
 * something changes: right after this phone writes (bus.ts), when Supabase
 * reports a change from the other phone (realtime), and when the app comes
 * back to the foreground. The whole dataset is small, so this stays simple.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { onChange } from './bus'
import type { Design, DesignPhoto, LiveSession, Sale, Settings } from './types'
import { effectivePrice } from './types'

interface DataState {
  settings: Settings | null
  designs: Design[]
  photos: DesignPhoto[]
  sales: Sale[]
  sessions: LiveSession[]
  loading: boolean
  error: string | null
  /** When data last loaded successfully (ms since epoch), 0 before the first load. */
  lastSynced: number
  /** True while the realtime connection to Supabase is up (changes from the other phone arrive live). */
  live: boolean
  refresh: () => Promise<void>
  // Derived helpers
  designById: Map<string, Design>
  designByNumber: Map<number, Design>          // active designs only
  photosByDesign: Map<string, DesignPhoto[]>   // sorted by sort_order
  coverPhoto: (designId: string) => DesignPhoto | undefined
  priceOf: (d: Design) => number
  activeSession: LiveSession | null
}

const DataContext = createContext<DataState | null>(null)

type Table = 'settings' | 'designs' | 'design_photos' | 'live_sessions' | 'sales'
const TABLES: Table[] = ['settings', 'designs', 'design_photos', 'live_sessions', 'sales']

/** Supabase returns at most 1000 rows per request; page until a short page comes back. */
const PAGE = 1000
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [designs, setDesigns] = useState<Design[]>([])
  const [photos, setPhotos] = useState<DesignPhoto[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState(0)
  const [live, setLive] = useState(false)

  const loadTable = useCallback(async (table: Table) => {
    switch (table) {
      case 'settings': {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle<Settings>()
        if (error) throw error
        setSettings(data)
        break
      }
      case 'designs':
        setDesigns(await all<Design>((a, b) => supabase.from('designs').select('*').order('number').range(a, b)))
        break
      case 'design_photos':
        setPhotos(await all<DesignPhoto>((a, b) => supabase.from('design_photos').select('*').order('sort_order').range(a, b)))
        break
      case 'live_sessions':
        setSessions(await all<LiveSession>((a, b) => supabase.from('live_sessions').select('*').order('started_at', { ascending: false }).range(a, b)))
        break
      case 'sales':
        setSales(await all<Sale>((a, b) => supabase.from('sales').select('*').order('claimed_at', { ascending: false }).range(a, b)))
        break
    }
    setLastSynced(Date.now())
  }, [])

  const refresh = useCallback(async () => {
    try {
      await Promise.all(TABLES.map(loadTable))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [loadTable])

  // Initial load + refetch when the app comes back to the foreground or back online.
  useEffect(() => {
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [refresh])

  // Reload a table shortly after anything touches it (our own writes, or realtime from the other phone).
  const pending = useRef<Set<Table>>(new Set())
  const timer = useRef<number | null>(null)
  const schedule = useCallback((table: string) => {
    pending.current.add(table as Table)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const tables = Array.from(pending.current)
      pending.current.clear()
      tables.forEach((t) => void loadTable(t).then(() => setError(null)).catch(() => void refresh()))
    }, 120)
  }, [loadTable, refresh])

  useEffect(() => onChange(schedule), [schedule])

  useEffect(() => {
    const channel = supabase
      .channel('inkwell-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => schedule(payload.table))
      .subscribe((status) => {
        const up = status === 'SUBSCRIBED'
        setLive(up)
        if (up) void refresh()   // catch up on anything missed while the socket was down
      })
    return () => { void supabase.removeChannel(channel) }
  }, [schedule, refresh])

  const value = useMemo<DataState>(() => {
    const designById = new Map(designs.map((d) => [d.id, d]))
    const designByNumber = new Map(designs.filter((d) => !d.archived).map((d) => [d.number, d]))
    const photosByDesign = new Map<string, DesignPhoto[]>()
    for (const p of photos) {
      const list = photosByDesign.get(p.design_id) ?? []
      list.push(p)
      photosByDesign.set(p.design_id, list)
    }
    for (const list of photosByDesign.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return {
      settings, designs, photos, sales, sessions, loading, error, lastSynced, live, refresh,
      designById, designByNumber, photosByDesign,
      coverPhoto: (id) => photosByDesign.get(id)?.[0],
      priceOf: (d) => effectivePrice(d, settings),
      activeSession: sessions.find((s) => !s.ended_at) ?? null,
    }
  }, [settings, designs, photos, sales, sessions, loading, error, lastSynced, live, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
