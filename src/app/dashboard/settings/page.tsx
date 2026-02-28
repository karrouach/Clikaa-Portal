import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ProfileForm } from './ProfileForm'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, avatar_url, title')
    .eq('id', user.id)
    .single()

  return (
    <div className="animate-fade-in max-w-md">
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your profile and account preferences.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-zinc-100 p-8">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-8">
          Profile
        </h2>

        <ProfileForm
          userId={user.id}
          initialFullName={profile?.full_name ?? ''}
          initialTitle={profile?.title ?? null}
          email={profile?.email ?? user.email ?? ''}
          role={profile?.role ?? 'client'}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />
      </div>
    </div>
  )
}
