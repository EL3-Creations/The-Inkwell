import { useEffect, useState } from 'react'

/** Re-renders every `ms` so "3m ago" labels stay current. */
export function useNow(ms = 30000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}
