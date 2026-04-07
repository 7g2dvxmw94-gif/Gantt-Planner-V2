-- ============================================================
-- GANTT PLANNER PRO — Schéma de base de données Supabase
-- Migration 001 : Structure initiale
-- ============================================================

-- Extension UUID (déjà activée par défaut dans Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE : profiles
-- Étend auth.users de Supabase avec les infos métier
-- ============================================================
create table public.profiles (
    id              uuid primary key references auth.users(id) on delete cascade,
    email           text not null,
    full_name       text,
    avatar_url      text,                              -- URL ou data URI
    -- Abonnement
    plan            text not null default 'free'
                    check (plan in ('free', 'pro', 'team')),
    plan_status     text not null default 'active'
                    check (plan_status in ('active', 'trialing', 'canceled', 'past_due')),
    trial_ends_at   timestamptz,
    -- Stripe
    stripe_customer_id      text unique,
    stripe_subscription_id  text unique,
    -- Préférences
    lang            text not null default 'fr'
                    check (lang in ('fr', 'en')),
    theme           text not null default 'light'
                    check (theme in ('light', 'dark', 'system')),
    -- Timestamps
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE : projects
-- Un projet appartient à un propriétaire (owner_id)
-- Plusieurs utilisateurs peuvent y être membres via project_members
-- ============================================================
create table public.projects (
    id              uuid primary key default uuid_generate_v4(),
    owner_id        uuid not null references public.profiles(id) on delete cascade,
    name            text not null,
    description     text,
    start_date      date,
    end_date        date,
    budget          numeric(12, 2) default 0,
    budget_used     numeric(12, 2) default 0,
    color           text,                              -- couleur d'identification
    -- Métadonnées Gantt
    active_baseline_id  uuid,                          -- FK ajoutée après création de baselines
    zoom_level      text default 'week'
                    check (zoom_level in ('day', 'week', 'month', 'quarter')),
    -- Timestamps
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE : project_members
-- Relation many-to-many entre utilisateurs et projets
-- Rôles : owner | editor | viewer
-- ============================================================
create table public.project_members (
    id              uuid primary key default uuid_generate_v4(),
    project_id      uuid not null references public.projects(id) on delete cascade,
    user_id         uuid not null references public.profiles(id) on delete cascade,
    role            text not null default 'viewer'
                    check (role in ('owner', 'editor', 'viewer')),
    invited_by      uuid references public.profiles(id),
    invited_at      timestamptz not null default now(),
    joined_at       timestamptz,
    -- Un utilisateur ne peut avoir qu'un seul rôle par projet
    unique (project_id, user_id)
);

-- ============================================================
-- TABLE : tasks
-- Tâches d'un projet (hiérarchiques via parent_id)
-- ============================================================
create table public.tasks (
    id              uuid primary key default uuid_generate_v4(),
    project_id      uuid not null references public.projects(id) on delete cascade,
    parent_id       uuid references public.tasks(id) on delete cascade,
    name            text not null,
    description     text,
    start_date      date,
    end_date        date,
    progress        integer default 0 check (progress between 0 and 100),
    priority        text default 'medium'
                    check (priority in ('low', 'medium', 'high')),
    status          text default 'todo'
                    check (status in ('todo', 'in_progress', 'done')),
    color           text,
    sort_order      integer default 0,
    -- Types
    is_milestone    boolean default false,
    is_phase        boolean default false,
    is_permit       boolean default false,
    collapsed       boolean default false,
    -- Dépendances (stockées en JSONB : [{taskId, type}])
    dependencies    jsonb default '[]',
    -- Coûts fixes (stockés en JSONB : [{name, amount}])
    fixed_costs     jsonb default '[]',
    -- Permit (champs spécifiques permis de construire)
    permit_type             text,
    permit_status           text,
    dossier_number          text,
    commune                 text,
    service_instructeur     text,
    abf_sector              boolean default false,
    deposit_date            date,
    completeness_date       date,
    decision_date           date,
    -- Timestamps
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE : task_assignees
-- Assignation many-to-many tâches ↔ ressources
-- ============================================================
create table public.task_assignees (
    task_id         uuid not null references public.tasks(id) on delete cascade,
    resource_id     uuid not null,                     -- FK vers resources
    primary key (task_id, resource_id)
);

-- ============================================================
-- TABLE : resources
-- Ressources humaines disponibles dans un projet
-- ============================================================
create table public.resources (
    id              uuid primary key default uuid_generate_v4(),
    project_id      uuid not null references public.projects(id) on delete cascade,
    name            text not null,
    role            text,
    avatar          text,                              -- initiales ex: "JD"
    color           text,
    hourly_rate     numeric(10, 2) default 0,
    created_at      timestamptz not null default now()
);

-- Contrainte FK différée (task_assignees → resources)
alter table public.task_assignees
    add constraint task_assignees_resource_fk
    foreign key (resource_id) references public.resources(id) on delete cascade;

-- ============================================================
-- TABLE : baselines
-- Snapshots d'état d'un projet à un instant T
-- ============================================================
create table public.baselines (
    id              uuid primary key default uuid_generate_v4(),
    project_id      uuid not null references public.projects(id) on delete cascade,
    created_by      uuid references public.profiles(id),
    name            text not null,
    -- Snapshot complet des tâches au format JSONB
    tasks_snapshot  jsonb not null default '[]',
    created_at      timestamptz not null default now()
);

-- FK active_baseline_id maintenant que baselines existe
alter table public.projects
    add constraint projects_active_baseline_fk
    foreign key (active_baseline_id) references public.baselines(id) on delete set null;

-- ============================================================
-- TABLE : invitations
-- Invitations en attente (email pas encore inscrit)
-- ============================================================
create table public.invitations (
    id              uuid primary key default uuid_generate_v4(),
    project_id      uuid not null references public.projects(id) on delete cascade,
    invited_by      uuid not null references public.profiles(id),
    email           text not null,
    role            text not null default 'viewer'
                    check (role in ('editor', 'viewer')),
    token           text not null unique default encode(gen_random_bytes(32), 'hex'),
    expires_at      timestamptz not null default (now() + interval '7 days'),
    accepted_at     timestamptz,
    created_at      timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS : updated_at automatique
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger trg_projects_updated_at
    before update on public.projects
    for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
    before update on public.tasks
    for each row execute function public.set_updated_at();

-- ============================================================
-- TRIGGER : créer un profile automatiquement après signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
    insert into public.profiles (id, email, full_name, avatar_url)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        coalesce(new.raw_user_meta_data->>'avatar_url', '')
    );
    return new;
end;
$$;

create trigger trg_on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ============================================================
-- INDEX : performances
-- ============================================================
create index idx_projects_owner       on public.projects(owner_id);
create index idx_project_members_user on public.project_members(user_id);
create index idx_project_members_proj on public.project_members(project_id);
create index idx_tasks_project        on public.tasks(project_id);
create index idx_tasks_parent         on public.tasks(parent_id);
create index idx_resources_project    on public.resources(project_id);
create index idx_baselines_project    on public.baselines(project_id);
create index idx_invitations_token    on public.invitations(token);
create index idx_invitations_email    on public.invitations(email);
