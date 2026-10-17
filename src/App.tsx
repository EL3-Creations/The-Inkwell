import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { DataProvider } from './lib/data'
import { ToastProvider } from './lib/toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
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
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!isConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Arriving from a "reset password" email link: ask for the new password before showing the app.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
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
      ) : recovery ? (
        <SetPassword onDone={() => setRecovery(false)} />
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
