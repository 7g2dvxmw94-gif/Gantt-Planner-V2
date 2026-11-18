-- ============================================================
-- Calendrier du projet (jours ouvres, feries)
--
-- Le calendrier etait un reglage du COMPTE
-- (user_settings.customization.calendar) : sur un projet partage, chaque
-- membre calculait les dates avec le sien. Il devient un champ du projet,
-- lu a l'identique par tous ses membres. Celui du compte reste le modele
-- des nouveaux projets.
--
-- Forme : { workingDays: int[], holidays: text[], useFrenchHolidays:
-- bool, alsaceMoselle: bool }, normalisee par le client
-- (calendrierNormalise, js/utils.js). NULL : le calendrier par defaut
-- (lundi-vendredi, feries francais), comme un compte sans reglage.
--
-- REPRISE (choix de l'utilisateur) : un projet existant recoit le
-- calendrier ACTUEL de son proprietaire. Rien ne bouge chez lui ; les
-- membres passent sur le sien. Mesure avant application : 10 projets,
-- aucun compte n'a de calendrier enregistre — la reprise ne modifie
-- aucune ligne aujourd'hui. Elle reste ecrite pour qu'une base ou un
-- compte en porte un soit traite pareil.
--
-- ECRITE PAR UPDATE DIRECT (supabase-store.js, setProjectCalendar), comme
-- status_date et deadline (028) : la RPC upsert_project ne la nomme pas et
-- ne l'ecrase donc jamais. La politique « projects: update if editor »
-- (002_rls_policies.sql) couvre deja cette mise a jour.
--
-- A APPLIQUER AVANT le code qui la lit et l'ecrit.
-- ============================================================

alter table public.projects
    add column if not exists calendar jsonb;

alter table public.projects drop constraint if exists projects_calendar_object_check;
alter table public.projects add constraint projects_calendar_object_check
    check (calendar is null or jsonb_typeof(calendar) = 'object');

update public.projects p
   set calendar = us.customization -> 'calendar'
  from public.user_settings us
 where us.user_id = p.owner_id
   and p.calendar is null
   and jsonb_typeof(us.customization -> 'calendar') = 'object';

comment on column public.projects.calendar is
    'Calendrier du projet (jours ouvres, feries). Null : lundi-vendredi et feries francais.';
