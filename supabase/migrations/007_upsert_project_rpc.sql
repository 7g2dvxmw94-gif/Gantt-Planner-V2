-- ============================================================
-- Migration 007 : RPC upsert_project (bypass RLS)
-- Même pattern que delete_project — SECURITY DEFINER
-- PostgREST .upsert() nécessite INSERT + UPDATE RLS,
-- ce qui échoue pour un nouveau projet (pas encore de
-- project_members). Cette RPC contourne le problème.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_project(
    p_id          uuid,
    p_owner_id    uuid,
    p_name        text,
    p_description text    DEFAULT '',
    p_start_date  date    DEFAULT NULL,
    p_end_date    date    DEFAULT NULL,
    p_budget      numeric DEFAULT 0,
    p_budget_used numeric DEFAULT 0,
    p_color       text    DEFAULT NULL,
    p_zoom_level  text    DEFAULT 'week'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Insert or update the project
    INSERT INTO public.projects (id, owner_id, name, description, start_date, end_date,
                                  budget, budget_used, color, zoom_level, updated_at)
    VALUES (p_id, p_owner_id, p_name, p_description, p_start_date, p_end_date,
            p_budget, p_budget_used, p_color, p_zoom_level, now())
    ON CONFLICT (id) DO UPDATE SET
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        start_date  = EXCLUDED.start_date,
        end_date    = EXCLUDED.end_date,
        budget      = EXCLUDED.budget,
        budget_used = EXCLUDED.budget_used,
        color       = EXCLUDED.color,
        zoom_level  = EXCLUDED.zoom_level,
        updated_at  = now();

    -- Ensure owner is in project_members (idempotent)
    INSERT INTO public.project_members (project_id, user_id, role, joined_at)
    VALUES (p_id, v_user_id, 'owner', now())
    ON CONFLICT (project_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_project(uuid, uuid, text, text, date, date, numeric, numeric, text, text) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
