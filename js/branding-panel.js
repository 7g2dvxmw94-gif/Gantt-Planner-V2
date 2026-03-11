/* ========================================
   BRANDING PANEL
   Visual customization UI with export/import
   ======================================== */

import { branding as defaultConfig } from '../config/branding.js';
import { brandingManager } from './branding.js';

const STORAGE_KEY = 'gantt_branding';

/* Font URL mapping for the font selector */
const FONT_URLS = {
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif":
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    "'Poppins', sans-serif":
        'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
    "'Roboto', sans-serif":
        'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    "'Open Sans', sans-serif":
        'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap',
    "'Lato', sans-serif":
        'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap',
    "'Nunito', sans-serif":
        'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap',
    "'Montserrat', sans-serif":
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
    "system-ui, sans-serif": null,
};

class BrandingPanel {
    constructor() {
        this._overlay = null;
        this._isOpen = false;
    }

    init() {
        this._overlay = document.getElementById('brandingOverlay');
        if (!this._overlay) return;

        this._panel = document.getElementById('brandingPanel');
        this._toggleBtn = document.getElementById('brandingToggle');
        this._closeBtn = document.getElementById('brandingClose');
        this._resetBtn = document.getElementById('brandingReset');
        this._exportBtn = document.getElementById('brandingExport');
        this._importBtn = document.getElementById('brandingImport');
        this._fileInput = document.getElementById('brandingFileInput');

        this._bindEvents();
        this._populateForm();
    }

    /* ---- Events ---- */

    _bindEvents() {
        // Open / Close
        this._toggleBtn?.addEventListener('click', () => this.toggle());
        this._closeBtn?.addEventListener('click', () => this.close());
        this._overlay?.addEventListener('click', (e) => {
            if (e.target === this._overlay || e.target === this._overlay.querySelector('::before')) {
                // Clicked on backdrop
                if (!this._panel.contains(e.target)) this.close();
            }
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen) this.close();
        });

        // Live editing: text inputs
        this._panel?.querySelectorAll('.bp-input').forEach(input => {
            input.addEventListener('input', () => this._onFieldChange(input));
        });

        // Live editing: select
        this._panel?.querySelectorAll('.bp-select').forEach(select => {
            select.addEventListener('change', () => this._onFieldChange(select));
        });

        // Live editing: color pickers
        this._panel?.querySelectorAll('.bp-color').forEach(picker => {
            picker.addEventListener('input', () => {
                const key = picker.dataset.key;
                // Sync hex text
                const hexInput = this._panel.querySelector(`.bp-color-hex[data-key="${key}"]`);
                if (hexInput) hexInput.value = picker.value;
                this._onColorChange(key, picker.value);
            });
        });

        // Live editing: hex text inputs
        this._panel?.querySelectorAll('.bp-color-hex').forEach(hexInput => {
            hexInput.addEventListener('input', () => {
                const key = hexInput.dataset.key;
                const val = hexInput.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    const picker = this._panel.querySelector(`.bp-color[data-key="${key}"]`);
                    if (picker) picker.value = val;
                    this._onColorChange(key, val);
                }
            });
        });

        // Actions
        this._resetBtn?.addEventListener('click', () => this._reset());
        this._exportBtn?.addEventListener('click', () => this._export());
        this._importBtn?.addEventListener('click', () => this._fileInput?.click());
        this._fileInput?.addEventListener('change', (e) => this._import(e));
    }

    /* ---- Open / Close ---- */

    toggle() {
        this._isOpen ? this.close() : this.open();
    }

    open() {
        if (!this._overlay) return;
        this._populateForm();
        this._overlay.hidden = false;
        this._isOpen = true;
        // Focus first input
        requestAnimationFrame(() => {
            const first = this._panel.querySelector('.bp-input');
            if (first) first.focus();
        });
    }

    close() {
        if (!this._overlay) return;
        this._overlay.hidden = true;
        this._isOpen = false;
        this._toggleBtn?.focus();
    }

    /* ---- Populate form from current config ---- */

    _populateForm() {
        const config = this._getCurrentConfig();

        // Text inputs
        this._panel?.querySelectorAll('.bp-input:not(.bp-select)').forEach(input => {
            const key = input.dataset.key;
            if (key && config[key] !== undefined) {
                input.value = config[key] || '';
            }
        });

        // Selects
        this._panel?.querySelectorAll('.bp-select').forEach(select => {
            const key = select.dataset.key;
            if (key && config[key]) {
                select.value = config[key];
            }
        });

        // Color pickers + hex inputs
        this._panel?.querySelectorAll('.bp-color').forEach(picker => {
            const key = picker.dataset.key;
            if (key && config[key]) {
                picker.value = config[key];
            }
        });
        this._panel?.querySelectorAll('.bp-color-hex').forEach(hexInput => {
            const key = hexInput.dataset.key;
            if (key && config[key]) {
                hexInput.value = config[key];
            }
        });
    }

    /* ---- Live update handlers ---- */

    _onFieldChange(element) {
        const key = element.dataset.key;
        if (!key) return;

        const config = this._getCurrentConfig();
        let value = element.value;

        // Treat empty strings as null for optional fields
        if (value === '' && ['logoImage', 'favicon', 'footerText', 'copyrightText'].includes(key)) {
            value = null;
        }

        config[key] = value;

        // Update fontUrl when font changes
        if (key === 'fontFamily') {
            config.fontUrl = FONT_URLS[value] || null;
        }

        this._save(config);
        brandingManager.applyConfig(config);
    }

    _onColorChange(key, value) {
        const config = this._getCurrentConfig();
        config[key] = value;
        // Sync theme-color meta with primary color
        if (key === 'primaryColor') {
            config.themeColorLight = value;
        }
        this._save(config);
        brandingManager.applyConfig(config);
    }

    /* ---- localStorage ---- */

    _getCurrentConfig() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return { ...defaultConfig };
    }

    _save(config) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch { /* ignore */ }
    }

    /* ---- Reset ---- */

    _reset() {
        if (!confirm('Réinitialiser toutes les personnalisations ?')) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        brandingManager.applyConfig(defaultConfig);
        this._populateForm();
        this._showToast('Personnalisation réinitialisée');
    }

    /* ---- Export JSON ---- */

    _export() {
        const config = this._getCurrentConfig();
        // Clean internal keys
        const exportData = {};
        for (const key of Object.keys(defaultConfig)) {
            exportData[key] = config[key] !== undefined ? config[key] : defaultConfig[key];
        }

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'branding.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this._showToast('Configuration export\u00e9e');
    }

    /* ---- Import JSON ---- */

    _import(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);

                // Validate: must be a plain object with at least appName
                if (typeof imported !== 'object' || !imported.appName) {
                    this._showToast('Fichier invalide : appName manquant', true);
                    return;
                }

                // Merge with defaults for any missing keys
                const merged = { ...defaultConfig, ...imported };
                this._save(merged);
                brandingManager.applyConfig(merged);
                this._populateForm();
                this._showToast('Configuration import\u00e9e avec succ\u00e8s');
            } catch {
                this._showToast('Erreur : fichier JSON invalide', true);
            }
        };
        reader.readAsText(file);
        // Reset file input so same file can be re-imported
        e.target.value = '';
    }

    /* ---- Toast helper ---- */

    _showToast(message, isError = false) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
        toast.textContent = message;
        toast.setAttribute('role', 'status');
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

export const brandingPanel = new BrandingPanel();
