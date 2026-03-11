/* ========================================
   BRANDING CONFIGURATION
   White-label customization for Gantt Planner
   ========================================

   Edit this file to customize the application
   appearance for your brand.
   ======================================== */

export const branding = {

    /* ---- Identity ---- */
    appName: 'Gantt Planner Pro',
    appShortName: 'Gantt Planner',
    logoIcon: 'GP',                     // Text inside the logo icon (2-3 chars)
    logoImage: null,                     // URL or path to logo image (replaces logoIcon if set)
    favicon: null,                       // URL or path to favicon (null = keep default)
    description: 'Outil de planification de projets avec diagramme de Gantt interactif',

    /* ---- Colors ---- */
    primaryColor: '#6366F1',             // Main brand color
    primaryHoverColor: '#4F46E5',        // Hover state
    primaryLightColor: '#EEF2FF',        // Light variant (backgrounds)
    primaryDarkColor: '#4338CA',         // Dark variant
    accentColor: '#EC4899',              // Accent / gradient color (logo, highlights)

    /* ---- Typography ---- */
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',

    /* ---- User defaults ---- */
    defaultUserName: 'Jean Dupont',
    defaultUserInitials: 'JD',

    /* ---- Footer / Copyright ---- */
    footerText: null,                    // Custom footer text (null = no extra footer)
    copyrightText: null,                 // e.g. "© 2026 MaSociété. Tous droits réservés."

    /* ---- Meta ---- */
    themeColorLight: '#6366F1',          // <meta name="theme-color"> for light mode
    themeColorDark: '#818CF8',           // <meta name="theme-color"> for dark mode
    locale: 'fr',                        // Default locale (fr, en, etc.)
};
