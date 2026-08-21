/* ========================================
   UTILITIES - Gantly
   ======================================== */

/**
 * Generate a unique ID (UUID v4, compatible with Supabase primary keys)
 */
export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/* ---- Date Utilities ---- */

const _LANG_LOCALE = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };
function _getLocale() {
    return _LANG_LOCALE[localStorage.getItem('gantt_lang')] || 'fr-FR';
}

/* ============================================================
   CORRECTIF FUSEAU HORAIRE (lot 3)
   ------------------------------------------------------------
   Toutes les fonctions ci-dessous faisaient `new Date(date)` puis
   lisaient des composantes LOCALES (getDate/getMonth/getFullYear/
   getDay) ou formataient en local (toLocaleDateString). Or
   `new Date('2026-05-04')` est interprete comme minuit UTC — pour un
   utilisateur a l'ouest de Greenwich (Ameriques, Pacifique), lire
   .getDate() dessus renvoie le jour PRECEDENT.

   Verifie avec le vrai moteur JS, sous plusieurs fuseaux simules :
     TZ=America/New_York : new Date('2026-05-04').getDate() -> 3 (FAUX)
     TZ=Europe/Paris      : new Date('2026-05-04').getDate() -> 4 (correct)
   Le bug est invisible depuis la France — d'ou son absence de
   detection jusqu'ici — mais actif pour tout client se connectant
   depuis les Ameriques.

   Ces fonctions utilisent desormais parseISO() (definie plus bas,
   disponible ici par hoisting des declarations de fonction) qui
   construit la date depuis ses composantes plutot que de les faire
   passer par une interpretation UTC intermediaire.

   Les COMPARAISONS et SOUSTRACTIONS pures (tri, <, >, difference de
   dates) restaient deja correctes quel que soit le fuseau — elles ne
   sont pas touchees ici, seule l'extraction de composantes l'etait.
   ============================================================ */

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDateISO(date) {
    const d = parseISO(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format a date for display (e.g. "15 Mar 2025")
 */
export function formatDateDisplay(date) {
    const d = parseISO(date);
    return d.toLocaleDateString(_getLocale(), {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Format a short date (e.g. "15 Mar")
 */
export function formatDateShort(date) {
    const d = parseISO(date);
    return d.toLocaleDateString(_getLocale(), {
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Calculate the number of business days between two dates
 */
export function businessDaysBetween(start, end) {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

/**
 * Calculate the number of calendar days between two dates
 */
export function daysBetween(start, end) {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/* countWorkingDays(start, end) a été SUPPRIMÉE ici.
 *
 * Elle comptait les jours ouvrés en dur — lundi-vendredi, fériés ignorés,
 * jours travaillés configurés ignorés — sans accepter de calendrier. Son
 * dernier appelant était le calcul de coûts, qui facturait donc les jours
 * fériés ; il utilise désormais workingDaysBetween(start, end, calendar).
 *
 * Ne pas la réintroduire : workingDaysBetween() fait le même décompte
 * inclusif en s'appuyant sur isWorkingDay(), et prend le calendrier. La
 * laisser exportée sans appelant aurait invité à refaire le même défaut. */

/**
 * Add days to a date
 */
export function addDays(date, days) {
    const d = parseISO(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Get the Monday of the week containing the given date
 */
export function getWeekStart(date) {
    const d = parseISO(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get the first day of the month
 */
export function getMonthStart(date) {
    const d = parseISO(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get all months between two dates
 */
export function getMonthsBetween(start, end) {
    const months = [];
    const current = getMonthStart(start);
    const endDate = parseISO(end);
    while (current <= endDate) {
        months.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }
    return months;
}

/**
 * Get all weeks between two dates
 */
export function getWeeksBetween(start, end) {
    const weeks = [];
    let current = getWeekStart(start);
    const endDate = parseISO(end);
    while (current <= endDate) {
        weeks.push(new Date(current));
        current = addDays(current, 7);
    }
    return weeks;
}

/**
 * Get all days between two dates
 */
export function getDaysBetween(start, end) {
    const days = [];
    const current = parseISO(start);
    current.setHours(0, 0, 0, 0);
    const endDate = parseISO(end);
    endDate.setHours(0, 0, 0, 0);
    while (current <= endDate) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return days;
}

/**
 * Check if a date is today
 */
export function isToday(date) {
    const d = parseISO(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date) {
    const d = parseISO(date);
    return d.getDay() === 0 || d.getDay() === 6;
}

/**
 * Get the ISO week number
 */
export function getWeekNumber(date) {
    const d = parseISO(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Get month name in the current UI language
 */
export function getMonthName(date) {
    const d = parseISO(date);
    return d.toLocaleDateString(_getLocale(), { month: 'long' });
}

/**
 * Get day name in French (short)
 */
export function getDayName(date) {
    const d = parseISO(date);
    return d.toLocaleDateString('fr-FR', { weekday: 'short' });
}

/* ---- DOM Utilities ---- */

/**
 * Create a DOM element with attributes and children
 */
export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const event = key.slice(2).toLowerCase();
            el.addEventListener(event, value);
        } else if (key === 'dataset') {
            for (const [dk, dv] of Object.entries(value)) {
                el.dataset[dk] = dv;
            }
        } else {
            el.setAttribute(key, value);
        }
    }

    for (const child of Array.isArray(children) ? children : [children]) {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    }

    return el;
}

/**
 * Shorthand for querySelector
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Shorthand for querySelectorAll
 */
export function $$(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
}

/* ---- Color Utilities ---- */

/**
 * Predefined task color palette
 */
export const TASK_COLORS = [
    { name: 'Indigo',  value: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
    { name: 'Violet',  value: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
    { name: 'Rose',    value: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899, #DB2777)' },
    { name: 'Bleu',    value: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
    { name: 'Cyan',    value: '#06B6D4', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)' },
    { name: 'Vert',    value: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #059669)' },
    { name: 'Ambre',   value: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
    { name: 'Orange',  value: '#F97316', gradient: 'linear-gradient(135deg, #F97316, #EA580C)' },
    { name: 'Rouge',   value: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)' },
    { name: 'Gris',    value: '#64748B', gradient: 'linear-gradient(135deg, #64748B, #475569)' },
];

/**
 * Get a color from the palette by index
 */
export function getTaskColor(index) {
    return TASK_COLORS[index % TASK_COLORS.length];
}

/* ---- Currency Utilities ---- */

const CURRENCIES = {
    EUR: { symbol: '€', position: 'after', hourly: '€/h', daily: '€/j', space: true },
    USD: { symbol: '$', position: 'before', hourly: '$/h', daily: '$/d', space: false },
    GBP: { symbol: '£', position: 'before', hourly: '£/h', daily: '£/d', space: false },
    CHF: { symbol: 'CHF', position: 'after', hourly: 'CHF/h', daily: 'CHF/d', space: true },
};

export { CURRENCIES };

/**
 * Get the current currency config from store settings
 */
export function getCurrencyConfig() {
    try {
        const raw = localStorage.getItem('gantt-planner-pro');
        if (raw) {
            const data = JSON.parse(raw);
            const code = data?.settings?.customization?.currency || 'EUR';
            return CURRENCIES[code] || CURRENCIES.EUR;
        }
    } catch (_) { /* ignore */ }
    return CURRENCIES.EUR;
}

/**
 * Format a value with the current currency symbol.
 * Automatically abbreviates: K (thousands), M (millions), G (billions).
 * Examples: 1500 → "1.5 K€", 2500000 → "2.5 M€", 3000000000 → "3 G€"
 */
export function formatCurrency(value) {
    const c = getCurrencyConfig();
    const multiChar = c.symbol.length > 1;

    const fmt = v => {
        const r = Math.round(v * 10) / 10;
        return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1);
    };

    let amount, suffix;
    const abs = Math.abs(value);
    if (value === 0) {
        amount = '0'; suffix = '';
    } else if (abs >= 999_950_000_000) {
        // >= 999.95 G → would show "1000 G" without this; G is the max unit
        amount = fmt(value / 1e9); suffix = ' G';
    } else if (abs >= 1e9) {
        amount = fmt(value / 1e9); suffix = ' G';
    } else if (abs >= 999_950_000) {
        // Would round to "1000 M" → promote to G
        amount = fmt(value / 1e9); suffix = ' G';
    } else if (abs >= 1e6) {
        amount = fmt(value / 1e6); suffix = ' M';
    } else if (abs >= 999_950) {
        // Would round to "1000 K" → promote to M
        amount = fmt(value / 1e6); suffix = ' M';
    } else if (abs >= 1e3) {
        amount = fmt(value / 1e3); suffix = ' K';
    } else {
        amount = Math.round(value).toString(); suffix = '';
    }

    const scaled = suffix !== '';
    if (c.position === 'before') {
        // e.g. "$1.5 K" or "$500"
        return c.symbol + (c.space && !scaled ? ' ' : '') + amount + suffix;
    } else {
        // e.g. "1.5 K€" or "500 €" or "1.5 K CHF"
        const sep = scaled ? (multiChar ? ' ' : '') : (c.space ? ' ' : '');
        return amount + suffix + sep + c.symbol;
    }
}

/**
 * Format a rate value (e.g. "50.00 €/h" or "$50.00/h")
 */
export function formatRate(value, type = 'hourly') {
    const c = getCurrencyConfig();
    const suffix = type === 'daily' ? c.daily : c.hourly;
    return value.toFixed(2) + ' ' + suffix;
}

/**
 * Get the current currency symbol
 */
export function getCurrencySymbol() {
    return getCurrencyConfig().symbol;
}

/* ---- Misc Utilities ---- */

/**
 * Simple debounce
 */
export function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/* ============================================================
   Calendrier ouvré — jours ouvrables et jours féries francais
   ------------------------------------------------------------
   Le moteur de planification ignorait totalement les week-ends :
   une tache finissant vendredi voyait son successeur demarrer
   samedi. Les fonctions isWeekend() et businessDaysBetween()
   existaient dans utils.js mais n'etaient JAMAIS appelees par
   store.js — seul gantt-renderer.js s'en servait pour griser les
   colonnes. D'ou l'incoherence visible : des taches posees sur
   des colonnes grisees.

   PIEGE DE FUSEAU HORAIRE : new Date('2026-05-01') est interprete
   en UTC, alors que new Date(2026, 4, 1) l'est en heure locale.
   Melanger les deux decale les dates d'un jour pour les
   utilisateurs a l'ouest de Greenwich. Tout ce module construit
   et lit les dates en LOCAL, exclusivement.
   ============================================================ */

/** Analyse 'AAAA-MM-JJ' en date LOCALE (jamais UTC). */
export function parseISO(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());

    /* CORRECTIF (lot 3) : le regex etait un match de PREFIXE (sans '$'),
     * qui capturait aussi le debut d'un horodatage complet du type
     * '2026-05-04T13:45:00.000Z' et jetait silencieusement l'heure.
     * Or cette meme fonction est desormais reutilisee par les anciennes
     * fonctions utilitaires (addDays, daysBetween, isWeekend...) qui
     * peuvent recevoir soit une date-calendrier pure ('2026-05-04', le
     * cas a corriger), soit — plus rarement — un horodatage complet.
     * Le regex EXACT (avec '$') ne matche desormais que les dates pures ;
     * tout le reste (horodatage, nombre, valeur invalide) retombe sur le
     * comportement natif de Date, correct pour un instant precis. */
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(value);
}

/* NOTE : formatDateISO() existe deja plus haut dans ce fichier et lit
   bien les composantes LOCALES (getFullYear/getMonth/getDate) : on la
   reutilise plutot que d'ajouter un doublon. */

/** Dimanche de Paques (algorithme gregorien anonyme, Meeus). */
export function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31);      // 3 = mars, 4 = avril
    const jour = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, mois - 1, jour);
}

/** Jours feries francais (metropole) pour une annee, en 'AAAA-MM-JJ'. */
export function frenchHolidays(year, { alsaceMoselle = false } = {}) {
    const paques = easterSunday(year);
    const decale = n => { const d = new Date(paques); d.setDate(d.getDate() + n); return d; };

    const jours = [
        new Date(year, 0, 1),    // Jour de l'an
        decale(1),               // Lundi de Paques
        new Date(year, 4, 1),    // Fete du Travail
        new Date(year, 4, 8),    // Victoire 1945
        decale(39),              // Ascension
        decale(50),              // Lundi de Pentecote
        new Date(year, 6, 14),   // Fete nationale
        new Date(year, 7, 15),   // Assomption
        new Date(year, 10, 1),   // Toussaint
        new Date(year, 10, 11),  // Armistice
        new Date(year, 11, 25),  // Noel
    ];
    if (alsaceMoselle) {
        jours.push(decale(-2));            // Vendredi saint
        jours.push(new Date(year, 11, 26)); // Saint Etienne
    }
    return jours.map(formatDateISO).sort();
}

/** Calendrier par defaut : lundi-vendredi + feries francais. */
export function defaultCalendar() {
    return { workingDays: [1, 2, 3, 4, 5], holidays: [], useFrenchHolidays: true };
}

/* ── Memoisation ──────────────────────────────────────────────
   Sans cache, isWorkingDay() recalculait les feries de trois annees
   a CHAQUE appel — dont le dimanche de Paques. Or le moteur de
   planification appelle cette fonction des milliers de fois par
   recalcul : 2000 x addWorkingDays(200) prenait 8,5 secondes.
   Avec memoisation par annee, on tombe sous les 50 ms. */
const _feriesParAnnee = new Map();          // cle: "annee|flags" -> Set
const _feriesPerso    = new WeakMap();      // objet calendrier -> Set

function feriesFrancaisAnnee(calendar, annee) {
    const cle = `${annee}|${calendar.useFrenchHolidays ? 1 : 0}|${calendar.alsaceMoselle ? 1 : 0}`;
    let set = _feriesParAnnee.get(cle);
    if (!set) {
        set = new Set(calendar.useFrenchHolidays ? frenchHolidays(annee, calendar) : []);
        _feriesParAnnee.set(cle, set);
    }
    return set;
}

function feriesPersonnalises(calendar) {
    let set = _feriesPerso.get(calendar);
    if (!set) {
        set = new Set(calendar.holidays || []);
        _feriesPerso.set(calendar, set);
    }
    return set;
}

/** Vide les caches. A appeler si le calendrier d'un projet change. */
export function resetCalendarCache() {
    _feriesParAnnee.clear();
}

/** Le jour est-il ouvre ? */
export function isWorkingDay(date, calendar = defaultCalendar()) {
    const d = parseISO(date);
    if (isNaN(d.getTime())) return false;

    const jours = calendar.workingDays && calendar.workingDays.length
        ? calendar.workingDays : [1, 2, 3, 4, 5];
    if (!jours.includes(d.getDay())) return false;

    const iso = formatDateISO(d);
    if (feriesPersonnalises(calendar).has(iso)) return false;
    return !feriesFrancaisAnnee(calendar, d.getFullYear()).has(iso);
}

/** Premier jour ouvre a partir de `date` (incluse). */
export function nextWorkingDay(date, calendar = defaultCalendar()) {
    const d = parseISO(date);
    let garde = 0;
    while (!isWorkingDay(d, calendar)) {
        d.setDate(d.getDate() + 1);
        if (++garde > 400) return d;   // calendrier sans aucun jour ouvre
    }
    return d;
}

/** Dernier jour ouvre jusqu'a `date` (incluse), en reculant. */
export function previousWorkingDay(date, calendar = defaultCalendar()) {
    const d = parseISO(date);
    let garde = 0;
    while (!isWorkingDay(d, calendar)) {
        d.setDate(d.getDate() - 1);
        if (++garde > 400) return d;
    }
    return d;
}

/** Ajoute `n` jours OUVRES a une date. n peut etre negatif.
 *  n = 0 renvoie le jour ouvre courant (avance si necessaire). */
export function addWorkingDays(date, n, calendar = defaultCalendar()) {
    const pas = n < 0 ? -1 : 1;
    let restant = Math.abs(Math.trunc(n));
    const d = pas > 0 ? nextWorkingDay(date, calendar) : previousWorkingDay(date, calendar);

    let garde = 0;
    while (restant > 0) {
        d.setDate(d.getDate() + pas);
        if (isWorkingDay(d, calendar)) restant--;
        if (++garde > 100000) break;
    }
    return d;
}

/** Nombre de jours OUVRES entre deux dates, bornes incluses.
 *  Une tache d'un seul jour ouvre renvoie 1. */
export function workingDaysBetween(start, end, calendar = defaultCalendar()) {
    const s = parseISO(start);
    const e = parseISO(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    let n = 0;
    const cur = new Date(s);
    let garde = 0;
    while (cur <= e) {
        if (isWorkingDay(cur, calendar)) n++;
        cur.setDate(cur.getDate() + 1);
        if (++garde > 100000) break;
    }
    return n;
}

/**
 * Echappe les caracteres speciaux HTML.
 *
 * POURQUOI : aucune fonction d'echappement partagee n'existait. Seul
 * collaboration-ui.js en avait une copie privee (_escape), et le reste
 * du code injectait directement dans innerHTML. Un message d'erreur
 * Postgres, un nom de projet ou de tache contenant du balisage etait
 * donc interprete par le navigateur.
 *
 * A utiliser SYSTEMATIQUEMENT des qu'une donnee non maitrisee entre
 * dans un template destine a innerHTML. Quand c'est possible, preferer
 * textContent, qui n'interprete rien par construction.
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ============================================================
   Journal des erreurs de synchronisation
   ------------------------------------------------------------
   17 echecs etaient .catch(() => {}) : aucune trace, nulle part.
   On a deja vu ce que ca cause deux fois dans cette session —
   l'application continuant sur des donnees fausses sans le
   signaler. Ce module donne un endroit UNIQUE et testable pour
   les tracer, sans casser le comportement existant (l'action
   principale continue meme si la synchronisation echoue : c'est
   voulu, l'utilisateur ne doit pas perdre son travail local a
   cause d'un probleme reseau passager).
   ============================================================ */

const MAX_ENTRIES = 30;

/** Cree un journal independant (utilise par le store, teste isolement). */
export function createSyncLog() {
    const entries = [];
    const listeners = new Set();

    return {
        /** Enregistre un echec. Toujours en console (visible en debogage),
         *  dans un tampon borne (consultable via store.getSyncErrors()),
         *  et notifie les abonnes — c'est ce qui alimente l'icone
         *  discrete de la barre d'outils sans qu'elle ait a sonder le
         *  journal en boucle. */
        record(scope, err) {
            const entry = {
                scope,
                message: err?.message || String(err),
                at: new Date().toISOString(),
            };
            entries.push(entry);
            if (entries.length > MAX_ENTRIES) entries.shift();
            console.warn(`[sync] ${scope} : ${entry.message}`);
            listeners.forEach(fn => { try { fn(entry); } catch { /* abonne defaillant : ignore */ } });
            return entry;
        },

        /** S'abonne aux nouvelles erreurs. Retourne une fonction de
         *  desabonnement. */
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },

        /** Dernieres erreurs, les plus recentes en premier. */
        recent(n = MAX_ENTRIES) {
            return entries.slice(-n).reverse();
        },

        count() {
            return entries.length;
        },

        clear() {
            entries.length = 0;
        },
    };
}

/* Instance partagee : un seul journal pour toute l'application. */
export const syncLog = createSyncLog();
