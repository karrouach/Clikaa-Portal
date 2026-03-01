import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Routes under /dashboard that must remain accessible even before the
 * server-side session cookie is fully established.
 *
 * /dashboard/reset-password — invited users land here to set a password.
 *   The PKCE exchange in /auth/callback sets the cookie, but as a safety net
 *   this route is whitelisted so users aren't bounced to /login if the
 *   cookie propagation is slightly delayed.
 */
const DASHBOARD_PUBLIC = ['/dashboard/reset-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Bypass all /auth/* routes completely ───────────────────────────────────
  // /auth/callback and /auth/confirm must run without any interception.
  // Calling getUser() here can interfere with the token-exchange / OTP flow.
  if (pathname.startsWith('/auth')) {
    return NextResponse.next()
  }

  // Forward the current pathname as a request header so server component
  // layouts can read it via headers('x-pathname') — used by the dashboard
  // layout to distinguish /dashboard/reset-password from other routes.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Start with a passthrough response so we can mutate cookies on it.
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 1. Stamp cookies onto the request so subsequent server code can read them.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // 2. Sync the updated cookie jar back into requestHeaders so the
          //    forwarded request headers (including x-pathname) stay in sync.
          requestHeaders.set(
            'cookie',
            request.cookies.getAll().map(({ name, value }) => `${name}=${value}`).join('; ')
          )
          // 3. Re-create the response with the updated request + headers.
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: auth.getUser() must be called here to refresh the session.
  // Do NOT add any logic between createServerClient and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Protect /dashboard and all nested routes ────────────────────────────
  if (
    !user &&
    pathname.startsWith('/dashboard') &&
    !DASHBOARD_PUBLIC.includes(pathname)
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    // Preserve the intended destination so we can redirect back after login.
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // ── Redirect authenticated users away from the login page ───────────────
  // NOTE: /accept-invite is intentionally NOT included — an invited user
  // arrives authenticated but still needs to complete the password-setup step.
  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // IMPORTANT: Always return supabaseResponse (not a new NextResponse) to
  // avoid breaking the session cookie refresh mechanism.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - Any file with an extension (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
