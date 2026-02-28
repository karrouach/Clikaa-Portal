import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

/**
 * Login page — server component.
 * LoginForm is a client component that uses useSearchParams(),
 * which requires a Suspense boundary for static pre-rendering.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
