/* ========================================
   UTILITIES - Gantt Planner Pro
   ======================================== */

/**
 * Generate a unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/* ---- Date Utilities ---- */

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDateISO(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format a date for display (e.g. "15 Mar 2025")
 */
export function formatDateDisplay(date) {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Format a short date (e.g. "15 Mar")
 */
export function formatDateShort(date) {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Calculate the number of business days between two dates
 */
export function businessDaysBetween(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
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
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date
 */
export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Get the Monday of the week containing the given date
 */
export function getWeekStart(date) {
    const d = new Date(date);
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
    const d = new Date(date);
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
    const endDate = new Date(end);
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
    const endDate = new Date(end);
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
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
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
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date) {
    const d = new Date(date);
    return d.getDay() === 0 || d.getDay() === 6;
}

/**
 * Get the ISO week number
 */
export function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Get month name in French
 */
export function getMonthName(date) {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { month: 'long' });
}

/**
 * Get day name in French (short)
 */
export function getDayName(date) {
    const d = new Date(date);
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
 * Format a value with the current currency symbol
 */
export function formatCurrency(value) {
    const c = getCurrencyConfig();
    const num = value === 0 ? '0'
        : value >= 1000 ? (value / 1000).toFixed(1) + 'k'
        : Math.round(value).toString();
    return c.position === 'before'
        ? c.symbol + (c.space ? ' ' : '') + num
        : num + (c.space ? ' ' : '') + c.symbol;
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
