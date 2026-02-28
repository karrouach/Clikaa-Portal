'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type LoginState = {
  error: string | null
}

export async function signIn(
  _prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Return a generic message to avoid leaking whether the email exists.
    return { error: 'Invalid email or password. Please try again.' }
  }

  redirect('/dashboard')
}
