import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="animate-fade-in max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your account preferences.</p>
      </div>

      {/* Profile card */}
      <div className="border border-zinc-100 bg-white p-6">
        <h2 className="text-sm font-medium text-black mb-4">Profile</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Name</dt>
            <dd className="text-black font-medium">{profile?.full_name || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-black font-medium">{profile?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Role</dt>
            <dd className="text-black font-medium capitalize">{profile?.role}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        To update your profile, contact{' '}
        <a href="mailto:hello@clikaa.com" className="underline">hello@clikaa.com</a>.
      </p>
    </div>
  )
}
