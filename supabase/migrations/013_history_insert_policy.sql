-- ============================================================
-- Migration 013 : INSERT policy for project_history
-- Allows editors/owners to insert directly (no RPC needed)
-- ============================================================

CREATE POLICY "history: insert if editor"
    ON public.project_history FOR INSERT
    WITH CHECK (public.can_edit_project(project_id));

NOTIFY pgrst, 'reload schema';
