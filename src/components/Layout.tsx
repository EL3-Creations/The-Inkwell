import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useData } from '../lib/data'
import { useNow } from '../lib/hooks'
import { Logo } from './ui'

const links = [
  { to: '/', label: 'Dashboard', icon: '⌂', mobile: 'Home' },
  { to: '/inventory', label: 'Inventory', icon: '▦', mobile: 'Stock' },
  { to: '/live', label: 'Live mode', icon: '●', mobile: 'Live' },
  { to: '/owes', label: 'Owes me', icon: '$', mobile: 'Owes' },
  { to: '/ship', label: 'To ship', icon: '➜' },
  { to: '/sales', label: 'Sales', icon: '≡' },
  { to: '/import', label: 'Import / Export', icon: '⇅' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout({ email }: { email: string }) {
  const { sales, activeSession } = useData()
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [pathname])
  const unpaid = sales.filter((s) => s.status === 'claimed').length
  const toShip = sales.filter((s) => s.status === 'paid').length
  const badge = (to: string) => (to === '/owes' ? unpaid : to === '/ship' ? toShip : to === '/live' && activeSession ? 'LIVE' : 0)

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r-2 border-black bg-white md:flex">
        <div className="border-b-2 border-black p-4"><Logo /></div>
        <nav className="flex-1 p-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `mb-1 flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold ${isActive ? 'bg-black text-white' : 'hover:bg-neutral-100'}`
              }
            >
              <span className="w-5 text-center">{l.icon}</span>
              <span className="flex-1">{l.label}</span>
              <Count n={badge(l.to)} />
            </NavLink>
          ))}
        </nav>
        <div className="dots h-3" />
        <div className="truncate p-3 text-xs text-neutral-500">{email}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b-2 border-black px-4 py-2 pt-safe md:hidden">
          <Logo size="sm" />
          {activeSession && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">● LIVE</span>}
        </header>

        <SyncBar />

        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-8 md:pb-8">
          <div className="mx-auto max-w-5xl"><Outlet /></div>
        </main>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-black bg-white pb-safe md:hidden">
          {[...links.slice(0, 4), { to: '/more', label: 'More', icon: '•••', mobile: 'More' }].map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `relative flex min-h-16 flex-col items-center justify-center text-xs font-semibold ${isActive ? 'text-black' : 'text-neutral-500'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full text-lg ${isActive ? 'bg-black text-white' : ''}`}>{l.icon}</span>
                  <span>{l.mobile ?? l.label}</span>
                  <span className="absolute right-2 top-1"><Count n={badge(l.to)} /></span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

/**
 * Tells you when what you're looking at might be stale: a red bar when loading
 * failed, an amber bar when live updates from the other phone are paused.
 * Either way, one tap refreshes.
 */
function SyncBar() {
  const { error, live, loading, lastSynced, refresh } = useData()
  const now = useNow(10000)
  const [busy, setBusy] = useState(false)
  // Give the realtime socket a few seconds to connect before calling it "paused".
  const pausedFor = live || !lastSynced ? 0 : now - lastSynced
  if (loading) return null
  if (!error && (live || pausedFor < 8000)) return null
  const retry = async () => { setBusy(true); try { await refresh() } finally { setBusy(false) } }
  const age = lastSynced ? Math.max(0, Math.round((now - lastSynced) / 60000)) : null
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${error ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-900'}`}>
      <span className="min-w-0 truncate">
        {error ? `Connection problem: ${error}` : `Live updates paused${age != null ? ` · last synced ${age < 1 ? 'just now' : `${age} min ago`}` : ''}`}
      </span>
      <button type="button" onClick={retry} disabled={busy} className={`shrink-0 rounded-full border-2 px-3 py-1 font-semibold ${error ? 'border-white' : 'border-amber-900'}`}>{busy ? 'Refreshing…' : 'Refresh'}</button>
    </div>
  )
}

function Count({ n }: { n: number | string }) {
  if (!n) return null
  if (n === 'LIVE') return <span className="inline-block h-3 w-3 rounded-full bg-red-600" aria-label="Live in progress" />
  return <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-black">{n}</span>
}
