-- ─────────────────────────────────────────────────────────────────────────────
-- 025_meetings.sql
-- Native meeting scheduling for the Calendar view
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.meetings (
  id           uuid        default gen_random_uuid() primary key,
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  title        text        not null,
  meeting_date timestamptz not null,
  meeting_link text,
  created_at   timestamptz default now() not null
);

create index if not exists meetings_workspace_date_idx
  on public.meetings(workspace_id, meeting_date);

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.meetings enable row level security;

-- Admins and workspace members can read meetings
drop policy if exists "workspace members can read meetings" on public.meetings;
create policy "workspace members can read meetings"
  on public.meetings for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meetings.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Admins and workspace members can create meetings
drop policy if exists "workspace members can create meetings" on public.meetings;
create policy "workspace members can create meetings"
  on public.meetings for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meetings.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Admins can delete meetings
drop policy if exists "admins can delete meetings" on public.meetings;
create policy "admins can delete meetings"
  on public.meetings for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
