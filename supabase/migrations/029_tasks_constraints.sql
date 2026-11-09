-- ============================================================
-- Contraintes de date des taches (« Doit commencer le », etc.)
--
-- Deux colonnes NULLABLES, sans valeur par defaut : une tache qui n'en a
-- pas garde exactement son comportement d'avant, « Des que possible ».
-- Aucune ligne existante n'est modifiee.
--
-- - constraint_type : null (des que possible) ou l'un des six codes de
--   MS Project : SNET (debut au plus tot le), SNLT (debut au plus tard
--   le), FNET (fin au plus tot le), FNLT (fin au plus tard le), MSO (doit
--   commencer le), MFO (doit finir le). Aucune valeur 'ASAP' n'est
--   stockee : null dit « aucune contrainte ».
-- - constraint_date : la date SAISIE, jamais la date recalee sur le
--   calendrier ouvre, qui se recalcule au placement.
--
-- Les deux CHECK doublent la normalisation du client (contrainteDe,
-- js/utils.js, par laquelle passe taskToRow) : ils ne rejettent une ligne
-- que si le client a laisse passer une incoherence. Un rejet ferait perdre
-- TOUTE l'ecriture de la tache, dates comprises : le client n'envoie donc
-- jamais un type inconnu, une date illisible, ni l'un sans l'autre.
--
-- A APPLIQUER AVANT de deployer le code qui envoie ces colonnes : PostgREST
-- rejette une ligne qui nomme une colonne inconnue (PGRST204), et toute
-- ecriture de tache echouerait. Le code d'avant ne les envoie pas : la
-- migration est sans effet sur lui.
-- ============================================================

alter table public.tasks
    add column if not exists constraint_type text,
    add column if not exists constraint_date date;

alter table public.tasks drop constraint if exists tasks_constraint_type_check;
alter table public.tasks add constraint tasks_constraint_type_check
    check (constraint_type is null
           or constraint_type in ('SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'));

alter table public.tasks drop constraint if exists tasks_constraint_pair_check;
alter table public.tasks add constraint tasks_constraint_pair_check
    check ((constraint_type is null) = (constraint_date is null));

comment on column public.tasks.constraint_type is
    'Contrainte de date (null : des que possible). SNET SNLT FNET FNLT MSO MFO.';
comment on column public.tasks.constraint_date is
    'Date de la contrainte telle que saisie ; recalee sur le calendrier au placement.';

notify pgrst, 'reload schema';
