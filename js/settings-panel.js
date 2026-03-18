/* ========================================
   SETTINGS PANEL - Side Panel
   Gantt Planner Pro
   ======================================== */

import { store } from './store.js';
import { themeManager } from './theme.js';
import { ganttRenderer } from './gantt-renderer.js';

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
                <button class="settings-panel-back" id="settingsPanelClose" aria-label="Fermer les réglages">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <h2 class="settings-panel-title" id="settingsPanelTitle">Paramètres</h2>
                <div class="settings-panel-header-spacer"></div>
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
            { value: 'light', label: 'Clair', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>` },
            { value: 'dark', label: 'Sombre', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>` },
            { value: 'auto', label: 'Auto', icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>` },
        ];

        const zoomOptions = [
            { value: 'day', label: 'Jour' },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
            { value: 'quarter', label: 'Trimestre' },
        ];

        return `
            <div class="settings-group">
                <h3 class="settings-group-label">Thème</h3>
                <div class="settings-segmented-control">
                    ${themeOptions.map(opt => `
                        <button class="settings-segment${currentTheme === opt.value ? ' active' : ''}" data-theme="${opt.value}">
                            <span class="settings-segment-icon">${opt.icon}</span>
                            <span>${opt.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="settings-group">
                <h3 class="settings-group-label">Zoom par défaut</h3>
                <div class="settings-segmented-control">
                    ${zoomOptions.map(opt => `
                        <button class="settings-segment${currentZoom === opt.value ? ' active' : ''}" data-zoom="${opt.value}">
                            <span>${opt.label}</span>
                        </button>
                    `).join('')}
                </div>
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

        // Theme buttons (segmented control)
        this._panel.querySelectorAll('.settings-segment[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this._setTheme(theme);
                // Update active state
                this._panel.querySelectorAll('.settings-segment[data-theme]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Zoom buttons (segmented control)
        this._panel.querySelectorAll('.settings-segment[data-zoom]').forEach(btn => {
            btn.addEventListener('click', () => {
                const zoom = btn.dataset.zoom;
                this._setZoom(zoom);
                this._panel.querySelectorAll('.settings-segment[data-zoom]').forEach(b => b.classList.remove('active'));
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
        // Apply zoom to gantt renderer (this also updates store)
        ganttRenderer.setZoom(zoom);
        ganttRenderer.render();

        // Update toolbar zoom buttons
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === zoom);
        });
        // Update zoom label
        const labels = { day: 'Jour', week: 'Semaine', month: 'Mois', quarter: 'Trimestre' };
        const zoomLabel = document.querySelector('.zoom-label');
        if (zoomLabel) zoomLabel.textContent = labels[zoom] || '';
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

        // Update title
        const title = this._panel.querySelector('#settingsPanelTitle');
        if (title) {
            title.textContent = section === 'params' ? 'Paramètres' : 'Personnaliser';
        }
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

        // Theme buttons (segmented control)
        this._panel.querySelectorAll('.settings-segment[data-theme]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === currentTheme);
        });

        // Zoom buttons (segmented control)
        this._panel.querySelectorAll('.settings-segment[data-zoom]').forEach(btn => {
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
