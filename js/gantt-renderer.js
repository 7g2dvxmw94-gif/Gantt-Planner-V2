/* ========================================
   GANTT CHART RENDERER
   Gantt Planner Pro
   ======================================== */

import { store, PERMIT_STATUSES, calculatePermitDeadlines } from './store.js';
import {
    createElement, $, $$,
    daysBetween, addDays, formatDateISO, formatDateShort,
    getMonthsBetween, getWeeksBetween, getDaysBetween,
    getMonthName, getWeekNumber, isToday, isWeekend,
    getTaskColor, TASK_COLORS,
} from './utils.js';

/* ---- Constants ---- */
const ZOOM_CONFIG = {
    day:     { colWidth: 36,  label: 'Jour' },
    week:    { colWidth: 50,  label: 'Semaine' },
    month:   { colWidth: 120, label: 'Mois' },
    quarter: { colWidth: 200, label: 'Trimestre' },
};

const VIRTUAL_THRESHOLD = 80;  // Enable virtualisation above this row count
const ROW_HEIGHT = 48;         // Must match --gantt-row-height
const BUFFER_ROWS = 10;        // Extra rows rendered above/below viewport

class GanttRenderer {
    constructor() {
        this._container = null;
        this._zoomLevel = 'week';
        this._timelineRange = null;
        this._dayColumns = [];
        this._effectiveColWidth = ZOOM_CONFIG.week.colWidth;
        this._criticalPath = null;
        this._flatNodes = [];
        this._virtualActive = false;
    }

    init() {
        this._container = document.getElementById('ganttContainer');
        if (!this._container) return;

        // Listen for store changes
        store.on('change', () => this.render());

        // Bind virtual scroll
        const wrapper = this._container.closest('.gantt-wrapper');
        if (wrapper) {
            this._scrollWrapper = wrapper;
            let ticking = false;
            wrapper.addEventListener('scroll', () => {
                if (!this._virtualActive || ticking) return;
                ticking = true;
                requestAnimationFrame(() => {
                    this._updateVirtualRows();
                    ticking = false;
                });
            });
        }

        // Re-render on window resize for dynamic column sizing (month/quarter)
        let resizeTimer;
        window.addEventListener('resize', () => {
            if (this._zoomLevel !== 'month' && this._zoomLevel !== 'quarter') return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.render(), 150);
        });

        // Initial render
        const settings = store.getSettings();
        this._zoomLevel = settings.zoomLevel || 'week';
        this.render();
    }

    setZoom(level) {
        if (!ZOOM_CONFIG[level]) return;
        this._zoomLevel = level;
        store.updateSettings({ zoomLevel: level });
    }

    setCriticalPath(taskIds) {
        this._criticalPath = taskIds;
    }

    render() {
        if (!this._container) return;

        const tasks = store.getTasks();
        const tree = store.getTaskTree();
        this._timelineRange = store.getTimelineRange();

        // Calculate day columns for positioning
        this._dayColumns = getDaysBetween(this._timelineRange.start, this._timelineRange.end);

        // Calculate total timeline width for horizontal scrolling
        if (this._zoomLevel === 'month' || this._zoomLevel === 'quarter') {
            const months = getMonthsBetween(this._timelineRange.start, this._timelineRange.end);
            const minColWidth = ZOOM_CONFIG[this._zoomLevel].colWidth;
            // Expand columns to fill available viewport width
            const taskColWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gantt-task-col-width')) || 280;
            const wrapperWidth = this._scrollWrapper ? this._scrollWrapper.clientWidth : window.innerWidth;
            const availableWidth = wrapperWidth - taskColWidth - 40; // 40px for margin/padding
            const dynamicColWidth = Math.max(minColWidth, Math.floor(availableWidth / months.length));
            this._effectiveColWidth = dynamicColWidth;
            this._timelineWidth = months.length * dynamicColWidth;
        } else {
            this._effectiveColWidth = ZOOM_CONFIG[this._zoomLevel].colWidth;
            this._timelineWidth = this._dayColumns.length * this._effectiveColWidth;
        }

        this._container.innerHTML = '';

        // Build header
        this._container.appendChild(this._renderHeader());

        // Flatten tree for virtualisation
        this._flatNodes = [];
        this._flattenTree(tree, 0);

        // Build body
        const body = createElement('div', { className: 'gantt-body', role: 'treegrid', 'aria-label': 'Diagramme de Gantt' });

        if (tree.length === 0) {
            body.appendChild(this._renderEmpty());
            this._virtualActive = false;
        } else if (this._flatNodes.length > VIRTUAL_THRESHOLD) {
            // Virtual scrolling mode
            this._virtualActive = true;
            const totalHeight = this._flatNodes.length * ROW_HEIGHT;
            body.style.height = totalHeight + 'px';
            body.style.position = 'relative';
            this._virtualBody = body;
            this._renderedRange = { start: -1, end: -1 };
            // Set min-width before first virtual update
            const taskColWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gantt-task-col-width')) || 280;
            this._container.style.minWidth = (this._timelineWidth + taskColWidth) + 'px';
            this._container.appendChild(body);
            this._updateVirtualRows();
            // Render dependency arrows
            this._lastBody = body;
            this._lastTasks = tasks;
            this._renderDependencies(body, tasks);
            return;
        } else {
            this._virtualActive = false;
            this._flatNodes.forEach(({ node, depth }) => {
                body.appendChild(this._renderRow(node, depth));
            });
        }

        // Set min-width on container so the timeline never collapses when rows are filtered
        const taskColWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gantt-task-col-width')) || 280;
        this._container.style.minWidth = (this._timelineWidth + taskColWidth) + 'px';

        this._container.appendChild(body);

        // Render dependency arrows
        this._lastBody = body;
        this._lastTasks = tasks;
        this._renderDependencies(body, tasks);
    }

    _flattenTree(nodes, depth) {
        nodes.forEach(node => {
            this._flatNodes.push({ node, depth });
            if (node.children && node.children.length > 0 && !node.collapsed) {
                this._flattenTree(node.children, depth + 1);
            }
        });
    }

    _updateVirtualRows() {
        const body = this._virtualBody;
        if (!body || !this._scrollWrapper) return;

        const scrollTop = this._scrollWrapper.scrollTop;
        const viewHeight = this._scrollWrapper.clientHeight;
        const total = this._flatNodes.length;

        let startIdx = Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS;
        let endIdx = Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + BUFFER_ROWS;
        startIdx = Math.max(0, startIdx);
        endIdx = Math.min(total, endIdx);

        // Skip re-render if range hasn't changed
        if (startIdx === this._renderedRange.start && endIdx === this._renderedRange.end) return;
        this._renderedRange = { start: startIdx, end: endIdx };

        // Remove old rows (keep non-row children like SVG dep layer)
        body.querySelectorAll('.gantt-row').forEach(r => r.remove());

        // Render visible rows
        for (let i = startIdx; i < endIdx; i++) {
            const { node, depth } = this._flatNodes[i];
            const row = this._renderRow(node, depth);
            row.style.position = 'absolute';
            row.style.top = (i * ROW_HEIGHT) + 'px';
            row.style.left = '0';
            row.style.right = '0';
            row.style.height = ROW_HEIGHT + 'px';
            body.appendChild(row);
        }
    }

    /** Re-render dependency arrows (called after filter changes) */
    refreshDependencies() {
        if (!this._lastBody || !this._lastTasks) return;
        const existing = this._lastBody.querySelector('.gantt-dependencies-layer');
        if (existing) existing.remove();
        this._renderDependencies(this._lastBody, this._lastTasks);
    }

    /* ---- Header ---- */

    _renderHeader() {
        const header = createElement('div', { className: 'gantt-header', role: 'row' });

        // Task column header
        const taskHeader = createElement('div', {
            className: 'gantt-header-task',
            role: 'columnheader',
        }, 'Tâche');
        header.appendChild(taskHeader);

        // Timeline header
        const timelineHeader = createElement('div', { className: 'gantt-timeline-header' });

        if (this._zoomLevel === 'day' || this._zoomLevel === 'week') {
            // Show months on top, weeks/days below
            const months = getMonthsBetween(this._timelineRange.start, this._timelineRange.end);

            months.forEach((monthDate) => {
                const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
                const visibleStart = new Date(Math.max(monthDate.getTime(), this._timelineRange.start.getTime()));
                const visibleEnd = new Date(Math.min(monthEnd.getTime(), this._timelineRange.end.getTime()));
                const daysInVisibleMonth = daysBetween(visibleStart, visibleEnd) + 1;

                const colWidth = this._effectiveColWidth;
                const monthWidth = daysInVisibleMonth * colWidth;

                const monthEl = createElement('div', {
                    className: 'timeline-month',
                    style: { width: monthWidth + 'px', minWidth: monthWidth + 'px' },
                });

                // Month name
                const monthName = createElement('div', { className: 'timeline-month-name' },
                    `${getMonthName(monthDate).charAt(0).toUpperCase() + getMonthName(monthDate).slice(1)} ${monthDate.getFullYear()}`
                );
                monthEl.appendChild(monthName);

                // Sub-row: weeks or days
                const subRow = createElement('div', { className: 'timeline-weeks' });

                if (this._zoomLevel === 'week') {
                    // Show week numbers
                    const weeks = getWeeksBetween(visibleStart, visibleEnd);
                    weeks.forEach(weekDate => {
                        const weekNum = getWeekNumber(weekDate);
                        const weekEl = createElement('div', {
                            className: 'timeline-week',
                            style: { width: (colWidth * 7) + 'px', minWidth: (colWidth * 7) + 'px' },
                        }, `S${weekNum}`);
                        subRow.appendChild(weekEl);
                    });
                } else {
                    // Show day numbers
                    const days = getDaysBetween(visibleStart, visibleEnd);
                    days.forEach(dayDate => {
                        let cls = 'timeline-day';
                        if (isWeekend(dayDate)) cls += ' weekend';
                        if (isToday(dayDate)) cls += ' today';
                        const dayEl = createElement('div', {
                            className: cls,
                            style: { width: colWidth + 'px', minWidth: colWidth + 'px' },
                        }, dayDate.getDate().toString());
                        subRow.appendChild(dayEl);
                    });
                }

                monthEl.appendChild(subRow);
                timelineHeader.appendChild(monthEl);
            });
        } else {
            // Month or Quarter view
            const months = getMonthsBetween(this._timelineRange.start, this._timelineRange.end);
            const colWidth = this._effectiveColWidth;

            months.forEach(monthDate => {
                const monthEl = createElement('div', {
                    className: 'timeline-month',
                    style: { width: colWidth + 'px', minWidth: colWidth + 'px' },
                });
                const label = `${getMonthName(monthDate).charAt(0).toUpperCase() + getMonthName(monthDate).slice(1)} ${monthDate.getFullYear()}`;
                monthEl.appendChild(createElement('div', { className: 'timeline-month-name' }, label));
                timelineHeader.appendChild(monthEl);
            });
        }

        header.appendChild(timelineHeader);
        return header;
    }

    /* ---- Body / Tree ---- */

    _renderTree(nodes, container, depth) {
        nodes.forEach((node, index) => {
            const row = this._renderRow(node, depth);
            container.appendChild(row);

            // Render children if not collapsed
            if (node.children && node.children.length > 0 && !node.collapsed) {
                this._renderTree(node.children, container, depth + 1);
            }
        });
    }

    _renderRow(task, depth) {
        const isPhase = task.isPhase;
        const isMilestone = task.isMilestone;
        const isPermit = task.isPermit;
        const hasChildren = task.children && task.children.length > 0;
        const resources = store.getResources();
        const assignees = (task.assignees || []).map(id => resources.find(r => r.id === id)).filter(Boolean);

        let rowClass = 'gantt-row';
        if (isPhase) rowClass += ' phase';
        if (isPermit) rowClass += ' permit';

        const row = createElement('div', {
            className: rowClass,
            role: 'row',
            'aria-level': depth + 1,
            dataset: { taskId: task.id },
        });

        // ---- Task cell (left) ----
        const taskCell = createElement('div', {
            className: `gantt-task-cell${depth > 0 ? ` indent-${Math.min(depth, 3)}` : ''}`,
            role: 'gridcell',
        });

        // Expand/Collapse button
        if (hasChildren || isPhase) {
            const expandBtn = createElement('button', {
                className: `task-expand${task.collapsed ? '' : ' expanded'}`,
                'aria-label': task.collapsed ? 'Développer' : 'Réduire',
                'aria-expanded': !task.collapsed,
                onClick: (e) => {
                    e.stopPropagation();
                    store.toggleTaskCollapse(task.id);
                },
            }, '\u25B6');
            taskCell.appendChild(expandBtn);
        } else {
            taskCell.appendChild(createElement('div', { className: 'task-expand-placeholder' }));
        }

        // Color indicator
        taskCell.appendChild(createElement('div', {
            className: 'task-color',
            style: { background: task.color },
        }));

        // Task info
        const taskInfo = createElement('div', { className: 'task-info' });
        let displayName = task.name;
        if (isMilestone) displayName = `\u25C6 ${task.name}`;
        else if (isPermit) displayName = `\uD83D\uDCC4 ${task.name}`;

        taskInfo.appendChild(createElement('div', { className: 'task-name', title: task.name }, displayName));

        // Meta line
        const metaParts = [];
        if (assignees.length === 1) {
            metaParts.push(`@${assignees[0].name.split(' ')[0]}`);
        } else if (assignees.length > 1) {
            metaParts.push(`${assignees.length} personnes`);
        }
        if (isPermit) {
            const statusInfo = PERMIT_STATUSES[task.permitStatus];
            if (statusInfo) metaParts.push(statusInfo.label);
            if (task.permitDossier) metaParts.push(task.permitDossier);
        } else if (isMilestone) {
            metaParts.push(`Jalon \u00b7 ${formatDateShort(task.startDate)}`);
        } else if (isPhase) {
            const childCount = task.children ? task.children.length : 0;
            metaParts.push(`${childCount} tâche${childCount > 1 ? 's' : ''}`);
        } else {
            const duration = daysBetween(task.startDate, task.endDate) + 1;
            metaParts.push(`${duration} jour${duration > 1 ? 's' : ''}`);
        }

        if (metaParts.length > 0) {
            taskInfo.appendChild(createElement('div', { className: 'task-meta' }, metaParts.join(' \u00b7 ')));
        }

        taskCell.appendChild(taskInfo);
        row.appendChild(taskCell);

        // ---- Timeline cell (right) ----
        const timelineCell = createElement('div', {
            className: 'gantt-timeline-cell',
            role: 'gridcell',
        });

        // Grid background
        this._renderGridBackground(timelineCell);

        // Today line
        this._renderTodayLine(timelineCell);

        // Bar or milestone or permit
        if (isPermit) {
            this._renderPermitBar(timelineCell, task);
        } else if (isMilestone) {
            this._renderMilestone(timelineCell, task);
        } else if (isPhase) {
            this._renderPhaseBar(timelineCell, task);
        } else {
            this._renderTaskBar(timelineCell, task);
        }

        row.appendChild(timelineCell);
        return row;
    }

    /* ---- Grid Background ---- */

    _renderGridBackground(container) {
        if (this._zoomLevel !== 'day' && this._zoomLevel !== 'week') return;

        const colWidth = this._effectiveColWidth;
        const grid = createElement('div', { className: 'gantt-timeline-grid' });

        this._dayColumns.forEach(day => {
            let cls = 'gantt-timeline-grid-col';
            if (isWeekend(day)) cls += ' weekend';
            grid.appendChild(createElement('div', {
                className: cls,
                style: { width: colWidth + 'px', minWidth: colWidth + 'px' },
            }));
        });

        container.appendChild(grid);
    }

    /* ---- Today Line ---- */

    _renderTodayLine(container) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const pos = this._dateToPosition(today);
        if (pos === null) return;

        const line = createElement('div', {
            className: 'today-line',
            style: { left: pos + 'px' },
            'aria-hidden': 'true',
        });
        container.appendChild(line);
    }

    /* ---- Task Bar ---- */

    _renderTaskBar(container, task) {
        const left = this._dateToPosition(new Date(task.startDate));
        const right = this._dateToPosition(addDays(new Date(task.endDate), 1));
        if (left === null || right === null) return;

        const width = Math.max(right - left, 20);
        const colorObj = TASK_COLORS.find(c => c.value === task.color);
        const gradient = colorObj ? colorObj.gradient : `linear-gradient(135deg, ${task.color}, ${task.color})`;

        const isCritical = this._criticalPath && this._criticalPath.includes(task.id);
        const bar = createElement('div', {
            className: 'gantt-bar' + (isCritical ? ' critical-path' : ''),
            style: { left: left + 'px', width: width + 'px', background: gradient },
            role: 'button',
            tabindex: '0',
            'aria-label': `${task.name}: ${task.progress}% complété, du ${formatDateShort(task.startDate)} au ${formatDateShort(task.endDate)}`,
            dataset: { taskId: task.id },
        });

        // Progress fill
        if (task.progress > 0) {
            bar.appendChild(createElement('div', {
                className: 'gantt-bar-progress',
                style: { width: task.progress + '%' },
            }));
        }

        // Label
        bar.appendChild(createElement('span', { className: 'gantt-bar-label' }, task.name));

        // Resize handles
        bar.appendChild(createElement('div', { className: 'gantt-bar-handle gantt-bar-handle-left' }));
        bar.appendChild(createElement('div', { className: 'gantt-bar-handle gantt-bar-handle-right' }));

        container.appendChild(bar);
    }

    /* ---- Phase Bar ---- */

    _renderPhaseBar(container, task) {
        const left = this._dateToPosition(new Date(task.startDate));
        const right = this._dateToPosition(addDays(new Date(task.endDate), 1));
        if (left === null || right === null) return;

        const width = Math.max(right - left, 20);

        const bar = createElement('div', {
            className: 'gantt-bar phase-bar',
            style: { left: left + 'px', width: width + 'px', background: task.color },
            role: 'button',
            tabindex: '0',
            'aria-label': `Phase ${task.name}: ${task.progress}% complété`,
            dataset: { taskId: task.id },
        });

        container.appendChild(bar);
    }

    /* ---- Milestone ---- */

    _renderMilestone(container, task) {
        const pos = this._dateToPosition(new Date(task.startDate));
        if (pos === null) return;

        const milestone = createElement('div', {
            className: 'gantt-milestone',
            style: { left: (pos - 8) + 'px', background: task.color },
            role: 'button',
            tabindex: '0',
            'aria-label': `Jalon: ${task.name} - ${formatDateShort(task.startDate)}`,
            title: `${task.name} - ${formatDateShort(task.startDate)}`,
            dataset: { taskId: task.id },
        });

        container.appendChild(milestone);
    }

    /* ---- Permit Bar ---- */

    _renderPermitBar(container, task) {
        const left = this._dateToPosition(new Date(task.startDate));
        const right = this._dateToPosition(addDays(new Date(task.endDate), 1));
        if (left === null || right === null) return;

        const width = Math.max(right - left, 40);
        const statusInfo = PERMIT_STATUSES[task.permitStatus] || PERMIT_STATUSES.draft;
        const color = statusInfo.color;

        const bar = createElement('div', {
            className: 'gantt-permit',
            style: { left: left + 'px', width: width + 'px', background: `linear-gradient(135deg, ${color}, ${color}dd)` },
            role: 'button',
            tabindex: '0',
            'aria-label': `Permis: ${task.name} - ${statusInfo.label}`,
            title: `${task.name}\n${statusInfo.label}${task.permitDossier ? '\nN°' + task.permitDossier : ''}`,
            dataset: { taskId: task.id },
        });

        // Sub-sections: instruction | decision | display | appeal
        const deadlines = calculatePermitDeadlines(task);
        if (task.depositDate && deadlines.decisionDeadline) {
            const sections = createElement('div', { className: 'gantt-permit-sections' });
            const totalDays = daysBetween(task.startDate, task.endDate) || 1;

            // Instruction phase: deposit -> decision
            const instrDays = daysBetween(task.startDate, deadlines.decisionDeadline);
            if (instrDays > 0) {
                sections.appendChild(createElement('div', {
                    className: 'gantt-permit-section instruction',
                    style: { width: Math.min(100, (instrDays / totalDays) * 100) + '%' },
                    title: 'Instruction',
                }));
            }

            // Appeal phase if applicable
            if (deadlines.appealEndDate && task.decisionDate) {
                const appealStart = task.displayStartDate || task.decisionDate;
                const appealDays = daysBetween(appealStart, deadlines.appealEndDate);
                const appealOffset = daysBetween(task.startDate, appealStart);
                if (appealDays > 0) {
                    sections.appendChild(createElement('div', {
                        className: 'gantt-permit-section appeal',
                        style: { width: Math.min(100 - (appealOffset / totalDays) * 100, (appealDays / totalDays) * 100) + '%' },
                        title: 'Recours tiers',
                    }));
                }
            }

            bar.appendChild(sections);
        }

        // Icon
        bar.appendChild(createElement('div', { className: 'gantt-permit-icon' }, '\uD83D\uDCC4'));

        // Label
        bar.appendChild(createElement('span', { className: 'gantt-permit-label' }, task.name));

        // Progress fill (based on permit status order)
        const progress = (statusInfo.order / 9) * 100;
        if (progress > 0) {
            bar.appendChild(createElement('div', {
                className: 'gantt-permit-progress',
                style: { width: Math.min(progress, 100) + '%' },
            }));
        }

        container.appendChild(bar);
    }

    /* ---- Date <-> Position ---- */

    _dateToPosition(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const rangeStart = new Date(this._timelineRange.start);
        rangeStart.setHours(0, 0, 0, 0);

        const diffDays = daysBetween(rangeStart, d);

        const effectiveColWidth = this._effectiveColWidth;

        if (this._zoomLevel === 'day' || this._zoomLevel === 'week') {
            return diffDays * effectiveColWidth;
        } else {
            // Month or Quarter: position within month columns
            const months = getMonthsBetween(this._timelineRange.start, this._timelineRange.end);
            let offset = 0;
            for (const m of months) {
                const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
                const daysInMonth = monthEnd.getDate();
                if (d >= m && d <= monthEnd) {
                    const dayInMonth = d.getDate() - 1;
                    return offset + (dayInMonth / daysInMonth) * effectiveColWidth;
                }
                offset += effectiveColWidth;
            }
            return offset;
        }
    }

    /* ---- Dependency Arrows ---- */

    _renderDependencies(body, tasks) {
        const rows = body.querySelectorAll('.gantt-row');
        if (!rows.length) return;

        // Build map: taskId -> { row DOM, bar element } — skip hidden (filtered) rows
        const taskMap = {};
        rows.forEach((row) => {
            if (row.style.display === 'none') return;
            const taskId = row.dataset.taskId;
            if (taskId) {
                const bar = row.querySelector('.gantt-bar, .gantt-milestone, .gantt-permit');
                taskMap[taskId] = { row, bar };
            }
        });

        // Collect dependencies with link type
        const deps = [];
        tasks.forEach(task => {
            if (task.dependencies && task.dependencies.length) {
                task.dependencies.forEach(dep => {
                    const depId = typeof dep === 'string' ? dep : dep.taskId;
                    const type = typeof dep === 'string' ? 'FS' : (dep.type || 'FS');
                    if (taskMap[depId] && taskMap[task.id]) {
                        deps.push({ from: depId, to: task.id, type });
                    }
                });
            }
        });

        if (!deps.length) return;

        // Use actual DOM positions for Y coordinates (row.offsetTop)
        // Wait for layout to be ready
        requestAnimationFrame(() => {
            const bodyRect = body.getBoundingClientRect();
            const totalHeight = body.scrollHeight;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('gantt-dependencies-layer');
            svg.setAttribute('width', this._timelineWidth);
            svg.setAttribute('height', totalHeight);
            svg.style.width = this._timelineWidth + 'px';
            svg.style.height = totalHeight + 'px';

            deps.forEach(dep => {
                const fromInfo = taskMap[dep.from];
                const toInfo = taskMap[dep.to];
                if (!fromInfo.bar || !toInfo.bar) return;

                const fromBar = fromInfo.bar;
                const toBar = toInfo.bar;

                // Get actual Y positions via row offsetTop + half row height
                const fromRowTop = fromInfo.row.offsetTop;
                const fromRowH = fromInfo.row.offsetHeight;
                const toRowTop = toInfo.row.offsetTop;
                const toRowH = toInfo.row.offsetHeight;
                const fromY = fromRowTop + fromRowH / 2;
                const toY = toRowTop + toRowH / 2;

                // Bar X positions
                const fromLeft = parseFloat(fromBar.style.left) || 0;
                const fromWidth = parseFloat(fromBar.style.width) || 16;
                const toLeft = parseFloat(toBar.style.left) || 0;
                const toWidth = parseFloat(toBar.style.width) || 16;

                // Determine start/end points based on link type
                let startX, endX, arrowDir;
                if (dep.type === 'FS') {
                    // Fin → Début: from right edge of predecessor to left edge of successor
                    startX = fromLeft + fromWidth;
                    endX = toLeft;
                    arrowDir = 'right'; // arrow points right
                } else if (dep.type === 'SS') {
                    // Début → Début: from left edge to left edge
                    startX = fromLeft;
                    endX = toLeft;
                    arrowDir = 'right';
                } else if (dep.type === 'FF') {
                    // Fin → Fin: from right edge to right edge
                    startX = fromLeft + fromWidth;
                    endX = toLeft + toWidth;
                    arrowDir = 'left';
                } else if (dep.type === 'SF') {
                    // Début → Fin: from left edge of predecessor to right edge of successor
                    startX = fromLeft;
                    endX = toLeft + toWidth;
                    arrowDir = 'left';
                }

                // Draw elbow path
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.classList.add('dep-line');

                const gap = 12;
                const arrowSize = 6;
                const arrowEnd = arrowDir === 'right' ? endX - arrowSize : endX + arrowSize;

                if (dep.type === 'FS' || dep.type === 'SS') {
                    const midX = startX + (dep.type === 'FS' ? gap : -gap);
                    if (arrowEnd > startX + gap) {
                        path.setAttribute('d', `M${startX} ${fromY} H${midX} V${toY} H${arrowEnd}`);
                    } else {
                        const detourY = fromY < toY ? Math.max(fromY + fromRowH * 0.8, toY - toRowH * 0.8) : Math.min(fromY - fromRowH * 0.8, toY + toRowH * 0.8);
                        path.setAttribute('d', `M${startX} ${fromY} H${midX} V${detourY} H${arrowEnd - gap} V${toY} H${arrowEnd}`);
                    }
                } else {
                    // FF, SF
                    const midX = startX + (dep.type === 'SF' ? -gap : gap);
                    if (arrowEnd < startX - gap) {
                        path.setAttribute('d', `M${startX} ${fromY} H${midX} V${toY} H${arrowEnd}`);
                    } else {
                        const detourY = fromY < toY ? Math.max(fromY + fromRowH * 0.8, toY - toRowH * 0.8) : Math.min(fromY - fromRowH * 0.8, toY + toRowH * 0.8);
                        path.setAttribute('d', `M${startX} ${fromY} H${midX} V${detourY} H${arrowEnd + gap} V${toY} H${arrowEnd}`);
                    }
                }

                svg.appendChild(path);

                // Arrowhead
                const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                arrow.classList.add('dep-arrow');
                if (arrowDir === 'right') {
                    arrow.setAttribute('points', `${endX - arrowSize} ${toY - 4}, ${endX} ${toY}, ${endX - arrowSize} ${toY + 4}`);
                } else {
                    arrow.setAttribute('points', `${endX + arrowSize} ${toY - 4}, ${endX} ${toY}, ${endX + arrowSize} ${toY + 4}`);
                }
                svg.appendChild(arrow);
            });

            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = 'var(--gantt-task-col-width)';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '4';
            body.style.position = 'relative';
            body.appendChild(svg);
        });
    }

    /* ---- Empty State ---- */

    _renderEmpty() {
        const empty = createElement('div', { className: 'gantt-empty' });
        empty.appendChild(createElement('div', { className: 'gantt-empty-icon' }, '\uD83D\uDCCA'));
        empty.appendChild(createElement('div', { className: 'gantt-empty-title' }, 'Aucune tâche'));
        empty.appendChild(createElement('div', { className: 'gantt-empty-text' },
            'Commencez par ajouter votre première tâche pour visualiser votre planning.'));
        empty.appendChild(createElement('button', {
            className: 'btn btn-primary',
            onClick: () => {
                document.dispatchEvent(new CustomEvent('gantt:addTask'));
            },
        }, [
            createElement('span', {}, '+ Nouvelle tâche'),
        ]));
        return empty;
    }

    /* ---- Public Getters ---- */

    get zoomLevel() {
        return this._zoomLevel;
    }

    get zoomConfig() {
        return ZOOM_CONFIG;
    }

    get effectiveColWidth() {
        return this._effectiveColWidth || ZOOM_CONFIG[this._zoomLevel].colWidth;
    }
}

export const ganttRenderer = new GanttRenderer();
