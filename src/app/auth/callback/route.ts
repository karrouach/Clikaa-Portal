import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase Auth callback — PKCE code exchange.
 *
 * ALL Supabase auth flows (invite, magic link, OAuth, password reset) must
 * land here so that the session is established server-side (cookie-based).
 * Client-side implicit flows (hash fragments) bypass this route and result
 * in a localStorage-only session that the middleware cannot read.
 *
 * ─── Required Supabase Dashboard config ────────────────────────────────────
 * Authentication → URL Configuration:
 *
 *   Site URL:
 *     https://<your-domain>/auth/callback
 *
 *   Redirect URLs (add both):
 *     https://<your-domain>/auth/callback
 *     http://localhost:3000/auth/callback
 *
 * This ensures every invite / magic-link email uses /auth/callback as the
 * redirect target, so the PKCE code lands here and a proper cookie session
 * is created before the user reaches any dashboard route.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Redirect priority after a successful exchange:
 *   1. `next` query param — explicit destination (e.g. ?next=/accept-invite)
 *   2. First-time sign-in detected — /dashboard/reset-password
 *   3. Default — /dashboard
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // 1. Honour an explicit `next` destination (must be a relative path).
      if (next?.startsWith('/')) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // 2. Detect first-time sign-in: Supabase sets last_sign_in_at ≈ created_at
      //    on the very first token exchange (invite acceptance).
      //    If the two timestamps are within 30 seconds of each other the user
      //    has never logged in before and needs to set a password.
      const createdMs  = new Date(data.user.created_at).getTime()
      const lastSignIn = data.user.last_sign_in_at
        ? new Date(data.user.last_sign_in_at).getTime()
        : createdMs
      const isFirstSignIn = Math.abs(lastSignIn - createdMs) < 30_000

      if (isFirstSignIn) {
        return NextResponse.redirect(`${origin}/dashboard/reset-password`)
      }

      // 3. Default — existing user, go straight to the dashboard.
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Code missing or exchange failed — send to login with an error hint.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
