/* ========================================
   DATA STORE - Gantt Planner Pro
   Reactive store with localStorage persistence
   ======================================== */

import { generateId, daysBetween, addDays, formatDateISO } from './utils.js';
import { supabaseStore } from './supabase-store.js';
import { auth } from './auth.js';

const STORAGE_KEY = 'gantt-planner-pro';

/* ---- Plan / Subscription constants ---- */
export const PLAN_LIMITS = {
    free:  { projects: 1,        tasks: 50,       collaborators: 1        },
    pro:   { projects: Infinity, tasks: Infinity,  collaborators: 5        },
    team:  { projects: Infinity, tasks: Infinity,  collaborators: Infinity },
};

// Stripe Price IDs — remplacez par vos vrais IDs après création sur stripe.com
export const STRIPE_PRICES = {
    pro_monthly:  'price_PRO_MONTHLY_PLACEHOLDER',
    pro_yearly:   'price_PRO_YEARLY_PLACEHOLDER',
    team_monthly: 'price_TEAM_MONTHLY_PLACEHOLDER',
    team_yearly:  'price_TEAM_YEARLY_PLACEHOLDER',
};

export const PLAN_PRICES = {
    pro:  { monthly: 29, yearly: 278 },
    team: { monthly: 99, yearly: 950 },
};

/* ---- Building Permit Constants ---- */

const PERMIT_TYPES = {
    PC:  { label: 'Permis de construire',        instructionDays: 90 },
    PCM: { label: 'PC Maison individuelle',       instructionDays: 60 },
    DP:  { label: 'Déclaration préalable',        instructionDays: 30 },
    PA:  { label: "Permis d'aménager",            instructionDays: 90 },
    PD:  { label: 'Permis de démolir',            instructionDays: 60 },
};

const PERMIT_STATUSES = {
    draft:              { label: 'En préparation',             color: '#64748B', order: 0 },
    submitted:          { label: 'Déposé',                     color: '#3B82F6', order: 1 },
    completeness:       { label: 'Complétude notifiée',        color: '#1E40AF', order: 2 },
    additional_docs:    { label: 'Pièces complémentaires',     color: '#F59E0B', order: 3 },
    under_review:       { label: 'En instruction',             color: '#EAB308', order: 4 },
    granted:            { label: 'Accordé',                    color: '#10B981', order: 5 },
    granted_conditions: { label: 'Accordé avec réserves',      color: '#6EE7B7', order: 6 },
    refused:            { label: 'Refusé',                     color: '#EF4444', order: 7 },
    third_party_appeal: { label: 'Recours tiers',              color: '#991B1B', order: 8 },
    appeal_cleared:     { label: 'Purgé de recours',           color: '#065F46', order: 9 },
};

const ABF_EXTRA_DAYS = 30;
const THIRD_PARTY_APPEAL_DAYS = 60;
const PERMIT_VALIDITY_YEARS = 3;

/**
 * Calculate permit regulatory deadlines from permit data
 */
function calculatePermitDeadlines(permit) {
    const deadlines = {};
    const type = PERMIT_TYPES[permit.permitType];
    if (!type) return deadlines;

    let instructionDays = type.instructionDays;
    if (permit.abfSector) instructionDays += ABF_EXTRA_DAYS;
    deadlines.instructionDays = instructionDays;

    if (permit.depositDate) {
        const deposit = new Date(permit.depositDate);
        // Completeness deadline (1 month from deposit)
        deadlines.completenessDeadline = formatDateISO(addDays(deposit, 30));
        // Decision deadline
        const baseDate = permit.completenessDate ? new Date(permit.completenessDate) : deposit;
        let effectiveInstruction = instructionDays;
        if (permit.additionalDocsRequestDate) {
            // Instruction clock restarts from additional docs submission
            if (permit.additionalDocsResponseDate) {
                effectiveInstruction = instructionDays; // full delay from response
                deadlines.decisionDeadline = formatDateISO(addDays(new Date(permit.additionalDocsResponseDate), effectiveInstruction));
            } else {
                // Waiting for docs - deadline suspended
                deadlines.decisionDeadline = null;
                deadlines.suspended = true;
            }
        } else {
            deadlines.decisionDeadline = formatDateISO(addDays(baseDate, instructionDays));
        }
        // Tacit approval = decision deadline
        deadlines.tacitApprovalDate = deadlines.decisionDeadline;
    }

    if (permit.decisionDate && (permit.permitStatus === 'granted' || permit.permitStatus === 'granted_conditions')) {
        const decision = new Date(permit.decisionDate);
        // Display start (posting on site)
        if (permit.displayStartDate) {
            const displayStart = new Date(permit.displayStartDate);
            deadlines.appealEndDate = formatDateISO(addDays(displayStart, THIRD_PARTY_APPEAL_DAYS));
        }
        // Permit expiry (3 years from decision)
        deadlines.expiryDate = formatDateISO(addDays(decision, PERMIT_VALIDITY_YEARS * 365));
    }

    return deadlines;
}

/* ---- Default Data ---- */

function createDefaultResources() {
    return [
        { id: generateId(), name: 'Marie Dupont',  role: 'UX Designer',      avatar: 'MD', color: '#8B5CF6', hourlyRate: 55 },
        { id: generateId(), name: 'Julie Martin',  role: 'UI Designer',      avatar: 'JM', color: '#EC4899', hourlyRate: 50 },
        { id: generateId(), name: 'Pierre Leroy',  role: 'Lead Designer',    avatar: 'PL', color: '#10B981', hourlyRate: 70 },
        { id: generateId(), name: 'Thomas Bernard', role: 'Dev Frontend',     avatar: 'TB', color: '#3B82F6', hourlyRate: 60 },
        { id: generateId(), name: 'Alex Moreau',   role: 'Dev Backend',      avatar: 'AM', color: '#6366F1', hourlyRate: 65 },
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
        budget: 0,
        budgetUsed: 0,
        resourceIds: [],
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
            fixedCosts: [{ name: 'Matériel', amount: 500 }],
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
            fixedCosts: [{ name: 'Sous-traitance', amount: 1500 }, { name: 'Matériel', amount: 500 }],
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
        // Permit - Permis de construire
        {
            id: generateId(),
            projectId,
            parentId: null,
            name: 'Permis de construire - Extension bureaux',
            description: 'Dépôt et suivi du permis de construire pour l\'extension des locaux',
            startDate: formatDateISO(addDays(projectStart, -7)),
            endDate: formatDateISO(addDays(projectStart, 60)),
            progress: 40,
            priority: 'high',
            status: 'in_progress',
            color: '#F59E0B',
            assignee: null,
            assignees: [],
            isMilestone: false,
            isPhase: false,
            isPermit: true,
            permitType: 'PC',
            permitStatus: 'under_review',
            dossierNumber: 'PC 075 123 26 R0001',
            commune: 'Paris 8e',
            serviceInstructeur: 'Direction de l\'Urbanisme',
            abfSector: false,
            depositDate: formatDateISO(addDays(projectStart, -7)),
            completenessDate: formatDateISO(addDays(projectStart, 0)),
            additionalDocsRequestDate: '',
            additionalDocsResponseDate: '',
            decisionDate: '',
            displayStartDate: '',
            order: 10,
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
        // Undo/Redo history
        this._undoStack = [];
        this._redoStack = [];
        this._maxHistory = 50;
        this._batchingUndo = false;
        // Track which projects have had their data fully loaded from Supabase
        this._loadedProjectIds = new Set();
        // Subscription plan info (loaded from profiles table after login)
        this._planInfo = { plan: 'free', planStatus: 'active', trialEndsAt: null };
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
                    // Migrate: add baselines array if missing
                    if (!parsed.baselines) parsed.baselines = [];
                    // Migrate: add activeBaselineId to projects
                    parsed.projects.forEach(p => {
                        if (!('activeBaselineId' in p)) p.activeBaselineId = null;
                        // Migrate: add resourceIds pool to projects
                        if (!p.resourceIds) {
                            // Seed from tasks already assigned in this project
                            const projectTaskAssignees = new Set();
                            parsed.tasks.forEach(t => {
                                if (t.projectId === p.id) {
                                    (t.assignees || []).forEach(id => projectTaskAssignees.add(id));
                                    if (t.assignee) projectTaskAssignees.add(t.assignee);
                                }
                            });
                            p.resourceIds = [...projectTaskAssignees];
                        }
                    });
                    // Migrate: add showBaseline to settings
                    if (!('showBaseline' in parsed.settings)) parsed.settings.showBaseline = true;
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
        // Avec Supabase on démarre vide — les données viennent du serveur
        return {
            projects: [],
            tasks: [],
            resources: [],
            baselines: [],
            settings: {
                activeProjectId: null,
                activeView: 'timeline',
                zoomLevel: 'week',
                theme: null,
                showBaseline: true,
            },
        };
    }

    /* ---- Supabase Init (appelé au démarrage de l'app) ---- */

    async initFromSupabase() {
        try {
            const user = await auth.getUser();
            if (!user) return;

            // 1. Charger les projets de l'utilisateur depuis Supabase
            let projects = await supabaseStore.getProjects();

            // 2. Si Supabase est vide mais qu'il y a des projets locaux, les synchroniser
            if (!projects.length && this._data.projects.length) {
                for (const p of this._data.projects) {
                    await supabaseStore.upsertProject(p, user.id).catch(() => {});
                    await supabaseStore.addProjectMember(p.id, user.id, 'owner').catch(() => {});
                }
                projects = await supabaseStore.getProjects();
            }

            if (!projects.length) {
                this._data.settings.activeProjectId = null;
                this._emit('change', {});
                return;
            }

            this._data.projects = projects;

            // 2. Restaurer le projet actif depuis localStorage (préférence UI)
            const savedActiveId = localStorage.getItem('gantt_active_project');
            const activeProject = projects.find(p => p.id === savedActiveId) || projects[0];
            this._data.settings.activeProjectId = activeProject.id;

            // 3. Charger tâches/baselines du projet actif + toutes les ressources (tous projets)
            // Passer user.id pour éviter des appels auth.getUser() concurrents (warning lock)
            const [allResources] = await Promise.all([
                supabaseStore.getAllResources(user.id),
                this._loadProjectData(activeProject.id),
            ]);
            // Toutes les ressources disponibles globalement
            this._data.resources = allResources;
            // Mettre à jour resourceIds pour chaque projet
            this._data.projects.forEach(p => {
                p.resourceIds = allResources.filter(r => r.projectId === p.id).map(r => r.id);
            });

            // 4. Purger les données locales orphelines (projets supprimés)
            const projectIds = new Set(projects.map(p => p.id));
            this._data.tasks     = this._data.tasks.filter(t => projectIds.has(t.projectId));
            this._data.baselines = this._data.baselines.filter(b => projectIds.has(b.projectId));

            // 4. Load customization from Supabase
            const customization = await supabaseStore.getUserSettings();
            if (customization && Object.keys(customization).length) {
                this._data.settings.customization = { ...this._data.settings.customization, ...customization };
            }

            // 5. Restaurer les préférences UI depuis localStorage
            const savedSettings = this._loadSettingsFromStorage();
            if (savedSettings) {
                this._data.settings = { ...this._data.settings, ...savedSettings };
            }

            // 6. Charger les infos de plan/abonnement depuis le profil
            const profile = await auth.getProfile(user.id);
            if (profile) {
                this._planInfo = {
                    plan:        profile.plan        || 'free',
                    planStatus:  profile.plan_status  || 'active',
                    trialEndsAt: profile.trial_ends_at || null,
                };
            }

            this._emit('change', {});
            this._emit('plan:loaded', this._planInfo);
        } catch (e) {
            console.error('[store] initFromSupabase:', e);
        }
    }

    async _loadProjectData(projectId) {
        const [supabaseTasks, resources, baselines] = await Promise.all([
            supabaseStore.getTasks(projectId),
            supabaseStore.getResources(projectId),
            supabaseStore.getBaselines(projectId),
        ]);

        // Tâches locales pour ce projet (pas encore synchées ou en attente)
        const localTasks = this._data.tasks.filter(t => t.projectId === projectId);
        const supabaseTaskIds = new Set(supabaseTasks.map(t => t.id));
        const unsynced = localTasks.filter(t => !supabaseTaskIds.has(t.id));

        // Remplacer avec les données Supabase + conserver les tâches locales non synchées
        this._data.tasks     = this._data.tasks.filter(t => t.projectId !== projectId)
                                                .concat(supabaseTasks)
                                                .concat(unsynced);
        this._data.resources = this._data.resources.filter(r => r.projectId !== projectId).concat(resources);
        this._data.baselines = this._data.baselines.filter(b => b.projectId !== projectId).concat(baselines);

        // Re-syncher les tâches locales non encore dans Supabase
        for (const task of unsynced) {
            supabaseStore.upsertTask(task).catch(e => console.error('[store] re-sync task:', e));
        }

        // Reconstruire resourceIds depuis toutes les ressources du projet
        const project = this._data.projects.find(p => p.id === projectId);
        if (project) {
            project.resourceIds = resources.map(r => r.id);
        }

        // Recalculate all phase dates/progress in memory so the Gantt
        // always reflects the actual children, even if Supabase has stale phase data.
        const phases = this._data.tasks.filter(t => t.projectId === projectId && t.isPhase);
        phases.forEach(phase => this._recalculatePhase(phase.id));

        this._loadedProjectIds.add(projectId);
    }

    /**
     * Ensures a project's tasks/resources are loaded in memory.
     * Returns a Promise that resolves once data is available.
     * Safe to call multiple times — skips the fetch if already loaded.
     */
    async ensureProjectLoaded(projectId) {
        if (!projectId || projectId === 'all' || this._loadedProjectIds.has(projectId)) return;
        await this._loadProjectData(projectId);
    }

    _loadSettingsFromStorage() {
        try {
            const raw = localStorage.getItem('gantt_ui_settings');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    _save() {
        // Persister uniquement les préférences UI (pas les données métier → Supabase)
        try {
            const uiSettings = {
                activeView:  this._data.settings.activeView,
                zoomLevel:   this._data.settings.zoomLevel,
                theme:       this._data.settings.theme,
                showBaseline: this._data.settings.showBaseline,
            };
            localStorage.setItem('gantt_ui_settings', JSON.stringify(uiSettings));
            if (this._data.settings.activeProjectId) {
                localStorage.setItem('gantt_active_project', this._data.settings.activeProjectId);
            }
        } catch (e) {
            console.warn('Failed to save settings to localStorage:', e);
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

    /* ---- Undo / Redo ---- */

    _snapshot() {
        if (this._batchingUndo) return;
        this._undoStack.push(JSON.stringify(this._data));
        if (this._undoStack.length > this._maxHistory) {
            this._undoStack.shift();
        }
        this._redoStack = [];
    }

    undo() {
        if (this._undoStack.length === 0) return false;
        this._redoStack.push(JSON.stringify(this._data));
        this._data = JSON.parse(this._undoStack.pop());
        this._save();
        this._emit('undo', null);
        return true;
    }

    redo() {
        if (this._redoStack.length === 0) return false;
        this._undoStack.push(JSON.stringify(this._data));
        this._data = JSON.parse(this._redoStack.pop());
        this._save();
        this._emit('redo', null);
        return true;
    }

    canUndo() { return this._undoStack.length > 0; }
    canRedo() { return this._redoStack.length > 0; }

    /** Retourne true si l'utilisateur peut modifier le projet actif */
    canEdit() {
        const project = this.getActiveProject();
        const role = project?._role || 'owner';
        return role === 'owner' || role === 'editor';
    }

    /* ---- Projects ---- */

    getProjects() {
        return [...this._data.projects];
    }

    getActiveProject() {
        const id = this._data.settings.activeProjectId;
        return this._data.projects.find(p => p.id === id) || this._data.projects[0];
    }

    async setActiveProject(projectId) {
        this._data.settings.activeProjectId = projectId;
        this._save();
        // Charger les tâches/ressources depuis Supabase avant de notifier l'UI
        await this._loadProjectData(projectId);
        this._emit('project:change', projectId);
    }

    addProject(project) {
        this._snapshot();
        const newProject = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            resourceIds: [],
            ...project,
        };
        this._data.projects.push(newProject);
        this._save();
        this._emit('project:add', newProject);
        // Sync Supabase - await pour éviter race condition lors de la création de tâches
        auth.getUser().then(async user => {
            if (!user) return;
            await supabaseStore.upsertProject(newProject, user.id)
                .catch(e => console.error('[store] sync addProject:', e));
        });
        return newProject;
    }

    updateProject(projectId, updates) {
        this._snapshot();
        const idx = this._data.projects.findIndex(p => p.id === projectId);
        if (idx === -1) return null;
        this._data.projects[idx] = {
            ...this._data.projects[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this._save();
        this._emit('project:update', this._data.projects[idx]);
        // Sync Supabase en arrière-plan
        auth.getUser().then(user => {
            if (!user) return;
            supabaseStore.upsertProject(this._data.projects[idx], user.id)
                .catch(e => console.error('[store] sync updateProject:', e));
        });
        return this._data.projects[idx];
    }

    deleteProject(projectId) {
        this._snapshot();
        this._data.projects = this._data.projects.filter(p => p.id !== projectId);
        this._data.tasks = this._data.tasks.filter(t => t.projectId !== projectId);
        if (this._data.settings.activeProjectId === projectId) {
            this._data.settings.activeProjectId = this._data.projects[0]?.id || null;
        }
        this._save();
        this._emit('project:delete', projectId);
        // Sync Supabase en arrière-plan
        supabaseStore.deleteProject(projectId)
            .catch(e => console.error('[store] sync deleteProject:', e));
    }

    duplicateProject(projectId) {
        this._snapshot();
        const source = this._data.projects.find(p => p.id === projectId);
        if (!source) return null;

        const newProjectId = generateId();
        const newProject = {
            ...source,
            id: newProjectId,
            name: source.name + ' (copie)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this._data.projects.push(newProject);

        // Duplicate tasks with new IDs, remapping parentId and dependencies
        const sourceTasks = this._data.tasks.filter(t => t.projectId === projectId);
        const idMap = {};
        sourceTasks.forEach(t => { idMap[t.id] = generateId(); });

        sourceTasks.forEach(t => {
            const newTask = {
                ...t,
                id: idMap[t.id],
                projectId: newProjectId,
                parentId: t.parentId ? (idMap[t.parentId] || null) : null,
                dependencies: (t.dependencies || []).map(d => ({
                    ...d,
                    taskId: idMap[d.taskId] || d.taskId,
                })),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            this._data.tasks.push(newTask);
        });

        this._save();
        this._emit('project:add', newProject);
        return newProject;
    }

    /* ---- Baselines ---- */

    getBaselines(projectId = null) {
        const pid = projectId || this._data.settings.activeProjectId;
        return this._data.baselines.filter(b => b.projectId === pid);
    }

    getActiveBaseline(projectId = null) {
        const pid = projectId || this._data.settings.activeProjectId;
        const proj = this._data.projects.find(p => p.id === pid);
        if (!proj || !proj.activeBaselineId) return null;
        return this._data.baselines.find(b => b.id === proj.activeBaselineId) || null;
    }

    createBaseline(name) {
        const pid = this._data.settings.activeProjectId;
        const existing = this._data.baselines.filter(b => b.projectId === pid);
        if (existing.length >= 5) return null; // max 5 per project
        const tasks = this.getTasks(pid).map(t => ({
            id: t.id,
            startDate: t.startDate,
            endDate: t.endDate,
            progress: t.progress,
        }));
        const baseline = {
            id: generateId(),
            projectId: pid,
            name: name || `Baseline ${existing.length + 1}`,
            createdAt: new Date().toISOString(),
            tasks,
        };
        this._data.baselines.push(baseline);
        // Auto-activate the new baseline
        const proj = this._data.projects.find(p => p.id === pid);
        if (proj) proj.activeBaselineId = baseline.id;
        this._save();
        // Sync to Supabase + history
        supabaseStore.upsertBaseline(baseline)
            .catch(e => console.error('[store] sync createBaseline:', e));
        supabaseStore.logHistory(pid, 'a créé la baseline', 'baseline', baseline.name)
            .catch(() => {});
        this._emit('baseline:create', baseline);
        return baseline;
    }

    deleteBaseline(baselineId) {
        const bl = this._data.baselines.find(b => b.id === baselineId);
        if (!bl) return;
        this._data.baselines = this._data.baselines.filter(b => b.id !== baselineId);
        const proj = this._data.projects.find(p => p.id === bl.projectId);
        if (proj && proj.activeBaselineId === baselineId) {
            // Activate the most recent remaining baseline for this project, or null
            const remaining = this._data.baselines.filter(b => b.projectId === bl.projectId);
            proj.activeBaselineId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
        }
        this._save();
        // Sync to Supabase + history
        supabaseStore.deleteBaseline(baselineId)
            .catch(e => console.error('[store] sync deleteBaseline:', e));
        supabaseStore.logHistory(bl.projectId, 'a supprimé la baseline', 'baseline', bl.name)
            .catch(() => {});
        this._emit('baseline:delete', baselineId);
    }

    renameBaseline(baselineId, newName) {
        const idx = this._data.baselines.findIndex(b => b.id === baselineId);
        if (idx === -1) return;
        this._data.baselines[idx].name = newName;
        this._save();
        // Sync to Supabase
        supabaseStore.upsertBaseline(this._data.baselines[idx])
            .catch(e => console.error('[store] sync renameBaseline:', e));
        this._emit('baseline:update', this._data.baselines[idx]);
    }

    setActiveBaseline(baselineId) {
        const pid = this._data.settings.activeProjectId;
        const proj = this._data.projects.find(p => p.id === pid);
        if (proj) proj.activeBaselineId = baselineId;
        this._save();
        this._emit('baseline:activate', { projectId: pid, baselineId });
    }

    toggleShowBaseline() {
        this._data.settings.showBaseline = !this._data.settings.showBaseline;
        this._save();
        this._emit('baseline:toggle', this._data.settings.showBaseline);
    }

    /* ---- Tasks ---- */

    getTasks(projectId = null) {
        const pid = projectId || this._data.settings.activeProjectId;
        return this._data.tasks
            .filter(t => t.projectId === pid)
            .sort((a, b) => a.order - b.order);
    }

    getAllTasks() {
        return [...this._data.tasks].sort((a, b) => a.order - b.order);
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
        const trees = roots.map(buildTree);
        // Sort roots by the minimum order in their subtree so a phase appears
        // at the position of its earliest child, not at its own creation order.
        const minSubtreeOrder = (node) => {
            if (!node.children || node.children.length === 0) return node.order;
            return Math.min(node.order, ...node.children.map(minSubtreeOrder));
        };
        trees.sort((a, b) => minSubtreeOrder(a) - minSubtreeOrder(b));
        return trees;
    }

    addTask(task) {
        if (!this.canEdit()) { console.warn('[store] addTask: read-only project'); return null; }
        this._snapshot();
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
        // Log history
        supabaseStore.logHistory(newTask.projectId, 'a créé la tâche', newTask.isPhase ? 'phase' : 'task', newTask.name)
            .catch(() => {});
        // Defer Supabase sync so applyPredecessorConstraints can adjust dates first
        const taskId = newTask.id;
        setTimeout(() => {
            const latest = this._data.tasks.find(t => t.id === taskId);
            if (!latest) return;
            supabaseStore.upsertTask(latest)
                .then(() => {
                    if (latest.assignees?.length) {
                        return supabaseStore.syncTaskAssignees(latest.id, latest.assignees);
                    }
                })
                .catch(e => console.error('[store] sync addTask:', e));
        }, 0);
        return newTask;
    }

    updateTask(taskId, updates) {
        if (!this.canEdit()) { console.warn('[store] updateTask: read-only project'); return null; }
        if (!this._batchingUndo) this._snapshot();
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
        // Defer Supabase sync so applyPredecessorConstraints (called by caller) can adjust dates first
        const updatedTaskId = taskId;
        const hasAssigneeUpdate = updates.assignees !== undefined;
        setTimeout(() => {
            const latest = this._data.tasks.find(t => t.id === updatedTaskId);
            if (!latest) return;
            supabaseStore.upsertTask(latest)
                .then(() => {
                    if (hasAssigneeUpdate) {
                        return supabaseStore.syncTaskAssignees(updatedTaskId, latest.assignees || []);
                    }
                })
                .catch(e => console.error('[store] sync updateTask:', e));
        }, 0);
        return this._data.tasks[idx];
    }

    deleteTask(taskId) {
        if (!this.canEdit()) { console.warn('[store] deleteTask: read-only project'); return; }
        if (!this._batchingUndo) this._snapshot();
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
        // Sync Supabase + notification aux owners si l'acteur est éditeur/invité
        const projectId = task.projectId;
        const taskName  = task.name;
        supabaseStore.deleteTask(taskId)
            .catch(e => console.error('[store] sync deleteTask:', e));
        // Log history
        supabaseStore.logHistory(projectId, 'a supprimé la tâche', task.isPhase ? 'phase' : 'task', taskName)
            .catch(() => {});
        // Notifier les owners si l'acteur n'est pas owner lui-même
        const role = this.getActiveProject()?._role;
        if (role && role !== 'owner') {
            supabaseStore.notifyTaskDeleted(projectId, taskName)
                .catch(e => console.error('[store] notifyTaskDeleted:', e));
        }
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
            // Sync dates ajustées vers Supabase
            supabaseStore.upsertTask(task)
                .catch(e => console.error('[store] sync applyPredecessorConstraints:', e));
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
     * Propagate date changes to successors based on link type.
     * For each successor, the new dates are computed from ALL its predecessors
     * (taking the latest constraint), not just the one that triggered propagation.
     * This correctly handles tasks with multiple predecessors (critical path logic).
     */
    propagateDependencies(taskId, visited = new Set()) {
        if (visited.has(taskId)) return; // prevent cycles
        visited.add(taskId);

        const task = this.getTask(taskId);
        if (!task) return;

        const successors = this.getSuccessors(taskId);
        successors.forEach(succ => {
            const succDuration = daysBetween(succ.startDate, succ.endDate);

            // Compute the tightest constraint from ALL predecessors of this successor
            let latestStart = null;
            let latestEnd = null;

            succ.dependencies.forEach(dep => {
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

            // Resolve latestStart / latestEnd into concrete new dates
            let newStartDate = null;
            let newEndDate = null;

            if (latestStart) {
                newStartDate = latestStart;
                newEndDate = addDays(latestStart, succDuration);
            }
            if (latestEnd) {
                // FF/SF constraint overrides if it pushes the end further out
                if (!newEndDate || latestEnd > newEndDate) {
                    newEndDate = latestEnd;
                    newStartDate = addDays(latestEnd, -succDuration);
                }
            }

            if (!newStartDate) return; // no applicable constraints

            const ns = formatDateISO(newStartDate);
            const ne = formatDateISO(newEndDate);

            if (ns === succ.startDate && ne === succ.endDate) return; // no change

            succ.startDate = ns;
            succ.endDate = ne;

            if (succ.parentId) this._recalculatePhase(succ.parentId);
            // Sync dates ajustées vers Supabase
            supabaseStore.upsertTask(succ)
                .catch(e => console.error('[store] sync propagateDependencies:', e));
            // Recursively propagate to this successor's own successors
            this.propagateDependencies(succ.id, visited);
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

        // Persist updated phase dates to Supabase
        supabaseStore.upsertTask(phase)
            .catch(e => console.error('[store] sync _recalculatePhase:', e));
    }

    /* ---- Resources ---- */

    getResources() {
        return [...this._data.resources];
    }

    getResource(resourceId) {
        return this._data.resources.find(r => r.id === resourceId) || null;
    }

    addResource(resource) {
        if (!this.canEdit()) { console.warn('[store] addResource: read-only project'); return null; }
        this._snapshot();
        const newResource = {
            id: generateId(),
            projectId: this._data.settings.activeProjectId,
            ...resource,
        };
        this._data.resources.push(newResource);
        this._save();
        this._emit('resource:add', newResource);
        // Sync Supabase + history
        supabaseStore.upsertResource(newResource)
            .catch(e => console.error('[store] sync addResource:', e));
        supabaseStore.logHistory(newResource.projectId, 'a ajouté la ressource', 'resource', newResource.name)
            .catch(() => {});
        return newResource;
    }

    updateResource(resourceId, updates) {
        if (!this.canEdit()) { console.warn('[store] updateResource: read-only project'); return null; }
        this._snapshot();
        const idx = this._data.resources.findIndex(r => r.id === resourceId);
        if (idx === -1) return null;
        this._data.resources[idx] = { ...this._data.resources[idx], ...updates };
        this._save();
        this._emit('resource:update', this._data.resources[idx]);
        // Sync Supabase en arrière-plan
        supabaseStore.upsertResource(this._data.resources[idx])
            .catch(e => console.error('[store] sync updateResource:', e));
        return this._data.resources[idx];
    }

    deleteResource(resourceId) {
        if (!this.canEdit()) { console.warn('[store] deleteResource: read-only project'); return; }
        this._snapshot();
        const resource = this._data.resources.find(r => r.id === resourceId);
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
        // Sync Supabase + history
        supabaseStore.deleteResource(resourceId)
            .catch(e => console.error('[store] sync deleteResource:', e));
        if (resource) {
            supabaseStore.logHistory(resource.projectId, 'a supprimé la ressource', 'resource', resource.name)
                .catch(() => {});
        }
    }

    /* ---- Resource ↔ Project membership ---- */

    getProjectResources(projectId) {
        const project = this._data.projects.find(p => p.id === projectId);
        if (!project) return [];
        const ids = new Set(project.resourceIds || []);
        return this._data.resources.filter(r => ids.has(r.id));
    }

    addResourceToProject(projectId, resourceId) {
        const project = this._data.projects.find(p => p.id === projectId);
        if (!project) return;
        if (!project.resourceIds) project.resourceIds = [];
        if (!project.resourceIds.includes(resourceId)) {
            this._snapshot();
            project.resourceIds.push(resourceId);
            this._save();
            this._emit('change', null);
            // Sync : mettre à jour le project_id de la ressource
            const resource = this._data.resources.find(r => r.id === resourceId);
            if (resource) {
                resource.projectId = projectId;
                supabaseStore.upsertResource(resource)
                    .catch(e => console.error('[store] sync addResourceToProject:', e));
            }
        }
    }

    removeResourceFromProject(projectId, resourceId) {
        const project = this._data.projects.find(p => p.id === projectId);
        if (!project || !project.resourceIds) return;
        this._snapshot();
        project.resourceIds = project.resourceIds.filter(id => id !== resourceId);
        this._save();
        this._emit('change', null);
    }

    isResourceInProject(projectId, resourceId) {
        const project = this._data.projects.find(p => p.id === projectId);
        return project ? (project.resourceIds || []).includes(resourceId) : false;
    }

    /* ---- Settings ---- */

    getSettings() {
        return { ...this._data.settings };
    }

    updateSettings(updates) {
        this._data.settings = { ...this._data.settings, ...updates };
        this._save();
        this._emit('settings:change', this._data.settings);
        // Sync customization to Supabase
        if (updates.customization) {
            supabaseStore.upsertUserSettings(updates.customization)
                .catch(e => console.error('[store] sync customization:', e));
        }
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

        const costs = this.getTaskCosts();

        return {
            totalTasks: nonPhaseTasks.length,
            activeTasks: activeTasks.length,
            completedTasks: nonPhaseTasks.filter(t => t.status === 'done').length,
            progress: totalProgress,
            daysRemaining,
            budget: costs.totalCost,
            budgetUsed: costs.totalCostDone,
        };
    }

    /**
     * Compute costs for each task based on assigned resources' rates + fixed costs.
     * For hourly resources: duration_days × 8h × hourlyRate
     * For daily resources (TJM): duration_days × dailyRate
     * Total cost = resource cost + fixedCost
     * Returns { tasks: [{task, durationDays, assignedResources, resourceCost, fixedCost, cost, costDone}], totalCost, totalCostDone }
     */
    getTaskCosts(projectId) {
        const pid = projectId || this._data.activeProjectId;
        const tasks = this.getTasks(pid).filter(t => !t.isPhase && !t.isMilestone);
        const resources = this.getResources();
        const HOURS_PER_DAY = 8;

        const result = [];
        let totalCost = 0;
        let totalCostDone = 0;

        for (const task of tasks) {
            const assigneeIds = task.assignees || (task.assignee ? [task.assignee] : []);
            const assignedResources = assigneeIds
                .map(id => resources.find(r => r.id === id))
                .filter(Boolean);

            const durationDays = Math.max(1, daysBetween(task.startDate, task.endDate) + 1);
            let resourceCost = 0;
            for (const r of assignedResources) {
                if (r.rateType === 'daily' && r.dailyRate) {
                    resourceCost += durationDays * r.dailyRate;
                } else {
                    resourceCost += durationDays * HOURS_PER_DAY * (r.hourlyRate || 0);
                }
            }
            // Support both new fixedCosts array and legacy fixedCost number
            const fixedCosts = Array.isArray(task.fixedCosts) ? task.fixedCosts : [];
            const fixedCost = fixedCosts.length > 0
                ? fixedCosts.reduce((s, fc) => s + (fc.amount || 0), 0)
                : (task.fixedCost || 0);
            const cost = resourceCost + fixedCost;
            const costDone = cost * (task.progress || 0) / 100;

            totalCost += cost;
            totalCostDone += costDone;

            result.push({
                task,
                durationDays,
                assignedResources: assignedResources.map(r => ({
                    id: r.id, name: r.name,
                    rateType: r.rateType || 'hourly',
                    hourlyRate: r.hourlyRate || 0,
                    dailyRate: r.dailyRate || 0,
                })),
                resourceCost,
                fixedCost,
                fixedCosts,
                cost,
                costDone,
            });
        }

        return { tasks: result, totalCost, totalCostDone };
    }

    getTimelineRange(zoomLevel) {
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

        if (zoomLevel === 'quarter') {
            // Snap to quarter boundaries with a small margin
            const qStart = new Date(minDate.getFullYear(), Math.floor(minDate.getMonth() / 3) * 3, 1);
            const endQ = Math.floor(maxDate.getMonth() / 3) * 3 + 2;
            const qEnd = new Date(maxDate.getFullYear(), endQ + 1, 0); // last day of end quarter
            return { start: qStart, end: qEnd };
        } else if (zoomLevel === 'month') {
            // Snap to month boundaries (no extra day padding to avoid inflating month count)
            const mStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            const mEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0); // last day of end month
            return { start: mStart, end: mEnd };
        } else {
            // Day/Week: add some padding in days
            return {
                start: addDays(minDate, -7),
                end: addDays(maxDate, 14),
            };
        }
    }

    /* ---- Critical Path ---- */

    /**
     * Compute the critical path: the longest chain of dependent tasks
     * that determines the project minimum duration.
     * Returns an array of task IDs on the critical path.
     */
    getCriticalPath() {
        const tasks = this.getTasks().filter(t => !t.isPhase);
        if (tasks.length === 0) return [];

        const taskMap = {};
        tasks.forEach(t => { taskMap[t.id] = t; });

        // Build adjacency: task -> successors
        const successorsOf = {};
        const predecessorsOf = {};
        tasks.forEach(t => {
            successorsOf[t.id] = [];
            predecessorsOf[t.id] = [];
        });
        tasks.forEach(t => {
            (t.dependencies || []).forEach(dep => {
                const predId = dep.taskId;
                if (taskMap[predId]) {
                    successorsOf[predId].push(t.id);
                    predecessorsOf[t.id].push(predId);
                }
            });
        });

        // Forward pass: earliest start / earliest finish
        const es = {}; // earliest start
        const ef = {}; // earliest finish
        const duration = {};
        tasks.forEach(t => {
            duration[t.id] = daysBetween(t.startDate, t.endDate) + 1;
            es[t.id] = 0;
            ef[t.id] = 0;
        });

        // Topological sort
        const visited = new Set();
        const order = [];
        const visit = (id) => {
            if (visited.has(id)) return;
            visited.add(id);
            predecessorsOf[id].forEach(pid => visit(pid));
            order.push(id);
        };
        tasks.forEach(t => visit(t.id));

        // Forward pass
        order.forEach(id => {
            if (predecessorsOf[id].length === 0) {
                es[id] = 0;
            } else {
                es[id] = Math.max(...predecessorsOf[id].map(pid => ef[pid]));
            }
            ef[id] = es[id] + duration[id];
        });

        const projectEnd = Math.max(...tasks.map(t => ef[t.id]));

        // Backward pass: latest start / latest finish
        const ls = {}; // latest start
        const lf = {}; // latest finish
        tasks.forEach(t => {
            lf[t.id] = projectEnd;
            ls[t.id] = projectEnd;
        });

        for (let i = order.length - 1; i >= 0; i--) {
            const id = order[i];
            if (successorsOf[id].length === 0) {
                lf[id] = projectEnd;
            } else {
                lf[id] = Math.min(...successorsOf[id].map(sid => ls[sid]));
            }
            ls[id] = lf[id] - duration[id];
        }

        // Critical path: tasks where float (ls - es) === 0
        const critical = [];
        tasks.forEach(t => {
            const float = ls[t.id] - es[t.id];
            if (Math.abs(float) < 0.001) {
                critical.push(t.id);
            }
        });

        return critical;
    }

    /* ---- Import ---- */

    importProject(jsonData) {
        this._snapshot();
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (data.project && data.tasks) {
                // Assign new IDs to avoid conflicts
                const idMap = {};
                const newProjectId = generateId();
                idMap[data.project.id] = newProjectId;

                const newProject = {
                    ...data.project,
                    id: newProjectId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                this._data.projects.push(newProject);

                // Map task IDs
                data.tasks.forEach(t => {
                    idMap[t.id] = generateId();
                });

                // Import tasks with remapped IDs
                data.tasks.forEach(t => {
                    const newTask = {
                        ...t,
                        id: idMap[t.id],
                        projectId: newProjectId,
                        parentId: t.parentId ? (idMap[t.parentId] || null) : null,
                        assignees: t.assignees || (t.assignee ? [t.assignee] : []),
                        dependencies: (t.dependencies || []).map(d => {
                            if (typeof d === 'string') {
                                return { taskId: idMap[d] || d, type: 'FS' };
                            }
                            return { taskId: idMap[d.taskId] || d.taskId, type: d.type || 'FS' };
                        }),
                    };
                    this._data.tasks.push(newTask);
                });

                // Import resources if present
                if (data.resources) {
                    data.resources.forEach(r => {
                        const exists = this._data.resources.find(
                            existing => existing.name === r.name && existing.role === r.role
                        );
                        if (!exists) {
                            const newId = generateId();
                            idMap[r.id] = newId;
                            this._data.resources.push({ ...r, id: newId });
                        } else {
                            idMap[r.id] = exists.id;
                        }
                    });

                    // Remap assignee IDs in imported tasks
                    this._data.tasks
                        .filter(t => t.projectId === newProjectId)
                        .forEach(t => {
                            if (t.assignee && idMap[t.assignee]) t.assignee = idMap[t.assignee];
                            if (t.assignees) {
                                t.assignees = t.assignees.map(id => idMap[id] || id);
                            }
                        });
                }

                this._data.settings.activeProjectId = newProjectId;
                this._save();

                // Sync to Supabase in background (project → resources → tasks)
                auth.getUser().then(async user => {
                    if (!user) return;
                    try {
                        await supabaseStore.upsertProject(newProject, user.id);
                        console.log('[importProject] project saved:', newProjectId);
                    } catch (e) {
                        console.error('[importProject] upsertProject failed:', e?.message || e);
                        return;
                    }
                    // Resources
                    for (const r of (data.resources || [])) {
                        const mappedRes = this._data.resources.find(res => res.id === idMap[r.id]);
                        if (mappedRes) {
                            const syncRes = { ...mappedRes, projectId: newProjectId };
                            await supabaseStore.upsertResource(syncRes).catch(e =>
                                console.error('[importProject] upsertResource failed:', e?.message || e)
                            );
                        }
                    }
                    // Tasks: parents first
                    const sorted = [...data.tasks].sort((a, b) => {
                        if (!a.parentId && b.parentId) return -1;
                        if (a.parentId && !b.parentId) return 1;
                        return 0;
                    });
                    for (const t of sorted) {
                        const newTask = this._data.tasks.find(tk => tk.id === idMap[t.id]);
                        if (newTask) {
                            await supabaseStore.upsertTask(newTask).catch(e =>
                                console.error('[importProject] upsertTask failed:', e?.message || e)
                            );
                        }
                    }
                    console.log('[importProject] Supabase sync complete');
                });

                this._emit('project:import', newProjectId);
                return newProject;
            }
        } catch (e) {
            console.error('Import failed:', e);
        }
        return null;
    }

    exportAllProjects() {
        const projects = this.getProjects();
        const allTasks = [];
        projects.forEach(p => {
            const tasks = this.getTasks(p.id);
            allTasks.push(...tasks);
        });
        return {
            version: 2,
            type: 'full-backup',
            projects,
            tasks: allTasks,
            resources: this.getResources(),
            customization: this._data.settings.customization || {},
            exportedAt: new Date().toISOString(),
        };
    }

    async importAllProjects(jsonData) {
        this._snapshot();
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (data.type !== 'full-backup' || !data.projects || !data.tasks) return null;

            const idMap = {};
            let lastProjectId = null;

            // 1. Préparer les IDs des ressources (sans les ajouter encore)
            if (data.resources) {
                data.resources.forEach(r => {
                    const exists = this._data.resources.find(
                        existing => existing.name === r.name && existing.role === r.role
                    );
                    idMap[r.id] = exists ? exists.id : generateId();
                });
            }

            // 2. Importer les projets (et remplir idMap pour les projets)
            data.projects.forEach(proj => {
                const newProjectId = generateId();
                idMap[proj.id] = newProjectId;
                lastProjectId = newProjectId;

                // Remap resourceIds du projet
                const resourceIds = (proj.resourceIds || []).map(id => idMap[id] || id);

                this._data.projects.push({
                    ...proj,
                    id: newProjectId,
                    resourceIds,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            });

            // 3. Ajouter les ressources avec projectId remappé
            if (data.resources) {
                data.resources.forEach(r => {
                    const exists = this._data.resources.find(res => res.id === idMap[r.id]);
                    if (!exists) {
                        this._data.resources.push({
                            ...r,
                            id: idMap[r.id],
                            projectId: idMap[r.projectId] || r.projectId,
                        });
                    }
                });
            }

            // Remap task IDs
            data.tasks.forEach(t => {
                idMap[t.id] = generateId();
            });

            // Import tasks with remapped IDs
            data.tasks.forEach(t => {
                const newTask = {
                    ...t,
                    id: idMap[t.id],
                    projectId: idMap[t.projectId] || t.projectId,
                    parentId: t.parentId ? (idMap[t.parentId] || null) : null,
                    assignees: (t.assignees || (t.assignee ? [t.assignee] : [])).map(id => idMap[id] || id),
                    assignee: t.assignee ? (idMap[t.assignee] || t.assignee) : null,
                    dependencies: (t.dependencies || []).map(d => {
                        if (typeof d === 'string') {
                            return { taskId: idMap[d] || d, type: 'FS' };
                        }
                        return { taskId: idMap[d.taskId] || d.taskId, type: d.type || 'FS' };
                    }),
                };
                this._data.tasks.push(newTask);
            });

            if (lastProjectId) {
                this._data.settings.activeProjectId = lastProjectId;
            }
            // Restore customization (logo, avatar, etc.)
            if (data.customization) {
                this._data.settings.customization = { ...this._data.settings.customization, ...data.customization };
            }
            this._save();

            // Sync imported projects and resources to Supabase
            // NOTE: emit is deferred until AFTER Supabase sync to avoid race conditions
            // (task upsert would fail if project doesn't exist in Supabase yet)
            const user = await auth.getUser();
            console.log('[import] Supabase sync start, user:', user?.id);
            if (user) {
                // 1. Projects first
                for (const proj of data.projects) {
                    const mappedProj = this._data.projects.find(p => p.id === idMap[proj.id]);
                    console.log('[import] syncing project:', mappedProj?.id, mappedProj?.name);
                    if (mappedProj) {
                        try {
                            await supabaseStore.upsertProject(mappedProj, user.id);
                            console.log('[import] project saved OK:', mappedProj.id);
                        } catch (e) {
                            console.error('[import] upsertProject FAILED:', e?.message || e, 'code:', e?.code);
                        }
                    }
                }
                // 2. Resources with remapped projectId
                for (const res of (data.resources || [])) {
                    const mappedRes = this._data.resources.find(r => r.id === idMap[res.id]);
                    if (mappedRes) {
                        const syncRes = { ...mappedRes, projectId: idMap[res.projectId] || mappedRes.projectId };
                        try {
                            await supabaseStore.upsertResource(syncRes);
                        } catch (e) {
                            console.error('[import] upsertResource FAILED:', e?.message || e);
                        }
                    }
                }
                // 3. Tasks: parents first (null parentId), then children
                const sortedTasks = [...data.tasks].sort((a, b) => {
                    if (!a.parentId && b.parentId) return -1;
                    if (a.parentId && !b.parentId) return 1;
                    return 0;
                });
                for (const task of sortedTasks) {
                    const newTask = this._data.tasks.find(t => t.id === idMap[task.id]);
                    if (newTask) {
                        try {
                            await supabaseStore.upsertTask(newTask);
                        } catch (e) {
                            console.error('[import] upsertTask FAILED:', e?.message || e);
                        }
                    }
                }
                console.log('[import] Supabase sync complete');
            } else {
                console.warn('[import] no authenticated user, skipping Supabase sync');
            }

            // Emit AFTER sync so _loadProjectData doesn't race against Supabase writes
            this._emit('project:import', lastProjectId);

            return { count: data.projects.length };
        } catch (e) {
            console.error('Import all projects failed:', e);
        }
        return null;
    }

    importFromMSProjectXML(xmlString) {
        this._snapshot();
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlString, 'application/xml');
            const ns = 'http://schemas.microsoft.com/project';

            const getTag = (el, tag) => {
                const node = el.getElementsByTagNameNS(ns, tag)[0] || el.getElementsByTagName(tag)[0];
                return node ? node.textContent.trim() : '';
            };

            const projectName = getTag(doc.documentElement, 'Name') || 'Projet importé (XML)';
            const taskEls = Array.from(doc.getElementsByTagNameNS(ns, 'Task').length
                ? doc.getElementsByTagNameNS(ns, 'Task')
                : doc.getElementsByTagName('Task'));
            const resEls = Array.from(doc.getElementsByTagNameNS(ns, 'Resource').length
                ? doc.getElementsByTagNameNS(ns, 'Resource')
                : doc.getElementsByTagName('Resource'));
            const assignEls = Array.from(doc.getElementsByTagNameNS(ns, 'Assignment').length
                ? doc.getElementsByTagNameNS(ns, 'Assignment')
                : doc.getElementsByTagName('Assignment'));

            const newProjectId = generateId();
            const uidToId = {};
            const resUidToId = {};
            const tasks = [];
            const resources = [];

            // Parse resources (skip UID 0 which is the blank resource)
            resEls.forEach(el => {
                const uid = getTag(el, 'UID');
                const name = getTag(el, 'Name');
                if (uid === '0' || !name) return;
                const id = generateId();
                resUidToId[uid] = id;
                resources.push({ id, name, role: '', color: this._randomColor() });
            });

            // Parse tasks (skip UID 0 which is the project summary)
            const parentMap = {};
            taskEls.forEach(el => {
                const uid = getTag(el, 'UID');
                if (uid === '0') return;

                const outlineLevel = parseInt(getTag(el, 'OutlineLevel')) || 1;
                const isSummary = getTag(el, 'Summary') === '1';
                const startStr = getTag(el, 'Start');
                const finishStr = getTag(el, 'Finish');
                const name = getTag(el, 'Name') || 'Tâche sans nom';
                const pct = parseInt(getTag(el, 'PercentComplete')) || 0;

                const startDate = startStr ? startStr.substring(0, 10) : '';
                const endDate = finishStr ? finishStr.substring(0, 10) : '';

                const id = generateId();
                uidToId[uid] = id;

                // Track parent relationship by outline level
                parentMap[outlineLevel] = id;
                const parentId = outlineLevel > 1 ? (parentMap[outlineLevel - 1] || null) : null;

                tasks.push({
                    id,
                    projectId: newProjectId,
                    name,
                    startDate,
                    endDate,
                    progress: pct,
                    isPhase: isSummary,
                    parentId,
                    assignees: [],
                    dependencies: [],
                    order: tasks.length,
                    color: isSummary ? '#6366F1' : '#3B82F6',
                });
            });

            // Parse assignments
            assignEls.forEach(el => {
                const taskUID = getTag(el, 'TaskUID');
                const resUID = getTag(el, 'ResourceUID');
                const taskId = uidToId[taskUID];
                const resId = resUidToId[resUID];
                if (taskId && resId) {
                    const task = tasks.find(t => t.id === taskId);
                    if (task) task.assignees.push(resId);
                }
            });

            // Commit to store
            const newProject = {
                id: newProjectId,
                name: projectName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            this._data.projects.push(newProject);
            tasks.forEach(t => this._data.tasks.push(t));
            resources.forEach(r => {
                const exists = this._data.resources.find(e => e.name === r.name);
                if (!exists) {
                    this._data.resources.push(r);
                } else {
                    // Remap assignees to existing resource
                    tasks.filter(t => t.projectId === newProjectId).forEach(t => {
                        t.assignees = t.assignees.map(id => id === r.id ? exists.id : id);
                    });
                }
            });

            this._data.settings.activeProjectId = newProjectId;
            this._save();
            this._emit('project:import', newProjectId);
            return newProject;
        } catch (e) {
            console.error('MS Project XML import failed:', e);
        }
        return null;
    }

    importFromExcel(rows, fileName) {
        this._snapshot();
        try {
            // Auto-detect column mapping from headers
            const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
            const headerMap = Object.keys(rows[0]);

            const find = (keywords) => {
                for (const kw of keywords) {
                    const idx = headers.findIndex(h => h.includes(kw));
                    if (idx >= 0) return headerMap[idx];
                }
                return null;
            };

            const colName = find(['nom', 'name', 'tâche', 'tache', 'task', 'titre', 'title', 'libellé', 'libelle']);
            const colStart = find(['début', 'debut', 'start', 'date début', 'date debut', 'begin', 'from']);
            const colEnd = find(['fin', 'end', 'finish', 'date fin', 'to', 'échéance', 'echeance']);
            const colProgress = find(['progress', 'avancement', '%', 'pct', 'percent', '% achevé', 'acheve']);
            const colPhase = find(['phase', 'groupe', 'group', 'catégorie', 'categorie', 'section', 'wbs']);
            const colAssignee = find(['ressource', 'resource', 'assigné', 'assigne', 'assignee', 'responsable']);

            if (!colName) {
                console.error('No name column found. Headers:', headers);
                return null;
            }

            const projectName = fileName.replace(/\.(xlsx|xls)$/i, '').replace(/_/g, ' ') || 'Projet importé (Excel)';
            const newProjectId = generateId();
            const tasks = [];
            const phaseMap = {};
            const resourceMap = {};

            const fmtDate = (v) => {
                if (!v) return '';
                if (v instanceof Date) return v.toISOString().substring(0, 10);
                const s = String(v).trim();
                // Try ISO
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
                // Try DD/MM/YYYY
                const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
                if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
                return '';
            };

            rows.forEach((row, i) => {
                const name = String(row[colName] || '').trim();
                if (!name) return;

                const startDate = colStart ? fmtDate(row[colStart]) : '';
                const endDate = colEnd ? fmtDate(row[colEnd]) : '';
                const progress = colProgress ? (parseInt(row[colProgress]) || 0) : 0;
                const phaseName = colPhase ? String(row[colPhase] || '').trim() : '';
                const assigneeName = colAssignee ? String(row[colAssignee] || '').trim() : '';

                let parentId = null;
                if (phaseName && phaseName !== name) {
                    if (!phaseMap[phaseName]) {
                        const phaseId = generateId();
                        phaseMap[phaseName] = phaseId;
                        tasks.push({
                            id: phaseId,
                            projectId: newProjectId,
                            name: phaseName,
                            startDate: '',
                            endDate: '',
                            progress: 0,
                            isPhase: true,
                            parentId: null,
                            assignees: [],
                            dependencies: [],
                            order: tasks.length,
                            color: '#6366F1',
                        });
                    }
                    parentId = phaseMap[phaseName];
                }

                // Handle assignee
                const assignees = [];
                if (assigneeName) {
                    if (!resourceMap[assigneeName]) {
                        const resId = generateId();
                        resourceMap[assigneeName] = resId;
                    }
                    assignees.push(resourceMap[assigneeName]);
                }

                tasks.push({
                    id: generateId(),
                    projectId: newProjectId,
                    name,
                    startDate,
                    endDate,
                    progress,
                    isPhase: false,
                    parentId,
                    assignees,
                    dependencies: [],
                    order: tasks.length,
                    color: '#3B82F6',
                });
            });

            // Auto-calculate phase dates
            tasks.filter(t => t.isPhase).forEach(phase => {
                const children = tasks.filter(t => t.parentId === phase.id && t.startDate && t.endDate);
                if (children.length) {
                    phase.startDate = children.reduce((min, c) => (!min || c.startDate < min) ? c.startDate : min, '');
                    phase.endDate = children.reduce((max, c) => (!max || c.endDate > max) ? c.endDate : max, '');
                    const totalPct = children.reduce((s, c) => s + c.progress, 0);
                    phase.progress = Math.round(totalPct / children.length);
                }
            });

            // Commit to store
            const newProject = {
                id: newProjectId,
                name: projectName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            this._data.projects.push(newProject);
            tasks.forEach(t => this._data.tasks.push(t));

            // Add resources
            Object.entries(resourceMap).forEach(([name, id]) => {
                const exists = this._data.resources.find(e => e.name === name);
                if (!exists) {
                    this._data.resources.push({ id, name, role: '', color: this._randomColor() });
                } else {
                    // Remap
                    tasks.filter(t => t.projectId === newProjectId).forEach(t => {
                        t.assignees = t.assignees.map(aid => aid === id ? exists.id : aid);
                    });
                }
            });

            this._data.settings.activeProjectId = newProjectId;
            this._save();
            this._emit('project:import', newProjectId);
            return newProject;
        } catch (e) {
            console.error('Excel import failed:', e);
        }
        return null;
    }

    _randomColor() {
        const colors = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /* ---- Building Permits ---- */

    getPermitDeadlines(taskId) {
        const task = this.getTask(taskId);
        if (!task || !task.isPermit) return null;
        return calculatePermitDeadlines(task);
    }

    getPermitNotifications(alertDaysBefore = 7) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const notifications = [];
        const tasks = this.getTasks();
        const permits = tasks.filter(t => t.isPermit);

        permits.forEach(permit => {
            const deadlines = calculatePermitDeadlines(permit);
            const name = permit.name;

            // Alert: decision deadline approaching
            if (deadlines.decisionDeadline) {
                const dl = new Date(deadlines.decisionDeadline);
                const daysLeft = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
                if (daysLeft >= 0 && daysLeft <= alertDaysBefore) {
                    notifications.push({
                        type: 'permit_decision',
                        level: daysLeft <= 3 ? 'urgent' : 'warning',
                        message: `${name} : décision dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
                        taskId: permit.id,
                        date: deadlines.decisionDeadline,
                    });
                }
            }

            // Alert: instruction suspended (waiting for docs)
            if (deadlines.suspended) {
                notifications.push({
                    type: 'permit_suspended',
                    level: 'warning',
                    message: `${name} : instruction suspendue (pièces complémentaires attendues)`,
                    taskId: permit.id,
                });
            }

            // Alert: appeal end date approaching
            if (deadlines.appealEndDate) {
                const appeal = new Date(deadlines.appealEndDate);
                const daysLeft = Math.ceil((appeal - today) / (1000 * 60 * 60 * 24));
                if (daysLeft >= 0 && daysLeft <= alertDaysBefore) {
                    notifications.push({
                        type: 'permit_appeal',
                        level: 'info',
                        message: `${name} : purge de recours dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
                        taskId: permit.id,
                        date: deadlines.appealEndDate,
                    });
                } else if (daysLeft < 0) {
                    notifications.push({
                        type: 'permit_appeal_cleared',
                        level: 'success',
                        message: `${name} : recours purgé`,
                        taskId: permit.id,
                    });
                }
            }

            // Alert: permit expiry
            if (deadlines.expiryDate) {
                const expiry = new Date(deadlines.expiryDate);
                const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                if (daysLeft >= 0 && daysLeft <= 90) {
                    notifications.push({
                        type: 'permit_expiry',
                        level: daysLeft <= 30 ? 'urgent' : 'warning',
                        message: `${name} : péremption dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
                        taskId: permit.id,
                        date: deadlines.expiryDate,
                    });
                }
            }
        });

        return notifications;
    }

    /* ---- Reset ---- */

    /* ---- Plan / Subscription helpers ---- */

    /** Retourne le plan effectif : 'pro' pendant l'essai, sinon le plan réel */
    getEffectivePlan() {
        const { plan, planStatus, trialEndsAt } = this._planInfo;
        if (planStatus === 'trialing' && trialEndsAt && new Date(trialEndsAt) > new Date()) {
            return 'pro';
        }
        if (planStatus === 'canceled' || planStatus === 'past_due') return 'free';
        return plan;
    }

    getPlanInfo() {
        return { ...this._planInfo };
    }

    /** Nombre de jours restants dans l'essai (0 si expiré ou non en essai) */
    getTrialDaysLeft() {
        const { planStatus, trialEndsAt } = this._planInfo;
        if (planStatus !== 'trialing' || !trialEndsAt) return 0;
        const diff = Math.ceil((new Date(trialEndsAt) - new Date()) / 86400000);
        return Math.max(0, diff);
    }

    isTrialing() {
        return this._planInfo.planStatus === 'trialing' && this.getTrialDaysLeft() > 0;
    }

    canAddProject() {
        const limit = PLAN_LIMITS[this.getEffectivePlan()].projects;
        return this._data.projects.length < limit;
    }

    canAddTask(projectId) {
        const pid = projectId || this._data.settings.activeProjectId;
        const limit = PLAN_LIMITS[this.getEffectivePlan()].tasks;
        if (limit === Infinity) return true;
        const count = this._data.tasks.filter(t => t.projectId === pid && !t.isPhase).length;
        return count < limit;
    }

    canAddCollaborator(projectId) {
        const pid = projectId || this._data.settings.activeProjectId;
        const limit = PLAN_LIMITS[this.getEffectivePlan()].collaborators;
        if (limit === Infinity) return true;
        const project = this._data.projects.find(p => p.id === pid);
        const count = (project?.resourceIds || []).length;
        return count < limit;
    }

    /** Met à jour les infos de plan localement (après paiement ou changement webhook) */
    updatePlanInfo(updates) {
        this._planInfo = { ...this._planInfo, ...updates };
        this._emit('plan:loaded', this._planInfo);
    }

    reset() {
        this._data = this._createDefaults();
        this._save();
        this._emit('reset', null);
    }
}

// Singleton export
export const store = new Store();
export { PERMIT_TYPES, PERMIT_STATUSES, calculatePermitDeadlines, PLAN_LIMITS, STRIPE_PRICES, PLAN_PRICES };
