/* ========================================
   SUPABASE CLIENT — Singleton
   ======================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️  Remplacer par les valeurs de votre projet Supabase
// Tableau de bord Supabase → Settings → API
const SUPABASE_URL     = window.__SUPABASE_URL__     || 'https://VOTRE_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'VOTRE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Persiste la session dans localStorage automatiquement
        persistSession: true,
        autoRefreshToken: true,
        // URL de redirection après OAuth (Google/Apple)
        redirectTo: `${window.location.origin}/index.html`,
    },
});
