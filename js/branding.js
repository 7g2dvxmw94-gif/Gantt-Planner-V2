/* ========================================
   BRANDING MODULE
   Applies white-label config to the DOM
   ======================================== */

import { branding as defaultConfig } from '../config/branding.js';

const STORAGE_KEY = 'gantt_branding';

class BrandingManager {
    constructor() {
        this._config = defaultConfig;
    }

    getConfig() {
        return this._config;
    }

    /**
     * Apply branding on startup.
     * Loads from localStorage if available, otherwise uses default config.
     */
    apply() {
        this._loadFromStorage();
        this._applyAll();
    }

    /**
     * Apply a specific config object (used by the panel for live preview).
     */
    applyConfig(config) {
        this._config = config;
        this._applyAll();
    }

    _applyAll() {
        this._applyMeta();
        this._applyColors();
        this._applyFont();
        this._applyLogo();
        this._applyUser();
        this._applyFooter();
    }

    _loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this._config = { ...defaultConfig, ...parsed };
            }
        } catch { /* ignore */ }
    }

    /* ---- Meta tags ---- */

    _applyMeta() {
        const c = this._config;

        document.title = c.appName;

        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) {
            descMeta.content = c.appName + ' - ' + c.description;
        }

        const themeLight = document.querySelector('meta[name="theme-color"][media*="light"]');
        const themeDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
        if (themeLight) themeLight.content = c.themeColorLight || c.primaryColor;
        if (themeDark) themeDark.content = c.themeColorDark || c.primaryColor;

        if (c.locale) {
            document.documentElement.lang = c.locale;
        }

        if (c.favicon) {
            let link = document.querySelector('link[rel="icon"]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = c.favicon;
        }
    }

    /* ---- CSS Custom Properties ---- */

    _applyColors() {
        const c = this._config;
        const root = document.documentElement;

        if (c.primaryColor) {
            root.style.setProperty('--color-primary', c.primaryColor);
            const rgb = this._hexToRgb(c.primaryColor);
            if (rgb) {
                root.style.setProperty('--color-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            }
        }
        if (c.primaryHoverColor) {
            root.style.setProperty('--color-primary-hover', c.primaryHoverColor);
        }
        if (c.primaryLightColor) {
            root.style.setProperty('--color-primary-light', c.primaryLightColor);
        }
        if (c.primaryDarkColor) {
            root.style.setProperty('--color-primary-dark', c.primaryDarkColor);
        }
        if (c.accentColor) {
            root.style.setProperty('--color-accent', c.accentColor);
        }
    }

    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        } : null;
    }

    /* ---- Font ---- */

    _applyFont() {
        const c = this._config;
        if (!c.fontFamily) return;

        document.documentElement.style.setProperty('--font-sans', c.fontFamily);

        if (c.fontUrl) {
            const existing = document.querySelector(`link[href="${c.fontUrl}"]`);
            if (!existing) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = c.fontUrl;
                document.head.appendChild(link);
            }
        }
    }

    /* ---- Logo ---- */

    _applyLogo() {
        const c = this._config;

        const logoContainer = document.querySelector('.logo');
        if (!logoContainer) return;

        logoContainer.setAttribute('aria-label', c.appName);

        const logoIcon = logoContainer.querySelector('.logo-icon');
        const logoText = logoContainer.querySelector('span');

        if (c.logoImage) {
            if (logoIcon) {
                logoIcon.innerHTML = '';
                logoIcon.style.background = 'none';
                const img = document.createElement('img');
                img.src = c.logoImage;
                img.alt = c.appShortName || c.appName;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.style.borderRadius = 'inherit';
                logoIcon.appendChild(img);
            }
        } else if (logoIcon) {
            // Restore text icon (clear any previous image)
            const existingImg = logoIcon.querySelector('img');
            if (existingImg) existingImg.remove();
            logoIcon.textContent = c.logoIcon || 'GP';
            logoIcon.style.background = `linear-gradient(135deg, ${c.primaryColor || '#6366F1'}, ${c.accentColor || '#EC4899'})`;
        }

        if (logoText) {
            logoText.textContent = c.appShortName || c.appName;
        }
    }

    /* ---- Default user ---- */

    _applyUser() {
        const c = this._config;

        const avatar = document.querySelector('.avatar');
        if (avatar) {
            avatar.textContent = c.defaultUserInitials || 'U';
            avatar.setAttribute('aria-label', 'Profil utilisateur - ' + (c.defaultUserName || 'Utilisateur'));
        }
    }

    /* ---- Footer ---- */

    _applyFooter() {
        const c = this._config;

        let footer = document.getElementById('brandingFooter');

        if (!c.copyrightText && !c.footerText) {
            // Remove footer if it exists but nothing to show
            if (footer) footer.remove();
            return;
        }

        if (!footer) {
            footer = document.createElement('div');
            footer.id = 'brandingFooter';
            footer.className = 'branding-footer';

            const statsBar = document.querySelector('.stats-bar');
            if (statsBar && statsBar.parentNode) {
                statsBar.parentNode.insertBefore(footer, statsBar.nextSibling);
            } else {
                document.body.appendChild(footer);
            }
        }

        const parts = [];
        if (c.footerText) parts.push(c.footerText);
        if (c.copyrightText) parts.push(c.copyrightText);
        footer.textContent = parts.join(' · ');
    }
}

export const brandingManager = new BrandingManager();
