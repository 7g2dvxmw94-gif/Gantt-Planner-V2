-- ============================================================
-- Migration 008 : Table notifications + RPC
-- Notifications cross-utilisateurs (ex: suppression de tâche)
-- ============================================================

CREATE TABLE public.notifications (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  uuid        REFERENCES public.projects(id) ON DELETE CASCADE,
    recipient_id uuid       NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name  text        NOT NULL DEFAULT '',
    type        text        NOT NULL,   -- 'task_deleted', 'task_updated', ...
    message     text        NOT NULL,
    task_name   text,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index pour requêtes rapides par destinataire
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur voit uniquement ses propres notifications
CREATE POLICY "notifications: read own"
    ON public.notifications FOR SELECT
    USING (recipient_id = auth.uid());

CREATE POLICY "notifications: update own"
    ON public.notifications FOR UPDATE
    USING (recipient_id = auth.uid());

CREATE POLICY "notifications: delete own"
    ON public.notifications FOR DELETE
    USING (recipient_id = auth.uid());

-- ============================================================
-- RPC : notify_task_deleted
-- Appelée par l'acteur après suppression d'une tâche.
-- Insère une notification pour tous les owners du projet
-- (sauf l'acteur lui-même).
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_task_deleted(
    p_project_id  uuid,
    p_task_name   text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id   uuid := auth.uid();
    v_actor_name text;
    v_owner      RECORD;
BEGIN
    IF v_actor_id IS NULL THEN RETURN; END IF;

    -- Récupérer le nom de l'acteur
    SELECT COALESCE(NULLIF(full_name, ''), email)
    INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;

    -- Insérer une notification pour chaque owner du projet (sauf l'acteur)
    FOR v_owner IN
        SELECT DISTINCT pm.user_id
        FROM public.project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.role = 'owner'
          AND pm.user_id <> v_actor_id
    LOOP
        INSERT INTO public.notifications (project_id, recipient_id, actor_id, actor_name, type, message, task_name)
        VALUES (
            p_project_id,
            v_owner.user_id,
            v_actor_id,
            v_actor_name,
            'task_deleted',
            v_actor_name || ' a supprimé "' || p_task_name || '"',
            p_task_name
        );
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_task_deleted(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
