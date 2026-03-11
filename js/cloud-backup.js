/* ========================================
   CLOUD BACKUP - Google Drive Integration
   Gantt Planner Pro
   ======================================== */

const GDRIVE_CONFIG_KEY = 'gantt-planner-gdrive-token';
const GDRIVE_FOLDER_NAME = 'Gantt Planner Backups';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

class CloudBackup {
    constructor() {
        this._token = null;
        this._user = null;
        this._folderId = null;
        this._listeners = {};
        this._tokenClient = null;
        this._gapiLoaded = false;
        this._gisLoaded = false;
    }

    /* ---- Events ---- */

    on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    }

    _emit(event, data) {
        (this._listeners[event] || []).forEach(fn => fn(data));
    }

    /* ---- State ---- */

    isSignedIn() { return !!this._token; }
    getUser() { return this._user; }

    /* ---- Google API Loading ---- */

    async _loadGapiScript() {
        if (this._gapiLoaded) return;
        if (window.gapi) { this._gapiLoaded = true; return; }

        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://apis.google.com/js/api.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Impossible de charger Google API'));
            document.head.appendChild(s);
        });

        await new Promise((resolve) => {
            window.gapi.load('client', resolve);
        });

        this._gapiLoaded = true;
    }

    async _loadGisScript() {
        if (this._gisLoaded) return;
        if (window.google && window.google.accounts) { this._gisLoaded = true; return; }

        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Impossible de charger Google Identity Services'));
            document.head.appendChild(s);
        });

        this._gisLoaded = true;
    }

    /* ---- Init ---- */

    async init(clientId) {
        if (!clientId) {
            throw new Error('Client ID Google manquant');
        }

        await Promise.all([
            this._loadGapiScript(),
            this._loadGisScript(),
        ]);

        await window.gapi.client.init({});
        await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');

        this._tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: () => {}, // set at sign-in time
        });

        // Check for existing token
        const saved = localStorage.getItem(GDRIVE_CONFIG_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.token && data.expiry && Date.now() < data.expiry) {
                    window.gapi.client.setToken({ access_token: data.token });
                    this._token = data.token;
                    this._user = data.user || null;
                    this._emit('auth', this._user);
                }
            } catch (e) { /* ignore */ }
        }

        return true;
    }

    /* ---- Auth ---- */

    signIn() {
        return new Promise((resolve, reject) => {
            if (!this._tokenClient) {
                reject(new Error('Google Drive non initialisé'));
                return;
            }

            this._tokenClient.callback = async (response) => {
                if (response.error) {
                    reject(new Error(response.error_description || response.error));
                    return;
                }

                this._token = response.access_token;

                // Get user info
                try {
                    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${this._token}` }
                    });
                    const info = await res.json();
                    this._user = {
                        displayName: info.name,
                        email: info.email,
                        photoURL: info.picture,
                    };
                } catch (e) {
                    this._user = { displayName: 'Utilisateur Google', email: '' };
                }

                // Persist token (1h validity)
                const expiry = Date.now() + (response.expires_in * 1000);
                localStorage.setItem(GDRIVE_CONFIG_KEY, JSON.stringify({
                    token: this._token,
                    expiry,
                    user: this._user,
                }));

                this._emit('auth', this._user);
                resolve(this._user);
            };

            this._tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    signOut() {
        if (this._token) {
            window.google.accounts.oauth2.revoke(this._token);
        }
        this._token = null;
        this._user = null;
        this._folderId = null;
        localStorage.removeItem(GDRIVE_CONFIG_KEY);
        window.gapi.client.setToken(null);
        this._emit('auth', null);
    }

    /* ---- Drive Folder ---- */

    async _getOrCreateFolder() {
        if (this._folderId) return this._folderId;

        // Search for existing folder
        const searchRes = await window.gapi.client.drive.files.list({
            q: `name='${GDRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (searchRes.result.files && searchRes.result.files.length > 0) {
            this._folderId = searchRes.result.files[0].id;
            return this._folderId;
        }

        // Create folder
        const createRes = await window.gapi.client.drive.files.create({
            resource: {
                name: GDRIVE_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        });

        this._folderId = createRes.result.id;
        return this._folderId;
    }

    /* ---- Backups CRUD ---- */

    async saveBackup(name, data) {
        if (!this._token) throw new Error('Non connecté');

        const folderId = await this._getOrCreateFolder();
        const jsonStr = JSON.stringify(data);
        const blob = new Blob([jsonStr], { type: 'application/json' });

        const metadata = {
            name: `${name}.json`,
            mimeType: 'application/json',
            parents: [folderId],
            description: JSON.stringify({
                projectCount: data.projects ? data.projects.length : 1,
                taskCount: data.tasks ? data.tasks.length : 0,
                createdAt: new Date().toISOString(),
            }),
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,description', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this._token}` },
            body: form,
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Erreur lors de la sauvegarde');
        }

        return (await response.json()).id;
    }

    async listBackups() {
        if (!this._token) throw new Error('Non connecté');

        const folderId = await this._getOrCreateFolder();

        const res = await window.gapi.client.drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
            fields: 'files(id, name, size, createdTime, description)',
            orderBy: 'createdTime desc',
            pageSize: 50,
        });

        return (res.result.files || []).map(f => {
            let meta = {};
            try { meta = JSON.parse(f.description || '{}'); } catch (e) { /* ignore */ }
            return {
                id: f.id,
                name: f.name.replace(/\.json$/, ''),
                projectCount: meta.projectCount || 0,
                taskCount: meta.taskCount || 0,
                size: parseInt(f.size) || 0,
                createdAt: new Date(f.createdTime),
            };
        });
    }

    async loadBackup(fileId) {
        if (!this._token) throw new Error('Non connecté');

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${this._token}` },
        });

        if (!response.ok) throw new Error('Impossible de charger la sauvegarde');
        return await response.json();
    }

    async deleteBackup(fileId) {
        if (!this._token) throw new Error('Non connecté');

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this._token}` },
        });

        if (!response.ok && response.status !== 204) {
            throw new Error('Impossible de supprimer la sauvegarde');
        }
    }
}

export const cloudBackup = new CloudBackup();
