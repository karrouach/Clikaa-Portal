-- ─────────────────────────────────────────────────────────────────────────────
-- 028_invoice_processing_status.sql
-- Adds 'processing' to the invoices.status check constraint.
-- 'processing' is set when a client marks an invoice as paid and it is
-- awaiting admin confirmation before being moved to 'paid'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'pending', 'processing', 'paid', 'overdue', 'failed', 'cancelled'));
