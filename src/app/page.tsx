import { redirect } from 'next/navigation'

/**
 * Root route — immediately redirect.
 * Middleware handles auth-based branching (/login vs /dashboard),
 * so this redirect is just a safety net for the bare "/" path.
 */
export default function RootPage() {
  redirect('/dashboard')
}
