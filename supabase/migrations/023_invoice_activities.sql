-- ─────────────────────────────────────────────────────────────────────────────
-- 023_invoice_activities.sql
-- Audit trail for invoice lifecycle events (creation, status changes)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.invoice_activities (
  id          uuid        default gen_random_uuid() primary key,
  invoice_id  uuid        not null references public.invoices(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id),
  event       text        not null,
  old_status  text,
  new_status  text,
  created_at  timestamptz default now() not null
);

create index if not exists invoice_activities_invoice_idx
  on public.invoice_activities(invoice_id, created_at asc);

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.invoice_activities enable row level security;

-- Workspace members and admins can read activities for invoices they have access to
drop policy if exists "members can read invoice activities" on public.invoice_activities;
create policy "members can read invoice activities"
  on public.invoice_activities for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or exists (
      select 1
      from public.invoices i
      join public.workspace_members wm on wm.workspace_id = i.workspace_id
      where i.id = invoice_activities.invoice_id
        and wm.user_id = auth.uid()
    )
  );

-- Admins can insert activity logs
drop policy if exists "admins can insert invoice activities" on public.invoice_activities;
create policy "admins can insert invoice activities"
  on public.invoice_activities for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
