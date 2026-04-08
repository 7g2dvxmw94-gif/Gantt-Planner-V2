/* ========================================
   AUTH SERVICE
   Gestion de l'authentification Supabase
   ======================================== */

import { supabase } from './supabase-client.js';

/* Calcule le base URL correct même en sous-dossier (ex: GitHub Pages /Gantt-Planner-V2/) */
function getBaseUrl() {
    const { origin, pathname } = window.location;
    const dir = pathname.substring(0, pathname.lastIndexOf('/'));
    return origin + dir;
}

export const auth = {

    /* ---- Récupérer la session courante ---- */
    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error('[auth] getSession:', error);
        return session;
    },

    /* ---- Récupérer l'utilisateur courant ---- */
    async getUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) console.error('[auth] getUser:', error);
        return user;
    },

    /* ---- Récupérer le profil Supabase (table profiles) ---- */
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) console.error('[auth] getProfile:', error);
        return data;
    },

    /* ---- Connexion email / mot de passe ---- */
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    /* ---- Inscription email / mot de passe ---- */
    async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
                emailRedirectTo: `${getBaseUrl()}/auth.html?confirmed=1`,
            },
        });
        if (error) throw error;
        return data;
    },

    /* ---- OAuth Google ---- */
    async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${getBaseUrl()}/index.html`,
                queryParams: { access_type: 'offline', prompt: 'consent' },
            },
        });
        if (error) throw error;
    },

    /* ---- OAuth Apple ---- */
    async signInWithApple() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: {
                redirectTo: `${getBaseUrl()}/index.html`,
            },
        });
        if (error) throw error;
    },

    /* ---- Mot de passe oublié ---- */
    async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${getBaseUrl()}/auth.html?reset=1`,
        });
        if (error) throw error;
    },

    /* ---- Déconnexion ---- */
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'auth.html';
    },

    /* ---- Écouter les changements de session ---- */
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    /* ---- Mettre à jour le profil ---- */
    async updateProfile(updates) {
        const user = await this.getUser();
        if (!user) throw new Error('Non connecté');

        const { data, error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /* ---- Vérifier si l'utilisateur est connecté, sinon rediriger ---- */
    async requireAuth() {
        const session = await this.getSession();
        if (!session) {
            window.location.href = 'auth.html';
            return null;
        }
        return session;
    },
};
