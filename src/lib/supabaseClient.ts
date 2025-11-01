import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

export const missingSupabaseEnvMessage =
  'Supabase configuration missing. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'

let client: SupabaseClient | null = null

if (!supabaseUrl || !supabaseAnonKey) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(missingSupabaseEnvMessage)
  }
} else {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export const supabase = client as SupabaseClient
export const isSupabaseConfigured = Boolean(client)
