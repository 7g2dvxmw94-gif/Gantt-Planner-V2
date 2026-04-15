/* ========================================
   CLOUD BACKUP - OneDrive Integration
   Gantly
   ======================================== */

const ONEDRIVE_CONFIG_KEY = 'gantt-planner-onedrive-token';
const ONEDRIVE_FOLDER_NAME = 'Gantt Planner Backups';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

class OneDriveBackup {
    constructor() {
        this._token = null;
        this._user = null;
        this._folderId = null;
        this._listeners = {};
        this._msalInstance = null;
        this._msalLoaded = false;
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

    /* ---- MSAL Loading ---- */

    async _loadMsalScript() {
        if (this._msalLoaded) return;
        if (window.msal) { this._msalLoaded = true; return; }

        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Impossible de charger Microsoft Authentication Library'));
            document.head.appendChild(s);
        });

        this._msalLoaded = true;
    }

    /* ---- Init ---- */

    async init(clientId) {
        if (!clientId) {
            throw new Error('Client ID Microsoft manquant');
        }

        await this._loadMsalScript();

        const msalConfig = {
            auth: {
                clientId: clientId,
                authority: 'https://login.microsoftonline.com/common',
                redirectUri: window.location.origin + window.location.pathname,
            },
            cache: {
                cacheLocation: 'localStorage',
                storeAuthStateInCookie: false,
            },
        };

        this._msalInstance = new window.msal.PublicClientApplication(msalConfig);
        await this._msalInstance.initialize();

        // Handle redirect response (if returning from login)
        try {
            const response = await this._msalInstance.handleRedirectPromise();
            if (response) {
                this._token = response.accessToken;
                await this._fetchUserInfo();
                this._persistToken(response);
                this._emit('auth', this._user);
                return true;
            }
        } catch (e) { /* ignore redirect errors */ }

        // Check for existing token
        const saved = localStorage.getItem(ONEDRIVE_CONFIG_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.token && data.expiry && Date.now() < data.expiry) {
                    this._token = data.token;
                    this._user = data.user || null;
                    this._emit('auth', this._user);
                } else {
                    // Try silent token acquisition
                    await this._trySilentLogin();
                }
            } catch (e) { /* ignore */ }
        }

        return true;
    }

    /* ---- Auth ---- */

    async _trySilentLogin() {
        if (!this._msalInstance) return;

        const accounts = this._msalInstance.getAllAccounts();
        if (accounts.length === 0) return;

        try {
            const response = await this._msalInstance.acquireTokenSilent({
                scopes: ['Files.ReadWrite', 'User.Read'],
                account: accounts[0],
            });
            this._token = response.accessToken;
            await this._fetchUserInfo();
            this._persistToken(response);
            this._emit('auth', this._user);
        } catch (e) {
            // Silent login failed, user will need to sign in again
            localStorage.removeItem(ONEDRIVE_CONFIG_KEY);
        }
    }

    async _fetchUserInfo() {
        try {
            const res = await fetch(`${GRAPH_API}/me`, {
                headers: { Authorization: `Bearer ${this._token}` },
            });
            const info = await res.json();
            this._user = {
                displayName: info.displayName || info.userPrincipalName,
                email: info.mail || info.userPrincipalName || '',
                photoURL: null, // MS Graph photo requires separate call
            };
        } catch (e) {
            this._user = { displayName: 'Utilisateur Microsoft', email: '' };
        }
    }

    _persistToken(response) {
        const expiry = response.expiresOn
            ? new Date(response.expiresOn).getTime()
            : Date.now() + 3600 * 1000;
        localStorage.setItem(ONEDRIVE_CONFIG_KEY, JSON.stringify({
            token: this._token,
            expiry,
            user: this._user,
        }));
    }

    async signIn() {
        if (!this._msalInstance) {
            throw new Error('OneDrive non initialisé');
        }

        try {
            const response = await this._msalInstance.acquireTokenPopup({
                scopes: ['Files.ReadWrite', 'User.Read'],
                prompt: 'select_account',
            });

            this._token = response.accessToken;
            await this._fetchUserInfo();
            this._persistToken(response);
            this._emit('auth', this._user);
            return this._user;
        } catch (err) {
            if (err.errorCode === 'user_cancelled' || err.errorCode === 'interaction_in_progress') {
                throw new Error('Connexion annulée');
            }
            throw new Error(err.message || 'Erreur de connexion Microsoft');
        }
    }

    async signOut() {
        this._token = null;
        this._user = null;
        this._folderId = null;
        localStorage.removeItem(ONEDRIVE_CONFIG_KEY);

        if (this._msalInstance) {
            const accounts = this._msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                try {
                    await this._msalInstance.logoutPopup({ account: accounts[0] });
                } catch (e) { /* ignore logout errors */ }
            }
        }

        this._emit('auth', null);
    }

    /* ---- Token Refresh ---- */

    async _getValidToken() {
        if (!this._token) throw new Error('Non connecté');

        const saved = localStorage.getItem(ONEDRIVE_CONFIG_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.expiry && Date.now() >= data.expiry - 60000) {
                // Token about to expire, try refresh
                await this._trySilentLogin();
                if (!this._token) throw new Error('Session expirée, veuillez vous reconnecter');
            }
        }

        return this._token;
    }

    /* ---- OneDrive Folder ---- */

    async _getOrCreateFolder() {
        if (this._folderId) return this._folderId;

        const token = await this._getValidToken();

        // Search for existing folder in root
        const searchRes = await fetch(
            `${GRAPH_API}/me/drive/root/children?$filter=name eq '${ONEDRIVE_FOLDER_NAME}' and folder ne null&$select=id,name`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!searchRes.ok) {
            throw new Error('Impossible d\'accéder à OneDrive');
        }

        const searchData = await searchRes.json();
        if (searchData.value && searchData.value.length > 0) {
            this._folderId = searchData.value[0].id;
            return this._folderId;
        }

        // Create folder
        const createRes = await fetch(`${GRAPH_API}/me/drive/root/children`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: ONEDRIVE_FOLDER_NAME,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'fail',
            }),
        });

        if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Impossible de créer le dossier de sauvegarde');
        }

        const folder = await createRes.json();
        this._folderId = folder.id;
        return this._folderId;
    }

    /* ---- Backups CRUD ---- */

    async saveBackup(name, data) {
        const token = await this._getValidToken();
        const folderId = await this._getOrCreateFolder();

        const jsonStr = JSON.stringify(data);
        const fileName = `${name}.json`;

        // Upload file using PUT (simple upload for files < 4MB)
        const uploadRes = await fetch(
            `${GRAPH_API}/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: jsonStr,
            }
        );

        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Erreur lors de la sauvegarde');
        }

        const file = await uploadRes.json();

        // Update file description with metadata
        const meta = {
            projectCount: data.projects ? data.projects.length : 1,
            taskCount: data.tasks ? data.tasks.length : 0,
            createdAt: new Date().toISOString(),
        };

        await fetch(`${GRAPH_API}/me/drive/items/${file.id}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description: JSON.stringify(meta) }),
        }).catch(() => { /* description update is optional */ });

        return file.id;
    }

    async listBackups() {
        const token = await this._getValidToken();
        const folderId = await this._getOrCreateFolder();

        const res = await fetch(
            `${GRAPH_API}/me/drive/items/${folderId}/children?$select=id,name,size,createdDateTime,description&$orderby=createdDateTime desc&$top=50&$filter=file ne null`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) throw new Error('Impossible de lister les sauvegardes');

        const data = await res.json();

        return (data.value || [])
            .filter(f => f.name.endsWith('.json'))
            .map(f => {
                let meta = {};
                try { meta = JSON.parse(f.description || '{}'); } catch (e) { /* ignore */ }
                return {
                    id: f.id,
                    name: f.name.replace(/\.json$/, ''),
                    projectCount: meta.projectCount || 0,
                    taskCount: meta.taskCount || 0,
                    size: parseInt(f.size) || 0,
                    createdAt: new Date(f.createdDateTime),
                };
            });
    }

    async loadBackup(fileId) {
        const token = await this._getValidToken();

        const response = await fetch(`${GRAPH_API}/me/drive/items/${fileId}/content`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Impossible de charger la sauvegarde');
        return await response.json();
    }

    async deleteBackup(fileId) {
        const token = await this._getValidToken();

        const response = await fetch(`${GRAPH_API}/me/drive/items/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok && response.status !== 204) {
            throw new Error('Impossible de supprimer la sauvegarde');
        }
    }
}

export const oneDriveBackup = new OneDriveBackup();
