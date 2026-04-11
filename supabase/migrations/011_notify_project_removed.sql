-- ============================================================
-- Migration 011 : RPC notify_project_removed
-- Notifie un utilisateur quand il est retiré d'un projet
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_project_removed(
    p_project_id  uuid,
    p_user_id     uuid,    -- l'utilisateur retiré
    p_role        text     -- 'editor' | 'viewer'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id    uuid := auth.uid();
    v_actor_name  text;
    v_project     text;
    v_role_label  text;
BEGIN
    IF v_actor_id IS NULL THEN RETURN; END IF;
    IF p_user_id = v_actor_id THEN RETURN; END IF; -- pas de notif pour soi-même

    -- Nom de l'acteur (celui qui retire)
    SELECT COALESCE(NULLIF(full_name, ''), email)
    INTO v_actor_name
    FROM public.profiles WHERE id = v_actor_id;

    -- Nom du projet
    SELECT name INTO v_project
    FROM public.projects WHERE id = p_project_id;

    -- Libellé du rôle
    v_role_label := CASE p_role
        WHEN 'editor'  THEN 'écriture'
        WHEN 'viewer'  THEN 'lecture seule'
        ELSE p_role
    END;

    -- Insérer la notification pour l'utilisateur retiré
    INSERT INTO public.notifications
        (project_id, recipient_id, actor_id, actor_name, type, message, task_name)
    VALUES (
        p_project_id,
        p_user_id,
        v_actor_id,
        v_actor_name,
        'project_removed',
        v_actor_name || ' vous a retiré du projet "' || v_project || '"',
        v_project || '|' || p_role
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_project_removed(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
