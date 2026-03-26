-- ─────────────────────────────────────────────────────────────────────────────
-- 014_contracts.sql
-- Introduces contract_templates and contracts tables with strict RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── contract_templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  body_text     text NOT NULL DEFAULT '',
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- Admins: full CRUD
CREATE POLICY "Admins manage contract templates"
  ON contract_templates FOR ALL
  USING  (is_admin())
  WITH CHECK (is_admin());

-- Clients: no access (no policy = no access)

-- ── contracts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id            uuid REFERENCES contract_templates(id) ON DELETE SET NULL,
  title                  text NOT NULL,
  body_text              text NOT NULL DEFAULT '',
  status                 text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'pending_signature', 'signed')),
  client_signature_name  text,
  signed_at              timestamptz,
  created_by             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Admins: global access
CREATE POLICY "Admins manage all contracts"
  ON contracts FOR ALL
  USING  (is_admin())
  WITH CHECK (is_admin());

-- Clients: SELECT on their workspace contracts
CREATE POLICY "Clients can view workspace contracts"
  ON contracts FOR SELECT
  USING (
    NOT is_admin()
    AND is_workspace_member(workspace_id)
  );

-- Clients: UPDATE only to sign (only when status = pending_signature)
CREATE POLICY "Clients can sign pending contracts"
  ON contracts FOR UPDATE
  USING (
    NOT is_admin()
    AND is_workspace_member(workspace_id)
    AND status = 'pending_signature'
  )
  WITH CHECK (
    NOT is_admin()
    AND is_workspace_member(workspace_id)
    AND status = 'signed'
  );

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER contract_templates_updated_at
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed two starter templates ────────────────────────────────────────────────
INSERT INTO contract_templates (template_name, body_text) VALUES
(
  'Standard MSA',
  E'# Master Services Agreement\n\nThis Master Services Agreement ("Agreement") is entered into as of the Effective Date between **Clikaa Studio** ("Agency") and the Client identified in the associated project brief.\n\n## 1. Services\n\nThe Agency agrees to provide creative design services as detailed in each Statement of Work ("SOW") attached to this Agreement.\n\n## 2. Payment Terms\n\nClient agrees to pay all invoices within 14 days of receipt. Overdue invoices accrue interest at 1.5% per month.\n\n## 3. Intellectual Property\n\nUpon receipt of full payment, the Agency assigns all final deliverable rights to the Client. Work-in-progress files and source assets remain Agency property.\n\n## 4. Revisions\n\nThis Agreement includes up to three (3) rounds of revisions per deliverable. Additional revisions are billed at the Agency''s standard hourly rate.\n\n## 5. Confidentiality\n\nBoth parties agree to keep confidential all non-public information disclosed during the engagement.\n\n## 6. Termination\n\nEither party may terminate this Agreement with 14 days written notice. The Client is responsible for payment of all work completed up to the termination date.\n\n## 7. Governing Law\n\nThis Agreement shall be governed by the laws of the jurisdiction in which the Agency is registered.'
),
(
  'NDA (Non-Disclosure Agreement)',
  E'# Non-Disclosure Agreement\n\nThis Non-Disclosure Agreement ("Agreement") is entered into between **Clikaa Studio** ("Disclosing Party") and the signing party ("Receiving Party").\n\n## 1. Confidential Information\n\n"Confidential Information" means any non-public information disclosed by either party, including but not limited to business strategies, design concepts, client lists, pricing, and technical data.\n\n## 2. Obligations\n\nThe Receiving Party agrees to:\n- Hold all Confidential Information in strict confidence\n- Not disclose it to third parties without prior written consent\n- Use it solely for the purpose of evaluating or executing the engagement\n\n## 3. Exclusions\n\nThis Agreement does not apply to information that:\n- Was already known to the Receiving Party\n- Is or becomes publicly available through no fault of the Receiving Party\n- Is independently developed without reference to the Confidential Information\n\n## 4. Term\n\nThis Agreement remains in effect for two (2) years from the date of signing.\n\n## 5. Return of Materials\n\nUpon request, the Receiving Party shall promptly return or destroy all Confidential Information.'
);
