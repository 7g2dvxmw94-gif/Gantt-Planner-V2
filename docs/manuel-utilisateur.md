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

## 1. Introduction

### 1.1. Présentation de Gantly

Gantly est un outil de gestion de projet en ligne pensé pour les professionnels du BTP (bâtiment et travaux publics), les architectes, les chefs de chantier et les maîtres d'ouvrage. Il combine la puissance d'un diagramme de Gantt classique avec des fonctionnalités métier spécifiques au secteur de la construction : suivi des permis de construire, gestion des délais d'instruction, calcul des coûts en jours ouvrés, et gestion multi-projets.

Les fonctionnalités principales incluent :

- **Diagramme de Gantt interactif** avec glisser-déposer, redimensionnement, dépendances et chemin critique
- **Multi-vues** : Timeline, Tableau, Ressources, Dashboard, Coûts et Kanban
- **Gestion des permis de construire** : PC, PCM, DP, PA, PD avec calcul automatique des délais
- **Pool de ressources global** partagé entre projets
- **Baselines** pour suivre les écarts par rapport au planning de référence
- **Collaboration en temps réel** via Supabase
- **Import/export** : JSON, CSV, XML MS Project, Excel, PDF, PowerPoint
- **Sauvegarde cloud** : Google Drive, OneDrive
- **Personnalisation** : thème, couleurs, polices, langue, devise, logo

### 1.2. Configuration requise

Gantly fonctionne dans n'importe quel navigateur moderne. Aucune installation locale n'est nécessaire.

- **Navigateurs supportés** : Chrome, Firefox, Safari, Edge (versions récentes — 2 dernières années)
- **Connexion Internet** : requise pour l'authentification, la synchronisation Supabase et la collaboration
- **Résolution écran** : 1024×768 minimum recommandée pour le bureau ; interface mobile optimisée pour smartphones et tablettes
- **JavaScript** : doit être activé

### 1.3. Premier lancement et guide de démarrage (Onboarding)

À votre toute première connexion, un assistant interactif vous guide à travers les principales fonctionnalités :

1. **Bienvenue** : présentation rapide de l'outil
2. **Création du premier projet** : nom, description, dates de début et de fin
3. **Ajout des ressources** : équipiers, sous-traitants
4. **Création des premières tâches** : phases et tâches simples
5. **Découverte des vues** : Timeline, Tableau, Dashboard

Vous pouvez relancer l'onboarding à tout moment depuis **Réglages > Aide > Lancer le guide de démarrage**.

---

## 2. Authentification et compte

### 2.1. Créer un compte

Sur la page d'accueil (`landing.html`), cliquez sur **« Commencer gratuitement »** ou **« Se connecter »** pour accéder à la page d'authentification.

Pour créer un compte :

1. Cliquez sur l'onglet **« Créer un compte »**
2. Renseignez votre adresse e-mail et un mot de passe (8 caractères minimum)
3. Confirmez le mot de passe
4. Cliquez sur **« Créer mon compte »**

Un e-mail de confirmation est envoyé. Cliquez sur le lien reçu pour activer votre compte. Vous serez ensuite automatiquement connecté.

### 2.2. Se connecter / se déconnecter

**Connexion** : sur la page `auth.html`, saisissez votre e-mail et votre mot de passe, puis cliquez sur **« Se connecter »**. Vous êtes redirigé vers l'application principale.

**Déconnexion** : cliquez sur votre avatar en haut à droite, puis sur **« Se déconnecter »** dans le menu déroulant. Toutes les données locales non synchronisées sont conservées et resynchronisées à la prochaine connexion.

**Mot de passe oublié** : cliquez sur **« Mot de passe oublié ? »** sur la page de connexion pour recevoir un lien de réinitialisation par e-mail.

### 2.3. Affichage du nom d'utilisateur dans l'en-tête

Une fois connecté, votre nom d'utilisateur (ou les initiales par défaut) s'affiche en haut à droite de l'en-tête. Pour personnaliser ce nom :

1. Cliquez sur votre avatar
2. Allez dans **Réglages > Profil**
3. Modifiez le champ **Nom d'utilisateur**
4. Cliquez sur **Enregistrer**

Le nom est mis à jour en temps réel dans toute l'application.

### 2.4. Plans : Gratuit et Pro

Gantly est disponible en deux formules :

#### 2.4.1. Limites du plan gratuit

Le **plan Gratuit** permet de découvrir l'outil sans engagement :

- **3 projets** maximum
- **20 tâches** par projet
- **3 collaborateurs** par projet
- Toutes les vues (Timeline, Tableau, Ressources, Dashboard, Coûts, Kanban)
- Sauvegarde cloud Google Drive et OneDrive
- Synchronisation Supabase

Lorsque vous atteignez une limite, une bannière vous propose de passer au plan Pro.

#### 2.4.2. Passer au plan Pro

Le **plan Pro** (29 €/mois) lève toutes les limites :

- **Projets illimités**
- **Tâches illimitées**
- **Collaborateurs illimités**
- Support prioritaire
- Accès anticipé aux nouvelles fonctionnalités

Pour souscrire :

1. Cliquez sur **« Passer au Pro »** depuis la bannière, ou allez dans **Réglages > Profil**
2. Vous êtes redirigé vers une page Stripe sécurisée
3. Renseignez votre moyen de paiement
4. La validation est immédiate

Vous pouvez résilier à tout moment depuis le portail Stripe (lien dans Réglages > Profil).

---

## 3. Interface générale

### 3.1. En-tête et barre de navigation

L'en-tête est toujours visible en haut de l'écran et contient les éléments suivants, de gauche à droite :

#### 3.1.1. Logo et nom du projet

Le **logo Gantly** s'affiche à gauche. À sa droite, le **sélecteur de projet** indique le projet actif. Cliquez dessus pour ouvrir le menu déroulant et basculer entre projets.

#### 3.1.2. Accès aux Réglages via l'avatar utilisateur

À droite de l'en-tête, votre **avatar** (initiales ou photo) ouvre un menu donnant accès à :

- Vos informations de profil
- Les **Réglages** complets de l'application
- Le bouton de **déconnexion**

#### 3.1.3. Bouton Partager (icône 3 cercles)

L'icône à 3 cercles dans l'en-tête permet de **partager le projet actif** avec d'autres utilisateurs. Voir la section 4.6 pour les détails.

### 3.2. Barre d'outils principale

Sous l'en-tête, la barre d'outils regroupe les onglets de vues (Timeline, Tableau, Ressources, Dashboard, Coûts, Kanban) ainsi que les actions principales :

- **Nouvelle tâche** (icône +)
- **Importer / Exporter**
- **Niveaux de zoom** (Jour / Semaine / Mois / Trimestre)
- **Paramètres d'affichage** (afficher/masquer les liens, etc.)
- **Baselines** (création et sélection)
- **Historique** (icône horloge)

### 3.3. Barre de filtres

Une barre de filtres dédiée se trouve sous la barre d'outils. Elle inclut :

- **Filtre Statut** (multi-sélection)
- **Filtre Ressources** (multi-sélection)
- **Filtre Phases** (multi-sélection)
- **Filtre Priorité** (multi-sélection)
- **Plage de dates** (date début / date fin)
- **Bouton Réinitialiser** pour effacer tous les filtres

Voir la section 12 pour le détail de chaque filtre.

### 3.4. Navigation mobile

Sur smartphone et tablette, une **barre de navigation en bas d'écran** remplace la barre d'outils principale. Elle propose les vues les plus utilisées (Timeline, Tableau, Dashboard) et un menu **« Plus »** pour les autres options.

L'interface est entièrement adaptative : tableaux en cartes, modales en plein écran, gestes tactiles supportés.

### 3.5. Notifications et alertes

#### 3.5.1. Notifications internes (cloche)

L'icône **cloche** dans l'en-tête affiche un badge avec le nombre de notifications non lues. Cliquez dessus pour ouvrir le panneau qui regroupe :

- Tâches en retard
- Tâches arrivant à échéance
- Permis avec délais critiques
- Activités sur les projets partagés

#### 3.5.2. Notifications en temps réel (collaboration)

Lorsqu'un autre utilisateur réalise une action sur un projet partagé (ajout/modification/suppression de tâche, ajout d'un membre), une notification apparaît instantanément en haut de l'écran sous forme de toast.

#### 3.5.3. Supprimer une notification / Tout supprimer

Dans le panneau de notifications, chaque entrée dispose d'un bouton **« × »** pour la masquer. Le bouton **« Tout supprimer »** en haut du panneau efface toutes les notifications visibles. Les notifications supprimées sont conservées 90 jours côté serveur (politique de rétention).

---

## 4. Gestion des projets

### 4.1. Créer un nouveau projet

Pour créer un projet :

1. Cliquez sur le **sélecteur de projet** dans l'en-tête
2. Cliquez sur **« + Nouveau projet »** en bas du menu
3. Renseignez :
   - **Nom du projet** (obligatoire)
   - **Description** (optionnel)
   - **Date de début**
   - **Date de fin**
   - **Budget** (optionnel)
   - **Couleur** d'identification
4. Cliquez sur **Créer**

Le nouveau projet devient automatiquement actif et vous pouvez commencer à y ajouter des tâches.

### 4.2. Sélectionner et basculer entre les projets

Cliquez sur le **sélecteur de projet** dans l'en-tête. La liste de vos projets s'affiche. Cliquez sur le nom d'un projet pour le rendre actif. Toutes les vues sont rechargées avec les données du projet sélectionné.

#### 4.2.1. Barre de recherche dans le sélecteur de projets

Dès que vous avez **plus de 5 projets**, une barre de recherche apparaît automatiquement en haut du menu déroulant. Tapez les premières lettres pour filtrer la liste en temps réel.

### 4.3. Renommer un projet

1. Ouvrez le sélecteur de projet
2. Survolez le projet à renommer
3. Cliquez sur l'icône **crayon** qui apparaît
4. Saisissez le nouveau nom et validez avec **Entrée**

### 4.4. Dupliquer un projet

1. Ouvrez le sélecteur de projet
2. Survolez le projet à dupliquer
3. Cliquez sur l'icône **« copier »** (deux feuillets)
4. Une copie est créée avec le suffixe **« — copie »**, contenant toutes les tâches, phases, ressources et baselines

### 4.5. Supprimer un projet

1. Ouvrez le sélecteur de projet
2. Survolez le projet à supprimer
3. Cliquez sur l'icône **corbeille**
4. Confirmez dans la boîte de dialogue

⚠️ **Attention** : la suppression d'un projet supprime également toutes ses tâches, baselines et l'historique associé. Cette action est définitive.

### 4.6. Partager un projet

#### 4.6.1. Inviter un collaborateur par e-mail

1. Cliquez sur l'icône **Partager** (3 cercles) dans l'en-tête
2. Saisissez l'**adresse e-mail** du collaborateur
3. Choisissez le **rôle** : Éditeur ou Lecteur
4. Cliquez sur **Inviter**

Le destinataire reçoit un e-mail avec un lien d'acceptation. Une fois accepté, il a accès au projet selon le rôle attribué.

#### 4.6.2. Rôles : propriétaire, éditeur, lecteur

| Rôle           | Permissions                                                              |
|----------------|--------------------------------------------------------------------------|
| **Propriétaire** | Tous les droits, y compris suppression du projet et gestion des membres |
| **Éditeur**    | Créer, modifier, supprimer des tâches/ressources/baselines              |
| **Lecteur**    | Consultation seule (toutes les vues, mais aucune modification)          |

Le créateur du projet est automatiquement propriétaire. Il ne peut pas y avoir plusieurs propriétaires.

#### 4.6.3. Notification en temps réel lors du partage

Dès qu'une invitation est acceptée, le propriétaire reçoit une notification en temps réel. Inversement, le nouveau membre voit le projet apparaître automatiquement dans son sélecteur sans avoir besoin de recharger la page.

### 4.7. Historique du projet

#### 4.7.1. Journal des 7 derniers jours

Cliquez sur l'icône **horloge** dans la barre d'outils pour ouvrir l'historique. Les événements des **7 derniers jours** sont affichés en ordre antichronologique, avec :

- L'**auteur** (initiales ou nom)
- L'**action** réalisée (ajout, modification, suppression)
- La **cible** (tâche, phase, baseline...)
- L'**horodatage**

#### 4.7.2. Événements enregistrés (tâches, phases, chemin critique)

L'historique enregistre automatiquement :

- Création / modification / suppression de tâches et phases
- Création / suppression de baselines
- Activation du chemin critique
- Ajout / suppression de ressources
- Modification du nom ou des dates du projet

Au-delà de 7 jours, les entrées sont automatiquement purgées (politique de rétention).

---

## 5. Gestion des tâches

### 5.1. Créer une tâche

Plusieurs façons de créer une tâche :

- **Bouton « + Nouvelle tâche »** dans la barre d'outils
- **Raccourci clavier** : `Ctrl+W`
- **Clic droit** sur le Gantt > « Nouvelle tâche »
- **Bouton central** lorsque le Gantt est vide

Le **modal de création** s'ouvre avec les champs nécessaires. Renseignez au minimum le nom et les dates, puis cliquez sur **Créer**.

### 5.2. Types de tâches

#### 5.2.1. Tâche simple

C'est le type par défaut : une activité ayant une durée définie, des dates de début et de fin, et éventuellement des ressources, dépendances et coûts.

#### 5.2.2. Phase (groupe de tâches)

Une **phase** regroupe plusieurs tâches enfants. Ses dates et sa progression sont calculées automatiquement à partir des tâches qu'elle contient. Pour créer une phase, cochez **« C'est une phase »** dans le modal.

Pour rattacher des tâches à une phase, sélectionnez la phase comme **« Phase parente »** dans le modal de la tâche enfant.

#### 5.2.3. Jalon (milestone)

Un **jalon** est un point clé sans durée (ex : « Validation du permis », « Livraison du chantier »). Cochez **« C'est un jalon »** dans le modal. Le jalon est représenté par un losange sur le Gantt.

#### 5.2.4. Permis de construire

Un **permis de construire** est un type spécial de tâche dédié au suivi administratif. Cochez **« C'est un permis »** et renseignez :

- **Type** (PC, PCM, DP, PA, PD)
- **Statut** (En préparation, Déposé, Accordé, etc.)
- **Numéro de dossier**
- **Commune**
- **Service instructeur**
- **Secteur ABF** (oui/non)
- **Dates clés** (dépôt, complétude, décision)

Voir la section 13 pour plus de détails.

### 5.3. Modifier une tâche

**Cliquez sur la barre d'une tâche** dans le Gantt, ou **double-cliquez sur une ligne** dans la vue Tableau, pour ouvrir le modal de modification. Modifiez les champs voulus et cliquez sur **Enregistrer**.

Vous pouvez aussi modifier les dates et la durée directement dans le Gantt par glisser-déposer (voir section 9).

### 5.4. Propriétés d'une tâche

Le modal de tâche regroupe toutes les propriétés :

| Propriété      | Description                                                         |
|----------------|---------------------------------------------------------------------|
| **Nom**        | Libellé de la tâche                                                 |
| **Description**| Détails complémentaires (optionnel)                                 |
| **Date début** | Première date prévue                                                |
| **Date fin**   | Dernière date prévue                                                |
| **Durée**      | Calculée automatiquement (jours)                                    |
| **Priorité**   | Haute, Moyenne, Basse                                               |
| **Statut**     | À faire, En cours, Terminé                                          |
| **Progression**| 0 % à 100 %                                                         |
| **Couleur**    | Couleur d'identification de la barre dans le Gantt                  |
| **Phase parente** | Tâche parente si rattachée à une phase                          |

#### 5.4.1. Dérivation automatique du statut depuis la progression

Lorsque vous modifiez la **progression** dans le modal :

- 0 % → statut **« À faire »**
- 1-99 % → statut **« En cours »**
- 100 % → statut **« Terminé »**

Vous pouvez ensuite changer manuellement le statut si nécessaire.

### 5.5. Assigner des ressources à une tâche

Dans le modal de tâche, section **« Ressources »** :

1. Cliquez sur **« Ajouter une ressource »**
2. Sélectionnez une ressource existante dans le menu déroulant
3. Pour créer une nouvelle ressource, cliquez sur **« + Créer une ressource »**
4. Vous pouvez assigner plusieurs ressources à la même tâche

Le coût en ressources est calculé automatiquement (taux × durée).

### 5.6. Définir des dépendances (prédécesseurs et successeurs)

Dans le modal de tâche, section **« Dépendances »** :

1. **Prédécesseurs** : tâches qui doivent être terminées avant le démarrage
2. **Type de lien** : FS (Fin → Début), SS (Début → Début), FF (Fin → Fin), SF (Début → Fin)

Lorsqu'un prédécesseur est défini, la date de la tâche s'ajuste automatiquement si nécessaire pour respecter la contrainte. Les dépendances sont visibles sous forme de **flèches** sur le Gantt (voir 6.1.3).

### 5.7. Coûts fixes multiples et nommés

Vous pouvez ajouter plusieurs **coûts fixes nommés** à une tâche (ex : « Matériaux », « Location engin »). Dans le modal :

1. Section **« Coûts fixes »**
2. Cliquez sur **« + Ajouter un coût »**
3. Renseignez le **libellé** et le **montant**
4. Répétez pour autant de lignes que nécessaire

Le total des coûts fixes est ajouté au calcul du coût estimé de la tâche.

### 5.8. Dupliquer une tâche

- **Clic droit** sur la tâche > **« Dupliquer »**
- Ou via le menu contextuel dans la vue Tableau

Une copie est créée immédiatement après la tâche source, avec les mêmes propriétés (sauf l'ID, généré aléatoirement).

### 5.9. Supprimer une tâche

- **Sélectionnez** la tâche (clic) puis appuyez sur **`Suppr`**
- Ou **clic droit > Supprimer**
- Une boîte de confirmation s'affiche

Si vous supprimez une **phase**, ses tâches enfants sont également supprimées.

### 5.10. Menu contextuel (clic droit)

Le clic droit sur une tâche (dans le Gantt ou le Tableau) ouvre un menu avec :

- **Modifier**
- **Dupliquer**
- **Supprimer**
- **Promouvoir / Dégrader** (changer le niveau hiérarchique)
- **Convertir en jalon / phase / tâche**
- **Copier l'ID**

### 5.11. Sélection multiple et actions par lot

Dans la vue **Tableau** ou directement sur le Gantt :

- **Ctrl + clic** : ajouter une tâche à la sélection
- **Maj + clic** : sélectionner une plage continue
- **Ctrl + A** : tout sélectionner

Les **actions par lot** disponibles :

- Suppression multiple (`Suppr`)
- Modification du statut, de la priorité ou de la progression
- Assignation d'une ressource à plusieurs tâches
- Export ciblé

---

## 6. Vues du projet

### 6.1. Vue Timeline (diagramme de Gantt)

C'est la vue principale et par défaut. Elle affiche les tâches sous forme de barres horizontales sur une frise temporelle.

#### 6.1.1. Lecture du diagramme

- **Colonne de gauche** : liste des tâches (nom, durée, ressources)
- **Colonne de droite** : barres positionnées sur l'axe temporel
- **Indentation** : les tâches enfants sont indentées sous leur phase parente
- **Couleurs** : chaque tâche a sa propre couleur (configurable)

#### 6.1.2. Barres de tâches, phases et jalons

| Élément          | Représentation                                     |
|------------------|----------------------------------------------------|
| **Tâche simple** | Barre rectangulaire colorée                        |
| **Phase**        | Barre fine avec encoches aux extrémités            |
| **Jalon**        | Losange (pas de durée)                             |
| **Permis**       | Barre avec bordure et icône légale                 |
| **Progression**  | Remplissage interne (% complété)                   |

#### 6.1.3. Lignes de dépendances (affichage / masquage)

Des **flèches** relient les tâches selon leurs dépendances. Le type de lien est indiqué visuellement (point d'origine et d'arrivée).

Pour masquer / afficher les dépendances : **Réglages > Apparence > Afficher les liens** ou via la barre d'outils.

#### 6.1.4. Ligne du jour (marqueur "Aujourd'hui")

Une **ligne verticale rouge** indique la date du jour. Elle est mise à jour automatiquement.

#### 6.1.5. Indicateurs de week-end

Les colonnes **week-end** (samedi et dimanche) sont grisées pour distinguer les jours non ouvrés. Cela aide à visualiser les durées effectives.

#### 6.1.6. Bouton "Nouvelle tâche" sur Gantt vide

Si le projet n'a aucune tâche, un grand bouton **« + Créer ma première tâche »** s'affiche au centre du Gantt pour faciliter le démarrage.

### 6.2. Vue Tableau (liste triable)

Affichage tabulaire des tâches, idéal pour la saisie rapide et l'édition par lot.

#### 6.2.1. Tri des colonnes

Cliquez sur l'en-tête d'une colonne pour trier ascendant. Cliquez à nouveau pour inverser. Colonnes triables :

- Nom
- Type (Tâche / Phase / Jalon / Permis)
- Statut
- Priorité
- Date de début
- Date de fin
- Durée
- Progression
- Ressources

#### 6.2.2. Indicateurs de type (icônes Tâche / Jalon / Permis)

Chaque ligne dispose d'une **icône** indiquant le type :

- 📋 Tâche standard
- 📁 Phase
- 🎯 Jalon
- 📜 Permis

#### 6.2.3. Sélection et actions par lot

Une **case à cocher** dans chaque ligne permet la sélection. La case d'en-tête (sélectionne tout) active la **barre d'actions** : suppression, modification du statut, etc.

#### 6.2.4. Colonnes Baseline (BL Début, BL Fin, Écart)

Lorsqu'une **baseline** est active, trois colonnes apparaissent :

- **BL Début** : date de début prévue dans la baseline
- **BL Fin** : date de fin prévue dans la baseline
- **Écart** : différence en jours (positif = retard, négatif = avance)

### 6.3. Vue Ressources

Vue dédiée à la gestion des ressources et de leur charge.

#### 6.3.1. Pool de ressources globales (multi-projets)

Les ressources sont **partagées entre tous vos projets**. Vous pouvez réutiliser une même équipe ou un même sous-traitant sur plusieurs projets.

#### 6.3.2. Cartes des ressources

Chaque ressource est affichée comme une **carte** avec :

- Avatar / initiales
- Nom et rôle
- Taux horaire ou TJM
- Liste des tâches assignées
- Charge totale en heures/jours

Cliquez sur une carte pour modifier la ressource ou la supprimer.

#### 6.3.3. Charge de travail (workload)

Une **barre de progression** indique la charge de la ressource :

- 🟢 Vert : charge normale (< 80 %)
- 🟡 Orange : charge élevée (80-100 %)
- 🔴 Rouge : surcharge (> 100 %)

#### 6.3.4. Filtrage par projet

Un menu déroulant en haut de la vue permet de **filtrer les ressources affichées par projet**. Sélectionnez « Tous les projets » pour voir l'ensemble du pool.

### 6.4. Vue Tableau de bord (Dashboard multi-projets)

Vue d'ensemble synthétique de tous vos projets.

#### 6.4.1. KPI globaux

En haut, des **cartes KPI** affichent :

- Nombre de projets
- Tâches totales
- Tâches en retard
- Permis en cours
- Budget cumulé

#### 6.4.2. Progression par projet

Pour chaque projet : **barre de progression** indiquant le pourcentage de tâches terminées, accompagnée des dates et du nom du chef de projet.

#### 6.4.3. Alertes et seuils

Une section **« Alertes »** liste les éléments nécessitant attention :

- Tâches en retard (> 7 jours)
- Permis avec délai d'instruction proche
- Ressources en surcharge

#### 6.4.4. Récapitulatif des permis de construire

Un widget dédié affiche les **permis en cours** avec leur statut, date de dépôt, échéance prévue et alertes éventuelles.

#### 6.4.5. Filtrer par projet

Vous pouvez **isoler le Dashboard sur un seul projet** via le menu déroulant en haut à droite.

### 6.5. Vue Coûts

Suivi détaillé des coûts du projet.

#### 6.5.1. KPI de coûts (estimé, réel, écart, consommé)

Quatre cartes en haut :

- **Coût estimé** : somme des coûts prévus (ressources + fixes)
- **Coût réel** : somme des coûts réels saisis
- **Écart** : différence (positif = dépassement)
- **Consommé** : pourcentage du budget utilisé

#### 6.5.2. Tableau des coûts par phase et par tâche

Tableau hiérarchique avec :

- Nom de la tâche / phase
- Ressources affectées
- Coût ressources (calculé)
- Coûts fixes
- Coût estimé total
- Coût réel saisi
- Écart

#### 6.5.3. Coût fixe, coût ressources, coût réel, écart

- **Coût fixe** : montants forfaitaires saisis sur la tâche (matériaux, etc.)
- **Coût ressources** : taux × durée × nombre de ressources affectées
- **Coût réel** : valeur saisie manuellement après réalisation
- **Écart** : différence entre estimé et réel (rouge si dépassement)

#### 6.5.4. Regroupement par phase (réduction / expansion)

Cliquez sur la **flèche** à gauche d'une phase pour replier/déplier ses tâches enfants. Pratique pour vue synthétique.

#### 6.5.5. Filtrer par projet

Comme pour le Dashboard, un menu permet d'isoler la vue Coûts sur un seul projet.

### 6.6. Vue Kanban (Board)

Affichage en **colonnes par statut** : À faire / En cours / Terminé.

#### 6.6.1. Colonnes par statut

Chaque tâche est représentée par une **carte** glissable d'une colonne à l'autre. Le statut de la tâche est mis à jour automatiquement.

#### 6.6.2. Mise en évidence du chemin critique

Lorsque le **chemin critique** est activé, les cartes correspondantes ont une bordure rouge ou un indicateur visuel spécifique.

---

## 7. Baselines (lignes de référence)

### 7.1. Qu'est-ce qu'une baseline ?

Une **baseline** est un instantané du planning à un moment donné, qui sert de référence pour mesurer les écarts ultérieurs. Utile pour comparer le **prévu** au **réalisé**.

### 7.2. Créer une baseline

1. Cliquez sur le bouton **« Baseline »** dans la barre d'outils
2. Cliquez sur **« + Créer une baseline »**
3. Saisissez un nom (ex : « Planning initial 01/04/2026 »)
4. Cliquez sur **Créer**

L'instantané enregistre les dates et progressions de toutes les tâches au moment de la création.

### 7.3. Sélectionner et activer une baseline

1. Ouvrez le panneau Baselines
2. Cliquez sur la baseline à activer

#### 7.3.1. Affichage automatique sur le Gantt à la sélection

Les **barres fantômes** (gris clair) apparaissent automatiquement sur le Gantt, indiquant la position prévue de chaque tâche dans la baseline. Les barres actuelles restent superposées.

#### 7.3.2. Le panneau reste ouvert lors de la sélection

Le panneau Baselines ne se ferme pas lorsque vous sélectionnez une baseline, ce qui facilite la comparaison entre plusieurs versions.

### 7.4. Renommer une baseline

Dans le panneau Baselines, survolez une baseline et cliquez sur l'icône **crayon**. Renommez-la et validez.

### 7.5. Supprimer une baseline

Survolez la baseline et cliquez sur l'icône **corbeille**. Confirmez. La suppression est définitive.

### 7.6. Colonnes BL dans la vue Tableau

Lorsqu'une baseline est active, les colonnes **BL Début**, **BL Fin** et **Écart** apparaissent automatiquement dans la vue Tableau (voir 6.2.4).

---

## 8. Ressources et coûts

### 8.1. Créer et gérer les ressources

Pour créer une ressource :

1. Allez dans la **vue Ressources**
2. Cliquez sur **« + Nouvelle ressource »**
3. Renseignez les informations
4. Cliquez sur **Créer**

#### 8.1.1. Nom, rôle, avatar, couleur

- **Nom** : prénom + nom, ou nom de l'entreprise sous-traitante
- **Rôle** : ex « Maçon », « Électricien », « Architecte »
- **Avatar** : import d'une photo ou utilisation des initiales
- **Couleur** : pour identifier visuellement la ressource

#### 8.1.2. Taux horaire ou taux journalier (TJM)

Choisissez le mode de tarification :

- **Taux horaire** (€/h) : multiplié par 8 h × jours pour le coût quotidien
- **TJM** (€/jour) : appliqué directement par jour ouvré

#### 8.1.3. Autoriser une ressource à travailler le week-end

Par défaut, une ressource ne travaille **pas** le week-end (les coûts ne sont pas calculés sur samedi/dimanche). Vous pouvez activer une **dérogation par ressource** en cochant **« Travaille le week-end »** dans le modal de la ressource.

### 8.2. Pool de ressources global (multi-projets)

Toutes vos ressources sont partagées entre vos projets. Lorsque vous assignez une ressource à une tâche, vous pouvez choisir parmi toutes celles disponibles dans votre pool.

### 8.3. Affecter une ressource à une tâche

Voir section 5.5.

### 8.4. Calcul des coûts

#### 8.4.1. Coûts estimés (taux × durée)

Pour chaque tâche : `coût ressource = taux × durée_jours_ouvrés × nombre_ressources`. Les coûts fixes sont ajoutés.

#### 8.4.2. Coûts réels (saisie manuelle)

Dans le modal de tâche, champ **« Coût réel »** : saisissez le coût effectivement constaté après réalisation. L'**écart** (réel − estimé) est calculé automatiquement.

#### 8.4.3. Exclusion des week-ends du calcul (paramètre projet)

Par défaut, les week-ends sont **exclus** du calcul des coûts. Vous pouvez modifier ce comportement dans **Réglages > Général > Ressources > Exclure les week-ends du calcul des coûts**.

#### 8.4.4. Dérogation par ressource (worksWeekends)

Si une ressource a la propriété **« Travaille le week-end »** activée (voir 8.1.3), ses coûts sont calculés sur 7 jours/semaine, **même si le projet exclut globalement les week-ends**.

### 8.5. Charge de travail (workload)

La charge est calculée comme la **somme des heures/jours assignés** sur la période, divisée par la **capacité théorique** (8 h/jour ou 1 jour/jour). Affichée dans la vue Ressources (voir 6.3.3).

---

## 9. Interactions sur le diagramme de Gantt

### 9.1. Glisser-déposer une barre de tâche (modifier les dates)

Cliquez et **maintenez** une barre de tâche, puis glissez-la horizontalement. Les dates de début et de fin sont décalées d'autant. La durée reste inchangée. Lâchez pour valider.

### 9.2. Redimensionner une barre (modifier la durée)

Approchez le curseur du **bord gauche ou droit** de la barre. Le curseur change en flèche horizontale. Cliquez et glissez pour étendre ou raccourcir la barre. La date opposée reste fixe.

### 9.3. Support tactile (mobile / tablette)

Toutes les interactions glisser-déposer fonctionnent au **tactile**. Touchez et maintenez 0,5 s pour démarrer un glisser, puis bougez le doigt.

### 9.4. Pinch-to-zoom (zoom gestuel)

Sur tablette/mobile, **pincez ou écartez deux doigts** sur le Gantt pour changer le niveau de zoom (Jour / Semaine / Mois / Trimestre).

### 9.5. Défilement automatique (auto-scroll)

Lorsque vous glissez une barre près du bord du viewport, le Gantt **défile automatiquement** dans la même direction pour étendre la zone d'action.

### 9.6. Infobulle au survol

Survolez une barre pendant 0,5 s pour voir une **infobulle** détaillée.

#### 9.6.1. Informations affichées pour les tâches et phases

- Nom complet
- Dates de début et de fin
- Durée (jours ouvrés)
- Progression
- Ressources assignées (avatars)
- Coût estimé
- Statut

#### 9.6.2. Statut des jalons (Franchi / Non franchi)

Pour les jalons, l'infobulle indique :

- **« Franchi »** si la date est dépassée et le statut **Terminé**
- **« Non franchi »** sinon (avec date de référence)

---

## 10. Zoom et navigation temporelle

### 10.1. Niveaux de zoom : Jour, Semaine, Mois, Trimestre

Quatre niveaux disponibles :

- **Jour** : chaque colonne = 1 jour (idéal pour vue rapprochée)
- **Semaine** : chaque colonne = 1 semaine (par défaut)
- **Mois** : chaque colonne = 1 mois (vue moyenne)
- **Trimestre** : chaque colonne = 3 mois (vue large)

### 10.2. Changement de zoom via la barre d'outils

Les boutons **Jour / Semaine / Mois / Trimestre** dans la barre d'outils permettent de basculer instantanément. Le niveau choisi est sauvegardé par projet.

### 10.3. Défilement vers la date du jour à l'ouverture

Au chargement du Gantt, le défilement horizontal est automatiquement positionné autour de la **date du jour**, pour vous éviter de scroller.

### 10.4. Virtualisation des lignes (performances grands projets)

Au-delà de **80 lignes** affichées, un mode de **rendu virtuel** est activé : seules les lignes visibles sont rendues. Cela permet de gérer des projets de centaines voire milliers de tâches sans ralentissement.

---

## 11. Chemin critique

### 11.1. Qu'est-ce que le chemin critique ?

Le **chemin critique** est la séquence de tâches dépendantes qui détermine la durée totale du projet. Tout retard sur l'une d'elles décale la livraison finale.

### 11.2. Activer / désactiver l'affichage

Dans la barre d'outils, cliquez sur l'icône **« Chemin critique »** (éclair ou flèche). Les tâches du chemin critique sont alors **mises en évidence** par une bordure rouge et une couleur de barre spécifique.

### 11.3. Mise en évidence dans la vue Kanban et Tableau

Dans la **vue Kanban**, les cartes critiques ont un cadre rouge. Dans la **vue Tableau**, les lignes critiques sont surlignées.

---

## 12. Filtrage et recherche

### 12.1. Barre de recherche (Ctrl+F)

Tapez **`Ctrl+F`** ou cliquez dans le champ de recherche en haut de l'écran. La recherche s'effectue en temps réel sur :

- Le **nom** de la tâche
- La **description**
- Les **noms des ressources** assignées

### 12.2. Filtrer par statut

Menu déroulant **« Statut »** dans la barre de filtres. Multi-sélection : À faire, En cours, Terminé.

### 12.3. Filtrer par ressource (assigné)

Menu déroulant **« Ressources »**. Multi-sélection. L'option **« Non assigné »** filtre les tâches sans ressource.

### 12.4. Filtrer par priorité

Menu déroulant **« Priorité »**. Multi-sélection : Haute, Moyenne, Basse.

### 12.5. Filtrer par phase

Menu déroulant **« Phase »**. Multi-sélection. Permet d'isoler les tâches d'une ou plusieurs phases.

### 12.6. Filtrer par période (plage de dates)

Deux champs **Date début** et **Date fin** permettent de n'afficher que les tâches comprises dans cette plage.

### 12.7. Application des filtres à toutes les vues

Les filtres sont appliqués **simultanément** à toutes les vues : Timeline, Tableau, Kanban et Coûts. Vous voyez la même sélection partout.

### 12.8. Réinitialiser les filtres

Le bouton **« Réinitialiser »** à droite de la barre de filtres efface tous les filtres actifs et la recherche en un clic.

---

## 13. Permis de construire

### 13.1. Types de permis (PC, PCM, DP, PA, PD)

Voir Annexe B pour les détails. Chaque type a un **délai d'instruction par défaut** que Gantly utilise pour calculer les échéances.

### 13.2. Statuts d'un permis (de la préparation à la purge de recours)

Voir Annexe C. Les statuts couvrent l'ensemble du cycle de vie : **En préparation → Déposé → Complétude notifiée → En instruction → Accordé / Refusé → (Recours tiers) → Purgé de recours**.

### 13.3. Calcul automatique des délais d'instruction

Lorsque vous saisissez la **date de dépôt** et le **type de permis**, Gantly calcule automatiquement la **date d'échéance** théorique en ajoutant le délai légal :

- PC : +90 jours
- PCM : +60 jours
- DP : +30 jours
- PA : +90 jours
- PD : +60 jours

Le délai est rallongé si **secteur ABF** est coché (+1 mois).

### 13.4. Gestion ABF (Architecte des Bâtiments de France)

Cochez **« Secteur ABF »** dans le modal du permis si le projet se situe en zone protégée. Cela ajoute automatiquement **1 mois** au délai d'instruction.

### 13.5. Recours des tiers

Après l'**accord du permis**, un délai de **2 mois** s'applique pour un éventuel recours des tiers. Saisissez **« Date d'affichage du panneau »** pour faire démarrer ce délai. Le statut passe automatiquement à **« Purgé de recours »** à l'échéance.

### 13.6. Suivi depuis le Dashboard

Le **Dashboard** dispose d'un widget dédié aux permis qui affiche :

- Liste des permis actifs
- Statut et délai restant
- Alerte si délai < 7 jours
- Lien direct vers le permis dans le projet

---

## 14. Import et export

### 14.1. Exporter un projet

Cliquez sur **« Exporter »** dans la barre d'outils. Une boîte de dialogue propose les formats.

#### 14.1.1. Export JSON (réimportable)

Le format **JSON** contient toutes les données du projet (tâches, ressources, baselines). Il peut être réimporté dans Gantly à l'identique. Utile pour archivage ou migration.

#### 14.1.2. Export de tous les projets (JSON complet)

Une option **« Exporter tous mes projets »** dans **Réglages > Synchro** sauvegarde l'ensemble de votre compte Gantly dans un fichier JSON unique.

#### 14.1.3. Export CSV (compatible MS Project / Excel)

Format **CSV** avec colonnes standards : Nom, Début, Fin, Durée, Progression, Ressources. Compatible Excel, Google Sheets, MS Project.

#### 14.1.4. Export XML MS Project

Format **XML MS Project** (compatible Microsoft Project). Préserve les dépendances, ressources et phases.

#### 14.1.5. Export PDF — sections sélectionnables

Cochez les sections à inclure :

- **Tableau** : liste détaillée des tâches
- **Timeline** : capture du Gantt
- **Ressources** : pool des ressources du projet
- **Coûts** : récapitulatif des coûts

Le PDF est généré côté navigateur et téléchargé immédiatement.

#### 14.1.6. Export PowerPoint (.pptx) — mêmes sections que le PDF

Mêmes sections que le PDF, mais en format **PowerPoint** modifiable. Idéal pour intégrer dans une présentation client.

### 14.2. Importer un projet

Cliquez sur **« Importer »** dans la barre d'outils.

#### 14.2.1. Import JSON

Sélectionnez un fichier JSON Gantly (issu d'un export précédent). Le projet est créé en gardant ses propriétés.

#### 14.2.2. Import XML MS Project

Sélectionnez un fichier `.xml` exporté depuis Microsoft Project. Les tâches, dépendances et ressources sont reconstituées.

#### 14.2.3. Import Excel (XLSX)

Sélectionnez un fichier `.xlsx`. Gantly détecte automatiquement les colonnes (Nom, Début, Fin, Durée, Ressources). Un assistant vous permet de mapper les colonnes si nécessaire.

### 14.3. Guide d'import dans MS Project

Pour ouvrir un projet Gantly dans MS Project :

1. Exporter le projet en **XML MS Project** depuis Gantly
2. Dans MS Project : **Fichier > Ouvrir > Sélectionner le fichier XML**
3. MS Project propose un assistant : choisissez **« En tant que nouveau projet »**

---

## 15. Sauvegarde cloud

### 15.1. Google Drive

#### 15.1.1. Connexion à Google Drive

1. Allez dans **Réglages > Synchro**
2. Cliquez sur **« Connecter Google Drive »**
3. Autorisez Gantly à accéder à votre Drive (un seul dossier dédié, pas l'ensemble du Drive)

#### 15.1.2. Sauvegarde manuelle

Cliquez sur **« Sauvegarder maintenant »** dans Réglages > Synchro. Un fichier JSON est uploadé dans le dossier `Gantly/`.

#### 15.1.3. Restauration depuis Google Drive

Cliquez sur **« Restaurer »**, sélectionnez la sauvegarde voulue dans la liste, confirmez. Les données sont restaurées (et écrasent les données actuelles).

### 15.2. OneDrive

#### 15.2.1. Configuration de l'intégration OneDrive

Identique à Google Drive : **Réglages > Synchro > Connecter OneDrive**, autorisez l'accès.

#### 15.2.2. Sauvegarde et restauration

Mêmes boutons et fonctionnement que Google Drive (15.1.2 et 15.1.3).

---

## 16. Synchronisation Supabase (temps réel)

### 16.1. Synchronisation automatique des données

Toutes vos modifications (création, édition, suppression de tâches/ressources/baselines) sont **automatiquement synchronisées** avec le serveur Supabase. Pas besoin de bouton « Sauvegarder ».

### 16.2. Collaboration en temps réel

Lorsqu'un projet est partagé, les modifications d'un collaborateur apparaissent **en temps réel** chez les autres membres connectés, sans rechargement de la page.

### 16.3. Notifications cross-utilisateurs (partage, suppression de tâche)

Vous recevez une notification temps réel quand :

- Quelqu'un vous **partage** un projet
- Une **tâche** est ajoutée, modifiée ou supprimée sur un de vos projets partagés
- Un **membre** rejoint ou quitte un projet
- Une **baseline** est créée ou supprimée

---

## 17. Réglages

### 17.1. Ouvrir le panneau de Réglages (via l'avatar)

Cliquez sur votre **avatar** en haut à droite, puis sur **« Réglages »**. Un panneau latéral s'ouvre avec 5 onglets : Profil, Apparence, Général, Synchro, Aide.

### 17.2. Onglet Profil

#### 17.2.1. Nom d'utilisateur et initiales

Modifiez votre **nom affiché**. Les initiales sont calculées automatiquement (premières lettres des deux premiers mots).

#### 17.2.2. Photo de profil (avatar)

Cliquez sur l'avatar puis **« Importer »**. Sélectionnez une image (JPG/PNG, ≤ 1 Mo). L'image remplace les initiales.

#### 17.2.3. Logo de l'organisation (import de fichier)

Importez le **logo de votre entreprise** (format PNG/JPG/SVG). Il remplace le logo Gantly dans l'en-tête et figurera sur les exports PDF/PPT.

#### 17.2.4. Favicon personnalisé (import de fichier)

Importez une **icône** (32×32 ou 64×64 px) qui remplace le favicon dans l'onglet du navigateur.

### 17.3. Onglet Apparence

#### 17.3.1. Couleurs (principale, survol, claire, foncée, accent)

Personnalisez les **5 couleurs** de la charte graphique :

- Principale (boutons, liens)
- Survol (hover)
- Claire (arrière-plans clairs)
- Foncée (texte)
- Accent (badges, alertes)

#### 17.3.2. Typographie (choix de la police)

Sélectionnez parmi un panel de polices web (Inter, Roboto, Lato, Source Sans Pro, etc.).

#### 17.3.3. Thème sombre / clair

Bascule **« Mode sombre »**. Voir aussi section 18.

### 17.4. Onglet Général

#### 17.4.1. Nom de l'application

Renommez l'application si vous souhaitez une marque blanche (ex : « Mon Suivi Chantier »).

#### 17.4.2. Langue de l'interface (Français, Anglais, Espagnol)

Menu déroulant pour changer la langue. La modification est immédiate.

#### 17.4.3. Pied de page personnalisé

Ajoutez un **texte de pied de page** affiché dans toute l'application et dans les exports.

#### 17.4.4. Devise et format de nombres

- **Devise** : EUR, USD, GBP, CHF, etc.
- **Séparateur décimal** : virgule ou point
- **Séparateur de milliers** : espace, virgule ou point

#### 17.4.5. Section Ressources — Exclure les week-ends du calcul des coûts

Case à cocher **« Exclure les week-ends du calcul des coûts »** (activée par défaut). Voir 8.4.3.

### 17.5. Onglet Synchro

#### 17.5.1. Connexion Google Drive / OneDrive

Boutons de connexion pour les sauvegardes cloud (voir section 15).

#### 17.5.2. Importer / Exporter la configuration

Sauvegardez vos **réglages** (couleurs, langue, devise, etc.) dans un fichier JSON, ou importez une configuration existante.

#### 17.5.3. Réinitialiser les paramètres par défaut

Bouton **« Réinitialiser »** pour revenir aux réglages d'origine. Confirmation requise.

### 17.6. Onglet Aide

#### 17.6.1. Lancer le guide de démarrage

Relance l'**onboarding** présenté à la première connexion.

#### 17.6.2. Afficher les raccourcis clavier

Ouvre une fiche récapitulative des raccourcis (voir aussi Annexe A).

#### 17.6.3. Contacter le support

Ouvre une page de contact ou un mailto vers `support@gantly.app`.

#### 17.6.4. Nouveautés et journal des modifications

Affiche le **changelog** complet (voir Annexe E).

### 17.7. Boutons Enregistrer et Annuler (pied du panneau)

En bas du panneau Réglages :

- **Enregistrer** : applique et persiste les modifications
- **Annuler** : ferme sans enregistrer

---

## 18. Thème sombre / clair

### 18.1. Basculer entre les modes (Ctrl+D)

Trois façons :

- Raccourci **`Ctrl+D`**
- Bouton dans la barre d'outils
- Bascule dans **Réglages > Apparence**

### 18.2. Détection automatique des préférences système

Au premier lancement, Gantly détecte la préférence **« mode sombre »** définie dans votre système d'exploitation (`prefers-color-scheme: dark`) et s'aligne automatiquement.

---

## 19. Internationalisation (i18n)

### 19.1. Langues disponibles : Français, Anglais, Espagnol

L'interface est traduite intégralement dans :

- 🇫🇷 Français (par défaut)
- 🇬🇧 Anglais
- 🇪🇸 Espagnol

### 19.2. Changer la langue depuis les Réglages > Général

Voir 17.4.2.

### 19.3. Dates et formats adaptés à la locale

Selon la langue choisie, les **formats de date** et les **séparateurs numériques** s'adaptent automatiquement (ex : `01/04/2026` en français vs `04/01/2026` en anglais US).

---

## 20. Annuler / Rétablir (Undo / Redo)

### 20.1. Annuler une action (Ctrl+Z)

Toutes les actions sont enregistrées dans une **pile d'historique**. Appuyez sur **`Ctrl+Z`** pour revenir à l'état précédent (création, modification, suppression de tâche, etc.).

La pile contient les **50 dernières actions**.

### 20.2. Rétablir une action (Ctrl+Y)

**`Ctrl+Y`** (ou `Ctrl+Maj+Z`) pour rétablir une action annulée. Si vous effectuez une nouvelle action après une annulation, les actions « rétablissables » sont effacées.

---

## 21. Raccourcis clavier

### 21.1. Liste complète des raccourcis

Voir **Annexe A**.

### 21.2. Aide raccourcis clavier (touche ?)

Appuyez sur **`?`** à n'importe quel moment pour ouvrir une popup avec la liste complète des raccourcis disponibles dans le contexte courant.

---

## 22. Accessibilité

### 22.1. Navigation au clavier

Toutes les fonctionnalités sont accessibles **sans souris** :

- **`Tab`** : élément suivant
- **`Maj+Tab`** : élément précédent
- **`Entrée`** ou **`Espace`** : activer
- **`Échap`** : fermer une modale ou un menu
- **Flèches** : navigation dans les menus et listes

### 22.2. Lecteurs d'écran (ARIA)

L'application utilise des attributs **ARIA** (`role`, `aria-label`, `aria-live`, etc.) pour être correctement interprétée par les lecteurs d'écran (NVDA, JAWS, VoiceOver).

### 22.3. Cibles tactiles (WCAG 2.1 AA)

Tous les boutons et liens ont une **taille minimum de 44×44 px** sur mobile, conforme aux directives **WCAG 2.1 AA**.

---

## 23. Stockage des données

### 23.1. Stockage local (localStorage)

Les **préférences UI** (thème, langue, vue active, niveau de zoom) sont stockées dans le `localStorage` du navigateur. Elles sont rechargées automatiquement à la connexion.

### 23.2. Synchronisation Supabase (cloud)

Les **données métier** (projets, tâches, ressources, baselines, historique) sont stockées dans la base **Supabase** chiffrée et accessible depuis n'importe quel appareil.

### 23.3. Persistance automatique

Aucune action de sauvegarde manuelle n'est requise. Chaque modification est synchronisée immédiatement.

### 23.4. Sauvegarde et restauration

En complément, vous pouvez **sauvegarder manuellement** vos données via :

- Export JSON (section 14.1.1)
- Sauvegarde Google Drive / OneDrive (section 15)

Les **politiques de rétention** côté serveur :

- Notifications : conservées 90 jours
- Invitations expirées : 7 jours
- Historique des projets : 7 jours
- Comptes inactifs (gratuit) : purgés après 24 mois d'inactivité

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
