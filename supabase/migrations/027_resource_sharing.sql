-- ============================================================
-- Partage de ressources entre projets
--
-- Jusqu'ici une ressource (public.resources) appartenait a un SEUL
-- projet (project_id not null), sans mecanisme pour l'emprunter sur un
-- second projet. Le code applicatif (store.js, supabase-store.js) fait
-- deja reference a cette migration ("migration 027") et a une table de
-- liaison project_resources : ce fichier comble l'ecart, le schema
-- ayant ete applique manuellement sur l'instance de production avant
-- d'etre versionne ici.
--
-- - project_resources : table many-to-many exprimant l'EMPRUNT d'une
--   ressource par un projet qui n'en est pas proprietaire.
--   resource.project_id continue de designer le projet PROPRIETAIRE.
-- - resources.rate_type / daily_rate / works_weekends : tarification au
--   Taux Journalier Moyen (TJM), en plus du taux horaire existant.
-- - RLS resources en lecture : un membre d'un projet ayant EMPRUNTE la
--   ressource doit pouvoir la lire, pas seulement le projet proprietaire.
-- ============================================================

-- ---- Tarification TJM ----
alter table public.resources
    add column if not exists rate_type text not null default 'hourly'
        check (rate_type in ('hourly', 'daily')),
    add column if not exists daily_rate numeric(10, 2) default 0,
    add column if not exists works_weekends boolean not null default false;

-- ---- Table de liaison project_resources ----
create table if not exists public.project_resources (
    project_id      uuid not null references public.projects(id) on delete cascade,
    resource_id     uuid not null references public.resources(id) on delete cascade,
    created_at      timestamptz not null default now(),
    primary key (project_id, resource_id)
);

alter table public.project_resources enable row level security;

drop policy if exists "project_resources: read if member" on public.project_resources;
create policy "project_resources: read if member"
    on public.project_resources for select
    using (public.is_project_member(project_id));

drop policy if exists "project_resources: write if editor" on public.project_resources;
create policy "project_resources: write if editor"
    on public.project_resources for insert
    with check (public.can_edit_project(project_id));

drop policy if exists "project_resources: delete if editor" on public.project_resources;
create policy "project_resources: delete if editor"
    on public.project_resources for delete
    using (public.can_edit_project(project_id));

-- ---- RLS resources : lecture etendue au partage ----
-- L'ancienne policy combinee ("write if editor" pour insert/update/delete)
-- et la lecture restreinte au seul projet proprietaire sont remplacees
-- par des policies distinctes par operation, plus une lecture qui
-- reconnait aussi les projets EMPRUNTEURS via project_resources.
drop policy if exists "resources: read if member" on public.resources;
drop policy if exists "resources: write if editor" on public.resources;

create policy "resources: read if member of any linked project"
    on public.resources for select
    using (
        public.is_project_member(project_id)
        or exists (
            select 1 from public.project_resources pr
            where pr.resource_id = resources.id
              and public.is_project_member(pr.project_id)
        )
    );

create policy "resources: insert if editor"
    on public.resources for insert
    with check (public.can_edit_project(project_id));

create policy "resources: update if editor"
    on public.resources for update
    using (public.can_edit_project(project_id));

create policy "resources: delete if editor"
    on public.resources for delete
    using (public.can_edit_project(project_id));

create index if not exists idx_project_resources_resource on public.project_resources(resource_id);
