-- ============================================================
-- Date d'etat et echeance du projet (rapport DCMA 14 points)
--
-- Deux colonnes NULLABLES, sans valeur par defaut : un projet qui n'en a
-- pas garde exactement son comportement d'avant.
--
-- - status_date : la date d'etat (« status date » du PAM DCMA 200.1),
--   a laquelle se mesurent les dates invalides (point 9), les taches
--   manquees (11), le CPLI (13) et le BEI (14). Vide, le rapport prend la
--   date du jour et le dit.
-- - deadline : l'echeance du projet. Elle rend mesurables la marge
--   negative (point 7) et le CPLI (13). Ce n'est PAS end_date : celle-ci
--   vaut « creation + 90 jours » a la creation, n'est modifiable nulle
--   part, et sert deja au calcul des jours restants.
--
-- ECRITES PAR UPDATE DIRECT (supabase-store.js, setProjectDates), comme
-- active_baseline_id : la RPC upsert_project ne les nomme pas et ne les
-- ecrase donc jamais. La politique « projects: update if editor »
-- (002_rls_policies.sql) couvre deja cette mise a jour.
-- ============================================================

alter table public.projects
    add column if not exists status_date date,
    add column if not exists deadline    date;

comment on column public.projects.status_date is
    'Date d''etat du projet (rapport DCMA). Null : date du jour.';
comment on column public.projects.deadline is
    'Echeance du projet (rapport DCMA, points 7 et 13). Distincte de end_date.';
