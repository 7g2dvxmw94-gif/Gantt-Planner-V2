# Schéma de base de données — Gantt Planner Pro

## Vue d'ensemble

```
auth.users (Supabase)
    │
    └─► profiles          ← infos utilisateur + abonnement
            │
            ├─► projects  ← projets créés par l'utilisateur
            │       │
            │       ├─► project_members   ← accès partagé (owner/editor/viewer)
            │       ├─► tasks             ← tâches du projet (hiérarchiques)
            │       │       └─► task_assignees ← ressources assignées
            │       ├─► resources         ← pool de ressources du projet
            │       ├─► baselines         ← snapshots du projet
            │       └─► invitations       ← invitations en attente
```

---

## Tables

### `profiles`
Profil de chaque utilisateur, créé automatiquement via trigger après inscription.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | FK vers auth.users |
| email | text | Email de l'utilisateur |
| full_name | text | Nom complet |
| plan | text | `free` / `pro` / `team` |
| plan_status | text | `active` / `trialing` / `canceled` / `past_due` |
| stripe_customer_id | text | ID client Stripe (Phase 6) |
| lang | text | Langue préférée `fr` / `en` |

---

### `projects`
Un projet appartient à un `owner_id`. Les accès supplémentaires passent par `project_members`.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Clé primaire |
| owner_id | uuid | Propriétaire (FK profiles) |
| name | text | Nom du projet |
| budget | numeric | Budget total |
| active_baseline_id | uuid | Baseline de référence active |

---

### `project_members`
Table de liaison **many-to-many** entre utilisateurs et projets.

| Rôle | Droits |
|------|--------|
| `owner` | Lecture + écriture + suppression + gestion des membres |
| `editor` | Lecture + écriture (tâches, ressources) |
| `viewer` | Lecture seule |

---

### `tasks`
Tâches hiérarchiques via `parent_id`. Supporte phases, jalons et permis.

**Hiérarchie :**
```
Phase (is_phase: true)
  └─ Tâche normale
  └─ Jalon (is_milestone: true)
  └─ Permis (is_permit: true)
```

---

### `resources`
Ressources humaines d'un projet. Liées aux tâches via `task_assignees`.

---

### `baselines`
Snapshot JSON complet des tâches à un instant T pour comparaison.

---

### `invitations`
Invitations par email pour des utilisateurs non encore inscrits.  
Expiration automatique après 7 jours. Token unique par invitation.

---

## Sécurité (RLS)

Toutes les tables ont le **Row Level Security activé**.

| Action | Condition |
|--------|-----------|
| Voir un projet | Être membre (`project_members`) |
| Modifier un projet | Rôle `owner` ou `editor` |
| Supprimer un projet | Rôle `owner` uniquement |
| Inviter un membre | Rôle `owner` ou `editor` |
| Quitter un projet | N'importe quel membre (se retire lui-même) |

---

## Flux clés

### Création de compte
```
Signup → auth.users INSERT → trigger handle_new_user() → profiles INSERT
```

### Création d'un projet
```
INSERT projects (owner_id = auth.uid())
→ INSERT project_members (user_id = auth.uid(), role = 'owner')
```

### Invitation d'un collaborateur
```
INSERT invitations (email, role, token)
→ Email envoyé avec lien /invite?token=xxx
→ Utilisateur clique → signup ou login
→ INSERT project_members (role = invitation.role)
→ UPDATE invitations SET accepted_at = now()
```

### Achat (Phase 6)
```
Stripe Checkout → Webhook → Edge Function
→ UPDATE profiles SET plan = 'pro', stripe_subscription_id = xxx
```
