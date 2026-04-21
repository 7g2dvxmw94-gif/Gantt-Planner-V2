-- ============================================================
-- Migration 019 : Politique de rétention des données
-- Purge automatique :
--   - notifications > 90 jours
--   - invitations expirées > 7 jours
--   - comptes inactifs > 24 mois (fonction manuelle/cron)
-- ============================================================

-- 1. Purge notifications > 90 jours (trigger stochastique 10%)
CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF random() < 0.1 THEN
        DELETE FROM public.notifications
        WHERE created_at < now() - interval '90 days';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_old_notifications ON public.notifications;
CREATE TRIGGER trg_purge_old_notifications
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.purge_old_notifications();

-- 2. Purge invitations expirées > 7 jours (trigger stochastique 10%)
CREATE OR REPLACE FUNCTION public.purge_expired_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF random() < 0.1 THEN
        DELETE FROM public.invitations
        WHERE expires_at < now()
           OR (created_at < now() - interval '7 days' AND expires_at IS NULL);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_expired_invitations ON public.invitations;
CREATE TRIGGER trg_purge_expired_invitations
    AFTER INSERT ON public.invitations
    FOR EACH ROW EXECUTE FUNCTION public.purge_expired_invitations();

-- 3. Fonction de purge manuelle des comptes inactifs > 24 mois
--    À appeler manuellement ou via pg_cron :
--    SELECT public.purge_inactive_accounts();
CREATE OR REPLACE FUNCTION public.purge_inactive_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Supprimer les données de projets des comptes inactifs depuis 24 mois
    -- (l'utilisateur lui-même reste dans auth.users pour conformité légale)
    -- On purge uniquement les données métier : projets solo, ressources, tâches

    WITH inactive_users AS (
        SELECT id FROM public.profiles
        WHERE updated_at < now() - interval '24 months'
          AND plan = 'free'
          AND stripe_subscription_id IS NULL
          AND id NOT IN (
              SELECT DISTINCT user_id FROM public.project_members
              WHERE role = 'owner'
              AND EXISTS (
                  SELECT 1 FROM public.project_members pm2
                  WHERE pm2.project_id = project_members.project_id
                    AND pm2.user_id <> project_members.user_id
              )
          )
    ),
    solo_projects AS (
        SELECT pm.project_id
        FROM public.project_members pm
        WHERE pm.user_id IN (SELECT id FROM inactive_users)
          AND NOT EXISTS (
              SELECT 1 FROM public.project_members pm2
              WHERE pm2.project_id = pm.project_id
                AND pm2.user_id NOT IN (SELECT id FROM inactive_users)
          )
    )
    DELETE FROM public.projects
    WHERE id IN (SELECT project_id FROM solo_projects);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Purger les notifications orphelines
    DELETE FROM public.notifications
    WHERE recipient_id IN (
        SELECT id FROM public.profiles
        WHERE updated_at < now() - interval '24 months'
    )
    AND created_at < now() - interval '24 months';

    -- Purger les user_settings orphelins
    DELETE FROM public.user_settings
    WHERE user_id IN (
        SELECT id FROM public.profiles
        WHERE updated_at < now() - interval '24 months'
          AND plan = 'free'
          AND stripe_subscription_id IS NULL
    )
    AND updated_at < now() - interval '24 months';

    RETURN deleted_count;
END;
$$;

-- Restreindre à service_role uniquement
REVOKE ALL ON FUNCTION public.purge_inactive_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_inactive_accounts() TO service_role;

-- 4. Purge immédiate des données déjà périmées
-- Notifications > 90 jours
DELETE FROM public.notifications
WHERE created_at < now() - interval '90 days';

-- Invitations expirées
DELETE FROM public.invitations
WHERE expires_at < now();

NOTIFY pgrst, 'reload schema';
