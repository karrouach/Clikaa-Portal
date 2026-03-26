-- ── Phase 6: Payments & Designer Hub ──────────────────────────────────────────
-- 1. Add description + attachment_path to designer_invoices
ALTER TABLE designer_invoices
  ADD COLUMN IF NOT EXISTS description   text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachment_path text DEFAULT NULL;

-- 2. Allow designers to insert their own invoices (self-submit flow)
--    Admins retain full management rights via the existing policy.
DROP POLICY IF EXISTS "designers_submit_own_invoices" ON designer_invoices;
CREATE POLICY "designers_submit_own_invoices"
  ON designer_invoices FOR INSERT
  WITH CHECK (auth.uid() = designer_id);

-- 3. Storage bucket for designer invoice PDFs (run once via dashboard if not CLI)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('designer-invoices', 'designer-invoices', false)
-- ON CONFLICT (id) DO NOTHING;
