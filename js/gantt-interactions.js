/* ========================================
   GANTT INTERACTIONS - Drag, Resize, Click
   Gantt Planner Pro - Step 2
   ======================================== */

import { store } from './store.js';
import { formatDateISO, addDays, daysBetween } from './utils.js';

const AUTO_SCROLL_EDGE = 50;       // px from wrapper edge to trigger
const AUTO_SCROLL_MAX_SPEED = 15;  // max px per animation frame

class GanttInteractions {
    constructor() {
        this._container = null;
        this._onTaskClick = null;
        this._onUpdate = null;
        this._isDragging = false;
        this._dragData = null;
        this._zoomColWidthFn = null;
        this._timelineStartFn = null;
        this._tooltip = null;
        this._dropIndicator = null;
        this._autoScrollRAF = null;
        this._autoScrollSpeed = 0;
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
        this._onPinchZoom = opts.onPinchZoom || null;
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
        const milestone = e.target.closest('.gantt-milestone');

        if (!handle && !bar && !milestone) return;
        if (bar && bar.classList.contains('phase-bar')) return;

        const targetBar = milestone || (handle ? handle.closest('.gantt-bar') : bar);
        if (!targetBar || !targetBar.dataset.taskId) return;

        e.preventDefault();

        const task = store.getTask(targetBar.dataset.taskId);
        if (!task) return;

        const isMilestone = !!milestone;
        const isLeftHandle = !isMilestone && handle && handle.classList.contains('gantt-bar-handle-left');
        const isRightHandle = !isMilestone && handle && handle.classList.contains('gantt-bar-handle-right');

        // Get the source row for vertical drag
        const sourceRow = targetBar.closest('.gantt-row');
        const wrapper = this._container.closest('.gantt-wrapper');

        this._isDragging = true;
        this._justDragged = false;
        this._dragData = {
            taskId: task.id,
            bar: targetBar,
            isMilestone: isMilestone,
            mode: isLeftHandle ? 'resize-left' : (isRightHandle ? 'resize-right' : 'move'),
            startX: e.clientX,
            startY: e.clientY,
            origLeft: parseFloat(targetBar.style.left),
            origWidth: isMilestone ? 0 : parseFloat(targetBar.style.width),
            origStartDate: task.startDate,
            origEndDate: task.endDate,
            origParentId: task.parentId,
            sourceRow: sourceRow,
            wrapper: wrapper,
            origScrollLeft: wrapper ? wrapper.scrollLeft : 0,
            lastDx: 0,
            lastMouseX: e.clientX,
            lastMouseY: e.clientY,
            moved: false,
            verticalMove: false,
            dropTarget: null,
        };

        targetBar.style.opacity = '0.8';
        targetBar.style.zIndex = '10';
        document.body.style.cursor = this._dragData.mode === 'move' ? 'grabbing' : 'ew-resize';
        document.body.style.userSelect = 'none';
    }

    _handleMouseMove(e) {
        if (!this._isDragging || !this._dragData) return;

        const dx = e.clientX - this._dragData.startX;
        const dy = e.clientY - this._dragData.startY;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3 && !this._dragData.moved) return;

        this._dragData.moved = true;
        this._justDragged = true;
        this._dragData.lastDx = dx;
        this._dragData.lastMouseX = e.clientX;
        this._dragData.lastMouseY = e.clientY;

        this._applyDrag(dx);

        // Update tooltip for resize modes
        if (this._dragData.mode === 'resize-left' || this._dragData.mode === 'resize-right') {
            this._updateResizeTooltip(e);
        }

        // Vertical drag for move mode
        if (this._dragData.mode === 'move') {
            this._updateVerticalDrag(e);
        }

        // Auto-scroll when near edges
        this._updateAutoScroll(e);
    }

    _handleMouseUp(e) {
        if (!this._isDragging) return;
        this._finishDrag();
    }

    /* ---- Touch Support ---- */

    _handleTouchStart(e) {
        // Pinch-to-zoom: 2 fingers
        if (e.touches.length === 2) {
            e.preventDefault();
            this._pinchStartDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this._pinching = true;
            return;
        }
        const touch = e.touches[0];
        const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, target: e.target, preventDefault: () => e.preventDefault() };
        this._handleMouseDown(fakeEvent);
    }

    _handleTouchMove(e) {
        // Pinch-to-zoom handling
        if (this._pinching && e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = dist / this._pinchStartDist;
            if (ratio > 1.3 && !this._pinchFired) {
                this._pinchFired = true;
                if (this._onPinchZoom) this._onPinchZoom('in');
            } else if (ratio < 0.7 && !this._pinchFired) {
                this._pinchFired = true;
                if (this._onPinchZoom) this._onPinchZoom('out');
            }
            return;
        }
        if (!this._isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        this._handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    _handleTouchEnd() {
        if (this._pinching) {
            this._pinching = false;
            this._pinchFired = false;
            this._pinchStartDist = 0;
            return;
        }
        if (!this._isDragging) return;
        this._finishDrag();
    }

    /* ---- Drag Logic ---- */

    _applyDrag(dx) {
        const d = this._dragData;
        const colWidth = this._zoomColWidthFn();
        // Account for wrapper scroll delta so the bar tracks the cursor
        const scrollDelta = d.wrapper ? d.wrapper.scrollLeft - d.origScrollLeft : 0;
        const totalDx = dx + scrollDelta;

        if (d.mode === 'move') {
            d.bar.style.left = (d.origLeft + totalDx) + 'px';
        } else if (d.mode === 'resize-left') {
            const newLeft = d.origLeft + totalDx;
            const newWidth = d.origWidth - totalDx;
            if (newWidth >= colWidth) {
                d.bar.style.left = newLeft + 'px';
                d.bar.style.width = newWidth + 'px';
            }
        } else if (d.mode === 'resize-right') {
            const newWidth = d.origWidth + totalDx;
            if (newWidth >= colWidth) {
                d.bar.style.width = newWidth + 'px';
            }
        }
    }

    /* ---- Auto-Scroll ---- */

    _updateAutoScroll(e) {
        const d = this._dragData;
        if (!d || !d.wrapper) return;

        const rect = d.wrapper.getBoundingClientRect();
        const mouseX = e.clientX;
        let speed = 0;

        if (mouseX < rect.left + AUTO_SCROLL_EDGE) {
            // Near left edge — scroll left
            const distance = rect.left + AUTO_SCROLL_EDGE - mouseX;
            speed = -Math.ceil((distance / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED);
        } else if (mouseX > rect.right - AUTO_SCROLL_EDGE) {
            // Near right edge — scroll right
            const distance = mouseX - (rect.right - AUTO_SCROLL_EDGE);
            speed = Math.ceil((distance / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED);
        }

        if (speed !== 0) {
            this._autoScrollSpeed = speed;
            if (!this._autoScrollRAF) {
                this._autoScrollLoop();
            }
        } else {
            this._stopAutoScroll();
        }
    }

    _autoScrollLoop() {
        const d = this._dragData;
        if (!d || !d.wrapper || !this._autoScrollSpeed) {
            this._stopAutoScroll();
            return;
        }

        d.wrapper.scrollLeft += this._autoScrollSpeed;

        // Re-apply drag to update bar position with new scroll offset
        this._applyDrag(d.lastDx);

        // Update tooltip content (date changed due to scroll)
        if (d.mode === 'resize-left' || d.mode === 'resize-right') {
            this._updateResizeTooltip({
                clientX: d.lastMouseX,
                clientY: d.lastMouseY,
            });
        }

        this._autoScrollRAF = requestAnimationFrame(() => this._autoScrollLoop());
    }

    _stopAutoScroll() {
        if (this._autoScrollRAF) {
            cancelAnimationFrame(this._autoScrollRAF);
            this._autoScrollRAF = null;
        }
        this._autoScrollSpeed = 0;
    }

    /* ---- Resize Tooltip ---- */

    _updateResizeTooltip(e) {
        const d = this._dragData;
        const colWidth = this._zoomColWidthFn();
        const timelineStart = this._timelineStartFn();
        const newLeft = parseFloat(d.bar.style.left);
        const newWidth = parseFloat(d.bar.style.width);

        let dateStr;
        if (d.mode === 'resize-left') {
            const startDayOffset = Math.round(newLeft / colWidth);
            const newStart = addDays(timelineStart, startDayOffset);
            dateStr = _formatDateFR(newStart);
        } else {
            const rightEdge = newLeft + newWidth;
            const endDayOffset = Math.round(rightEdge / colWidth) - 1;
            const newEnd = addDays(timelineStart, endDayOffset);
            dateStr = _formatDateFR(newEnd);
        }

        if (!this._tooltip) {
            this._tooltip = document.createElement('div');
            this._tooltip.className = 'gantt-drag-tooltip';
            document.body.appendChild(this._tooltip);
        }

        this._tooltip.textContent = dateStr;
        this._tooltip.style.left = (e.clientX + 12) + 'px';
        this._tooltip.style.top = (e.clientY - 32) + 'px';
    }

    _removeTooltip() {
        if (this._tooltip) {
            this._tooltip.remove();
            this._tooltip = null;
        }
    }

    /* ---- Vertical Drag & Drop ---- */

    _updateVerticalDrag(e) {
        const d = this._dragData;
        const dy = Math.abs(e.clientY - d.startY);

        // Only activate vertical mode after sufficient vertical movement
        if (dy < 15) {
            this._removeDropIndicator();
            d.verticalMove = false;
            d.dropTarget = null;
            return;
        }

        d.verticalMove = true;

        // Find which row the mouse is over
        const rows = this._container.querySelectorAll('.gantt-row');
        let targetRow = null;
        let insertPosition = null; // 'before', 'inside', 'after'

        for (const row of rows) {
            if (row.style.display === 'none') continue;
            const rowId = row.dataset.taskId;
            if (rowId === d.taskId) continue; // skip self

            const rect = row.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                const rowTask = store.getTask(rowId);
                if (!rowTask) continue;

                // Determine drop zone: top third = before, middle = inside (if phase), bottom third = after
                const third = rect.height / 3;
                if (rowTask.isPhase) {
                    if (e.clientY < rect.top + third) {
                        insertPosition = 'before';
                    } else if (e.clientY > rect.bottom - third) {
                        insertPosition = 'after';
                    } else {
                        insertPosition = 'inside';
                    }
                } else {
                    if (e.clientY < rect.top + rect.height / 2) {
                        insertPosition = 'before';
                    } else {
                        insertPosition = 'after';
                    }
                }
                targetRow = row;
                break;
            }
        }

        if (targetRow) {
            d.dropTarget = { rowId: targetRow.dataset.taskId, position: insertPosition };
            this._showDropIndicator(targetRow, insertPosition);
        } else {
            d.dropTarget = null;
            this._removeDropIndicator();
        }
    }

    _showDropIndicator(targetRow, position) {
        if (!this._dropIndicator) {
            this._dropIndicator = document.createElement('div');
            this._dropIndicator.className = 'gantt-drop-indicator';
            document.body.appendChild(this._dropIndicator);
        }

        const rect = targetRow.getBoundingClientRect();
        const indicator = this._dropIndicator;

        if (position === 'inside') {
            // Highlight the whole row
            indicator.style.left = rect.left + 'px';
            indicator.style.top = rect.top + 'px';
            indicator.style.width = rect.width + 'px';
            indicator.style.height = rect.height + 'px';
            indicator.className = 'gantt-drop-indicator inside';
        } else {
            // Show a line above or below
            const y = position === 'before' ? rect.top : rect.bottom;
            indicator.style.left = rect.left + 'px';
            indicator.style.top = (y - 1) + 'px';
            indicator.style.width = rect.width + 'px';
            indicator.style.height = '2px';
            indicator.className = 'gantt-drop-indicator line';
        }
    }

    _removeDropIndicator() {
        if (this._dropIndicator) {
            this._dropIndicator.remove();
            this._dropIndicator = null;
        }
    }

    _applyVerticalDrop() {
        const d = this._dragData;
        if (!d.dropTarget) return;

        const { rowId, position } = d.dropTarget;
        const targetTask = store.getTask(rowId);
        if (!targetTask) return;

        const task = store.getTask(d.taskId);
        if (!task) return;

        // Prevent dropping a phase into itself or its descendants
        if (task.isPhase && this._isDescendant(task.id, rowId)) return;

        let newParentId;
        let newOrder;

        if (position === 'inside' && targetTask.isPhase) {
            // Drop inside a phase
            newParentId = targetTask.id;
            const siblings = store.getChildTasks(targetTask.id);
            newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order)) + 1 : 0;
        } else {
            // Drop before or after a task - adopt its parent
            newParentId = targetTask.parentId;
            const siblings = newParentId
                ? store.getChildTasks(newParentId)
                : store.getTasks().filter(t => !t.parentId);

            const targetOrder = targetTask.order;
            if (position === 'before') {
                newOrder = targetOrder;
                // Shift siblings at or after this order
                siblings.forEach(s => {
                    if (s.id !== d.taskId && s.order >= newOrder) {
                        store.updateTask(s.id, { order: s.order + 1 });
                    }
                });
            } else {
                newOrder = targetOrder + 1;
                siblings.forEach(s => {
                    if (s.id !== d.taskId && s.order > targetOrder) {
                        store.updateTask(s.id, { order: s.order + 1 });
                    }
                });
            }
        }

        // Apply the move
        store.updateTask(d.taskId, {
            parentId: newParentId,
            order: newOrder,
        });
    }

    _isDescendant(ancestorId, taskId) {
        let current = store.getTask(taskId);
        while (current) {
            if (current.id === ancestorId) return true;
            if (!current.parentId) return false;
            current = store.getTask(current.parentId);
        }
        return false;
    }

    /* ---- Finish Drag ---- */

    _finishDrag() {
        const d = this._dragData;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Clean up tooltip, drop indicator, auto-scroll
        this._removeTooltip();
        this._removeDropIndicator();
        this._stopAutoScroll();

        if (d && d.bar) {
            d.bar.style.opacity = '';
            d.bar.style.zIndex = '';
        }

        if (d && d.moved) {
            // Handle vertical drop first
            if (d.mode === 'move' && d.verticalMove && d.dropTarget) {
                this._applyVerticalDrop();
                if (this._onUpdate) this._onUpdate();
                this._isDragging = false;
                this._dragData = null;
                return;
            }

            // Calculate date changes (horizontal)
            const colWidth = this._zoomColWidthFn();
            const timelineStart = this._timelineStartFn();
            const newLeft = parseFloat(d.bar.style.left);

            const updates = {};

            if (d.isMilestone) {
                // Milestone: position is left + 8 (centered), startDate = endDate
                const dayOffset = Math.round((newLeft + 8) / colWidth);
                const newDate = formatDateISO(addDays(timelineStart, dayOffset));
                updates.startDate = newDate;
                updates.endDate = newDate;
            } else {
                const newWidth = parseFloat(d.bar.style.width);
                const startDayOffset = Math.round(newLeft / colWidth);
                const durationDays = Math.max(1, Math.round(newWidth / colWidth) - 1);
                const newStart = addDays(timelineStart, startDayOffset);
                const newEnd = addDays(newStart, durationDays);

                if (d.mode === 'move') {
                    updates.startDate = formatDateISO(newStart);
                    updates.endDate = formatDateISO(newEnd);
                } else if (d.mode === 'resize-left') {
                    updates.startDate = formatDateISO(newStart);
                } else if (d.mode === 'resize-right') {
                    const rightEdge = newLeft + newWidth;
                    const endDayOffset = Math.round(rightEdge / colWidth) - 1;
                    updates.endDate = formatDateISO(addDays(timelineStart, endDayOffset));
                }
            }

            store.updateTask(d.taskId, updates);

            if (this._onUpdate) this._onUpdate();
        }

        this._isDragging = false;
        this._dragData = null;
    }
}

/* ---- Helper ---- */

function _formatDateFR(date) {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export const ganttInteractions = new GanttInteractions();
