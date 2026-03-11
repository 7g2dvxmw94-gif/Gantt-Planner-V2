/* ========================================
   CLOUD BACKUP - Firebase Integration
   Gantt Planner Pro
   ======================================== */

const CONFIG_KEY = 'gantt-planner-firebase-config';

class CloudBackup {
    constructor() {
        this._app = null;
        this._auth = null;
        this._db = null;
        this._user = null;
        this._config = null;
        this._ready = false;
        this._listeners = {};
    }

    /* ---- Events ---- */

    on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    }

    _emit(event, data) {
        (this._listeners[event] || []).forEach(fn => fn(data));
    }

    /* ---- Config ---- */

    getConfig() {
        if (this._config) return this._config;
        try {
            const raw = localStorage.getItem(CONFIG_KEY);
            if (raw) {
                this._config = JSON.parse(raw);
                return this._config;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    saveConfig(config) {
        this._config = config;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    clearConfig() {
        this._config = null;
        localStorage.removeItem(CONFIG_KEY);
        this._ready = false;
        this._user = null;
        this._app = null;
        this._auth = null;
        this._db = null;
    }

    isReady() { return this._ready; }
    getUser() { return this._user; }

    /* ---- Firebase SDK Loading ---- */

    async _loadFirebaseSDK() {
        if (window.firebase && window.firebase.apps) return;

        const scripts = [
            'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
            'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
            'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
        ];

        for (const src of scripts) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = () => reject(new Error('Impossible de charger Firebase SDK'));
                document.head.appendChild(s);
            });
        }
    }

    /* ---- Init ---- */

    async init(config) {
        if (!config) config = this.getConfig();
        if (!config || !config.apiKey || !config.projectId) {
            throw new Error('Configuration Firebase manquante');
        }

        await this._loadFirebaseSDK();

        // Initialize or reuse app
        if (window.firebase.apps.length === 0) {
            this._app = window.firebase.initializeApp(config);
        } else {
            this._app = window.firebase.apps[0];
        }

        this._auth = window.firebase.auth();
        this._db = window.firebase.firestore();
        this._ready = true;
        this.saveConfig(config);

        // Listen for auth state
        this._auth.onAuthStateChanged((user) => {
            this._user = user;
            this._emit('auth', user);
        });

        return true;
    }

    /* ---- Auth ---- */

    async signInWithGoogle() {
        if (!this._auth) throw new Error('Firebase non initialisé');
        const provider = new window.firebase.auth.GoogleAuthProvider();
        const result = await this._auth.signInWithPopup(provider);
        this._user = result.user;
        return this._user;
    }

    async signInWithEmail(email, password) {
        if (!this._auth) throw new Error('Firebase non initialisé');
        const result = await this._auth.signInWithEmailAndPassword(email, password);
        this._user = result.user;
        return this._user;
    }

    async registerWithEmail(email, password) {
        if (!this._auth) throw new Error('Firebase non initialisé');
        const result = await this._auth.createUserWithEmailAndPassword(email, password);
        this._user = result.user;
        return this._user;
    }

    async signOut() {
        if (!this._auth) return;
        await this._auth.signOut();
        this._user = null;
    }

    /* ---- Backups CRUD ---- */

    _backupsRef() {
        if (!this._db || !this._user) throw new Error('Non connecté');
        return this._db.collection('users').doc(this._user.uid).collection('backups');
    }

    async saveBackup(name, data) {
        const ref = this._backupsRef();
        const doc = await ref.add({
            name: name,
            projectCount: data.projects ? data.projects.length : 1,
            taskCount: data.tasks ? data.tasks.length : 0,
            size: JSON.stringify(data).length,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            data: JSON.stringify(data),
        });
        return doc.id;
    }

    async listBackups() {
        const ref = this._backupsRef();
        const snapshot = await ref.orderBy('createdAt', 'desc').limit(50).get();
        const backups = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            backups.push({
                id: doc.id,
                name: d.name,
                projectCount: d.projectCount || 0,
                taskCount: d.taskCount || 0,
                size: d.size || 0,
                createdAt: d.createdAt ? d.createdAt.toDate() : new Date(),
            });
        });
        return backups;
    }

    async loadBackup(backupId) {
        const ref = this._backupsRef();
        const doc = await ref.doc(backupId).get();
        if (!doc.exists) throw new Error('Sauvegarde introuvable');
        const d = doc.data();
        return JSON.parse(d.data);
    }

    async deleteBackup(backupId) {
        const ref = this._backupsRef();
        await ref.doc(backupId).delete();
    }
}

export const cloudBackup = new CloudBackup();
