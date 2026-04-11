-- ============================================================
-- Migration 012 : Journal d'historique projet (project_history)
-- Trace les actions importantes des 7 derniers jours.
-- Purge automatique via trigger.
-- ============================================================

-- TABLE
CREATE TABLE public.project_history (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    actor_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name  text        NOT NULL DEFAULT '',
    action      text        NOT NULL,
    entity_type text,       -- 'task' | 'phase' | 'resource' | 'baseline' | 'share'
    entity_name text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_history ON public.project_history(project_id, created_at DESC);

-- RLS
ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history: read if member"
    ON public.project_history FOR SELECT
    USING (public.is_project_member(project_id));

-- PURGE TRIGGER : supprime les entrées > 7 jours à chaque insertion (10 % du temps)
CREATE OR REPLACE FUNCTION public.purge_project_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF random() < 0.1 THEN
        DELETE FROM public.project_history
        WHERE created_at < NOW() - INTERVAL '7 days';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_purge_project_history
    AFTER INSERT ON public.project_history
    FOR EACH ROW EXECUTE FUNCTION public.purge_project_history();

-- RPC : écriture SECURITY DEFINER (bypass RLS pour l'insert)
CREATE OR REPLACE FUNCTION public.log_project_history(
    p_project_id  uuid,
    p_action      text,
    p_entity_type text DEFAULT NULL,
    p_entity_name text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id   uuid := auth.uid();
    v_actor_name text;
BEGIN
    IF v_actor_id IS NULL THEN RETURN; END IF;

    SELECT COALESCE(NULLIF(full_name, ''), email)
    INTO v_actor_name
    FROM public.profiles WHERE id = v_actor_id;

    INSERT INTO public.project_history
        (project_id, actor_id, actor_name, action, entity_type, entity_name)
    VALUES (
        p_project_id,
        v_actor_id,
        COALESCE(v_actor_name, 'Quelqu''un'),
        p_action,
        p_entity_type,
        p_entity_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_project_history(uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
