-- ============================================================
-- Migration 004 : RPC functions pour bypasser les deadlocks RLS
-- ============================================================

-- Fonction : s'assurer que l'owner est dans project_members
CREATE OR REPLACE FUNCTION public.ensure_project_owner(p_project_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_role text;
BEGIN
    -- Vérifier si déjà membre
    SELECT role INTO v_role
    FROM public.project_members
    WHERE project_id = p_project_id AND user_id = v_user_id;

    IF v_role IS NOT NULL THEN
        RETURN v_role;
    END IF;

    -- Vérifier si owner via la table projects
    IF NOT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = p_project_id AND owner_id = v_user_id
    ) THEN
        RETURN NULL;
    END IF;

    -- Ajouter comme owner
    INSERT INTO public.project_members (project_id, user_id, role, joined_at)
    VALUES (p_project_id, v_user_id, 'owner', now())
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

    RETURN 'owner';
END;
$$;

-- Fonction : inviter un utilisateur (bypass RLS)
CREATE OR REPLACE FUNCTION public.invite_to_project(
    p_project_id uuid,
    p_email text,
    p_role text DEFAULT 'viewer'
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_existing_id uuid;
    v_token text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Vérifier permission (membre éditeur/owner OU owner via projects)
    IF NOT (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_id = p_project_id AND user_id = v_user_id AND role IN ('owner', 'editor')
        ) OR EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_project_id AND owner_id = v_user_id
        )
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Vérifier si l'email est déjà inscrit
    SELECT id INTO v_existing_id FROM public.profiles WHERE email = lower(trim(p_email)) LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        INSERT INTO public.project_members (project_id, user_id, role, invited_by, joined_at)
        VALUES (p_project_id, v_existing_id, p_role, v_user_id, now())
        ON CONFLICT (project_id, user_id) DO NOTHING;
        RETURN json_build_object('type', 'added', 'email', p_email);
    END IF;

    -- Créer l'invitation
    INSERT INTO public.invitations (project_id, invited_by, email, role)
    VALUES (p_project_id, v_user_id, lower(trim(p_email)), p_role)
    RETURNING token INTO v_token;

    RETURN json_build_object('type', 'invited', 'email', p_email, 'token', v_token);
END;
$$;
