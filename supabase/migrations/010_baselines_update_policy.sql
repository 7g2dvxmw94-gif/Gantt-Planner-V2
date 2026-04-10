-- ============================================================
-- Migration 010 : UPDATE policy for baselines
-- Required for upsert (PostgREST upsert needs both INSERT + UPDATE)
-- and for renaming baselines.
-- ============================================================

CREATE POLICY "baselines: update if editor"
    ON public.baselines FOR UPDATE
    USING (public.can_edit_project(project_id));

NOTIFY pgrst, 'reload schema';
