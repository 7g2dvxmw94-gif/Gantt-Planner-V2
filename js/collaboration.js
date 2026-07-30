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
                profiles!project_members_user_id_fkey (id, email, full_name, avatar_url)
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
            /* CORRECTIF : window.location.origin ne contient PAS le chemin.
               Sur GitHub Pages l'app vit dans un sous-repertoire, le lien
               genere pointait donc vers
                 https://<compte>.github.io/invite.html?token=...
               au lieu de
                 https://<compte>.github.io/Gantt-Planner-V2/invite.html?token=...
               et menait a une page 404. new URL() resout relativement a la
               page courante, ce qui fonctionne aussi bien a la racine d'un
               domaine dedie que dans un sous-chemin. */
            const inviteLink = new URL(`invite.html?token=${data.token}`,
                                       window.location.href).href;
            /* Envoi de l'email via l'Edge Function send-invitation.
               Volontairement NON bloquant : si l'envoi echoue (quota Resend
               atteint, domaine non verifie, panne du service), l'invitation
               existe deja en base et le lien reste affiche pour un envoi
               manuel. Faire echouer l'invitation entiere pour un probleme
               d'email serait une regression fonctionnelle. */
            let emailSent = false;
            let emailError = null;
            try {
                const { data: sendData, error: sendError } =
                    await supabase.functions.invoke('send-invitation', {
                        body: { token: data.token },
                    });
                if (sendError) throw sendError;
                emailSent = Boolean(sendData?.sent);
            } catch (err) {
                emailError = err?.message || "Envoi de l'email impossible";
                console.warn('[collaboration] email non envoye:', emailError);
            }

            return {
                type: 'invited',
                email,
                link: inviteLink,
                token: data.token,
                emailSent,
                emailError,
            };
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
        /* Passe desormais par la RPC accept_invitation (migration 021).
           L'ancienne version faisait un upsert direct sur project_members,
           ce que la politique RLS refusait : l'invite n'est pas encore
           membre du projet, donc can_edit_project() renvoyait false. La
           fonctionnalite ne pouvait donc PAS fonctionner.

           La RPC, en SECURITY DEFINER, verifie cote serveur :
             - existence et validite du token
             - date d'expiration
             - correspondance avec l'email destinataire (l'invitation est
               nominative : un token vole est inutilisable par un tiers)
             - quota de collaborateurs de l'offre du proprietaire
             - non-reutilisation (verrou FOR UPDATE anti-concurrence)

           Retour : { project_id, role } */
        const { data, error } = await supabase.rpc('accept_invitation', {
            p_token: token,
        });

        if (error) {
            /* Les messages leves par RAISE EXCEPTION cote SQL sont deja
               rediges pour l'utilisateur final et remontent dans
               error.message. */
            throw new Error(error.message || "Impossible d'accepter cette invitation.");
        }

        return data;
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
