/* ========================================
   SETTINGS PANEL - Side Panel
   Gantly
   ======================================== */

import { store, PLAN_PRICES } from './store.js';
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
        this._activeTab = 'profil';
        this._snapshot = null;
    }

    init() {
        this._buildPanel();
        this._bindToggle();
        this._bindKeyboard();
    }

    /* ---- Build DOM ---- */

    _buildPanel() {
        this._overlay = document.createElement('div');
        this._overlay.className = 'settings-overlay';
        this._overlay.addEventListener('click', () => this._cancel());

        this._panel = document.createElement('aside');
        this._panel.className = 'settings-panel';
        this._panel.setAttribute('role', 'dialog');
        this._panel.setAttribute('aria-label', t('settings.ariaLabel'));
        this._panel.innerHTML = this._renderPanel();

        document.body.appendChild(this._overlay);
        document.body.appendChild(this._panel);

        this._bindInternalEvents();
        this._bindTabEvents('profil');
        this._bindFooterEvents();
    }

    _renderPanel() {
        return `
            <div class="settings-panel-header">
                <button class="settings-panel-back" id="settingsPanelClose" aria-label="${t('settings.btnClose')}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </button>
                <h2 class="settings-panel-title">${t('settings.title')}</h2>
                <div class="settings-panel-header-spacer"></div>
            </div>

            <div class="settings-panel-tabs">
                <button class="settings-tab active" data-tab="profil" aria-label="${t('settings.tab.profile')}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${t('settings.tab.profile')}
                </button>
                <button class="settings-tab" data-tab="apparence" aria-label="${t('settings.tab.appearance')}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                    ${t('settings.tab.appearance')}
                </button>
                <button class="settings-tab" data-tab="general" aria-label="${t('settings.tab.general')}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                    ${t('settings.tab.general')}
                </button>
                <button class="settings-tab" data-tab="synchro" aria-label="${t('settings.tab.sync')}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                    ${t('settings.tab.sync')}
                </button>
                <button class="settings-tab" data-tab="aide" aria-label="${t('settings.tab.help')}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/></svg>
                    ${t('settings.tab.help')}
                </button>
                <button class="settings-tab" data-tab="abonnement" aria-label="${t('settings.tab.billing')}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    ${t('settings.tab.billing')}
                </button>
            </div>

            <div class="settings-panel-body">
                <div id="settingsTabContent">
                    ${this._renderTabContent('profil')}
                </div>
            </div>

            <div class="settings-panel-footer">
                <button class="btn btn-ghost" id="settingsCancelBtn">${t('settings.btnCancel')}</button>
                <button class="btn btn-primary" id="settingsSaveBtn">${t('settings.btnSave')}</button>
            </div>
        `;
    }

    /* ---- Tab rendering ---- */

    _renderTabContent(tabName) {
        switch (tabName) {
            case 'profil':    return this._renderProfilTab();
            case 'apparence': return this._renderApparenceTab();
            case 'general':   return this._renderGeneralTab();
            case 'synchro':      return this._renderSynchroTab();
            case 'aide':         return this._renderAideTab();
            case 'abonnement':   return this._renderAbonnementTab();
            default:             return '';
        }
    }

    _renderProfilTab() {
        const userName      = this._getCustomization('userName')    || '';
        const brandName     = this._getCustomization('brandName')   || '';
        const logoData      = this._getCustomization('logoData')    || '';
        const faviconData   = this._getCustomization('faviconData') || '';
        const avatarPhoto   = this._getCustomization('avatarPhoto') || '';
        const savedInitials = this._getCustomization('initials')    || '';
        const autoInitials  = userName.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';
        const initials      = savedInitials || autoInitials;

        return `
            <div class="settings-section">
                <div class="settings-group" style="border-top:none;padding-top:0;">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <h3>${t('settings.identity')}</h3>
                    </div>

                    <!-- Avatar upload -->
                    <div class="avatar-upload-wrap">
                        <div class="avatar-upload-preview" id="settingsAvatarPreview"
                             style="${avatarPhoto ? `background-image:url(${avatarPhoto});background-size:cover;background-position:center;` : ''}">
                            ${avatarPhoto ? '' : `<span>${initials}</span>`}
                        </div>
                        <div class="avatar-upload-info">
                            <p class="avatar-upload-hint">${t('settings.avatar.hint')}</p>
                            <div class="avatar-upload-actions">
                                <button class="btn btn-secondary" id="settingsAvatarUploadBtn">${t('settings.avatar.upload')}</button>
                                ${avatarPhoto ? `<button class="btn btn-ghost" id="settingsAvatarRemoveBtn">${t('settings.avatar.remove')}</button>` : ''}
                            </div>
                        </div>
                        <input type="file" id="settingsAvatarInput" accept="image/*" style="display:none">
                    </div>

                    <div class="settings-identity-fields">
                        <div class="settings-field">
                            <label class="settings-field-label" for="settingsUserName">${t('settings.name.label')}</label>
                            <input type="text" class="settings-field-input" id="settingsUserName" placeholder="${t('settings.name.placeholder')}" value="${userName}">
                        </div>
                        <div class="settings-field">
                            <label class="settings-field-label" for="settingsInitials">${t('settings.initials.label')} <span style="font-weight:400;color:var(--text-muted)">${t('settings.initials.hint')}</span></label>
                            <input type="text" class="settings-field-input" id="settingsInitials" placeholder="${autoInitials || 'JD'}" value="${savedInitials}" maxlength="2" style="text-transform:uppercase;width:80px;">
                        </div>
                        <div class="settings-field">
                            <label class="settings-field-label" for="settingsName">${t('settings.company.label')}</label>
                            <input type="text" class="settings-field-input" id="settingsName" placeholder="${t('settings.company.placeholder')}" value="${brandName}">
                        </div>
                    </div>
                </div>

                <!-- Logo -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <h3>${t('settings.logo')}</h3>
                    </div>
                    <div class="asset-upload-wrap">
                        <div class="asset-upload-preview" id="settingsLogoPreview">
                            ${logoData
                                ? `<img src="${logoData}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;">`
                                : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`}
                        </div>
                        <div class="avatar-upload-info">
                            <p class="avatar-upload-hint">${t('settings.logo.hint')}</p>
                            <div class="avatar-upload-actions">
                                <button class="btn btn-secondary" id="settingsLogoUploadBtn">${t('settings.logo.upload')}</button>
                                ${logoData ? `<button class="btn btn-ghost" id="settingsLogoRemoveBtn">${t('settings.avatar.remove')}</button>` : ''}
                            </div>
                        </div>
                        <input type="file" id="settingsLogoInput" accept="image/*" style="display:none">
                    </div>
                </div>

                <!-- Favicon -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        <h3>${t('settings.favicon')}</h3>
                        <span class="settings-tooltip-wrap">
                            <svg class="settings-tooltip-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor" stroke="none"/></svg>
                            <span class="settings-tooltip">${t('settings.favicon.description')}</span>
                        </span>
                    </div>
                    <div class="asset-upload-wrap">
                        <div class="asset-upload-preview asset-upload-preview--sm" id="settingsFaviconPreview">
                            ${faviconData
                                ? `<img src="${faviconData}" alt="Favicon" style="max-width:100%;max-height:100%;object-fit:contain;">`
                                : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>`}
                        </div>
                        <div class="avatar-upload-info">
                            <p class="avatar-upload-hint">${t('settings.favicon.hint')}</p>
                            <div class="avatar-upload-actions">
                                <button class="btn btn-secondary" id="settingsFaviconUploadBtn">${t('settings.favicon.upload')}</button>
                                ${faviconData ? `<button class="btn btn-ghost" id="settingsFaviconRemoveBtn">${t('settings.avatar.remove')}</button>` : ''}
                            </div>
                        </div>
                        <input type="file" id="settingsFaviconInput" accept="image/*,.ico" style="display:none">
                    </div>
                </div>
            </div>
        `;
    }

    _renderApparenceTab() {
        const savedColor = this._getCustomization('accentColor') || '#6366F1';
        const savedFont  = this._getCustomization('fontFamily')  || 'Inter';
        const savedSize  = this._getCustomization('fontSize')    || 'normal';

        return `
            <div class="settings-section">
                <div class="settings-group" style="border-top:none;padding-top:0;">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                        <h3>${t('settings.colors')}</h3>
                    </div>
                    <p class="settings-group-description">${t('settings.colors.description')}</p>
                    <div class="color-presets">
                        ${COLOR_PRESETS.map(p => `
                            <button class="color-swatch${savedColor === p.primary ? ' active' : ''}"
                                    data-primary="${p.primary}" data-hover="${p.hover}"
                                    data-light="${p.light}" data-dark="${p.dark}"
                                    title="${p.name}" style="background:${p.primary}">
                            </button>
                        `).join('')}
                    </div>
                    <div class="custom-color-field">
                        <label class="settings-field-label">${t('settings.color.custom')}</label>
                        <div class="custom-color-wrap">
                            <input type="color" id="settingsAccentColor" value="${savedColor}">
                            <span class="custom-color-hex" id="settingsAccentColorHex">${savedColor}</span>
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                        <h3>${t('settings.typography')}</h3>
                    </div>
                    <div class="settings-identity-fields">
                        <div class="settings-field">
                            <label class="settings-field-label" for="settingsFontFamily">${t('settings.font.label')}</label>
                            <select class="settings-field-input" id="settingsFontFamily">
                                ${Object.keys(FONT_PRESETS).map(name => `
                                    <option value="${name}" ${savedFont === name ? 'selected' : ''}>${name}${name === 'Inter' ? ` ${t('settings.font.default')}` : ''}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="settings-field">
                            <label class="settings-field-label">${t('settings.fontSize.label')}</label>
                            <div class="font-size-toggle">
                                ${Object.entries(FONT_SIZES).map(([key, { label }]) => `
                                    <button class="font-size-btn${savedSize === key ? ' active' : ''}" data-size="${key}">${label}</button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderGeneralTab() {
        const currency  = this._getCustomization('currency')  || 'EUR';
        const showLinks = this._getCustomization('showLinks') !== false;
        const currentLang = getCurrentLang();
        const excludeWeekends = store.getActiveProject()?.excludeWeekends !== false;

        return `
            <div class="settings-section">

                <!-- Language -->
                <div class="settings-group" style="border-top:none;padding-top:0;">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        <h3>${t('settings.lang.title')}</h3>
                    </div>
                    <div class="lang-selector">
                        ${Object.entries(I18N_LANGUAGES).map(([code, lang]) => `
                            <button class="lang-btn${currentLang === code ? ' active' : ''}${lang.comingSoon ? ' disabled' : ''}"
                                    data-lang="${code}"
                                    ${lang.comingSoon ? 'disabled' : ''}
                                    title="${lang.nativeName}${lang.comingSoon ? ` (${t('settings.lang.comingSoon')})` : ''}">
                                <span class="lang-btn-name">${lang.nativeName}</span>
                                ${lang.comingSoon ? `<span class="lang-coming-soon">${t('settings.lang.comingSoon')}</span>` : ''}
                                ${currentLang === code ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Currency -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="16" r=".5"/></svg>
                        <h3>${t('settings.currency.title')}</h3>
                    </div>
                    <div class="settings-identity-fields">
                        <div class="settings-field">
                            <label class="settings-field-label" for="settingsCurrency">${t('settings.currency.label')}</label>
                            <select class="settings-field-input" id="settingsCurrency">
                                ${Object.entries(CURRENCIES).map(([code, c]) =>
                                    `<option value="${code}" ${currency === code ? 'selected' : ''}>${c.symbol} – ${code}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Display -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <h3>${t('settings.display.title')}</h3>
                    </div>
                    <div class="settings-identity-fields">
                        <div class="settings-field settings-field-toggle">
                            <label class="settings-field-label" for="settingsShowLinks">${t('settings.display.showLinks')}</label>
                            <label class="settings-toggle">
                                <input type="checkbox" id="settingsShowLinks" ${showLinks ? 'checked' : ''}>
                                <span class="settings-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Resources -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        <h3>${t('settings.resources.title')}</h3>
                    </div>
                    <div class="settings-identity-fields">
                        <div class="settings-field settings-field-toggle">
                            <span class="settings-field-label" style="display:flex;align-items:center;gap:6px;">
                                ${t('settings.costs.excludeWeekends')}
                                <span title="${t('settings.costs.excludeWeekends.tooltip')}" style="display:inline-flex;cursor:help;color:var(--text-muted,#94a3b8);">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                </span>
                            </span>
                            <label class="settings-toggle">
                                <input type="checkbox" id="settingsExcludeWeekends" ${excludeWeekends ? 'checked' : ''}>
                                <span class="settings-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderSynchroTab() {
        return `
            <div class="settings-section">
                <div class="settings-group" style="border-top:none;padding-top:0;">
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
                    <p class="settings-group-description">${t('settings.sync.gdrive.desc')}</p>
                    <button class="btn btn-primary" id="settingsGDriveBtn" style="width:100%;margin-top:8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                        ${t('settings.sync.gdrive.btn')}
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
                    <p class="settings-group-description">${t('settings.sync.onedrive.desc')}</p>
                    <button class="btn btn-primary" id="settingsOneDriveBtn" style="width:100%;margin-top:8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                        ${t('settings.sync.onedrive.btn')}
                    </button>
                </div>
            </div>
        `;
    }

    _renderAbonnementTab() {
        const info        = store.getPlanInfo();
        const effective   = store.getEffectivePlan();
        const daysLeft    = store.getTrialDaysLeft();
        const isTrialing  = store.isTrialing();

        const statusKey   = `billing.status.${info.planStatus}`;
        const statusLabel = t(statusKey);
        const planLabel   = t('plan.' + effective);

        const statusColor = {
            active:   '#10B981',
            trialing: '#6366F1',
            canceled: '#EF4444',
            past_due: '#F59E0B',
        }[info.planStatus] || '#64748b';

        const trialDate = info.trialEndsAt
            ? new Date(info.trialEndsAt).toLocaleDateString()
            : null;

        const isPaidPlan = info.plan !== 'free' && info.planStatus === 'active';

        return `
        <div class="settings-section">
            <div class="settings-group" style="border-top:none;padding-top:0;">
                <!-- Current plan badge -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <div>
                        <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;color:var(--text-muted,#94a3b8);letter-spacing:.05em;margin-bottom:4px;">${t('billing.currentPlan')}</div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:1.4rem;font-weight:800;color:var(--text-primary,#1e293b);">${planLabel}</span>
                            <span style="background:${statusColor};color:#fff;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;">${statusLabel}</span>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-secondary,#64748b);margin-top:4px;">${t('billing.features.' + effective)}</div>
                    </div>
                    <div style="text-align:right;">
                        ${effective !== 'free' ? `<div style="font-size:1.5rem;font-weight:800;color:#6366F1;">${PLAN_PRICES[effective]?.monthly ?? 0} €<span style="font-size:0.8rem;font-weight:500;color:var(--text-secondary,#64748b);">/mois</span></div>` : '<div style="font-size:1.5rem;font-weight:800;color:#10B981;">0 €</div>'}
                    </div>
                </div>

                <!-- Trial or renewal info -->
                ${isTrialing ? `
                <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <div>
                        <div style="font-size:0.85rem;font-weight:600;color:#4338ca;">${t('billing.status.trialing')} — <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> restant${daysLeft > 1 ? 's' : ''}</div>
                        ${trialDate ? `<div style="font-size:0.75rem;color:#6366F1;">${t('billing.trialEnds')} : ${trialDate}</div>` : ''}
                    </div>
                </div>` : ''}

                ${info.plan === 'free' && !isTrialing ? `
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
                    <div style="font-size:0.85rem;color:#166534;">${t('billing.freePitch')}</div>
                </div>` : ''}

                <!-- CTA buttons -->
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${(effective === 'free' || isTrialing) ? `
                    <button id="billingUpgradeBtn" class="btn btn-primary" style="justify-content:center;">
                        ${t('billing.upgradeBtn')}
                    </button>` : ''}
                    ${isPaidPlan ? `
                    <button id="billingManageBtn" class="btn btn-secondary" style="justify-content:center;">
                        ${t('billing.manageBtn')}
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    }

    _renderAideTab() {
        const changelog = [
            { version: '4.4', date: '2026-03-30', label: 'Correctif', entries: [
                'Curseur non-cliquable sur les initiales des cartes Ressources',
            ]},
            { version: '4.3', date: '2026-03-30', label: 'Correctif', entries: [
                'Adresse de contact mise à jour : ganttprohelp2025@gmail.com',
            ]},
            { version: '4.2', date: '2026-03-30', label: 'Amélioration', entries: [
                'Tri par colonne "Type" dans l\'onglet Tableau',
            ]},
            { version: '4.1', date: '2026-03-30', label: 'Amélioration', entries: [
                'État Franchi / Non franchi dans l\'infobulle des jalons',
            ]},
            { version: '4.0', date: '2026-03-30', label: 'Fonctionnalité', entries: [
                'Barre de recherche dans le sélecteur de projets (dès 6 projets)',
            ]},
            { version: '3.9', date: '2026-03-30', label: 'Correctif', entries: [
                'Logo uploadé affiché dans le header',
            ]},
            { version: '3.8', date: '2026-03-30', label: 'Correctif', entries: [
                'Flèche de fermeture du panneau Réglages orientée vers la droite',
            ]},
            { version: '3.7', date: '2026-03-30', label: 'Amélioration', entries: [
                'Infobulle explicative sur le champ Favicon',
            ]},
            { version: '3.6', date: '2026-03-30', label: 'Fonctionnalité', entries: [
                'Upload Logo et Favicon en dur dans l\'onglet Profil',
            ]},
            { version: '3.5', date: '2026-03-30', label: 'Correctif', entries: [
                'État vide du Gantt centré, sans scroll horizontal',
                'Bouton "Nouvelle tâche" du Gantt vide fonctionnel',
            ]},
            { version: '3.4', date: '2026-03-30', label: 'Correctif', entries: [
                'Bouton "Nouvelle tâche" du Gantt vide ouvre le modal',
            ]},
            { version: '3.3', date: '2026-03-30', label: 'Fonctionnalité', entries: [
                'Footer Enregistrer / Annuler dans le panneau Réglages',
                'Snapshot à l\'ouverture — Annuler restaure l\'état précédent',
            ]},
            { version: '3.2', date: '2026-03-30', label: 'Fonctionnalité', entries: [
                'Champ Initiales dans l\'onglet Profil des Réglages',
            ]},
            { version: '3.1', date: '2026-03-30', label: 'Correctif', entries: [
                '5 onglets tous visibles dans le panneau Réglages (onglet Aide)',
            ]},
            { version: '3.0', date: '2026-03-27', label: 'Majeur', entries: [
                'Panneau Réglages réorganisé en 5 onglets : Profil, Apparence, Général, Synchro, Aide',
                'Avatar comme unique point d\'entrée des réglages',
                'Upload de photo de profil avec fallback sur les initiales',
                'Fonctionnalités Aide intégrées dans l\'onglet dédié',
            ]},
            { version: '2.9', date: '2026-03-27', label: 'Amélioration', entries: [
                'Tri par colonne dans les tableaux Dashboard',
                'Typographie unifiée dans les tableaux',
            ]},
            { version: '2.8', date: '2026-03-27', label: 'Correctif', entries: [
                'Palette de couleurs dans le modal de tâche restaurée en ronds',
            ]},
            { version: '2.7', date: '2026-03-27', label: 'Amélioration', entries: [
                'Formatage K / M / G pour tous les montants',
            ]},
            { version: '2.6', date: '2026-03-27', label: 'Fonctionnalité', entries: [
                'Personnalisation couleurs d\'accentuation et typographie',
            ]},
            { version: '2.5', date: '2026-03-26', label: 'Correctif', entries: [
                'Liens de dépendances masqués correctement avec tous les filtres',
            ]},
            { version: '2.4', date: '2026-03-26', label: 'Correctif', entries: [
                'Filtre Phase recharge les phases du projet actif',
            ]},
            { version: '2.3', date: '2026-03-26', label: 'Fonctionnalité', entries: [
                'Toggle Franchi / Non-franchi pour les jalons',
            ]},
            { version: '2.2', date: '2026-03-26', label: 'Fonctionnalité', entries: [
                'Infobulles au survol des tâches et jalons',
            ]},
            { version: '2.1', date: '2026-03-26', label: 'Fonctionnalité', entries: [
                'Champ de recherche dans le sélecteur "Assigné à"',
            ]},
        ];
        const labelMap = { 'Majeur': t('changelog.major'), 'Fonctionnalité': t('changelog.feature'), 'Amélioration': t('changelog.improve'), 'Correctif': t('changelog.fix') };
        const labelColors = { 'Majeur': '#6366F1', 'Fonctionnalité': '#10B981', 'Amélioration': '#3B82F6', 'Correctif': '#F59E0B' };
        const changelogHTML = changelog.map(v => `
            <div class="changelog-entry">
                <div class="changelog-version-row">
                    <span class="changelog-version">v${v.version}</span>
                    <span class="changelog-label" style="background:${labelColors[v.label] || '#64748B'}18;color:${labelColors[v.label] || '#64748B'};border:1px solid ${labelColors[v.label] || '#64748B'}35;">${labelMap[v.label] || v.label}</span>
                    <span class="changelog-date">${v.date}</span>
                </div>
                <ul class="changelog-list">
                    ${v.entries.map(e => `<li>${e}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        return `
            <div class="settings-section">
                <div class="settings-group" style="border-top:none;padding-top:0;">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
                        <h3>${t('settings.help.actions')}</h3>
                    </div>
                    <div class="aide-actions">
                        <button class="aide-action-btn" id="aideGuide">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
                            <div>
                                <div class="aide-action-label">${t('settings.help.guide.label')}</div>
                                <div class="aide-action-desc">${t('settings.help.guide.desc')}</div>
                            </div>
                            <svg class="aide-action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <button class="aide-action-btn" id="aideShortcuts">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/></svg>
                            <div>
                                <div class="aide-action-label">${t('settings.help.shortcuts.label')}</div>
                                <div class="aide-action-desc">${t('settings.help.shortcuts.desc')}</div>
                            </div>
                            <svg class="aide-action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <button class="aide-action-btn" id="aideContact">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <div>
                                <div class="aide-action-label">${t('settings.help.contact.label')}</div>
                                <div class="aide-action-desc">${t('settings.help.contact.desc')}</div>
                            </div>
                            <svg class="aide-action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>

                <div class="settings-group">
                    <div class="settings-group-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <h3>${t('settings.help.changelog')}</h3>
                    </div>
                    <div class="changelog-scroll">${changelogHTML}</div>
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
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
            });
        }
    }

    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen) this._cancel();
        });
    }

    _bindInternalEvents() {
        // Close button → cancel (revert changes)
        this._panel.querySelector('#settingsPanelClose')
            .addEventListener('click', () => this._cancel());

        // Tab switching
        this._panel.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
        });
    }

    _switchTab(tabName) {
        this._activeTab = tabName;
        this._panel.querySelectorAll('.settings-tab').forEach(tab =>
            tab.classList.toggle('active', tab.dataset.tab === tabName)
        );
        const content = this._panel.querySelector('#settingsTabContent');
        if (content) content.innerHTML = this._renderTabContent(tabName);
        this._bindTabEvents(tabName);
    }

    _bindTabEvents(tabName) {
        switch (tabName) {
            case 'profil':    this._bindProfilEvents();    break;
            case 'apparence': this._bindApparenceEvents(); break;
            case 'general':   this._bindGeneralEvents();   break;
            case 'synchro':     this._bindSynchroEvents();      break;
            case 'aide':        this._bindAideEvents();         break;
            case 'abonnement':  this._bindAbonnementEvents();   break;
        }
    }

    _bindAbonnementEvents() {
        const upgradeBtn = this._panel.querySelector('#billingUpgradeBtn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                this.close();
                // Delegate to app's upgrade modal
                if (window.app?._showUpgradeModal) window.app._showUpgradeModal('generic');
            });
        }
        const manageBtn = this._panel.querySelector('#billingManageBtn');
        if (manageBtn) {
            manageBtn.addEventListener('click', async () => {
                manageBtn.disabled = true;
                manageBtn.textContent = '…';
                try {
                    if (window.app?._openBillingPortal) {
                        await window.app._openBillingPortal();
                    } else {
                        alert('Portail Stripe non encore configuré.');
                    }
                } finally {
                    manageBtn.disabled = false;
                    manageBtn.textContent = t('billing.manageBtn');
                }
            });
        }
    }

    _bindProfilEvents() {
        const uploadBtn  = this._panel.querySelector('#settingsAvatarUploadBtn');
        const fileInput  = this._panel.querySelector('#settingsAvatarInput');
        const removeBtn  = this._panel.querySelector('#settingsAvatarRemoveBtn');

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file || file.size > 2 * 1024 * 1024) return; // 2 Mo max
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this._saveCustomization('avatarPhoto', ev.target.result);
                    this._applyAvatarPhoto(ev.target.result);
                    this._switchTab('profil'); // re-render to show photo + remove btn
                };
                reader.readAsDataURL(file);
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this._saveCustomization('avatarPhoto', '');
                this._applyAvatarPhoto('');
                this._switchTab('profil');
            });
        }

        const userNameInput  = this._panel.querySelector('#settingsUserName');
        const initialsInput  = this._panel.querySelector('#settingsInitials');
        const nameInput      = this._panel.querySelector('#settingsName');

        // Logo upload
        this._bindAssetUpload({
            uploadBtnId:  'settingsLogoUploadBtn',
            removeBtnId:  'settingsLogoRemoveBtn',
            fileInputId:  'settingsLogoInput',
            previewId:    'settingsLogoPreview',
            storeKey:     'logoData',
            maxBytes:     2 * 1024 * 1024,
            renderPreview: (src) => `<img src="${src}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;">`,
            renderEmpty:   () => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
            onSave:   (src) => { this._applyLogo(src);  this._switchTab('profil'); },
            onRemove: ()    => { this._applyLogo('');   this._switchTab('profil'); },
        });

        // Favicon upload
        this._bindAssetUpload({
            uploadBtnId:  'settingsFaviconUploadBtn',
            removeBtnId:  'settingsFaviconRemoveBtn',
            fileInputId:  'settingsFaviconInput',
            previewId:    'settingsFaviconPreview',
            storeKey:     'faviconData',
            maxBytes:     512 * 1024,
            renderPreview: (src) => `<img src="${src}" alt="Favicon" style="max-width:100%;max-height:100%;object-fit:contain;">`,
            renderEmpty:   () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>`,
            onSave: (src) => { this._applyFavicon(src); this._switchTab('profil'); },
            onRemove: () => { this._applyFavicon(''); this._switchTab('profil'); },
        });

        if (initialsInput) {
            initialsInput.addEventListener('input', this._debounce(() => {
                const val = initialsInput.value.toUpperCase();
                initialsInput.value = val;
                this._saveCustomization('initials', val);
                if (!this._getCustomization('avatarPhoto')) {
                    this._applyUserInitials(this._getCustomization('userName') || '');
                    const preview = this._panel.querySelector('#settingsAvatarPreview span');
                    if (preview) preview.textContent = val || (this._getCustomization('userName') || '?').trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';
                }
            }, 300));
        }

        if (userNameInput) {
            userNameInput.addEventListener('input', this._debounce(() => {
                this._saveCustomization('userName', userNameInput.value);
                // Only auto-update initials if user hasn't set custom ones
                if (!this._getCustomization('initials')) {
                    this._applyUserInitials(userNameInput.value);
                    if (!this._getCustomization('avatarPhoto')) {
                        const preview = this._panel.querySelector('#settingsAvatarPreview span');
                        if (preview) {
                            preview.textContent = userNameInput.value.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';
                        }
                    }
                }
            }, 500));
        }
        if (nameInput) {
            nameInput.addEventListener('input', this._debounce(() => {
                this._saveCustomization('brandName', nameInput.value);
                this._applyBrandName(nameInput.value);
            }, 500));
        }
    }

    _bindAssetUpload({ uploadBtnId, removeBtnId, fileInputId, previewId, storeKey, maxBytes, renderPreview, renderEmpty, onSave, onRemove }) {
        const uploadBtn  = this._panel.querySelector(`#${uploadBtnId}`);
        const fileInput  = this._panel.querySelector(`#${fileInputId}`);
        const removeBtn  = this._panel.querySelector(`#${removeBtnId}`);
        const preview    = this._panel.querySelector(`#${previewId}`);

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file || file.size > maxBytes) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const src = ev.target.result;
                    this._saveCustomization(storeKey, src);
                    if (preview) preview.innerHTML = renderPreview(src);
                    if (onSave) onSave(src);
                };
                reader.readAsDataURL(file);
            });
        }
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this._saveCustomization(storeKey, '');
                if (preview) preview.innerHTML = renderEmpty();
                if (onRemove) onRemove();
                else if (onSave) onSave('');
            });
        }
    }

    _bindApparenceEvents() {
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

        const fontSelect = this._panel.querySelector('#settingsFontFamily');
        if (fontSelect) {
            fontSelect.addEventListener('change', () => {
                this._applyFontFamily(fontSelect.value);
                this._saveCustomization('fontFamily', fontSelect.value);
            });
        }

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

    _bindGeneralEvents() {
        // Language selector
        this._panel.querySelectorAll('.lang-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                setLanguage(btn.dataset.lang);
            });
        });

        const currencySelect = this._panel.querySelector('#settingsCurrency');
        if (currencySelect) {
            currencySelect.addEventListener('change', () => {
                this._saveCustomization('currency', currencySelect.value);
                document.dispatchEvent(new CustomEvent('currency-changed'));
            });
        }
        const showLinksCheckbox = this._panel.querySelector('#settingsShowLinks');
        if (showLinksCheckbox) {
            showLinksCheckbox.addEventListener('change', () => {
                this._saveCustomization('showLinks', showLinksCheckbox.checked);
                document.dispatchEvent(new CustomEvent('links-visibility-changed'));
            });
        }

        const excludeWeekendsCheckbox = this._panel.querySelector('#settingsExcludeWeekends');
        if (excludeWeekendsCheckbox) {
            excludeWeekendsCheckbox.addEventListener('change', () => {
                const project = store.getActiveProject();
                if (project) {
                    store.updateProject(project.id, { excludeWeekends: excludeWeekendsCheckbox.checked });
                    document.dispatchEvent(new CustomEvent('costs-settings-changed'));
                }
            });
        }
    }

    _bindAideEvents() {
        const guideBtn = this._panel.querySelector('#aideGuide');
        if (guideBtn) {
            guideBtn.addEventListener('click', () => {
                this.close();
                document.dispatchEvent(new CustomEvent('launch-onboarding'));
            });
        }
        const shortcutsBtn = this._panel.querySelector('#aideShortcuts');
        if (shortcutsBtn) {
            shortcutsBtn.addEventListener('click', () => {
                this.close();
                document.dispatchEvent(new CustomEvent('show-keyboard-help'));
            });
        }
        const contactBtn = this._panel.querySelector('#aideContact');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                window.location.href = 'mailto:ganttprohelp2025@gmail.com';
            });
        }
    }

    _bindSynchroEvents() {
        const gdriveBtn = this._panel.querySelector('#settingsGDriveBtn');
        if (gdriveBtn) {
            gdriveBtn.addEventListener('click', () => {
                this.close();
                document.dispatchEvent(new CustomEvent('open-cloud-backup'));
            });
        }
        const onedriveBtn = this._panel.querySelector('#settingsOneDriveBtn');
        if (onedriveBtn) {
            onedriveBtn.addEventListener('click', () => {
                this.close();
                document.dispatchEvent(new CustomEvent('open-onedrive-backup'));
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
        if (this._getCustomization('avatarPhoto')) return; // photo takes priority
        const custom = this._getCustomization('initials');
        if (custom) {
            avatar.textContent = custom;
        } else if (userName && userName.trim()) {
            const initials = userName.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
            avatar.textContent = initials;
        } else {
            avatar.textContent = '?';
        }
        const label = userName && userName.trim() ? `Profil - ${userName.trim()}` : 'Profil utilisateur';
        avatar.setAttribute('aria-label', label);
    }

    _applyBrandName(name) {
        const logoText = document.querySelector('.logo > span');
        if (logoText) {
            logoText.textContent = name && name.trim() ? name.trim() : 'Gantt Planner';
        }
    }

    _applyLogo(src) {
        const logoWrap = document.querySelector('.logo');
        if (!logoWrap) return;
        const logoIcon = logoWrap.querySelector('.logo-icon');
        let logoImg = logoWrap.querySelector('.logo-img');
        if (src) {
            if (!logoImg) {
                logoImg = document.createElement('img');
                logoImg.className = 'logo-img';
                logoImg.alt = 'Logo';
                logoWrap.insertBefore(logoImg, logoWrap.firstChild);
            }
            logoImg.src = src;
            if (logoIcon) logoIcon.style.display = 'none';
        } else {
            if (logoImg) logoImg.remove();
            if (logoIcon) logoIcon.style.display = '';
        }
    }

    _applyFavicon(src) {
        // Browsers cache favicons even when the <link> element is removed.
        // The only reliable way to clear it is to replace it with a
        // 1×1 transparent PNG so the browser loads a new (blank) icon.
        const EMPTY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=';
        document.querySelectorAll("link[rel~='icon']").forEach(el => el.remove());
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = src || EMPTY;
        document.head.appendChild(link);
    }

    _applyAvatarPhoto(dataUrl) {
        const avatar = document.querySelector('.header-actions .avatar');
        if (!avatar) return;
        if (dataUrl) {
            avatar.style.backgroundImage = `url(${dataUrl})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
        } else {
            avatar.style.backgroundImage = '';
            avatar.style.backgroundSize = '';
            avatar.style.backgroundPosition = '';
            this._applyUserInitials(this._getCustomization('userName') || '');
        }
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

    /* ---- Footer ---- */

    _bindFooterEvents() {
        const saveBtn   = this._panel.querySelector('#settingsSaveBtn');
        const cancelBtn = this._panel.querySelector('#settingsCancelBtn');
        if (saveBtn)   saveBtn.addEventListener('click',   () => this._save());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this._cancel());
    }

    _save() {
        this._snapshot = null;
        this.close();
        document.dispatchEvent(new CustomEvent('settings-saved'));
    }

    _cancel() {
        if (this._snapshot) {
            this._revertToSnapshot();
        }
        this._snapshot = null;
        this.close();
    }

    _revertToSnapshot() {
        const snap = this._snapshot;
        store.updateSettings({ customization: snap });
        // Revert visual state
        if (snap.avatarPhoto) {
            this._applyAvatarPhoto(snap.avatarPhoto);
        } else {
            this._applyAvatarPhoto('');
            this._applyUserInitials(snap.userName || '');
        }
        if (snap.brandName)   this._applyBrandName(snap.brandName);
        this._applyLogo(snap.logoData || '');
        this._applyFavicon(snap.faviconData || '');
        const accent = snap.accentColor;
        if (accent) {
            const h = snap.accentColorHover, l = snap.accentColorLight, d = snap.accentColorDark;
            if (h && l && d) this._applyAccentColor(accent, h, l, d);
            else { const p = this._computeColorPalette(accent); this._applyAccentColor(p.primary, p.hover, p.light, p.dark); }
        } else {
            this._applyAccentColor('#6366F1', '#4F46E5', '#EEF2FF', '#4338CA');
        }
        this._applyFontFamily(snap.fontFamily || 'Inter');
        this._applyFontSize(snap.fontSize || 'normal');
        document.dispatchEvent(new CustomEvent('currency-changed'));
        document.dispatchEvent(new CustomEvent('links-visibility-changed'));
    }

    /* ---- Open / Close ---- */

    open() {
        // Snapshot current state before any changes
        const settings = store.getSettings();
        this._snapshot = { ...(settings.customization || {}) };
        this._isOpen = true;
        this._overlay.classList.add('active');
        this._panel.classList.add('open');
        document.body.style.overflow = 'hidden';
        // Re-render active tab to get fresh store values
        this._switchTab(this._activeTab);
        const closeBtn = this._panel.querySelector('#settingsPanelClose');
        if (closeBtn) setTimeout(() => closeBtn.focus(), 100);
    }

    close() {
        this._isOpen = false;
        this._overlay.classList.remove('active');
        this._panel.classList.remove('open');
        document.body.style.overflow = '';
        const btn = document.getElementById('settingsBtn');
        if (btn) btn.focus();
    }

    toggle() {
        if (this._isOpen) this.close(); else this.open();
    }

    /* ---- Apply stored customizations on init ---- */
    applyStoredCustomizations() {
        const userName    = this._getCustomization('userName');
        const brandName   = this._getCustomization('brandName');
        const avatarPhoto = this._getCustomization('avatarPhoto');
        const faviconData = this._getCustomization('faviconData');

        if (avatarPhoto) {
            this._applyAvatarPhoto(avatarPhoto);
        } else {
            this._applyUserInitials(userName || '');
        }
        if (brandName)   this._applyBrandName(brandName);
        this._applyLogo(this._getCustomization('logoData') || '');
        this._applyFavicon(faviconData || '');

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

        const fontFamily = this._getCustomization('fontFamily');
        if (fontFamily) this._applyFontFamily(fontFamily);

        const fontSize = this._getCustomization('fontSize');
        if (fontSize) this._applyFontSize(fontSize);
    }
}

export const settingsPanel = new SettingsPanel();
