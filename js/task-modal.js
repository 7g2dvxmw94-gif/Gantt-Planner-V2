/* ========================================
   TASK MODAL - Create / Edit / Delete Tasks
   Gantt Planner Pro - Step 2
   ======================================== */

import { store, PERMIT_TYPES, PERMIT_STATUSES, calculatePermitDeadlines } from './store.js';
import { $, $$, createElement, formatDateISO, formatDateDisplay, addDays, TASK_COLORS, getCurrencySymbol } from './utils.js';

class TaskModal {
    constructor() {
        this._overlay = null;
        this._mode = 'create'; // 'create' | 'edit'
        this._editingTaskId = null;
        this._onSave = null;
        this._allResources = [];
        this._selectedAssigneeIds = new Set();
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

        const modal = createElement('div', {
            className: 'modal task-modal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'taskModalTitle',
        });

        // Header
        const header = createElement('div', { className: 'modal-header' });
        this._titleEl = createElement('h2', { className: 'modal-title', id: 'taskModalTitle' }, t('task.new.title'));
        const closeBtn = createElement('button', {
            className: 'icon-btn',
            'aria-label': t('task.btnCancel'),
            onClick: () => this.close(),
        });
        closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        header.appendChild(this._titleEl);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Body
        const body = createElement('div', { className: 'modal-body' });

        // === TYPE SELECTOR (top of modal) ===
        const typeGroup = createElement('div', { className: 'form-group' });
        typeGroup.appendChild(createElement('label', { className: 'form-label' }, t('task.type.label')));
        const typeSwitcher = createElement('div', { className: 'type-switcher' });
        this._typeButtons = {};
        [['task', t('task.type.task'), '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>'],
         ['milestone', t('task.type.milestone'), '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'],
         ['phase', t('task.type.phase'), '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>'],
         ['permit', t('task.type.permit'), '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>']
        ].forEach(([val, lbl, icon]) => {
            const btn = createElement('button', {
                className: 'type-switcher-btn' + (val === 'task' ? ' active' : ''),
                dataset: { type: val },
                onClick: (e) => {
                    e.preventDefault();
                    this._setTaskType(val);
                },
            });
            btn.innerHTML = icon + `<span>${lbl}</span>`;
            this._typeButtons[val] = btn;
            typeSwitcher.appendChild(btn);
        });
        typeGroup.appendChild(typeSwitcher);
        body.appendChild(typeGroup);

        // Hidden checkboxes (keep for data binding)
        this._milestoneCheck = { input: createElement('input', { type: 'checkbox', id: 'taskMilestone', style: { display: 'none' } }) };
        this._phaseCheck = { input: createElement('input', { type: 'checkbox', id: 'taskPhase', style: { display: 'none' } }) };

        // Task name
        this._taskNameGroup = this._createField(t('task.name.label'), 'text', 'taskName', t('task.name.placeholder'));
        this._taskNameLabel = this._taskNameGroup.querySelector('.form-label');
        body.appendChild(this._taskNameGroup);

        // Name + Parent row
        const nameParentRow = createElement('div', { className: 'form-row' });
        // Parent phase selector
        const parentGroup = createElement('div', { className: 'form-group' });
        parentGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskParent' }, t('task.phase.label')));
        this._parentSelect = createElement('select', { className: 'select', id: 'taskParent' });
        parentGroup.appendChild(this._parentSelect);
        nameParentRow.appendChild(parentGroup);
        // Description
        const descGroup = createElement('div', { className: 'form-group' });
        descGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskDesc' }, t('task.description.label')));
        this._descInput = createElement('textarea', {
            className: 'input',
            id: 'taskDesc',
            rows: '2',
            placeholder: t('task.description.placeholder'),
            style: { resize: 'vertical', minHeight: '48px' },
        });
        descGroup.appendChild(this._descInput);
        nameParentRow.appendChild(descGroup);
        body.appendChild(nameParentRow);

        // Dates + Duration row (3 columns)
        this._datesRow = createElement('div', { className: 'form-row form-row-3' });
        const datesRow = this._datesRow;
        datesRow.appendChild(this._createField(t('task.startDate'), 'date', 'taskStart'));
        datesRow.appendChild(this._createField(t('task.endDate'), 'date', 'taskEnd'));
        const durationGroup = createElement('div', { className: 'form-group' });
        durationGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskDuration' }, t('task.duration')));
        this._durationInput = createElement('input', {
            className: 'input',
            type: 'number',
            id: 'taskDuration',
            min: '1',
            value: '7',
            placeholder: t('task.duration'),
        });
        durationGroup.appendChild(this._durationInput);
        datesRow.appendChild(durationGroup);
        body.appendChild(datesRow);

        // Priority + Status + Progress row (3 columns)
        this._metaRow = createElement('div', { className: 'form-row form-row-3' });
        const metaRow = this._metaRow;

        // Priority
        const priorityGroup = createElement('div', { className: 'form-group' });
        priorityGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskPriority' }, t('task.priority')));
        this._prioritySelect = createElement('select', { className: 'select', id: 'taskPriority' });
        [['low', t('task.priority.low')], ['medium', t('task.priority.medium')], ['high', t('task.priority.high')]].forEach(([val, lbl]) => {
            const opt = createElement('option', { value: val }, lbl);
            if (val === 'medium') opt.selected = true;
            this._prioritySelect.appendChild(opt);
        });
        priorityGroup.appendChild(this._prioritySelect);
        metaRow.appendChild(priorityGroup);

        // Status
        const statusGroup = createElement('div', { className: 'form-group' });
        statusGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskStatus' }, t('task.status')));
        this._statusSelect = createElement('select', { className: 'select', id: 'taskStatus' });
        [['todo', t('task.status.todo')], ['in_progress', t('task.status.inProgress')], ['done', t('task.status.done')]].forEach(([val, lbl]) => {
            this._statusSelect.appendChild(createElement('option', { value: val }, lbl));
        });
        statusGroup.appendChild(this._statusSelect);
        metaRow.appendChild(statusGroup);

        // Progress
        const progressGroup = createElement('div', { className: 'form-group' });
        progressGroup.appendChild(createElement('label', { className: 'form-label', for: 'taskProgress' }, t('task.progress')));
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
        this._progressWrap = progressWrap;
        progressGroup.appendChild(progressWrap);

        // Milestone status toggle (shown instead of slider for milestones)
        this._milestoneStatusToggle = createElement('div', { className: 'milestone-status-toggle' });
        this._milestoneBtnPending = createElement('button', {
            type: 'button',
            className: 'milestone-status-btn',
            dataset: { value: '0' },
        }, t('task.milestone.pending'));
        this._milestoneBtnDone = createElement('button', {
            type: 'button',
            className: 'milestone-status-btn',
            dataset: { value: '100' },
        }, t('task.milestone.done'));
        this._milestoneBtnPending.classList.add('active');
        [this._milestoneBtnPending, this._milestoneBtnDone].forEach(btn => {
            btn.addEventListener('click', () => {
                this._milestoneBtnPending.classList.toggle('active', btn === this._milestoneBtnPending);
                this._milestoneBtnDone.classList.toggle('active', btn === this._milestoneBtnDone);
                this._progressInput.value = btn.dataset.value;
                this._progressLabel.textContent = btn.dataset.value + '%';
            });
        });
        this._milestoneStatusToggle.appendChild(this._milestoneBtnPending);
        this._milestoneStatusToggle.appendChild(this._milestoneBtnDone);
        this._milestoneStatusToggle.style.display = 'none';
        progressGroup.appendChild(this._milestoneStatusToggle);

        metaRow.appendChild(progressGroup);
        body.appendChild(metaRow);

        // Color + Assignees row
        const colorAssignRow = createElement('div', { className: 'form-row' });

        // Color picker
        const colorGroup = createElement('div', { className: 'form-group' });
        colorGroup.appendChild(createElement('label', { className: 'form-label' }, t('task.color')));
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
        colorAssignRow.appendChild(colorGroup);

        // Assignees (multi-select with search)
        const assigneeGroup = createElement('div', { className: 'form-group' });
        assigneeGroup.appendChild(createElement('label', { className: 'form-label' }, t('task.assignee')));
        this._assigneeSearch = createElement('input', {
            type: 'text',
            className: 'input assignee-search',
            placeholder: t('task.assigneeSearch'),
        });
        this._assigneeSearch.addEventListener('input', () => this._filterAssignees());
        assigneeGroup.appendChild(this._assigneeSearch);
        this._assigneeList = createElement('div', { className: 'assignee-list' });
        assigneeGroup.appendChild(this._assigneeList);
        colorAssignRow.appendChild(assigneeGroup);
        body.appendChild(colorAssignRow);

        // Fixed costs section (multiple named costs)
        const fixedCostsGroup = createElement('div', { className: 'form-group' });
        const fixedCostsHeader = createElement('div', { className: 'fixed-costs-header' });
        fixedCostsHeader.appendChild(createElement('label', { className: 'form-label' }, t('task.fixedCosts.label') + ' (' + getCurrencySymbol() + ')'));
        const addCostBtn = createElement('button', {
            className: 'btn btn-xs btn-outline fixed-costs-add-btn',
            type: 'button',
        }, t('task.fixedCosts.addBtn'));
        addCostBtn.addEventListener('click', () => this._addFixedCostRow());
        fixedCostsHeader.appendChild(addCostBtn);
        fixedCostsGroup.appendChild(fixedCostsHeader);
        this._fixedCostsList = createElement('div', { className: 'fixed-costs-list' });
        fixedCostsGroup.appendChild(this._fixedCostsList);
        this._fixedCostsTotalEl = createElement('div', { className: 'fixed-costs-total' });
        fixedCostsGroup.appendChild(this._fixedCostsTotalEl);
        const fixedCostHint = createElement('div', {
            style: { fontSize: '11px', color: 'var(--text-muted, #999)', marginTop: '4px' },
        }, t('task.fixedCosts.hint'));
        fixedCostsGroup.appendChild(fixedCostHint);
        body.appendChild(fixedCostsGroup);

        // Dependencies row (predecessors + successors side by side)
        this._depRow = createElement('div', { className: 'form-row' });
        const depRow = this._depRow;

        // Predecessors (with link type)
        const predGroup = createElement('div', { className: 'form-group' });
        predGroup.appendChild(createElement('label', { className: 'form-label' }, t('task.predecessors')));
        this._predList = createElement('div', { className: 'dep-list' });
        predGroup.appendChild(this._predList);
        depRow.appendChild(predGroup);

        // Successors (with link type)
        const succGroup = createElement('div', { className: 'form-group' });
        succGroup.appendChild(createElement('label', { className: 'form-label' }, t('task.successors')));
        this._succList = createElement('div', { className: 'dep-list' });
        succGroup.appendChild(this._succList);
        depRow.appendChild(succGroup);
        body.appendChild(depRow);

        // === PERMIT FIELDS ===
        this._permitFields = createElement('div', { className: 'permit-fields' });

        // Permit section title
        this._permitFields.appendChild(createElement('div', { className: 'permit-section-title' }, t('permit.section.info')));

        // Row 1: Permit type + Dossier number
        const permitRow1 = createElement('div', { className: 'form-row' });
        const permitTypeGroup = createElement('div', { className: 'form-group' });
        permitTypeGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.type.label')));
        this._permitTypeSelect = createElement('select', { className: 'select', id: 'permitType' });
        Object.entries(PERMIT_TYPES).forEach(([key, val]) => {
            this._permitTypeSelect.appendChild(createElement('option', { value: key }, val.label));
        });
        this._permitTypeSelect.addEventListener('change', () => this._updatePermitDeadlines());
        permitTypeGroup.appendChild(this._permitTypeSelect);
        permitRow1.appendChild(permitTypeGroup);

        const dossierGroup = createElement('div', { className: 'form-group' });
        dossierGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.dossier.label')));
        this._permitDossier = createElement('input', { className: 'input', type: 'text', placeholder: 'PC 075 123 45 R0001' });
        dossierGroup.appendChild(this._permitDossier);
        permitRow1.appendChild(dossierGroup);
        this._permitFields.appendChild(permitRow1);

        // Row 2: Commune + Service instructeur
        const permitRow2 = createElement('div', { className: 'form-row' });
        const communeGroup = createElement('div', { className: 'form-group' });
        communeGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.commune.label')));
        this._permitCommune = createElement('input', { className: 'input', type: 'text', placeholder: t('permit.commune.placeholder') });
        communeGroup.appendChild(this._permitCommune);
        permitRow2.appendChild(communeGroup);

        const serviceGroup = createElement('div', { className: 'form-group' });
        serviceGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.service.label')));
        this._permitService = createElement('input', { className: 'input', type: 'text', placeholder: t('permit.service.placeholder') });
        serviceGroup.appendChild(this._permitService);
        permitRow2.appendChild(serviceGroup);
        this._permitFields.appendChild(permitRow2);

        // Row 3: Permit status + ABF sector
        const permitRow3 = createElement('div', { className: 'form-row' });
        const permitStatusGroup = createElement('div', { className: 'form-group' });
        permitStatusGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.status.label')));
        this._permitStatusSelect = createElement('select', { className: 'select', id: 'permitStatus' });
        Object.entries(PERMIT_STATUSES).forEach(([key, val]) => {
            this._permitStatusSelect.appendChild(createElement('option', { value: key }, val.label));
        });
        this._permitStatusSelect.addEventListener('change', () => this._updatePermitDeadlines());
        permitStatusGroup.appendChild(this._permitStatusSelect);
        permitRow3.appendChild(permitStatusGroup);

        const abfGroup = createElement('div', { className: 'form-group' });
        abfGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.abf.label')));
        this._abfCheck = createElement('input', { type: 'checkbox', id: 'permitABF' });
        const abfLabel = createElement('label', { className: 'permit-toggle' });
        abfLabel.appendChild(this._abfCheck);
        abfLabel.appendChild(document.createTextNode('ABF (Architecte des Bâtiments de France)'));
        this._abfCheck.addEventListener('change', () => this._updatePermitDeadlines());
        abfGroup.appendChild(abfLabel);
        permitRow3.appendChild(abfGroup);
        this._permitFields.appendChild(permitRow3);

        // Section: Dates réglementaires
        this._permitFields.appendChild(createElement('div', { className: 'permit-section-title' }, t('permit.section.dates')));

        // Row 4: deposit + completeness dates
        const permitRow4 = createElement('div', { className: 'form-row' });
        const depositGroup = createElement('div', { className: 'form-group' });
        depositGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.deposit.label')));
        this._permitDeposit = createElement('input', { className: 'input', type: 'date' });
        this._permitDeposit.addEventListener('change', () => this._updatePermitDeadlines());
        depositGroup.appendChild(this._permitDeposit);
        permitRow4.appendChild(depositGroup);

        const completenessGroup = createElement('div', { className: 'form-group' });
        completenessGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.completeness.label')));
        this._permitCompleteness = createElement('input', { className: 'input', type: 'date' });
        this._permitCompleteness.addEventListener('change', () => this._updatePermitDeadlines());
        completenessGroup.appendChild(this._permitCompleteness);
        permitRow4.appendChild(completenessGroup);
        this._permitFields.appendChild(permitRow4);

        // Row 5: Additional docs request + response
        const permitRow5 = createElement('div', { className: 'form-row' });
        const addDocsReqGroup = createElement('div', { className: 'form-group' });
        addDocsReqGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.addDocsReq.label')));
        this._permitAddDocsReq = createElement('input', { className: 'input', type: 'date' });
        this._permitAddDocsReq.addEventListener('change', () => this._updatePermitDeadlines());
        addDocsReqGroup.appendChild(this._permitAddDocsReq);
        permitRow5.appendChild(addDocsReqGroup);

        const addDocsRespGroup = createElement('div', { className: 'form-group' });
        addDocsRespGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.addDocsResp.label')));
        this._permitAddDocsResp = createElement('input', { className: 'input', type: 'date' });
        this._permitAddDocsResp.addEventListener('change', () => this._updatePermitDeadlines());
        addDocsRespGroup.appendChild(this._permitAddDocsResp);
        permitRow5.appendChild(addDocsRespGroup);
        this._permitFields.appendChild(permitRow5);

        // Row 6: Decision date + Display start
        const permitRow6 = createElement('div', { className: 'form-row' });
        const decisionGroup = createElement('div', { className: 'form-group' });
        decisionGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.decision.label')));
        this._permitDecision = createElement('input', { className: 'input', type: 'date' });
        this._permitDecision.addEventListener('change', () => this._updatePermitDeadlines());
        decisionGroup.appendChild(this._permitDecision);
        permitRow6.appendChild(decisionGroup);

        const displayGroup = createElement('div', { className: 'form-group' });
        displayGroup.appendChild(createElement('label', { className: 'form-label' }, t('permit.display.label')));
        this._permitDisplay = createElement('input', { className: 'input', type: 'date' });
        this._permitDisplay.addEventListener('change', () => this._updatePermitDeadlines());
        displayGroup.appendChild(this._permitDisplay);
        permitRow6.appendChild(displayGroup);
        this._permitFields.appendChild(permitRow6);

        // Computed deadlines display
        this._permitFields.appendChild(createElement('div', { className: 'permit-section-title' }, t('permit.section.deadlines')));
        this._permitDeadlinesPanel = createElement('div', { className: 'permit-deadlines' });
        this._permitFields.appendChild(this._permitDeadlinesPanel);

        body.appendChild(this._permitFields);

        modal.appendChild(body);

        // Footer
        const footer = createElement('div', { className: 'modal-footer' });
        this._deleteBtn = createElement('button', {
            className: 'btn btn-danger',
            style: { marginRight: 'auto', display: 'none' },
            onClick: () => this._handleDelete(),
        }, t('task.btnDelete'));
        footer.appendChild(this._deleteBtn);
        footer.appendChild(createElement('button', {
            className: 'btn btn-secondary',
            onClick: () => this.close(),
        }, t('task.btnCancel')));
        this._saveBtn = createElement('button', {
            className: 'btn btn-primary',
            onClick: () => this._handleSave(),
        }, t('task.btnCreate'));
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

    _setTaskType(type) {
        // Update visual buttons
        Object.entries(this._typeButtons).forEach(([key, btn]) => {
            btn.classList.toggle('active', key === type);
        });

        // Sync hidden checkboxes
        this._milestoneCheck.input.checked = (type === 'milestone');
        this._phaseCheck.input.checked = (type === 'phase');

        // Show/hide permit fields
        if (this._permitFields) {
            this._permitFields.classList.toggle('visible', type === 'permit');
        }

        // Show/hide fields not relevant to phases
        const isPhase = type === 'phase';
        this._datesRow.style.display = isPhase ? 'none' : '';
        this._metaRow.style.display = isPhase ? 'none' : '';
        this._depRow.style.display = isPhase ? 'none' : '';

        // Update task name label based on type
        if (this._taskNameLabel) {
            this._taskNameLabel.textContent = isPhase ? t('task.phase.name.label') : t('task.name.label');
        }

        // Apply milestone-specific logic
        if (type === 'milestone') {
            this._taskEnd.disabled = true;
            this._taskEnd.value = this._taskStart.value;
            this._durationInput.value = 1;
            this._durationInput.disabled = true;
            this._progressWrap.style.display = 'none';
            this._milestoneStatusToggle.style.display = '';
        } else {
            this._taskEnd.disabled = false;
            this._durationInput.disabled = false;
            this._updateDurationFromDates();
            this._progressWrap.style.display = '';
            this._milestoneStatusToggle.style.display = 'none';
        }

        // For permits, auto-update deadlines
        if (type === 'permit') {
            this._updatePermitDeadlines();
        }
    }

    /* ---- Events ---- */

    _bindEvents() {
        // Close on overlay click
        this._overlay.addEventListener('click', (e) => {
            if (e.target === this._overlay) this.close();
        });

        // Close on Escape + focus trap
        document.addEventListener('keydown', (e) => {
            if (!this._overlay.classList.contains('active')) return;
            if (e.key === 'Escape') {
                this.close();
                return;
            }
            // Focus trap
            if (e.key === 'Tab') {
                const modal = this._overlay.querySelector('.modal');
                const focusable = modal.querySelectorAll('button, [href], input:not([type="hidden"]):not([style*="display: none"]), select, textarea, [tabindex]:not([tabindex="-1"])');
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
                } else {
                    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
        });

        // Type switcher events are handled by _setTaskType() via onClick

        // Start date change: update end date from duration
        this._taskStart.addEventListener('change', () => {
            if (this._milestoneCheck.input.checked) {
                this._taskEnd.value = this._taskStart.value;
                this._durationInput.value = 1;
            } else {
                this._updateEndFromDuration();
            }
        });

        // End date change: update duration
        this._taskEnd.addEventListener('change', () => {
            this._updateDurationFromDates();
        });

        // Duration change: update end date
        this._durationInput.addEventListener('input', () => {
            this._updateEndFromDuration();
        });
    }

    /* ---- Open / Close ---- */

    openCreate(parentId = null) {
        this._mode = 'create';
        this._editingTaskId = null;
        this._titleEl.textContent = t('task.new.title');
        this._saveBtn.textContent = t('task.btnCreate');
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
        // Type
        this._setTaskType('task');

        // Duration
        this._durationInput.value = 7;
        this._durationInput.disabled = false;

        // Reset color
        $$('.color-swatch', this._colorPicker).forEach((s, i) => s.classList.toggle('active', i === 0));

        // Reset fixed costs
        this._populateFixedCosts([]);

        // Reset permit fields
        this._resetPermitFields();

        // Populate assignees (multi)
        this._populateAssignees([]);

        // Populate predecessors/successors
        this._populatePredecessors(null, []);
        this._populateSuccessors(null);

        // Populate parent phases
        this._populateParents(parentId);
        this._parentId = parentId;

        this._show();
        this._taskName.focus();
    }

    openEdit(taskId) {
        const task = store.getTask(taskId);
        if (!task) return;

        this._mode = 'edit';
        this._editingTaskId = taskId;
        this._titleEl.textContent = t('task.edit.title');
        this._saveBtn.textContent = t('task.btnSave');
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
        const isDone = task.progress >= 100;
        this._milestoneBtnPending.classList.toggle('active', !isDone);
        this._milestoneBtnDone.classList.toggle('active', isDone);
        // Type
        const taskType = task.isPermit ? 'permit' : (task.isMilestone ? 'milestone' : (task.isPhase ? 'phase' : 'task'));
        this._setTaskType(taskType);

        // Fill permit-specific fields
        if (task.isPermit) {
            this._fillPermitFields(task);
        } else {
            this._resetPermitFields();
        }

        // Duration
        const days = Math.round((new Date(task.endDate) - new Date(task.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        this._durationInput.value = Math.max(1, days);
        this._durationInput.disabled = task.isMilestone;

        // Color
        $$('.color-swatch', this._colorPicker).forEach(s => {
            s.classList.toggle('active', s.dataset.color === task.color);
        });

        // Fixed costs (support legacy fixedCost field)
        const fixedCosts = Array.isArray(task.fixedCosts) ? task.fixedCosts
            : (task.fixedCost ? [{ name: t('task.fixedCosts.defaultName'), amount: task.fixedCost }] : []);
        this._populateFixedCosts(fixedCosts);

        // Assignees (multi)
        this._populateAssignees(task.assignees || (task.assignee ? [task.assignee] : []));

        // Predecessors / Successors
        this._populatePredecessors(task.id, task.dependencies || []);
        this._populateSuccessors(task.id);

        // Parent phase
        this._populateParents(task.parentId);
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

    _populateAssignees(selectedIds) {
        this._assigneeSearch.value = '';
        this._allResources = store.getResources();
        this._selectedAssigneeIds = new Set(selectedIds || []);
        this._renderAssigneeList('');
    }

    _renderAssigneeList(query) {
        this._assigneeList.innerHTML = '';
        const q = query.toLowerCase().trim();
        const resources = q
            ? this._allResources.filter(r =>
                r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q))
            : this._allResources;

        if (resources.length === 0) {
            const empty = createElement('p', { className: 'assignee-empty' }, t('task.assignee.noResults'));
            this._assigneeList.appendChild(empty);
            return;
        }

        resources.forEach(r => {
            const label = createElement('label', { className: 'assignee-item' });
            const cb = createElement('input', { type: 'checkbox', value: r.id });
            if (this._selectedAssigneeIds.has(r.id)) cb.checked = true;
            cb.addEventListener('change', () => {
                if (cb.checked) this._selectedAssigneeIds.add(r.id);
                else this._selectedAssigneeIds.delete(r.id);
            });
            label.appendChild(cb);
            const avatar = createElement('span', {
                className: 'assignee-avatar-sm',
                style: { background: `linear-gradient(135deg, ${r.color}, ${r.color}dd)` },
            }, r.avatar);
            label.appendChild(avatar);
            label.appendChild(document.createTextNode(`${r.name} (${r.role})`));
            this._assigneeList.appendChild(label);
        });
    }

    _filterAssignees() {
        this._renderAssigneeList(this._assigneeSearch.value);
    }

    _getSelectedAssignees() {
        return this._selectedAssigneeIds ? Array.from(this._selectedAssigneeIds) : [];
    }

    _populatePredecessors(taskId, currentDeps) {
        this._predList.innerHTML = '';
        const deps = currentDeps || [];
        const tasks = store.getTasks().filter(t => !t.isPhase && t.id !== taskId);
        if (tasks.length === 0) {
            this._predList.appendChild(createElement('div', {
                style: { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: 'var(--space-2)' },
            }, t('task.noTasks')));
            return;
        }
        const LINK_TYPES = [['FS', 'Fin→Début'], ['SS', 'Début→Début'], ['FF', 'Fin→Fin'], ['SF', 'Début→Fin']];
        tasks.forEach(t => {
            const existing = deps.find(d => d.taskId === t.id);
            const row = createElement('div', {
                style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)' },
            });
            const cb = createElement('input', { type: 'checkbox', value: t.id });
            if (existing) cb.checked = true;
            row.appendChild(cb);
            const colorDot = createElement('span', {
                style: { width: '8px', height: '8px', borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: '0' },
            });
            row.appendChild(colorDot);
            row.appendChild(createElement('span', { style: { flex: '1', fontSize: 'var(--font-size-sm)', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.name));
            const sel = createElement('select', {
                className: 'select',
                style: { width: '120px', padding: '2px 24px 2px 6px', fontSize: 'var(--font-size-xs)', flexShrink: '0' },
                dataset: { taskId: t.id },
            });
            LINK_TYPES.forEach(([val, lbl]) => {
                const opt = createElement('option', { value: val }, lbl);
                if (existing && existing.type === val) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.style.display = existing ? '' : 'none';
            cb.addEventListener('change', () => { sel.style.display = cb.checked ? '' : 'none'; });
            row.appendChild(sel);
            this._predList.appendChild(row);
        });
    }

    _getSelectedPredecessors() {
        const result = [];
        this._predList.querySelectorAll('div').forEach(row => {
            const cb = row.querySelector('input[type="checkbox"]');
            const sel = row.querySelector('select');
            if (cb && cb.checked && sel) {
                result.push({ taskId: cb.value, type: sel.value });
            }
        });
        return result;
    }

    _populateSuccessors(taskId) {
        this._succList.innerHTML = '';
        if (!taskId) {
            this._succList.appendChild(createElement('div', {
                style: { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: 'var(--space-2)' },
            }, t('task.saveFirstForSuccessors')));
            return;
        }
        const successors = store.getSuccessors(taskId);
        const allTasks = store.getTasks().filter(t => !t.isPhase && t.id !== taskId);
        const LINK_TYPES = [['FS', 'Fin→Début'], ['SS', 'Début→Début'], ['FF', 'Fin→Fin'], ['SF', 'Début→Fin']];

        allTasks.forEach(t => {
            const link = (t.dependencies || []).find(d => d.taskId === taskId);
            const row = createElement('div', {
                style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)' },
            });
            const cb = createElement('input', { type: 'checkbox', value: t.id });
            if (link) cb.checked = true;
            row.appendChild(cb);
            const colorDot = createElement('span', {
                style: { width: '8px', height: '8px', borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: '0' },
            });
            row.appendChild(colorDot);
            row.appendChild(createElement('span', { style: { flex: '1', fontSize: 'var(--font-size-sm)', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.name));
            const sel = createElement('select', {
                className: 'select',
                style: { width: '120px', padding: '2px 24px 2px 6px', fontSize: 'var(--font-size-xs)', flexShrink: '0' },
                dataset: { taskId: t.id },
            });
            LINK_TYPES.forEach(([val, lbl]) => {
                const opt = createElement('option', { value: val }, lbl);
                if (link && link.type === val) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.style.display = link ? '' : 'none';
            cb.addEventListener('change', () => { sel.style.display = cb.checked ? '' : 'none'; });
            row.appendChild(sel);
            this._succList.appendChild(row);
        });
    }

    _getSelectedSuccessors() {
        const result = [];
        this._succList.querySelectorAll('div').forEach(row => {
            const cb = row.querySelector('input[type="checkbox"]');
            const sel = row.querySelector('select');
            if (cb && cb.checked && sel) {
                result.push({ taskId: cb.value, type: sel.value });
            }
        });
        return result;
    }

    /* ---- Duration <-> Dates sync ---- */

    _updateEndFromDuration() {
        const start = this._taskStart.value;
        const dur = parseInt(this._durationInput.value, 10);
        if (start && dur > 0) {
            this._taskEnd.value = formatDateISO(addDays(new Date(start), dur - 1));
        }
    }

    _updateDurationFromDates() {
        const start = this._taskStart.value;
        const end = this._taskEnd.value;
        if (start && end) {
            const days = Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
            this._durationInput.value = Math.max(1, days);
        }
    }

    /* ---- Permit Deadlines ---- */

    _updatePermitDeadlines() {
        if (!this._permitDeadlinesPanel) return;
        this._permitDeadlinesPanel.innerHTML = '';

        const permitData = {
            permitType: this._permitTypeSelect.value,
            abfSector: this._abfCheck.checked,
            depositDate: this._permitDeposit.value || null,
            completenessDate: this._permitCompleteness.value || null,
            additionalDocsRequestDate: this._permitAddDocsReq.value || null,
            additionalDocsResponseDate: this._permitAddDocsResp.value || null,
            decisionDate: this._permitDecision.value || null,
            displayStartDate: this._permitDisplay.value || null,
            permitStatus: this._permitStatusSelect.value,
        };

        const deadlines = calculatePermitDeadlines(permitData);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const items = [];
        const typeInfo = PERMIT_TYPES[permitData.permitType];
        if (typeInfo) {
            const days = deadlines.instructionDays || typeInfo.instructionDays;
            const instrLabel = permitData.abfSector
                ? t('permit.deadline.instructionDaysABF', { days })
                : t('permit.deadline.instructionDays', { days });
            items.push({ label: t('permit.deadline.instruction'), value: instrLabel });
        }

        if (deadlines.completenessDeadline) {
            items.push({ label: t('permit.deadline.completenessLimit'), value: formatDateDisplay(deadlines.completenessDeadline) });
        }

        if (deadlines.suspended) {
            items.push({ label: t('permit.deadline.provisional'), value: t('permit.deadline.suspended'), cls: 'warning' });
        } else if (deadlines.decisionDeadline) {
            const dl = new Date(deadlines.decisionDeadline);
            const daysLeft = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
            let cls = '';
            if (daysLeft <= 7 && daysLeft >= 0) cls = 'urgent';
            else if (daysLeft <= 15 && daysLeft >= 0) cls = 'warning';
            const suffix = daysLeft >= 0
                ? ' ' + t('permit.deadline.daysLeft', { days: daysLeft })
                : ' ' + t('permit.deadline.daysExceeded', { days: Math.abs(daysLeft) });
            items.push({ label: t('permit.deadline.provisional'), value: formatDateDisplay(deadlines.decisionDeadline) + suffix, cls });
        }

        if (deadlines.tacitApprovalDate && !deadlines.suspended) {
            items.push({ label: t('permit.deadline.tacitApproval'), value: formatDateDisplay(deadlines.tacitApprovalDate) });
        }

        if (deadlines.appealEndDate) {
            const appeal = new Date(deadlines.appealEndDate);
            const daysLeft = Math.ceil((appeal - today) / (1000 * 60 * 60 * 24));
            let cls = daysLeft < 0 ? '' : (daysLeft <= 7 ? 'urgent' : '');
            const label = daysLeft < 0 ? t('permit.deadline.appealPurged') : t('permit.deadline.appealEnd', { days: daysLeft });
            items.push({ label, value: formatDateDisplay(deadlines.appealEndDate), cls });
        }

        if (deadlines.expiryDate) {
            items.push({ label: t('permit.deadline.expiry'), value: formatDateDisplay(deadlines.expiryDate) });
        }

        if (items.length === 0) {
            this._permitDeadlinesPanel.appendChild(
                createElement('div', { style: { gridColumn: '1 / -1', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' } },
                    t('permit.deadlines.noDate'))
            );
            return;
        }

        items.forEach(item => {
            const el = createElement('div', { className: 'permit-deadline-item' });
            el.appendChild(createElement('div', { className: 'permit-deadline-label' }, item.label));
            el.appendChild(createElement('div', { className: 'permit-deadline-value' + (item.cls ? ` ${item.cls}` : '') }, item.value));
            this._permitDeadlinesPanel.appendChild(el);
        });
    }

    _fillPermitFields(task) {
        if (!task.isPermit) return;
        this._permitTypeSelect.value = task.permitType || 'PC';
        this._permitDossier.value = task.permitDossier || '';
        this._permitCommune.value = task.permitCommune || '';
        this._permitService.value = task.permitService || '';
        this._permitStatusSelect.value = task.permitStatus || 'draft';
        this._abfCheck.checked = !!task.abfSector;
        this._permitDeposit.value = task.depositDate || '';
        this._permitCompleteness.value = task.completenessDate || '';
        this._permitAddDocsReq.value = task.additionalDocsRequestDate || '';
        this._permitAddDocsResp.value = task.additionalDocsResponseDate || '';
        this._permitDecision.value = task.decisionDate || '';
        this._permitDisplay.value = task.displayStartDate || '';
        this._updatePermitDeadlines();
    }

    _resetPermitFields() {
        this._permitTypeSelect.value = 'PC';
        this._permitDossier.value = '';
        this._permitCommune.value = '';
        this._permitService.value = '';
        this._permitStatusSelect.value = 'draft';
        this._abfCheck.checked = false;
        this._permitDeposit.value = '';
        this._permitCompleteness.value = '';
        this._permitAddDocsReq.value = '';
        this._permitAddDocsResp.value = '';
        this._permitDecision.value = '';
        this._permitDisplay.value = '';
        if (this._permitDeadlinesPanel) this._permitDeadlinesPanel.innerHTML = '';
    }

    _getPermitData() {
        return {
            isPermit: true,
            permitType: this._permitTypeSelect.value,
            permitDossier: this._permitDossier.value.trim(),
            permitCommune: this._permitCommune.value.trim(),
            permitService: this._permitService.value.trim(),
            permitStatus: this._permitStatusSelect.value,
            abfSector: this._abfCheck.checked,
            depositDate: this._permitDeposit.value || null,
            completenessDate: this._permitCompleteness.value || null,
            additionalDocsRequestDate: this._permitAddDocsReq.value || null,
            additionalDocsResponseDate: this._permitAddDocsResp.value || null,
            decisionDate: this._permitDecision.value || null,
            displayStartDate: this._permitDisplay.value || null,
        };
    }

    /* ---- Populate Parents ---- */

    _populateParents(selectedParentId) {
        this._parentSelect.innerHTML = '';
        this._parentSelect.appendChild(createElement('option', { value: '' }, t('task.parent.none')));
        const phases = store.getTasks().filter(t => t.isPhase);
        phases.forEach(phase => {
            // Don't allow a task to be its own parent
            if (this._editingTaskId && phase.id === this._editingTaskId) return;
            const opt = createElement('option', { value: phase.id }, phase.name);
            if (phase.id === selectedParentId) opt.selected = true;
            this._parentSelect.appendChild(opt);
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
        const selectedAssignees = this._getSelectedAssignees();
        const isPermit = this._typeButtons.permit && this._typeButtons.permit.classList.contains('active');
        const data = {
            name,
            description: this._descInput.value.trim(),
            startDate: this._taskStart.value,
            endDate: this._milestoneCheck.input.checked ? this._taskStart.value : this._taskEnd.value,
            priority: this._prioritySelect.value,
            status: this._statusSelect.value,
            progress: parseInt(this._progressInput.value, 10),
            color: activeColor ? activeColor.dataset.color : '#6366F1',
            assignee: selectedAssignees[0] || null,
            assignees: selectedAssignees,
            fixedCosts: this._getFixedCosts(),
            dependencies: this._getSelectedPredecessors(),
            isMilestone: this._milestoneCheck.input.checked,
            isPhase: this._phaseCheck.input.checked,
            isPermit: isPermit,
        };

        // Add permit-specific data
        if (isPermit) {
            Object.assign(data, this._getPermitData());
            // Set color based on permit status
            const statusInfo = PERMIT_STATUSES[data.permitStatus];
            if (statusInfo) data.color = statusInfo.color;
        } else {
            data.isPermit = false;
        }

        // Parent from the dropdown
        const selectedParent = this._parentSelect.value || null;

        if (this._mode === 'create') {
            data.parentId = selectedParent;
            const newTask = store.addTask(data);
            // Apply predecessor constraints to position the new task
            store.applyPredecessorConstraints(newTask.id);
        } else {
            data.parentId = selectedParent;
            store.updateTask(this._editingTaskId, data);

            // Apply predecessor constraints (adjusts dates based on predecessors)
            store.applyPredecessorConstraints(this._editingTaskId);

            // Update successors: sync the reverse links (only changed ones)
            const selectedSuccessors = this._getSelectedSuccessors();
            const allTasks = store.getTasks().filter(t => !t.isPhase && t.id !== this._editingTaskId);
            allTasks.forEach(t => {
                const succEntry = selectedSuccessors.find(s => s.taskId === t.id);
                const currentLink = (t.dependencies || []).find(d => d.taskId === this._editingTaskId);

                // Skip if nothing changed
                if (!succEntry && !currentLink) return;
                if (succEntry && currentLink && succEntry.type === currentLink.type) return;

                let deps = (t.dependencies || []).filter(d => d.taskId !== this._editingTaskId);
                if (succEntry) {
                    deps.push({ taskId: this._editingTaskId, type: succEntry.type });
                }
                store.updateTask(t.id, { dependencies: deps });
                // Apply constraints on the successor too
                store.applyPredecessorConstraints(t.id);
            });
        }

        this.close();
        if (this._onSave) this._onSave();
    }

    /* ---- Fixed Costs ---- */

    _populateFixedCosts(costs) {
        this._fixedCostsList.innerHTML = '';
        if (costs.length === 0) {
            // Add one empty row by default for convenience
            this._addFixedCostRow('', 0, true);
        } else {
            costs.forEach(fc => this._addFixedCostRow(fc.name || '', fc.amount || 0));
        }
        this._updateFixedCostsTotal();
    }

    _addFixedCostRow(name = '', amount = 0, isEmpty = false) {
        const row = createElement('div', { className: 'fixed-cost-row' });

        const nameInput = createElement('input', {
            className: 'input fixed-cost-name',
            type: 'text',
            placeholder: t('task.fixedCosts.namePlaceholder'),
            value: name,
        });

        const amountInput = createElement('input', {
            className: 'input fixed-cost-amount',
            type: 'number',
            min: '0',
            step: '1',
            placeholder: '0',
            value: isEmpty ? '' : (amount || ''),
        });
        amountInput.addEventListener('input', () => this._updateFixedCostsTotal());

        const removeBtn = createElement('button', {
            className: 'btn btn-xs btn-icon fixed-cost-remove',
            type: 'button',
            title: t('task.fixedCosts.removeTitle'),
        }, '×');
        removeBtn.addEventListener('click', () => {
            row.remove();
            if (this._fixedCostsList.children.length === 0) {
                this._addFixedCostRow('', 0, true);
            }
            this._updateFixedCostsTotal();
        });

        row.appendChild(nameInput);
        row.appendChild(amountInput);
        row.appendChild(removeBtn);
        this._fixedCostsList.appendChild(row);
        return row;
    }

    _updateFixedCostsTotal() {
        const costs = this._getFixedCosts();
        const total = costs.reduce((s, fc) => s + fc.amount, 0);
        const symbol = getCurrencySymbol();
        if (total > 0) {
            this._fixedCostsTotalEl.textContent = t('task.fixedCosts.total', { total: total.toLocaleString('fr-FR'), symbol });
            this._fixedCostsTotalEl.style.display = '';
        } else {
            this._fixedCostsTotalEl.style.display = 'none';
        }
    }

    _getFixedCosts() {
        const rows = this._fixedCostsList.querySelectorAll('.fixed-cost-row');
        const costs = [];
        rows.forEach(row => {
            const name = row.querySelector('.fixed-cost-name').value.trim();
            const amount = parseFloat(row.querySelector('.fixed-cost-amount').value) || 0;
            if (amount > 0) {
                costs.push({ name: name || t('task.fixedCosts.defaultName'), amount });
            }
        });
        return costs;
    }

    /* ---- Delete ---- */

    _handleDelete() {
        if (!this._editingTaskId) return;
        const task = store.getTask(this._editingTaskId);
        if (!task) return;

        const hasChildren = store.getChildTasks ? store.getChildTasks(this._editingTaskId).length > 0 : false;
        const msg = hasChildren
            ? t('confirm.deleteTaskWithChildren', { name: task.name })
            : t('confirm.deleteTask', { name: task.name });

        if (confirm(msg)) {
            store.deleteTask(this._editingTaskId);
            this.close();
            if (this._onSave) this._onSave();
        }
    }
}

export const taskModal = new TaskModal();
