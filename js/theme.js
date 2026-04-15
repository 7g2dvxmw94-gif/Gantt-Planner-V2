/* ========================================
   THEME MANAGER - Day/Night Mode
   Gantly
   ======================================== */

import { store } from './store.js';

class ThemeManager {
    constructor() {
        this._html = document.documentElement;
        this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this._toggleBtn = null;
        this._sunIcon = null;
        this._moonIcon = null;
    }

    init() {
        this._toggleBtn = document.getElementById('themeToggle');
        this._sunIcon = this._toggleBtn?.querySelector('.sun-icon');
        this._moonIcon = this._toggleBtn?.querySelector('.moon-icon');

        // Apply saved theme or system preference
        const settings = store.getSettings();
        if (settings.theme) {
            this._apply(settings.theme);
        } else {
            this._applySystemPreference();
        }

        // Listen for system preference changes
        this._mediaQuery.addEventListener('change', (e) => {
            const settings = store.getSettings();
            if (!settings.theme) {
                this._apply(e.matches ? 'dark' : 'light');
            }
        });

        // Toggle button
        if (this._toggleBtn) {
            this._toggleBtn.addEventListener('click', () => this.toggle());
        }

        // Keyboard shortcut: Ctrl+D / Cmd+D
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    _apply(theme) {
        this._html.setAttribute('data-theme', theme);
        this._updateIcons(theme);

        // Update aria-label
        if (this._toggleBtn) {
            const label = theme === 'dark'
                ? 'Passer en mode clair'
                : 'Passer en mode sombre';
            this._toggleBtn.setAttribute('aria-label', label);
            this._toggleBtn.setAttribute('title', label);
        }
    }

    _updateIcons(theme) {
        if (!this._sunIcon || !this._moonIcon) return;
        if (theme === 'dark') {
            this._sunIcon.style.display = 'none';
            this._moonIcon.style.display = 'block';
        } else {
            this._sunIcon.style.display = 'block';
            this._moonIcon.style.display = 'none';
        }
    }

    _applySystemPreference() {
        const isDark = this._mediaQuery.matches;
        this._apply(isDark ? 'dark' : 'light');
    }

    get current() {
        return this._html.getAttribute('data-theme') || 'light';
    }

    toggle() {
        const newTheme = this.current === 'light' ? 'dark' : 'light';
        this._apply(newTheme);
        store.updateSettings({ theme: newTheme });
    }

    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') return;
        this._apply(theme);
        store.updateSettings({ theme });
    }

    useSystemPreference() {
        store.updateSettings({ theme: null });
        this._applySystemPreference();
    }
}

export const themeManager = new ThemeManager();
