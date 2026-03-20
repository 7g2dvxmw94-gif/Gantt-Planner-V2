/* ========================================
   APP - Main Entry Point
   Gantt Planner Pro
   ======================================== */

import { store, PERMIT_TYPES, PERMIT_STATUSES, calculatePermitDeadlines } from './store.js';
import { themeManager } from './theme.js';
import { ganttRenderer } from './gantt-renderer.js';
import { taskModal } from './task-modal.js';
import { ganttInteractions } from './gantt-interactions.js';
import { $, $$, debounce, formatDateISO, formatDateDisplay, addDays, daysBetween, formatCurrency, formatRate, getCurrencySymbol, getCurrencyConfig } from './utils.js';
import { onboarding } from './onboarding.js';
import { cloudBackup } from './cloud-backup.js';
import { settingsPanel } from './settings-panel.js';

class App {
    constructor() {
        this._activeView = 'timeline';
        this._showCriticalPath = false;
        this._filters = { status: 'all', assignee: 'all', phase: 'all', priority: 'all', dateStart: '', dateEnd: '', search: '' };
        this._tableSortKey = 'name';
        this._tableSortDir = 'asc';
        this._selectedTaskIds = new Set();
        this._dashboardFilterProjectId = 'all';
        this._costsFilterProjectId = 'all';
    }

    init() {
        // Initialize theme
        themeManager.init();

        // Initialize settings panel
        settingsPanel.init();
        settingsPanel.applyStoredCustomizations();

        // Re-render active view when currency changes
        document.addEventListener('currency-changed', () => {
            this._refreshCurrentView();
            this._renderStats();
        });

        // Initialize Gantt renderer
        ganttRenderer.init();

        // Initialize task modal
        taskModal.init(() => {
            ganttRenderer.render();
            this._renderStats();
            this._refreshCurrentView();
            this._showToast('Tâche mise à jour', 'success');
        });

        // Initialize Gantt interactions (drag, resize, click)
        ganttInteractions.init({
            onTaskClick: (taskId) => taskModal.openEdit(taskId),
            onUpdate: () => {
                ganttRenderer.render();
                this._renderStats();
            },
            getColWidth: () => ganttRenderer.effectiveColWidth || 50,
            getTimelineStart: () => store.getTimelineRange().start,
            onPinchZoom: (direction) => this._handlePinchZoom(direction),
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
        this._bindNotifications();
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

        // Onboarding for new users
        onboarding.tryAutoStart();
    }

    /* ---- Tab Navigation ---- */

    _bindTabs() {
        const tabs = $$('.tab[role="tab"]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                if (!view) return;
                this._clearSelection();
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
        const dashboardView = $('#dashboardView');
        const costsView = $('#costsView');

        // Hide all views
        if (ganttWrapper) ganttWrapper.style.display = 'none';
        if (boardView) boardView.style.display = 'none';
        if (resourceView) resourceView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'none';
        if (costsView) costsView.style.display = 'none';

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
            case 'dashboard':
                if (dashboardView) {
                    dashboardView.style.display = '';
                    this._renderDashboard();
                }
                break;
            case 'costs':
                if (costsView) {
                    costsView.style.display = '';
                    this._renderCostsView();
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
            case 'dashboard':
                this._renderDashboard();
                break;
            case 'costs':
                this._renderCostsView();
                break;
        }
    }

    /* ---- Board / Table View (Vue Tableau) ---- */

    _getFilteredTasks(includePhases = false) {
        let tasks = store.getTasks();
        const { status, assignee, phase, priority, dateStart, dateEnd, search } = this._filters;

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

            if (phase === 'none') {
                if (task.parentId) return false;
            } else if (phase !== 'all') {
                if (task.parentId !== phase) return false;
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
                case 'phase': {
                    const pa = a.parentId ? (store.getTask(a.parentId)?.name || '') : '';
                    const pb = b.parentId ? (store.getTask(b.parentId)?.name || '') : '';
                    va = pa.toLowerCase(); vb = pb.toLowerCase(); break;
                }
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

        // Checkbox column
        const thCb = document.createElement('th');
        thCb.className = 'table-cb-col';
        const selectAllCb = document.createElement('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.id = 'tableSelectAll';
        selectAllCb.title = 'Tout sélectionner (Ctrl+A)';
        selectAllCb.addEventListener('change', (e) => {
            e.stopPropagation();
            if (selectAllCb.checked) this._selectAllTasks();
            else this._clearSelection();
        });
        thCb.appendChild(selectAllCb);
        headerRow.appendChild(thCb);

        // Type column header (non-sortable icon column)
        const thType = document.createElement('th');
        thType.className = 'table-type-col';
        thType.textContent = 'Type';
        headerRow.appendChild(thType);

        const columns = [
            { key: 'name', label: 'Tâche' },
            { key: 'phase', label: 'Phase' },
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
        const criticalIds = this._showCriticalPath ? store.getCriticalPath() : [];
        const tbody = document.createElement('tbody');

        sorted.forEach(task => {
            const row = document.createElement('tr');
            row.dataset.taskId = task.id;
            if (this._selectedTaskIds.has(task.id)) row.classList.add('selected');
            const isCritical = criticalIds.includes(task.id);
            if (isCritical) row.classList.add('critical-path');
            row.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this._toggleTaskSelection(task.id, true);
                    return;
                }
                taskModal.openEdit(task.id);
            });

            // Checkbox
            const tdCb = document.createElement('td');
            tdCb.className = 'table-cb-col';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'table-select-cb';
            cb.dataset.taskId = task.id;
            cb.checked = this._selectedTaskIds.has(task.id);
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                this._toggleTaskSelection(task.id, true);
            });
            tdCb.appendChild(cb);
            row.appendChild(tdCb);

            // Type icon
            const tdType = document.createElement('td');
            tdType.className = 'table-type-col';
            let typeIcon, typeTitle;
            if (task.isMilestone) {
                typeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
                typeTitle = 'Jalon';
            } else if (task.isPermit) {
                typeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>';
                typeTitle = 'Permis';
            } else {
                typeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>';
                typeTitle = 'Tâche';
            }
            const typeSpan = document.createElement('span');
            typeSpan.className = 'table-type-icon';
            typeSpan.innerHTML = typeIcon;
            typeSpan.title = typeTitle;
            if (task.isMilestone) typeSpan.classList.add('type-milestone');
            else if (task.isPermit) typeSpan.classList.add('type-permit');
            else typeSpan.classList.add('type-task');
            tdType.appendChild(typeSpan);
            row.appendChild(tdType);

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
            row.appendChild(tdName);

            // Phase
            const tdPhase = document.createElement('td');
            if (task.parentId) {
                const phase = store.getTask(task.parentId);
                if (phase) {
                    const phaseChip = document.createElement('span');
                    phaseChip.className = 'table-phase-chip';
                    phaseChip.style.borderLeft = `3px solid ${phase.color || 'var(--border-default)'}`;
                    phaseChip.textContent = phase.name;
                    tdPhase.appendChild(phaseChip);
                } else {
                    tdPhase.textContent = '—';
                    tdPhase.style.color = 'var(--text-muted)';
                }
            } else {
                tdPhase.textContent = '—';
                tdPhase.style.color = 'var(--text-muted)';
            }
            row.appendChild(tdPhase);

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
            if (isCritical) {
                const critBadge = document.createElement('span');
                critBadge.className = 'badge-critical';
                critBadge.textContent = 'Critique';
                tdStatus.appendChild(critBadge);
            }
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

    _showResourceModal(resource = null) {
        const isEdit = !!resource;
        const RESOURCE_COLORS = [
            { name: 'Indigo',  value: '#6366F1' },
            { name: 'Violet',  value: '#8B5CF6' },
            { name: 'Rose',    value: '#EC4899' },
            { name: 'Bleu',    value: '#3B82F6' },
            { name: 'Cyan',    value: '#06B6D4' },
            { name: 'Vert',    value: '#10B981' },
            { name: 'Ambre',   value: '#F59E0B' },
            { name: 'Orange',  value: '#F97316' },
            { name: 'Rouge',   value: '#EF4444' },
            { name: 'Gris',    value: '#64748B' },
        ];
        const currentColor = isEdit ? resource.color : '#3B82F6';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';

        const modal = document.createElement('div');
        modal.className = 'modal resource-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', isEdit ? 'Modifier la ressource' : 'Nouvelle ressource');

        // ---- Header ----
        const header = document.createElement('div');
        header.className = 'modal-header';
        const title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = isEdit ? 'Modifier la ressource' : 'Nouvelle ressource';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'icon-btn';
        closeBtn.setAttribute('aria-label', 'Fermer');
        closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // ---- Body ----
        const body = document.createElement('div');
        body.className = 'modal-body';

        // Avatar preview + Name/Role row
        const topSection = document.createElement('div');
        topSection.className = 'res-modal-top';

        const avatarPreview = document.createElement('div');
        avatarPreview.className = 'res-modal-avatar-preview';
        avatarPreview.style.background = `linear-gradient(135deg, ${currentColor}, ${currentColor}dd)`;
        avatarPreview.textContent = isEdit ? (resource.avatar || '?') : '?';

        const topFields = document.createElement('div');
        topFields.className = 'res-modal-top-fields';

        // Name field
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        const nameLabel = document.createElement('label');
        nameLabel.className = 'form-label';
        nameLabel.textContent = 'Nom complet';
        const nameInput = document.createElement('input');
        nameInput.className = 'input';
        nameInput.type = 'text';
        nameInput.id = 'resName';
        nameInput.placeholder = 'Ex: Marie Dupont';
        nameInput.value = isEdit ? resource.name : '';
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        topFields.appendChild(nameGroup);

        // Role field
        const roleGroup = document.createElement('div');
        roleGroup.className = 'form-group';
        const roleLabel = document.createElement('label');
        roleLabel.className = 'form-label';
        roleLabel.textContent = 'Rôle / Fonction';
        const roleInput = document.createElement('input');
        roleInput.className = 'input';
        roleInput.type = 'text';
        roleInput.id = 'resRole';
        roleInput.placeholder = 'Ex: UX Designer, Développeur...';
        roleInput.value = isEdit ? (resource.role || '') : '';
        roleGroup.appendChild(roleLabel);
        roleGroup.appendChild(roleInput);
        topFields.appendChild(roleGroup);

        topSection.appendChild(avatarPreview);
        topSection.appendChild(topFields);
        body.appendChild(topSection);

        // Avatar initials + Hourly rate row
        const row2 = document.createElement('div');
        row2.className = 'form-row';

        const avatarGroup = document.createElement('div');
        avatarGroup.className = 'form-group';
        const avatarLabel = document.createElement('label');
        avatarLabel.className = 'form-label';
        avatarLabel.textContent = 'Initiales';
        const avatarHint = document.createElement('span');
        avatarHint.className = 'form-hint';
        avatarHint.textContent = 'Auto-généré si vide';
        const avatarInput = document.createElement('input');
        avatarInput.className = 'input';
        avatarInput.type = 'text';
        avatarInput.id = 'resAvatar';
        avatarInput.maxLength = 3;
        avatarInput.placeholder = 'Ex: MD';
        avatarInput.value = isEdit ? (resource.avatar || '') : '';
        avatarGroup.appendChild(avatarLabel);
        avatarGroup.appendChild(avatarInput);
        avatarGroup.appendChild(avatarHint);
        row2.appendChild(avatarGroup);

        const rateGroup = document.createElement('div');
        rateGroup.className = 'form-group';
        const rateLabel = document.createElement('label');
        rateLabel.className = 'form-label';
        rateLabel.textContent = 'Tarification';

        // Rate type toggle
        let currentRateType = (isEdit && resource.rateType === 'daily') ? 'daily' : 'hourly';
        const rateToggle = document.createElement('div');
        rateToggle.className = 'res-rate-toggle';
        const btnHourly = document.createElement('button');
        btnHourly.type = 'button';
        btnHourly.className = 'res-rate-toggle-btn' + (currentRateType === 'hourly' ? ' active' : '');
        btnHourly.textContent = 'Taux horaire';
        const btnDaily = document.createElement('button');
        btnDaily.type = 'button';
        btnDaily.className = 'res-rate-toggle-btn' + (currentRateType === 'daily' ? ' active' : '');
        btnDaily.textContent = 'TJM';
        rateToggle.appendChild(btnHourly);
        rateToggle.appendChild(btnDaily);

        const rateWrap = document.createElement('div');
        rateWrap.className = 'res-rate-input-wrap';
        const rateInput = document.createElement('input');
        rateInput.className = 'input';
        rateInput.type = 'number';
        rateInput.id = 'resRate';
        rateInput.min = '0';
        rateInput.step = '0.01';
        rateInput.placeholder = '0.00';
        if (isEdit) {
            rateInput.value = currentRateType === 'daily'
                ? (resource.dailyRate || '')
                : (resource.hourlyRate || '');
        }
        const rateSuffix = document.createElement('span');
        rateSuffix.className = 'res-rate-suffix';
        rateSuffix.textContent = currentRateType === 'daily' ? getCurrencyConfig().daily : getCurrencyConfig().hourly;

        const switchRateType = (type) => {
            currentRateType = type;
            btnHourly.classList.toggle('active', type === 'hourly');
            btnDaily.classList.toggle('active', type === 'daily');
            rateSuffix.textContent = type === 'daily' ? getCurrencyConfig().daily : getCurrencyConfig().hourly;
            rateInput.value = '';
            rateInput.focus();
        };
        btnHourly.addEventListener('click', () => switchRateType('hourly'));
        btnDaily.addEventListener('click', () => switchRateType('daily'));

        rateWrap.appendChild(rateInput);
        rateWrap.appendChild(rateSuffix);
        rateGroup.appendChild(rateLabel);
        rateGroup.appendChild(rateToggle);
        rateGroup.appendChild(rateWrap);
        row2.appendChild(rateGroup);
        body.appendChild(row2);

        // Color picker
        const colorGroup = document.createElement('div');
        colorGroup.className = 'form-group';
        const colorLabel = document.createElement('label');
        colorLabel.className = 'form-label';
        colorLabel.textContent = 'Couleur';
        colorGroup.appendChild(colorLabel);
        const colorPicker = document.createElement('div');
        colorPicker.className = 'color-picker';
        let selectedColor = currentColor;
        RESOURCE_COLORS.forEach(c => {
            const swatch = document.createElement('button');
            swatch.className = 'color-swatch' + (c.value === currentColor ? ' active' : '');
            swatch.style.background = c.value;
            swatch.title = c.name;
            swatch.setAttribute('aria-label', c.name);
            swatch.dataset.color = c.value;
            swatch.addEventListener('click', (e) => {
                e.preventDefault();
                colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                selectedColor = c.value;
                avatarPreview.style.background = `linear-gradient(135deg, ${c.value}, ${c.value}dd)`;
            });
            colorPicker.appendChild(swatch);
        });
        colorGroup.appendChild(colorPicker);
        body.appendChild(colorGroup);

        modal.appendChild(body);

        // ---- Footer ----
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-ghost';
        cancelBtn.textContent = 'Annuler';
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = isEdit ? 'Enregistrer' : 'Créer la ressource';
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // ---- Events ----
        const close = () => { overlay.remove(); };
        closeBtn.addEventListener('click', close);
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        nameInput.focus();

        // Live avatar preview
        const updateAvatarPreview = () => {
            const av = avatarInput.value.trim().toUpperCase();
            const nm = nameInput.value.trim();
            if (av) {
                avatarPreview.textContent = av;
            } else if (nm) {
                avatarPreview.textContent = nm.split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
            } else {
                avatarPreview.textContent = '?';
            }
        };
        nameInput.addEventListener('input', updateAvatarPreview);
        avatarInput.addEventListener('input', updateAvatarPreview);

        // Save
        saveBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) {
                this._showToast('Le nom est obligatoire', 'warning');
                nameInput.focus();
                return;
            }
            const role = roleInput.value.trim();
            let avatar = avatarInput.value.trim().toUpperCase();
            if (!avatar) {
                avatar = name.split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
            }
            const rateValue = rateInput.value ? parseFloat(rateInput.value) : null;
            const rateType = currentRateType;
            const hourlyRate = rateType === 'hourly' ? rateValue : null;
            const dailyRate = rateType === 'daily' ? rateValue : null;

            if (isEdit) {
                store.updateResource(resource.id, { name, role, avatar, color: selectedColor, rateType, hourlyRate, dailyRate });
                this._showToast('Ressource modifiée', 'success');
            } else {
                store.addResource({ name, role, avatar, color: selectedColor, rateType, hourlyRate, dailyRate });
                this._showToast('Ressource créée', 'success');
            }
            close();
            this._renderResourceView();
        });

        // Keyboard shortcuts
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) saveBtn.click();
            if (e.key === 'Escape') close();
        });
    }

    _deleteResource(resource) {
        if (!confirm(`Supprimer la ressource "${resource.name}" ?\nElle sera désassignée de toutes les tâches.`)) return;
        store.deleteResource(resource.id);
        this._showToast('Ressource supprimée', 'success');
        this._renderResourceView();
    }

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

        // Add resource button (always visible as a special card)
        const addCard = document.createElement('div');
        addCard.className = 'resource-card resource-card-add';
        addCard.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:120px;cursor:pointer;color:var(--text-muted);gap:8px"><span style="font-size:32px;line-height:1">+</span><span style="font-size:var(--font-size-sm)">Ajouter une ressource</span></div>';
        addCard.addEventListener('click', () => this._showResourceModal());
        container.appendChild(addCard);

        if (resources.length === 0) {
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
            if (resource.dailyRate || resource.hourlyRate) {
                const rateEl = document.createElement('div');
                rateEl.className = 'resource-card-rate';
                if (resource.rateType === 'daily' && resource.dailyRate) {
                    rateEl.textContent = formatRate(resource.dailyRate, 'daily') + ' (TJM)';
                } else if (resource.hourlyRate) {
                    rateEl.textContent = formatRate(resource.hourlyRate, 'hourly');
                }
                info.appendChild(rateEl);
            }
            header.appendChild(info);

            const countBadge = document.createElement('div');
            countBadge.className = 'resource-card-count';
            countBadge.textContent = `${assignedTasks.length} tâche${assignedTasks.length !== 1 ? 's' : ''}`;
            header.appendChild(countBadge);

            // Edit / Delete actions
            const actions = document.createElement('div');
            actions.className = 'resource-card-actions';
            const editBtn = document.createElement('button');
            editBtn.className = 'resource-action-btn';
            editBtn.title = 'Modifier';
            editBtn.innerHTML = '&#9998;';
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); this._showResourceModal(resource); });
            actions.appendChild(editBtn);
            const delBtn = document.createElement('button');
            delBtn.className = 'resource-action-btn resource-action-delete';
            delBtn.title = 'Supprimer';
            delBtn.innerHTML = '&times;';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); this._deleteResource(resource); });
            actions.appendChild(delBtn);
            header.appendChild(actions);

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
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._showExportDropdown(exportBtn);
            });
        }

        const importBtn = $('#importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this._importProject());
        }

        const cloudBtn = $('#cloudBackupBtn');
        if (cloudBtn) {
            cloudBtn.addEventListener('click', () => this._showCloudBackupModal());
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

        const helpBtn = $('#helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this._showKeyboardHelp());
        }

    }

    _showAddTaskDialog() {
        taskModal.openCreate();
    }

    _showExportDropdown(btn) {
        const existing = document.getElementById('exportDropdown');
        if (existing) { existing.remove(); return; }

        const rect = btn.getBoundingClientRect();
        const dd = document.createElement('div');
        dd.id = 'exportDropdown';
        dd.className = 'export-dropdown';
        dd.style.top = (rect.bottom + 4) + 'px';
        dd.style.right = (window.innerWidth - rect.right) + 'px';

        const formats = [
            { label: 'JSON', icon: '{ }', desc: 'Réimportable', tooltip: 'Exporte le projet actif au format JSON. Ce fichier peut être réimporté dans Gantt Planner pour restaurer toutes les tâches, ressources et paramètres.', action: () => this._exportJSON() },
            { label: 'Tout exporter', icon: '★', desc: 'Tous les projets (JSON)', tooltip: 'Exporte l\'ensemble de vos projets en un seul fichier JSON. Idéal pour créer une sauvegarde complète ou migrer vers un autre appareil.', action: () => this._exportAllJSON() },
            { label: 'CSV', icon: 'CSV', desc: 'MS Project / Excel / Tableur', tooltip: 'Exporte les tâches au format CSV (valeurs séparées par des virgules). Compatible avec Excel, Google Sheets, LibreOffice Calc et MS Project.', action: () => this._exportCSV() },
            { label: 'XML', icon: 'XML', desc: 'MS Project (recommandé)', tooltip: 'Exporte au format XML compatible Microsoft Project. Format recommandé pour une importation fidèle dans MS Project avec les dépendances et les ressources.', action: () => this._exportMSProjectXML() },
            { label: 'PDF', icon: 'PDF', desc: 'Impression', tooltip: 'Génère un document PDF du diagramme de Gantt, prêt à imprimer ou à partager. Vous pouvez personnaliser les options d\'impression.', action: () => this._showPDFExportDialog() },
        ];

        formats.forEach(f => {
            const item = document.createElement('button');
            item.className = 'export-dropdown-item';
            item.title = f.tooltip;
            item.innerHTML = `<span class="export-dropdown-icon">${f.icon}</span><div><div class="export-dropdown-label">${f.label}</div><div class="export-dropdown-desc">${f.desc}</div></div>`;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                dd.remove();
                f.action();
            });
            dd.appendChild(item);
        });

        document.body.appendChild(dd);
        const close = () => { dd.remove(); document.removeEventListener('click', close); };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    _exportJSON() {
        const project = store.getActiveProject();
        const tasks = store.getTasks();
        const resources = store.getResources();

        const data = { project, tasks, resources, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this._downloadBlob(blob, `${project.name.replace(/\s+/g, '_')}_export.json`);
        this._showToast('Projet exporté en JSON', 'success');
    }

    _exportAllJSON() {
        const data = store.exportAllProjects();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const date = new Date().toISOString().slice(0, 10);
        this._downloadBlob(blob, `gantt_planner_backup_${date}.json`);
        this._showToast(`${data.projects.length} projet(s) exporté(s)`, 'success');
    }

    _exportCSV() {
        const project = store.getActiveProject();
        const allTasks = store.getTasks();
        const resources = store.getResources();
        const SEP = ';';

        const fmtDate = (d) => {
            if (!d) return '';
            const [y, m, day] = d.split('-');
            return `${day}/${m}/${y}`;
        };
        const dur = (task) => {
            if (!task.startDate || !task.endDate) return '';
            const days = Math.max(1, Math.round((new Date(task.endDate) - new Date(task.startDate)) / 86400000) + 1);
            return days + ' jour' + (days > 1 ? 's' : '');
        };
        const assigneeNames = (task) => (task.assignees || [])
            .map(id => { const r = resources.find(r => r.id === id); return r ? r.name : ''; })
            .filter(Boolean).join(', ');
        const row = (task, level) => [
            level,
            this._csvEscape(task.name, SEP),
            dur(task),
            fmtDate(task.startDate),
            fmtDate(task.endDate),
            this._csvEscape(assigneeNames(task), SEP),
            task.progress,
        ].join(SEP);

        const headers = ['Niveau hiérarchique', 'Nom', 'Durée', 'Début', 'Fin', 'Noms ressources', '% achevé'];
        const rows = [];
        allTasks.filter(t => !t.parentId).sort((a, b) => a.order - b.order).forEach(task => {
            rows.push(row(task, 1));
            if (task.isPhase) {
                allTasks.filter(t => t.parentId === task.id).sort((a, b) => a.order - b.order)
                    .forEach(child => rows.push(row(child, 2)));
            }
        });

        const csvStr = headers.join(SEP) + '\n' + rows.join('\n');
        const bytes = new Uint8Array(csvStr.length);
        for (let i = 0; i < csvStr.length; i++) {
            bytes[i] = csvStr.charCodeAt(i) & 0xFF;
        }
        const blob = new Blob([bytes], { type: 'text/csv;charset=windows-1252' });
        this._downloadBlob(blob, `${project.name.replace(/\s+/g, '_')}_msproject.csv`);
        this._showToast('Projet exporté en CSV (compatible MS Project)', 'success');
        this._showMSProjectImportHelp();
    }

    _exportMSProjectXML() {
        const project = store.getActiveProject();
        const allTasks = store.getTasks();
        const resources = store.getResources();

        const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const fmtDateTime = (d, time) => d ? `${d}T${time}` : '';
        const durISO = (task) => {
            if (!task.startDate || !task.endDate) return 'PT8H0M0S';
            const days = Math.max(1, Math.round((new Date(task.endDate) - new Date(task.startDate)) / 86400000) + 1);
            return `PT${days * 8}H0M0S`;
        };

        let taskUID = 0;
        let assignUID = 0;
        const taskUIDMap = {};
        const resUIDMap = {};

        // Build task XML
        const taskLines = [];
        // Root summary task (UID 0)
        taskLines.push(`      <Task><UID>0</UID><ID>0</ID><Name>${esc(project.name)}</Name><OutlineLevel>0</OutlineLevel><Summary>1</Summary></Task>`);
        taskUID = 1;

        const rootTasks = allTasks.filter(t => !t.parentId).sort((a, b) => a.order - b.order);
        rootTasks.forEach(task => {
            taskUIDMap[task.id] = taskUID;
            taskLines.push(`      <Task>` +
                `<UID>${taskUID}</UID><ID>${taskUID}</ID>` +
                `<Name>${esc(task.name)}</Name>` +
                `<OutlineLevel>1</OutlineLevel>` +
                (task.isPhase ? `<Summary>1</Summary>` : '') +
                (task.startDate ? `<Start>${fmtDateTime(task.startDate, '08:00:00')}</Start>` : '') +
                (task.endDate ? `<Finish>${fmtDateTime(task.endDate, '17:00:00')}</Finish>` : '') +
                `<Duration>${durISO(task)}</Duration>` +
                `<PercentComplete>${task.progress || 0}</PercentComplete>` +
                `</Task>`);
            taskUID++;

            if (task.isPhase) {
                allTasks.filter(t => t.parentId === task.id).sort((a, b) => a.order - b.order).forEach(child => {
                    taskUIDMap[child.id] = taskUID;
                    taskLines.push(`      <Task>` +
                        `<UID>${taskUID}</UID><ID>${taskUID}</ID>` +
                        `<Name>${esc(child.name)}</Name>` +
                        `<OutlineLevel>2</OutlineLevel>` +
                        (child.startDate ? `<Start>${fmtDateTime(child.startDate, '08:00:00')}</Start>` : '') +
                        (child.endDate ? `<Finish>${fmtDateTime(child.endDate, '17:00:00')}</Finish>` : '') +
                        `<Duration>${durISO(child)}</Duration>` +
                        `<PercentComplete>${child.progress || 0}</PercentComplete>` +
                        `</Task>`);
                    taskUID++;
                });
            }
        });

        // Build resources XML
        const resLines = [];
        resLines.push(`      <Resource><UID>0</UID><ID>0</ID><Name/></Resource>`);
        resources.forEach((r, i) => {
            resUIDMap[r.id] = i + 1;
            resLines.push(`      <Resource><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${esc(r.name)}</Name></Resource>`);
        });

        // Build assignments XML
        const assignLines = [];
        allTasks.forEach(task => {
            const tUID = taskUIDMap[task.id];
            if (tUID === undefined) return;
            (task.assignees || []).forEach(resId => {
                const rUID = resUIDMap[resId];
                if (rUID === undefined) return;
                assignLines.push(`      <Assignment><UID>${assignUID}</UID><TaskUID>${tUID}</TaskUID><ResourceUID>${rUID}</ResourceUID></Assignment>`);
                assignUID++;
            });
        });

        const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
   <Name>${esc(project.name)}</Name>
   <Tasks>
${taskLines.join('\n')}
   </Tasks>
   <Resources>
${resLines.join('\n')}
   </Resources>
   <Assignments>
${assignLines.join('\n')}
   </Assignments>
</Project>`;

        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        this._downloadBlob(blob, `${project.name.replace(/\s+/g, '_')}_msproject.xml`);
        this._showToast('Projet exporté en XML MS Project', 'success');
    }

    _showMSProjectImportHelp() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-width:560px" role="dialog" aria-modal="true" aria-label="Import dans MS Project">
                <div class="modal-header">
                    <h3>Import dans MS Project</h3>
                    <button class="modal-close" id="msHelpClose">&times;</button>
                </div>
                <div class="modal-body" style="font-size:13px;line-height:1.7">
                    <p><strong>Si erreur « ancien format de fichier » :</strong></p>
                    <ol style="padding-left:18px;margin:8px 0">
                        <li><strong>Fichier → Options → Centre de gestion de la confidentialité</strong></li>
                        <li>Cliquez sur <strong>Paramètres du Centre de gestion de la confidentialité</strong></li>
                        <li>Onglet <strong>Formats hérités</strong> → cochez <strong>« Autoriser le chargement des fichiers avec des formats hérités ou non définis par défaut »</strong></li>
                        <li>OK → relancez l'import</li>
                    </ol>
                    <hr style="margin:12px 0;border:none;border-top:1px solid #e0e0e0">
                    <p><strong>Procédure d'import :</strong></p>
                    <ol style="padding-left:18px;margin:8px 0">
                        <li><strong>Fichier → Ouvrir</strong> → type « Fichiers CSV » → sélectionnez le .csv</li>
                        <li>L'assistant d'importation s'ouvre → <strong>Suivant</strong></li>
                        <li>Choisissez <strong>« Nouveau mappage »</strong> → <strong>Suivant</strong></li>
                        <li>Vérifiez : <em>Type de données</em> = <strong>Tâches</strong>, cochez <strong>« Importer les en-têtes »</strong>, séparateur = <strong>Point-virgule</strong></li>
                        <li>À l'étape <strong>Mappage</strong>, vérifiez la correspondance :</li>
                    </ol>
                    <table style="width:100%;font-size:12px;border-collapse:collapse;margin:6px 0 8px">
                        <tr style="background:#f5f5f5"><th style="text-align:left;padding:4px 8px;border:1px solid #ddd">Colonne CSV (De)</th><th style="text-align:left;padding:4px 8px;border:1px solid #ddd">Champ MS Project (Vers)</th></tr>
                        <tr><td style="padding:3px 8px;border:1px solid #eee">Niveau hiérarchique</td><td style="padding:3px 8px;border:1px solid #eee">Niveau hiérarchique</td></tr>
                        <tr><td style="padding:3px 8px;border:1px solid #eee">Nom</td><td style="padding:3px 8px;border:1px solid #eee">Nom</td></tr>
                        <tr><td style="padding:3px 8px;border:1px solid #eee">Durée</td><td style="padding:3px 8px;border:1px solid #eee">Durée</td></tr>
                        <tr><td style="padding:3px 8px;border:1px solid #eee">Début</td><td style="padding:3px 8px;border:1px solid #eee">Début</td></tr>
                        <tr><td style="padding:3px 8px;border:1px solid #eee">Fin</td><td style="padding:3px 8px;border:1px solid #eee">Fin</td></tr>
                        <tr><td style="padding:3px 8px;border:1px solid #eee">Noms ressources</td><td style="padding:3px 8px;border:1px solid #eee">Noms ressources</td></tr>
                        <tr><td style="padding:3px 8px;border:1px solid #eee">% achevé</td><td style="padding:3px 8px;border:1px solid #eee">% achevé</td></tr>
                    </table>
                    <ol start="6" style="padding-left:18px;margin:4px 0">
                        <li>Cliquez <strong>Terminer</strong> → le projet s'importe avec la hiérarchie phases/tâches</li>
                    </ol>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="msHelpOk">Compris</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#msHelpClose').addEventListener('click', close);
        overlay.querySelector('#msHelpOk').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    _csvEscape(value, sep = ',') {
        if (!value) return '';
        const str = String(value);
        if (str.includes(sep) || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    _showPDFExportDialog() {
        const existing = document.getElementById('pdfExportDialog');
        if (existing) existing.remove();

        // Compute default date range from project tasks
        const range = store.getTimelineRange();
        const project = store.getActiveProject();
        const defaultStart = project?.startDate || formatDateISO(range.start);
        const defaultEnd = project?.endDate || formatDateISO(range.end);

        const overlay = document.createElement('div');
        overlay.id = 'pdfExportDialog';
        overlay.className = 'pdf-export-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'pdf-export-dialog';

        dialog.innerHTML = `
            <div class="pdf-export-header">
                <h3>Export PDF</h3>
                <button class="pdf-export-close" aria-label="Fermer">&times;</button>
            </div>
            <p class="pdf-export-desc">Sélectionnez les vues à inclure dans le PDF :</p>
            <div class="pdf-export-options">
                <label class="pdf-export-option">
                    <input type="checkbox" value="table" checked>
                    <span class="pdf-export-option-icon">☰</span>
                    <div>
                        <div class="pdf-export-option-label">Tableau des tâches</div>
                        <div class="pdf-export-option-desc">Liste détaillée avec statut, priorité et progression</div>
                    </div>
                </label>
                <label class="pdf-export-option">
                    <input type="checkbox" value="timeline" checked>
                    <span class="pdf-export-option-icon">▸</span>
                    <div>
                        <div class="pdf-export-option-label">Timeline (Gantt)</div>
                        <div class="pdf-export-option-desc">Diagramme de Gantt avec barres de tâches</div>
                    </div>
                </label>
                <label class="pdf-export-option">
                    <input type="checkbox" value="resources" checked>
                    <span class="pdf-export-option-icon">👤</span>
                    <div>
                        <div class="pdf-export-option-label">Ressources</div>
                        <div class="pdf-export-option-desc">Charge de travail et tâches par ressource</div>
                    </div>
                </label>
            </div>
            <div class="pdf-export-date-section" id="pdfDateSection">
                <div class="pdf-export-date-label">Fenêtre temporelle de la Timeline :</div>
                <div class="pdf-export-date-row">
                    <label class="pdf-export-date-field">
                        <span>Du</span>
                        <input type="date" id="pdfDateStart" class="input" value="${defaultStart}">
                    </label>
                    <span class="pdf-export-date-arrow">→</span>
                    <label class="pdf-export-date-field">
                        <span>Au</span>
                        <input type="date" id="pdfDateEnd" class="input" value="${defaultEnd}">
                    </label>
                </div>
            </div>
            <div class="pdf-export-actions">
                <button class="btn btn-secondary pdf-export-cancel">Annuler</button>
                <button class="btn btn-primary pdf-export-confirm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9l6 6 6-6"/></svg>
                    Générer le PDF
                </button>
            </div>`;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Show/hide date section based on timeline checkbox
        const timelineCb = dialog.querySelector('input[value="timeline"]');
        const dateSection = dialog.querySelector('#pdfDateSection');
        const updateDateVisibility = () => {
            dateSection.style.display = timelineCb.checked ? '' : 'none';
        };
        updateDateVisibility();
        timelineCb.addEventListener('change', updateDateVisibility);

        // Close handlers
        const close = () => overlay.remove();
        overlay.querySelector('.pdf-export-close').addEventListener('click', close);
        overlay.querySelector('.pdf-export-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // Confirm handler
        overlay.querySelector('.pdf-export-confirm').addEventListener('click', () => {
            const checks = overlay.querySelectorAll('.pdf-export-options input[type="checkbox"]');
            const sections = [];
            checks.forEach(cb => { if (cb.checked) sections.push(cb.value); });
            if (sections.length === 0) {
                this._showToast('Sélectionnez au moins une vue', 'warning');
                return;
            }
            const tlStart = document.getElementById('pdfDateStart').value;
            const tlEnd = document.getElementById('pdfDateEnd').value;
            close();
            this._exportPDF(sections, tlStart, tlEnd);
        });

        setTimeout(() => dialog.querySelector('.pdf-export-confirm').focus(), 50);
    }

    _exportPDF(sections = ['table'], tlStart, tlEnd) {
        const project = store.getActiveProject();
        const tasks = store.getTasks();
        const resources = store.getResources();

        const statusLabels = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
        const priorityLabels = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };
        const stats = store.getProjectStats();

        let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${project.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:11px;color:#1e293b;padding:30px}
h1{font-size:20px;margin-bottom:4px;color:#6366F1}
h2{font-size:15px;color:#1e293b;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #6366F1}
.subtitle{color:#64748b;font-size:12px;margin-bottom:20px}
.stats{display:flex;gap:20px;margin-bottom:20px;padding:12px;background:#f8fafc;border-radius:6px}
.stat{text-align:center;flex:1}.stat-val{font-size:18px;font-weight:700;color:#6366F1}.stat-lbl{color:#64748b;font-size:10px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#f1f5f9;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;color:#64748b}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:11px}
tr:nth-child(even){background:#fafbfc}
tr{page-break-inside:avoid;break-inside:avoid}
thead{display:table-header-group}
.phase-row{background:#f1f5f9;font-weight:600}
.badge{padding:1px 6px;border-radius:10px;font-size:9px;font-weight:500}
.badge-high{background:#fef2f2;color:#ef4444}.badge-medium{background:#fffbeb;color:#f59e0b}.badge-low{background:#f0fdf4;color:#10b981}
.badge-done{background:#f0fdf4;color:#10b981}.badge-in_progress{background:#eff6ff;color:#3b82f6}.badge-todo{background:#f8fafc;color:#64748b}
.progress-bar{width:60px;height:6px;background:#e2e8f0;border-radius:3px;display:inline-block;vertical-align:middle}
.progress-fill{height:100%;border-radius:3px;background:#6366F1}
.footer{margin-top:20px;text-align:center;color:#94a3b8;font-size:9px;border-top:1px solid #e2e8f0;padding-top:10px}
.gantt-section{margin-bottom:20px;width:100%}
.gantt-tl-header{display:flex;border-bottom:2px solid #e2e8f0;font-size:9px;color:#64748b;text-transform:uppercase;font-weight:600}
.gantt-tl-track-header{flex:1;display:flex;min-width:0}
.gantt-tl-track-header div{padding:4px 0;text-align:center;border-left:1px solid #e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gantt-tl-row{display:flex;align-items:center;height:32px;border-bottom:1px solid #f8fafc;page-break-inside:avoid;break-inside:avoid}
.gantt-tl-row:nth-child(even){background:#fafbfc}
.gantt-tl-label{width:180px;min-width:180px;max-width:180px;flex-shrink:0;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px;color:#1e293b}
.gantt-tl-label.phase{font-weight:600;color:#6366F1}
.gantt-tl-track{flex:1;position:relative;height:24px;min-width:0}
.gantt-tl-bar{position:absolute;height:18px;border-radius:4px;top:3px;display:flex;align-items:center;padding:0 6px;font-size:8px;color:#fff;font-weight:500;overflow:hidden;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
.gantt-tl-phase{position:absolute;height:8px;border-radius:2px;top:8px;opacity:0.7}
.gantt-tl-phase::before,.gantt-tl-phase::after{content:'';position:absolute;bottom:0;width:6px;height:10px;background:inherit;clip-path:polygon(0 0,100% 0,50% 100%)}
.gantt-tl-phase::before{left:0}.gantt-tl-phase::after{right:0}
.resource-section{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px}
.res-card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;width:calc(50% - 8px);box-sizing:border-box;page-break-inside:avoid;break-inside:avoid}
.res-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.res-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600;flex-shrink:0}
.res-name{font-weight:600;font-size:12px}.res-role{font-size:10px;color:#64748b}
.res-workload{height:6px;background:#e2e8f0;border-radius:3px;margin:6px 0;overflow:hidden}
.res-workload-fill{height:100%;border-radius:3px}
.res-workload-label{font-size:9px;color:#64748b;margin-bottom:6px}
.res-task{font-size:10px;padding:3px 0;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between}
.res-task-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.res-task-dates{color:#64748b;white-space:nowrap;margin-left:8px}
@media print{body{padding:15px}@page{margin:10mm;size:landscape}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}}
.page-break{page-break-before:always}
</style></head><body>
<h1>${project.name}</h1>
<div class="subtitle">${project.description || 'Exporté le ' + new Date().toLocaleDateString('fr-FR')}</div>
<div class="stats">
<div class="stat"><div class="stat-val">${stats.totalTasks}</div><div class="stat-lbl">Tâches</div></div>
<div class="stat"><div class="stat-val">${stats.progress}%</div><div class="stat-lbl">Progression</div></div>
<div class="stat"><div class="stat-val">${stats.daysRemaining}</div><div class="stat-lbl">Jours restants</div></div>
<div class="stat"><div class="stat-val">${stats.completedTasks}/${stats.totalTasks}</div><div class="stat-lbl">Terminées</div></div>
</div>`;

        // ---- TABLE SECTION ----
        if (sections.includes('table')) {
            html += `<h2>Tableau des tâches</h2>`;
            html += `<table><thead><tr><th>Tâche</th><th>Début</th><th>Fin</th><th>Assigné(s)</th><th>Statut</th><th>Priorité</th><th>Progression</th></tr></thead><tbody>`;
            const rootTasks = tasks.filter(t => !t.parentId).sort((a, b) => a.order - b.order);
            rootTasks.forEach(task => {
                if (task.isPhase) {
                    html += `<tr class="phase-row"><td colspan="7">${task.name} (${task.progress}%)</td></tr>`;
                    const children = tasks.filter(t => t.parentId === task.id).sort((a, b) => a.order - b.order);
                    children.forEach(child => {
                        html += this._pdfTaskRow(child, resources, statusLabels, priorityLabels);
                    });
                } else {
                    html += this._pdfTaskRow(task, resources, statusLabels, priorityLabels);
                }
            });
            html += `</tbody></table>`;
        }

        // ---- TIMELINE SECTION ----
        if (sections.includes('timeline')) {
            if (sections.includes('table')) html += `<div class="page-break"></div>`;
            html += this._pdfTimelineSection(tasks, resources, tlStart, tlEnd);
        }

        // ---- RESOURCES SECTION ----
        if (sections.includes('resources')) {
            if (sections.includes('table') || sections.includes('timeline')) html += `<div class="page-break"></div>`;
            html += this._pdfResourceSection(tasks, resources, statusLabels);
        }

        html += `<div class="footer">Gantt Planner Pro — ${project.name} — Exporté le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
</body></html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.print(); };
        this._showToast('Impression PDF prête', 'success');
    }

    _pdfTimelineSection(tasks, resources, tlStart, tlEnd) {
        const range = store.getTimelineRange();
        const start = tlStart ? new Date(tlStart) : new Date(range.start);
        const end = tlEnd ? new Date(tlEnd) : new Date(range.end);
        const DAY = 86400000;
        // End date is inclusive; use exclusive boundary for calculations
        const endExcl = new Date(end.getTime() + DAY);
        const totalDays = Math.max(1, Math.round((endExcl - start) / DAY));

        // Determine best time scale based on duration
        let scale;
        if (totalDays <= 45) scale = 'days';
        else if (totalDays <= 120) scale = 'weeks';
        else if (totalDays <= 730) scale = 'months';
        else scale = 'quarters';

        const fmtDate = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        const scaleLabels = { days: 'Jours', weeks: 'Semaines', months: 'Mois', quarters: 'Trimestres' };

        let html = `<h2>Timeline (Gantt)</h2>`;
        html += `<p style="font-size:10px;color:#64748b;margin-bottom:10px">Période : ${fmtDate(start)} → ${fmtDate(end)} — Échelle : ${scaleLabels[scale]}</p>`;

        // Build header columns based on scale
        const headerCols = [];
        if (scale === 'days') {
            const cursor = new Date(start);
            while (cursor < endExcl) {
                const nextDay = new Date(cursor.getTime() + DAY);
                const sliceEnd = nextDay > endExcl ? endExcl : nextDay;
                const pct = ((sliceEnd - cursor) / DAY / totalDays) * 100;
                const label = totalDays <= 14
                    ? cursor.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })
                    : String(cursor.getDate());
                headerCols.push({ pct, label });
                cursor.setTime(nextDay.getTime());
            }
        } else if (scale === 'weeks') {
            const cursor = new Date(start);
            while (cursor < endExcl) {
                let daysToMon = (8 - cursor.getDay()) % 7;
                if (daysToMon === 0) daysToMon = 7;
                const nextMonday = new Date(cursor.getTime() + daysToMon * DAY);
                const sliceEnd = nextMonday > endExcl ? endExcl : nextMonday;
                const daysSpan = Math.max(1, Math.round((sliceEnd - cursor) / DAY));
                const pct = (daysSpan / totalDays) * 100;
                const label = cursor.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                headerCols.push({ pct, label });
                cursor.setTime(sliceEnd.getTime());
            }
        } else if (scale === 'months') {
            const mCur = new Date(start.getFullYear(), start.getMonth(), 1);
            while (mCur < endExcl) {
                const mStart = new Date(Math.max(mCur.getTime(), start.getTime()));
                const nextM = new Date(mCur.getFullYear(), mCur.getMonth() + 1, 1);
                const mEnd = new Date(Math.min(nextM.getTime(), endExcl.getTime()));
                const daysSpan = Math.max(1, Math.round((mEnd - mStart) / DAY));
                const pct = (daysSpan / totalDays) * 100;
                const label = mCur.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                headerCols.push({ pct, label });
                mCur.setMonth(mCur.getMonth() + 1);
            }
        } else {
            const qCur = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
            while (qCur < endExcl) {
                const qStart = new Date(Math.max(qCur.getTime(), start.getTime()));
                const nextQ = new Date(qCur.getFullYear(), qCur.getMonth() + 3, 1);
                const qEnd = new Date(Math.min(nextQ.getTime(), endExcl.getTime()));
                const daysSpan = Math.max(1, Math.round((qEnd - qStart) / DAY));
                const pct = (daysSpan / totalDays) * 100;
                const qNum = Math.floor(qCur.getMonth() / 3) + 1;
                headerCols.push({ pct, label: `T${qNum} ${qCur.getFullYear()}` });
                qCur.setMonth(qCur.getMonth() + 3);
            }
        }

        // Build flat list of rows with indent info
        const rootTasks = tasks.filter(t => !t.parentId).sort((a, b) => a.order - b.order);
        const flatRows = [];
        rootTasks.forEach(task => {
            flatRows.push({ task, indent: 0 });
            if (task.isPhase) {
                const children = tasks.filter(t => t.parentId === task.id).sort((a, b) => a.order - b.order);
                children.forEach(child => flatRows.push({ task: child, indent: 1 }));
            }
        });

        const estTrackPx = 860; // Approx track width in A4 landscape print
        const ROWS_PER_PAGE = 20; // Max rows per page to avoid overflow

        // Render header HTML for reuse
        const headerHtml = (() => {
            let h = `<div class="gantt-tl-header">`;
            h += `<div class="gantt-tl-label" style="padding-left:4px">Tâche</div>`;
            h += `<div class="gantt-tl-track-header">`;
            headerCols.forEach(col => {
                h += `<div style="width:${col.pct}%">${col.label}</div>`;
            });
            h += `</div></div>`;
            return h;
        })();

        const renderRow = (task, indent) => {
            const ts = new Date(task.startDate);
            const te = new Date(task.endDate);
            const visStart = new Date(Math.max(ts.getTime(), start.getTime()));
            const visEnd = new Date(Math.min(te.getTime() + DAY, endExcl.getTime()));

            let rowHtml = `<div class="gantt-tl-row">`;
            rowHtml += `<div class="gantt-tl-label${task.isPhase ? ' phase' : ''}" style="padding-left:${4 + indent * 16}px">${task.isPhase ? '▾ ' : ''}${task.name}</div>`;
            rowHtml += `<div class="gantt-tl-track">`;

            if (visStart < endExcl && visEnd > start) {
                const leftPct = ((visStart - start) / DAY / totalDays) * 100;
                const widthPct = Math.min(100 - leftPct, Math.max(0.5, ((visEnd - visStart) / DAY / totalDays) * 100));
                const color = task.color || '#6366F1';

                if (task.isPhase) {
                    rowHtml += `<div class="gantt-tl-phase" style="left:${leftPct}%;width:${widthPct}%;background:${color}"></div>`;
                } else {
                    const approxPx = (widthPct / 100) * estTrackPx;
                    const barLabel = approxPx > 60
                        ? `${task.name.substring(0, Math.floor(approxPx / 8))} ${task.progress}%`
                        : (approxPx > 25 ? `${task.progress}%` : '');
                    rowHtml += `<div class="gantt-tl-bar" style="left:${leftPct}%;width:${widthPct}%;background:${color}">${barLabel}</div>`;
                }
            }

            rowHtml += `</div></div>`;
            return rowHtml;
        };

        // Paginate rows into chunks with repeated header
        for (let i = 0; i < flatRows.length; i += ROWS_PER_PAGE) {
            if (i > 0) html += `<div class="page-break"></div>`;
            html += `<div class="gantt-section">`;
            html += headerHtml;
            const chunk = flatRows.slice(i, i + ROWS_PER_PAGE);
            chunk.forEach(({ task, indent }) => {
                html += renderRow(task, indent);
            });
            html += `</div>`;
        }
        if (flatRows.length === 0) {
            html += `<div class="gantt-section">`;
            html += headerHtml;
            html += `</div>`;
        }
        return html;
    }

    _pdfResourceSection(tasks, resources, statusLabels) {
        const nonPhaseTasks = tasks.filter(t => !t.isPhase);
        let html = `<h2>Ressources</h2><div class="resource-section">`;

        resources.forEach(resource => {
            const assignedTasks = nonPhaseTasks.filter(t =>
                (t.assignees || []).includes(resource.id) || t.assignee === resource.id
            );
            const workload = this._calculateResourceWorkload(resource, assignedTasks);
            const fillColor = workload.percent > 100 ? '#ef4444' : workload.percent > 80 ? '#f59e0b' : '#6366F1';

            html += `<div class="res-card">`;
            html += `<div class="res-header">`;
            html += `<div class="res-avatar" style="background:${resource.color}">${resource.avatar}</div>`;
            html += `<div><div class="res-name">${resource.name}</div><div class="res-role">${resource.role || ''}</div></div>`;
            html += `<div style="margin-left:auto;font-size:10px;color:#64748b">${assignedTasks.length} tâche${assignedTasks.length !== 1 ? 's' : ''}</div>`;
            html += `</div>`;

            html += `<div class="res-workload-label">Charge : ${workload.percent}%${workload.percent > 100 ? ' ⚠ Surcharge' : ''}</div>`;
            html += `<div class="res-workload"><div class="res-workload-fill" style="width:${Math.min(workload.percent, 100)}%;background:${fillColor}"></div></div>`;

            if (assignedTasks.length > 0) {
                assignedTasks.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).forEach(task => {
                    html += `<div class="res-task">`;
                    html += `<span class="res-task-name"><span class="badge badge-${task.status}">${statusLabels[task.status] || task.status}</span> ${task.name}</span>`;
                    html += `<span class="res-task-dates">${formatDateDisplay(task.startDate)} → ${formatDateDisplay(task.endDate)}</span>`;
                    html += `</div>`;
                });
            } else {
                html += `<div class="res-task" style="color:#94a3b8">Aucune tâche assignée</div>`;
            }
            html += `</div>`;
        });

        html += `</div>`;
        return html;
    }

    _pdfTaskRow(task, resources, statusLabels, priorityLabels) {
        const assignees = (task.assignees || []).map(id => {
            const r = resources.find(r => r.id === id);
            return r ? r.name : '';
        }).filter(Boolean).join(', ');
        return `<tr>
<td>&nbsp;&nbsp;${task.name}</td>
<td>${formatDateDisplay(task.startDate)}</td>
<td>${formatDateDisplay(task.endDate)}</td>
<td>${assignees || '—'}</td>
<td><span class="badge badge-${task.status}">${statusLabels[task.status] || task.status}</span></td>
<td><span class="badge badge-${task.priority}">${priorityLabels[task.priority] || task.priority}</span></td>
<td><div class="progress-bar"><div class="progress-fill" style="width:${task.progress}%"></div></div> ${task.progress}%</td>
</tr>`;
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                ganttRenderer.scrollToToday();

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

    _handlePinchZoom(direction) {
        const levels = ['quarter', 'month', 'week', 'day'];
        const current = levels.indexOf(ganttRenderer.zoomLevel);
        const next = direction === 'in'
            ? Math.min(current + 1, levels.length - 1)
            : Math.max(current - 1, 0);
        if (next === current) return;
        const level = levels[next];
        ganttRenderer.setZoom(level);
        ganttRenderer.render();
        ganttRenderer.scrollToToday();
        // Update zoom UI
        $$('.zoom-btn[data-zoom]').forEach(b => b.classList.toggle('active', b.dataset.zoom === level));
        const label = $('.zoom-label');
        if (label) label.textContent = ganttRenderer.zoomConfig[level]?.label || '';
    }

    /* ---- Keyboard Shortcuts ---- */

    _bindKeyboardShortcuts() {
        // Helper to fully block browser-default shortcuts (e.g. Ctrl+N in Edge)
        const _prevent = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

        // Use capture phase on window (earliest possible interception) to beat
        // Edge / Chromium browser-level shortcuts like Ctrl+N
        window.addEventListener('keydown', (e) => {
            // Ctrl+Z: Undo
            if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                _prevent(e);
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
                _prevent(e);
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
                    _prevent(e);
                    searchInput.focus();
                }
            }

            // Ctrl+N: New task
            if (e.ctrlKey && e.key === 'n') {
                _prevent(e);
                this._showAddTaskDialog();
                return;
            }

            // Ctrl+A: Select all tasks (in table view)
            if (e.ctrlKey && e.key === 'a' && this._activeView === 'board') {
                _prevent(e);
                this._selectAllTasks();
            }

            // Delete/Backspace: Delete selected tasks
            if ((e.key === 'Delete' || e.key === 'Backspace') && this._selectedTaskIds.size > 0) {
                const activeEl = document.activeElement;
                const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                if (!isInput) {
                    _prevent(e);
                    this._batchDelete();
                }
            }

            // Escape: Close modals / clear search / close context menu / clear selection
            if (e.key === 'Escape') {
                if (this._selectedTaskIds.size > 0) {
                    this._clearSelection();
                    return;
                }
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
                    if (e.key === '?') this._showKeyboardHelp();
                }
            }
        }, { capture: true });
    }

    _showKeyboardHelp() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        const shortcuts = [
            ['Ctrl+N', 'Nouvelle tâche'],
            ['Ctrl+Z', 'Annuler'],
            ['Ctrl+Y', 'Rétablir'],
            ['Ctrl+F', 'Rechercher'],
            ['Ctrl+D', 'Mode sombre/clair'],
            ['1 / 2 / 3', 'Changer de vue'],
            ['Suppr', 'Supprimer la sélection'],
            ['Échap', 'Fermer / Annuler'],
            ['?', 'Afficher cette aide'],
        ];
        const rows = shortcuts.map(([key, desc]) =>
            `<tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap"><kbd style="background:var(--bg-muted,#f0f0f0);padding:2px 8px;border-radius:4px;font-size:12px;border:1px solid var(--border-default,#e0e0e0)">${key}</kbd></td><td style="padding:6px 0;font-size:13px">${desc}</td></tr>`
        ).join('');
        overlay.innerHTML = `
            <div class="modal" style="max-width:420px" role="dialog" aria-modal="true" aria-label="Raccourcis clavier">
                <div class="modal-header">
                    <h2 class="modal-title">Raccourcis clavier</h2>
                    <button class="icon-btn kbd-close" aria-label="Fermer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
                <div class="modal-body" style="padding:12px 20px 20px">
                    <table style="width:100%">${rows}</table>
                    <button class="btn btn-secondary" id="restartTour" style="margin-top:16px;width:100%">Relancer le guide de démarrage</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.kbd-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#restartTour').addEventListener('click', () => {
            close();
            onboarding.start();
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
        // Update notification badge
        this._updateNotifications();
    }

    /* ---- Notifications ---- */

    _notifKey(n) {
        return `${n.type}:${n.projectId || ''}:${n.taskId || ''}`;
    }

    _getDismissedNotifs() {
        return this._dismissedNotifs || (this._dismissedNotifs = new Set(
            JSON.parse(localStorage.getItem('gantt_dismissed_notifs') || '[]')
        ));
    }

    _dismissNotification(key) {
        const dismissed = this._getDismissedNotifs();
        dismissed.add(key);
        localStorage.setItem('gantt_dismissed_notifs', JSON.stringify([...dismissed]));
        this._updateNotifications();
    }

    _getNotifications() {
        const today = formatDateISO(new Date());
        const soon = formatDateISO(addDays(new Date(), 3));
        const notifications = [];
        const dismissed = this._getDismissedNotifs();

        const projects = store.getProjects();
        projects.forEach(p => {
            const tasks = store.getTasks(p.id);
            const nonPhase = tasks.filter(t => !t.isPhase);

            // Overdue tasks
            nonPhase.filter(t => t.endDate && t.endDate < today && t.progress < 100).forEach(t => {
                const days = daysBetween(new Date(t.endDate), new Date());
                notifications.push({
                    type: 'danger',
                    icon: '\u26A0',
                    text: `<strong>${t.name}</strong> en retard de ${days}j`,
                    sub: p.name,
                    taskId: t.id,
                    projectId: p.id,
                });
            });

            // Milestones approaching (within 3 days)
            nonPhase.filter(t => t.isMilestone && t.endDate >= today && t.endDate <= soon && t.progress < 100).forEach(t => {
                const days = daysBetween(new Date(), new Date(t.endDate));
                notifications.push({
                    type: 'warning',
                    icon: '\u25C6',
                    text: `Jalon <strong>${t.name}</strong> dans ${days}j`,
                    sub: p.name,
                    taskId: t.id,
                    projectId: p.id,
                });
            });

            // Permit alerts
            const permitNotifs = store.getPermitNotifications(7);
            permitNotifs.forEach(pn => {
                const iconMap = { permit_decision: '\uD83D\uDCC4', permit_suspended: '\u23F8', permit_appeal: '\u2696', permit_appeal_cleared: '\u2705', permit_expiry: '\u23F0' };
                const typeMap = { urgent: 'danger', warning: 'warning', info: 'info', success: 'success' };
                notifications.push({
                    type: typeMap[pn.level] || 'info',
                    icon: iconMap[pn.type] || '\uD83D\uDCC4',
                    text: pn.message,
                    sub: p.name,
                    taskId: pn.taskId,
                    projectId: p.id,
                });
            });

            // Budget alert (based on computed costs)
            const projCosts = store.getTaskCosts(p.id);
            if (p.budget > 0 && projCosts.totalCostDone > 0) {
                const pct = Math.round((projCosts.totalCostDone / p.budget) * 100);
                if (pct > 90) {
                    notifications.push({
                        type: pct >= 100 ? 'danger' : 'warning',
                        icon: getCurrencySymbol(),
                        text: `Budget <strong>${p.name}</strong> à ${pct}%`,
                        sub: `${formatCurrency(projCosts.totalCostDone)} / ${formatCurrency(p.budget)}`,
                        projectId: p.id,
                    });
                }
            }
        });

        return notifications.filter(n => !dismissed.has(this._notifKey(n)));
    }

    _updateNotifications() {
        const badge = $('#notifBadge');
        if (!badge) return;
        const notifs = this._getNotifications();
        if (notifs.length > 0) {
            badge.textContent = notifs.length > 99 ? '99+' : notifs.length;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }

    _bindNotifications() {
        const btn = $('#notifBtn');
        if (!btn) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleNotifPanel();
        });

        document.addEventListener('click', () => {
            const panel = document.getElementById('notifPanel');
            if (panel) panel.remove();
        });
    }

    _toggleNotifPanel() {
        const existing = document.getElementById('notifPanel');
        if (existing) { existing.remove(); return; }

        const btn = $('#notifBtn');
        const rect = btn.getBoundingClientRect();

        const panel = document.createElement('div');
        panel.id = 'notifPanel';
        panel.className = 'notif-panel';
        panel.style.right = (window.innerWidth - rect.right) + 'px';
        panel.style.top = (rect.bottom + 6) + 'px';
        panel.addEventListener('click', (e) => e.stopPropagation());

        const title = document.createElement('div');
        title.className = 'notif-panel-title';
        title.textContent = 'Notifications';
        panel.appendChild(title);

        const notifs = this._getNotifications();
        if (notifs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'notif-empty';
            empty.textContent = 'Aucune alerte pour le moment';
            panel.appendChild(empty);
        } else {
            notifs.forEach(n => {
                const item = document.createElement('div');
                item.className = 'notif-item';
                if (n.taskId) item.style.cursor = 'pointer';

                item.innerHTML = `<div class="notif-icon ${n.type}">${n.icon}</div>` +
                    `<div class="notif-text">${n.text}` +
                    (n.sub ? `<div class="notif-sub">${n.sub}</div>` : '') +
                    `</div>` +
                    `<button class="notif-dismiss" title="Supprimer">&times;</button>`;

                const dismissBtn = item.querySelector('.notif-dismiss');
                dismissBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.style.transition = 'opacity .2s, max-height .2s';
                    item.style.opacity = '0';
                    item.style.maxHeight = '0';
                    item.style.overflow = 'hidden';
                    setTimeout(() => {
                        item.remove();
                        this._dismissNotification(this._notifKey(n));
                        // If no more items, show empty state
                        if (!panel.querySelector('.notif-item')) {
                            const empty = document.createElement('div');
                            empty.className = 'notif-empty';
                            empty.textContent = 'Aucune alerte pour le moment';
                            panel.appendChild(empty);
                        }
                    }, 200);
                });

                if (n.taskId) {
                    item.addEventListener('click', () => {
                        panel.remove();
                        if (n.projectId) {
                            store.setActiveProject(n.projectId);
                            ganttRenderer.render();
                            this._renderProjectName();
                        }
                        taskModal.openEdit(n.taskId);
                    });
                }
                panel.appendChild(item);
            });
        }

        document.body.appendChild(panel);
    }

    /* ---- Costs View (5e onglet) ---- */

    _renderCostsView() {
        const container = $('#costsView');
        if (!container) return;

        const allProjects = store.getProjects();
        let filterId = this._costsFilterProjectId;
        if (filterId !== 'all' && !allProjects.find(p => p.id === filterId)) {
            filterId = 'all';
            this._costsFilterProjectId = 'all';
        }
        const projects = filterId === 'all' ? allProjects : allProjects.filter(p => p.id === filterId);

        // Aggregate costs across filtered projects
        let allCostTasks = [];
        const phaseMap = new Map();
        projects.forEach(p => {
            const costs = store.getTaskCosts(p.id);
            const tasks = store.getTasks(p.id);
            tasks.filter(t => t.isPhase).forEach(ph => phaseMap.set(ph.id, ph));
            allCostTasks = allCostTasks.concat(costs.tasks);
        });

        const totalEstimated = allCostTasks.reduce((s, tc) => s + tc.cost, 0);
        const totalActual = allCostTasks.reduce((s, tc) => {
            return s + (typeof tc.task.actualCost === 'number' ? tc.task.actualCost : tc.costDone);
        }, 0);
        const variance = totalEstimated - totalActual;
        const pctConsumed = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;

        // Variance color
        const varianceColor = variance < 0 ? '#EF4444' : variance < totalEstimated * 0.1 ? '#F59E0B' : '#10B981';
        const varianceIcon = variance < 0 ? '&#9650;' : variance > 0 ? '&#9660;' : '&#9644;';

        const fmt = (v) => formatCurrency(v);

        // Group tasks by phase
        const grouped = new Map(); // phaseId|'__none__' -> { phase, items }
        allCostTasks.forEach(tc => {
            const parentId = tc.task.parentId;
            const key = parentId && phaseMap.has(parentId) ? parentId : '__none__';
            if (!grouped.has(key)) {
                grouped.set(key, {
                    phase: key !== '__none__' ? phaseMap.get(key) : null,
                    items: [],
                });
            }
            grouped.get(key).items.push(tc);
        });

        // Build table rows with phase grouping
        let tableRows = '';
        for (const [key, group] of grouped) {
            const groupEstimated = group.items.reduce((s, tc) => s + tc.cost, 0);
            const groupActual = group.items.reduce((s, tc) => s + (typeof tc.task.actualCost === 'number' ? tc.task.actualCost : tc.costDone), 0);
            const groupVariance = groupEstimated - groupActual;
            const gvColor = groupVariance < 0 ? '#EF4444' : groupVariance < groupEstimated * 0.1 ? '#F59E0B' : '#10B981';

            if (group.phase) {
                const groupFixed = group.items.reduce((s, tc) => s + (tc.fixedCost || 0), 0);
                tableRows += `<tr class="costs-phase-row">
                    <td colspan="4" class="costs-phase-name">${group.phase.name}</td>
                    <td style="text-align:right;font-weight:600;">${groupFixed > 0 ? fmt(groupFixed) : '—'}</td>
                    <td style="text-align:right;font-weight:600;">${fmt(groupEstimated)}</td>
                    <td style="text-align:right;font-weight:600;">${fmt(groupActual)}</td>
                    <td style="text-align:right;font-weight:600;color:${gvColor}">${groupVariance >= 0 ? '+' : ''}${fmt(groupVariance)}</td>
                </tr>`;
            }

            group.items.forEach(tc => {
                const resNames = tc.assignedResources.map(r => r.name).join(', ') || '<em class="costs-no-resource">—</em>';
                const rates = tc.assignedResources.map(r => formatRate(r.rateType === 'daily' ? r.dailyRate : r.hourlyRate, r.rateType === 'daily' ? 'daily' : 'hourly')).join(', ') || '—';
                const actual = typeof tc.task.actualCost === 'number' ? tc.task.actualCost : tc.costDone;
                const ecart = tc.cost - actual;
                const ecartColor = ecart < 0 ? '#EF4444' : ecart < tc.cost * 0.1 ? '#F59E0B' : '#10B981';

                tableRows += `<tr class="costs-task-row${group.phase ? ' costs-task-indented' : ''}" data-task-id="${tc.task.id}">
                    <td class="costs-task-name">${tc.task.name}</td>
                    <td>${resNames}</td>
                    <td style="text-align:center;">${tc.durationDays} j</td>
                    <td style="text-align:center;">${rates}</td>
                    <td style="text-align:right;color:${tc.fixedCost > 0 ? 'var(--text-primary)' : 'var(--text-muted, #999)'};">${tc.fixedCost > 0 ? fmt(tc.fixedCost) : '—'}</td>
                    <td style="text-align:right;font-weight:600;">${fmt(tc.cost)}</td>
                    <td style="text-align:right;">
                        <input type="number" class="costs-actual-input" data-task-id="${tc.task.id}"
                            value="${typeof tc.task.actualCost === 'number' ? tc.task.actualCost : Math.round(tc.costDone)}"
                            min="0" step="1" title="Coût réel (éditable)" />
                    </td>
                    <td style="text-align:right;color:${ecartColor};font-weight:500;">
                        ${ecart >= 0 ? '+' : ''}${fmt(ecart)}
                    </td>
                </tr>`;
            });
        }

        container.className = 'costs-view';
        container.innerHTML = `
        <div class="costs-header">
            <h2 class="costs-title">Suivi des coûts</h2>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <label for="costsProjectFilter" style="font-size:13px; font-weight:600; color:var(--text-secondary);">Filtrer par projet :</label>
                <select id="costsProjectFilter" class="filter-select" style="min-width:200px;">
                    <option value="all"${filterId === 'all' ? ' selected' : ''}>Tous les projets</option>
                    ${allProjects.map(p => `<option value="${p.id}"${filterId === p.id ? ' selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="costs-kpi-grid">
                <div class="costs-kpi">
                    <div class="costs-kpi-label">Budget total (estimé)</div>
                    <div class="costs-kpi-value">${fmt(totalEstimated)}</div>
                </div>
                <div class="costs-kpi">
                    <div class="costs-kpi-label">Coût réel (dépensé)</div>
                    <div class="costs-kpi-value">${fmt(totalActual)}</div>
                </div>
                <div class="costs-kpi">
                    <div class="costs-kpi-label">Écart (variance)</div>
                    <div class="costs-kpi-value" style="color:${varianceColor}">
                        <span>${varianceIcon}</span> ${variance >= 0 ? '+' : ''}${fmt(variance)}
                    </div>
                </div>
                <div class="costs-kpi costs-kpi-progress">
                    <div class="costs-kpi-label">% consommé</div>
                    <div class="costs-kpi-value">${pctConsumed}%</div>
                    <div class="costs-progress-bar">
                        <div class="costs-progress-fill" style="width:${Math.min(pctConsumed, 100)}%;background:${pctConsumed > 100 ? '#EF4444' : pctConsumed > 75 ? '#F59E0B' : '#10B981'};"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="costs-table-wrap">
            <table class="cost-table costs-full-table">
                <thead>
                    <tr>
                        <th>Tâche</th>
                        <th>Ressource(s)</th>
                        <th style="text-align:center;">Durée (j)</th>
                        <th style="text-align:center;">Taux horaire</th>
                        <th style="text-align:right;">Coût fixe</th>
                        <th style="text-align:right;">Coût estimé total</th>
                        <th style="text-align:right;">Coût réel</th>
                        <th style="text-align:right;">Écart</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="4" style="font-weight:700;">Total</td>
                        <td style="text-align:right;font-weight:700;">${fmt(allCostTasks.reduce((s, tc) => s + (tc.fixedCost || 0), 0))}</td>
                        <td style="text-align:right;font-weight:700;">${fmt(totalEstimated)}</td>
                        <td style="text-align:right;font-weight:700;">${fmt(totalActual)}</td>
                        <td style="text-align:right;font-weight:700;color:${varianceColor}">${variance >= 0 ? '+' : ''}${fmt(variance)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;

        // Bind project filter
        const costsFilterSelect = container.querySelector('#costsProjectFilter');
        if (costsFilterSelect) {
            costsFilterSelect.addEventListener('change', () => {
                this._costsFilterProjectId = costsFilterSelect.value;
                this._renderCostsView();
            });
        }

        // Bind actual cost edits
        container.querySelectorAll('.costs-actual-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const taskId = e.target.dataset.taskId;
                const val = parseFloat(e.target.value) || 0;
                store.updateTask(taskId, { actualCost: val });
                this._renderCostsView();
            });
        });

        // Click on task row to open edit modal
        container.querySelectorAll('.costs-task-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.costs-actual-input')) return;
                const taskId = row.dataset.taskId;
                if (taskId) taskModal.openEdit(taskId);
            });
        });
    }

    /* ---- Dashboard ---- */

    _renderDashboard() {
        const container = $('#dashboardView');
        if (!container) return;

        const allProjects = store.getProjects();
        let filterId = this._dashboardFilterProjectId;
        if (filterId !== 'all' && !allProjects.find(p => p.id === filterId)) {
            filterId = 'all';
            this._dashboardFilterProjectId = 'all';
        }
        const projects = filterId === 'all' ? allProjects : allProjects.filter(p => p.id === filterId);
        const allNotifs = this._getNotifications().filter(n => filterId === 'all' || n.projectId === filterId);
        const today = formatDateISO(new Date());

        // Global KPIs across filtered projects
        let totalTasks = 0, completedTasks = 0, activeTasks = 0, totalProgress = 0, projectCount = projects.length;
        let totalBudget = 0, totalBudgetUsed = 0;
        const projectStats = [];

        projects.forEach(p => {
            const tasks = store.getTasks(p.id).filter(t => !t.isPhase);
            const done = tasks.filter(t => t.progress >= 100).length;
            const active = tasks.length - done;
            const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length) : 0;
            const overdue = tasks.filter(t => t.endDate && t.endDate < today && t.progress < 100).length;
            const costs = store.getTaskCosts(p.id);

            totalTasks += tasks.length;
            completedTasks += done;
            activeTasks += active;
            totalProgress += avg;
            totalBudget += costs.totalCost;
            totalBudgetUsed += costs.totalCostDone;

            projectStats.push({ project: p, taskCount: tasks.length, done, active, progress: avg, overdue, costs });
        });

        const avgProgress = projectCount ? Math.round(totalProgress / projectCount) : 0;
        const budgetPct = totalBudget > 0 ? Math.round((totalBudgetUsed / totalBudget) * 100) : 0;

        // Gather upcoming/overdue tasks across all projects for the dashboard
        const allUpcoming = [];
        projects.forEach(p => {
            store.getTasks(p.id).filter(t => !t.isPhase && t.progress < 100).forEach(t => {
                const daysLeft = Math.ceil((new Date(t.endDate) - new Date()) / (1000 * 60 * 60 * 24));
                allUpcoming.push({ ...t, projectName: p.name, daysLeft });
            });
        });
        allUpcoming.sort((a, b) => a.daysLeft - b.daysLeft);
        const upcomingItems = allUpcoming.slice(0, 10);

        container.innerHTML = `
        <div class="dashboard-grid">
            <!-- Project filter -->
            <div style="grid-column: 1 / -1; display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                <label for="dashboardProjectFilter" style="font-size:13px; font-weight:600; color:var(--text-secondary);">Filtrer par projet :</label>
                <select id="dashboardProjectFilter" class="filter-select" style="min-width:200px;">
                    <option value="all"${filterId === 'all' ? ' selected' : ''}>Tous les projets</option>
                    ${allProjects.map(p => `<option value="${p.id}"${filterId === p.id ? ' selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <!-- KPI Cards -->
            <div class="dashboard-card" style="grid-column: 1 / -1;">
                <h3>Vue d'ensemble</h3>
                <div class="dashboard-kpi-grid">
                    <div class="dashboard-kpi">
                        <div class="kpi-value">${projectCount}</div>
                        <div class="kpi-label">Projets</div>
                    </div>
                    <div class="dashboard-kpi">
                        <div class="kpi-value">${totalTasks}</div>
                        <div class="kpi-label">Tâches totales</div>
                    </div>
                    <div class="dashboard-kpi">
                        <div class="kpi-value">${activeTasks}</div>
                        <div class="kpi-label">Tâches actives</div>
                    </div>
                    <div class="dashboard-kpi">
                        <div class="kpi-value">${completedTasks}</div>
                        <div class="kpi-label">Terminées</div>
                    </div>
                    <div class="dashboard-kpi">
                        <div class="kpi-value">${avgProgress}%</div>
                        <div class="kpi-label">Progression moy.</div>
                    </div>
                    <div class="dashboard-kpi">
                        <div class="kpi-value" style="${budgetPct > 90 ? 'color:#EF4444' : budgetPct > 75 ? 'color:#F59E0B' : ''}">${totalBudget > 0 ? budgetPct + '%' : '-'}</div>
                        <div class="kpi-label">Budget consommé</div>
                    </div>
                    <div class="dashboard-kpi">
                        <div class="kpi-value">${totalBudget > 0 ? formatCurrency(totalBudget) : '-'}</div>
                        <div class="kpi-label">Budget total estimé</div>
                    </div>
                </div>
            </div>

            <!-- Projects breakdown -->
            <div class="dashboard-card">
                <h3>Projets (${projectCount})</h3>
                ${projectStats.map(ps => {
                    const color = ps.progress >= 100 ? '#10B981' : ps.overdue > 0 ? '#EF4444' : '#6366F1';
                    return `<div class="dashboard-project-row" data-project-id="${ps.project.id}" style="cursor:pointer;">
                        <div class="dashboard-project-name">${ps.project.name}</div>
                        <div class="dashboard-progress-bar">
                            <div class="dashboard-progress-fill" style="width:${ps.progress}%;background:${color};"></div>
                        </div>
                        <div class="dashboard-progress-pct" style="color:${color}">${ps.progress}%</div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Alerts -->
            <div class="dashboard-card">
                <h3>Alertes (${allNotifs.length})</h3>
                ${allNotifs.length === 0
                    ? '<div class="notif-empty">Aucune alerte</div>'
                    : `<ul class="dashboard-alert-list">${allNotifs.slice(0, 15).map(n => {
                        const dotColor = n.type === 'danger' ? 'red' : n.type === 'warning' ? 'orange' : 'blue';
                        return `<li class="dashboard-alert-item">
                            <span class="dashboard-alert-dot ${dotColor}"></span>
                            <span>${n.text}${n.sub ? ` <span style="color:var(--text-tertiary);font-size:11px;">- ${n.sub}</span>` : ''}</span>
                        </li>`;
                    }).join('')}${allNotifs.length > 15 ? `<li class="dashboard-alert-item" style="color:var(--text-tertiary);">+${allNotifs.length - 15} autres alertes</li>` : ''}</ul>`}
            </div>

            <!-- Tâches à venir / en retard -->
            <div class="dashboard-card" style="grid-column: 1 / -1;">
                <h3>Tâches prioritaires (${upcomingItems.length})</h3>
                ${upcomingItems.length === 0
                    ? '<div class="notif-empty">Aucune tâche en cours</div>'
                    : `<div style="overflow-x:auto;">
                        <table class="cost-table">
                            <thead><tr>
                                <th>Tâche</th>
                                <th>Projet</th>
                                <th style="text-align:center;">Priorité</th>
                                <th style="text-align:center;">Échéance</th>
                                <th style="text-align:center;">Progression</th>
                                <th style="text-align:center;">Statut</th>
                            </tr></thead>
                            <tbody>${upcomingItems.map(t => {
                                const isOverdue = t.daysLeft < 0;
                                const isUrgent = t.daysLeft >= 0 && t.daysLeft <= 3;
                                const deadlineColor = isOverdue ? '#EF4444' : isUrgent ? '#F59E0B' : 'var(--text-secondary)';
                                const deadlineText = isOverdue ? `<strong>En retard (${Math.abs(t.daysLeft)}j)</strong>` : t.daysLeft === 0 ? '<strong>Aujourd\'hui</strong>' : `J-${t.daysLeft}`;
                                const priorityColors = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
                                const priorityLabels = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };
                                const pColor = priorityColors[t.priority] || '#64748B';
                                const barColor = t.progress > 0 ? '#6366F1' : 'var(--border-default,#E2E8F0)';
                                return `<tr>
                                    <td style="font-weight:500;">${t.name}</td>
                                    <td style="color:var(--text-secondary);font-size:12px;">${t.projectName}</td>
                                    <td style="text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;background:${pColor}15;color:${pColor};border:1px solid ${pColor}30;">${priorityLabels[t.priority] || t.priority}</span></td>
                                    <td style="text-align:center;color:${deadlineColor};font-size:12px;">${deadlineText}</td>
                                    <td style="text-align:center;">
                                        <div style="display:flex;align-items:center;gap:6px;justify-content:center;">
                                            <div style="width:60px;height:6px;background:var(--bg-muted,#f1f5f9);border-radius:3px;overflow:hidden;">
                                                <div style="width:${t.progress}%;height:100%;background:${barColor};border-radius:3px;"></div>
                                            </div>
                                            <span style="font-size:11px;color:var(--text-secondary);">${t.progress}%</span>
                                        </div>
                                    </td>
                                    <td style="text-align:center;font-size:12px;">${t.status === 'in_progress' ? 'En cours' : t.status === 'done' ? 'Terminé' : 'À faire'}</td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>`}
            </div>

            <!-- Tableau des coûts par tâche -->
            ${this._renderDashboardCostTable(projectStats)}

            <!-- Récapitulatif Permis -->
            ${this._renderDashboardPermitSection(projects)}
        </div>`;

        // Click handler to switch to project
        container.querySelectorAll('[data-project-id]').forEach(row => {
            row.addEventListener('click', () => {
                store.setActiveProject(row.dataset.projectId);
                ganttRenderer.render();
                this._renderStats();
                this._renderProjectName();
                // Switch to timeline view
                this._switchView('timeline');
                const tabs = $$('.tab[role="tab"]');
                tabs.forEach(t => {
                    t.classList.toggle('active', t.dataset.view === 'timeline');
                    t.setAttribute('aria-selected', t.dataset.view === 'timeline' ? 'true' : 'false');
                });
            });
        });

        // Project filter dropdown
        const filterSelect = container.querySelector('#dashboardProjectFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                this._dashboardFilterProjectId = filterSelect.value;
                this._renderDashboard();
            });
        }

        // PDF export button for permits
        const permitPdfBtn = container.querySelector('#dashboardPermitPdfBtn');
        if (permitPdfBtn) {
            permitPdfBtn.addEventListener('click', () => this._exportPermitsPDF());
        }
    }

    _renderDashboardCostTable(projectStats) {
        // Gather all task costs across projects (only tasks with actual costs)
        const allTaskCosts = [];
        projectStats.forEach(ps => {
            if (!ps.costs) return;
            ps.costs.tasks.forEach(tc => {
                if (tc.cost > 0) allTaskCosts.push({ ...tc, projectName: ps.project.name });
            });
        });

        if (allTaskCosts.length === 0) {
            return `<div class="dashboard-card" style="grid-column: 1 / -1;">
                <h3>Coûts par tâche</h3>
                <div class="notif-empty">Aucune tâche avec des coûts (ressources ou coûts fixes)</div>
            </div>`;
        }

        // Sort by cost descending
        allTaskCosts.sort((a, b) => b.cost - a.cost);

        const totalCost = allTaskCosts.reduce((s, tc) => s + tc.cost, 0);
        const totalCostDone = allTaskCosts.reduce((s, tc) => s + tc.costDone, 0);
        const formatCost = (v) => formatCurrency(v);

        const totalFixed = allTaskCosts.reduce((s, tc) => s + (tc.fixedCost || 0), 0);

        const rows = allTaskCosts.map(tc => {
            const resNames = tc.assignedResources.map(r => r.name).join(', ') || '<em>—</em>';
            const rates = tc.assignedResources.map(r => formatRate(r.hourlyRate, 'hourly')).join(', ') || '—';
            const pct = tc.cost > 0 ? Math.round((tc.costDone / tc.cost) * 100) : 0;
            const barColor = tc.task.progress >= 100 ? '#10B981' : tc.task.progress > 0 ? '#6366F1' : 'var(--border-default, #E2E8F0)';
            return `<tr>
                <td style="font-weight:500;">${tc.task.name}</td>
                <td>${resNames}</td>
                <td style="text-align:center;">${rates}</td>
                <td style="text-align:center;">${tc.durationDays}j</td>
                <td style="text-align:right;color:${tc.fixedCost > 0 ? 'var(--text-primary)' : 'var(--text-muted,#999)'};">${tc.fixedCost > 0 ? formatCost(tc.fixedCost) : '—'}</td>
                <td style="text-align:right;font-weight:600;">${formatCost(tc.cost)}</td>
                <td style="text-align:right;color:var(--text-secondary);">${formatCost(tc.costDone)}</td>
                <td style="width:80px;">
                    <div style="background:var(--bg-muted,#f1f5f9);border-radius:4px;height:6px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:${barColor};border-radius:4px;"></div>
                    </div>
                </td>
            </tr>`;
        }).join('');

        return `<div class="dashboard-card" style="grid-column: 1 / -1;">
            <h3>Coûts par tâche</h3>
            <div style="overflow-x:auto;">
                <table class="cost-table">
                    <thead>
                        <tr>
                            <th>Tâche</th>
                            <th>Ressource(s)</th>
                            <th style="text-align:center;">Taux</th>
                            <th style="text-align:center;">Durée</th>
                            <th style="text-align:right;">Coût fixe</th>
                            <th style="text-align:right;">Coût total</th>
                            <th style="text-align:right;">Consommé</th>
                            <th style="text-align:center;">Avancement</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="font-weight:700;border-top:2px solid var(--border-default,#E2E8F0);">
                            <td colspan="4">Total</td>
                            <td style="text-align:right;">${totalFixed > 0 ? formatCost(totalFixed) : '—'}</td>
                            <td style="text-align:right;">${formatCost(totalCost)}</td>
                            <td style="text-align:right;">${formatCost(totalCostDone)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>`;
    }

    _renderDashboardPermitSection(projects) {
        const allPermits = [];
        projects.forEach(p => {
            const tasks = store.getTasks(p.id);
            tasks.filter(t => t.isPermit).forEach(t => {
                allPermits.push({ ...t, projectName: p.name });
            });
        });

        if (allPermits.length === 0) {
            return `<div class="dashboard-card" style="grid-column: 1 / -1;">
                <h3>Récapitulatif Permis</h3>
                <div class="notif-empty">Aucun permis de construire dans les projets</div>
            </div>`;
        }

        // Sort by status order then by deposit date
        allPermits.sort((a, b) => {
            const oa = (PERMIT_STATUSES[a.permitStatus] || {}).order || 0;
            const ob = (PERMIT_STATUSES[b.permitStatus] || {}).order || 0;
            if (oa !== ob) return oa - ob;
            return (a.depositDate || '').localeCompare(b.depositDate || '');
        });

        // KPIs
        const total = allPermits.length;
        const granted = allPermits.filter(p => p.permitStatus === 'granted' || p.permitStatus === 'granted_conditions').length;
        const pending = allPermits.filter(p => ['submitted', 'completeness', 'additional_docs', 'under_review'].includes(p.permitStatus)).length;
        const refused = allPermits.filter(p => p.permitStatus === 'refused').length;
        const appealCleared = allPermits.filter(p => p.permitStatus === 'appeal_cleared').length;

        const rows = allPermits.map(permit => {
            const typeInfo = PERMIT_TYPES[permit.permitType] || { label: permit.permitType };
            const statusInfo = PERMIT_STATUSES[permit.permitStatus] || { label: permit.permitStatus, color: '#64748B' };
            const deadlines = calculatePermitDeadlines(permit);
            let nextDeadline = '';
            if (deadlines.suspended) {
                nextDeadline = '<span style="color:#F59E0B;">Suspendu</span>';
            } else if (deadlines.decisionDeadline && (permit.permitStatus !== 'granted' && permit.permitStatus !== 'granted_conditions' && permit.permitStatus !== 'refused')) {
                const dl = new Date(deadlines.decisionDeadline);
                const daysLeft = Math.ceil((dl - new Date()) / (1000 * 60 * 60 * 24));
                const color = daysLeft <= 3 ? '#EF4444' : daysLeft <= 14 ? '#F59E0B' : 'var(--text-secondary)';
                nextDeadline = `<span style="color:${color};">Décision: ${new Date(deadlines.decisionDeadline).toLocaleDateString('fr-FR')}${daysLeft >= 0 ? ` (J-${daysLeft})` : ' (dépassé)'}</span>`;
            } else if (deadlines.appealEndDate && (permit.permitStatus === 'granted' || permit.permitStatus === 'granted_conditions')) {
                nextDeadline = `Purge recours: ${new Date(deadlines.appealEndDate).toLocaleDateString('fr-FR')}`;
            } else if (deadlines.expiryDate && permit.permitStatus === 'appeal_cleared') {
                nextDeadline = `Péremption: ${new Date(deadlines.expiryDate).toLocaleDateString('fr-FR')}`;
            }

            return `<tr class="dashboard-permit-row">
                <td style="font-weight:500;">${permit.name}</td>
                <td style="color:var(--text-secondary);">${permit.projectName}</td>
                <td>${typeInfo.label}</td>
                <td><span class="dashboard-permit-badge" style="background:${statusInfo.color}20;color:${statusInfo.color};border:1px solid ${statusInfo.color}40;">${statusInfo.label}</span></td>
                <td style="color:var(--text-secondary);">${permit.depositDate ? new Date(permit.depositDate).toLocaleDateString('fr-FR') : '-'}</td>
                <td style="font-size:11px;">${nextDeadline || '-'}</td>
            </tr>`;
        }).join('');

        return `<div class="dashboard-card" style="grid-column: 1 / -1;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3>Récapitulatif Permis (${total})</h3>
                <button id="dashboardPermitPdfBtn" class="btn btn-secondary" style="font-size:12px;padding:4px 12px;display:flex;align-items:center;gap:6px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M6 9l6 6 6-6"/></svg>
                    Export PDF
                </button>
            </div>
            <div class="dashboard-permit-kpis">
                <div class="dashboard-permit-kpi"><span class="kpi-value" style="color:#3B82F6;">${total}</span><span class="kpi-label">Total</span></div>
                <div class="dashboard-permit-kpi"><span class="kpi-value" style="color:#F59E0B;">${pending}</span><span class="kpi-label">En instruction</span></div>
                <div class="dashboard-permit-kpi"><span class="kpi-value" style="color:#10B981;">${granted}</span><span class="kpi-label">Accordés</span></div>
                <div class="dashboard-permit-kpi"><span class="kpi-value" style="color:#EF4444;">${refused}</span><span class="kpi-label">Refusés</span></div>
                <div class="dashboard-permit-kpi"><span class="kpi-value" style="color:#065F46;">${appealCleared}</span><span class="kpi-label">Purgés</span></div>
            </div>
            <div style="overflow-x:auto;margin-top:12px;">
                <table class="dashboard-permit-table">
                    <thead><tr>
                        <th>Permis</th><th>Projet</th><th>Type</th><th>Statut</th><th>Dépôt</th><th>Échéance</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
    }

    _exportPermitsPDF() {
        const projects = store.getProjects();
        const allPermits = [];
        projects.forEach(p => {
            const tasks = store.getTasks(p.id);
            tasks.filter(t => t.isPermit).forEach(t => {
                allPermits.push({ ...t, projectName: p.name });
            });
        });

        if (allPermits.length === 0) {
            this._showToast('Aucun permis à exporter', 'warning');
            return;
        }

        allPermits.sort((a, b) => {
            const oa = (PERMIT_STATUSES[a.permitStatus] || {}).order || 0;
            const ob = (PERMIT_STATUSES[b.permitStatus] || {}).order || 0;
            if (oa !== ob) return oa - ob;
            return (a.depositDate || '').localeCompare(b.depositDate || '');
        });

        const total = allPermits.length;
        const granted = allPermits.filter(p => p.permitStatus === 'granted' || p.permitStatus === 'granted_conditions').length;
        const pending = allPermits.filter(p => ['submitted', 'completeness', 'additional_docs', 'under_review'].includes(p.permitStatus)).length;
        const refused = allPermits.filter(p => p.permitStatus === 'refused').length;
        const draft = allPermits.filter(p => p.permitStatus === 'draft').length;
        const appealCleared = allPermits.filter(p => p.permitStatus === 'appeal_cleared').length;

        let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Récapitulatif Permis</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:11px;color:#1e293b;padding:30px}
h1{font-size:20px;margin-bottom:4px;color:#6366F1}
h2{font-size:15px;color:#1e293b;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #6366F1}
.subtitle{color:#64748b;font-size:12px;margin-bottom:20px}
.stats{display:flex;gap:16px;margin-bottom:24px;padding:14px;background:#f8fafc;border-radius:8px;flex-wrap:wrap}
.stat{text-align:center;flex:1;min-width:80px}.stat-val{font-size:22px;font-weight:700}.stat-lbl{color:#64748b;font-size:10px;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;color:#64748b}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
tr:nth-child(even){background:#fafbfc}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:600}
.section-title{font-size:13px;font-weight:600;margin:16px 0 8px;color:#334155}
.deadline-warn{color:#F59E0B}.deadline-urgent{color:#EF4444}.deadline-ok{color:#64748b}
.detail-grid{display:grid;grid-template-columns:140px 1fr;gap:4px 12px;font-size:11px;margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:6px;border-left:3px solid #6366F1}
.detail-label{color:#64748b;font-weight:500}.detail-value{color:#1e293b}
.permit-block{margin-bottom:16px;page-break-inside:avoid}
.footer{margin-top:24px;text-align:center;color:#94a3b8;font-size:9px;border-top:1px solid #e2e8f0;padding-top:10px}
@media print{body{padding:15px}@page{margin:10mm;size:A4 portrait}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}}
.page-break{page-break-before:always}
</style></head><body>
<h1>Récapitulatif des Permis de Construire</h1>
<div class="subtitle">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} — ${total} permis sur ${projects.length} projet${projects.length > 1 ? 's' : ''}</div>
<div class="stats">
<div class="stat"><div class="stat-val" style="color:#3B82F6;">${total}</div><div class="stat-lbl">Total permis</div></div>
<div class="stat"><div class="stat-val" style="color:#64748B;">${draft}</div><div class="stat-lbl">En préparation</div></div>
<div class="stat"><div class="stat-val" style="color:#F59E0B;">${pending}</div><div class="stat-lbl">En instruction</div></div>
<div class="stat"><div class="stat-val" style="color:#10B981;">${granted}</div><div class="stat-lbl">Accordés</div></div>
<div class="stat"><div class="stat-val" style="color:#EF4444;">${refused}</div><div class="stat-lbl">Refusés</div></div>
<div class="stat"><div class="stat-val" style="color:#065F46;">${appealCleared}</div><div class="stat-lbl">Purgés de recours</div></div>
</div>

<h2>Tableau récapitulatif</h2>
<table><thead><tr><th>Permis</th><th>Projet</th><th>Type</th><th>Statut</th><th>Dépôt</th><th>Échéance décision</th><th>Purge recours</th><th>Péremption</th></tr></thead><tbody>`;

        allPermits.forEach(permit => {
            const typeInfo = PERMIT_TYPES[permit.permitType] || { label: permit.permitType };
            const statusInfo = PERMIT_STATUSES[permit.permitStatus] || { label: permit.permitStatus, color: '#64748B' };
            const deadlines = calculatePermitDeadlines(permit);

            let decisionCol = '-';
            if (deadlines.suspended) {
                decisionCol = '<span style="color:#F59E0B;">Suspendu</span>';
            } else if (deadlines.decisionDeadline) {
                decisionCol = new Date(deadlines.decisionDeadline).toLocaleDateString('fr-FR');
            }

            html += `<tr>
                <td style="font-weight:500;">${permit.name}</td>
                <td>${permit.projectName}</td>
                <td>${typeInfo.label}</td>
                <td><span class="badge" style="background:${statusInfo.color}20;color:${statusInfo.color};">${statusInfo.label}</span></td>
                <td>${permit.depositDate ? new Date(permit.depositDate).toLocaleDateString('fr-FR') : '-'}</td>
                <td>${decisionCol}</td>
                <td>${deadlines.appealEndDate ? new Date(deadlines.appealEndDate).toLocaleDateString('fr-FR') : '-'}</td>
                <td>${deadlines.expiryDate ? new Date(deadlines.expiryDate).toLocaleDateString('fr-FR') : '-'}</td>
            </tr>`;
        });

        html += `</tbody></table>

<div class="page-break"></div>
<h2>Détail par permis</h2>`;

        allPermits.forEach(permit => {
            const typeInfo = PERMIT_TYPES[permit.permitType] || { label: permit.permitType };
            const statusInfo = PERMIT_STATUSES[permit.permitStatus] || { label: permit.permitStatus, color: '#64748B' };
            const deadlines = calculatePermitDeadlines(permit);

            html += `<div class="permit-block">
                <div class="section-title" style="color:${statusInfo.color};">${permit.name} — ${typeInfo.label}</div>
                <div class="detail-grid">
                    <div class="detail-label">Projet</div><div class="detail-value">${permit.projectName}</div>
                    <div class="detail-label">Type de permis</div><div class="detail-value">${typeInfo.label}</div>
                    <div class="detail-label">Statut</div><div class="detail-value"><span class="badge" style="background:${statusInfo.color}20;color:${statusInfo.color};">${statusInfo.label}</span></div>
                    <div class="detail-label">Secteur ABF</div><div class="detail-value">${permit.abfSector ? 'Oui (+30 jours)' : 'Non'}</div>
                    <div class="detail-label">Date de dépôt</div><div class="detail-value">${permit.depositDate ? new Date(permit.depositDate).toLocaleDateString('fr-FR') : '-'}</div>
                    <div class="detail-label">Complétude</div><div class="detail-value">${permit.completenessDate ? new Date(permit.completenessDate).toLocaleDateString('fr-FR') : '-'}</div>
                    ${permit.additionalDocsRequestDate ? `<div class="detail-label">Pièces demandées</div><div class="detail-value">${new Date(permit.additionalDocsRequestDate).toLocaleDateString('fr-FR')}</div>` : ''}
                    ${permit.additionalDocsResponseDate ? `<div class="detail-label">Pièces fournies</div><div class="detail-value">${new Date(permit.additionalDocsResponseDate).toLocaleDateString('fr-FR')}</div>` : ''}
                    <div class="detail-label">Délai d'instruction</div><div class="detail-value">${deadlines.instructionDays ? deadlines.instructionDays + ' jours' : '-'}</div>
                    <div class="detail-label">Date décision prévue</div><div class="detail-value">${deadlines.suspended ? '<span style="color:#F59E0B;">Suspendu — pièces complémentaires attendues</span>' : deadlines.decisionDeadline ? new Date(deadlines.decisionDeadline).toLocaleDateString('fr-FR') : '-'}</div>
                    ${permit.decisionDate ? `<div class="detail-label">Date décision effective</div><div class="detail-value">${new Date(permit.decisionDate).toLocaleDateString('fr-FR')}</div>` : ''}
                    ${permit.displayStartDate ? `<div class="detail-label">Affichage panneau</div><div class="detail-value">${new Date(permit.displayStartDate).toLocaleDateString('fr-FR')}</div>` : ''}
                    ${deadlines.appealEndDate ? `<div class="detail-label">Fin recours tiers</div><div class="detail-value">${new Date(deadlines.appealEndDate).toLocaleDateString('fr-FR')}</div>` : ''}
                    ${deadlines.expiryDate ? `<div class="detail-label">Péremption</div><div class="detail-value">${new Date(deadlines.expiryDate).toLocaleDateString('fr-FR')}</div>` : ''}
                </div>
            </div>`;
        });

        html += `<div class="footer">Gantt Planner Pro — Récapitulatif Permis — Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
</body></html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.print(); };
        this._showToast('Export PDF des permis prêt', 'success');
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
        input.accept = '.json,.xml,.xlsx,.xls';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const ext = file.name.split('.').pop().toLowerCase();

            if (ext === 'json') {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const parsed = JSON.parse(evt.target.result);
                        if (parsed.type === 'full-backup') {
                            const result = store.importAllProjects(parsed);
                            if (result) {
                                ganttRenderer.render();
                                this._renderStats();
                                this._renderProjectName();
                                this._showToast(`${result.count} projet(s) importé(s)`, 'success');
                            } else {
                                this._showToast('Erreur lors de l\'import multi-projets', 'error');
                            }
                        } else {
                            const result = store.importProject(parsed);
                            if (result) {
                                ganttRenderer.render();
                                this._renderStats();
                                this._renderProjectName();
                                this._showToast(`Projet "${result.name}" importé`, 'success');
                            } else {
                                this._showToast('Erreur lors de l\'import JSON', 'error');
                            }
                        }
                    } catch (e) {
                        console.error('JSON import failed:', e);
                        this._showToast('Erreur lors de l\'import JSON', 'error');
                    }
                };
                reader.readAsText(file);
            } else if (ext === 'xml') {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const result = store.importFromMSProjectXML(evt.target.result);
                    if (result) {
                        ganttRenderer.render();
                        this._renderStats();
                        this._renderProjectName();
                        this._showToast(`Projet "${result.name}" importé depuis MS Project XML`, 'success');
                    } else {
                        this._showToast('Erreur lors de l\'import XML', 'error');
                    }
                };
                reader.readAsText(file);
            } else if (ext === 'xlsx' || ext === 'xls') {
                this._importExcelFile(file);
            } else {
                this._showToast('Format non supporté', 'error');
            }
        });
        input.click();
    }

    async _importExcelFile(file) {
        try {
            // Load SheetJS dynamically if not already loaded
            if (typeof XLSX === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Impossible de charger la bibliothèque Excel'));
                    document.head.appendChild(script);
                });
            }
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (!rows.length) {
                this._showToast('Le fichier Excel est vide', 'error');
                return;
            }

            const result = store.importFromExcel(rows, file.name);
            if (result) {
                ganttRenderer.render();
                this._renderStats();
                this._renderProjectName();
                this._showToast(`Projet "${result.name}" importé depuis Excel (${rows.length} lignes)`, 'success');
            } else {
                this._showToast('Erreur lors de l\'import Excel', 'error');
            }
        } catch (e) {
            console.error('Excel import failed:', e);
            this._showToast('Erreur: ' + e.message, 'error');
        }
    }

    /* ---- Cloud Backup (Google Drive) ---- */

    _showCloudBackupModal() {
        const existing = document.getElementById('cloudBackupModal');
        if (existing) { existing.remove(); return; }

        const overlay = document.createElement('div');
        overlay.id = 'cloudBackupModal';
        overlay.className = 'cloud-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'cloudModalTitle');

        const modal = document.createElement('div');
        modal.className = 'cloud-modal';

        const clientId = localStorage.getItem('gantt-planner-gdrive-clientid');
        if (!clientId) {
            modal.innerHTML = this._gdriveConfigHTML();
        } else if (cloudBackup.isSignedIn()) {
            this._renderCloudPanel(modal);
        } else {
            modal.innerHTML = `
                <div class="cloud-modal-header">
                    <h2 id="cloudModalTitle">Google Drive</h2>
                    <button class="cloud-modal-close" aria-label="Fermer">&times;</button>
                </div>
                <div class="cloud-modal-body">
                    <div class="cloud-modal-loading">Connexion à Google Drive...</div>
                    <button class="btn btn-secondary" id="cloudCancelInit" style="width: 100%; margin-top: 16px; font-size: 12px;">Annuler / Modifier le Client ID</button>
                </div>`;
            const closeBtn = modal.querySelector('.cloud-modal-close');
            if (closeBtn) closeBtn.addEventListener('click', () => {
                document.getElementById('cloudBackupModal')?.remove();
            });
            const cancelBtn = modal.querySelector('#cloudCancelInit');
            if (cancelBtn) cancelBtn.addEventListener('click', () => {
                localStorage.removeItem('gantt-planner-gdrive-clientid');
                modal.innerHTML = this._gdriveConfigHTML();
                this._bindGDriveConfigForm(modal);
            });
            this._initGDriveAndShowPanel(modal, clientId);
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        setTimeout(() => this._bindGDriveConfigForm(modal), 0);
    }

    _gdriveConfigHTML() {
        return `
            <div class="cloud-modal-header">
                <h2 id="cloudModalTitle">Google Drive</h2>
                <button class="cloud-modal-close" aria-label="Fermer">&times;</button>
            </div>
            <div class="cloud-modal-body">
                <div class="cloud-setup-info">
                    <div class="cloud-gdrive-logo">
                        <svg width="40" height="40" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l11.752 23.8z" fill="#ea4335"/>
                            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                            <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                    </div>
                    <h3>Sauvegarde Google Drive</h3>
                    <p>Vos sauvegardes seront stockées dans un dossier <strong>"Gantt Planner Backups"</strong> de votre Google Drive personnel.</p>
                    <div class="cloud-steps-info">
                        <p><strong>Configuration (une seule fois) :</strong></p>
                        <ol>
                            <li>Allez sur <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">console.cloud.google.com</a></li>
                            <li>Créez un projet (ou sélectionnez-en un existant)</li>
                            <li>Activez l'API <strong>Google Drive</strong></li>
                            <li>Créez des <strong>Identifiants → ID client OAuth 2.0</strong> (type : Application Web)</li>
                            <li>Copiez le <strong>Client ID</strong> ci-dessous</li>
                        </ol>
                    </div>
                </div>
                <form id="gdriveConfigForm" class="cloud-config-form">
                    <div class="form-group">
                        <label for="cfgClientId">Client ID Google *</label>
                        <input type="text" id="cfgClientId" required placeholder="123456789-abc.apps.googleusercontent.com">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Connecter à Google Drive</button>
                </form>
            </div>`;
    }

    _bindGDriveConfigForm(modal) {
        const form = modal.querySelector('#gdriveConfigForm');
        if (!form) return;

        const closeBtn = modal.querySelector('.cloud-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            document.getElementById('cloudBackupModal')?.remove();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientId = form.querySelector('#cfgClientId').value.trim();
            if (!clientId) return;

            try {
                form.querySelector('button[type="submit"]').textContent = 'Connexion...';
                localStorage.setItem('gantt-planner-gdrive-clientid', clientId);
                await cloudBackup.init(clientId);
                this._renderCloudPanel(modal);
            } catch (err) {
                this._showToast('Erreur Google Drive: ' + err.message, 'error');
                form.querySelector('button[type="submit"]').textContent = 'Connecter à Google Drive';
            }
        });
    }

    async _initGDriveAndShowPanel(modal, clientId) {
        try {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Délai de connexion dépassé')), 15000)
            );
            await Promise.race([cloudBackup.init(clientId), timeout]);
            this._renderCloudPanel(modal);
        } catch (err) {
            modal.innerHTML = this._gdriveConfigHTML();
            this._bindGDriveConfigForm(modal);
            this._showToast('Erreur Google Drive: ' + err.message, 'error');
        }
    }

    _renderCloudPanel(modal) {
        const user = cloudBackup.getUser();
        const isSignedIn = cloudBackup.isSignedIn();

        modal.innerHTML = `
            <div class="cloud-modal-header">
                <h2 id="cloudModalTitle">Google Drive</h2>
                <button class="cloud-modal-close" aria-label="Fermer">&times;</button>
            </div>
            <div class="cloud-modal-body">
                ${isSignedIn ? this._cloudLoggedInHTML(user) : this._cloudLoginHTML()}
                <div id="cloudBackupList" class="cloud-backup-list"></div>
            </div>`;

        const closeBtn = modal.querySelector('.cloud-modal-close');
        closeBtn.addEventListener('click', () => {
            document.getElementById('cloudBackupModal')?.remove();
        });

        if (isSignedIn) {
            this._bindCloudActions(modal);
            this._refreshBackupList(modal);
        } else {
            this._bindCloudLogin(modal);
        }

        cloudBackup.on('auth', () => {
            this._renderCloudPanel(modal);
        });
    }

    _cloudLoginHTML() {
        return `
            <div class="cloud-auth-section">
                <div class="cloud-gdrive-logo" style="text-align:center; margin-bottom: 16px;">
                    <svg width="36" height="36" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l11.752 23.8z" fill="#ea4335"/>
                        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                        <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                    </svg>
                </div>
                <p>Connectez-vous avec votre compte Google pour sauvegarder vos projets dans Google Drive.</p>
                <button class="btn btn-primary cloud-google-btn" id="cloudGoogleLogin" style="width: 100%; margin-bottom: 12px;">
                    Se connecter avec Google
                </button>
                <button class="btn btn-secondary" id="cloudResetConfig" style="width: 100%; font-size: 12px;">
                    Modifier le Client ID
                </button>
            </div>`;
    }

    _cloudLoggedInHTML(user) {
        const name = user ? (user.displayName || user.email || 'Utilisateur') : 'Utilisateur';
        const email = user && user.email ? `<span class="cloud-user-email">${user.email}</span>` : '';
        return `
            <div class="cloud-user-bar">
                <div class="cloud-user-info">
                    <span class="cloud-user-name">${name}</span>
                    ${email}
                </div>
                <button class="btn btn-secondary btn-sm" id="cloudSignOut">Déconnexion</button>
            </div>
            <div class="cloud-actions">
                <button class="btn btn-primary" id="cloudSaveAll" style="flex: 1;">
                    Sauvegarder tous les projets
                </button>
                <button class="btn btn-secondary" id="cloudSaveCurrent" style="flex: 1;">
                    Sauvegarder projet actif
                </button>
            </div>`;
    }

    _bindCloudLogin(modal) {
        const googleBtn = modal.querySelector('#cloudGoogleLogin');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                try {
                    googleBtn.textContent = 'Connexion...';
                    googleBtn.disabled = true;
                    await cloudBackup.signIn();
                    this._renderCloudPanel(modal);
                } catch (err) {
                    this._showToast('Erreur connexion Google: ' + err.message, 'error');
                    googleBtn.textContent = 'Se connecter avec Google';
                    googleBtn.disabled = false;
                }
            });
        }

        const resetBtn = modal.querySelector('#cloudResetConfig');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                localStorage.removeItem('gantt-planner-gdrive-clientid');
                cloudBackup.signOut();
                modal.innerHTML = this._gdriveConfigHTML();
                this._bindGDriveConfigForm(modal);
            });
        }
    }

    _bindCloudActions(modal) {
        const signOutBtn = modal.querySelector('#cloudSignOut');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                cloudBackup.signOut();
                this._renderCloudPanel(modal);
            });
        }

        const saveAllBtn = modal.querySelector('#cloudSaveAll');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', async () => {
                try {
                    saveAllBtn.textContent = 'Sauvegarde...';
                    saveAllBtn.disabled = true;
                    const data = store.exportAllProjects();
                    const date = new Date().toLocaleDateString('fr-FR');
                    await cloudBackup.saveBackup(`Backup complet - ${date}`, data);
                    this._showToast('Sauvegarde Google Drive réussie', 'success');
                    this._refreshBackupList(modal);
                } catch (err) {
                    this._showToast('Erreur: ' + err.message, 'error');
                } finally {
                    saveAllBtn.textContent = 'Sauvegarder tous les projets';
                    saveAllBtn.disabled = false;
                }
            });
        }

        const saveCurrentBtn = modal.querySelector('#cloudSaveCurrent');
        if (saveCurrentBtn) {
            saveCurrentBtn.addEventListener('click', async () => {
                try {
                    saveCurrentBtn.textContent = 'Sauvegarde...';
                    saveCurrentBtn.disabled = true;
                    const project = store.getActiveProject();
                    const tasks = store.getTasks();
                    const resources = store.getResources();
                    const data = { project, tasks, resources, exportedAt: new Date().toISOString() };
                    await cloudBackup.saveBackup(project.name, data);
                    this._showToast(`"${project.name}" sauvegardé sur Google Drive`, 'success');
                    this._refreshBackupList(modal);
                } catch (err) {
                    this._showToast('Erreur: ' + err.message, 'error');
                } finally {
                    saveCurrentBtn.textContent = 'Sauvegarder projet actif';
                    saveCurrentBtn.disabled = false;
                }
            });
        }
    }

    async _refreshBackupList(modal) {
        const container = modal.querySelector('#cloudBackupList');
        if (!container) return;

        container.innerHTML = '<div class="cloud-loading">Chargement des sauvegardes...</div>';

        try {
            const backups = await cloudBackup.listBackups();
            if (backups.length === 0) {
                container.innerHTML = '<div class="cloud-empty">Aucune sauvegarde dans Google Drive</div>';
                return;
            }

            container.innerHTML = '<h3 class="cloud-list-title">Sauvegardes disponibles</h3>';
            backups.forEach(b => {
                const item = document.createElement('div');
                item.className = 'cloud-backup-item';
                const date = b.createdAt.toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                const size = b.size > 1024 * 1024
                    ? (b.size / (1024 * 1024)).toFixed(1) + ' Mo'
                    : Math.round(b.size / 1024) + ' Ko';

                item.innerHTML = `
                    <div class="cloud-backup-info">
                        <div class="cloud-backup-name">${b.name}</div>
                        <div class="cloud-backup-meta">${date} · ${b.projectCount} projet(s) · ${b.taskCount} tâche(s) · ${size}</div>
                    </div>
                    <div class="cloud-backup-actions">
                        <button class="btn btn-sm btn-primary cloud-restore-btn" data-id="${b.id}">Restaurer</button>
                        <button class="btn btn-sm btn-danger cloud-delete-btn" data-id="${b.id}" aria-label="Supprimer">&times;</button>
                    </div>`;
                container.appendChild(item);
            });

            container.querySelectorAll('.cloud-restore-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    try {
                        btn.textContent = '...';
                        const data = await cloudBackup.loadBackup(id);
                        if (data.type === 'full-backup') {
                            const result = store.importAllProjects(data);
                            if (result) {
                                ganttRenderer.render();
                                this._renderStats();
                                this._renderProjectName();
                                this._showToast(`${result.count} projet(s) restauré(s)`, 'success');
                            }
                        } else {
                            const result = store.importProject(data);
                            if (result) {
                                ganttRenderer.render();
                                this._renderStats();
                                this._renderProjectName();
                                this._showToast(`Projet "${result.name}" restauré`, 'success');
                            }
                        }
                    } catch (err) {
                        this._showToast('Erreur restauration: ' + err.message, 'error');
                    } finally {
                        btn.textContent = 'Restaurer';
                    }
                });
            });

            container.querySelectorAll('.cloud-delete-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Supprimer cette sauvegarde ?')) return;
                    const id = btn.dataset.id;
                    try {
                        await cloudBackup.deleteBackup(id);
                        this._refreshBackupList(modal);
                        this._showToast('Sauvegarde supprimée', 'info');
                    } catch (err) {
                        this._showToast('Erreur: ' + err.message, 'error');
                    }
                });
            });
        } catch (err) {
            container.innerHTML = '<div class="cloud-empty">Erreur de chargement</div>';
            console.error('Failed to load backups:', err);
        }
    }

    /* ---- Critical Path ---- */

    _toggleCriticalPath() {
        this._showCriticalPath = !this._showCriticalPath;
        const btn = $('#criticalPathBtn');
        if (btn) btn.classList.toggle('active', this._showCriticalPath);

        if (this._showCriticalPath) {
            const cp = store.getCriticalPath();
            ganttRenderer.setCriticalPath(cp);
            const total = store.getTasks().filter(t => !t.isPhase).length;
            this._showToast(`Chemin critique : ${cp.length} tâches sur ${total}`, 'info');
        } else {
            ganttRenderer.setCriticalPath(null);
            this._showToast('Chemin critique masqué', 'info');
        }
        ganttRenderer.render();
        this._renderBoardView();
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
        if ($('#filterBar')) return;
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

        // Phase filter
        const phaseGroup = document.createElement('div');
        phaseGroup.className = 'filter-group';
        const phaseLabel = document.createElement('label');
        phaseLabel.className = 'filter-label';
        phaseLabel.textContent = 'Phase';
        phaseGroup.appendChild(phaseLabel);
        const phaseSel = document.createElement('select');
        phaseSel.className = 'select filter-select';
        phaseSel.id = 'filterPhase';
        this._populatePhaseFilter(phaseSel);
        phaseSel.addEventListener('change', () => this._applyFilters());
        phaseGroup.appendChild(phaseSel);
        filterBar.appendChild(phaseGroup);

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

    _populatePhaseFilter(select) {
        const tasks = store.getTasks();
        const phases = tasks.filter(t => t.isPhase);
        select.innerHTML = '<option value="all">Toutes les phases</option><option value="none">Sans phase</option>';
        phases.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
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
        this._filters.phase = $('#filterPhase')?.value || 'all';
        this._filters.priority = $('#filterPriority')?.value || 'all';
        this._filters.dateStart = $('#filterDateStart')?.value || '';
        this._filters.dateEnd = $('#filterDateEnd')?.value || '';

        this._refreshCurrentView();
    }

    _resetFilters() {
        this._filters = { status: 'all', assignee: 'all', phase: 'all', priority: 'all', dateStart: '', dateEnd: '', search: '' };

        const filterStatus = $('#filterStatus');
        const filterAssignee = $('#filterAssignee');
        const filterPhase = $('#filterPhase');
        const filterPriority = $('#filterPriority');
        const filterDateStart = $('#filterDateStart');
        const filterDateEnd = $('#filterDateEnd');
        const searchInput = $('#searchInput');

        if (filterStatus) filterStatus.value = 'all';
        if (filterAssignee) filterAssignee.value = 'all';
        if (filterPhase) filterPhase.value = 'all';
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
                this._refreshCurrentView();
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

        // Duplicate current project
        const dupBtn = document.createElement('button');
        dupBtn.className = 'project-dropdown-item';
        dupBtn.textContent = 'Dupliquer ce projet';
        dupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.remove();
            const dup = store.duplicateProject(activeProject.id);
            if (dup) {
                store.setActiveProject(dup.id);
                ganttRenderer.render();
                this._renderStats();
                this._renderProjectName();
                this._refreshCurrentView();
                this._showToast(`Projet dupliqué : "${dup.name}"`, 'success');
            }
        });
        dropdown.appendChild(dupBtn);

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
        this._refreshCurrentView();
        this._showToast(`Projet "${project.name}" créé`, 'success');
    }

    /* ---- Multi-Selection ---- */

    _toggleTaskSelection(taskId, append = false) {
        if (!append) {
            this._selectedTaskIds.clear();
        }
        if (this._selectedTaskIds.has(taskId)) {
            this._selectedTaskIds.delete(taskId);
        } else {
            this._selectedTaskIds.add(taskId);
        }
        this._updateSelectionUI();
    }

    _selectAllTasks() {
        const tasks = this._getFilteredTasks(false);
        tasks.forEach(t => this._selectedTaskIds.add(t.id));
        this._updateSelectionUI();
    }

    _clearSelection() {
        this._selectedTaskIds.clear();
        this._updateSelectionUI();
    }

    _updateSelectionUI() {
        // Update checkboxes in table view
        $$('.table-select-cb').forEach(cb => {
            cb.checked = this._selectedTaskIds.has(cb.dataset.taskId);
        });

        // Update header checkbox
        const headerCb = $('#tableSelectAll');
        if (headerCb) {
            const tasks = this._getFilteredTasks(false);
            headerCb.checked = tasks.length > 0 && tasks.every(t => this._selectedTaskIds.has(t.id));
            headerCb.indeterminate = this._selectedTaskIds.size > 0 && !headerCb.checked;
        }

        // Update gantt bar highlighting
        $$('.gantt-bar, .gantt-milestone').forEach(bar => {
            bar.classList.toggle('selected', this._selectedTaskIds.has(bar.dataset.taskId));
        });

        // Show/hide batch action bar
        this._updateBatchBar();
    }

    _updateBatchBar() {
        let bar = $('#batchActionBar');
        const count = this._selectedTaskIds.size;

        if (count === 0) {
            if (bar) bar.remove();
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'batchActionBar';
            bar.className = 'batch-action-bar';
            document.body.appendChild(bar);
        }

        bar.innerHTML = '';

        const countLabel = document.createElement('span');
        countLabel.className = 'batch-count';
        countLabel.textContent = `${count} tâche${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}`;
        bar.appendChild(countLabel);

        const actions = [
            { label: 'Terminé', icon: '✓', action: () => this._batchSetStatus('done') },
            { label: 'En cours', icon: '▶', action: () => this._batchSetStatus('in_progress') },
            { label: 'À faire', icon: '○', action: () => this._batchSetStatus('todo') },
            { label: 'Supprimer', icon: '✕', action: () => this._batchDelete(), danger: true },
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'batch-btn' + (a.danger ? ' danger' : '');
            btn.innerHTML = `<span>${a.icon}</span> ${a.label}`;
            btn.addEventListener('click', a.action);
            bar.appendChild(btn);
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'batch-btn close';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Annuler la sélection';
        closeBtn.addEventListener('click', () => this._clearSelection());
        bar.appendChild(closeBtn);
    }

    _batchSetStatus(status) {
        const statusLabels = { done: 'Terminé', in_progress: 'En cours', todo: 'À faire' };
        this._selectedTaskIds.forEach(id => {
            const updates = { status };
            if (status === 'done') updates.progress = 100;
            store.updateTask(id, updates);
        });
        const count = this._selectedTaskIds.size;
        this._clearSelection();
        ganttRenderer.render();
        this._renderStats();
        this._refreshCurrentView();
        this._showToast(`${count} tâche${count > 1 ? 's' : ''} → ${statusLabels[status]}`, 'success');
    }

    _batchDelete() {
        const count = this._selectedTaskIds.size;
        if (!confirm(`Supprimer ${count} tâche${count > 1 ? 's' : ''} ?`)) return;
        this._selectedTaskIds.forEach(id => store.deleteTask(id));
        this._clearSelection();
        ganttRenderer.render();
        this._renderStats();
        this._refreshCurrentView();
        this._showToast(`${count} tâche${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}`, 'success');
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
