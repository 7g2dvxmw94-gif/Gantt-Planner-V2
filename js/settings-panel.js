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
