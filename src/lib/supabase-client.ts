/**
 * src/lib/supabase-client.ts
 *
 * Single shared Supabase client instance for the entire app.
 * Lazy-initialised so it's never created during SSR with empty env vars.
 * Import getSupabase() wherever you need the client.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  // Must run client-side only
  if (typeof window === 'undefined') return null

  // Return existing instance — prevents multiple GoTrueClient warnings
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Both vars must be present and non-empty
  if (!url || !key || url === '' || key === '') return null

  _client = createClient(url, key, {
    auth: {
      persistSession:    true,
      storageKey:        'sc_sb_session',
      autoRefreshToken:  true,
      detectSessionInUrl: true,
    },
  })
  return _client
}
