/* ========================================
   COLLABORATION UI
   Share modal : gestion des membres et invitations
   ======================================== */

import { collaboration } from './collaboration.js';
import { store } from './store.js';
import { auth } from './auth.js';
import { supabaseStore } from './supabase-store.js';
import { supabase } from './supabase-client.js';

/* ---- Modal HTML injected once ---- */

const MODAL_ID = 'shareModal';

function _injectModal() {
    if (document.getElementById(MODAL_ID)) return;

    const html = `
    <div id="${MODAL_ID}" class="share-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="shareModalTitle" style="display:none;">
        <div class="share-modal">
            <div class="share-modal-header">
                <h2 id="shareModalTitle" class="share-modal-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                        <polyline points="16 6 12 2 8 6"/>
                        <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                    Partager le projet
                </h2>
                <button class="share-modal-close" id="shareModalClose" aria-label="Fermer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div class="share-modal-body">

                <!-- Invite form -->
                <div class="share-section" id="shareInviteSection">
                    <label class="share-label">Inviter un collaborateur</label>
                    <div class="share-invite-row">
                        <input
                            type="email"
                            id="shareEmailInput"
                            class="share-input"
                            placeholder="adresse@email.com"
                            autocomplete="off"
                        />
                        <select id="shareRoleSelect" class="share-select">
                            <option value="editor">Éditeur</option>
                            <option value="viewer">Lecteur</option>
                        </select>
                        <button class="share-btn-invite" id="shareInviteBtn">Inviter</button>
                    </div>
                    <div id="shareInviteMsg" class="share-invite-msg" style="display:none;"></div>
                </div>

                <div class="share-divider"></div>

                <!-- Members list -->
                <div class="share-section">
                    <label class="share-label">Membres du projet</label>
                    <div id="shareMembersList" class="share-members-list">
                        <div class="share-loading">Chargement...</div>
                    </div>
                </div>

                <!-- Pending invitations -->
                <div class="share-section" id="sharePendingSection" style="display:none;">
                    <label class="share-label">Invitations en attente</label>
                    <div id="sharePendingList" class="share-members-list"></div>
                </div>

            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    _injectStyles();
}

function _injectStyles() {
    if (document.getElementById('share-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'share-modal-styles';
    style.textContent = `
    .share-modal-overlay {
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(15, 23, 42, 0.45);
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
    }
    .share-modal {
        background: var(--bg-primary, #fff);
        border: 1px solid var(--border-color, #E5E7EB);
        border-radius: 12px;
        width: 100%; max-width: 520px;
        max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        animation: shareModalIn 0.18s ease;
    }
    @keyframes shareModalIn {
        from { opacity: 0; transform: scale(0.97) translateY(-8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .share-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.25rem 1.5rem 0;
        gap: 0.5rem;
    }
    .share-modal-title {
        display: flex; align-items: center; gap: 0.5rem;
        font-size: 1rem; font-weight: 700;
        color: var(--text-primary, #1F2937);
        margin: 0;
    }
    .share-modal-close {
        background: none; border: none; cursor: pointer; padding: 0.25rem;
        color: var(--text-muted, #9CA3AF); border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s, color 0.15s;
    }
    .share-modal-close:hover { background: var(--bg-muted, #F3F4F6); color: var(--text-primary, #1F2937); }
    .share-modal-body { padding: 1.25rem 1.5rem 1.5rem; }
    .share-section { margin-bottom: 1.25rem; }
    .share-label {
        display: block; font-size: 0.8rem; font-weight: 600;
        color: var(--text-secondary, #6B7280); text-transform: uppercase;
        letter-spacing: 0.05em; margin-bottom: 0.6rem;
    }
    .share-invite-row {
        display: flex; gap: 0.5rem; align-items: center;
    }
    .share-input {
        flex: 1; padding: 0.55rem 0.75rem; border-radius: 8px;
        border: 1px solid var(--border-color, #E5E7EB);
        font-size: 0.875rem; font-family: inherit;
        background: var(--bg-primary, #fff);
        color: var(--text-primary, #1F2937);
        outline: none; min-width: 0;
    }
    .share-input:focus { border-color: #6366F1; box-shadow: 0 0 0 2px rgba(99,102,241,0.12); }
    .share-select {
        padding: 0.55rem 0.5rem; border-radius: 8px;
        border: 1px solid var(--border-color, #E5E7EB);
        font-size: 0.875rem; font-family: inherit;
        background: var(--bg-primary, #fff);
        color: var(--text-primary, #1F2937);
        outline: none; cursor: pointer;
    }
    .share-select:focus { border-color: #6366F1; }
    .share-btn-invite {
        padding: 0.55rem 1rem; background: #6366F1; color: white;
        border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
        cursor: pointer; font-family: inherit; white-space: nowrap;
        transition: background 0.15s;
    }
    .share-btn-invite:hover { background: #4F46E5; }
    .share-btn-invite:disabled { opacity: 0.6; cursor: not-allowed; }
    .share-invite-msg {
        margin-top: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 6px;
        font-size: 0.825rem; font-weight: 500;
    }
    .share-invite-msg.success { background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; }
    .share-invite-msg.error   { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
    .share-invite-msg.info    { background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; }
    .share-divider { height: 1px; background: var(--border-color, #E5E7EB); margin: 1.25rem 0; }
    .share-members-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .share-member-row {
        display: flex; align-items: center; gap: 0.75rem;
        padding: 0.6rem 0.75rem; border-radius: 8px;
        background: var(--bg-muted, #F9FAFB);
        border: 1px solid transparent;
    }
    .share-member-row:hover { border-color: var(--border-color, #E5E7EB); }
    .share-avatar {
        width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.8rem; font-weight: 700; color: white;
        background: linear-gradient(135deg, #6366F1, #EC4899);
    }
    .share-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .share-member-info { flex: 1; min-width: 0; }
    .share-member-name {
        font-size: 0.875rem; font-weight: 600;
        color: var(--text-primary, #1F2937);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .share-member-email {
        font-size: 0.775rem; color: var(--text-muted, #9CA3AF);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .share-role-badge {
        font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem;
        border-radius: 4px; white-space: nowrap; flex-shrink: 0;
    }
    .share-role-badge.owner  { background: #FEF3C7; color: #92400E; }
    .share-role-badge.editor { background: #DBEAFE; color: #1D4ED8; }
    .share-role-badge.viewer { background: #F3F4F6; color: #374151; }
    .share-member-actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
    .share-action-btn {
        background: none; border: none; cursor: pointer; padding: 0.25rem;
        color: var(--text-muted, #9CA3AF); border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.12s, color 0.12s;
        font-size: 0.8rem;
    }
    .share-action-btn:hover { background: var(--border-color, #E5E7EB); color: var(--text-primary, #1F2937); }
    .share-action-btn.danger:hover { background: #FEF2F2; color: #DC2626; }
    .share-loading { font-size: 0.85rem; color: var(--text-muted, #9CA3AF); padding: 0.5rem 0; text-align: center; }
    .share-pending-row {
        display: flex; align-items: center; gap: 0.75rem;
        padding: 0.6rem 0.75rem; border-radius: 8px;
        background: #FFFBEB; border: 1px solid #FDE68A;
    }
    .share-pending-email { flex: 1; font-size: 0.875rem; color: #92400E; font-weight: 500; }
    .share-pending-meta { font-size: 0.775rem; color: #B45309; }
    .share-copy-row {
        display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem;
    }
    .share-link-input {
        flex: 1; padding: 0.45rem 0.65rem; border-radius: 6px;
        border: 1px solid var(--border-color, #E5E7EB);
        font-size: 0.8rem; color: var(--text-secondary, #6B7280);
        background: var(--bg-muted, #F9FAFB); font-family: monospace;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        min-width: 0;
    }
    .share-copy-btn {
        padding: 0.45rem 0.75rem; background: var(--bg-muted, #F3F4F6);
        border: 1px solid var(--border-color, #E5E7EB); border-radius: 6px;
        font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit;
        color: var(--text-primary, #1F2937); white-space: nowrap;
        transition: background 0.12s;
    }
    .share-copy-btn:hover { background: var(--border-color, #E5E7EB); }
    `;
    document.head.appendChild(style);
}

/* ---- Avatar helpers ---- */

function _avatarEl(member) {
    const div = document.createElement('div');
    div.className = 'share-avatar';
    if (member.avatarUrl) {
        const img = document.createElement('img');
        img.src = member.avatarUrl;
        img.alt = member.name;
        div.appendChild(img);
    } else {
        div.textContent = (member.name || member.email || '?')[0].toUpperCase();
    }
    return div;
}

/* ---- Main UI ---- */

export const collaborationUI = {

    _projectId: null,
    _currentUserId: null,
    _currentRole: null,
    _overlayClickHandler: null,

    async open(projectId) {
        _injectModal();
        this._projectId = projectId;

        const overlay = document.getElementById(MODAL_ID);
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Bind close — remove previous listener before re-adding to avoid accumulation
        document.getElementById('shareModalClose').onclick = () => this.close();
        if (this._overlayClickHandler) {
            overlay.removeEventListener('click', this._overlayClickHandler);
        }
        this._overlayClickHandler = (e) => { if (e.target === overlay) this.close(); };
        overlay.addEventListener('click', this._overlayClickHandler);
        document.addEventListener('keydown', this._onKeyDown);

        // Get current user role
        const user = await auth.getUser();
        this._currentUserId = user?.id || null;
        this._currentRole = await collaboration.getCurrentUserRole(projectId);

        // If not a member yet, sync the project to Supabase then use RPC to add as owner
        if (!this._currentRole && user) {
            try {
                const project = store.getActiveProject();
                if (project && project.id === projectId) {
                    await supabaseStore.upsertProject(project, user.id);
                }
                const { data: role } = await supabase.rpc('ensure_project_owner', { p_project_id: projectId });
                if (role) this._currentRole = role;
            } catch (e) {
                console.error('[collaborationUI] sync project:', e);
            }
        }

        const isOwnerOrEditor = this._currentRole === 'owner' || this._currentRole === 'editor';

        // Show/hide invite section based on role
        const inviteSection = document.getElementById('shareInviteSection');
        if (inviteSection) inviteSection.style.display = isOwnerOrEditor ? '' : 'none';

        // Bind invite button
        document.getElementById('shareInviteBtn').onclick = () => this._handleInvite();
        document.getElementById('shareEmailInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleInvite();
        });

        await this._loadData();
    },

    close() {
        const overlay = document.getElementById(MODAL_ID);
        if (overlay) {
            overlay.style.display = 'none';
            if (this._overlayClickHandler) {
                overlay.removeEventListener('click', this._overlayClickHandler);
                this._overlayClickHandler = null;
            }
        }
        document.body.style.overflow = '';
        document.removeEventListener('keydown', this._onKeyDown);
    },

    _onKeyDown(e) {
        if (e.key === 'Escape') collaborationUI.close();
    },

    async _loadData() {
        const [members, pending] = await Promise.all([
            collaboration.getProjectMembers(this._projectId),
            collaboration.getPendingInvitations(this._projectId),
        ]);

        this._renderMembers(members);
        this._renderPending(pending);
    },

    _renderMembers(members) {
        const container = document.getElementById('shareMembersList');
        if (!members.length) {
            container.innerHTML = '<p class="share-loading">Aucun membre trouvé.</p>';
            return;
        }

        const roleLabels = { owner: 'Propriétaire', editor: 'Éditeur', viewer: 'Lecteur' };
        const isOwner = this._currentRole === 'owner';

        container.innerHTML = '';
        members.forEach(m => {
            const row = document.createElement('div');
            row.className = 'share-member-row';

            const avatar = _avatarEl(m);

            const info = document.createElement('div');
            info.className = 'share-member-info';
            info.innerHTML = `
                <div class="share-member-name">${_escape(m.name)}</div>
                <div class="share-member-email">${_escape(m.email)}</div>
            `;

            const badge = document.createElement('span');
            badge.className = `share-role-badge ${m.role}`;
            badge.textContent = roleLabels[m.role] || m.role;

            row.appendChild(avatar);
            row.appendChild(info);
            row.appendChild(badge);

            // Actions: only owner can change roles / remove
            const isSelf = m.userId === this._currentUserId;
            const canManage = isOwner && !isSelf && m.role !== 'owner';

            if (canManage) {
                const actions = document.createElement('div');
                actions.className = 'share-member-actions';

                // Role toggle
                const roleBtn = document.createElement('button');
                roleBtn.className = 'share-action-btn';
                roleBtn.title = m.role === 'editor' ? 'Passer en Lecteur' : 'Passer en Éditeur';
                roleBtn.innerHTML = m.role === 'editor'
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

                roleBtn.addEventListener('click', async () => {
                    const newRole = m.role === 'editor' ? 'viewer' : 'editor';
                    roleBtn.disabled = true;
                    try {
                        await collaboration.updateMemberRole(this._projectId, m.userId, newRole);
                        m.role = newRole;
                        badge.className = `share-role-badge ${newRole}`;
                        badge.textContent = roleLabels[newRole];
                        roleBtn.title = newRole === 'editor' ? 'Passer en Lecteur' : 'Passer en Éditeur';
                    } finally {
                        roleBtn.disabled = false;
                    }
                });

                // Remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'share-action-btn danger';
                removeBtn.title = 'Retirer du projet';
                removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

                removeBtn.addEventListener('click', async () => {
                    if (!confirm(`Retirer ${m.name} du projet ?`)) return;
                    removeBtn.disabled = true;
                    try {
                        await collaboration.removeMember(this._projectId, m.userId);
                        // Notify the removed user
                        supabaseStore.notifyProjectRemoved(this._projectId, m.userId, m.role)
                            .catch(e => console.error('[collab] notifyProjectRemoved FAILED — SQL migration 011 may not have been run:', e));
                        row.remove();
                    } catch {
                        removeBtn.disabled = false;
                    }
                });

                actions.appendChild(roleBtn);
                actions.appendChild(removeBtn);
                row.appendChild(actions);
            }

            container.appendChild(row);
        });
    },

    _renderPending(pending) {
        const section = document.getElementById('sharePendingSection');
        const container = document.getElementById('sharePendingList');

        if (!pending.length) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';
        container.innerHTML = '';

        const isOwnerOrEditor = this._currentRole === 'owner' || this._currentRole === 'editor';

        pending.forEach(inv => {
            const row = document.createElement('div');
            row.className = 'share-pending-row';

            const emailSpan = document.createElement('span');
            emailSpan.className = 'share-pending-email';
            emailSpan.textContent = inv.email;

            const metaSpan = document.createElement('span');
            metaSpan.className = 'share-pending-meta';
            metaSpan.textContent = 'En attente';

            // Copy invite link
            const copyBtn = document.createElement('button');
            copyBtn.className = 'share-action-btn';
            copyBtn.title = 'Copier le lien d\'invitation';
            copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
            copyBtn.addEventListener('click', () => {
                const link = `${window.location.origin}/invite.html?token=${inv.token}`;
                navigator.clipboard.writeText(link).then(() => {
                    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                    }, 2000);
                });
            });

            row.appendChild(emailSpan);
            row.appendChild(metaSpan);
            row.appendChild(copyBtn);

            if (isOwnerOrEditor) {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'share-action-btn danger';
                cancelBtn.title = 'Annuler l\'invitation';
                cancelBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
                cancelBtn.addEventListener('click', async () => {
                    cancelBtn.disabled = true;
                    try {
                        await collaboration.cancelInvitation(inv.id);
                        row.remove();
                        const rows = container.querySelectorAll('.share-pending-row');
                        if (!rows.length) section.style.display = 'none';
                    } catch {
                        cancelBtn.disabled = false;
                    }
                });
                row.appendChild(cancelBtn);
            }

            container.appendChild(row);
        });
    },

    async _handleInvite() {
        const emailInput = document.getElementById('shareEmailInput');
        const roleSelect = document.getElementById('shareRoleSelect');
        const btn = document.getElementById('shareInviteBtn');
        const msgEl = document.getElementById('shareInviteMsg');

        const email = emailInput.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            _showMsg(msgEl, 'error', 'Adresse email invalide.');
            return;
        }

        btn.disabled = true;
        btn.textContent = '...';
        _showMsg(msgEl, '', '');

        try {
            const result = await collaboration.inviteUser(this._projectId, email, roleSelect.value);

            if (result.type === 'added') {
                _showMsg(msgEl, 'success', `${email} a été ajouté au projet.`);
                emailInput.value = '';
                // Notifier l'utilisateur ajouté en temps réel
                supabaseStore.notifyProjectShared(this._projectId, email, roleSelect.value)
                    .catch(e => console.error('[collab] notifyProjectShared:', e));
                await this._loadData();
            } else {
                const link = result.link;
                const project = store.getActiveProject();
                const projectName = project?.name || 'Gantt Planner';

                _showMsg(msgEl, 'success', `Invitation créée pour ${email}.`);

                // Copy row
                const existing = document.getElementById('shareInviteCopyRow');
                if (existing) existing.remove();

                const copyRow = document.createElement('div');
                copyRow.id = 'shareInviteCopyRow';
                copyRow.className = 'share-copy-row';

                const linkInput = document.createElement('input');
                linkInput.type = 'text';
                linkInput.readOnly = true;
                linkInput.value = link;
                linkInput.className = 'share-link-input';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'share-copy-btn';
                copyBtn.textContent = 'Copier le lien';
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(link).then(() => {
                        copyBtn.textContent = 'Copié !';
                        setTimeout(() => { copyBtn.textContent = 'Copier le lien'; }, 2000);
                    });
                });

                // Send by email button (mailto)
                const mailSubject = encodeURIComponent(`Invitation à collaborer sur "${projectName}"`);
                const mailBody = encodeURIComponent(
                    `Bonjour,\n\nVous avez été invité à collaborer sur le projet "${projectName}" dans Gantt Planner.\n\nCliquez sur le lien ci-dessous pour accepter l'invitation :\n${link}\n\nCe lien est valable 7 jours.\n\nCordialement`
                );
                const mailBtn = document.createElement('a');
                mailBtn.href = `mailto:${email}?subject=${mailSubject}&body=${mailBody}`;
                mailBtn.className = 'share-copy-btn';
                mailBtn.textContent = 'Envoyer par email';
                mailBtn.style.cssText = 'text-decoration:none; background:#6366F1; color:#fff; border-color:#6366F1;';

                copyRow.appendChild(linkInput);
                copyRow.appendChild(copyBtn);
                copyRow.appendChild(mailBtn);
                msgEl.after(copyRow);

                emailInput.value = '';
                await this._loadData();
            }
        } catch (err) {
            _showMsg(msgEl, 'error', err.message || 'Une erreur est survenue.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Inviter';
        }
    },
};

/* ---- Helpers ---- */

function _showMsg(el, type, text) {
    el.style.display = text ? 'block' : 'none';
    el.className = `share-invite-msg ${type}`;
    el.innerHTML = text;
}

function _escape(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
