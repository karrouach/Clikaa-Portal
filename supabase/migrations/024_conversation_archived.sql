-- ─────────────────────────────────────────────────────────────────────────────
-- 024_conversation_archived.sql
-- Adds an `archived` flag to conversations so admins can hide threads
-- from the main inbox without deleting them.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.conversations
  add column if not exists archived boolean not null default false;

create index if not exists conversations_archived_idx
  on public.conversations(archived, updated_at desc);
