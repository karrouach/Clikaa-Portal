'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AcceptInviteState = {
  error: string | null
}

export async function setPassword(
  _prevState: AcceptInviteState | null,
  formData: FormData
): Promise<AcceptInviteState> {
  const fullName = (formData.get('full_name') as string).trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!fullName) return { error: 'Please enter your full name.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirmPassword) return { error: 'Passwords do not match.' }

  const supabase = await createClient()

  // Update auth password
  const { error: passwordError } = await supabase.auth.updateUser({ password })
  if (passwordError) return { error: passwordError.message }

  // Update profile name
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)
  }

  redirect('/dashboard')
}
