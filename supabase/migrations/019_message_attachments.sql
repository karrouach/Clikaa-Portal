-- ─────────────────────────────────────────────────────────────────────────────
-- 019_message_attachments.sql
-- Storage bucket for message file attachments.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Any authenticated user can upload (conversation-scoped path used as logical guard)
CREATE POLICY "Auth users upload message attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments');

-- Any authenticated user can read (messages are already RLS-gated at the app level)
CREATE POLICY "Auth users read message attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments');
