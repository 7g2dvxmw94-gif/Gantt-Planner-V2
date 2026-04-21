-- ============================================================
-- Migration 017 : Sécurité Niveau 2 — pgcrypto + chiffrement
-- Chiffre les identifiants Stripe sensibles dans profiles
-- Ajoute des colonnes hash pour les lookups (SHA-256)
-- ============================================================

-- 1. Activer l'extension pgcrypto (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Fonctions de chiffrement/déchiffrement
--    La clé est lue depuis la config Supabase : app.encryption_key
--    À définir dans : Supabase Dashboard → Database → Settings → Configuration
CREATE OR REPLACE FUNCTION public.encrypt_field(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    enc_key text := current_setting('app.encryption_key', true);
BEGIN
    IF enc_key IS NULL OR enc_key = '' OR plaintext IS NULL THEN
        RETURN plaintext;
    END IF;
    RETURN encode(extensions.pgp_sym_encrypt(plaintext, enc_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_field(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    enc_key text := current_setting('app.encryption_key', true);
BEGIN
    IF enc_key IS NULL OR enc_key = '' OR ciphertext IS NULL THEN
        RETURN ciphertext;
    END IF;
    BEGIN
        RETURN extensions.pgp_sym_decrypt(decode(ciphertext, 'base64'), enc_key);
    EXCEPTION WHEN OTHERS THEN
        RETURN ciphertext;
    END;
END;
$$;

-- Restreindre l'accès à ces fonctions au service_role uniquement
REVOKE ALL ON FUNCTION public.decrypt_field(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_field(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_field(text) TO service_role;

-- 3. Ajouter colonnes hash pour les lookups Stripe (SHA-256 non-réversible)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_customer_id_hash      text UNIQUE,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id_hash  text UNIQUE;

-- 4. Trigger : auto-hasher les IDs Stripe à chaque INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.hash_stripe_ids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.stripe_customer_id IS NOT NULL THEN
        NEW.stripe_customer_id_hash := encode(
            extensions.digest(NEW.stripe_customer_id, 'sha256'), 'hex'
        );
    ELSE
        NEW.stripe_customer_id_hash := NULL;
    END IF;

    IF NEW.stripe_subscription_id IS NOT NULL THEN
        NEW.stripe_subscription_id_hash := encode(
            extensions.digest(NEW.stripe_subscription_id, 'sha256'), 'hex'
        );
    ELSE
        NEW.stripe_subscription_id_hash := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_stripe_ids ON public.profiles;
CREATE TRIGGER trg_hash_stripe_ids
    BEFORE INSERT OR UPDATE OF stripe_customer_id, stripe_subscription_id
    ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.hash_stripe_ids();

-- 5. Peupler les hashs pour les données existantes
UPDATE public.profiles
SET
    stripe_customer_id_hash = CASE
        WHEN stripe_customer_id IS NOT NULL
        THEN encode(extensions.digest(stripe_customer_id, 'sha256'), 'hex')
        ELSE NULL END,
    stripe_subscription_id_hash = CASE
        WHEN stripe_subscription_id IS NOT NULL
        THEN encode(extensions.digest(stripe_subscription_id, 'sha256'), 'hex')
        ELSE NULL END
WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;

-- 6. Vue sécurisée : projet membres voient uniquement les champs non-sensibles
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT
    id,
    full_name,
    avatar_url,
    lang,
    theme
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;

NOTIFY pgrst, 'reload schema';
