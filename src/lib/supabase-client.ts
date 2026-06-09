/**
 * src/lib/supabase-client.ts
 *
 * Single shared Supabase client instance for the entire app.
 * Lazy-initialised so it's never created during SSR with empty env vars.
 *
 * flowType: 'pkce' — uses PKCE token exchange instead of the implicit flow.
 * This eliminates the intermediate redirect through supabase.co that Chrome
 * flags as bounce tracking. Auth tokens are exchanged server-side without
 * the user's browser touching the Supabase domain directly.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === '' || key === '') return null

  _client = createClient(url, key, {
    auth: {
      persistSession:   true,
      storageKey:       'sc_sb_session',
      flowType:         'pkce',        // eliminates Supabase bounce-tracking redirect
      detectSessionInUrl: true,        // required for PKCE callback handling
      autoRefreshToken: true,
    },
  })
  return _client
}
