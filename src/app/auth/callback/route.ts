import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase Auth callback — handles PKCE code exchange.
 *
 * All Supabase auth flows (invite acceptance, magic link, OAuth) land here.
 * After exchanging the code for a session, we redirect to:
 *   - The `next` query param   (e.g. /accept-invite for fresh invites)
 *   - /dashboard               (default for all other flows)
 *
 * Supabase Dashboard config required:
 *   Authentication → URL Configuration → Redirect URLs
 *   Add: http://localhost:3000/auth/callback
 *   Add: https://portal.clikaa.com/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Ensure `next` is a relative path to prevent open-redirect attacks.
      const safeNext = next.startsWith('/') ? next : '/dashboard'
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  // Code missing or exchange failed — send to login with error hint.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
