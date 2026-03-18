# Manuel Utilisateur — Gantt Planner Pro

**Version** : 2.0
**Date** : Mars 2026

---

## Table des matières

### 1. Introduction
   - 1.1. Présentation de Gantt Planner Pro
   - 1.2. Configuration requise
   - 1.3. Premier lancement et guide de démarrage (Onboarding)

### 2. Interface générale
   - 2.1. En-tête et barre de navigation
   - 2.2. Barre d'outils principale
   - 2.3. Barre de filtres
   - 2.4. Barre de statistiques (pied de page)
   - 2.5. Navigation mobile
   - 2.6. Notifications et alertes

### 3. Gestion des projets
   - 3.1. Créer un nouveau projet
   - 3.2. Sélectionner et basculer entre les projets
   - 3.3. Renommer un projet
   - 3.4. Dupliquer un projet
   - 3.5. Supprimer un projet

### 4. Gestion des tâches
   - 4.1. Créer une tâche
   - 4.2. Types de tâches
      - 4.2.1. Tâche simple
      - 4.2.2. Phase (groupe de tâches)
      - 4.2.3. Jalon (milestone)
      - 4.2.4. Permis de construire
   - 4.3. Modifier une tâche
   - 4.4. Propriétés d'une tâche (nom, dates, durée, priorité, statut, progression, couleur)
   - 4.5. Assigner des ressources à une tâche
   - 4.6. Définir des dépendances (prédécesseurs et successeurs)
   - 4.7. Dupliquer une tâche
   - 4.8. Supprimer une tâche
   - 4.9. Menu contextuel (clic droit)
   - 4.10. Sélection multiple et actions par lot

### 5. Vues du projet
   - 5.1. Vue Timeline (diagramme de Gantt)
      - 5.1.1. Lecture du diagramme
      - 5.1.2. Barres de tâches, phases et jalons
      - 5.1.3. Lignes de dépendances
      - 5.1.4. Ligne du jour (marqueur "Aujourd'hui")
   - 5.2. Vue Tableau (Kanban / liste)
      - 5.2.1. Tri des colonnes
      - 5.2.2. Sélection et actions par lot
   - 5.3. Vue Ressources
      - 5.3.1. Cartes des ressources
      - 5.3.2. Charge de travail (workload)
      - 5.3.3. Timeline par ressource
   - 5.4. Vue Dashboard (tableau de bord multi-projets)
      - 5.4.1. KPI globaux
      - 5.4.2. Progression par projet
      - 5.4.3. Alertes
      - 5.4.4. Récapitulatif des permis de construire

### 6. Interactions sur le diagramme de Gantt
   - 6.1. Glisser-déposer une barre de tâche (modifier les dates)
   - 6.2. Redimensionner une barre (modifier la durée)
   - 6.3. Support tactile (mobile / tablette)
   - 6.4. Pinch-to-zoom (zoom gestuel)
   - 6.5. Défilement automatique (auto-scroll)
   - 6.6. Infobulle au survol

### 7. Zoom et navigation temporelle
   - 7.1. Niveaux de zoom : Jour, Semaine, Mois, Trimestre
   - 7.2. Changement de zoom via la barre d'outils
   - 7.3. Virtualisation des lignes (performances)

### 8. Chemin critique
   - 8.1. Qu'est-ce que le chemin critique ?
   - 8.2. Activer / désactiver l'affichage du chemin critique

### 9. Filtrage et recherche
   - 9.1. Barre de recherche (Ctrl+F)
   - 9.2. Filtrer par statut
   - 9.3. Filtrer par ressource (assigné)
   - 9.4. Filtrer par priorité
   - 9.5. Filtrer par période (plage de dates)
   - 9.6. Réinitialiser les filtres

### 10. Permis de construire
   - 10.1. Types de permis (PC, PCM, DP, PA, PD)
   - 10.2. Statuts d'un permis (de la préparation à la purge de recours)
   - 10.3. Calcul automatique des délais d'instruction
   - 10.4. Gestion ABF (Architecte des Bâtiments de France)
   - 10.5. Recours des tiers
   - 10.6. Suivi depuis le Dashboard

### 11. Import et export
   - 11.1. Exporter un projet
      - 11.1.1. Export JSON (réimportable)
      - 11.1.2. Export de tous les projets (JSON complet)
      - 11.1.3. Export CSV (compatible MS Project / Excel)
      - 11.1.4. Export XML MS Project
      - 11.1.5. Export PDF (impression)
   - 11.2. Importer un projet
      - 11.2.1. Import JSON
      - 11.2.2. Import XML MS Project
      - 11.2.3. Import Excel (XLSX)
   - 11.3. Guide d'import dans MS Project

### 12. Sauvegarde cloud (Google Drive)
   - 12.1. Connexion à Google Drive
   - 12.2. Sauvegarde manuelle
   - 12.3. Restauration depuis Google Drive

### 13. Personnalisation de l'apparence (Branding)
   - 13.1. Ouvrir le panneau de personnalisation
   - 13.2. Identité (nom, logo, favicon)
   - 13.3. Couleurs (principale, survol, claire, foncée, accent)
   - 13.4. Typographie (choix de la police)
   - 13.5. Utilisateur (nom, initiales)
   - 13.6. Pied de page personnalisé
   - 13.7. Importer / Exporter la configuration de branding
   - 13.8. Réinitialiser les paramètres par défaut

### 14. Thème sombre / clair
   - 14.1. Basculer entre les modes (Ctrl+D)
   - 14.2. Détection automatique des préférences système

### 15. Annuler / Rétablir (Undo / Redo)
   - 15.1. Annuler une action (Ctrl+Z)
   - 15.2. Rétablir une action (Ctrl+Y)

### 16. Raccourcis clavier
   - 16.1. Liste complète des raccourcis
   - 16.2. Aide raccourcis clavier (touche ?)

### 17. Accessibilité
   - 17.1. Navigation au clavier
   - 17.2. Lecteurs d'écran (ARIA)
   - 17.3. Lien d'accès rapide au contenu

### 18. Stockage des données
   - 18.1. Stockage local (localStorage)
   - 18.2. Persistance automatique
   - 18.3. Sauvegarde et restauration

### Annexe A — Raccourcis clavier (référence rapide)

| Raccourci       | Action                        |
|-----------------|-------------------------------|
| `Ctrl+N`        | Nouvelle tâche                |
| `Ctrl+Z`        | Annuler                       |
| `Ctrl+Y`        | Rétablir                      |
| `Ctrl+F`        | Rechercher                    |
| `Ctrl+D`        | Mode sombre / clair           |
| `1` / `2` / `3` | Changer de vue                |
| `Suppr`          | Supprimer la sélection        |
| `Échap`          | Fermer / Annuler              |
| `?`              | Afficher l'aide des raccourcis|

### Annexe B — Types de permis de construire

| Code | Type                        | Délai d'instruction |
|------|-----------------------------|---------------------|
| PC   | Permis de construire        | 90 jours            |
| PCM  | PC Maison individuelle      | 60 jours            |
| DP   | Déclaration préalable       | 30 jours            |
| PA   | Permis d'aménager           | 90 jours            |
| PD   | Permis de démolir           | 60 jours            |

### Annexe C — Statuts des permis

| Statut                  | Description                                  |
|-------------------------|----------------------------------------------|
| En préparation          | Le dossier est en cours de constitution       |
| Déposé                  | Le dossier a été déposé en mairie             |
| Complétude notifiée     | La mairie a accusé réception complet          |
| Pièces complémentaires  | Des documents supplémentaires sont demandés   |
| En instruction          | Le dossier est en cours d'examen              |
| Accordé                 | Le permis est accordé                         |
| Accordé avec réserves   | Le permis est accordé sous conditions         |
| Refusé                  | Le permis est refusé                          |
| Recours tiers           | Un recours a été déposé par un tiers          |
| Purgé de recours        | Le délai de recours est écoulé                |

### Annexe D — Formats d'export supportés

| Format    | Extension | Compatibilité                          |
|-----------|-----------|----------------------------------------|
| JSON      | `.json`   | Gantt Planner Pro (réimportable)       |
| CSV       | `.csv`    | Excel, Google Sheets, MS Project       |
| XML       | `.xml`    | Microsoft Project                      |
| PDF       | —         | Impression / partage (via navigateur)  |
