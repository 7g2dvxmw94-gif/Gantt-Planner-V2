/* ========================================
   GANTT INTERACTIONS - Drag, Resize, Click
   Gantt Planner Pro - Step 2
   ======================================== */

import { store } from './store.js';
import { formatDateISO, addDays, daysBetween } from './utils.js';

class GanttInteractions {
    constructor() {
        this._container = null;
        this._onTaskClick = null;
        this._onUpdate = null;
        this._isDragging = false;
        this._dragData = null;
        this._zoomColWidthFn = null;
        this._timelineStartFn = null;
    }

    /**
     * @param {Object} opts
     * @param {Function} opts.onTaskClick - Called when a task bar/milestone is clicked
     * @param {Function} opts.onUpdate - Called after drag/resize completes
     * @param {Function} opts.getColWidth - Returns pixel width of one day column
     * @param {Function} opts.getTimelineStart - Returns the timeline start Date
     */
    init(opts) {
        this._container = document.getElementById('ganttContainer');
        if (!this._container) return;

        this._onTaskClick = opts.onTaskClick;
        this._onUpdate = opts.onUpdate;
        this._zoomColWidthFn = opts.getColWidth;
        this._timelineStartFn = opts.getTimelineStart;

        // Delegate click events
        this._container.addEventListener('click', (e) => this._handleClick(e));

        // Delegate mousedown for drag/resize
        this._container.addEventListener('mousedown', (e) => this._handleMouseDown(e));

        // Global mouse events for dragging
        document.addEventListener('mousemove', (e) => this._handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this._handleMouseUp(e));

        // Touch support
        this._container.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this._handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this._handleTouchEnd(e));
    }

    /* ---- Click ---- */

    _handleClick(e) {
        // Find the closest bar, milestone, or row with a task-id
        const bar = e.target.closest('.gantt-bar, .gantt-milestone');
        if (bar && bar.dataset.taskId) {
            // Don't fire click if we just finished dragging
            if (this._justDragged) {
                this._justDragged = false;
                return;
            }
            if (this._onTaskClick) this._onTaskClick(bar.dataset.taskId);
            return;
        }

        // Click on task name in left column
        const taskCell = e.target.closest('.task-info');
        if (taskCell) {
            const row = taskCell.closest('.gantt-row');
            if (row && row.dataset.taskId && this._onTaskClick) {
                this._onTaskClick(row.dataset.taskId);
            }
        }
    }

    /* ---- Drag & Resize (Mouse) ---- */

    _handleMouseDown(e) {
        const handle = e.target.closest('.gantt-bar-handle');
        const bar = e.target.closest('.gantt-bar:not(.phase-bar)');

        if (!handle && !bar) return;
        if (bar && bar.classList.contains('phase-bar')) return;

        const targetBar = handle ? handle.closest('.gantt-bar') : bar;
        if (!targetBar || !targetBar.dataset.taskId) return;

        e.preventDefault();

        const task = store.getTask(targetBar.dataset.taskId);
        if (!task) return;

        const isLeftHandle = handle && handle.classList.contains('gantt-bar-handle-left');
        const isRightHandle = handle && handle.classList.contains('gantt-bar-handle-right');

        this._isDragging = true;
        this._justDragged = false;
        this._dragData = {
            taskId: task.id,
            bar: targetBar,
            mode: isLeftHandle ? 'resize-left' : (isRightHandle ? 'resize-right' : 'move'),
            startX: e.clientX,
            origLeft: parseFloat(targetBar.style.left),
            origWidth: parseFloat(targetBar.style.width),
            origStartDate: task.startDate,
            origEndDate: task.endDate,
            moved: false,
        };

        targetBar.style.opacity = '0.8';
        targetBar.style.zIndex = '10';
        document.body.style.cursor = this._dragData.mode === 'move' ? 'grabbing' : 'ew-resize';
        document.body.style.userSelect = 'none';
    }

    _handleMouseMove(e) {
        if (!this._isDragging || !this._dragData) return;

        const dx = e.clientX - this._dragData.startX;
        if (Math.abs(dx) < 3 && !this._dragData.moved) return;

        this._dragData.moved = true;
        this._justDragged = true;
        this._applyDrag(dx);
    }

    _handleMouseUp(e) {
        if (!this._isDragging) return;
        this._finishDrag();
    }

    /* ---- Touch Support ---- */

    _handleTouchStart(e) {
        const touch = e.touches[0];
        const fakeEvent = { clientX: touch.clientX, target: e.target, preventDefault: () => e.preventDefault() };
        this._handleMouseDown(fakeEvent);
    }

    _handleTouchMove(e) {
        if (!this._isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        this._handleMouseMove({ clientX: touch.clientX });
    }

    _handleTouchEnd() {
        if (!this._isDragging) return;
        this._finishDrag();
    }

    /* ---- Drag Logic ---- */

    _applyDrag(dx) {
        const d = this._dragData;
        const colWidth = this._zoomColWidthFn();

        if (d.mode === 'move') {
            d.bar.style.left = (d.origLeft + dx) + 'px';
        } else if (d.mode === 'resize-left') {
            const newLeft = d.origLeft + dx;
            const newWidth = d.origWidth - dx;
            if (newWidth >= colWidth) {
                d.bar.style.left = newLeft + 'px';
                d.bar.style.width = newWidth + 'px';
            }
        } else if (d.mode === 'resize-right') {
            const newWidth = d.origWidth + dx;
            if (newWidth >= colWidth) {
                d.bar.style.width = newWidth + 'px';
            }
        }
    }

    _finishDrag() {
        const d = this._dragData;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (d && d.bar) {
            d.bar.style.opacity = '';
            d.bar.style.zIndex = '';
        }

        if (d && d.moved) {
            // Calculate date changes
            const colWidth = this._zoomColWidthFn();
            const timelineStart = this._timelineStartFn();
            const newLeft = parseFloat(d.bar.style.left);
            const newWidth = parseFloat(d.bar.style.width);

            const startDayOffset = Math.round(newLeft / colWidth);
            const durationDays = Math.max(1, Math.round(newWidth / colWidth) - 1);

            const newStart = addDays(timelineStart, startDayOffset);
            const newEnd = addDays(newStart, durationDays);

            const updates = {};
            if (d.mode === 'move') {
                updates.startDate = formatDateISO(newStart);
                updates.endDate = formatDateISO(newEnd);
            } else if (d.mode === 'resize-left') {
                updates.startDate = formatDateISO(newStart);
            } else if (d.mode === 'resize-right') {
                const origStartLeft = d.origLeft;
                const rightEdge = newLeft + newWidth;
                const endDayOffset = Math.round(rightEdge / colWidth) - 1;
                updates.endDate = formatDateISO(addDays(timelineStart, endDayOffset));
            }

            store.updateTask(d.taskId, updates);

            if (this._onUpdate) this._onUpdate();
        }

        this._isDragging = false;
        this._dragData = null;
    }
}

export const ganttInteractions = new GanttInteractions();
