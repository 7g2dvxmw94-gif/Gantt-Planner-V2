-- ============================================================
-- Migration 006 : RPC delete_project (bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Vérifier que l'utilisateur est bien le propriétaire
    IF NOT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = p_project_id AND owner_id = v_user_id
    ) AND NOT EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = p_project_id AND user_id = v_user_id AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Supprimer le projet (cascade supprime tasks, resources, baselines, etc.)
    DELETE FROM public.projects WHERE id = p_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project(uuid) TO authenticated;
