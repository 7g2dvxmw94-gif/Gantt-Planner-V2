-- ============================================================
-- Migration 005 : User Settings (customization, logo, avatar)
-- ============================================================

CREATE TABLE public.user_settings (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null unique references public.profiles(id) on delete cascade,
    customization   jsonb default '{}',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies: users can only read/write their own settings
CREATE POLICY "user_settings: read own"
    ON public.user_settings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "user_settings: insert own"
    ON public.user_settings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_settings: update own"
    ON public.user_settings FOR UPDATE
    USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER trg_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC to upsert user settings
CREATE OR REPLACE FUNCTION public.upsert_user_settings(p_customization jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.user_settings (user_id, customization)
    VALUES (v_user_id, p_customization)
    ON CONFLICT (user_id) DO UPDATE SET
        customization = p_customization;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_settings(jsonb) TO authenticated;
