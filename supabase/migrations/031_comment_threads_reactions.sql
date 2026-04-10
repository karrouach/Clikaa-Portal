-- 031_comment_threads_reactions.sql
-- Adds 1-level threaded replies and persisted emoji reactions to comments.

-- parent_id: nullable self-FK — allows a comment to be a reply to another comment.
-- We enforce only 1 level deep in the application layer.
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}';

-- Index for looking up replies by parent
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments (parent_id);
