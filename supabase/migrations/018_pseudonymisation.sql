-- ============================================================
-- Migration 018 : Pseudonymisation — emails & noms
-- Hash des emails dans invitations (SHA-256)
-- Pseudonymisation des noms (initiales) dans notifications
-- et project_history
-- ============================================================

-- 1. Fonction utilitaire : transforme "Jean Dupont" → "J.D."
CREATE OR REPLACE FUNCTION public.to_initials(full_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    parts  text[];
    result text := '';
    part   text;
BEGIN
    IF full_name IS NULL OR full_name = '' THEN
        RETURN '?';
    END IF;

    parts := string_to_array(trim(full_name), ' ');
    FOREACH part IN ARRAY parts LOOP
        IF part <> '' THEN
            result := result || upper(left(part, 1)) || '.';
        END IF;
    END LOOP;

    RETURN result;
END;
$$;

-- 2. Colonne hash pour les emails d'invitation
ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS email_hash text;

-- 3. Peupler les hashs existants
UPDATE public.invitations
SET email_hash = encode(extensions.digest(lower(trim(email)), 'sha256'), 'hex')
WHERE email IS NOT NULL AND email_hash IS NULL;

-- 4. Trigger : auto-hasher l'email à chaque invitation
CREATE OR REPLACE FUNCTION public.hash_invitation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.email_hash := encode(
            extensions.digest(lower(trim(NEW.email)), 'sha256'), 'hex'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_invitation_email ON public.invitations;
CREATE TRIGGER trg_hash_invitation_email
    BEFORE INSERT OR UPDATE OF email
    ON public.invitations
    FOR EACH ROW EXECUTE FUNCTION public.hash_invitation_email();

-- 5. Pseudonymiser les actor_name existants dans notifications
--    Convertir "Jean Dupont" → "J.D." pour les futures entrées
CREATE OR REPLACE FUNCTION public.notify_task_deleted(
    p_project_id  uuid,
    p_task_name   text,
    p_actor_id    uuid,
    p_actor_name  text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.notifications
        (recipient_id, actor_id, actor_name, type, message, task_name, project_id)
    SELECT
        pm.user_id,
        p_actor_id,
        public.to_initials(p_actor_name),           -- pseudonymisé
        'task_deleted',
        'a supprimé une tâche',
        p_task_name,
        p_project_id
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id <> p_actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_project_shared(
    p_project_id   uuid,
    p_project_name text,
    p_actor_id     uuid,
    p_actor_name   text,
    p_invitee_id   uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.notifications
        (recipient_id, actor_id, actor_name, type, message, project_id)
    VALUES (
        p_invitee_id,
        p_actor_id,
        public.to_initials(p_actor_name),           -- pseudonymisé
        'project_shared',
        'vous a partagé un projet : ' || p_project_name,
        p_project_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_project_removed(
    p_project_id   uuid,
    p_project_name text,
    p_actor_id     uuid,
    p_actor_name   text,
    p_removed_id   uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.notifications
        (recipient_id, actor_id, actor_name, type, message, project_id)
    VALUES (
        p_removed_id,
        p_actor_id,
        public.to_initials(p_actor_name),           -- pseudonymisé
        'project_removed',
        'vous a retiré du projet : ' || p_project_name,
        p_project_id
    );
END;
$$;

-- 6. Pseudonymiser les actor_name dans log_project_history
CREATE OR REPLACE FUNCTION public.log_project_history(
    p_project_id  uuid,
    p_actor_id    uuid,
    p_actor_name  text,
    p_action      text,
    p_entity_type text,
    p_entity_name text,
    p_delta       jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.project_history
        (project_id, actor_id, actor_name, action, entity_type, entity_name, delta)
    VALUES (
        p_project_id,
        p_actor_id,
        public.to_initials(p_actor_name),           -- pseudonymisé
        p_action,
        p_entity_type,
        p_entity_name,
        p_delta
    );

    -- Purge stochastique (10 % des insertions nettoient les entrées > 7 jours)
    IF random() < 0.1 THEN
        DELETE FROM public.project_history
        WHERE created_at < now() - interval '7 days';
    END IF;
END;
$$;

-- 7. Pseudonymiser les données existantes
UPDATE public.notifications
SET actor_name = public.to_initials(actor_name)
WHERE actor_name IS NOT NULL AND actor_name NOT LIKE '%.%';

UPDATE public.project_history
SET actor_name = public.to_initials(actor_name)
WHERE actor_name IS NOT NULL AND actor_name NOT LIKE '%.%';

NOTIFY pgrst, 'reload schema';
