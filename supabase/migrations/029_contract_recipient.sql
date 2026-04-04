-- ─────────────────────────────────────────────────────────────────────────────
-- 029_contract_recipient.sql
-- Adds recipient_user_id to contracts so a contract can be addressed to a
-- specific profile (client OR internal team member) rather than broadcast to
-- all workspace clients.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
