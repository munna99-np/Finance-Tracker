import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  // Fail fast in dev; in prod Vite will inline envs
  // eslint-disable-next-line no-console
  console.warn('Supabase env not set. Check .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
