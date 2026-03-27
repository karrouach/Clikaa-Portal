-- ─────────────────────────────────────────────────────────────────────────────
-- RLS SELECT policies required for Supabase Realtime to broadcast INSERT
-- payloads to subscribers. Without a SELECT policy the realtime server cannot
-- verify that the subscriber is allowed to see the row, so the event is silently
-- dropped even though the row was inserted successfully.
--
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── messages ─────────────────────────────────────────────────────────────────
-- Participants in a conversation (sender or the conversation's client/admin)
-- can read messages in that conversation.

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;

CREATE POLICY "messages_select_participant"
  ON public.messages
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.client_id = auth.uid() OR c.admin_id = auth.uid())
    )
  );

-- ── notifications ─────────────────────────────────────────────────────────────
-- Each user can only read their own notifications.

DROP POLICY IF EXISTS "notifications_select_owner" ON public.notifications;

CREATE POLICY "notifications_select_owner"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── conversations ─────────────────────────────────────────────────────────────
-- Participants can read their own conversations.

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;

CREATE POLICY "conversations_select_participant"
  ON public.conversations
  FOR SELECT
  USING (
    auth.uid() = client_id
    OR auth.uid() = admin_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
