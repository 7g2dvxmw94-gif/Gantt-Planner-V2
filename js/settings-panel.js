/* ========================================
   SETTINGS PANEL - Side Panel
   Gantt Planner Pro
   ======================================== */

import { store } from './store.js';
import { themeManager } from './theme.js';

class SettingsPanel {
    constructor() {
        this._panel = null;
        this._overlay = null;
        this._activeSection = 'params';
        this._isOpen = false;
    }

    init() {
        this._buildPanel();
        this._bindToggle();
        this._bindKeyboard();
    }

    /* ---- Build DOM ---- */

    _buildPanel() {
        // Overlay
        this._overlay = document.createElement('div');
        this._overlay.className = 'settings-overlay';
        this._overlay.addEventListener('click', () => this.close());

        // Panel
        this._panel = document.createElement('aside');
        this._panel.className = 'settings-panel';
        this._panel.setAttribute('role', 'dialog');
        this._panel.setAttribute('aria-label', 'Panneau de réglages');
        this._panel.innerHTML = this._renderPanel();

        document.body.appendChild(this._overlay);
        document.body.appendChild(this._panel);

        // Bind internal events
        this._bindInternalEvents();
    }

    _renderPanel() {
        const settings = store.getSettings();
        const currentTheme = settings.theme || 'auto';
        const currentZoom = settings.zoomLevel || 'week';

        return `
            <div class="settings-panel-header">
                <h2 class="settings-panel-title">Réglages</h2>
                <button class="settings-panel-close" id="settingsPanelClose" aria-label="Fermer les réglages">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div class="settings-panel-tabs" role="tablist">
                <button class="settings-tab active" data-section="params" role="tab" aria-selected="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    <span>Paramètres</span>
                </button>
                <button class="settings-tab" data-section="customize" role="tab" aria-selected="false">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    <span>Personnaliser</span>
                </button>
            </div>

            <div class="settings-panel-body">
                <!-- Paramètres Section -->
                <div class="settings-section" id="settingsParams" data-section="params">
                    ${this._renderParamsSection(currentTheme, currentZoom)}
                </div>

                <!-- Personnaliser Section -->
                <div class="settings-section" id="settingsCustomize" data-section="customize" style="display:none;">
                    ${this._renderCustomizeSection()}
                </div>
            </div>
        `;
    }

    _renderParamsSection(currentTheme, currentZoom) {
        const themeOptions = [
            { value: 'light', label: 'Clair', icon: '☀️' },
            { value: 'dark', label: 'Sombre', icon: '🌙' },
            { value: 'auto', label: 'Auto (système)', icon: '💻' },
        ];

        const zoomOptions = [
            { value: 'day', label: 'Jour' },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
            { value: 'quarter', label: 'Trimestre' },
        ];

        return `
            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                    <h3>Thème</h3>
                </div>
                <div class="settings-theme-options">
                    ${themeOptions.map(opt => `
                        <button class="settings-theme-btn${currentTheme === opt.value ? ' active' : ''}" data-theme="${opt.value}">
                            <span class="settings-theme-icon">${opt.icon}</span>
                            <span class="settings-theme-label">${opt.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        <line x1="11" y1="8" x2="11" y2="14"/>
                        <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                    <h3>Zoom par défaut</h3>
                </div>
                <div class="settings-zoom-options">
                    ${zoomOptions.map(opt => `
                        <button class="settings-zoom-btn${currentZoom === opt.value ? ' active' : ''}" data-zoom="${opt.value}">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="settings-group settings-group-placeholder">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3>Plus de paramètres</h3>
                </div>
                <p class="settings-coming-soon">D'autres paramètres seront disponibles prochainement.</p>
            </div>
        `;
    }

    _renderCustomizeSection() {
        return `
            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <h3>Identité</h3>
                </div>
                <div class="settings-identity-fields">
                    <div class="settings-field">
                        <label class="settings-field-label" for="settingsName">Nom du projet / entreprise</label>
                        <input type="text" class="settings-field-input" id="settingsName" placeholder="Mon entreprise" value="${this._getCustomization('brandName') || ''}">
                    </div>
                    <div class="settings-field">
                        <label class="settings-field-label" for="settingsLogo">Logo (URL)</label>
                        <input type="url" class="settings-field-input" id="settingsLogo" placeholder="https://example.com/logo.png" value="${this._getCustomization('logoUrl') || ''}">
                    </div>
                    <div class="settings-field">
                        <label class="settings-field-label" for="settingsFavicon">Favicon (URL)</label>
                        <input type="url" class="settings-field-input" id="settingsFavicon" placeholder="https://example.com/favicon.ico" value="${this._getCustomization('faviconUrl') || ''}">
                    </div>
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                    </svg>
                    <h3>Couleurs</h3>
                </div>
                <p class="settings-coming-soon">La personnalisation des couleurs sera disponible prochainement.</p>
            </div>

            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="4 7 4 4 20 4 20 7"/>
                        <line x1="9" y1="20" x2="15" y2="20"/>
                        <line x1="12" y1="4" x2="12" y2="20"/>
                    </svg>
                    <h3>Typographie</h3>
                </div>
                <p class="settings-coming-soon">La personnalisation de la typographie sera disponible prochainement.</p>
            </div>
        `;
    }

    /* ---- Helpers ---- */

    _getCustomization(key) {
        const settings = store.getSettings();
        return settings.customization?.[key] || '';
    }

    _saveCustomization(key, value) {
        const settings = store.getSettings();
        const customization = { ...(settings.customization || {}), [key]: value };
        store.updateSettings({ customization });
    }

    /* ---- Events ---- */

    _bindToggle() {
        const btn = document.getElementById('settingsBtn');
        if (btn) {
            btn.addEventListener('click', () => this.toggle());
        }
    }

    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen) {
                this.close();
            }
        });
    }

    _bindInternalEvents() {
        // Close button
        this._panel.querySelector('#settingsPanelClose')
            .addEventListener('click', () => this.close());

        // Tab switching
        this._panel.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const section = tab.dataset.section;
                this._switchSection(section);
            });
        });

        // Theme buttons
        this._panel.querySelectorAll('.settings-theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this._setTheme(theme);
                // Update active state
                this._panel.querySelectorAll('.settings-theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Zoom buttons
        this._panel.querySelectorAll('.settings-zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const zoom = btn.dataset.zoom;
                this._setZoom(zoom);
                this._panel.querySelectorAll('.settings-zoom-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Identity fields (debounced save)
        const nameInput = this._panel.querySelector('#settingsName');
        const logoInput = this._panel.querySelector('#settingsLogo');
        const faviconInput = this._panel.querySelector('#settingsFavicon');

        if (nameInput) {
            nameInput.addEventListener('input', this._debounce(() => {
                this._saveCustomization('brandName', nameInput.value);
            }, 500));
        }
        if (logoInput) {
            logoInput.addEventListener('input', this._debounce(() => {
                this._saveCustomization('logoUrl', logoInput.value);
            }, 500));
        }
        if (faviconInput) {
            faviconInput.addEventListener('input', this._debounce(() => {
                this._saveCustomization('faviconUrl', faviconInput.value);
                this._applyFavicon(faviconInput.value);
            }, 500));
        }
    }

    _debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    /* ---- Actions ---- */

    _setTheme(theme) {
        if (theme === 'auto') {
            themeManager.useSystemPreference();
        } else {
            themeManager.setTheme(theme);
        }
    }

    _setZoom(zoom) {
        store.updateSettings({ zoomLevel: zoom });
        // Update toolbar zoom buttons
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === zoom);
        });
        // Update zoom label
        const labels = { day: 'Jour', week: 'Semaine', month: 'Mois', quarter: 'Trimestre' };
        const zoomLabel = document.querySelector('.zoom-label');
        if (zoomLabel) zoomLabel.textContent = labels[zoom] || '';
        // Trigger re-render via store event
        store._emit('zoom:change', zoom);
    }

    _applyFavicon(url) {
        if (!url) return;
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = url;
    }

    _switchSection(section) {
        this._activeSection = section;

        // Update tabs
        this._panel.querySelectorAll('.settings-tab').forEach(tab => {
            const isActive = tab.dataset.section === section;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });

        // Show/hide sections
        this._panel.querySelectorAll('.settings-section').forEach(sec => {
            sec.style.display = sec.dataset.section === section ? '' : 'none';
        });
    }

    /* ---- Open / Close ---- */

    open() {
        this._isOpen = true;
        this._overlay.classList.add('active');
        this._panel.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Refresh values from store
        this._refreshValues();

        // Focus trap: focus the close button
        const closeBtn = this._panel.querySelector('#settingsPanelClose');
        if (closeBtn) setTimeout(() => closeBtn.focus(), 100);
    }

    close() {
        this._isOpen = false;
        this._overlay.classList.remove('active');
        this._panel.classList.remove('open');
        document.body.style.overflow = '';

        // Return focus to settings button
        const btn = document.getElementById('settingsBtn');
        if (btn) btn.focus();
    }

    toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    _refreshValues() {
        const settings = store.getSettings();
        const currentTheme = settings.theme || 'auto';
        const currentZoom = settings.zoomLevel || 'week';

        // Theme buttons
        this._panel.querySelectorAll('.settings-theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === currentTheme);
        });

        // Zoom buttons
        this._panel.querySelectorAll('.settings-zoom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === currentZoom);
        });

        // Identity fields
        const nameInput = this._panel.querySelector('#settingsName');
        const logoInput = this._panel.querySelector('#settingsLogo');
        const faviconInput = this._panel.querySelector('#settingsFavicon');
        if (nameInput) nameInput.value = this._getCustomization('brandName') || '';
        if (logoInput) logoInput.value = this._getCustomization('logoUrl') || '';
        if (faviconInput) faviconInput.value = this._getCustomization('faviconUrl') || '';
    }
}

export const settingsPanel = new SettingsPanel();
