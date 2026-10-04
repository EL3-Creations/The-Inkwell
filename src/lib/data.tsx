/**
 * Loads all app data once, keeps it in memory, and refreshes it whenever
 * Supabase reports a change (so both phones always show the same thing).
 * The whole dataset is small (hundreds of rows), so this is fast and simple.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
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

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [designs, setDesigns] = useState<Design[]>([])
  const [photos, setPhotos] = useState<DesignPhoto[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTable = useCallback(async (table: Table) => {
    switch (table) {
      case 'settings': {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle<Settings>()
        if (error) throw error
        setSettings(data)
        break
      }
      case 'designs': {
        const { data, error } = await supabase.from('designs').select('*').order('number').returns<Design[]>()
        if (error) throw error
        setDesigns(data ?? [])
        break
      }
      case 'design_photos': {
        const { data, error } = await supabase.from('design_photos').select('*').order('sort_order').returns<DesignPhoto[]>()
        if (error) throw error
        setPhotos(data ?? [])
        break
      }
      case 'live_sessions': {
        const { data, error } = await supabase.from('live_sessions').select('*').order('started_at', { ascending: false }).returns<LiveSession[]>()
        if (error) throw error
        setSessions(data ?? [])
        break
      }
      case 'sales': {
        const { data, error } = await supabase.from('sales').select('*').order('claimed_at', { ascending: false }).returns<Sale[]>()
        if (error) throw error
        setSales(data ?? [])
        break
      }
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      await Promise.all((['settings', 'designs', 'design_photos', 'live_sessions', 'sales'] as Table[]).map(loadTable))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [loadTable])

  // Initial load + refetch when the app comes back to the foreground.
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

  // Realtime: when any table changes (from this phone or the other one), reload that table.
  const pending = useRef<Set<Table>>(new Set())
  const timer = useRef<number | null>(null)
  useEffect(() => {
    const channel = supabase
      .channel('inkwell-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        pending.current.add(payload.table as Table)
        if (timer.current) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          const tables = Array.from(pending.current)
          pending.current.clear()
          tables.forEach((t) => void loadTable(t).catch(() => void refresh()))
        }, 150)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadTable, refresh])

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
      settings, designs, photos, sales, sessions, loading, error, refresh,
      designById, designByNumber, photosByDesign,
      coverPhoto: (id) => photosByDesign.get(id)?.[0],
      priceOf: (d) => effectivePrice(d, settings),
      activeSession: sessions.find((s) => !s.ended_at) ?? null,
    }
  }, [settings, designs, photos, sales, sessions, loading, error, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
