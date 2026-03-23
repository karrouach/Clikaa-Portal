-- ─────────────────────────────────────────────────────────────────────────────
-- 010_invoices.sql
-- Invoices table for the Clikaa billing module.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists invoices (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        references workspaces(id) on delete set null,
  invoice_number text        not null,
  status         text        not null default 'draft'
                             check (status in ('draft','pending','paid','overdue','failed','cancelled')),
  client_name    text,
  issue_date     date,
  due_date       date,
  line_items     jsonb       not null default '[]',
  notes          text,
  tax_pct        numeric(6,3) not null default 0,
  subtotal       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  sent_at        timestamptz,
  created_by     uuid        references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists invoices_workspace_id_idx on invoices (workspace_id);
create index if not exists invoices_created_by_idx   on invoices (created_by);
create index if not exists invoices_status_idx       on invoices (status);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function set_invoice_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_invoice_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table invoices enable row level security;

-- Admins can do everything with invoices
create policy "Admins can manage invoices"
  on invoices for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role = 'admin'
    )
  );

-- Clients can view invoices for their workspaces
create policy "Clients can view their workspace invoices"
  on invoices for select
  using (
    workspace_id is not null
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id = invoices.workspace_id
      and wm.user_id = auth.uid()
    )
  );
