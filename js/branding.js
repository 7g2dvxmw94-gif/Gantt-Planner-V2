/* ========================================
   BRANDING MODULE
   Applies white-label config to the DOM
   ======================================== */

import { branding as config } from '../config/branding.js';

class BrandingManager {
    constructor() {
        this._config = config;
    }

    getConfig() {
        return this._config;
    }

    /**
     * Apply all branding settings to the DOM.
     * Call once after DOMContentLoaded.
     */
    apply() {
        this._applyMeta();
        this._applyColors();
        this._applyFont();
        this._applyLogo();
        this._applyUser();
        this._applyFooter();
    }

    /* ---- Meta tags ---- */

    _applyMeta() {
        const c = this._config;

        // Title
        document.title = c.appName;

        // Description
        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) {
            descMeta.content = c.appName + ' - ' + c.description;
        }

        // Theme color
        const themeLight = document.querySelector('meta[name="theme-color"][media*="light"]');
        const themeDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
        if (themeLight) themeLight.content = c.themeColorLight || c.primaryColor;
        if (themeDark) themeDark.content = c.themeColorDark || c.primaryColor;

        // Locale
        if (c.locale) {
            document.documentElement.lang = c.locale;
        }

        // Favicon
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
            // Compute RGB for rgba() usage
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

        // Accent color for logo gradient
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

        // Load custom font URL if different from default
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

        // Logo area
        const logoContainer = document.querySelector('.logo');
        if (!logoContainer) return;

        logoContainer.setAttribute('aria-label', c.appName);

        const logoIcon = logoContainer.querySelector('.logo-icon');
        const logoText = logoContainer.querySelector('span');

        if (c.logoImage) {
            // Replace icon with image
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
        } else if (c.logoIcon && logoIcon) {
            logoIcon.textContent = c.logoIcon;
        }

        if (logoText) {
            logoText.textContent = c.appShortName || c.appName;
        }

        // Update accent color on logo gradient
        if (c.accentColor && logoIcon && !c.logoImage) {
            logoIcon.style.background = `linear-gradient(135deg, ${c.primaryColor || '#6366F1'}, ${c.accentColor})`;
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
        if (!c.copyrightText && !c.footerText) return;

        // Check if branding footer already exists
        let footer = document.getElementById('brandingFooter');
        if (!footer) {
            footer = document.createElement('div');
            footer.id = 'brandingFooter';
            footer.className = 'branding-footer';

            // Insert after the stats-bar footer
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
