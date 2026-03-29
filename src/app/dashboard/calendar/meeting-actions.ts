'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createMeeting(
  workspaceId: string,
  title: string,
  meetingDate: string,
  meetingLink: string | null,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('meetings')
      .insert({
        workspace_id: workspaceId,
        title,
        meeting_date: meetingDate,
        meeting_link: meetingLink || null,
      })

    if (error) return { error: error.message }

    revalidatePath('/dashboard/calendar')
    return {}
  } catch (err) {
    console.error('[meeting] createMeeting error:', err)
    return { error: 'Failed to create meeting.' }
  }
}
