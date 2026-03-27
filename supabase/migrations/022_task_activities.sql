-- ─────────────────────────────────────────────────────────────────────────────
-- 022_task_activities.sql
-- Audit trail for task lifecycle events (creation, status changes)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.task_activities (
  id          uuid        default gen_random_uuid() primary key,
  task_id     uuid        not null references public.tasks(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id),
  action      text        not null check (action in ('created', 'status_changed')),
  old_status  text,
  new_status  text,
  created_at  timestamptz default now() not null
);

create index if not exists task_activities_task_idx on public.task_activities(task_id, created_at desc);

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.task_activities enable row level security;

-- Workspace members can read activities for tasks they have access to
drop policy if exists "workspace members can read task activities" on public.task_activities;
create policy "workspace members can read task activities"
  on public.task_activities for select
  using (
    exists (
      select 1
      from public.tasks t
      join public.workspace_members wm on wm.workspace_id = t.workspace_id
      where t.id = task_activities.task_id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace members can insert activity logs
drop policy if exists "workspace members can insert task activities" on public.task_activities;
create policy "workspace members can insert task activities"
  on public.task_activities for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      join public.workspace_members wm on wm.workspace_id = t.workspace_id
      where t.id = task_activities.task_id
        and wm.user_id = auth.uid()
    )
  );
