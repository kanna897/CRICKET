import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Store browser sessions in cookies so middleware can protect localized routes.
// The deployed schema evolves through migrations more quickly than the generated
// database snapshot. Domain data is narrowed at each feature boundary instead of
// repeatedly casting individual query builders to `any`.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
