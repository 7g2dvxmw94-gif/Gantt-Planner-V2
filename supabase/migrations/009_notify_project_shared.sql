-- ============================================================
-- Migration 009 : RPC notify_project_shared
-- Notifie l'utilisateur invité quand il est ajouté à un projet
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_project_shared(
    p_project_id  uuid,
    p_email       text,
    p_role        text   -- 'editor' | 'viewer'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id    uuid := auth.uid();
    v_actor_name  text;
    v_recipient   uuid;
    v_project     text;
    v_role_label  text;
BEGIN
    IF v_actor_id IS NULL THEN RETURN; END IF;

    -- Nom de l'acteur (celui qui partage)
    SELECT COALESCE(NULLIF(full_name, ''), email)
    INTO v_actor_name
    FROM public.profiles WHERE id = v_actor_id;

    -- ID du destinataire
    SELECT id INTO v_recipient
    FROM public.profiles WHERE email = lower(trim(p_email));
    IF v_recipient IS NULL THEN RETURN; END IF;  -- pas encore inscrit

    -- Nom du projet
    SELECT name INTO v_project
    FROM public.projects WHERE id = p_project_id;

    -- Libellé du rôle
    v_role_label := CASE p_role
        WHEN 'editor'  THEN 'écriture'
        WHEN 'viewer'  THEN 'lecture seule'
        ELSE p_role
    END;

    -- Insérer la notification pour le destinataire
    INSERT INTO public.notifications
        (project_id, recipient_id, actor_id, actor_name, type, message, task_name)
    VALUES (
        p_project_id,
        v_recipient,
        v_actor_id,
        v_actor_name,
        'project_shared',
        v_actor_name || ' vous a partagé le projet "' || v_project || '" en ' || v_role_label,
        v_project || '|' || p_role   -- task_name utilisé pour stocker projectName|role
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_project_shared(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
