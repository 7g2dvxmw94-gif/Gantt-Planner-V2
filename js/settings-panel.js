/* ========================================
   SETTINGS PANEL - Side Panel
   Gantt Planner Pro
   ======================================== */

import { store } from './store.js';
import { CURRENCIES } from './utils.js';

const COLOR_PRESETS = [
    { id: 'indigo',  name: 'Indigo',   primary: '#6366F1', hover: '#4F46E5', light: '#EEF2FF', dark: '#4338CA' },
    { id: 'violet',  name: 'Violet',   primary: '#8B5CF6', hover: '#7C3AED', light: '#F5F3FF', dark: '#6D28D9' },
    { id: 'blue',    name: 'Bleu',     primary: '#3B82F6', hover: '#2563EB', light: '#EFF6FF', dark: '#1D4ED8' },
    { id: 'cyan',    name: 'Cyan',     primary: '#06B6D4', hover: '#0891B2', light: '#ECFEFF', dark: '#0E7490' },
    { id: 'emerald', name: 'Émeraude',primary: '#10B981', hover: '#059669', light: '#ECFDF5', dark: '#047857' },
    { id: 'orange',  name: 'Orange',   primary: '#F59E0B', hover: '#D97706', light: '#FFFBEB', dark: '#B45309' },
    { id: 'rose',    name: 'Rose',     primary: '#EC4899', hover: '#DB2777', light: '#FDF2F8', dark: '#BE185D' },
    { id: 'slate',   name: 'Ardoise',  primary: '#64748B', hover: '#475569', light: '#F8FAFC', dark: '#334155' },
];

const FONT_PRESETS = {
    'Inter':     { stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", url: null },
    'Roboto':    { stack: "'Roboto', sans-serif",    url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap' },
    'Open Sans': { stack: "'Open Sans', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap' },
    'Lato':      { stack: "'Lato', sans-serif",      url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap' },
    'Nunito':    { stack: "'Nunito', sans-serif",    url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap' },
};

const FONT_SIZES = {
    compact: { label: 'Compact', base: '13px' },
    normal:  { label: 'Normal',  base: '16px' },
    large:   { label: 'Large',   base: '18px' },
};

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
                    <svg width="18" height="18" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10.813 0H0v10.813h10.813z" fill="#f25022"/>
                        <path d="M22.957 0H12.144v10.813h10.813z" fill="#7fba00"/>
                        <path d="M10.813 12.187H0V23h10.813z" fill="#00a4ef"/>
                        <path d="M22.957 12.187H12.144V23h10.813z" fill="#ffb900"/>
                    </svg>
                    <h3>OneDrive</h3>
                </div>
                <p class="settings-group-description">Sauvegardez et restaurez vos projets depuis Microsoft OneDrive.</p>
                <button class="btn btn-primary" id="settingsOneDriveBtn" style="width: 100%; margin-top: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                    </svg>
                    Gérer les sauvegardes OneDrive
                </button>
            </div>

            ${this._renderCouleursGroup()}
            ${this._renderTypographieGroup()}
        `;
    }

    _renderCouleursGroup() {
        const savedColor = this._getCustomization('accentColor') || '#6366F1';
        return `
            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                    </svg>
                    <h3>Couleurs</h3>
                </div>
                <p class="settings-group-description">Personnalisez la couleur d'accentuation aux couleurs de votre société.</p>
                <div class="color-presets">
                    ${COLOR_PRESETS.map(p => `
                        <button class="color-swatch${savedColor === p.primary ? ' active' : ''}"
                                data-primary="${p.primary}"
                                data-hover="${p.hover}"
                                data-light="${p.light}"
                                data-dark="${p.dark}"
                                title="${p.name}"
                                style="background:${p.primary}">
                        </button>
                    `).join('')}
                </div>
                <div class="custom-color-field">
                    <label class="settings-field-label">Couleur personnalisée</label>
                    <div class="custom-color-wrap">
                        <input type="color" id="settingsAccentColor" value="${savedColor}">
                        <span class="custom-color-hex" id="settingsAccentColorHex">${savedColor}</span>
                    </div>
                </div>
            </div>
        `;
    }

    _renderTypographieGroup() {
        const savedFont = this._getCustomization('fontFamily') || 'Inter';
        const savedSize = this._getCustomization('fontSize') || 'normal';
        return `
            <div class="settings-group">
                <div class="settings-group-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="4 7 4 4 20 4 20 7"/>
                        <line x1="9" y1="20" x2="15" y2="20"/>
                        <line x1="12" y1="4" x2="12" y2="20"/>
                    </svg>
                    <h3>Typographie</h3>
                </div>
                <div class="settings-identity-fields">
                    <div class="settings-field">
                        <label class="settings-field-label" for="settingsFontFamily">Police</label>
                        <select class="settings-field-input" id="settingsFontFamily">
                            ${Object.keys(FONT_PRESETS).map(name => `
                                <option value="${name}" ${savedFont === name ? 'selected' : ''}>${name}${name === 'Inter' ? ' (défaut)' : ''}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="settings-field">
                        <label class="settings-field-label">Taille de texte</label>
                        <div class="font-size-toggle">
                            ${Object.entries(FONT_SIZES).map(([key, { label }]) => `
                                <button class="font-size-btn${savedSize === key ? ' active' : ''}" data-size="${key}">${label}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /* ---- Helpers ---- */

    _getCustomization(key) {
        const settings = store.getSettings();
        const value = settings.customization?.[key];
        return value !== undefined ? value : '';
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

        // OneDrive button
        const onedriveBtn = this._panel.querySelector('#settingsOneDriveBtn');
        if (onedriveBtn) {
            onedriveBtn.addEventListener('click', () => {
                this.close();
                document.dispatchEvent(new CustomEvent('open-onedrive-backup'));
            });
        }

        // Currency selector
        const currencySelect = this._panel.querySelector('#settingsCurrency');
        if (currencySelect) {
            currencySelect.addEventListener('change', () => {
                this._saveCustomization('currency', currencySelect.value);
                document.dispatchEvent(new CustomEvent('currency-changed'));
            });
        }

        // Color swatches
        this._panel.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const { primary, hover, light, dark } = swatch.dataset;
                this._applyAccentColor(primary, hover, light, dark);
                this._saveCustomization('accentColor', primary);
                this._saveCustomization('accentColorHover', hover);
                this._saveCustomization('accentColorLight', light);
                this._saveCustomization('accentColorDark', dark);
                this._panel.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                const picker = this._panel.querySelector('#settingsAccentColor');
                if (picker) picker.value = primary;
                const hexLabel = this._panel.querySelector('#settingsAccentColorHex');
                if (hexLabel) hexLabel.textContent = primary;
            });
        });

        // Custom color picker
        const colorPicker = this._panel.querySelector('#settingsAccentColor');
        if (colorPicker) {
            colorPicker.addEventListener('input', this._debounce(() => {
                const hex = colorPicker.value;
                const palette = this._computeColorPalette(hex);
                this._applyAccentColor(palette.primary, palette.hover, palette.light, palette.dark);
                this._saveCustomization('accentColor', palette.primary);
                this._saveCustomization('accentColorHover', palette.hover);
                this._saveCustomization('accentColorLight', palette.light);
                this._saveCustomization('accentColorDark', palette.dark);
                this._panel.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                const hexLabel = this._panel.querySelector('#settingsAccentColorHex');
                if (hexLabel) hexLabel.textContent = hex;
            }, 80));
        }

        // Font family
        const fontSelect = this._panel.querySelector('#settingsFontFamily');
        if (fontSelect) {
            fontSelect.addEventListener('change', () => {
                this._applyFontFamily(fontSelect.value);
                this._saveCustomization('fontFamily', fontSelect.value);
            });
        }

        // Font size buttons
        this._panel.querySelectorAll('.font-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                this._applyFontSize(size);
                this._saveCustomization('fontSize', size);
                this._panel.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
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

    _applyAccentColor(primary, hover, light, dark) {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', primary);
        root.style.setProperty('--color-primary-hover', hover);
        root.style.setProperty('--color-primary-light', light);
        root.style.setProperty('--color-primary-dark', dark);
        const r = parseInt(primary.slice(1, 3), 16);
        const g = parseInt(primary.slice(3, 5), 16);
        const b = parseInt(primary.slice(5, 7), 16);
        root.style.setProperty('--shadow-focus', `0 0 0 3px rgba(${r}, ${g}, ${b}, 0.3)`);
    }

    _computeColorPalette(hex) {
        const [h, s, l] = this._hexToHsl(hex);
        return {
            primary: hex,
            hover: this._hslToHex(h, Math.min(s + 5, 100), Math.max(l - 12, 10)),
            light: this._hslToHex(h, Math.max(s - 20, 10), Math.min(l + 38, 96)),
            dark:  this._hslToHex(h, Math.min(s + 5, 100), Math.max(l - 22, 5)),
        };
    }

    _hexToHsl(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }

    _hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * c).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    _applyFontFamily(fontName) {
        const preset = FONT_PRESETS[fontName];
        if (!preset) return;
        if (preset.url && !document.querySelector(`link[data-font="${fontName}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = preset.url;
            link.setAttribute('data-font', fontName);
            document.head.appendChild(link);
        }
        document.documentElement.style.setProperty('--font-sans', preset.stack);
    }

    _applyFontSize(size) {
        const preset = FONT_SIZES[size];
        if (!preset) return;
        document.documentElement.style.setProperty('--font-size-base', preset.base);
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

        // Color: sync swatch active state and picker value
        const savedColor = this._getCustomization('accentColor');
        if (savedColor) {
            this._panel.querySelectorAll('.color-swatch').forEach(s =>
                s.classList.toggle('active', s.dataset.primary === savedColor)
            );
            const picker = this._panel.querySelector('#settingsAccentColor');
            if (picker) picker.value = savedColor;
            const hexLabel = this._panel.querySelector('#settingsAccentColorHex');
            if (hexLabel) hexLabel.textContent = savedColor;
        }

        // Font family
        const savedFont = this._getCustomization('fontFamily');
        const fontSelect = this._panel.querySelector('#settingsFontFamily');
        if (fontSelect && savedFont) fontSelect.value = savedFont;

        // Font size
        const savedSize = this._getCustomization('fontSize') || 'normal';
        this._panel.querySelectorAll('.font-size-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.size === savedSize)
        );
    }

    /* Apply stored customizations on init */
    applyStoredCustomizations() {
        const userName = this._getCustomization('userName');
        const brandName = this._getCustomization('brandName');
        if (userName) this._applyUserInitials(userName);
        if (brandName) this._applyBrandName(brandName);

        // Accent color
        const accentColor = this._getCustomization('accentColor');
        if (accentColor) {
            const hover = this._getCustomization('accentColorHover');
            const light = this._getCustomization('accentColorLight');
            const dark  = this._getCustomization('accentColorDark');
            if (hover && light && dark) {
                this._applyAccentColor(accentColor, hover, light, dark);
            } else {
                const palette = this._computeColorPalette(accentColor);
                this._applyAccentColor(palette.primary, palette.hover, palette.light, palette.dark);
            }
        }

        // Font family
        const fontFamily = this._getCustomization('fontFamily');
        if (fontFamily) this._applyFontFamily(fontFamily);

        // Font size
        const fontSize = this._getCustomization('fontSize');
        if (fontSize) this._applyFontSize(fontSize);
    }
}

export const settingsPanel = new SettingsPanel();
