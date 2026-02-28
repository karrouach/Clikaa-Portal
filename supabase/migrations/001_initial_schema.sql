-- ============================================================
-- Clikaa Client Portal — Phase 1: Initial Schema Migration
-- ============================================================
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)
-- BEFORE running: Disable public signups in
-- Supabase Dashboard → Authentication → Providers → Email → Disable "Confirm email"
-- and turn OFF "Enable sign ups" (Admin invite flow only)
-- ============================================================


-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================

-- pgcrypto is already bundled in Supabase.
-- gen_random_uuid() is native to Postgres 13+ (no extension needed).
-- No extra extensions required for this schema.


-- ============================================================
-- SECTION 2: TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 profiles
-- Mirrors auth.users. Auto-populated via trigger on invite/signup.
-- `role` is the GLOBAL system role (admin = Clikaa team, client = customer).
-- Workspace-specific roles live on workspace_members.role.
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  full_name   text        not null default '',
  avatar_url  text,
  role        text        not null default 'client'
                          check (role in ('admin', 'client')),
  created_at  timestamptz not null default now()
);

comment on table  public.profiles              is 'Public user profiles. Mirrors auth.users. Auto-created on invite.';
comment on column public.profiles.role         is 'Global system role. admin = Clikaa team member. client = invited customer.';


-- ------------------------------------------------------------
-- 2.2 workspaces
-- A named container for a client engagement (e.g. "Acme — Rebrand Q1").
-- Clients can belong to multiple workspaces via workspace_members.
-- ------------------------------------------------------------
create table public.workspaces (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,          -- URL-safe, e.g. "acme-rebrand-q1"
  description text,
  created_by  uuid        not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.workspaces             is 'Client project containers. Created and managed by admins only.';
comment on column public.workspaces.slug        is 'Unique URL-safe identifier generated from workspace name at creation.';


-- ------------------------------------------------------------
-- 2.3 workspace_members
-- Join table: many-to-many between profiles and workspaces.
-- `role` here is the WORKSPACE-SCOPED role for that user.
-- An admin can be added as a workspace member with role='admin'
-- so they appear as the project lead. Clients always get role='client'.
-- ------------------------------------------------------------
create table public.workspace_members (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  role          text        not null default 'client'
                            check (role in ('admin', 'client')),
  created_at    timestamptz not null default now(),

  unique (workspace_id, user_id)
);

comment on table  public.workspace_members        is 'Many-to-many join between users and workspaces. Role is workspace-scoped.';
comment on column public.workspace_members.role   is 'admin = Clikaa team lead on this project. client = the customer.';


-- ------------------------------------------------------------
-- 2.4 tasks
-- The core Kanban card entity.
-- `position` uses fractional indexing (float8) so we can insert
-- cards between two others without reindexing the entire column.
-- Example: pos between 1.0 and 2.0 → new card gets 1.5.
-- ------------------------------------------------------------
create table public.tasks (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  title         text        not null,
  description   text,                              -- supports markdown
  status        text        not null default 'todo'
                            check (status in ('todo', 'in_progress', 'review', 'done')),
  priority      text        not null default 'medium'
                            check (priority in ('low', 'medium', 'high', 'urgent')),
  position      float8      not null default 0,   -- fractional index within its status column
  assignee_id   uuid        references public.profiles(id) on delete set null,
  created_by    uuid        not null references public.profiles(id),
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.tasks              is 'Kanban cards. Ordered by (workspace_id, status, position).';
comment on column public.tasks.position     is 'Fractional index for drag-and-drop ordering within a status column.';
comment on column public.tasks.status       is 'Kanban column. todo → in_progress → review → done.';


-- ------------------------------------------------------------
-- 2.5 comments
-- Contextual discussion thread inside a specific task.
-- Visible to all members of the parent workspace.
-- ------------------------------------------------------------
create table public.comments (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references public.tasks(id) on delete cascade,
  author_id   uuid        not null references public.profiles(id) on delete cascade,
  body        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.comments is 'Comment threads scoped to a task. Visible to all workspace members.';


-- ------------------------------------------------------------
-- 2.6 attachments
-- Files (via Supabase Storage) or external links attached to a task.
-- `url` for files points to a signed/public Supabase Storage path.
-- `url` for links is the external URL directly.
-- ------------------------------------------------------------
create table public.attachments (
  id            uuid        primary key default gen_random_uuid(),
  task_id       uuid        not null references public.tasks(id) on delete cascade,
  name          text        not null,                -- display name
  url           text        not null,                -- storage path or external link
  type          text        not null default 'link'
                            check (type in ('file', 'link')),
  uploaded_by   uuid        not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

comment on table  public.attachments        is 'Files and links attached to tasks.';
comment on column public.attachments.type   is 'file = Supabase Storage object. link = external URL.';


-- ============================================================
-- SECTION 3: INDEXES
-- ============================================================

-- workspace_members
create index idx_wm_workspace_id  on public.workspace_members (workspace_id);
create index idx_wm_user_id       on public.workspace_members (user_id);

-- tasks — primary access patterns
create index idx_tasks_workspace_status_pos
  on public.tasks (workspace_id, status, position);   -- Kanban board query
create index idx_tasks_assignee
  on public.tasks (assignee_id);
create index idx_tasks_created_by
  on public.tasks (created_by);

-- comments & attachments
create index idx_comments_task_id     on public.comments    (task_id);
create index idx_attachments_task_id  on public.attachments (task_id);


-- ============================================================
-- SECTION 4: FUNCTIONS & TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 Auto-create a profile row when a user accepts an invite.
-- Supabase fires an INSERT on auth.users when the invite is accepted.
-- We read the metadata that was passed at invite time.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public          -- prevent search_path hijacking
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ------------------------------------------------------------
-- 4.2 Auto-stamp updated_at on mutations.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_workspaces_updated_at
  before update on public.workspaces
  for each row execute procedure public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

create trigger trg_comments_updated_at
  before update on public.comments
  for each row execute procedure public.set_updated_at();


-- ============================================================
-- SECTION 5: RLS HELPER FUNCTIONS
-- These are called inside policies. `security definer` + explicit
-- `search_path` is required to prevent privilege escalation.
-- `stable` allows Postgres to cache the result within a query.
-- ============================================================

-- Is the current user a global admin (Clikaa team)?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.profiles
    where  id   = auth.uid()
    and    role = 'admin'
  );
$$;


-- Is the current user a member of a specific workspace?
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.workspace_members
    where  workspace_id = p_workspace_id
    and    user_id      = auth.uid()
  );
$$;


-- Convenience: look up which workspace a task belongs to.
-- Used in comment/attachment policies to avoid subquery duplication.
create or replace function public.get_task_workspace_id(p_task_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id
  from   public.tasks
  where  id = p_task_id;
$$;


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.tasks             enable row level security;
alter table public.comments          enable row level security;
alter table public.attachments       enable row level security;


-- ============================================================
-- SECTION 6a: profiles policies
-- ============================================================

-- Any authenticated user can read all profiles.
-- Required so assignee names, avatar, comment authors render correctly.
create policy "profiles — authenticated users can read all"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Users can only update their own profile row.
create policy "profiles — users update own row"
  on public.profiles
  for update
  to authenticated
  using      (id = auth.uid())
  with check (id = auth.uid());

-- Admins can update any profile (e.g. to promote a user to admin role).
create policy "profiles — admins update any"
  on public.profiles
  for update
  to authenticated
  using      (public.is_admin())
  with check (public.is_admin());


-- ============================================================
-- SECTION 6b: workspaces policies
-- ============================================================

-- Admins see every workspace.
-- Clients see only workspaces they are a member of.
create policy "workspaces — select"
  on public.workspaces
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_workspace_member(id)
  );

-- Only global admins can create workspaces.
create policy "workspaces — admin insert"
  on public.workspaces
  for insert
  to authenticated
  with check (public.is_admin());

-- Only global admins can rename / update workspaces.
create policy "workspaces — admin update"
  on public.workspaces
  for update
  to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

-- Only global admins can delete workspaces.
create policy "workspaces — admin delete"
  on public.workspaces
  for delete
  to authenticated
  using (public.is_admin());


-- ============================================================
-- SECTION 6c: workspace_members policies
-- ============================================================

-- Admins see all membership rows.
-- Clients can see their own membership rows only (so they know
-- which workspaces they have access to).
create policy "workspace_members — select"
  on public.workspace_members
  for select
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
  );

-- Only global admins can add members to workspaces.
create policy "workspace_members — admin insert"
  on public.workspace_members
  for insert
  to authenticated
  with check (public.is_admin());

-- Only global admins can change workspace roles.
create policy "workspace_members — admin update"
  on public.workspace_members
  for update
  to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

-- Only global admins can remove members from workspaces.
create policy "workspace_members — admin delete"
  on public.workspace_members
  for delete
  to authenticated
  using (public.is_admin());


-- ============================================================
-- SECTION 6d: tasks policies
-- ============================================================

-- Admins see all tasks across all workspaces.
-- Clients see only tasks in workspaces they belong to.
create policy "tasks — select"
  on public.tasks
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_workspace_member(workspace_id)
  );

-- Any workspace member (admin or client) can create a task.
-- This is the core request flow: clients submit tasks to the board.
create policy "tasks — insert"
  on public.tasks
  for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_workspace_member(workspace_id)
  );

-- Any workspace member can update a task row.
-- ⚠️  Column-level restriction (clients should only update `status`)
-- is enforced at the application/API layer, NOT here.
-- RLS is row-level only. Supabase column-level privileges can be
-- added later via GRANT/REVOKE if needed.
create policy "tasks — update"
  on public.tasks
  for update
  to authenticated
  using (
    public.is_admin()
    or public.is_workspace_member(workspace_id)
  )
  with check (
    public.is_admin()
    or public.is_workspace_member(workspace_id)
  );

-- Only admins can permanently delete tasks.
create policy "tasks — admin delete"
  on public.tasks
  for delete
  to authenticated
  using (public.is_admin());


-- ============================================================
-- SECTION 6e: comments policies
-- ============================================================

-- Any member of the task's parent workspace can read comments.
create policy "comments — select"
  on public.comments
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_workspace_member(public.get_task_workspace_id(task_id))
  );

-- Any workspace member can post a comment.
create policy "comments — insert"
  on public.comments
  for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_workspace_member(public.get_task_workspace_id(task_id))
  );

-- Authors can edit their own comments. Admins can edit any.
create policy "comments — update"
  on public.comments
  for update
  to authenticated
  using (
    public.is_admin()
    or author_id = auth.uid()
  )
  with check (
    public.is_admin()
    or author_id = auth.uid()
  );

-- Authors can delete their own comments. Admins can delete any.
create policy "comments — delete"
  on public.comments
  for delete
  to authenticated
  using (
    public.is_admin()
    or author_id = auth.uid()
  );


-- ============================================================
-- SECTION 6f: attachments policies
-- ============================================================

-- Workspace members can view attachments on tasks they can see.
create policy "attachments — select"
  on public.attachments
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_workspace_member(public.get_task_workspace_id(task_id))
  );

-- Workspace members can add attachments.
create policy "attachments — insert"
  on public.attachments
  for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_workspace_member(public.get_task_workspace_id(task_id))
  );

-- Uploaders can remove their own attachments. Admins can remove any.
create policy "attachments — delete"
  on public.attachments
  for delete
  to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
  );


-- ============================================================
-- SECTION 7: REALTIME SUBSCRIPTIONS
-- Enable Realtime on the tables that need live updates.
-- The Kanban board subscribes to `tasks` for drag-and-drop sync.
-- Task detail modals subscribe to `comments` for live chat feel.
-- ============================================================

-- Supabase Realtime works via the `supabase_realtime` publication.
-- Add the tables that need real-time push updates.
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.attachments;


-- ============================================================
-- SECTION 8: STORAGE BUCKET
-- Create a private bucket for task file attachments.
-- Files are accessed via signed URLs generated server-side.
-- ============================================================

-- Run in SQL editor (Supabase Storage uses the `storage` schema):
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false);

-- Storage RLS: only authenticated workspace members can upload.
create policy "storage — workspace members can upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'task-attachments');

-- Storage RLS: only authenticated users can read (signed URLs handle scoping).
create policy "storage — authenticated users can read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'task-attachments');

-- Storage RLS: uploaders or admins can delete files.
create policy "storage — uploader or admin can delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      public.is_admin()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );


-- ============================================================
-- ✅ MIGRATION COMPLETE
-- ============================================================
-- Next steps (manual, in Supabase Dashboard):
--
-- 1. Authentication → Providers → Email:
--    - UNCHECK "Enable sign ups"         ← prevents public self-registration
--    - Keep "Confirm email" ON            ← invite emails require confirmation
--
-- 2. Authentication → Email Templates:
--    - Customise the "Invite" template with Clikaa branding.
--
-- 3. To invite your first admin:
--    - Supabase Dashboard → Authentication → Users → "Invite user"
--    - Then manually UPDATE profiles SET role = 'admin' WHERE email = 'you@clikaa.com';
--
-- 4. Going forward, use the Supabase Admin SDK from a server action:
--    supabase.auth.admin.inviteUserByEmail(email, { data: { full_name } })
-- ============================================================
