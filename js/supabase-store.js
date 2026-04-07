/* ========================================
   SUPABASE STORE
   Couche d'accès aux données Supabase
   ======================================== */

import { supabase } from './supabase-client.js';
import { auth } from './auth.js';

export const supabaseStore = {

    /* ---- PROJECTS ---- */

    async getProjects() {
        const user = await auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('projects')
            .select(`
                *,
                project_members(user_id, role)
            `)
            .or(`owner_id.eq.${user.id},project_members.user_id.eq.${user.id}`);

        if (error) {
            console.error('[supabaseStore] getProjects:', error);
            return [];
        }
        return data || [];
    },

    async createProject(name, description = '') {
        const user = await auth.getUser();
        if (!user) throw new Error('Non connecté');

        // Créer le projet
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .insert([{
                owner_id: user.id,
                name,
                description,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (projectError) throw projectError;

        // Ajouter l'owner comme membre avec rôle 'owner'
        const { error: memberError } = await supabase
            .from('project_members')
            .insert([{
                project_id: project.id,
                user_id: user.id,
                role: 'owner',
                joined_at: new Date().toISOString(),
            }]);

        if (memberError) throw memberError;
        return project;
    },

    async updateProject(projectId, updates) {
        const { data, error } = await supabase
            .from('projects')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteProject(projectId) {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) throw error;
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
        return data || [];
    },

    async createTask(projectId, taskData) {
        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                project_id: projectId,
                ...taskData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateTask(taskId, updates) {
        const { data, error } = await supabase
            .from('tasks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', taskId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteTask(taskId) {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);

        if (error) throw error;
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
        return data || [];
    },

    async createResource(projectId, resourceData) {
        const { data, error } = await supabase
            .from('resources')
            .insert([{
                project_id: projectId,
                ...resourceData,
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateResource(resourceId, updates) {
        const { data, error } = await supabase
            .from('resources')
            .update(updates)
            .eq('id', resourceId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteResource(resourceId) {
        const { error } = await supabase
            .from('resources')
            .delete()
            .eq('id', resourceId);

        if (error) throw error;
    },

    /* ---- TASK ASSIGNEES ---- */

    async getTaskAssignees(taskId) {
        const { data, error } = await supabase
            .from('task_assignees')
            .select('resource_id')
            .eq('task_id', taskId);

        if (error) {
            console.error('[supabaseStore] getTaskAssignees:', error);
            return [];
        }
        return (data || []).map(a => a.resource_id);
    },

    async addTaskAssignee(taskId, resourceId) {
        const { error } = await supabase
            .from('task_assignees')
            .insert([{ task_id: taskId, resource_id: resourceId }]);

        if (error && !error.message.includes('duplicate key')) throw error;
    },

    async removeTaskAssignee(taskId, resourceId) {
        const { error } = await supabase
            .from('task_assignees')
            .delete()
            .eq('task_id', taskId)
            .eq('resource_id', resourceId);

        if (error) throw error;
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
        return data || [];
    },

    async createBaseline(projectId, name, tasksSnapshot) {
        const user = await auth.getUser();
        if (!user) throw new Error('Non connecté');

        const { data, error } = await supabase
            .from('baselines')
            .insert([{
                project_id: projectId,
                created_by: user.id,
                name,
                tasks_snapshot: tasksSnapshot,
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteBaseline(baselineId) {
        const { error } = await supabase
            .from('baselines')
            .delete()
            .eq('id', baselineId);

        if (error) throw error;
    },
};
