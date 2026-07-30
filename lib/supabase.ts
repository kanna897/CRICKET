import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Store browser sessions in cookies so middleware can protect localized routes.
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
