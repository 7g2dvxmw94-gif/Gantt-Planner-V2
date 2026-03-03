/* ========================================
   APP - Main Entry Point
   Gantt Planner Pro
   ======================================== */

import { store } from './store.js';
import { themeManager } from './theme.js';
import { ganttRenderer } from './gantt-renderer.js';
import { taskModal } from './task-modal.js';
import { ganttInteractions } from './gantt-interactions.js';
import { $, $$, debounce, formatDateISO, formatDateDisplay, addDays, daysBetween } from './utils.js';

class App {
    constructor() {
        this._activeView = 'timeline';
        this._showCriticalPath = false;
        this._filters = { status: 'all', assignee: 'all', priority: 'all', dateStart: '', dateEnd: '', search: '' };
        this._tableSortKey = 'name';
        this._tableSortDir = 'asc';
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
        this._bindContextMenu();
        this._bindProjectSelector();
        this._buildFilterBar();

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
                this._applyFiltersToTimeline();
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

    _refreshCurrentView() {
        switch (this._activeView) {
            case 'timeline':
                this._applyFiltersToTimeline();
                break;
            case 'board':
                this._renderBoardView();
                break;
            case 'resources':
                this._renderResourceView();
                break;
        }
    }

    /* ---- Board / Table View (Vue Tableau) ---- */

    _getFilteredTasks(includePhases = false) {
        let tasks = store.getTasks();
        const { status, assignee, priority, dateStart, dateEnd, search } = this._filters;

        return tasks.filter(task => {
            if (!includePhases && task.isPhase) return false;
            if (task.isPhase) return true;

            if (status !== 'all' && task.status !== status) return false;

            if (assignee === 'none') {
                const assigneeIds = task.assignees || (task.assignee ? [task.assignee] : []);
                if (assigneeIds.length > 0) return false;
            } else if (assignee !== 'all') {
                const assigneeIds = task.assignees || (task.assignee ? [task.assignee] : []);
                if (!assigneeIds.includes(assignee)) return false;
            }

            if (priority !== 'all' && task.priority !== priority) return false;

            if (dateStart && new Date(task.endDate) < new Date(dateStart)) return false;
            if (dateEnd && new Date(task.startDate) > new Date(dateEnd)) return false;

            if (search) {
                const q = search.toLowerCase();
                const nameMatch = task.name.toLowerCase().includes(q);
                const descMatch = (task.description || '').toLowerCase().includes(q);
                const assigneeMatch = (task.assignees || []).some(id => {
                    const r = store.getResource(id);
                    return r && r.name.toLowerCase().includes(q);
                });
                if (!nameMatch && !descMatch && !assigneeMatch) return false;
            }

            return true;
        });
    }

    _renderBoardView() {
        const container = $('#boardView');
        if (!container) return;

        const tasks = this._getFilteredTasks(false);
        container.innerHTML = '';
        container.className = 'table-view';

        // Sort tasks
        const sorted = [...tasks].sort((a, b) => {
            const dir = this._tableSortDir === 'asc' ? 1 : -1;
            const key = this._tableSortKey;
            let va, vb;

            switch (key) {
                case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
                case 'startDate': va = a.startDate; vb = b.startDate; break;
                case 'endDate': va = a.endDate; vb = b.endDate; break;
                case 'status': va = a.status; vb = b.status; break;
                case 'priority': {
                    const po = { high: 0, medium: 1, low: 2 };
                    va = po[a.priority] ?? 1; vb = po[b.priority] ?? 1; break;
                }
                case 'progress': va = a.progress; vb = b.progress; break;
                case 'assignees': {
                    const na = (a.assignees || []).map(id => store.getResource(id)?.name || '').join(',');
                    const nb = (b.assignees || []).map(id => store.getResource(id)?.name || '').join(',');
                    va = na.toLowerCase(); vb = nb.toLowerCase(); break;
                }
                default: va = a.name.toLowerCase(); vb = b.name.toLowerCase();
            }
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });

        if (sorted.length === 0) {
            container.innerHTML = '<div class="table-empty">Aucune tâche ne correspond aux filtres sélectionnés.</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'task-table';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const columns = [
            { key: 'name', label: 'Tâche' },
            { key: 'startDate', label: 'Début' },
            { key: 'endDate', label: 'Fin' },
            { key: 'assignees', label: 'Assigné(s)' },
            { key: 'status', label: 'Statut' },
            { key: 'priority', label: 'Priorité' },
            { key: 'progress', label: 'Progression' },
        ];

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            th.className = 'sortable';
            if (this._tableSortKey === col.key) {
                th.classList.add(this._tableSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
            }
            th.addEventListener('click', () => {
                if (this._tableSortKey === col.key) {
                    this._tableSortDir = this._tableSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._tableSortKey = col.key;
                    this._tableSortDir = 'asc';
                }
                this._renderBoardView();
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const statusLabels = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
        const priorityLabels = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };
        const tbody = document.createElement('tbody');

        sorted.forEach(task => {
            const row = document.createElement('tr');
            row.dataset.taskId = task.id;
            row.addEventListener('click', () => taskModal.openEdit(task.id));

            // Name
            const tdName = document.createElement('td');
            const nameWrap = document.createElement('div');
            nameWrap.className = 'table-task-name';
            const colorBar = document.createElement('span');
            colorBar.className = 'table-task-color';
            colorBar.style.background = task.color;
            nameWrap.appendChild(colorBar);
            const nameText = document.createElement('span');
            nameText.textContent = task.name;
            nameWrap.appendChild(nameText);
            tdName.appendChild(nameWrap);
            // Show phase name
            if (task.parentId) {
                const phase = store.getTask(task.parentId);
                if (phase) {
                    const phaseLabel = document.createElement('div');
                    phaseLabel.className = 'table-task-phase';
                    phaseLabel.textContent = phase.name;
                    tdName.appendChild(phaseLabel);
                }
            }
            row.appendChild(tdName);

            // Start Date
            const tdStart = document.createElement('td');
            tdStart.textContent = formatDateDisplay(task.startDate);
            row.appendChild(tdStart);

            // End Date
            const tdEnd = document.createElement('td');
            tdEnd.textContent = formatDateDisplay(task.endDate);
            row.appendChild(tdEnd);

            // Assignees
            const tdAssignees = document.createElement('td');
            const assignees = (task.assignees || []).map(id => store.getResource(id)).filter(Boolean);
            if (assignees.length) {
                const wrap = document.createElement('div');
                wrap.className = 'table-assignees';
                assignees.forEach(r => {
                    const chip = document.createElement('span');
                    chip.className = 'table-assignee-chip';
                    const dot = document.createElement('span');
                    dot.className = 'table-assignee-dot';
                    dot.style.background = r.color;
                    chip.appendChild(dot);
                    chip.appendChild(document.createTextNode(r.name.split(' ')[0]));
                    wrap.appendChild(chip);
                });
                tdAssignees.appendChild(wrap);
            } else {
                tdAssignees.textContent = '—';
                tdAssignees.style.color = 'var(--text-muted)';
            }
            row.appendChild(tdAssignees);

            // Status
            const tdStatus = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = `badge-status-${task.status}`;
            statusBadge.textContent = statusLabels[task.status] || task.status;
            tdStatus.appendChild(statusBadge);
            row.appendChild(tdStatus);

            // Priority
            const tdPriority = document.createElement('td');
            const priorityBadge = document.createElement('span');
            priorityBadge.className = `badge-priority-${task.priority}`;
            priorityBadge.textContent = priorityLabels[task.priority] || task.priority;
            tdPriority.appendChild(priorityBadge);
            row.appendChild(tdPriority);

            // Progress
            const tdProgress = document.createElement('td');
            const progressWrap = document.createElement('div');
            progressWrap.className = 'table-progress';
            const track = document.createElement('div');
            track.className = 'table-progress-track';
            const bar = document.createElement('div');
            bar.className = 'table-progress-bar';
            bar.style.width = task.progress + '%';
            bar.style.background = task.color;
            track.appendChild(bar);
            progressWrap.appendChild(track);
            const label = document.createElement('span');
            label.className = 'table-progress-label';
            label.textContent = task.progress + '%';
            progressWrap.appendChild(label);
            tdProgress.appendChild(progressWrap);
            row.appendChild(tdProgress);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.appendChild(table);
    }

    /* ---- Resource View (Vue Ressources) ---- */

    _calculateResourceWorkload(resource, assignedTasks) {
        if (assignedTasks.length === 0) return { percent: 0, concurrent: 0 };

        const project = store.getActiveProject();
        if (!project) return { percent: 0, concurrent: 0 };

        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);

        let totalWorkDays = 0;
        let allocatedDays = 0;
        let maxConcurrent = 0;

        const current = new Date(projectStart);
        while (current <= projectEnd) {
            const day = current.getDay();
            if (day !== 0 && day !== 6) {
                totalWorkDays++;
                const active = assignedTasks.filter(t => {
                    const ts = new Date(t.startDate);
                    const te = new Date(t.endDate);
                    return current >= ts && current <= te;
                }).length;
                allocatedDays += active;
                if (active > maxConcurrent) maxConcurrent = active;
            }
            current.setDate(current.getDate() + 1);
        }

        const percent = totalWorkDays > 0 ? Math.round((allocatedDays / totalWorkDays) * 100) : 0;
        return { percent, concurrent: maxConcurrent, totalWorkDays, allocatedDays };
    }

    _renderResourceView() {
        const container = $('#resourceView');
        if (!container) return;

        const resources = store.getResources();
        const allTasks = this._getFilteredTasks(false);

        container.innerHTML = '';
        container.className = 'resource-view';

        if (resources.length === 0) {
            container.innerHTML = '<div class="table-empty">Aucune ressource disponible.</div>';
            return;
        }

        resources.forEach(resource => {
            const assignedTasks = allTasks.filter(t =>
                (t.assignees || []).includes(resource.id) || t.assignee === resource.id
            );

            const workload = this._calculateResourceWorkload(resource, assignedTasks);

            const card = document.createElement('div');
            card.className = 'resource-card';

            // Header
            const header = document.createElement('div');
            header.className = 'resource-card-header';
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.background = `linear-gradient(135deg, ${resource.color}, ${resource.color}dd)`;
            avatar.textContent = resource.avatar;
            header.appendChild(avatar);

            const info = document.createElement('div');
            info.className = 'resource-card-info';
            const nameEl = document.createElement('div');
            nameEl.className = 'resource-card-name';
            nameEl.textContent = resource.name;
            info.appendChild(nameEl);
            const roleEl = document.createElement('div');
            roleEl.className = 'resource-card-role';
            roleEl.textContent = resource.role;
            info.appendChild(roleEl);
            header.appendChild(info);

            const countBadge = document.createElement('div');
            countBadge.className = 'resource-card-count';
            countBadge.textContent = `${assignedTasks.length} tâche${assignedTasks.length !== 1 ? 's' : ''}`;
            header.appendChild(countBadge);
            card.appendChild(header);

            // Workload bar
            const workloadSection = document.createElement('div');
            workloadSection.className = 'resource-workload';

            const workloadHeader = document.createElement('div');
            workloadHeader.className = 'resource-workload-header';
            const workloadLabel = document.createElement('span');
            workloadLabel.textContent = 'Charge de travail';
            workloadHeader.appendChild(workloadLabel);
            const workloadValue = document.createElement('span');
            workloadValue.textContent = workload.percent + '%';
            if (workload.percent > 100) workloadValue.className = 'overload';
            workloadHeader.appendChild(workloadValue);
            workloadSection.appendChild(workloadHeader);

            const workloadTrack = document.createElement('div');
            workloadTrack.className = 'resource-workload-track';
            const workloadFill = document.createElement('div');
            workloadFill.className = 'resource-workload-fill';
            if (workload.percent > 100) workloadFill.classList.add('overload');
            else if (workload.percent > 80) workloadFill.classList.add('warning');
            workloadFill.style.width = Math.min(workload.percent, 100) + '%';
            workloadTrack.appendChild(workloadFill);
            workloadSection.appendChild(workloadTrack);

            if (workload.percent > 100) {
                const warning = document.createElement('div');
                warning.className = 'resource-overload-warning';
                warning.textContent = 'Surcharge détectée (' + workload.concurrent + ' tâches simultanées)';
                workloadSection.appendChild(warning);
            }

            card.appendChild(workloadSection);

            // Task list
            if (assignedTasks.length > 0) {
                const taskList = document.createElement('div');
                taskList.className = 'resource-task-list';

                assignedTasks.forEach(task => {
                    const item = document.createElement('div');
                    item.className = 'resource-task-item';
                    item.dataset.taskId = task.id;

                    const colorDot = document.createElement('span');
                    colorDot.className = 'resource-task-color';
                    colorDot.style.background = task.color;
                    item.appendChild(colorDot);

                    const taskName = document.createElement('span');
                    taskName.className = 'resource-task-name';
                    taskName.textContent = task.name;
                    item.appendChild(taskName);

                    const dates = document.createElement('span');
                    dates.className = 'resource-task-dates';
                    const daysLeft = daysBetween(new Date(), task.endDate);
                    if (task.status === 'done') {
                        dates.textContent = 'Terminé';
                    } else if (daysLeft < 0) {
                        dates.textContent = 'En retard';
                        dates.style.color = '#EF4444';
                    } else {
                        dates.textContent = daysLeft + 'j';
                    }
                    item.appendChild(dates);

                    const badge = document.createElement('span');
                    badge.className = `badge-status-${task.status}`;
                    badge.textContent = task.progress + '%';
                    item.appendChild(badge);

                    item.addEventListener('click', () => taskModal.openEdit(task.id));
                    taskList.appendChild(item);
                });

                card.appendChild(taskList);
            }

            container.appendChild(card);
        });
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

        const importBtn = $('#importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this._importProject());
        }

        const criticalPathBtn = $('#criticalPathBtn');
        if (criticalPathBtn) {
            criticalPathBtn.addEventListener('click', () => this._toggleCriticalPath());
        }

        const undoBtn = $('#undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (store.undo()) {
                    ganttRenderer.render();
                    this._renderStats();
                    this._renderProjectName();
                    this._showToast('Action annulée', 'info');
                }
            });
        }

        const redoBtn = $('#redoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                if (store.redo()) {
                    ganttRenderer.render();
                    this._renderStats();
                    this._renderProjectName();
                    this._showToast('Action rétablie', 'info');
                }
            });
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
            this._filters.search = e.target.value.toLowerCase().trim();
            this._refreshCurrentView();
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
            // Ctrl+Z: Undo
            if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                if (store.undo()) {
                    ganttRenderer.render();
                    this._renderStats();
                    this._renderProjectName();
                    this._showToast('Action annulée', 'info');
                }
                return;
            }

            // Ctrl+Y or Ctrl+Shift+Z: Redo
            if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
                e.preventDefault();
                if (store.redo()) {
                    ganttRenderer.render();
                    this._renderStats();
                    this._renderProjectName();
                    this._showToast('Action rétablie', 'info');
                }
                return;
            }

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

            // Escape: Close modals / clear search / close context menu
            if (e.key === 'Escape') {
                this._closeContextMenu();
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

        // Bind double-click to rename (only once)
        if (!nameEl._renamebound) {
            nameEl._renamebound = true;
            nameEl.style.cursor = 'pointer';
            nameEl.title = 'Double-cliquer pour renommer';
            nameEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this._startProjectRename();
            });
        }
    }

    _startProjectRename() {
        const nameEl = $('#projectName');
        if (!nameEl) return;
        const project = store.getActiveProject();
        if (!project) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = project.name;
        input.className = 'project-rename-input';
        input.style.width = '180px';

        nameEl.textContent = '';
        nameEl.appendChild(input);
        input.focus();
        input.select();

        const finish = (save) => {
            if (input._done) return;
            input._done = true;
            const newName = input.value.trim();
            if (save && newName && newName !== project.name) {
                store.updateProject(project.id, { name: newName });
                this._showToast('Projet renommé', 'success');
            }
            this._renderProjectName();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
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

    /* ---- Import ---- */

    _importProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const result = store.importProject(evt.target.result);
                if (result) {
                    ganttRenderer.render();
                    this._renderStats();
                    this._renderProjectName();
                    this._showToast(`Projet "${result.name}" importé`, 'success');
                } else {
                    this._showToast('Erreur lors de l\'import', 'error');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    /* ---- Critical Path ---- */

    _toggleCriticalPath() {
        this._showCriticalPath = !this._showCriticalPath;
        const btn = $('#criticalPathBtn');
        if (btn) btn.classList.toggle('active', this._showCriticalPath);

        if (this._showCriticalPath) {
            ganttRenderer.setCriticalPath(store.getCriticalPath());
            this._showToast('Chemin critique affiché', 'info');
        } else {
            ganttRenderer.setCriticalPath(null);
            this._showToast('Chemin critique masqué', 'info');
        }
        ganttRenderer.render();
    }

    /* ---- Context Menu ---- */

    _bindContextMenu() {
        const container = document.getElementById('ganttContainer');
        if (!container) return;

        container.addEventListener('contextmenu', (e) => {
            const row = e.target.closest('.gantt-row');
            const bar = e.target.closest('.gantt-bar, .gantt-milestone');
            if (!row && !bar) return;

            e.preventDefault();
            const taskId = bar?.dataset.taskId || row?.dataset.taskId;
            if (!taskId) return;

            this._showContextMenu(e.clientX, e.clientY, taskId);
        });

        // Close context menu on click outside
        document.addEventListener('click', () => this._closeContextMenu());
    }

    _showContextMenu(x, y, taskId) {
        this._closeContextMenu();

        const task = store.getTask(taskId);
        if (!task) return;

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.id = 'ctxMenu';

        const items = [
            { label: 'Modifier', icon: 'edit', action: () => taskModal.openEdit(taskId) },
            { label: 'Dupliquer', icon: 'copy', action: () => this._duplicateTask(taskId) },
            { label: 'divider' },
            { label: 'Marquer terminé', icon: 'check', action: () => this._markDone(taskId), hide: task.status === 'done' },
            { label: 'Marquer en cours', icon: 'play', action: () => this._markInProgress(taskId), hide: task.status === 'in_progress' },
            { label: 'divider' },
            { label: 'Supprimer', icon: 'trash', action: () => this._deleteTask(taskId), danger: true },
        ];

        items.forEach(item => {
            if (item.hide) return;
            if (item.label === 'divider') {
                menu.appendChild(document.createElement('hr'));
                return;
            }
            const btn = document.createElement('button');
            btn.className = 'context-menu-item' + (item.danger ? ' danger' : '');
            btn.innerHTML = `<span>${item.label}</span>`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._closeContextMenu();
                item.action();
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);

        // Reposition if out of viewport
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
            if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
        });
    }

    _closeContextMenu() {
        const existing = document.getElementById('ctxMenu');
        if (existing) existing.remove();
    }

    _duplicateTask(taskId) {
        const task = store.getTask(taskId);
        if (!task) return;
        const { id, createdAt, updatedAt, ...data } = task;
        data.name = task.name + ' (copie)';
        data.dependencies = [];
        store.addTask(data);
        ganttRenderer.render();
        this._renderStats();
        this._showToast('Tâche dupliquée', 'success');
    }

    _markDone(taskId) {
        store.updateTask(taskId, { status: 'done', progress: 100 });
        ganttRenderer.render();
        this._renderStats();
        this._showToast('Tâche terminée', 'success');
    }

    _markInProgress(taskId) {
        store.updateTask(taskId, { status: 'in_progress' });
        ganttRenderer.render();
        this._renderStats();
    }

    _deleteTask(taskId) {
        const task = store.getTask(taskId);
        if (!task) return;
        if (confirm(`Supprimer "${task.name}" ?`)) {
            store.deleteTask(taskId);
            ganttRenderer.render();
            this._renderStats();
            this._showToast('Tâche supprimée', 'success');
        }
    }

    /* ---- Filter Bar ---- */

    _buildFilterBar() {
        const mainContainer = $('.main-container');
        const content = $('#mainContent');
        if (!mainContainer || !content) return;

        const filterBar = document.createElement('div');
        filterBar.className = 'filter-bar';
        filterBar.id = 'filterBar';

        // Filter icon
        const filterIcon = document.createElement('span');
        filterIcon.className = 'filter-bar-icon';
        filterIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
        filterBar.appendChild(filterIcon);

        // Status filter
        const statusGroup = this._createFilterGroup('Statut', 'filterStatus', [
            { value: 'all', label: 'Tous' },
            { value: 'todo', label: 'À faire' },
            { value: 'in_progress', label: 'En cours' },
            { value: 'done', label: 'Terminé' },
        ]);
        filterBar.appendChild(statusGroup);

        // Separator
        filterBar.appendChild(this._createFilterSep());

        // Assignee filter
        const assigneeGroup = document.createElement('div');
        assigneeGroup.className = 'filter-group';
        const assigneeLabel = document.createElement('label');
        assigneeLabel.className = 'filter-label';
        assigneeLabel.textContent = 'Ressource';
        assigneeGroup.appendChild(assigneeLabel);
        const assigneeSel = document.createElement('select');
        assigneeSel.className = 'select filter-select';
        assigneeSel.id = 'filterAssignee';
        this._populateAssigneeFilter(assigneeSel);
        assigneeSel.addEventListener('change', () => this._applyFilters());
        assigneeGroup.appendChild(assigneeSel);
        filterBar.appendChild(assigneeGroup);

        // Separator
        filterBar.appendChild(this._createFilterSep());

        // Priority filter
        const priorityGroup = this._createFilterGroup('Priorité', 'filterPriority', [
            { value: 'all', label: 'Toutes' },
            { value: 'high', label: 'Haute' },
            { value: 'medium', label: 'Moyenne' },
            { value: 'low', label: 'Basse' },
        ]);
        filterBar.appendChild(priorityGroup);

        // Separator
        filterBar.appendChild(this._createFilterSep());

        // Date range
        const dateGroup = document.createElement('div');
        dateGroup.className = 'filter-group';
        const dateLabel = document.createElement('label');
        dateLabel.className = 'filter-label';
        dateLabel.textContent = 'Période';
        dateGroup.appendChild(dateLabel);

        const dateInputs = document.createElement('div');
        dateInputs.className = 'filter-date-range';

        const dateStart = document.createElement('input');
        dateStart.type = 'date';
        dateStart.className = 'filter-date';
        dateStart.id = 'filterDateStart';
        dateStart.title = 'Les tâches terminées avant cette date seront masquées';
        dateStart.addEventListener('change', () => this._applyFilters());

        const dateSep = document.createElement('span');
        dateSep.className = 'filter-date-sep';
        dateSep.textContent = '→';

        const dateEnd = document.createElement('input');
        dateEnd.type = 'date';
        dateEnd.className = 'filter-date';
        dateEnd.id = 'filterDateEnd';
        dateEnd.title = 'Les tâches commençant après cette date seront masquées';
        dateEnd.addEventListener('change', () => this._applyFilters());

        dateInputs.appendChild(dateStart);
        dateInputs.appendChild(dateSep);
        dateInputs.appendChild(dateEnd);
        dateGroup.appendChild(dateInputs);
        filterBar.appendChild(dateGroup);

        // Spacer
        const spacer = document.createElement('div');
        spacer.className = 'filter-spacer';
        filterBar.appendChild(spacer);

        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'filter-reset-btn';
        resetBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Réinitialiser';
        resetBtn.title = 'Réinitialiser tous les filtres';
        resetBtn.addEventListener('click', () => this._resetFilters());
        filterBar.appendChild(resetBtn);

        mainContainer.insertBefore(filterBar, content);
    }

    _createFilterGroup(labelText, selectId, options) {
        const group = document.createElement('div');
        group.className = 'filter-group';
        const label = document.createElement('label');
        label.className = 'filter-label';
        label.textContent = labelText;
        group.appendChild(label);
        const select = document.createElement('select');
        select.className = 'select filter-select';
        select.id = selectId;
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            select.appendChild(o);
        });
        select.addEventListener('change', () => this._applyFilters());
        group.appendChild(select);
        return group;
    }

    _createFilterSep() {
        const sep = document.createElement('div');
        sep.className = 'filter-sep';
        return sep;
    }

    _populateAssigneeFilter(select) {
        const resources = store.getResources();
        select.innerHTML = '<option value="all">Toutes les ressources</option><option value="none">Non assigné</option>';
        resources.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            select.appendChild(opt);
        });
    }

    _applyFilters() {
        this._filters.status = $('#filterStatus')?.value || 'all';
        this._filters.assignee = $('#filterAssignee')?.value || 'all';
        this._filters.priority = $('#filterPriority')?.value || 'all';
        this._filters.dateStart = $('#filterDateStart')?.value || '';
        this._filters.dateEnd = $('#filterDateEnd')?.value || '';

        this._refreshCurrentView();
    }

    _resetFilters() {
        this._filters = { status: 'all', assignee: 'all', priority: 'all', dateStart: '', dateEnd: '', search: '' };

        const filterStatus = $('#filterStatus');
        const filterAssignee = $('#filterAssignee');
        const filterPriority = $('#filterPriority');
        const filterDateStart = $('#filterDateStart');
        const filterDateEnd = $('#filterDateEnd');
        const searchInput = $('#searchInput');

        if (filterStatus) filterStatus.value = 'all';
        if (filterAssignee) filterAssignee.value = 'all';
        if (filterPriority) filterPriority.value = 'all';
        if (filterDateStart) filterDateStart.value = '';
        if (filterDateEnd) filterDateEnd.value = '';
        if (searchInput) searchInput.value = '';

        this._refreshCurrentView();
    }

    _applyFiltersToTimeline() {
        const tasks = this._getFilteredTasks(true);
        const visibleIds = new Set(tasks.map(t => t.id));

        $$('.gantt-row').forEach(row => {
            const taskId = row.dataset.taskId;
            if (!taskId) return;
            const task = store.getTask(taskId);
            if (!task) return;

            if (task.isPhase) {
                // Show phase if any child is visible
                const children = store.getChildTasks(task.id);
                const hasVisibleChild = children.some(c => visibleIds.has(c.id));
                row.style.display = hasVisibleChild ? '' : 'none';
            } else {
                row.style.display = visibleIds.has(taskId) ? '' : 'none';
            }
        });

        ganttRenderer.refreshDependencies();
    }

    /* ---- Project Selector ---- */

    _bindProjectSelector() {
        const btn = $('.project-selector');
        if (!btn) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleProjectDropdown();
        });

        document.addEventListener('click', () => {
            const dd = document.getElementById('projectDropdown');
            if (dd) dd.remove();
        });
    }

    _toggleProjectDropdown() {
        const existing = document.getElementById('projectDropdown');
        if (existing) { existing.remove(); return; }

        const btn = $('.project-selector');
        const rect = btn.getBoundingClientRect();

        const dropdown = document.createElement('div');
        dropdown.id = 'projectDropdown';
        dropdown.className = 'project-dropdown';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 4) + 'px';

        const projects = store.getProjects();
        const activeProject = store.getActiveProject();

        projects.forEach(p => {
            const item = document.createElement('div');
            item.className = 'project-dropdown-item' + (p.id === activeProject.id ? ' active' : '');
            item.dataset.projectId = p.id;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'project-item-name';
            nameSpan.textContent = p.name;
            nameSpan.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;';
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                store.setActiveProject(p.id);
                ganttRenderer.render();
                this._renderStats();
                this._renderProjectName();
                dropdown.remove();
            });
            item.appendChild(nameSpan);

            // Rename (pencil) button
            const renameBtn = document.createElement('button');
            renameBtn.className = 'project-item-action';
            renameBtn.title = 'Renommer';
            renameBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._startDropdownRename(item, p, dropdown);
            });
            item.appendChild(renameBtn);

            item.style.cssText = 'display: flex; align-items: center; gap: 4px;';
            dropdown.appendChild(item);
        });

        // Divider
        dropdown.appendChild(document.createElement('hr'));

        // New project
        const newBtn = document.createElement('button');
        newBtn.className = 'project-dropdown-item new-project';
        newBtn.textContent = '+ Nouveau projet';
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.remove();
            this._createNewProject();
        });
        dropdown.appendChild(newBtn);

        // Delete current project (only if more than one)
        if (projects.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.className = 'project-dropdown-item danger';
            delBtn.textContent = 'Supprimer ce projet';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.remove();
                if (confirm(`Supprimer le projet "${activeProject.name}" ?`)) {
                    store.deleteProject(activeProject.id);
                    ganttRenderer.render();
                    this._renderStats();
                    this._renderProjectName();
                    this._showToast('Projet supprimé', 'success');
                }
            });
            dropdown.appendChild(delBtn);
        }

        document.body.appendChild(dropdown);
    }

    _startDropdownRename(item, project, dropdown) {
        // Replace content with an input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = project.name;
        input.className = 'project-rename-input';

        item.textContent = '';
        item.style.cssText = 'display: flex; align-items: center; padding: 0 var(--space-1);';
        item.appendChild(input);
        input.focus();
        input.select();

        const finish = (save) => {
            if (input._done) return;
            input._done = true;
            const newName = input.value.trim();
            if (save && newName && newName !== project.name) {
                store.updateProject(project.id, { name: newName });
                this._renderProjectName();
                this._showToast('Projet renommé', 'success');
            }
            dropdown.remove();
        };

        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('click', (e) => e.stopPropagation());
    }

    _createNewProject() {
        const name = prompt('Nom du nouveau projet:');
        if (!name || !name.trim()) return;

        const today = new Date();
        const project = store.addProject({
            name: name.trim(),
            description: '',
            startDate: formatDateISO(today),
            endDate: formatDateISO(addDays(today, 90)),
            budget: 0,
            budgetUsed: 0,
        });

        store.setActiveProject(project.id);
        ganttRenderer.render();
        this._renderStats();
        this._renderProjectName();
        this._showToast(`Projet "${project.name}" créé`, 'success');
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
