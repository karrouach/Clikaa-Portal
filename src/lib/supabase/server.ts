import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Creates a Supabase client for use in:
 * - React Server Components (RSCs)
 * - Server Actions
 * - Route Handlers
 *
 * cookies() is async in Next.js 15 — always await this function.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll throws when called from a Server Component (read-only cookies).
            // This is expected and safe to ignore — the middleware handles refresh.
          }
        },
      },
    }
  )
}
