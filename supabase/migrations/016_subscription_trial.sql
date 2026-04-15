-- ============================================================
-- Migration 016 : Abonnement — essai gratuit 14 jours
-- Démarre automatiquement un essai Pro à l'inscription
-- ============================================================

-- 1. S'assurer que les colonnes existent (idempotent)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS plan            text NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free','pro','team')),
    ADD COLUMN IF NOT EXISTS plan_status     text NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active','trialing','canceled','past_due')),
    ADD COLUMN IF NOT EXISTS trial_ends_at   timestamptz,
    ADD COLUMN IF NOT EXISTS stripe_customer_id     text UNIQUE,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE;

-- 2. Mettre à jour le trigger handle_new_user pour démarrer l'essai
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        plan,
        plan_status,
        trial_ends_at,
        lang,
        theme
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        'free',
        'trialing',
        now() + interval '14 days',   -- essai gratuit 14 jours
        'fr',
        'light'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- S'assurer que le trigger existe sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Démarrer un essai pour les utilisateurs existants sans plan payant
-- (permet de ne pas pénaliser les early adopters)
UPDATE public.profiles
SET
    plan_status   = 'trialing',
    trial_ends_at = now() + interval '14 days'
WHERE
    plan = 'free'
    AND plan_status = 'active'
    AND trial_ends_at IS NULL
    AND stripe_subscription_id IS NULL;

NOTIFY pgrst, 'reload schema';
