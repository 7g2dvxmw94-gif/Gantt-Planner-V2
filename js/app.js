/* ========================================
   APP - Main Entry Point
   Gantt Planner Pro
   ======================================== */

import { store } from './store.js';
import { themeManager } from './theme.js';
import { ganttRenderer } from './gantt-renderer.js';
import { taskModal } from './task-modal.js';
import { ganttInteractions } from './gantt-interactions.js';
import { $, $$, debounce } from './utils.js';

class App {
    constructor() {
        this._activeView = 'timeline';
    }

    init() {
        // Initialize theme
        themeManager.init();

        // Initialize Gantt renderer
        ganttRenderer.init();

        // Initialize task modal
        taskModal.init(() => {
            ganttRenderer.render();
            this._renderStats();
            this._showToast('Tâche mise à jour', 'success');
        });

        // Initialize Gantt interactions (drag, resize, click)
        ganttInteractions.init({
            onTaskClick: (taskId) => taskModal.openEdit(taskId),
            onUpdate: () => {
                ganttRenderer.render();
                this._renderStats();
            },
            getColWidth: () => ganttRenderer.zoomConfig[ganttRenderer.zoomLevel]?.colWidth || 50,
            getTimelineStart: () => store.getTimelineRange().start,
        });

        // Bind UI events
        this._bindTabs();
        this._bindToolbar();
        this._bindSearch();
        this._bindMobileNav();
        this._bindZoomControls();
        this._bindKeyboardShortcuts();

        // Render stats
        this._renderStats();

        // Render project name
        this._renderProjectName();

        // Listen for store changes
        store.on('change', () => {
            this._renderStats();
            this._renderProjectName();
        });

        // Announce to screen readers
        this._announceToSR('Gantt Planner Pro chargé');
    }

    /* ---- Tab Navigation ---- */

    _bindTabs() {
        const tabs = $$('.tab[role="tab"]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                if (!view) return;
                this._switchView(view);

                // Update tabs
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            });

            // Keyboard navigation for tabs
            tab.addEventListener('keydown', (e) => {
                const currentIndex = tabs.indexOf(tab);
                let nextIndex;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    nextIndex = (currentIndex + 1) % tabs.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    nextIndex = 0;
                } else if (e.key === 'End') {
                    e.preventDefault();
                    nextIndex = tabs.length - 1;
                }
                if (nextIndex !== undefined) {
                    tabs[nextIndex].focus();
                    tabs[nextIndex].click();
                }
            });
        });
    }

    _switchView(view) {
        this._activeView = view;
        store.updateSettings({ activeView: view });

        const ganttWrapper = $('.gantt-wrapper');
        const boardView = $('#boardView');
        const resourceView = $('#resourceView');

        // Hide all views
        if (ganttWrapper) ganttWrapper.style.display = 'none';
        if (boardView) boardView.style.display = 'none';
        if (resourceView) resourceView.style.display = 'none';

        // Show active view
        switch (view) {
            case 'timeline':
                if (ganttWrapper) ganttWrapper.style.display = '';
                ganttRenderer.render();
                break;
            case 'board':
                if (boardView) {
                    boardView.style.display = '';
                    this._renderBoardView();
                }
                break;
            case 'resources':
                if (resourceView) {
                    resourceView.style.display = '';
                    this._renderResourceView();
                }
                break;
        }

        // Update mobile nav
        $$('.mobile-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
    }

    /* ---- Board View (Placeholder for Step 4) ---- */

    _renderBoardView() {
        const container = $('#boardView');
        if (!container) return;

        const tasks = store.getTasks().filter(t => !t.isPhase);
        const statuses = [
            { key: 'todo', label: 'À faire', color: 'var(--text-muted)' },
            { key: 'in_progress', label: 'En cours', color: 'var(--color-info)' },
            { key: 'done', label: 'Terminé', color: 'var(--color-success)' },
        ];

        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.gap = 'var(--space-4)';
        container.style.padding = 'var(--space-5)';
        container.style.flex = '1';
        container.style.overflow = 'auto';

        statuses.forEach(status => {
            const column = document.createElement('div');
            column.style.cssText = `
                flex: 1; min-width: 250px; background: var(--bg-base);
                border-radius: var(--radius-lg); border: 1px solid var(--border-default);
                padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                display: flex; align-items: center; gap: var(--space-2);
                font-weight: 600; font-size: var(--font-size-sm);
                padding-bottom: var(--space-3); border-bottom: 2px solid ${status.color};
                margin-bottom: var(--space-2);
            `;
            const count = tasks.filter(t => t.status === status.key).length;
            header.textContent = `${status.label} (${count})`;
            column.appendChild(header);

            tasks.filter(t => t.status === status.key).forEach(task => {
                const card = document.createElement('div');
                card.style.cssText = `
                    padding: var(--space-3); background: var(--bg-subtle);
                    border-radius: var(--radius-md); border: 1px solid var(--border-subtle);
                    cursor: pointer; transition: all 150ms ease-out;
                    border-left: 3px solid ${task.color};
                `;
                card.addEventListener('mouseenter', () => {
                    card.style.borderColor = 'var(--border-strong)';
                    card.style.boxShadow = 'var(--shadow-sm)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.borderColor = 'var(--border-subtle)';
                    card.style.boxShadow = 'none';
                });

                const taskName = document.createElement('div');
                taskName.style.cssText = 'font-weight: 500; margin-bottom: var(--space-1);';
                taskName.textContent = task.name;
                card.appendChild(taskName);

                const resource = task.assignee ? store.getResource(task.assignee) : null;
                if (resource) {
                    const meta = document.createElement('div');
                    meta.style.cssText = 'font-size: var(--font-size-xs); color: var(--text-muted);';
                    meta.textContent = `@${resource.name.split(' ')[0]}`;
                    card.appendChild(meta);
                }

                if (task.progress > 0) {
                    const progressBar = document.createElement('div');
                    progressBar.style.cssText = `
                        margin-top: var(--space-2); height: 4px; background: var(--bg-muted);
                        border-radius: var(--radius-full); overflow: hidden;
                    `;
                    const fill = document.createElement('div');
                    fill.style.cssText = `
                        height: 100%; border-radius: var(--radius-full); background: ${task.color};
                        width: ${task.progress}%;
                    `;
                    progressBar.appendChild(fill);
                    card.appendChild(progressBar);
                }

                column.appendChild(card);
            });

            container.appendChild(column);
        });
    }

    /* ---- Resource View (Placeholder for Step 4) ---- */

    _renderResourceView() {
        const container = $('#resourceView');
        if (!container) return;

        const resources = store.getResources();
        const tasks = store.getTasks().filter(t => !t.isPhase);

        container.innerHTML = '';
        container.style.padding = 'var(--space-5)';
        container.style.flex = '1';
        container.style.overflow = 'auto';

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: var(--space-4);
        `;

        resources.forEach(resource => {
            const assignedTasks = tasks.filter(t => t.assignee === resource.id);
            const card = document.createElement('div');
            card.style.cssText = `
                background: var(--bg-base); border-radius: var(--radius-lg);
                border: 1px solid var(--border-default); padding: var(--space-5);
                transition: box-shadow 150ms ease-out;
            `;
            card.addEventListener('mouseenter', () => card.style.boxShadow = 'var(--shadow-md)');
            card.addEventListener('mouseleave', () => card.style.boxShadow = 'none');

            // Header
            const hdr = document.createElement('div');
            hdr.style.cssText = 'display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);';
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.background = `linear-gradient(135deg, ${resource.color}, ${resource.color}dd)`;
            avatar.textContent = resource.avatar;
            hdr.appendChild(avatar);

            const info = document.createElement('div');
            const nameEl = document.createElement('div');
            nameEl.style.cssText = 'font-weight: 600;';
            nameEl.textContent = resource.name;
            info.appendChild(nameEl);
            const roleEl = document.createElement('div');
            roleEl.style.cssText = 'font-size: var(--font-size-xs); color: var(--text-muted);';
            roleEl.textContent = resource.role;
            info.appendChild(roleEl);
            hdr.appendChild(info);
            card.appendChild(hdr);

            // Task list
            const taskCount = document.createElement('div');
            taskCount.style.cssText = 'font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-3);';
            taskCount.textContent = `${assignedTasks.length} tâche${assignedTasks.length > 1 ? 's' : ''} assignée${assignedTasks.length > 1 ? 's' : ''}`;
            card.appendChild(taskCount);

            assignedTasks.forEach(task => {
                const row = document.createElement('div');
                row.style.cssText = `
                    display: flex; align-items: center; justify-content: space-between;
                    padding: var(--space-2) 0; border-top: 1px solid var(--border-subtle);
                    font-size: var(--font-size-sm);
                `;
                const taskNameEl = document.createElement('span');
                taskNameEl.textContent = task.name;
                row.appendChild(taskNameEl);
                const badge = document.createElement('span');
                badge.className = `badge badge-${task.status === 'done' ? 'success' : task.status === 'in_progress' ? 'info' : 'primary'}`;
                badge.textContent = `${task.progress}%`;
                row.appendChild(badge);
                card.appendChild(row);
            });

            grid.appendChild(card);
        });

        container.appendChild(grid);
    }

    /* ---- Toolbar ---- */

    _bindToolbar() {
        const addBtn = $('#addTaskBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this._showAddTaskDialog());
        }

        const exportBtn = $('#exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this._exportProject());
        }
    }

    _showAddTaskDialog() {
        taskModal.openCreate();
    }

    _exportProject() {
        const project = store.getActiveProject();
        const tasks = store.getTasks();
        const resources = store.getResources();

        const data = { project, tasks, resources, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/\s+/g, '_')}_export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this._showToast('Projet exporté avec succès', 'success');
    }

    /* ---- Search ---- */

    _bindSearch() {
        const searchInput = $('#searchInput');
        if (!searchInput) return;

        searchInput.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                // Show all rows
                $$('.gantt-row').forEach(row => row.style.display = '');
                return;
            }

            $$('.gantt-row').forEach(row => {
                const name = row.querySelector('.task-name');
                if (name && name.textContent.toLowerCase().includes(query)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }, 200));
    }

    /* ---- Mobile Nav ---- */

    _bindMobileNav() {
        $$('.mobile-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                if (!view) return;
                this._switchView(view);

                // Sync desktop tabs
                $$('.tab[role="tab"]').forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.view === view);
                    tab.setAttribute('aria-selected', tab.dataset.view === view ? 'true' : 'false');
                });
            });
        });
    }

    /* ---- Zoom Controls ---- */

    _bindZoomControls() {
        const zoomBtns = $$('.zoom-btn[data-zoom]');
        zoomBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const level = btn.dataset.zoom;
                ganttRenderer.setZoom(level);
                ganttRenderer.render();

                // Update active state
                zoomBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update label
                const label = $('.zoom-label');
                if (label) {
                    label.textContent = ganttRenderer.zoomConfig[level]?.label || '';
                }
            });
        });
    }

    /* ---- Keyboard Shortcuts ---- */

    _bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+F: Focus search
            if (e.ctrlKey && e.key === 'f') {
                const searchInput = $('#searchInput');
                if (searchInput) {
                    e.preventDefault();
                    searchInput.focus();
                }
            }

            // Ctrl+N: New task
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this._showAddTaskDialog();
            }

            // Escape: Close modals / clear search
            if (e.key === 'Escape') {
                const searchInput = $('#searchInput');
                if (searchInput && document.activeElement === searchInput) {
                    searchInput.value = '';
                    searchInput.dispatchEvent(new Event('input'));
                    searchInput.blur();
                }
            }

            // 1,2,3: Switch views
            if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                const activeEl = document.activeElement;
                const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                if (!isInput) {
                    if (e.key === '1') this._switchViewByIndex(0);
                    if (e.key === '2') this._switchViewByIndex(1);
                    if (e.key === '3') this._switchViewByIndex(2);
                }
            }
        });
    }

    _switchViewByIndex(index) {
        const views = ['timeline', 'board', 'resources'];
        if (index < views.length) {
            this._switchView(views[index]);
            const tabs = $$('.tab[role="tab"]');
            tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
                tab.setAttribute('aria-selected', i === index ? 'true' : 'false');
            });
        }
    }

    /* ---- Stats ---- */

    _renderStats() {
        const stats = store.getProjectStats();

        const taskCount = $('#statTasks');
        const daysRemaining = $('#statDays');
        const progress = $('#statProgress');
        const budget = $('#statBudget');

        if (taskCount) taskCount.textContent = stats.activeTasks;
        if (daysRemaining) daysRemaining.textContent = stats.daysRemaining;
        if (progress) progress.textContent = stats.progress + '%';
        if (budget) {
            const budgetK = (stats.budgetUsed / 1000).toFixed(1);
            budget.textContent = budgetK + 'k\u20AC';
        }
    }

    /* ---- Project Name ---- */

    _renderProjectName() {
        const nameEl = $('#projectName');
        if (!nameEl) return;
        const project = store.getActiveProject();
        if (project) {
            nameEl.textContent = project.name;
        }
    }

    /* ---- Toast ---- */

    _showToast(message, type = 'info') {
        const container = $('#toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        toast.textContent = message;

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ---- Accessibility ---- */

    _announceToSR(message) {
        const announcer = $('#srAnnouncer');
        if (!announcer) return;
        announcer.textContent = '';
        requestAnimationFrame(() => {
            announcer.textContent = message;
        });
    }
}

/* ---- Bootstrap ---- */
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
