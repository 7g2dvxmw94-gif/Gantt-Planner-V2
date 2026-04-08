/* ========================================
   SUPABASE STORE
   Couche d'accès aux données Supabase
   Mappeurs camelCase (store) ↔ snake_case (Supabase)
   ======================================== */

import { supabase } from './supabase-client.js';
import { auth } from './auth.js';

/* ---- Mappers Store → Supabase (camelCase → snake_case) ---- */

function projectToRow(p, ownerId) {
    return {
        id:          p.id,
        owner_id:    ownerId,
        name:        p.name,
        description: p.description || '',
        start_date:  p.startDate  || null,
        end_date:    p.endDate    || null,
        budget:      p.budget     || 0,
        budget_used: p.budgetUsed || 0,
        color:       p.color      || null,
        zoom_level:  p.zoomLevel  || 'week',
        updated_at:  new Date().toISOString(),
    };
}

function taskToRow(t) {
    return {
        id:                   t.id,
        project_id:           t.projectId,
        parent_id:            t.parentId     || null,
        name:                 t.name,
        description:          t.description  || '',
        start_date:           t.startDate    || null,
        end_date:             t.endDate      || null,
        progress:             t.progress     ?? 0,
        priority:             t.priority     || 'medium',
        status:               t.status       || 'todo',
        color:                t.color        || '#6366F1',
        sort_order:           t.order        ?? 0,
        is_milestone:         t.isMilestone  || false,
        is_phase:             t.isPhase      || false,
        is_permit:            t.isPermit     || false,
        collapsed:            t.collapsed    || false,
        dependencies:         t.dependencies || [],
        fixed_costs:          t.fixedCosts   || [],
        // Permit fields
        permit_type:              t.permitType              || null,
        permit_status:            t.permitStatus            || null,
        dossier_number:           t.dossierNumber           || null,
        commune:                  t.commune                 || null,
        service_instructeur:      t.serviceInstructeur      || null,
        abf_sector:               t.abfSector               || false,
        deposit_date:             t.depositDate             || null,
        completeness_date:        t.completenessDate        || null,
        decision_date:            t.decisionDate            || null,
        updated_at:               new Date().toISOString(),
    };
}

function resourceToRow(r) {
    return {
        id:          r.id,
        project_id:  r.projectId,
        name:        r.name,
        role:        r.role        || '',
        avatar:      r.avatar      || '',
        color:       r.color       || '#6366F1',
        hourly_rate: r.hourlyRate  || 0,
    };
}

/* ---- Mappers Supabase → Store (snake_case → camelCase) ---- */

function rowToProject(row) {
    return {
        id:              row.id,
        name:            row.name,
        description:     row.description || '',
        startDate:       row.start_date  || '',
        endDate:         row.end_date    || '',
        budget:          parseFloat(row.budget)      || 0,
        budgetUsed:      parseFloat(row.budget_used) || 0,
        color:           row.color      || null,
        zoomLevel:       row.zoom_level || 'week',
        resourceIds:     [],
        activeBaselineId: row.active_baseline_id || null,
        createdAt:       row.created_at,
        updatedAt:       row.updated_at,
        _role:           row._role || 'owner', // rôle de l'utilisateur courant
    };
}

function rowToTask(row) {
    return {
        id:           row.id,
        projectId:    row.project_id,
        parentId:     row.parent_id   || null,
        name:         row.name,
        description:  row.description || '',
        startDate:    row.start_date  || '',
        endDate:      row.end_date    || '',
        progress:     row.progress    ?? 0,
        priority:     row.priority    || 'medium',
        status:       row.status      || 'todo',
        color:        row.color       || '#6366F1',
        order:        row.sort_order  ?? 0,
        isMilestone:  row.is_milestone || false,
        isPhase:      row.is_phase     || false,
        isPermit:     row.is_permit    || false,
        collapsed:    row.collapsed    || false,
        dependencies: row.dependencies || [],
        fixedCosts:   row.fixed_costs  || [],
        assignees:    [],   // rechargé séparément via task_assignees
        assignee:     null,
        // Permit fields
        permitType:          row.permit_type          || '',
        permitStatus:        row.permit_status        || '',
        dossierNumber:       row.dossier_number       || '',
        commune:             row.commune              || '',
        serviceInstructeur:  row.service_instructeur  || '',
        abfSector:           row.abf_sector           || false,
        depositDate:         row.deposit_date         || '',
        completenessDate:    row.completeness_date    || '',
        decisionDate:        row.decision_date        || '',
        createdAt:           row.created_at,
        updatedAt:           row.updated_at,
    };
}

function rowToResource(row) {
    return {
        id:         row.id,
        projectId:  row.project_id,
        name:       row.name,
        role:       row.role       || '',
        avatar:     row.avatar     || '',
        color:      row.color      || '#6366F1',
        hourlyRate: parseFloat(row.hourly_rate) || 0,
    };
}

function rowToBaseline(row) {
    return {
        id:        row.id,
        projectId: row.project_id,
        name:      row.name,
        tasks:     row.tasks_snapshot || [],
        createdAt: row.created_at,
    };
}

/* ---- Supabase Store API ---- */

export const supabaseStore = {

    /* ---- PROJECTS ---- */

    async getProjects() {
        const user = await auth.getUser();
        if (!user) return [];

        // Récupérer tous les projets où l'utilisateur est membre
        const { data, error } = await supabase
            .from('project_members')
            .select(`
                role,
                projects (*)
            `)
            .eq('user_id', user.id);

        if (error) {
            console.error('[supabaseStore] getProjects:', error);
            return [];
        }
        return (data || []).map(row => ({
            ...rowToProject(row.projects),
            _role: row.role,
        }));
    },

    async upsertProject(project, ownerId) {
        const row = projectToRow(project, ownerId);
        const { error } = await supabase.rpc('upsert_project', {
            p_id:          row.id,
            p_name:        row.name,
            p_description: row.description || '',
            p_start_date:  row.start_date  || null,
            p_end_date:    row.end_date    || null,
            p_budget:      row.budget      || 0,
            p_budget_used: row.budget_used || 0,
            p_color:       row.color       || null,
            p_zoom_level:  row.zoom_level  || 'week',
        });
        if (error) console.error('[supabaseStore] upsertProject:', error);
    },

    async addProjectMember(projectId, userId, role = 'owner') {
        const { error } = await supabase
            .from('project_members')
            .upsert({ project_id: projectId, user_id: userId, role, joined_at: new Date().toISOString() });
        if (error) console.error('[supabaseStore] addProjectMember:', error);
    },

    async deleteProject(projectId) {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);
        if (error) console.error('[supabaseStore] deleteProject:', error);
    },

    /* ---- TASKS ---- */

    async getTasks(projectId) {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('[supabaseStore] getTasks:', error);
            return [];
        }
        const tasks = (data || []).map(rowToTask);

        // Charger les assignees pour toutes les tâches en une requête
        const taskIds = tasks.map(t => t.id);
        if (taskIds.length) {
            const { data: assignees } = await supabase
                .from('task_assignees')
                .select('task_id, resource_id')
                .in('task_id', taskIds);

            (assignees || []).forEach(a => {
                const task = tasks.find(t => t.id === a.task_id);
                if (task) {
                    task.assignees.push(a.resource_id);
                    task.assignee = task.assignees[0] || null;
                }
            });
        }
        return tasks;
    },

    async upsertTask(task) {
        const { error } = await supabase
            .from('tasks')
            .upsert(taskToRow(task));
        if (error) console.error('[supabaseStore] upsertTask:', error);
    },

    async deleteTask(taskId) {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);
        if (error) console.error('[supabaseStore] deleteTask:', error);
    },

    async syncTaskAssignees(taskId, assigneeIds) {
        // Supprimer les anciens, insérer les nouveaux
        await supabase.from('task_assignees').delete().eq('task_id', taskId);
        if (assigneeIds.length) {
            const rows = assigneeIds.map(rid => ({ task_id: taskId, resource_id: rid }));
            const { error } = await supabase.from('task_assignees').insert(rows);
            if (error) console.error('[supabaseStore] syncTaskAssignees:', error);
        }
    },

    /* ---- RESOURCES ---- */

    async getResources(projectId) {
        const { data, error } = await supabase
            .from('resources')
            .select('*')
            .eq('project_id', projectId);
        if (error) {
            console.error('[supabaseStore] getResources:', error);
            return [];
        }
        return (data || []).map(rowToResource);
    },

    async upsertResource(resource) {
        const { error } = await supabase.rpc('upsert_resource', {
            p_id:          resource.id,
            p_project_id:  resource.projectId,
            p_name:        resource.name,
            p_role:        resource.role || '',
            p_avatar:      resource.avatar || '',
            p_color:       resource.color || '#6366F1',
            p_hourly_rate: resource.hourlyRate || 0,
        });
        if (error) console.error('[supabaseStore] upsertResource:', error);
    },

    async deleteResource(resourceId) {
        const { error } = await supabase.rpc('delete_resource', {
            p_resource_id: resourceId,
        });
        if (error) console.error('[supabaseStore] deleteResource:', error);
    },

    /* ---- BASELINES ---- */

    async getBaselines(projectId) {
        const { data, error } = await supabase
            .from('baselines')
            .select('*')
            .eq('project_id', projectId);
        if (error) {
            console.error('[supabaseStore] getBaselines:', error);
            return [];
        }
        return (data || []).map(rowToBaseline);
    },

    async upsertBaseline(baseline) {
        const user = await auth.getUser();
        const { error } = await supabase.from('baselines').upsert({
            id:             baseline.id,
            project_id:     baseline.projectId,
            created_by:     user?.id,
            name:           baseline.name,
            tasks_snapshot: baseline.tasks || [],
        });
        if (error) console.error('[supabaseStore] upsertBaseline:', error);
    },

    async deleteBaseline(baselineId) {
        const { error } = await supabase
            .from('baselines')
            .delete()
            .eq('id', baselineId);
        if (error) console.error('[supabaseStore] deleteBaseline:', error);
    },
};
