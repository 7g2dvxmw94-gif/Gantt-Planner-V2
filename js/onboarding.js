/* ========================================
   ONBOARDING - Interactive guide for new users
   ======================================== */

const ONBOARDING_STORAGE_KEY = 'gantt_onboarding_done';

const STEPS = [
    {
        target: '.project-selector',
        title: 'Vos projets',
        text: 'Cliquez ici pour basculer entre vos projets, en créer, dupliquer ou supprimer.',
        position: 'bottom',
    },
    {
        target: '.tabs',
        title: 'Vues du projet',
        text: 'Timeline, Tableau Kanban, Ressources, Dashboard et Coûts : naviguez entre les différentes vues.',
        position: 'bottom',
    },
    {
        target: '#addTaskBtn',
        title: 'Ajouter une tâche',
        text: 'Créez une tâche, un jalon ou une phase.',
        position: 'bottom',
    },
    {
        target: '.gantt-wrapper',
        title: 'Diagramme de Gantt',
        text: 'Glissez les barres pour déplacer les tâches, étirez les bords pour changer les dates. Sur mobile, pincez pour zoomer.',
        position: 'top',
    },
    {
        target: '.zoom-controls',
        title: 'Niveau de zoom',
        text: 'Passez de la vue Jour à Trimestre pour ajuster la granularité.',
        position: 'bottom',
    },
    {
        target: '#exportBtn',
        title: 'Import / Export',
        text: 'Exportez en JSON, CSV, XML MS Project ou Excel. Importez depuis ces mêmes formats.',
        position: 'bottom',
    },
];

class Onboarding {
    constructor() {
        this._overlay = null;
        this._step = 0;
        this._active = false;
    }

    /** Auto-start on first visit, or call manually */
    tryAutoStart() {
        if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
        // Defer so the UI is fully rendered
        setTimeout(() => this.start(), 600);
    }

    start() {
        this._step = 0;
        this._active = true;
        this._buildOverlay();
        this._showStep();
    }

    _buildOverlay() {
        if (this._overlay) this._overlay.remove();

        this._overlay = document.createElement('div');
        this._overlay.className = 'onboarding-overlay';
        this._overlay.setAttribute('role', 'dialog');
        this._overlay.setAttribute('aria-modal', 'true');
        this._overlay.setAttribute('aria-label', 'Guide de démarrage');

        // Spotlight hole (SVG mask)
        this._overlay.innerHTML = `
            <svg class="onboarding-mask" width="100%" height="100%">
                <defs>
                    <mask id="onboardingMask">
                        <rect width="100%" height="100%" fill="white"/>
                        <rect id="onboardingHole" rx="8" ry="8" fill="black"/>
                    </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,.55)" mask="url(#onboardingMask)"/>
            </svg>
        `;

        // Tooltip
        this._tooltip = document.createElement('div');
        this._tooltip.className = 'onboarding-tooltip';
        this._tooltip.innerHTML = `
            <div class="onboarding-title"></div>
            <div class="onboarding-text"></div>
            <div class="onboarding-footer">
                <span class="onboarding-counter"></span>
                <div class="onboarding-btns">
                    <button class="onboarding-skip">Passer</button>
                    <button class="onboarding-next">Suivant</button>
                </div>
            </div>
        `;
        this._overlay.appendChild(this._tooltip);

        this._tooltip.querySelector('.onboarding-skip').addEventListener('click', () => this._finish());
        this._tooltip.querySelector('.onboarding-next').addEventListener('click', () => this._next());

        document.addEventListener('keydown', this._onKey = (e) => {
            if (!this._active) return;
            if (e.key === 'Escape') this._finish();
            if (e.key === 'ArrowRight' || e.key === 'Enter') this._next();
            if (e.key === 'ArrowLeft') this._prev();
            // Let app keyboard shortcuts work by closing the overlay
            if ((e.ctrlKey || e.metaKey) && e.key.length === 1) this._finish();
        });

        document.body.appendChild(this._overlay);
    }

    _showStep() {
        const step = STEPS[this._step];
        if (!step) { this._finish(); return; }

        const target = document.querySelector(step.target);
        // If target not visible (e.g. hidden on mobile), skip
        if (!target || target.offsetParent === null) {
            this._step++;
            if (this._step < STEPS.length) this._showStep();
            else this._finish();
            return;
        }

        // Scroll target into view so that the tooltip has room to display
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Wait for scroll to settle then position everything
        const _position = () => {
            const rect = target.getBoundingClientRect();
            const pad = 6;

            // Position spotlight hole
            const hole = this._overlay.querySelector('#onboardingHole');
            hole.setAttribute('x', rect.left - pad);
            hole.setAttribute('y', rect.top - pad);
            hole.setAttribute('width', rect.width + pad * 2);
            hole.setAttribute('height', rect.height + pad * 2);

            // Update tooltip content
            this._tooltip.querySelector('.onboarding-title').textContent = step.title;
            this._tooltip.querySelector('.onboarding-text').textContent = step.text;
            this._tooltip.querySelector('.onboarding-counter').textContent = `${this._step + 1} / ${STEPS.length}`;

            const nextBtn = this._tooltip.querySelector('.onboarding-next');
            nextBtn.textContent = this._step === STEPS.length - 1 ? 'Terminer' : 'Suivant';

            // Position tooltip
            const tt = this._tooltip;
            tt.style.left = '';
            tt.style.right = '';
            tt.style.top = '';
            tt.style.bottom = '';
            tt.style.maxHeight = '';
            tt.style.overflowY = '';

            requestAnimationFrame(() => {
                const ttRect = tt.getBoundingClientRect();
                let left = rect.left + rect.width / 2 - ttRect.width / 2;
                left = Math.max(12, Math.min(left, window.innerWidth - ttRect.width - 12));
                tt.style.left = left + 'px';

                let topValue;
                if (step.position === 'bottom') {
                    topValue = rect.bottom + pad + 12;
                } else {
                    // If not enough space above, fall back to bottom positioning
                    const topPos = rect.top - pad - ttRect.height - 12;
                    if (topPos < 12) {
                        topValue = rect.bottom + pad + 12;
                    } else {
                        topValue = topPos;
                    }
                }

                // Ensure the tooltip doesn't overflow below the viewport
                const maxTop = window.innerHeight - ttRect.height - 12;
                if (topValue > maxTop) {
                    topValue = Math.max(12, maxTop);
                    // If still overflowing, constrain tooltip height so buttons stay accessible
                    const available = window.innerHeight - topValue - 12;
                    if (ttRect.height > available) {
                        tt.style.maxHeight = available + 'px';
                        tt.style.overflowY = 'auto';
                    }
                }

                tt.style.top = topValue + 'px';

                nextBtn.focus();
            });
        };

        // Small delay to let scrollIntoView settle
        setTimeout(_position, 350);
    }

    _next() {
        this._step++;
        if (this._step >= STEPS.length) {
            this._finish();
        } else {
            this._showStep();
        }
    }

    _prev() {
        if (this._step > 0) {
            this._step--;
            this._showStep();
        }
    }

    _finish() {
        this._active = false;
        localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
        if (this._overlay) {
            this._overlay.classList.add('fade-out');
            setTimeout(() => {
                if (this._overlay) this._overlay.remove();
                this._overlay = null;
            }, 300);
        }
        if (this._onKey) {
            document.removeEventListener('keydown', this._onKey);
            this._onKey = null;
        }
    }
}

export const onboarding = new Onboarding();
