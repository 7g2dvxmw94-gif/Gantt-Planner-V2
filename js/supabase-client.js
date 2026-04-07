/* ========================================
   SUPABASE CLIENT — Singleton
   ======================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Identifiants du projet Supabase
const SUPABASE_URL     = 'https://hwvgurxiwmvwhvjwfwru.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dmd1cnhpd212d2h2andmd3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODc5NTQsImV4cCI6MjA5MTE2Mzk1NH0.iI7B5hxjnT-i-ialFICMxdvKN0DNWhWWXcO2AB6DUfc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Persiste la session dans localStorage automatiquement
        persistSession: true,
        autoRefreshToken: true,
        // URL de redirection après OAuth (Google/Apple)
        redirectTo: `${window.location.origin}/index.html`,
    },
});
