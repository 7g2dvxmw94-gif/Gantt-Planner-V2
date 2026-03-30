# Manuel Utilisateur — Gantt Planner Pro

**Version** : 4.5
**Date** : Mars 2026

---

## Table des matières

### 1. Introduction
   - 1.1. Présentation de Gantt Planner Pro
   - 1.2. Configuration requise
   - 1.3. Premier lancement et guide de démarrage (Onboarding)

### 2. Interface générale
   - 2.1. En-tête et barre de navigation
      - 2.1.1. Logo et nom du projet
      - 2.1.2. Accès aux Réglages via l'avatar utilisateur
   - 2.2. Barre d'outils principale
   - 2.3. Barre de filtres
   - 2.4. Barre de statistiques (pied de page)
   - 2.5. Navigation mobile
   - 2.6. Notifications et alertes

### 3. Gestion des projets
   - 3.1. Créer un nouveau projet
   - 3.2. Sélectionner et basculer entre les projets
      - 3.2.1. Barre de recherche dans le sélecteur de projets
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
      - 5.1.5. Indicateurs de week-end
      - 5.1.6. Bouton "Nouvelle tâche" sur Gantt vide
   - 5.2. Vue Tableau (liste triable)
      - 5.2.1. Tri des colonnes (Nom, Type, Statut, Priorité, Dates, Durée, Progression)
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
      - 6.6.1. Informations affichées pour les tâches et phases
      - 6.6.2. Statut des jalons dans l'infobulle (Franchi / Non franchi)

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

### 13. Réglages
   - 13.1. Ouvrir le panneau de Réglages (via l'avatar)
   - 13.2. Onglet Profil
      - 13.2.1. Nom d'utilisateur et initiales
      - 13.2.2. Photo de profil (avatar)
      - 13.2.3. Logo de l'organisation (import de fichier)
      - 13.2.4. Favicon personnalisé (import de fichier)
   - 13.3. Onglet Apparence
      - 13.3.1. Couleurs (principale, survol, claire, foncée, accent)
      - 13.3.2. Typographie (choix de la police)
      - 13.3.3. Thème sombre / clair
   - 13.4. Onglet Général
      - 13.4.1. Nom de l'application
      - 13.4.2. Pied de page personnalisé
      - 13.4.3. Devise et format de nombres
   - 13.5. Onglet Synchro
      - 13.5.1. Connexion Google Drive
      - 13.5.2. Importer / Exporter la configuration
      - 13.5.3. Réinitialiser les paramètres par défaut
   - 13.6. Onglet Aide
      - 13.6.1. Lancer le guide de démarrage
      - 13.6.2. Afficher les raccourcis clavier
      - 13.6.3. Contacter le support (ganttprohelp2025@gmail.com)
      - 13.6.4. Nouveautés et journal des modifications
   - 13.7. Boutons Enregistrer et Annuler (pied du panneau)

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

---

### Annexe A — Raccourcis clavier (référence rapide)

| Raccourci       | Action                        |
|-----------------|-------------------------------|
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

### Annexe E — Journal des modifications

| Version | Date       | Modifications principales                                                   |
|---------|------------|-----------------------------------------------------------------------------|
| 4.5     | Mars 2026  | Mise à jour du manuel                                                       |
| 4.4     | Mars 2026  | Curseur corrigé sur initiales de ressource ; journal des modifications      |
| 4.3     | Mars 2026  | Adresse de contact mise à jour (ganttprohelp2025@gmail.com)                 |
| 4.2     | Mars 2026  | Tri de la colonne Type dans la vue Tableau                                  |
| 4.1     | Mars 2026  | Statut Franchi/Non franchi dans l'infobulle des jalons                      |
| 4.0     | Mars 2026  | Barre de recherche dans le sélecteur de projets                             |
| 3.9     | Mars 2026  | Correction affichage du logo dans l'en-tête                                 |
| 3.8     | Mars 2026  | Flèche de fermeture du panneau Réglages corrigée                            |
| 3.7     | Mars 2026  | Import de fichier pour Logo et Favicon ; infobulle Favicon                  |
| 3.6     | Mars 2026  | Boutons Enregistrer / Annuler dans le panneau Réglages                      |
| 3.5     | Mars 2026  | Correction décalage du Gantt vide (centrage sur la date du jour)            |
| 3.4     | Mars 2026  | Activation du bouton "Nouvelle tâche" dans le Gantt vide                    |
| 3.3     | Mars 2026  | Champ Initiales ajouté dans l'onglet Profil des Réglages                    |
| 3.2     | Mars 2026  | Intégration du panneau Réglages 5 onglets dans la branche principale        |
| 3.1     | Mars 2026  | Correction affichage du 5e onglet (Aide) dans le panneau Réglages           |
| 3.0     | Mars 2026  | Refonte du panneau Réglages : 5 onglets, avatar comme point d'entrée        |
| 2.1     | Mars 2026  | Corrections diverses et améliorations de performance                        |
| 2.0     | Mars 2026  | Version initiale du manuel utilisateur                                      |
