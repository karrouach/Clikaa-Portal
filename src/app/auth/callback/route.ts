import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Supabase Auth callback — handles both auth flows:
 *
 * 1. OTP / token_hash flow (used by Supabase SSR invite & recovery emails)
 *    URL shape: /auth/callback?token_hash=XXX&type=invite
 *    Handler:   supabase.auth.verifyOtp({ token_hash, type })
 *
 * 2. PKCE code flow (OAuth, some magic-link configs)
 *    URL shape: /auth/callback?code=XXX
 *    Handler:   supabase.auth.exchangeCodeForSession(code)
 *
 * ─── Required Supabase Dashboard config ────────────────────────────────────
 * Authentication → URL Configuration → Redirect URLs — add:
 *   https://<your-domain>/auth/callback
 *   http://localhost:3000/auth/callback
 *
 * The email templates use {{ .ConfirmationURL }} which Supabase constructs
 * using the Site URL. Set Site URL to your domain root or /auth/callback.
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const supabase = await createClient()

  // ── Branch 1: OTP / token_hash (invite, recovery, signup, magic-link) ────
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=invalid_invite`
      )
    }

    // Invite and password-recovery both need the user to set a new password.
    if (type === 'invite' || type === 'recovery') {
      return NextResponse.redirect(`${origin}/dashboard/reset-password`)
    }

    // Any other verified OTP type (signup, magiclink, etc.) → dashboard.
    const next = searchParams.get('next')
    return NextResponse.redirect(
      `${origin}${next?.startsWith('/') ? next : '/dashboard'}`
    )
  }

  // ── Branch 2: PKCE code exchange ──────────────────────────────────────────
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=auth_callback_failed`
      )
    }

    // Explicit destination always wins.
    if (next?.startsWith('/')) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Detect first-time sign-in: last_sign_in_at ≈ created_at (within 30 s).
    const user = data?.user
    if (user) {
      const createdMs  = new Date(user.created_at).getTime()
      const lastSignIn = user.last_sign_in_at
        ? new Date(user.last_sign_in_at).getTime()
        : createdMs
      const isFirstSignIn = Math.abs(lastSignIn - createdMs) < 30_000

      if (isFirstSignIn) {
        return NextResponse.redirect(`${origin}/dashboard/reset-password`)
      }
    }

    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // ── No recognisable params — send to login with an error hint ─────────────
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
