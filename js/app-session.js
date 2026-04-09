/* ========================================
   APP SESSION — Bootstrap patch
   - Wraps initFromSupabase in try/catch
   - Wires sign-out button
   - Displays user email
   This module loads AFTER app.js and overrides its DOMContentLoaded
   bootstrap by patching the session-sensitive parts.
   ======================================== */

import { auth } from './auth.js';
import { supabase } from './supabase-client.js';
import { store } from './store.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Display user name (or email as fallback)
    try {
        const user = await auth.getUser();
        const emailEl = document.getElementById('userEmail');
        if (emailEl && user) {
            const userName = store.getSettings().customization?.userName?.trim();
            emailEl.textContent = userName || user.email;
        }
    } catch (_) {}

    // Update display name when settings change
    store.on('settings:change', (settings) => {
        const emailEl = document.getElementById('userEmail');
        if (emailEl) {
            const userName = settings.customization?.userName?.trim();
            if (userName) emailEl.textContent = userName;
        }
    });

    // Wire sign-out button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            try {
                await supabase.auth.signOut();
            } finally {
                window.location.href = 'auth.html';
            }
        });
    }
});
