/**
 * Tiny in-app signal. api.ts announces which table it just changed, and
 * data.tsx reloads that table right away instead of waiting for the
 * realtime echo from Supabase (which can lag or drop on a phone).
 */
type Listener = (table: string) => void
const listeners = new Set<Listener>()

export function announceChange(table: string) {
  listeners.forEach((l) => l(table))
}

export function onChange(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
