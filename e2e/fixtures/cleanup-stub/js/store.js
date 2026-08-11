/* Faux store, réduit à la surface qu'utilise cleanup.js.
 *  Voir supabase-client.js du même dossier pour le pourquoi. */

import { supabase, __table } from './supabase-client.js';

export const store = {
    getActiveProject() {
        return __table.rows().find(r => r.active) || null;
    },

    getSettings() {
        return JSON.parse(localStorage.getItem('settings') || '{}');
    },

    async updateSettings(updates) {
        localStorage.setItem('settings', JSON.stringify({ ...this.getSettings(), ...updates }));
    },

    async deleteProject(id) {
        await supabase.rpc('delete_project', { p_project_id: id });
    },
};
