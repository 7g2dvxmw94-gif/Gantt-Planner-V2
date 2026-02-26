/* ========================================
   GANTT CHART RENDERER
   Gantt Planner Pro
   ======================================== */

import { store } from './store.js';
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

class GanttRenderer {
    constructor() {
        this._container = null;
        this._zoomLevel = 'week';
        this._timelineRange = null;
        this._dayColumns = [];
    }

    init() {
        this._container = document.getElementById('ganttContainer');
        if (!this._container) return;

        // Listen for store changes
        store.on('change', () => this.render());

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

    render() {
        if (!this._container) return;

        const tasks = store.getTasks();
        const tree = store.getTaskTree();
        this._timelineRange = store.getTimelineRange();

        // Calculate day columns for positioning
        this._dayColumns = getDaysBetween(this._timelineRange.start, this._timelineRange.end);

        // Calculate total timeline width for horizontal scrolling
        const colWidth = ZOOM_CONFIG[this._zoomLevel].colWidth;
        this._timelineWidth = this._dayColumns.length * colWidth;

        this._container.innerHTML = '';

        // Build header
        this._container.appendChild(this._renderHeader());

        // Build body
        const body = createElement('div', { className: 'gantt-body', role: 'treegrid', 'aria-label': 'Diagramme de Gantt' });

        if (tree.length === 0) {
            body.appendChild(this._renderEmpty());
        } else {
            this._renderTree(tree, body, 0);
        }

        this._container.appendChild(body);

        // Render dependency arrows
        this._renderDependencies(body, tasks);
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

                const colWidth = ZOOM_CONFIG[this._zoomLevel].colWidth;
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
            const colWidth = ZOOM_CONFIG[this._zoomLevel].colWidth;

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
        const hasChildren = task.children && task.children.length > 0;
        const resources = store.getResources();
        const assignees = (task.assignees || []).map(id => resources.find(r => r.id === id)).filter(Boolean);

        let rowClass = 'gantt-row';
        if (isPhase) rowClass += ' phase';

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
        const name = isMilestone ? `\u25C6 ${task.name}` : task.name;
        taskInfo.appendChild(createElement('div', { className: 'task-name', title: task.name }, name));

        // Meta line
        const metaParts = [];
        if (assignees.length === 1) {
            metaParts.push(`@${assignees[0].name.split(' ')[0]}`);
        } else if (assignees.length > 1) {
            metaParts.push(`${assignees.length} personnes`);
        }
        if (isMilestone) {
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

        // Bar or milestone
        if (isMilestone) {
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

        const colWidth = ZOOM_CONFIG[this._zoomLevel].colWidth;
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

        const bar = createElement('div', {
            className: 'gantt-bar',
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

    /* ---- Date <-> Position ---- */

    _dateToPosition(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const rangeStart = new Date(this._timelineRange.start);
        rangeStart.setHours(0, 0, 0, 0);

        const diffDays = daysBetween(rangeStart, d);

        if (this._zoomLevel === 'day' || this._zoomLevel === 'week') {
            return diffDays * ZOOM_CONFIG[this._zoomLevel].colWidth;
        } else if (this._zoomLevel === 'month') {
            // Approximate: position within months
            const months = getMonthsBetween(this._timelineRange.start, this._timelineRange.end);
            let offset = 0;
            for (const m of months) {
                const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
                const daysInMonth = monthEnd.getDate();
                if (d >= m && d <= monthEnd) {
                    const dayInMonth = d.getDate() - 1;
                    return offset + (dayInMonth / daysInMonth) * ZOOM_CONFIG.month.colWidth;
                }
                offset += ZOOM_CONFIG.month.colWidth;
            }
            return offset;
        } else {
            // Quarter: 3 months = 1 column
            const months = getMonthsBetween(this._timelineRange.start, this._timelineRange.end);
            let offset = 0;
            for (const m of months) {
                const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
                const daysInMonth = monthEnd.getDate();
                if (d >= m && d <= monthEnd) {
                    const dayInMonth = d.getDate() - 1;
                    return offset + (dayInMonth / daysInMonth) * ZOOM_CONFIG.quarter.colWidth;
                }
                offset += ZOOM_CONFIG.quarter.colWidth;
            }
            return offset;
        }
    }

    /* ---- Dependency Arrows ---- */

    _renderDependencies(body, tasks) {
        const rows = body.querySelectorAll('.gantt-row');
        if (!rows.length) return;

        // Build map: taskId -> { row index, bar element }
        const taskMap = {};
        rows.forEach((row, index) => {
            const taskId = row.dataset.taskId;
            if (taskId) {
                const bar = row.querySelector('.gantt-bar, .gantt-milestone');
                taskMap[taskId] = { index, row, bar };
            }
        });

        // Collect dependencies
        const deps = [];
        tasks.forEach(task => {
            if (task.dependencies && task.dependencies.length) {
                task.dependencies.forEach(depId => {
                    if (taskMap[depId] && taskMap[task.id]) {
                        deps.push({ from: depId, to: task.id });
                    }
                });
            }
        });

        if (!deps.length) return;

        const rowHeight = 48; // var(--gantt-row-height)
        const totalHeight = rows.length * rowHeight;

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

            // From bar: right edge, vertical center of its row
            const fromLeft = parseFloat(fromInfo.bar.style.left) || 0;
            const fromWidth = parseFloat(fromInfo.bar.style.width) || 16;
            const fromX = fromLeft + fromWidth;
            const fromY = fromInfo.index * rowHeight + rowHeight / 2;

            // To bar: left edge, vertical center
            const toLeft = parseFloat(toInfo.bar.style.left) || 0;
            const toX = toLeft;
            const toY = toInfo.index * rowHeight + rowHeight / 2;

            // Draw path with elbow connector
            const midX = fromX + 12;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('dep-line');

            if (toX > fromX + 20) {
                // Straight-ish path with elbows
                path.setAttribute('d', `M${fromX} ${fromY} H${midX} V${toY} H${toX - 6}`);
            } else {
                // Need to go around
                const detourY = (fromY < toY) ? fromY + rowHeight * 0.6 : fromY - rowHeight * 0.6;
                path.setAttribute('d', `M${fromX} ${fromY} H${midX} V${detourY} H${toX - 16} V${toY} H${toX - 6}`);
            }
            svg.appendChild(path);

            // Arrowhead
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.classList.add('dep-arrow');
            arrow.setAttribute('points', `${toX - 6} ${toY - 4}, ${toX} ${toY}, ${toX - 6} ${toY + 4}`);
            svg.appendChild(arrow);
        });

        // Position the SVG inside the body, overlaying the timeline cells
        // We need to offset it to the left by the task column width
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = 'var(--gantt-task-col-width)';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '4';
        body.style.position = 'relative';
        body.appendChild(svg);
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
}

export const ganttRenderer = new GanttRenderer();
