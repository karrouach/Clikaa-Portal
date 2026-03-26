-- ─────────────────────────────────────────────────────────────────────────────
-- 015_messaging.sql
-- Threaded internal messaging between clients and admins.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  client_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject      text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

-- ── RLS: conversations ────────────────────────────────────────────────────────
CREATE POLICY "Admins manage all conversations"
  ON conversations FOR ALL
  USING  (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Clients view own conversations"
  ON conversations FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients create own conversations"
  ON conversations FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- ── RLS: messages ─────────────────────────────────────────────────────────────
CREATE POLICY "Admins manage all messages"
  ON messages FOR ALL
  USING  (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Clients view own messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id AND client_id = auth.uid()
    )
  );

CREATE POLICY "Clients insert own messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id AND client_id = auth.uid()
    )
  );
