-- ============================================================
-- GANTT PLANNER PRO — Migration 003
-- Fix: chicken-and-egg pour project_members
-- ============================================================

-- 1. Corriger la politique RLS : permettre à l'owner du projet
--    de s'ajouter dans project_members même s'il n'y est pas encore
drop policy if exists "project_members: insert if editor" on public.project_members;

create policy "project_members: insert if editor or owner"
    on public.project_members for insert
    with check (
        public.can_edit_project(project_id)
        OR
        exists (
            select 1 from public.projects
            where id = project_id
              and owner_id = auth.uid()
        )
    );

-- 2. Trigger : ajouter automatiquement l'owner dans project_members
--    à la création d'un projet (évite d'avoir à le faire côté JS)
create or replace function public.handle_new_project()
returns trigger language plpgsql security definer as $$
begin
    insert into public.project_members (project_id, user_id, role, joined_at)
    values (new.id, new.owner_id, 'owner', now())
    on conflict (project_id, user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists trg_on_project_created on public.projects;

create trigger trg_on_project_created
    after insert on public.projects
    for each row execute function public.handle_new_project();
