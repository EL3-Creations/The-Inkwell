import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createDemoClient } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Demo mode: fake in-memory data, no database needed. Set VITE_DEMO=true in .env to try it. */
export const isDemo = import.meta.env.VITE_DEMO === 'true'

/** True when the two environment values have been filled in (or demo mode is on). */
export const isConfigured = isDemo || Boolean(url && anonKey && !url.includes('YOUR-PROJECT'))

export const supabase: SupabaseClient = isDemo
  ? createDemoClient()
  : createClient(url ?? 'https://not-configured.supabase.co', anonKey ?? 'not-configured', {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })

/** Public URL for a photo stored in the "photos" bucket. */
export function photoUrl(storagePath: string): string {
  return supabase.storage.from('photos').getPublicUrl(storagePath).data.publicUrl
}
