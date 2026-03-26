-- ─────────────────────────────────────────────────────────────────────────────
-- 018_realtime_replica_identity.sql
-- Enable REPLICA IDENTITY FULL on tables used by Supabase Realtime
-- postgres_changes subscriptions with filters.
--
-- Without REPLICA IDENTITY FULL, filtered postgres_changes subscriptions
-- receive zero events because the WAL decoder cannot evaluate column-level
-- filters (e.g. conversation_id=eq.X) on the change stream.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.messages       REPLICA IDENTITY FULL;
ALTER TABLE public.notifications  REPLICA IDENTITY FULL;
ALTER TABLE public.conversations  REPLICA IDENTITY FULL;
