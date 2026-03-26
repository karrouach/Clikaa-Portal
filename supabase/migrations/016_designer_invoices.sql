-- ── Designer Invoices ─────────────────────────────────────────────────────────
-- Adds monthly_retainer to profiles and a designer_invoices table.
-- pg_cron auto-generates invoices on the 1st of each month (optional, requires pg_cron extension).

-- 1. Monthly retainer rate on profiles (nullable, only set for designers)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_retainer numeric(10,2) DEFAULT NULL;

-- 2. Designer invoices table
CREATE TABLE IF NOT EXISTS designer_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  amount         numeric(10,2) NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  paid_at        timestamptz DEFAULT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS designer_invoices_designer_id_idx ON designer_invoices(designer_id);
CREATE INDEX IF NOT EXISTS designer_invoices_status_idx ON designer_invoices(status);

-- 3. RLS
ALTER TABLE designer_invoices ENABLE ROW LEVEL SECURITY;

-- Designers can view their own invoices
CREATE POLICY "designers_view_own_invoices"
  ON designer_invoices FOR SELECT
  USING (
    auth.uid() = designer_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can insert/update/delete
CREATE POLICY "admins_manage_designer_invoices"
  ON designer_invoices FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_designer_invoices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS designer_invoices_updated_at ON designer_invoices;
CREATE TRIGGER designer_invoices_updated_at
  BEFORE UPDATE ON designer_invoices
  FOR EACH ROW EXECUTE FUNCTION update_designer_invoices_updated_at();

-- 5. Helper function to generate monthly invoices for all designers with a retainer set
-- Call this manually or via pg_cron: SELECT generate_monthly_designer_invoices();
CREATE OR REPLACE FUNCTION generate_monthly_designer_invoices()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  period_start date := date_trunc('month', current_date)::date;
  period_end   date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  inv_number   text;
BEGIN
  FOR r IN
    SELECT id, monthly_retainer
    FROM profiles
    WHERE role = 'designer' AND monthly_retainer IS NOT NULL AND monthly_retainer > 0
  LOOP
    -- Skip if already generated for this period
    IF NOT EXISTS (
      SELECT 1 FROM designer_invoices
      WHERE designer_id = r.id AND period_start = period_start
    ) THEN
      inv_number := 'DES-' || to_char(current_date, 'YYYYMM') || '-' || upper(substring(r.id::text, 1, 6));
      INSERT INTO designer_invoices (designer_id, invoice_number, amount, status, period_start, period_end)
      VALUES (r.id, inv_number, r.monthly_retainer, 'pending', period_start, period_end);
    END IF;
  END LOOP;
END;
$$;

-- Optional: schedule with pg_cron (run on 1st of each month at 00:01 UTC)
-- Requires pg_cron extension enabled in Supabase dashboard.
-- SELECT cron.schedule('generate-designer-invoices', '1 0 1 * *', 'SELECT generate_monthly_designer_invoices()');
