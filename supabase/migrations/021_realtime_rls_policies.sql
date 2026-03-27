-- ─────────────────────────────────────────────────────────────────────────────
-- RLS SELECT policies required for Supabase Realtime to broadcast INSERT
-- payloads to subscribers. Without a SELECT policy the realtime server cannot
-- verify that the subscriber is allowed to see the row, so the event is silently
-- dropped even though the row was inserted successfully.
--
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── messages ─────────────────────────────────────────────────────────────────
-- Sender, the conversation's client, or any admin can read messages.

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;

CREATE POLICY "messages_select_participant"
  ON public.messages
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.client_id = auth.uid()
    )
    OR is_admin()
  );

-- ── notifications ─────────────────────────────────────────────────────────────
-- Each user can only read their own notifications.

DROP POLICY IF EXISTS "notifications_select_owner" ON public.notifications;

CREATE POLICY "notifications_select_owner"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── conversations ─────────────────────────────────────────────────────────────
-- The conversation's client or any admin can read conversations.
-- (Existing policies in 015_messaging.sql already cover this, but we
--  replace them here to be explicit and avoid duplicates.)

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
DROP POLICY IF EXISTS "Clients view own conversations"   ON public.conversations;

CREATE POLICY "conversations_select_participant"
  ON public.conversations
  FOR SELECT
  USING (
    client_id = auth.uid()
    OR is_admin()
  );
