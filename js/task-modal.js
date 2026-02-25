/* ========================================
   TASK MODAL - Create / Edit / Delete Tasks
   Gantt Planner Pro - Step 2
   ======================================== */

import { store } from './store.js';
import { $, $$, createElement, formatDateISO, addDays, TASK_COLORS } from './utils.js';

class TaskModal {
    constructor() {
        this._overlay = null;
        this._mode = 'create'; // 'create' | 'edit'
        this._editingTaskId = null;
        this._onSave = null;
    }

    init(onSave) {
        this._onSave = onSave;
        this._buildDOM();
        this._bindEvents();
    }

    /* ---- Build Modal DOM ---- */

    _buildDOM() {
        // Overlay
        this._overlay = createElement('div', {
            className: 'modal-overlay',
            id: 'taskModalOverlay',
        });

        const modal = createElement('div', { className: 'modal task-modal' });

        // Header
        const header = createElement('div', { className: 'modal-header' });
        this._titleEl = createElement('h2', { className: 'modal-title' }, 'Nouvelle tâche');
        const closeBtn = createElement('button', {
            className: 'icon-btn',
            'aria-label': 'Fermer',
            onClick: () => this.close(),
        });
        closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        header.appendChild(this._titleEl);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Body
        const body = createElement('div', { className: 'modal-body' });

        // Task name
        body.appendChild(this._createField('Nom de la tâche', 'text', 'taskName', 'Ex: Design de la page d\'accueil'));

        // Description
        const descGroup = createElement('div', { className: 'form-group' });
        descGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskDesc' }, 'Description'));
        this._descInput = createElement('textarea', {
            className: 'input',
            id: 'taskDesc',
            rows: '3',
            placeholder: 'Description optionnelle...',
            style: { resize: 'vertical', minHeight: '60px' },
        });
        descGroup.appendChild(this._descInput);
        body.appendChild(descGroup);

        // Dates row
        const datesRow = createElement('div', { className: 'form-row' });
        datesRow.appendChild(this._createField('Date de début', 'date', 'taskStart'));
        datesRow.appendChild(this._createField('Date de fin', 'date', 'taskEnd'));
        body.appendChild(datesRow);

        // Type row
        const typeRow = createElement('div', { className: 'form-row' });

        // Priority
        const priorityGroup = createElement('div', { className: 'form-group' });
        priorityGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskPriority' }, 'Priorité'));
        this._prioritySelect = createElement('select', { className: 'select', id: 'taskPriority' });
        [['low', 'Basse'], ['medium', 'Moyenne'], ['high', 'Haute']].forEach(([val, lbl]) => {
            const opt = createElement('option', { value: val }, lbl);
            if (val === 'medium') opt.selected = true;
            this._prioritySelect.appendChild(opt);
        });
        priorityGroup.appendChild(this._prioritySelect);
        typeRow.appendChild(priorityGroup);

        // Status
        const statusGroup = createElement('div', { className: 'form-group' });
        statusGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskStatus' }, 'Statut'));
        this._statusSelect = createElement('select', { className: 'select', id: 'taskStatus' });
        [['todo', 'À faire'], ['in_progress', 'En cours'], ['done', 'Terminé']].forEach(([val, lbl]) => {
            this._statusSelect.appendChild(createElement('option', { value: val }, lbl));
        });
        statusGroup.appendChild(this._statusSelect);
        typeRow.appendChild(statusGroup);
        body.appendChild(typeRow);

        // Progress + Assignee row
        const progressRow = createElement('div', { className: 'form-row' });

        // Progress
        const progressGroup = createElement('div', { className: 'form-group' });
        progressGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskProgress' }, 'Progression'));
        const progressWrap = createElement('div', { className: 'progress-input-wrap' });
        this._progressInput = createElement('input', {
            className: 'input',
            type: 'range',
            id: 'taskProgress',
            min: '0',
            max: '100',
            value: '0',
            step: '5',
        });
        this._progressLabel = createElement('span', { className: 'progress-input-label' }, '0%');
        this._progressInput.addEventListener('input', () => {
            this._progressLabel.textContent = this._progressInput.value + '%';
        });
        progressWrap.appendChild(this._progressInput);
        progressWrap.appendChild(this._progressLabel);
        progressGroup.appendChild(progressWrap);
        progressRow.appendChild(progressGroup);

        // Assignee
        const assigneeGroup = createElement('div', { className: 'form-group' });
        assigneeGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskAssignee' }, 'Assigné à'));
        this._assigneeSelect = createElement('select', { className: 'select', id: 'taskAssignee' });
        assigneeGroup.appendChild(this._assigneeSelect);
        progressRow.appendChild(assigneeGroup);
        body.appendChild(progressRow);

        // Color picker
        const colorGroup = createElement('div', { className: 'form-group' });
        colorGroup.appendChild(createElement('label', { className: 'form-label' }, 'Couleur'));
        this._colorPicker = createElement('div', { className: 'color-picker' });
        TASK_COLORS.forEach((color, idx) => {
            const swatch = createElement('button', {
                className: 'color-swatch' + (idx === 0 ? ' active' : ''),
                style: { background: color.value },
                'aria-label': color.name,
                title: color.name,
                dataset: { color: color.value },
                onClick: (e) => {
                    e.preventDefault();
                    $$('.color-swatch', this._colorPicker).forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');
                },
            });
            this._colorPicker.appendChild(swatch);
        });
        colorGroup.appendChild(this._colorPicker);
        body.appendChild(colorGroup);

        // Checkboxes row
        const checkRow = createElement('div', { className: 'form-row form-check-row' });
        this._milestoneCheck = this._createCheckbox('taskMilestone', 'Jalon (milestone)');
        this._phaseCheck = this._createCheckbox('taskPhase', 'Phase (groupe)');
        checkRow.appendChild(this._milestoneCheck.wrapper);
        checkRow.appendChild(this._phaseCheck.wrapper);
        body.appendChild(checkRow);

        modal.appendChild(body);

        // Footer
        const footer = createElement('div', { className: 'modal-footer' });
        this._deleteBtn = createElement('button', {
            className: 'btn btn-danger',
            style: { marginRight: 'auto', display: 'none' },
            onClick: () => this._handleDelete(),
        }, 'Supprimer');
        footer.appendChild(this._deleteBtn);
        footer.appendChild(createElement('button', {
            className: 'btn btn-secondary',
            onClick: () => this.close(),
        }, 'Annuler'));
        this._saveBtn = createElement('button', {
            className: 'btn btn-primary',
            onClick: () => this._handleSave(),
        }, 'Créer');
        footer.appendChild(this._saveBtn);
        modal.appendChild(footer);

        this._overlay.appendChild(modal);
        document.body.appendChild(this._overlay);
    }

    _createField(label, type, id, placeholder) {
        const group = createElement('div', { className: 'form-group' });
        group.appendChild(createElement('label', { className: 'form-label', for: id }, label));
        const input = createElement('input', {
            className: 'input',
            type: type,
            id: id,
            placeholder: placeholder || '',
        });
        group.appendChild(input);
        this['_' + id] = input;
        return group;
    }

    _createCheckbox(id, label) {
        const wrapper = createElement('label', { className: 'form-checkbox', for: id });
        const input = createElement('input', { type: 'checkbox', id: id });
        wrapper.appendChild(input);
        wrapper.appendChild(createElement('span', { className: 'form-checkbox-label' }, label));
        return { wrapper, input };
    }

    /* ---- Events ---- */

    _bindEvents() {
        // Close on overlay click
        this._overlay.addEventListener('click', (e) => {
            if (e.target === this._overlay) this.close();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._overlay.classList.contains('active')) {
                this.close();
            }
        });

        // Milestone checkbox: auto-sync end date
        this._milestoneCheck.input.addEventListener('change', () => {
            if (this._milestoneCheck.input.checked) {
                this._taskEnd.disabled = true;
                this._taskEnd.value = this._taskStart.value;
                this._phaseCheck.input.checked = false;
            } else {
                this._taskEnd.disabled = false;
            }
        });

        // Phase checkbox: uncheck milestone
        this._phaseCheck.input.addEventListener('change', () => {
            if (this._phaseCheck.input.checked) {
                this._milestoneCheck.input.checked = false;
                this._taskEnd.disabled = false;
            }
        });

        // Start date change: sync if milestone
        this._taskStart.addEventListener('change', () => {
            if (this._milestoneCheck.input.checked) {
                this._taskEnd.value = this._taskStart.value;
            }
        });
    }

    /* ---- Open / Close ---- */

    openCreate(parentId = null) {
        this._mode = 'create';
        this._editingTaskId = null;
        this._titleEl.textContent = 'Nouvelle tâche';
        this._saveBtn.textContent = 'Créer';
        this._deleteBtn.style.display = 'none';

        // Defaults
        const today = new Date();
        this._taskName.value = '';
        this._descInput.value = '';
        this._taskStart.value = formatDateISO(today);
        this._taskEnd.value = formatDateISO(addDays(today, 7));
        this._taskEnd.disabled = false;
        this._prioritySelect.value = 'medium';
        this._statusSelect.value = 'todo';
        this._progressInput.value = 0;
        this._progressLabel.textContent = '0%';
        this._milestoneCheck.input.checked = false;
        this._phaseCheck.input.checked = false;

        // Reset color
        $$('.color-swatch', this._colorPicker).forEach((s, i) => s.classList.toggle('active', i === 0));

        // Populate assignees
        this._populateAssignees(null);

        // Store parent
        this._parentId = parentId;

        this._show();
        this._taskName.focus();
    }

    openEdit(taskId) {
        const task = store.getTask(taskId);
        if (!task) return;

        this._mode = 'edit';
        this._editingTaskId = taskId;
        this._titleEl.textContent = 'Modifier la tâche';
        this._saveBtn.textContent = 'Enregistrer';
        this._deleteBtn.style.display = '';

        // Fill fields
        this._taskName.value = task.name;
        this._descInput.value = task.description || '';
        this._taskStart.value = task.startDate;
        this._taskEnd.value = task.endDate;
        this._taskEnd.disabled = task.isMilestone;
        this._prioritySelect.value = task.priority;
        this._statusSelect.value = task.status;
        this._progressInput.value = task.progress;
        this._progressLabel.textContent = task.progress + '%';
        this._milestoneCheck.input.checked = task.isMilestone;
        this._phaseCheck.input.checked = task.isPhase;

        // Color
        $$('.color-swatch', this._colorPicker).forEach(s => {
            s.classList.toggle('active', s.dataset.color === task.color);
        });

        // Assignee
        this._populateAssignees(task.assignee);
        this._parentId = task.parentId;

        this._show();
        this._taskName.focus();
    }

    close() {
        this._overlay.classList.remove('active');
    }

    _show() {
        this._overlay.classList.add('active');
    }

    /* ---- Populate ---- */

    _populateAssignees(selectedId) {
        this._assigneeSelect.innerHTML = '';
        this._assigneeSelect.appendChild(createElement('option', { value: '' }, '— Non assigné —'));
        store.getResources().forEach(r => {
            const opt = createElement('option', { value: r.id }, `${r.name} (${r.role})`);
            if (r.id === selectedId) opt.selected = true;
            this._assigneeSelect.appendChild(opt);
        });
    }

    /* ---- Save ---- */

    _handleSave() {
        const name = this._taskName.value.trim();
        if (!name) {
            this._taskName.classList.add('input-error');
            this._taskName.focus();
            setTimeout(() => this._taskName.classList.remove('input-error'), 1500);
            return;
        }

        const activeColor = $('.color-swatch.active', this._colorPicker);
        const data = {
            name,
            description: this._descInput.value.trim(),
            startDate: this._taskStart.value,
            endDate: this._milestoneCheck.input.checked ? this._taskStart.value : this._taskEnd.value,
            priority: this._prioritySelect.value,
            status: this._statusSelect.value,
            progress: parseInt(this._progressInput.value, 10),
            color: activeColor ? activeColor.dataset.color : '#6366F1',
            assignee: this._assigneeSelect.value || null,
            isMilestone: this._milestoneCheck.input.checked,
            isPhase: this._phaseCheck.input.checked,
        };

        if (this._mode === 'create') {
            data.parentId = this._parentId || null;
            store.addTask(data);
        } else {
            store.updateTask(this._editingTaskId, data);
        }

        this.close();
        if (this._onSave) this._onSave();
    }

    /* ---- Delete ---- */

    _handleDelete() {
        if (!this._editingTaskId) return;
        const task = store.getTask(this._editingTaskId);
        if (!task) return;

        const hasChildren = store.getChildTasks ? store.getChildTasks(this._editingTaskId).length > 0 : false;
        const msg = hasChildren
            ? `Supprimer "${task.name}" et toutes ses sous-tâches ?`
            : `Supprimer "${task.name}" ?`;

        if (confirm(msg)) {
            store.deleteTask(this._editingTaskId);
            this.close();
            if (this._onSave) this._onSave();
        }
    }
}

export const taskModal = new TaskModal();
