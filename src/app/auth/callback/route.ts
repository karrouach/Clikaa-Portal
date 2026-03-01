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
 *   → verifyOtp → redirect to /dashboard/reset-password
 *
 * PRIORITY 2 — PKCE code exchange (OAuth, magic-link)
 *   URL shape: /auth/callback?code=XXX
 *   → exchangeCodeForSession → detect invite/recovery → redirect accordingly
 *
 * CRITICAL: All session cookies that Supabase writes during the exchange are
 * captured into `pendingCookies` and then explicitly stamped onto the
 * NextResponse.redirect() object before it is returned. This ensures the
 * browser receives the Set-Cookie headers even when the response is a
 * redirect (NextResponse.redirect creates a new response that does NOT
 * automatically inherit cookies written via cookieStore.set()).
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const { searchParams } = request.nextUrl

  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const code       = searchParams.get('code')
  const next       = searchParams.get('next')

  // Accumulate every cookie Supabase wants to set during the exchange.
  // We'll stamp these onto the final redirect response explicitly.
  const pendingCookies: Array<{
    name: string
    value: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any
  }> = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Write to the server-side cookie store (for any server code that
            // runs in the same request, e.g. after verifyOtp).
            cookieStore.set(name, value, options)
            // Also queue the cookie so we can stamp it onto the redirect response.
            pendingCookies.push({ name, value, options: options ?? {} })
          })
        },
      },
    }
  )

  /**
   * Stamp all session cookies onto a redirect response so the browser
   * receives the Set-Cookie headers and the session is established before
   * the next page load.
   */
  function stamp(res: NextResponse): NextResponse {
    pendingCookies.forEach(({ name, value, options }) => {
      res.cookies.set(name, value, options)
    })
    return res
  }

  /** Build a redirect response and stamp pending cookies onto it. */
  function go(destination: string): NextResponse {
    return stamp(NextResponse.redirect(new URL(destination, request.url)))
  }

  // ── Branch 1: OTP / token_hash (invite, recovery, magic-link) ────────────
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (error) {
      // Expired or already-used token — send back to login with a hint.
      return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
    }

    // verifyOtp succeeded — both invite and recovery require the user to
    // choose / reset their password before accessing the dashboard.
    // Pass the flow type so the reset-password page can tailor its UI.
    return go(`/dashboard/reset-password?type=${type}`)
  }

  // ── Branch 2: PKCE code exchange ──────────────────────────────────────────
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(
        new URL('/login?error=auth_callback_failed', request.url)
      )
    }

    // Explicit ?next= destination always wins.
    if (next?.startsWith('/')) {
      return go(next)
    }

    const user = data?.user

    // Detect invite flows — user.invited_at is set by Supabase when the
    // user was created via an admin invite.
    const isInvite = type === 'invite' || !!user?.invited_at

    // Detect recovery (password reset) via the type query param.
    const isRecovery = type === 'recovery'

    if (isInvite)   return go('/dashboard/reset-password?type=invite')
    if (isRecovery) return go('/dashboard/reset-password?type=recovery')

    // Fallback: first sign-in detection.
    // created_at ≈ last_sign_in_at within 30 s → first ever login.
    if (user) {
      const createdMs = new Date(user.created_at).getTime()
      const lastMs    = user.last_sign_in_at
        ? new Date(user.last_sign_in_at).getTime()
        : createdMs
      if (Math.abs(lastMs - createdMs) < 30_000) {
        return go('/dashboard/reset-password?type=invite')
      }
    }

    return go('/dashboard')
  }

  // ── No recognisable params ────────────────────────────────────────────────
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_failed', request.url)
  )
}
