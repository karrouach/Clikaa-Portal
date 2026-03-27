-- Add current_phase to workspaces (1 = Brief & Planning … 5 = Launch)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS current_phase integer NOT NULL DEFAULT 1;

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_current_phase_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_current_phase_check
  CHECK (current_phase BETWEEN 1 AND 5);
