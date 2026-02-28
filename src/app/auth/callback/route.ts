import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase Auth callback — handles both auth flows:
 *
 * PRIORITY 1 — OTP / token_hash (Supabase SSR invite & recovery emails)
 *   URL shape: /auth/callback?token_hash=XXX&type=invite
 *   After verifyOtp the client automatically sets the session cookie.
 *   → Redirect to /dashboard/reset-password so the user sets a password.
 *
 * PRIORITY 2 — PKCE code exchange (OAuth, magic-link via some configs)
 *   URL shape: /auth/callback?code=XXX
 *   → Redirect to /dashboard (or /dashboard/reset-password on first sign-in).
 *
 * The middleware is configured to bypass ALL /auth/* routes so this
 * handler can set cookies without interception.
 */
export async function GET(request: NextRequest) {
  // ── Build a cookie-aware Supabase SSR client ─────────────────────────────
  // We create it inline here (rather than via the shared createClient helper)
  // so the session cookie is written directly into this response's cookie jar.
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { searchParams } = request.nextUrl

  // ── Branch 1: OTP / token_hash (invite, recovery, magic-link) ────────────
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (error) {
      // Expired or already-used token — send back to login with a hint.
      return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
    }

    // verifyOtp succeeded → session cookie is now set.
    // Both invite and recovery require the user to choose a new password.
    return NextResponse.redirect(new URL('/dashboard/reset-password', request.url))
  }

  // ── Branch 2: PKCE code exchange ──────────────────────────────────────────
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(
        new URL('/login?error=auth_callback_failed', request.url)
      )
    }

    // Explicit ?next= destination always wins.
    if (next?.startsWith('/')) {
      return NextResponse.redirect(new URL(next, request.url))
    }

    // Detect first sign-in (created_at ≈ last_sign_in_at within 30 s) →
    // the user needs to set a permanent password.
    const user = data?.user
    if (user) {
      const createdMs  = new Date(user.created_at).getTime()
      const lastMs     = user.last_sign_in_at
        ? new Date(user.last_sign_in_at).getTime()
        : createdMs
      if (Math.abs(lastMs - createdMs) < 30_000) {
        return NextResponse.redirect(
          new URL('/dashboard/reset-password', request.url)
        )
      }
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── No recognisable params ────────────────────────────────────────────────
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_failed', request.url)
  )
}
