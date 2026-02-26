/* ========================================
   DATA STORE - Gantt Planner Pro
   Reactive store with localStorage persistence
   ======================================== */

import { generateId, daysBetween, addDays, formatDateISO } from './utils.js';

const STORAGE_KEY = 'gantt-planner-pro';

/* ---- Default Data ---- */

function createDefaultResources() {
    return [
        { id: generateId(), name: 'Marie Dupont',  role: 'UX Designer',      avatar: 'MD', color: '#8B5CF6' },
        { id: generateId(), name: 'Julie Martin',  role: 'UI Designer',      avatar: 'JM', color: '#EC4899' },
        { id: generateId(), name: 'Pierre Leroy',  role: 'Lead Designer',    avatar: 'PL', color: '#10B981' },
        { id: generateId(), name: 'Thomas Bernard', role: 'Dev Frontend',     avatar: 'TB', color: '#3B82F6' },
        { id: generateId(), name: 'Alex Moreau',   role: 'Dev Backend',      avatar: 'AM', color: '#6366F1' },
    ];
}

function createDefaultProject(resources) {
    const projectId = generateId();
    const today = new Date();
    const projectStart = new Date(today);
    projectStart.setDate(projectStart.getDate() - 14); // Started 2 weeks ago

    const project = {
        id: projectId,
        name: 'Projet Alpha',
        description: 'Refonte de la plateforme client',
        startDate: formatDateISO(projectStart),
        endDate: formatDateISO(addDays(projectStart, 90)),
        budget: 45000,
        budgetUsed: 24500,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // Phase 1
    const phase1Id = generateId();
    // Phase 2
    const phase2Id = generateId();

    const tasks = [
        // Phase 1 - Design
        {
            id: phase1Id,
            projectId,
            parentId: null,
            name: 'Phase 1 - Design',
            description: 'Phase de conception et design',
            startDate: formatDateISO(projectStart),
            endDate: formatDateISO(addDays(projectStart, 35)),
            progress: 65,
            priority: 'high',
            status: 'in_progress',
            color: '#6366F1',
            assignee: null,
            isMilestone: false,
            isPhase: true,
            order: 0,
            dependencies: [],
            collapsed: false,
        },
        // Task 1 - Recherche UX
        {
            id: generateId(),
            projectId,
            parentId: phase1Id,
            name: 'Recherche UX',
            description: 'Interviews utilisateurs et analyse des besoins',
            startDate: formatDateISO(projectStart),
            endDate: formatDateISO(addDays(projectStart, 7)),
            progress: 100,
            priority: 'high',
            status: 'done',
            color: '#8B5CF6',
            assignee: resources[0].id,
            assignees: [resources[0].id],
            isMilestone: false,
            isPhase: false,
            order: 1,
            dependencies: [],
            collapsed: false,
        },
        // Task 2 - Wireframes
        {
            id: generateId(),
            projectId,
            parentId: phase1Id,
            name: 'Wireframes',
            description: 'Création des wireframes pour toutes les pages',
            startDate: formatDateISO(addDays(projectStart, 8)),
            endDate: formatDateISO(addDays(projectStart, 18)),
            progress: 75,
            priority: 'high',
            status: 'in_progress',
            color: '#EC4899',
            assignee: resources[1].id,
            assignees: [resources[1].id],
            isMilestone: false,
            isPhase: false,
            order: 2,
            dependencies: [],
            collapsed: false,
        },
        // Task 3 - Design système
        {
            id: generateId(),
            projectId,
            parentId: phase1Id,
            name: 'Design système',
            description: 'Création du design system complet',
            startDate: formatDateISO(addDays(projectStart, 19)),
            endDate: formatDateISO(addDays(projectStart, 32)),
            progress: 30,
            priority: 'medium',
            status: 'in_progress',
            color: '#10B981',
            assignee: resources[2].id,
            assignees: [resources[2].id],
            isMilestone: false,
            isPhase: false,
            order: 3,
            dependencies: [],
            collapsed: false,
        },
        // Milestone - Validation Design
        {
            id: generateId(),
            projectId,
            parentId: phase1Id,
            name: 'Validation Design',
            description: 'Jalon de validation de la phase design',
            startDate: formatDateISO(addDays(projectStart, 35)),
            endDate: formatDateISO(addDays(projectStart, 35)),
            progress: 0,
            priority: 'high',
            status: 'todo',
            color: '#F59E0B',
            assignee: null,
            isMilestone: true,
            isPhase: false,
            order: 4,
            dependencies: [],
            collapsed: false,
        },
        // Phase 2 - Développement
        {
            id: phase2Id,
            projectId,
            parentId: null,
            name: 'Phase 2 - Développement',
            description: 'Phase de développement frontend et backend',
            startDate: formatDateISO(addDays(projectStart, 36)),
            endDate: formatDateISO(addDays(projectStart, 75)),
            progress: 0,
            priority: 'high',
            status: 'todo',
            color: '#3B82F6',
            assignee: null,
            isMilestone: false,
            isPhase: true,
            order: 5,
            dependencies: [],
            collapsed: false,
        },
        // Task 4 - Frontend
        {
            id: generateId(),
            projectId,
            parentId: phase2Id,
            name: 'Frontend',
            description: 'Développement de l\'interface utilisateur',
            startDate: formatDateISO(addDays(projectStart, 36)),
            endDate: formatDateISO(addDays(projectStart, 56)),
            progress: 0,
            priority: 'high',
            status: 'todo',
            color: '#3B82F6',
            assignee: resources[3].id,
            assignees: [resources[3].id],
            isMilestone: false,
            isPhase: false,
            order: 6,
            dependencies: [],
            collapsed: false,
        },
        // Task 5 - Backend API
        {
            id: generateId(),
            projectId,
            parentId: phase2Id,
            name: 'Backend API',
            description: 'Développement des endpoints API REST',
            startDate: formatDateISO(addDays(projectStart, 36)),
            endDate: formatDateISO(addDays(projectStart, 52)),
            progress: 0,
            priority: 'high',
            status: 'todo',
            color: '#6366F1',
            assignee: resources[4].id,
            assignees: [resources[4].id],
            isMilestone: false,
            isPhase: false,
            order: 7,
            dependencies: [],
            collapsed: false,
        },
        // Task 6 - Intégration
        {
            id: generateId(),
            projectId,
            parentId: phase2Id,
            name: 'Intégration & Tests',
            description: 'Intégration frontend/backend et tests',
            startDate: formatDateISO(addDays(projectStart, 57)),
            endDate: formatDateISO(addDays(projectStart, 70)),
            progress: 0,
            priority: 'medium',
            status: 'todo',
            color: '#06B6D4',
            assignee: resources[3].id,
            assignees: [resources[3].id],
            isMilestone: false,
            isPhase: false,
            order: 8,
            dependencies: [],
            collapsed: false,
        },
        // Milestone - Livraison MVP
        {
            id: generateId(),
            projectId,
            parentId: phase2Id,
            name: 'Livraison MVP',
            description: 'Jalon de livraison du MVP',
            startDate: formatDateISO(addDays(projectStart, 75)),
            endDate: formatDateISO(addDays(projectStart, 75)),
            progress: 0,
            priority: 'high',
            status: 'todo',
            color: '#F59E0B',
            assignee: null,
            isMilestone: true,
            isPhase: false,
            order: 9,
            dependencies: [],
            collapsed: false,
        },
    ];

    return { project, tasks };
}

/* ---- Store Class ---- */

class Store {
    constructor() {
        this._listeners = new Map();
        this._data = this._load();
    }

    /* ---- Persistence ---- */

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.projects && parsed.tasks && parsed.resources) {
                    // Migrate: ensure all tasks have assignees array
                    parsed.tasks.forEach(t => {
                        if (!t.assignees) {
                            t.assignees = t.assignee ? [t.assignee] : [];
                        }
                        // Migrate dependencies: string[] → {taskId, type}[]
                        if (!t.dependencies) {
                            t.dependencies = [];
                        } else if (t.dependencies.length && typeof t.dependencies[0] === 'string') {
                            t.dependencies = t.dependencies.map(id => ({ taskId: id, type: 'FS' }));
                        }
                    });
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }

        // Initialize with default data
        return this._createDefaults();
    }

    _createDefaults() {
        const resources = createDefaultResources();
        const { project, tasks } = createDefaultProject(resources);

        return {
            projects: [project],
            tasks: tasks,
            resources: resources,
            settings: {
                activeProjectId: project.id,
                activeView: 'timeline',
                zoomLevel: 'week', // 'day', 'week', 'month', 'quarter'
                theme: null, // null = system preference
            },
        };
    }

    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

    /* ---- Event System ---- */

    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => this._listeners.get(event).delete(callback);
    }

    _emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.forEach(cb => cb(data));
        }
        // Always emit a generic 'change' event
        if (event !== 'change') {
            const changeListeners = this._listeners.get('change');
            if (changeListeners) {
                changeListeners.forEach(cb => cb({ event, data }));
            }
        }
    }

    /* ---- Projects ---- */

    getProjects() {
        return [...this._data.projects];
    }

    getActiveProject() {
        const id = this._data.settings.activeProjectId;
        return this._data.projects.find(p => p.id === id) || this._data.projects[0];
    }

    setActiveProject(projectId) {
        this._data.settings.activeProjectId = projectId;
        this._save();
        this._emit('project:change', projectId);
    }

    addProject(project) {
        const newProject = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...project,
        };
        this._data.projects.push(newProject);
        this._save();
        this._emit('project:add', newProject);
        return newProject;
    }

    updateProject(projectId, updates) {
        const idx = this._data.projects.findIndex(p => p.id === projectId);
        if (idx === -1) return null;
        this._data.projects[idx] = {
            ...this._data.projects[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this._save();
        this._emit('project:update', this._data.projects[idx]);
        return this._data.projects[idx];
    }

    deleteProject(projectId) {
        this._data.projects = this._data.projects.filter(p => p.id !== projectId);
        this._data.tasks = this._data.tasks.filter(t => t.projectId !== projectId);
        if (this._data.settings.activeProjectId === projectId) {
            this._data.settings.activeProjectId = this._data.projects[0]?.id || null;
        }
        this._save();
        this._emit('project:delete', projectId);
    }

    /* ---- Tasks ---- */

    getTasks(projectId = null) {
        const pid = projectId || this._data.settings.activeProjectId;
        return this._data.tasks
            .filter(t => t.projectId === pid)
            .sort((a, b) => a.order - b.order);
    }

    getTask(taskId) {
        return this._data.tasks.find(t => t.id === taskId) || null;
    }

    getChildTasks(parentId) {
        return this._data.tasks
            .filter(t => t.parentId === parentId)
            .sort((a, b) => a.order - b.order);
    }

    getTaskTree(projectId = null) {
        const tasks = this.getTasks(projectId);
        const roots = tasks.filter(t => !t.parentId);
        const buildTree = (parent) => ({
            ...parent,
            children: tasks
                .filter(t => t.parentId === parent.id)
                .sort((a, b) => a.order - b.order)
                .map(buildTree),
        });
        return roots.map(buildTree);
    }

    addTask(task) {
        const tasks = this.getTasks();
        const newTask = {
            id: generateId(),
            projectId: this._data.settings.activeProjectId,
            parentId: null,
            description: '',
            progress: 0,
            priority: 'medium',
            status: 'todo',
            color: '#6366F1',
            assignee: null,
            assignees: [],
            isMilestone: false,
            isPhase: false,
            order: tasks.length,
            dependencies: [],
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...task,
        };

        // If milestone, endDate = startDate
        if (newTask.isMilestone) {
            newTask.endDate = newTask.startDate;
        }

        this._data.tasks.push(newTask);
        this._save();
        this._emit('task:add', newTask);
        return newTask;
    }

    updateTask(taskId, updates) {
        const idx = this._data.tasks.findIndex(t => t.id === taskId);
        if (idx === -1) return null;

        this._data.tasks[idx] = {
            ...this._data.tasks[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        // Recalculate phase dates and progress
        const task = this._data.tasks[idx];
        if (task.parentId) {
            this._recalculatePhase(task.parentId);
        }

        // Propagate to successors only when dates change
        if (updates.startDate !== undefined || updates.endDate !== undefined) {
            this.propagateDependencies(taskId);
        }

        this._save();
        this._emit('task:update', this._data.tasks[idx]);
        return this._data.tasks[idx];
    }

    deleteTask(taskId) {
        const task = this.getTask(taskId);
        if (!task) return;

        // Delete children recursively
        const children = this.getChildTasks(taskId);
        children.forEach(child => this.deleteTask(child.id));

        const parentId = task.parentId;
        this._data.tasks = this._data.tasks.filter(t => t.id !== taskId);

        if (parentId) {
            this._recalculatePhase(parentId);
        }

        this._save();
        this._emit('task:delete', taskId);
    }

    /**
     * Apply predecessor constraints to a task.
     * Adjusts task dates based on its predecessors, then cascades to successors.
     */
    applyPredecessorConstraints(taskId) {
        const task = this.getTask(taskId);
        if (!task || !task.dependencies || !task.dependencies.length) return;

        const duration = daysBetween(task.startDate, task.endDate);
        let latestStart = null;
        let latestEnd = null;

        task.dependencies.forEach(dep => {
            const pred = this.getTask(dep.taskId);
            if (!pred) return;

            const predStart = new Date(pred.startDate);
            const predEnd = new Date(pred.endDate);

            if (dep.type === 'FS') {
                const candidate = addDays(predEnd, 1);
                if (!latestStart || candidate > latestStart) latestStart = candidate;
            } else if (dep.type === 'SS') {
                if (!latestStart || predStart > latestStart) latestStart = predStart;
            } else if (dep.type === 'FF') {
                if (!latestEnd || predEnd > latestEnd) latestEnd = predEnd;
            } else if (dep.type === 'SF') {
                if (!latestEnd || predStart > latestEnd) latestEnd = predStart;
            }
        });

        let changed = false;

        if (latestStart) {
            const ns = formatDateISO(latestStart);
            if (new Date(ns) > new Date(task.startDate)) {
                task.startDate = ns;
                task.endDate = formatDateISO(addDays(latestStart, duration));
                changed = true;
            }
        }
        if (latestEnd) {
            const ne = formatDateISO(latestEnd);
            if (new Date(ne) > new Date(task.endDate)) {
                task.endDate = ne;
                task.startDate = formatDateISO(addDays(latestEnd, -duration));
                changed = true;
            }
        }

        if (changed) {
            if (task.parentId) this._recalculatePhase(task.parentId);
            this.propagateDependencies(taskId);
            this._save();
            this._emit('task:update', task);
        }
    }

    /**
     * Get tasks that depend on this task (successors)
     */
    getSuccessors(taskId) {
        return this._data.tasks.filter(t =>
            t.dependencies && t.dependencies.some(d => d.taskId === taskId)
        );
    }

    /**
     * Propagate date changes to successors based on link type
     * FS: successor.start = predecessor.end + 1
     * SS: successor.start = predecessor.start
     * FF: successor.end = predecessor.end
     * SF: successor.end = predecessor.start
     */
    propagateDependencies(taskId, visited = new Set()) {
        if (visited.has(taskId)) return; // prevent cycles
        visited.add(taskId);

        const task = this.getTask(taskId);
        if (!task) return;

        const successors = this.getSuccessors(taskId);
        successors.forEach(succ => {
            const link = succ.dependencies.find(d => d.taskId === taskId);
            if (!link) return;

            const predStart = new Date(task.startDate);
            const predEnd = new Date(task.endDate);
            const succDuration = daysBetween(succ.startDate, succ.endDate);
            let changed = false;

            if (link.type === 'FS') {
                // Successor starts after predecessor finishes
                const newStart = addDays(predEnd, 1);
                const ns = formatDateISO(newStart);
                if (ns !== succ.startDate) {
                    succ.startDate = ns;
                    succ.endDate = formatDateISO(addDays(newStart, succDuration));
                    changed = true;
                }
            } else if (link.type === 'SS') {
                // Successor starts when predecessor starts
                const ns = formatDateISO(predStart);
                if (ns !== succ.startDate) {
                    succ.startDate = ns;
                    succ.endDate = formatDateISO(addDays(predStart, succDuration));
                    changed = true;
                }
            } else if (link.type === 'FF') {
                // Successor finishes when predecessor finishes
                const ne = formatDateISO(predEnd);
                if (ne !== succ.endDate) {
                    succ.endDate = ne;
                    succ.startDate = formatDateISO(addDays(predEnd, -succDuration));
                    changed = true;
                }
            } else if (link.type === 'SF') {
                // Successor finishes when predecessor starts
                const ne = formatDateISO(predStart);
                if (ne !== succ.endDate) {
                    succ.endDate = ne;
                    succ.startDate = formatDateISO(addDays(predStart, -succDuration));
                    changed = true;
                }
            }

            if (changed) {
                if (succ.parentId) this._recalculatePhase(succ.parentId);
                // Recursively propagate
                this.propagateDependencies(succ.id, visited);
            }
        });

        this._save();
    }

    toggleTaskCollapse(taskId) {
        const task = this.getTask(taskId);
        if (!task) return;
        this.updateTask(taskId, { collapsed: !task.collapsed });
    }

    _recalculatePhase(phaseId) {
        const phase = this._data.tasks.find(t => t.id === phaseId);
        if (!phase || !phase.isPhase) return;

        const children = this._data.tasks.filter(t => t.parentId === phaseId);
        if (children.length === 0) return;

        // Recalculate dates
        const dates = children.map(c => new Date(c.startDate).getTime());
        const endDates = children.map(c => new Date(c.endDate).getTime());
        phase.startDate = formatDateISO(new Date(Math.min(...dates)));
        phase.endDate = formatDateISO(new Date(Math.max(...endDates)));

        // Recalculate progress
        const totalProgress = children.reduce((sum, c) => sum + (c.progress || 0), 0);
        phase.progress = Math.round(totalProgress / children.length);
    }

    /* ---- Resources ---- */

    getResources() {
        return [...this._data.resources];
    }

    getResource(resourceId) {
        return this._data.resources.find(r => r.id === resourceId) || null;
    }

    addResource(resource) {
        const newResource = {
            id: generateId(),
            ...resource,
        };
        this._data.resources.push(newResource);
        this._save();
        this._emit('resource:add', newResource);
        return newResource;
    }

    updateResource(resourceId, updates) {
        const idx = this._data.resources.findIndex(r => r.id === resourceId);
        if (idx === -1) return null;
        this._data.resources[idx] = { ...this._data.resources[idx], ...updates };
        this._save();
        this._emit('resource:update', this._data.resources[idx]);
        return this._data.resources[idx];
    }

    deleteResource(resourceId) {
        this._data.resources = this._data.resources.filter(r => r.id !== resourceId);
        // Unassign from tasks
        this._data.tasks.forEach(t => {
            if (t.assignee === resourceId) t.assignee = null;
            if (t.assignees) {
                t.assignees = t.assignees.filter(id => id !== resourceId);
            }
        });
        this._save();
        this._emit('resource:delete', resourceId);
    }

    /* ---- Settings ---- */

    getSettings() {
        return { ...this._data.settings };
    }

    updateSettings(updates) {
        this._data.settings = { ...this._data.settings, ...updates };
        this._save();
        this._emit('settings:change', this._data.settings);
    }

    /* ---- Computed Data ---- */

    getProjectStats() {
        const tasks = this.getTasks();
        const nonPhaseTasks = tasks.filter(t => !t.isPhase);
        const activeTasks = nonPhaseTasks.filter(t => t.status !== 'done');
        const project = this.getActiveProject();

        const totalProgress = nonPhaseTasks.length > 0
            ? Math.round(nonPhaseTasks.reduce((sum, t) => sum + t.progress, 0) / nonPhaseTasks.length)
            : 0;

        const daysRemaining = project
            ? Math.max(0, daysBetween(new Date(), project.endDate))
            : 0;

        return {
            totalTasks: nonPhaseTasks.length,
            activeTasks: activeTasks.length,
            completedTasks: nonPhaseTasks.filter(t => t.status === 'done').length,
            progress: totalProgress,
            daysRemaining,
            budget: project?.budget || 0,
            budgetUsed: project?.budgetUsed || 0,
        };
    }

    getTimelineRange() {
        const tasks = this.getTasks();
        if (tasks.length === 0) {
            const today = new Date();
            return {
                start: new Date(today.getFullYear(), today.getMonth(), 1),
                end: addDays(today, 90),
            };
        }

        const starts = tasks.map(t => new Date(t.startDate).getTime());
        const ends = tasks.map(t => new Date(t.endDate).getTime());
        const minDate = new Date(Math.min(...starts));
        const maxDate = new Date(Math.max(...ends));

        // Add some padding
        return {
            start: addDays(minDate, -7),
            end: addDays(maxDate, 14),
        };
    }

    /* ---- Reset ---- */

    reset() {
        this._data = this._createDefaults();
        this._save();
        this._emit('reset', null);
    }
}

// Singleton export
export const store = new Store();
