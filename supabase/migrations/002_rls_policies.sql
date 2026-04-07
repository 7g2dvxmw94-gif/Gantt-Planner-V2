-- ============================================================
-- GANTT PLANNER PRO — Row Level Security (RLS)
-- Migration 002 : Politiques de sécurité par ligne
-- ============================================================
-- Principe : chaque utilisateur ne voit que ce à quoi il a accès.
-- Un projet est visible si l'utilisateur est membre (project_members).
-- ============================================================

-- Activer RLS sur toutes les tables publiques
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks           enable row level security;
alter table public.task_assignees  enable row level security;
alter table public.resources       enable row level security;
alter table public.baselines       enable row level security;
alter table public.invitations     enable row level security;

-- ============================================================
-- HELPER FUNCTION
-- Vérifie si l'utilisateur courant est membre d'un projet
-- ============================================================
create or replace function public.is_project_member(p_project_id uuid)
returns boolean language sql security definer stable as $$
    select exists (
        select 1 from public.project_members
        where project_id = p_project_id
          and user_id = auth.uid()
    );
$$;

-- Vérifie si l'utilisateur a un rôle >= editor sur un projet
create or replace function public.can_edit_project(p_project_id uuid)
returns boolean language sql security definer stable as $$
    select exists (
        select 1 from public.project_members
        where project_id = p_project_id
          and user_id = auth.uid()
          and role in ('owner', 'editor')
    );
$$;

-- Vérifie si l'utilisateur est propriétaire d'un projet
create or replace function public.is_project_owner(p_project_id uuid)
returns boolean language sql security definer stable as $$
    select exists (
        select 1 from public.project_members
        where project_id = p_project_id
          and user_id = auth.uid()
          and role = 'owner'
    );
$$;

-- ============================================================
-- POLICIES : profiles
-- ============================================================

-- Lecture : chaque utilisateur voit son propre profil
create policy "profiles: read own"
    on public.profiles for select
    using (id = auth.uid());

-- Les membres d'un projet commun peuvent voir les profils des autres membres
create policy "profiles: read project members"
    on public.profiles for select
    using (
        exists (
            select 1 from public.project_members pm1
            join public.project_members pm2 on pm1.project_id = pm2.project_id
            where pm1.user_id = auth.uid()
              and pm2.user_id = profiles.id
        )
    );

-- Mise à jour : chaque utilisateur modifie uniquement son propre profil
create policy "profiles: update own"
    on public.profiles for update
    using (id = auth.uid());

-- ============================================================
-- POLICIES : projects
-- ============================================================

-- Lecture : visible si membre du projet
create policy "projects: read if member"
    on public.projects for select
    using (public.is_project_member(id));

-- Création : tout utilisateur connecté peut créer un projet
create policy "projects: insert authenticated"
    on public.projects for insert
    with check (auth.uid() = owner_id);

-- Modification : seulement owner ou editor
create policy "projects: update if editor"
    on public.projects for update
    using (public.can_edit_project(id));

-- Suppression : seulement le propriétaire
create policy "projects: delete if owner"
    on public.projects for delete
    using (public.is_project_owner(id));

-- ============================================================
-- POLICIES : project_members
-- ============================================================

-- Lecture : visible par les membres du même projet
create policy "project_members: read if member"
    on public.project_members for select
    using (public.is_project_member(project_id));

-- Ajout d'un membre : seulement owner ou editor
create policy "project_members: insert if editor"
    on public.project_members for insert
    with check (public.can_edit_project(project_id));

-- Modification du rôle : seulement owner
create policy "project_members: update if owner"
    on public.project_members for update
    using (public.is_project_owner(project_id));

-- Suppression d'un membre : owner, ou l'utilisateur lui-même (quitter)
create policy "project_members: delete if owner or self"
    on public.project_members for delete
    using (
        public.is_project_owner(project_id)
        or user_id = auth.uid()
    );

-- ============================================================
-- POLICIES : tasks
-- ============================================================

-- Lecture : visible si membre du projet
create policy "tasks: read if member"
    on public.tasks for select
    using (public.is_project_member(project_id));

-- Création / modification : seulement editor ou owner
create policy "tasks: insert if editor"
    on public.tasks for insert
    with check (public.can_edit_project(project_id));

create policy "tasks: update if editor"
    on public.tasks for update
    using (public.can_edit_project(project_id));

-- Suppression : seulement editor ou owner
create policy "tasks: delete if editor"
    on public.tasks for delete
    using (public.can_edit_project(project_id));

-- ============================================================
-- POLICIES : task_assignees
-- ============================================================

create policy "task_assignees: read if member"
    on public.task_assignees for select
    using (
        exists (
            select 1 from public.tasks t
            where t.id = task_id
              and public.is_project_member(t.project_id)
        )
    );

create policy "task_assignees: write if editor"
    on public.task_assignees for all
    using (
        exists (
            select 1 from public.tasks t
            where t.id = task_id
              and public.can_edit_project(t.project_id)
        )
    );

-- ============================================================
-- POLICIES : resources
-- ============================================================

create policy "resources: read if member"
    on public.resources for select
    using (public.is_project_member(project_id));

create policy "resources: write if editor"
    on public.resources for all
    using (public.can_edit_project(project_id));

-- ============================================================
-- POLICIES : baselines
-- ============================================================

create policy "baselines: read if member"
    on public.baselines for select
    using (public.is_project_member(project_id));

create policy "baselines: insert if editor"
    on public.baselines for insert
    with check (public.can_edit_project(project_id));

create policy "baselines: delete if owner"
    on public.baselines for delete
    using (public.is_project_owner(project_id));

-- ============================================================
-- POLICIES : invitations
-- ============================================================

-- Un invité peut lire son invitation via le token (sans auth)
create policy "invitations: read by token"
    on public.invitations for select
    using (true);   -- filtré côté app par le token

-- Créer une invitation : owner ou editor du projet
create policy "invitations: insert if editor"
    on public.invitations for insert
    with check (public.can_edit_project(project_id));

-- Supprimer : owner du projet ou l'inviteur
create policy "invitations: delete if owner or inviter"
    on public.invitations for delete
    using (
        public.is_project_owner(project_id)
        or invited_by = auth.uid()
    );
