import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { DataProvider } from './lib/data'
import { ToastProvider } from './lib/toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import NotConfigured from './pages/NotConfigured'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import DesignDetail from './pages/DesignDetail'
import Live from './pages/Live'
import Owes from './pages/Owes'
import ToShip from './pages/ToShip'
import Sales from './pages/Sales'
import ImportExport from './pages/ImportExport'
import Settings from './pages/Settings'
import More from './pages/More'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!isConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) return <NotConfigured />
  if (session === undefined) {
    return <div className="flex h-full items-center justify-center text-neutral-500">Loading…</div>
  }

  return (
    <ToastProvider>
      {!session ? (
        <Login />
      ) : (
        <DataProvider>
          <Routes>
            <Route element={<Layout email={session.user.email ?? ''} />}>
              <Route index element={<Dashboard />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="designs/new" element={<DesignDetail />} />
              <Route path="designs/:id" element={<DesignDetail />} />
              <Route path="live" element={<Live />} />
              <Route path="owes" element={<Owes />} />
              <Route path="ship" element={<ToShip />} />
              <Route path="sales" element={<Sales />} />
              <Route path="import" element={<ImportExport />} />
              <Route path="settings" element={<Settings email={session.user.email ?? ''} />} />
              <Route path="more" element={<More email={session.user.email ?? ''} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </DataProvider>
      )}
    </ToastProvider>
  )
}
