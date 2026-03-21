/* ========================================
   SETTINGS PANEL - Side Panel
   Gantt Planner Pro
   ======================================== */

import { store } from './store.js';
import { CURRENCIES } from './utils.js';

class SettingsPanel {
    constructor() {
        this._panel = null;
        this._overlay = null;
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
        return `
            <div class="settings-panel-header">
                <button class="settings-panel-back" id="settingsPanelClose" aria-label="Fermer les réglages">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <h2 class="settings-panel-title" id="settingsPanelTitle">Personnaliser</h2>
                <div class="settings-panel-header-spacer"></div>
            </div>

            <div class="settings-panel-body">
                <div class="settings-section">
                    ${this._renderCustomizeSection()}
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
                        <label class="settings-field-label" for="settingsUserName">Utilisateur</label>
                        <input type="text" class="settings-field-input" id="settingsUserName" placeholder="Jean Dupont" value="${this._getCustomization('userName') || ''}">
                    </div>
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
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="6" x2="12" y2="18"/>
                        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/>
                        <circle cx="12" cy="16" r=".5"/>
                    </svg>
                    <h3>Devise</h3>
                </div>
                <div class="settings-identity-fields">
                    <div class="settings-field">
                        <label class="settings-field-label" for="settingsCurrency">Devise affichée</label>
                        <select class="settings-field-input" id="settingsCurrency">
                            ${Object.entries(CURRENCIES).map(([code, c]) =>
                                `<option value="${code}" ${(this._getCustomization('currency') || 'EUR') === code ? 'selected' : ''}>${c.symbol} – ${code}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <h3>Affichage</h3>
                </div>
                <div class="settings-identity-fields">
                    <div class="settings-field settings-field-toggle">
                        <label class="settings-field-label" for="settingsShowLinks">Afficher les liens (dépendances)</label>
                        <label class="settings-toggle">
                            <input type="checkbox" id="settingsShowLinks" ${this._getCustomization('showLinks') !== false ? 'checked' : ''}>
                            <span class="settings-toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l11.752 23.8z" fill="#ea4335"/>
                        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                        <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                    </svg>
                    <h3>Google Drive</h3>
                </div>
                <p class="settings-group-description">Sauvegardez et restaurez vos projets depuis Google Drive.</p>
                <button class="btn btn-primary" id="settingsGDriveBtn" style="width: 100%; margin-top: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                    </svg>
                    Gérer les sauvegardes Google Drive
                </button>
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

        // Identity fields (debounced save)
        const userNameInput = this._panel.querySelector('#settingsUserName');
        const nameInput = this._panel.querySelector('#settingsName');
        const logoInput = this._panel.querySelector('#settingsLogo');
        const faviconInput = this._panel.querySelector('#settingsFavicon');

        if (userNameInput) {
            userNameInput.addEventListener('input', this._debounce(() => {
                this._saveCustomization('userName', userNameInput.value);
                this._applyUserInitials(userNameInput.value);
            }, 500));
        }
        if (nameInput) {
            nameInput.addEventListener('input', this._debounce(() => {
                this._saveCustomization('brandName', nameInput.value);
                this._applyBrandName(nameInput.value);
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

        // Show links toggle
        const showLinksCheckbox = this._panel.querySelector('#settingsShowLinks');
        if (showLinksCheckbox) {
            showLinksCheckbox.addEventListener('change', () => {
                this._saveCustomization('showLinks', showLinksCheckbox.checked);
                document.dispatchEvent(new CustomEvent('links-visibility-changed'));
            });
        }

        // Google Drive button
        const gdriveBtn = this._panel.querySelector('#settingsGDriveBtn');
        if (gdriveBtn) {
            gdriveBtn.addEventListener('click', () => {
                this.close();
                document.dispatchEvent(new CustomEvent('open-cloud-backup'));
            });
        }

        // Currency selector
        const currencySelect = this._panel.querySelector('#settingsCurrency');
        if (currencySelect) {
            currencySelect.addEventListener('change', () => {
                this._saveCustomization('currency', currencySelect.value);
                // Dispatch event so views re-render with new currency
                document.dispatchEvent(new CustomEvent('currency-changed'));
            });
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

    _applyUserInitials(userName) {
        const avatar = document.querySelector('.header-actions .avatar');
        if (!avatar) return;
        if (userName && userName.trim()) {
            const initials = userName.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
            avatar.textContent = initials;
            avatar.setAttribute('aria-label', `Profil utilisateur - ${userName.trim()}`);
        } else {
            avatar.textContent = '?';
            avatar.setAttribute('aria-label', 'Profil utilisateur');
        }
    }

    _applyBrandName(name) {
        const logoText = document.querySelector('.logo > span');
        if (logoText) {
            logoText.textContent = name && name.trim() ? name.trim() : 'Gantt Planner';
        }
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
        // Identity fields
        const userNameInput = this._panel.querySelector('#settingsUserName');
        const nameInput = this._panel.querySelector('#settingsName');
        const logoInput = this._panel.querySelector('#settingsLogo');
        const faviconInput = this._panel.querySelector('#settingsFavicon');
        if (userNameInput) userNameInput.value = this._getCustomization('userName') || '';
        if (nameInput) nameInput.value = this._getCustomization('brandName') || '';
        if (logoInput) logoInput.value = this._getCustomization('logoUrl') || '';
        if (faviconInput) faviconInput.value = this._getCustomization('faviconUrl') || '';

        const currencySelect = this._panel.querySelector('#settingsCurrency');
        if (currencySelect) currencySelect.value = this._getCustomization('currency') || 'EUR';

        const showLinksCheckbox = this._panel.querySelector('#settingsShowLinks');
        if (showLinksCheckbox) showLinksCheckbox.checked = this._getCustomization('showLinks') !== false;
    }

    /* Apply stored customizations on init */
    applyStoredCustomizations() {
        const userName = this._getCustomization('userName');
        const brandName = this._getCustomization('brandName');
        if (userName) this._applyUserInitials(userName);
        if (brandName) this._applyBrandName(brandName);
    }
}

export const settingsPanel = new SettingsPanel();
