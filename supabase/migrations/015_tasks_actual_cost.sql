-- ============================================================
-- Migration 015 : Ajout de la colonne actual_cost sur tasks
-- Persiste le coût réel saisi manuellement dans l'onglet Coûts
-- ============================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS actual_cost numeric(14,2) DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
