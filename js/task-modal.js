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