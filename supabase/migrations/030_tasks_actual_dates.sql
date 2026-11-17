-- ============================================================
-- Dates reelles des taches (« Debut reel », « Fin reelle »)
--
-- Deux colonnes NULLABLES, sans valeur par defaut : une tache sans date
-- reelle garde exactement son comportement d'avant. Aucune ligne
-- existante n'est modifiee.
--
-- - actual_start  : le jour ou la tache a reellement commence ;
-- - actual_finish : le jour ou elle s'est reellement terminee.
--
-- Les deux CHECK doublent la normalisation du client (datesReellesDe,
-- js/utils.js, par laquelle passe taskToRow) : une fin exige un debut, et
-- ne le precede pas. Le client n'envoie jamais une paire incoherente : un
-- rejet ferait perdre TOUTE l'ecriture de la tache, dates prevues
-- comprises.
--
-- A APPLIQUER AVANT de deployer le code qui envoie ces colonnes :
-- PostgREST rejette une ligne qui nomme une colonne inconnue (PGRST204).
-- Le code d'avant ne les envoie pas : la migration est sans effet sur lui.
-- ============================================================

alter table public.tasks
    add column if not exists actual_start  date,
    add column if not exists actual_finish date;

alter table public.tasks drop constraint if exists tasks_actual_finish_needs_start_check;
alter table public.tasks add constraint tasks_actual_finish_needs_start_check
    check (actual_finish is null or actual_start is not null);

alter table public.tasks drop constraint if exists tasks_actual_order_check;
alter table public.tasks add constraint tasks_actual_order_check
    check (actual_finish is null or actual_finish >= actual_start);
