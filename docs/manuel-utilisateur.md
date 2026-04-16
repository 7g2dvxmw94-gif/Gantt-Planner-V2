# Manuel Utilisateur — Gantly

**Version** : 6.0
**Date** : Avril 2026

---

## Table des matières

### 1. Introduction
   - 1.1. Présentation de Gantly
   - 1.2. Configuration requise
   - 1.3. Premier lancement et guide de démarrage (Onboarding)

### 2. Authentification et compte
   - 2.1. Créer un compte
   - 2.2. Se connecter / se déconnecter
   - 2.3. Affichage du nom d'utilisateur dans l'en-tête
   - 2.4. Plans : Gratuit et Pro
      - 2.4.1. Limites du plan gratuit
      - 2.4.2. Passer au plan Pro

### 3. Interface générale
   - 3.1. En-tête et barre de navigation
      - 3.1.1. Logo et nom du projet
      - 3.1.2. Accès aux Réglages via l'avatar utilisateur
      - 3.1.3. Bouton Partager (icône 3 cercles)
   - 3.2. Barre d'outils principale
   - 3.3. Barre de filtres
   - 3.4. Navigation mobile
   - 3.5. Notifications et alertes
      - 3.5.1. Notifications internes (cloche)
      - 3.5.2. Notifications en temps réel (collaboration)
      - 3.5.3. Supprimer une notification / Tout supprimer

### 4. Gestion des projets
   - 4.1. Créer un nouveau projet
   - 4.2. Sélectionner et basculer entre les projets
      - 4.2.1. Barre de recherche dans le sélecteur de projets
   - 4.3. Renommer un projet
   - 4.4. Dupliquer un projet
   - 4.5. Supprimer un projet
   - 4.6. Partager un projet
      - 4.6.1. Inviter un collaborateur par e-mail
      - 4.6.2. Rôles : propriétaire, éditeur, lecteur
      - 4.6.3. Notification en temps réel lors du partage
   - 4.7. Historique du projet
      - 4.7.1. Journal des 7 derniers jours
      - 4.7.2. Événements enregistrés (tâches, phases, chemin critique)

### 5. Gestion des tâches
   - 5.1. Créer une tâche
   - 5.2. Types de tâches
      - 5.2.1. Tâche simple
      - 5.2.2. Phase (groupe de tâches)
      - 5.2.3. Jalon (milestone)
      - 5.2.4. Permis de construire
   - 5.3. Modifier une tâche
   - 5.4. Propriétés d'une tâche (nom, dates, durée, priorité, statut, progression, couleur)
      - 5.4.1. Dérivation automatique du statut depuis la progression
   - 5.5. Assigner des ressources à une tâche
   - 5.6. Définir des dépendances (prédécesseurs et successeurs)
   - 5.7. Coûts fixes multiples et nommés
   - 5.8. Dupliquer une tâche
   - 5.9. Supprimer une tâche
   - 5.10. Menu contextuel (clic droit)
   - 5.11. Sélection multiple et actions par lot

### 6. Vues du projet
   - 6.1. Vue Timeline (diagramme de Gantt)
      - 6.1.1. Lecture du diagramme
      - 6.1.2. Barres de tâches, phases et jalons
      - 6.1.3. Lignes de dépendances (affichage / masquage)
      - 6.1.4. Ligne du jour (marqueur "Aujourd'hui")
      - 6.1.5. Indicateurs de week-end
      - 6.1.6. Bouton "Nouvelle tâche" sur Gantt vide
   - 6.2. Vue Tableau (liste triable)
      - 6.2.1. Tri des colonnes (Nom, Type, Statut, Priorité, Dates, Durée, Progression)
      - 6.2.2. Indicateurs de type (icônes Tâche / Jalon / Permis)
      - 6.2.3. Sélection et actions par lot
      - 6.2.4. Colonnes Baseline (BL Début, BL Fin, Écart)
   - 6.3. Vue Ressources
      - 6.3.1. Pool de ressources globales (multi-projets)
      - 6.3.2. Cartes des ressources
      - 6.3.3. Charge de travail (workload)
      - 6.3.4. Filtrage par projet
   - 6.4. Vue Tableau de bord (Dashboard multi-projets)
      - 6.4.1. KPI globaux
      - 6.4.2. Progression par projet
      - 6.4.3. Alertes et seuils
      - 6.4.4. Récapitulatif des permis de construire
      - 6.4.5. Filtrer par projet
   - 6.5. Vue Coûts
      - 6.5.1. KPI de coûts (estimé, réel, écart, consommé)
      - 6.5.2. Tableau des coûts par phase et par tâche
      - 6.5.3. Coût fixe, coût ressources, coût réel, écart
      - 6.5.4. Regroupement par phase (réduction / expansion)
      - 6.5.5. Filtrer par projet
   - 6.6. Vue Kanban (Board)
      - 6.6.1. Colonnes par statut
      - 6.6.2. Mise en évidence du chemin critique

### 7. Baselines (lignes de référence)
   - 7.1. Qu'est-ce qu'une baseline ?
   - 7.2. Créer une baseline
   - 7.3. Sélectionner et activer une baseline
      - 7.3.1. Affichage automatique sur le Gantt à la sélection
      - 7.3.2. Le panneau reste ouvert lors de la sélection
   - 7.4. Renommer une baseline
   - 7.5. Supprimer une baseline
   - 7.6. Colonnes BL dans la vue Tableau (BL Début, BL Fin, Écart)

### 8. Ressources et coûts
   - 8.1. Créer et gérer les ressources
      - 8.1.1. Nom, rôle, avatar, couleur
      - 8.1.2. Taux horaire ou taux journalier (TJM)
      - 8.1.3. Autoriser une ressource à travailler le week-end
   - 8.2. Pool de ressources global (multi-projets)
   - 8.3. Affecter une ressource à une tâche
   - 8.4. Calcul des coûts
      - 8.4.1. Coûts estimés (taux × durée)
      - 8.4.2. Coûts réels (saisie manuelle)
      - 8.4.3. Exclusion des week-ends du calcul (paramètre projet)
      - 8.4.4. Dérogation par ressource (worksWeekends)
   - 8.5. Charge de travail (workload)

### 9. Interactions sur le diagramme de Gantt
   - 9.1. Glisser-déposer une barre de tâche (modifier les dates)
   - 9.2. Redimensionner une barre (modifier la durée)
   - 9.3. Support tactile (mobile / tablette)
   - 9.4. Pinch-to-zoom (zoom gestuel)
   - 9.5. Défilement automatique (auto-scroll)
   - 9.6. Infobulle au survol
      - 9.6.1. Informations affichées pour les tâches et phases
      - 9.6.2. Statut des jalons (Franchi / Non franchi)

### 10. Zoom et navigation temporelle
   - 10.1. Niveaux de zoom : Jour, Semaine, Mois, Trimestre
   - 10.2. Changement de zoom via la barre d'outils
   - 10.3. Défilement vers la date du jour à l'ouverture
   - 10.4. Virtualisation des lignes (performances grands projets)

### 11. Chemin critique
   - 11.1. Qu'est-ce que le chemin critique ?
   - 11.2. Activer / désactiver l'affichage
   - 11.3. Mise en évidence dans la vue Kanban et Tableau

### 12. Filtrage et recherche
   - 12.1. Barre de recherche (Ctrl+F)
   - 12.2. Filtrer par statut
   - 12.3. Filtrer par ressource (assigné)
   - 12.4. Filtrer par priorité
   - 12.5. Filtrer par phase
   - 12.6. Filtrer par période (plage de dates)
   - 12.7. Application des filtres à toutes les vues
   - 12.8. Réinitialiser les filtres

### 13. Permis de construire
   - 13.1. Types de permis (PC, PCM, DP, PA, PD)
   - 13.2. Statuts d'un permis (de la préparation à la purge de recours)
   - 13.3. Calcul automatique des délais d'instruction
   - 13.4. Gestion ABF (Architecte des Bâtiments de France)
   - 13.5. Recours des tiers
   - 13.6. Suivi depuis le Dashboard

### 14. Import et export
   - 14.1. Exporter un projet
      - 14.1.1. Export JSON (réimportable)
      - 14.1.2. Export de tous les projets (JSON complet)
      - 14.1.3. Export CSV (compatible MS Project / Excel)
      - 14.1.4. Export XML MS Project
      - 14.1.5. Export PDF — sections sélectionnables (tableau, timeline, ressources, coûts)
      - 14.1.6. Export PowerPoint (.pptx) — mêmes sections que le PDF
   - 14.2. Importer un projet
      - 14.2.1. Import JSON
      - 14.2.2. Import XML MS Project
      - 14.2.3. Import Excel (XLSX)
   - 14.3. Guide d'import dans MS Project

### 15. Sauvegarde cloud
   - 15.1. Google Drive
      - 15.1.1. Connexion à Google Drive
      - 15.1.2. Sauvegarde manuelle
      - 15.1.3. Restauration depuis Google Drive
   - 15.2. OneDrive
      - 15.2.1. Configuration de l'intégration OneDrive
      - 15.2.2. Sauvegarde et restauration

### 16. Synchronisation Supabase (temps réel)
   - 16.1. Synchronisation automatique des données
   - 16.2. Collaboration en temps réel
   - 16.3. Notifications cross-utilisateurs (partage, suppression de tâche)

### 17. Réglages
   - 17.1. Ouvrir le panneau de Réglages (via l'avatar)
   - 17.2. Onglet Profil
      - 17.2.1. Nom d'utilisateur et initiales
      - 17.2.2. Photo de profil (avatar)
      - 17.2.3. Logo de l'organisation (import de fichier)
      - 17.2.4. Favicon personnalisé (import de fichier)
   - 17.3. Onglet Apparence
      - 17.3.1. Couleurs (principale, survol, claire, foncée, accent)
      - 17.3.2. Typographie (choix de la police)
      - 17.3.3. Thème sombre / clair
   - 17.4. Onglet Général
      - 17.4.1. Nom de l'application
      - 17.4.2. Langue de l'interface (Français, Anglais, Espagnol)
      - 17.4.3. Pied de page personnalisé
      - 17.4.4. Devise et format de nombres
      - 17.4.5. Section Ressources — Exclure les week-ends du calcul des coûts
   - 17.5. Onglet Synchro
      - 17.5.1. Connexion Google Drive / OneDrive
      - 17.5.2. Importer / Exporter la configuration
      - 17.5.3. Réinitialiser les paramètres par défaut
   - 17.6. Onglet Aide
      - 17.6.1. Lancer le guide de démarrage
      - 17.6.2. Afficher les raccourcis clavier
      - 17.6.3. Contacter le support
      - 17.6.4. Nouveautés et journal des modifications
   - 17.7. Boutons Enregistrer et Annuler (pied du panneau)

### 18. Thème sombre / clair
   - 18.1. Basculer entre les modes (Ctrl+D)
   - 18.2. Détection automatique des préférences système

### 19. Internationalisation (i18n)
   - 19.1. Langues disponibles : Français, Anglais, Espagnol
   - 19.2. Changer la langue depuis les Réglages > Général
   - 19.3. Dates et formats adaptés à la locale

### 20. Annuler / Rétablir (Undo / Redo)
   - 20.1. Annuler une action (Ctrl+Z)
   - 20.2. Rétablir une action (Ctrl+Y)

### 21. Raccourcis clavier
   - 21.1. Liste complète des raccourcis
   - 21.2. Aide raccourcis clavier (touche ?)

### 22. Accessibilité
   - 22.1. Navigation au clavier
   - 22.2. Lecteurs d'écran (ARIA)
   - 22.3. Cibles tactiles (WCAG 2.1 AA)

### 23. Stockage des données
   - 23.1. Stockage local (localStorage)
   - 23.2. Synchronisation Supabase (cloud)
   - 23.3. Persistance automatique
   - 23.4. Sauvegarde et restauration

---

### Annexe A — Raccourcis clavier (référence rapide)

| Raccourci        | Action                         |
|------------------|--------------------------------|
| `Ctrl+Z`         | Annuler                        |
| `Ctrl+Y`         | Rétablir                       |
| `Ctrl+F`         | Rechercher                     |
| `Ctrl+D`         | Mode sombre / clair            |
| `Ctrl+W`         | Nouvelle tâche                 |
| `1` / `2` / `3`  | Changer de vue                 |
| `Suppr`          | Supprimer la sélection         |
| `Échap`          | Fermer / Annuler               |
| `?`              | Afficher l'aide des raccourcis |

### Annexe B — Types de permis de construire

| Code | Type                        | Délai d'instruction |
|------|-----------------------------|---------------------|
| PC   | Permis de construire        | 90 jours            |
| PCM  | PC Maison individuelle      | 60 jours            |
| DP   | Déclaration préalable       | 30 jours            |
| PA   | Permis d'aménager           | 90 jours            |
| PD   | Permis de démolir           | 60 jours            |

### Annexe C — Statuts des permis

| Statut                  | Description                                   |
|-------------------------|-----------------------------------------------|
| En préparation          | Le dossier est en cours de constitution        |
| Déposé                  | Le dossier a été déposé en mairie              |
| Complétude notifiée     | La mairie a accusé réception complet           |
| Pièces complémentaires  | Des documents supplémentaires sont demandés    |
| En instruction          | Le dossier est en cours d'examen               |
| Accordé                 | Le permis est accordé                          |
| Accordé avec réserves   | Le permis est accordé sous conditions          |
| Refusé                  | Le permis est refusé                           |
| Recours tiers           | Un recours a été déposé par un tiers           |
| Purgé de recours        | Le délai de recours est écoulé                 |

### Annexe D — Formats d'export supportés

| Format      | Extension | Compatibilité                            |
|-------------|-----------|------------------------------------------|
| JSON        | `.json`   | Gantly (réimportable)                    |
| CSV         | `.csv`    | Excel, Google Sheets, MS Project         |
| XML         | `.xml`    | Microsoft Project                        |
| PDF         | —         | Impression / partage (toutes sections)   |
| PowerPoint  | `.pptx`   | Microsoft PowerPoint, LibreOffice Impress|

### Annexe E — Journal des modifications

| Version | Date       | Modifications principales                                                                           |
|---------|------------|-----------------------------------------------------------------------------------------------------|
| 6.0     | Avril 2026 | Renommage en Gantly ; export PPT complet ; exclusion week-ends coûts ; baselines améliorées         |
| 5.5     | Avril 2026 | Export PowerPoint (.pptx) : tableau, timeline, ressources, coûts                                   |
| 5.4     | Avril 2026 | Exclusion week-ends du calcul des coûts (projet + dérogation par ressource)                         |
| 5.3     | Avril 2026 | Baseline : affichage automatique à la sélection, panneau reste ouvert                              |
| 5.2     | Avril 2026 | Bouton Partager compact (icône 3 cercles) ; ressources PDF filtrées par projet                      |
| 5.1     | Avril 2026 | Correction SyntaxError i18n ; suppression export dupliqué store.js                                 |
| 5.0     | Mars 2026  | Système freemium (plan Gratuit / Pro) ; synchronisation Supabase                                   |
| 4.9     | Mars 2026  | Onglet Coûts : collapse par phase, Écart comptable, filtre projet                                  |
| 4.8     | Mars 2026  | Vue Coûts : KPI + tableau détaillé par phase ; coût fixe sur les tâches                            |
| 4.7     | Mars 2026  | Dérivation automatique du statut depuis la progression dans le modal                               |
| 4.6     | Mars 2026  | Pool de ressources global (multi-projets) ; filtre par projet dans Ressources                      |
| 4.5     | Mars 2026  | Mise à jour du manuel ; baselines (création, colonnes BL, popover)                                 |
| 4.4     | Mars 2026  | Curseur corrigé sur initiales ressource ; journal des modifications                               |
| 4.3     | Mars 2026  | Adresse de contact mise à jour                                                                      |
| 4.2     | Mars 2026  | Tri par Type dans la vue Tableau                                                                    |
| 4.1     | Mars 2026  | Statut Franchi/Non franchi dans l'infobulle des jalons                                             |
| 4.0     | Mars 2026  | Barre de recherche dans le sélecteur de projets                                                     |
