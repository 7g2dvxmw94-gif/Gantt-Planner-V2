/* ========================================
   COLLABORATION
   Gestion des invitations et membres de projet
   ======================================== */

import { supabase } from './supabase-client.js';
import { auth } from './auth.js';

export const collaboration = {

    /* ---- Membres d'un projet ---- */

    async getProjectMembers(projectId) {
        const { data, error } = await supabase
            .from('project_members')
            .select(`
                role,
                invited_at,
                joined_at,
                profiles (id, email, full_name, avatar_url)
            `)
            .eq('project_id', projectId);

        if (error) {
            console.error('[collaboration] getProjectMembers:', error);
            return [];
        }
        return (data || []).map(row => ({
            userId:    row.profiles.id,
            email:     row.profiles.email,
            name:      row.profiles.full_name || row.profiles.email,
            avatarUrl: row.profiles.avatar_url,
            role:      row.role,
            joinedAt:  row.joined_at,
        }));
    },

    async updateMemberRole(projectId, userId, newRole) {
        const { error } = await supabase
            .from('project_members')
            .update({ role: newRole })
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    async removeMember(projectId, userId) {
        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    /* ---- Invitations ---- */

    async inviteUser(projectId, email, role = 'editor') {
        const user = await auth.getUser();
        if (!user) throw new Error('Non connecté');

        // Utiliser la fonction RPC SECURITY DEFINER pour bypasser les deadlocks RLS
        const { data, error } = await supabase.rpc('invite_to_project', {
            p_project_id: projectId,
            p_email:      email.toLowerCase().trim(),
            p_role:       role,
        });

        if (error) throw error;

        if (data.type === 'invited') {
            const inviteLink = `${window.location.origin}/invite.html?token=${data.token}`;
            return { type: 'invited', email, link: inviteLink, token: data.token };
        }
        return { type: data.type, email };
    },

    async getPendingInvitations(projectId) {
        const { data, error } = await supabase
            .from('invitations')
            .select('*')
            .eq('project_id', projectId)
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString());

        if (error) {
            console.error('[collaboration] getPendingInvitations:', error);
            return [];
        }
        return data || [];
    },

    async cancelInvitation(invitationId) {
        const { error } = await supabase
            .from('invitations')
            .delete()
            .eq('id', invitationId);

        if (error) throw error;
    },

    /* ---- Accepter une invitation via token ---- */

    async acceptInvitation(token) {
        // 1. Récupérer l'invitation
        const { data: inv, error: fetchError } = await supabase
            .from('invitations')
            .select('*')
            .eq('token', token)
            .is('accepted_at', null)
            .single();

        if (fetchError || !inv) throw new Error('Invitation introuvable ou expirée.');
        if (new Date(inv.expires_at) < new Date()) throw new Error('Cette invitation a expiré.');

        const user = await auth.getUser();
        if (!user) throw new Error('Vous devez être connecté pour accepter cette invitation.');

        // 2. Ajouter l'utilisateur comme membre
        const { error: memberError } = await supabase
            .from('project_members')
            .upsert({
                project_id: inv.project_id,
                user_id:    user.id,
                role:       inv.role,
                invited_by: inv.invited_by,
                joined_at:  new Date().toISOString(),
            });

        if (memberError) throw memberError;

        // 3. Marquer l'invitation comme acceptée
        await supabase
            .from('invitations')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', inv.id);

        return inv;
    },

    /* ---- Rôle courant sur un projet ---- */

    async getCurrentUserRole(projectId) {
        const user = await auth.getUser();
        if (!user) return null;

        const { data } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();

        return data?.role || null;
    },
};
