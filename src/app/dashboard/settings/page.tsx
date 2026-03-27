import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ProfileForm } from './ProfileForm'
import { SignOutButton } from './SignOutButton'

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
        <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your profile and account preferences.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 p-8">
        <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-8">
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

      {/* Sign out — shown on mobile where the top nav drawer is gone */}
      <div className="mt-4 md:hidden">
        <SignOutButton />
      </div>
    </div>
  )
}
