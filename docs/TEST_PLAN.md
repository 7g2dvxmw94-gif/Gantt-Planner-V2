# Cahier de Tests — Gantt Planner Pro v2.0

**Date de création** : Mars 2026
**Statut** : En attente de test
**Testeur** : [À remplir]
**Date du test** : [À remplir]

---

## 📋 Table des matières

1. [Configuration requise](#configuration-requise)
2. [Environnements de test](#environnements-de-test)
3. [Matrice de compatibilité](#matrice-de-compatibilité)
4. [Tests fonctionnels](#tests-fonctionnels)
5. [Tests de performance](#tests-de-performance)
6. [Tests d'accessibilité](#tests-daccessibilité)
7. [Tests de responsivité](#tests-de-responsivité)
8. [Procédure de signalement des bugs](#procédure-de-signalement-des-bugs)

---

## Configuration requise

### Navigateurs testés
- ✅ **Google Chrome** : v120+
- ✅ **Firefox** : v120+
- ✅ **Safari** : v17+
- ✅ **Microsoft Edge** : v120+
- ✅ **Chrome Mobile** : v120+
- ✅ **Safari iOS** : v17+

### Systèmes d'exploitation
- ✅ **Windows 10/11**
- ✅ **macOS 13+** (Intel & Apple Silicon)
- ✅ **iOS 15+**
- ✅ **Android 10+**

---

## Environnements de test

### 1. Bureau (Desktop)

#### Windows 10/11
- [ ] Chrome (résolution 1920x1080)
- [ ] Edge (résolution 1920x1080)
- [ ] Firefox (résolution 1920x1080)

#### macOS (Apple Silicon)
- [ ] Safari
- [ ] Chrome
- [ ] Firefox
- [ ] Edge

#### macOS (Intel)
- [ ] Safari
- [ ] Chrome
- [ ] Firefox

### 2. Tablette
- [ ] iPad (Safari)
- [ ] iPad (Chrome)
- [ ] Tablette Android (Chrome)
- [ ] Tablette Windows

### 3. Mobile
- [ ] iPhone (Safari)
- [ ] Android (Chrome)

---

## Matrice de compatibilité

| Navigateur | Windows | macOS | iOS | Android |
|------------|---------|-------|-----|---------|
| Chrome     | ✅      | ✅    | ✅  | ✅      |
| Firefox    | ✅      | ✅    | ⚠️  | ⚠️      |
| Safari     | ❌      | ✅    | ✅  | ❌      |
| Edge       | ✅      | ✅    | ✅  | ✅      |

**Légende** : ✅ Complet | ⚠️ Partiel | ❌ Non supporté

---

# 🧪 Tests Fonctionnels

## A. Gestion des Projets

### A1. Créer un nouveau projet
**Données de test** :
- Nom : "Test Project Alpha"
- Date début : 01/04/2026
- Date fin : 30/06/2026

| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Initialisation | Cliquer sur "Nouveau projet" | Modal de création apparaît | |
| 2 | Saisie | Entrer le nom du projet | Texte saisi correctement | |
| 3 | Validation | Cliquer "Créer" | Projet créé et affiché dans la liste | |
| 4 | Affichage | Vérifier le tableau de bord | Projet apparaît en haut de page | |

**Notes Windows** :
- [À remplir après test]

**Notes macOS** :
- [À remplir après test]

**Notes iOS** :
- [À remplir après test]

**Notes Android** :
- [À remplir après test]

---

### A2. Sélectionner et basculer entre les projets
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Préparation | Créer 2 projets (A, B) | Deux projets créés | |
| 2 | Basculement | Cliquer sur dropdown "Projet A" | Liste des projets s'affiche | |
| 3 | Sélection | Cliquer sur "Projet B" | Projet B devient actif | |
| 4 | Vérification | Vérifier le titre en haut | "Projet B" affiché | |
| 5 | Retour | Sélectionner "Projet A" | Projet A redevient actif | |

---

### A3. Renommer un projet
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Clic droit sur projet | Menu contextuel aparaît | |
| 2 | Édition | Cliquer "Renommer" | Champ de texte éditable | |
| 3 | Saisie | Entrer nouveau nom "Project Beta" | Texte accepté | |
| 4 | Validation | Appuyer Entrée | Nom mis à jour | |
| 5 | Vérification | Vérifier la liste | Nouveau nom affiché | |

---

### A4. Dupliquer un projet
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Clic droit sur projet | Menu contextuel aparaît | |
| 2 | Duplication | Cliquer "Dupliquer" | Nouveau projet créé avec suffix | |
| 3 | Données | Vérifier les tâches | Toutes les tâches dupliquées | |
| 4 | Indépendance | Modifier tâche dans copie | Projet original inchangé | |

---

### A5. Supprimer un projet
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Clic droit sur projet | Menu contextuel aparaît | |
| 2 | Suppression | Cliquer "Supprimer" | Confirmation demandée | |
| 3 | Confirmation | Cliquer "Confirmer" | Projet supprimé et retiré | |
| 4 | Vérification | Vérifier la liste | Projet n'existe plus | |

---

## B. Gestion des Tâches

### B1. Créer une tâche simple
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer bouton "Ajouter tâche" | Modal s'ouvre | |
| 2 | Type | Sélectionner "Tâche simple" | Type confirmé | |
| 3 | Nom | Entrer "Implémentation API" | Texte saisi | |
| 4 | Dates | Sélectionner 01/04 - 15/04 | Dates enregistrées | |
| 5 | Création | Cliquer "Créer" | Tâche apparaît dans Gantt | |
| 6 | Affichage | Vérifier le diagramme | Barre de tâche visible | |

---

### B2. Créer une phase (groupe)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Ajouter tâche" | Modal s'ouvre | |
| 2 | Type | Sélectionner "Phase" | Champs adaptés pour phase | |
| 3 | Nom | Entrer "Phase 1 - Design" | Texte saisi | |
| 4 | Dates | 01/04 - 30/04 | Dates enregistrées | |
| 5 | Création | Cliquer "Créer" | Phase apparaît (barre plus épaisse) | |
| 6 | Imbrication | Créer tâche sous cette phase | Tâche imbriquée correctement | |

---

### B3. Créer un jalon (milestone)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Ajouter tâche" | Modal s'ouvre | |
| 2 | Type | Sélectionner "Jalon" | Champs adaptés | |
| 3 | Nom | Entrer "Livraison v1.0" | Texte saisi | |
| 4 | Date | Sélectionner 15/05/2026 | Date confirmée | |
| 5 | Création | Cliquer "Créer" | Jalon affiché (losange/diamant) | |
| 6 | Style | Vérifier le style distinctif | Icône jalon visible | |

---

### B4. Créer un permis de construire
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Ajouter tâche" | Modal s'ouvre | |
| 2 | Type | Sélectionner "Permis de construire" | Champs spécifiques | |
| 3 | Détails | Entrer PC | Type sélectionné | |
| 4 | Délai | Vérifier "90 jours" auto-calculé | Délai correct (90j) | |
| 5 | Création | Cliquer "Créer" | Permis créé dans le projet | |
| 6 | Dashboard | Accéder au Dashboard | Permis visible dans récap | |

---

### B5. Modifier une tâche
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Sélection | Double-cliquer sur tâche | Modal d'édition s'ouvre | |
| 2 | Nom | Modifier le nom | Texte mutable | |
| 3 | Dates | Changer la date fin | Nouvelle date acceptée | |
| 4 | Couleur | Changer la couleur | Nouvelle couleur appliquée | |
| 5 | Priorité | Changer en "Haute" | Priorité mise à jour | |
| 6 | Statut | Changer en "En cours" | Statut actualisé | |
| 7 | Progression | Entrer 50% | Pourcentage enregistré | |
| 8 | Sauvegarde | Cliquer "Enregistrer" | Modifications appliquées au Gantt | |

---

### B6. Assigner des ressources
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Création ressource | Aller à "Vue Ressources" | Affichage des ressources | |
| 2 | Ajouter | Cliquer "Ajouter ressource" | Modal d'ajout | |
| 3 | Détails | Entrer nom, rôle, avatar | Ressource créée | |
| 4 | Tâche | Double-cliquer tâche | Modal édition ouverte | |
| 5 | Assignation | Ajouter ressource à tâche | Ressource assignée | |
| 6 | Affichage | Vérifier avatar dans Gantt | Avatar visible sur barre | |
| 7 | Charge | Vérifier vue Ressources | Charge de travail mise à jour | |

---

### B7. Définir des dépendances
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Édition | Ouvrir modal tâche | Modal d'édition | |
| 2 | Prédécesseur | Ajouter tâche A comme prédécesseur | Dépendance créée | |
| 3 | Vérification | Vérifier dans Gantt | Ligne de dépendance visible | |
| 4 | Contrainte | Vérifier tâche B décalée | Tâche B respecte la dépendance | |
| 5 | Chemin critique | Activer chemin critique | Dépendance critiques en rouge | |

---

### B8. Dupliquer une tâche
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Clic droit sur tâche | Menu contextuel | |
| 2 | Duplication | Cliquer "Dupliquer" | Nouvelle tâche créée | |
| 3 | Données | Vérifier les propriétés | Copie conforme (sauf dates) | |
| 4 | Indépendance | Modifier la copie | Tâche originale inchangée | |

---

### B9. Supprimer une tâche
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Sélection | Cliquer sur tâche | Tâche sélectionnée | |
| 2 | Suppression | Appuyer "Suppr" | Confirmation demandée | |
| 3 | Confirmation | Cliquer "Oui" | Tâche supprimée du Gantt | |
| 4 | Vérification | Vérifier la liste | Tâche n'existe plus | |

---

### B10. Sélection multiple
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Sélection | Cliquer tâche 1 | Tâche 1 sélectionnée | |
| 2 | Multi | Ctrl+Clic tâche 2 | Les 2 sélectionnées | |
| 3 | Étendue | Shift+Clic tâche 5 | Tâches 2-5 sélectionnées | |
| 4 | Actions | Cliquer "Supprimer" | Toutes les sélections supprimées | |
| 5 | Changement | Changer statut en masse | Tous les statuts changés | |

---

## C. Vues du Projet

### C1. Vue Timeline (Diagramme de Gantt)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Affichage | Cliquer "Vue Timeline" | Gantt affiché | |
| 2 | Tâches | Vérifier les barres | Toutes les tâches visibles | |
| 3 | Jalons | Vérifier les losanges | Jalons visibles | |
| 4 | Phases | Vérifier les groupes | Phases avec imbrication | |
| 5 | Dépendances | Vérifier les lignes | Lignes de dépendances visibles | |
| 6 | Aujourd'hui | Vérifier la ligne rouge | Marqueur actuel visible | |
| 7 | Weekends | Vérifier les différences | Weekends marqués différemment | |

---

### C2. Vue Tableau (Table/Kanban)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Affichage | Cliquer "Vue Tableau" | Table s'affiche | |
| 2 | Colonnes | Vérifier les colonnes | Nom, Dates, Status, Priorité | |
| 3 | Tri | Cliquer en-tête "Nom" | Tri alphabétique appliqué | |
| 4 | Sélection | Cocher la case d'une tâche | Tâche sélectionnée | |
| 5 | Édition | Double-cliquer une cellule | Cellule éditable (si possible) | |
| 6 | Filtres | Appliquer filtre "En cours" | Seules les tâches en cours | |

---

### C3. Vue Ressources
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Affichage | Cliquer "Vue Ressources" | Cartes de ressources | |
| 2 | Cartes | Vérifier les infos | Nom, rôle, avatar | |
| 3 | Charge | Vérifier barre de charge | Pourcentage de charge | |
| 4 | Avertissement | Créer une ressource surcharge | Barre rouge (>100%) | |
| 5 | Tâches | Vérifier liste des tâches | Tâches assignées listées | |
| 6 | Ajout | Cliquer "Ajouter ressource" | Modal d'ajout | |
| 7 | Édition | Cliquer sur ressource existante | Modal d'édition | |
| 8 | Suppression | Supprimer une ressource | Ressource retirée | |

---

### C4. Vue Dashboard
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Affichage | Cliquer "Dashboard" | Vue globale | |
| 2 | KPI | Vérifier les statistiques | Nombre tâches, % complétude | |
| 3 | Progression | Vérifier barres par projet | Progression visual | |
| 4 | Alertes | Vérifier les avertissements | Tâches retardées affichées | |
| 5 | Permis | Vérifier récapitulatif permis | Types et statuts visibles | |
| 6 | Multi-projet | Basculer entre projets | Dashboard mis à jour | |

---

## D. Interactions sur le Gantt

### D1. Glisser-déposer une barre (modification de dates)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Position | Localiser une barre | Barre identifiée | |
| 2 | Glisser | Cliquer et glisser à droite | Barre se déplace | |
| 3 | Dates | Vérifier nouvelles dates | Dates mises à jour | |
| 4 | Dépendances | Vérifier les dépendances | Tâches dépendantes décalées | |
| 5 | Undo | Appuyer Ctrl+Z | Modification annulée | |
| 6 | Redo | Appuyer Ctrl+Y | Modification rétablie | |

---

### D2. Redimensionner une barre (modifier la durée)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Position | Hover sur le bout d'une barre | Curseur redimensionnement | |
| 2 | Drag | Cliquer et glisser | Barre s'allonge/raccourcit | |
| 3 | Durée | Vérifier la durée | Nombre de jours correct | |
| 4 | Dates fin | Vérifier la date de fin | Date mise à jour | |
| 5 | Dépendances | Vérifier si respectées | Contraintes appliquées | |

---

### D3. Support tactile (Mobile/Tablette)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Tapotement | Tapoter une barre | Tâche sélectionnée | |
| 2 | Glissement | Glisser une barre | Barre se déplace | |
| 3 | Pinch zoom | Pincer l'écran | Zoom in/out du Gantt | |
| 4 | Défilement | Scroller horizontalement | Gantt se défile | |
| 5 | Long-press | Maintenir appui sur tâche | Menu contextuel (optional) | |

---

### D4. Infobulle au survol
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Hover | Survoler une barre | Infobulle apparaît | |
| 2 | Contenu | Vérifier les infos | Nom, dates, ressources | |
| 3 | Progression | Vérifier % | Pourcentage affiché | |
| 4 | Délai | Vérifier si retardée | Indicateur rouge si retard | |
| 5 | Disparition | Éloigner souris | Infobulle disparaît | |

---

## E. Zoom et Navigation

### E1. Niveaux de zoom
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Jour | Cliquer "Jour" | Granularité au jour | |
| 2 | Affichage | Vérifier les colonnes | Colonnes jour visibles | |
| 3 | Semaine | Cliquer "Semaine" | Granularité à la semaine | |
| 4 | Affichage | Vérifier les colonnes | Colonnes semaine visibles | |
| 5 | Mois | Cliquer "Mois" | Granularité au mois | |
| 6 | Affichage | Vérifier les colonnes | Colonnes mois visibles | |
| 7 | Trimestre | Cliquer "Trimestre" | Granularité au trimestre | |
| 8 | Affichage | Vérifier les colonnes | Colonnes trimestre visibles | |

---

### E2. Chemin critique
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Désactivé | Vérifier l'état initial | Chemin critique caché | |
| 2 | Activation | Cliquer sur "Chemin critique" | Toggle activé | |
| 3 | Affichage | Vérifier le Gantt | Chemin critique en rouge | |
| 4 | Tâches critiques | Vérifier les barres | Barres critiques surlignées | |
| 5 | Dépendances | Vérifier les lignes | Lignes du chemin en rouge | |
| 6 | Désactivation | Cliquer à nouveau | Chemin critique masqué | |

---

## F. Filtrage et Recherche

### F1. Barre de recherche (Ctrl+F)
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Activation | Appuyer Ctrl+F | Champ de recherche | |
| 2 | Saisie | Entrer "implémentation" | Texte saisi | |
| 3 | Recherche | Vérifier les résultats | Tâches contenant le texte | |
| 4 | Mise en avant | Vérifier la surbrillance | Résultats surlignés | |
| 5 | Effacement | Vider le champ | Tous les résultats affichés | |
| 6 | Fermeture | Appuyer Échap | Champ de recherche fermé | |

---

### F2. Filtres
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Statut | Cliquer filtre "Statut" | Options disponibles | |
| 2 | Sélection | Cocher "En cours" | Filtre appliqué | |
| 3 | Affichage | Vérifier les tâches | Seules les tâches "En cours" | |
| 4 | Ressource | Cliquer filtre "Ressource" | Ressources listées | |
| 5 | Assignation | Sélectionner une ressource | Tâches de cette ressource | |
| 6 | Priorité | Cliquer filtre "Priorité" | Priorités disponibles | |
| 7 | Sélection | Cocher "Haute" | Tâches hautes priorité | |
| 8 | Multi-filtres | Appliquer 2+ filtres | Intersection des résultats | |
| 9 | Réinitialisation | Cliquer "Réinitialiser" | Tous les filtres enlevés | |

---

## G. Import/Export

### G1. Export JSON
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Exporter" | Menu d'export | |
| 2 | Format | Sélectionner "JSON" | Téléchargement lancé | |
| 3 | Fichier | Vérifier le fichier | Fichier .json créé | |
| 4 | Contenu | Ouvrir le fichier | JSON valide avec données | |
| 5 | Import | Importer le fichier | Projet restauré identique | |

---

### G2. Export CSV
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Exporter" | Menu d'export | |
| 2 | Format | Sélectionner "CSV" | Téléchargement lancé | |
| 3 | Fichier | Vérifier le fichier | Fichier .csv créé | |
| 4 | Ouverture | Ouvrir dans Excel | Données bien formatées | |
| 5 | Colonnes | Vérifier les colonnes | Toutes les données | |

---

### G3. Export PDF
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Exporter" | Menu d'export | |
| 2 | Format | Sélectionner "PDF" | Aperçu d'impression | |
| 3 | Impression | Enregistrer en PDF | Fichier PDF créé | |
| 4 | Contenu | Ouvrir le PDF | Gantt visible et lisible | |
| 5 | Qualité | Vérifier la lisibilité | Texte et graphiques clairs | |

---

### G4. Import XML MS Project
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Préparation | Exporter depuis MS Project | Fichier .xml créé | |
| 2 | Import | Cliquer "Importer" | Sélecteur de fichier | |
| 3 | Fichier | Choisir le .xml | Fichier sélectionné | |
| 4 | Import | Cliquer "Importer" | Données converties | |
| 5 | Vérification | Vérifier les tâches | Tâches importées correctement | |
| 6 | Propriétés | Vérifier dates et relations | Propriétés conservées | |

---

## H. Cloud - Google Drive

### H1. Connexion et Sauvegarde
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Cloud" ou paramètres | Option Google Drive | |
| 2 | Connexion | Cliquer "Connecter Google Drive" | Fenêtre d'authentification | |
| 3 | Auth | Se connecter avec compte | Autorisation demandée | |
| 4 | Acceptation | Accepter les permissions | Connexion établie | |
| 5 | Sauvegarde | Cliquer "Sauvegarder" | Fichier créé dans Drive | |
| 6 | Vérification | Vérifier Google Drive | Fichier présent | |

---

### H2. Restauration
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer "Cloud" | Options de cloud | |
| 2 | Restauration | Cliquer "Restaurer depuis Drive" | Liste des sauvegardes | |
| 3 | Sélection | Choisir une sauvegarde | Fichier sélectionné | |
| 4 | Import | Cliquer "Charger" | Données restaurées | |
| 5 | Vérification | Vérifier les données | Projet restauré correctement | |

---

## I. Personnalisation (Branding)

### I1. Modification des couleurs
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Cliquer icône engrenage | Paramètres s'ouvrent | |
| 2 | Panneau | Cliquer "Branding" | Panel de branding | |
| 3 | Couleur principale | Changer la couleur | Nouvelle couleur appliquée | |
| 4 | Survol | Changer couleur survol | Couleur de hover changée | |
| 5 | Accent | Changer couleur d'accent | Boutons et éléments changés | |
| 6 | Aperçu | Vérifier en temps réel | Changes visibles immédiatement | |
| 7 | Sauvegarde | Enregistrer | Configuration persistée | |

---

### I2. Modification de l'identité
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Ouvrir "Branding" | Panneau branding | |
| 2 | Nom | Modifier le nom | Nouveau nom enregistré | |
| 3 | Logo | Télécharger logo | Image intégrée | |
| 4 | Favicon | Changer favicon | Onglet navigateur mis à jour | |
| 5 | Vérification | Recharger la page | Changements persistants | |

---

### I3. Modification du thème
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Accès | Ouvrir Branding | Paramètres | |
| 2 | Police | Changer la police | Nouvelle font appliquée | |
| 3 | Contraste | Vérifier le contraste | Texte lisible | |
| 4 | Export | Cliquer "Exporter config" | Fichier config créé | |
| 5 | Import | Cliquer "Importer config" | Configuration restaurée | |

---

## J. Thème Sombre/Clair

### J1. Basculement manuel
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Mode clair | État initial | Interface en clair | |
| 2 | Toggle | Appuyer Ctrl+D | Basculement en sombre | |
| 3 | Affichage | Vérifier l'interface | Fond sombre, texte clair | |
| 4 | Lisibilité | Lire le texte | Texte lisible en sombre | |
| 5. Toggle inverse | Appuyer Ctrl+D | Retour au mode clair | |

---

### J2. Détection automatique
| # | Étape | Action | Résultat attendu | ✓/✗ |
|---|-------|--------|------------------|-----|
| 1 | Préf système | Mode sombre dans OS | Gantt en mode sombre | |
| 2 | Synchronisation | Changer OS theme | Gantt synchronisé | |
| 3 | Override | Appuyer Ctrl+D | Mode manuel activé | |
| 4 | Sauvegarde | Recharger la page | Mode manuel conservé | |

---

## K. Raccourcis Clavier

### K1. Navigation
| Raccourci | Action | Résultat attendu | ✓/✗ |
|-----------|--------|------------------|-----|
| Ctrl+Z | Annuler | Dernière action annulée | |
| Ctrl+Y | Rétablir | Action rétablie | |
| Ctrl+F | Rechercher | Barre de recherche ouverte | |
| Ctrl+D | Thème | Mode sombre/clair basculé | |
| 1 | Vue Timeline | Vue Gantt affichée | |
| 2 | Vue Tableau | Vue Table affichée | |
| 3 | Vue Ressources | Vue Ressources affichée | |
| Suppr | Supprimer | Tâche supprimée | |
| Échap | Fermer modal | Modal fermée | |
| ? | Aide | Aide affichée | |

---

# ⚡ Tests de Performance

## P1. Charge initiale
| # | Élément | Cible | Mesuré | ✓/✗ |
|----|---------|-------|---------|-----|
| 1 | Chargement page | < 3s | [À mesurer] | |
| 2 | Rendu Gantt (100 tâches) | < 2s | [À mesurer] | |
| 3 | Rendu Gantt (500 tâches) | < 5s | [À mesurer] | |
| 4 | Rendu Gantt (1000+ tâches) | < 10s | [À mesurer] | |

**Outil de mesure** : Chrome DevTools Performance tab

---

## P2. Interactions
| # | Action | Cible | Mesuré | ✓/✗ |
|----|--------|-------|---------|-----|
| 1 | Glisser-déposer | 60 FPS | [À mesurer] | |
| 2 | Redimensionnement | 60 FPS | [À mesurer] | |
| 3 | Zoom | < 200ms | [À mesurer] | |
| 4 | Filtrage | < 500ms | [À mesurer] | |

---

## P3. Utilisation mémoire
| # | Scénario | Cible | Mesuré | ✓/✗ |
|----|----------|-------|---------|-----|
| 1 | 100 tâches | < 50MB | [À mesurer] | |
| 2 | 500 tâches | < 200MB | [À mesurer] | |
| 3 | 1000+ tâches | < 400MB | [À mesurer] | |

---

# ♿ Tests d'Accessibilité

## AC1. Navigation au clavier
| # | Test | Résultat | ✓/✗ |
|----|------|---------|-----|
| 1 | Tab traverse tous les contrôles | Tous les éléments accessibles | |
| 2 | Shift+Tab inverse | Navigation inverse fonctionne | |
| 3 | Entrée sur bouton | Action déclenchée | |
| 4 | Espace sur checkbox | Case cochée/décochée | |
| 5 | Flèches dans liste | Navigation dans liste | |

---

## AC2. Lecteur d'écran (NVDA/JAWS)
| # | Test | Résultat attendu | ✓/✗ |
|----|------|------------------|-----|
| 1 | En-têtes | Lisus correctement | |
| 2 | Boutons | Annoncés avec action | |
| 3 | Formulaires | Labels associés | |
| 4 | Tables | Structure annoncée | |
| 5 | Modales | Annonce ouverture | |
| 6 | Erreurs | Messages annoncés | |

---

## AC3. Contraste
| # | Élément | Ratio cible | Mesuré | ✓/✗ |
|----|---------|-----------|--------|-----|
| 1 | Texte normal | 4.5:1 | [À mesurer] | |
| 2 | Texte grand | 3:1 | [À mesurer] | |
| 3 | Éléments interactifs | 4.5:1 | [À mesurer] | |

---

# 📱 Tests de Responsivité

## R1. Résolutions
| Appareil | Résolution | Bureau | Tablet | Mobile | ✓/✗ |
|----------|-----------|--------|--------|--------|-----|
| **Desktop** | 1920x1080 | Normal | N/A | N/A | |
| **Desktop** | 1366x768 | Réduit | N/A | N/A | |
| **Laptop** | 1440x900 | Normal | N/A | N/A | |
| **iPad** | 1024x1366 | Tab | Horizontal | N/A | |
| **iPad** | 768x1024 | Tab | Vertical | N/A | |
| **iPhone 12** | 390x844 | N/A | N/A | Mobile | |
| **iPhone 14+** | 430x932 | N/A | N/A | Mobile | |
| **Android** | 360x720 | N/A | N/A | Mobile | |
| **Android** | 412x915 | N/A | N/A | Mobile | |

---

## R2. Éléments critiques
| # | Élément | Desktop | Tablet | Mobile | ✓/✗ |
|----|---------|---------|--------|--------|-----|
| 1 | Menu principal | Visible | Compact | Hamburger | |
| 2 | Gantt | Full | Scrollable | Scrollable | |
| 3 | Boutons | Normal | Tactile (44px+) | Tactile (44px+) | |
| 4 | Modal | Centered | Centered | Full screen | |
| 5 | Tableau | Scrollable | Scrollable | Horizontal | |

---

# 🐛 Procédure de Signalement des Bugs

## Format de Rapport
```
**Titre** : [Brève description]

**Plateforme** : Windows / macOS / iOS / Android
**Navigateur** : Chrome / Firefox / Safari / Edge + version
**Résolution** : 1920x1080 / 1024x768 / etc.

**Description** :
[Décrire le bug en détail]

**Étapes de reproduction** :
1. [Étape 1]
2. [Étape 2]
3. [Étape 3]

**Résultat attendu** :
[Quoi attendre]

**Résultat réel** :
[Qu'il s'est passé]

**Pièces jointes** :
- [Screenshot]
- [Vidéo si applicable]
```

---

## Exemple
```
**Titre** : Modal de création de tâche non centré sur Safari macOS

**Plateforme** : macOS
**Navigateur** : Safari 17.3
**Résolution** : 1440x900

**Description** :
Lors de la création d'une nouvelle tâche sur Safari macOS, la modal
n'est pas correctement centrée à l'écran.

**Étapes de reproduction** :
1. Ouvrir le navigateur Safari sur macOS
2. Charger Gantt Planner Pro
3. Cliquer sur "Ajouter tâche"
4. Observer la position de la modal

**Résultat attendu** :
Modal centrée horizontalement et verticalement

**Résultat réel** :
Modal décalée vers le haut et à droite

**Pièces jointes** :
- screenshot_modal_position.png
```

---

## Severity Levels
| Niveau | Description | Exemple |
|--------|-------------|---------|
| 🔴 **Critique** | Feature inopérante | Impossible créer une tâche |
| 🟠 **Haute** | Feature partiellement cassée | Glisser-déposer sur mobile |
| 🟡 **Moyenne** | Feature fonctionne, incohérence | Bouton mal aligné |
| 🟢 **Basse** | Amélioration mineure | Typo dans un label |

---

# ✅ Checklist Finale

## Avant production
- [ ] Tous les tests fonctionnels passent
- [ ] Performance acceptable sur tous navigateurs
- [ ] Aucun bug critique ouvert
- [ ] Accessibilité WCAG 2.1 AA minimum
- [ ] Responsivité testée sur 5+ appareils
- [ ] Export/Import fonctionnels
- [ ] Cloud (Google Drive) fonctionnel
- [ ] Raccourcis clavier documentés
- [ ] Manuel utilisateur à jour

## Signature de Test
| Information | Valeur |
|-------------|--------|
| Testeur | [Nom] |
| Date début | [Date] |
| Date fin | [Date] |
| Durée totale | [Heures] |
| Bugs trouvés | [Nombre] |
| Bugs corrigés | [Nombre] |
| Blockers | [Nombre] |
| Verdict | ✅ Production-Ready / ⚠️ Validation requise / ❌ Non-prêt |

---

**Document généré** : Mars 2026
**Version** : 1.0

