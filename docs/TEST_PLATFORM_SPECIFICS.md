# Guide Spécifique des Plateformes et Navigateurs
**Gantt Planner Pro v2.0**

---

## 🪟 Windows (10/11)

### Chrome / Edge
**Version minimale** : v120+

#### Checklist Windows-spécifique
- [ ] Ctrl+Z fonctionne correctement
- [ ] Ctrl+Shift+Z rétablit
- [ ] Fenêtres de dialogue bien dimensionnées
- [ ] Texte sélectionnable dans les tâches
- [ ] Clic droit menu contextuel disponible
- [ ] Raccourcis clavier Windows intégrés
- [ ] Alt+Tab correct
- [ ] Thème Windows clair/sombre synchronisé
- [ ] HiDPI scaling fonctionnel (sur moniteurs 4K)
- [ ] Copier-coller via Ctrl+C/V
- [ ] Zoom navigateur (Ctrl+/-) respecté

#### Problèmes connus à tester
- [ ] Performance initiale (peut être lente sur systèmes vieux)
- [ ] Polices par défaut vs polices système
- [ ] Couleurs des éléments formés

---

### Firefox Windows
**Version minimale** : v120+

#### Checklist Firefox-spécifique
- [ ] WebGL activé (pour les graphiques)
- [ ] Autoplay bloqué (ne pas déranger)
- [ ] LocalStorage fonctionnel
- [ ] Devtools accessibles
- [ ] File picker fonctionnel pour import
- [ ] Zoom de texte fonctionnel
- [ ] Souris : scroll horizontal fonctionne
- [ ] Tab groupes ne causent pas de bug

---

## 🍎 macOS (Intel & Apple Silicon)

### Safari
**Version minimale** : v17+

#### Particularités Safari macOS
- [ ] Cmd+Z annule
- [ ] Cmd+Shift+Z rétablit
- [ ] Cmd+D basculement mode sombre
- [ ] Cmd+F recherche
- [ ] Safari Reader mode n'affecte pas l'app
- [ ] Touch Bar compatible
- [ ] Magic Trackpad fonctionnel
- [ ] Cmd+Tab fonctionne
- [ ] Gestion du focus correct
- [ ] LocalStorage activé (vérifier paramètres privacy)
- [ ] WebGL activé

#### Gotchas Safari
- [ ] IndexedDB limité (utiliser localStorage à la place)
- [ ] Date picker peut avoir un style différent
- [ ] Les animations peuvent être plus lentes
- [ ] Copy-paste dans modales peut être bugué
- [ ] Permissions Google Drive peuvent être bloquées
- [ ] Drag-drop peut nécessiter des ajustements

#### À vérifier précisément
```
1. Ouverture de Gantt Planner
2. Vérifier Console (Cmd+Opt+I)
3. Aucune erreur de sécurité (Blocked by CORS, etc.)
4. Drag-drop une barre : liste de vérifications
   - Barre se déplace-t-elle ?
   - Les dépendances sont-elles respectées ?
   - Les dates sont-elles correctes ?
5. Google Drive: permissions demandées ?
```

---

### Chrome / Edge macOS
**Version minimale** : v120+

#### Checklist Chrome/Edge macOS
- [ ] Cmd+Z annule
- [ ] Cmd+Shift+Z rétablit
- [ ] Cmd+D dark mode
- [ ] Cmd+F search
- [ ] TrackPad pinch-zoom fonctionne
- [ ] Gestion de la batterie (performance optimale)
- [ ] Présentation/Présentation d'écran compatible
- [ ] Notifications pushées (opt-in)

#### Apple Silicon spécifique (M1, M2, M3)
- [ ] Performance de glisser-déposer optimale
- [ ] Pas de "rosetta emulation" issues
- [ ] WebGL avec GPU natif fonctionne
- [ ] Zoom/pinch fluide
- [ ] Pas de lag lors d'édition simultanée

---

### Firefox macOS
**Version minimale** : v120+

#### Checklist Firefox macOS
- [ ] WebGL + GPU acceleration
- [ ] Cmd+Shift+Delete efface cache
- [ ] Profiles compatibles
- [ ] Copie depuis Gantt sans décallage
- [ ] Drag-drop de fichiers pour import
- [ ] Picture-in-picture compatible

---

## 📱 iOS / iPadOS

### Safari iOS/iPadOS
**Version minimale** : iOS 15+

#### Spécificités Touch
- [ ] Tapotement sélectionne tâche
- [ ] Long-press affiche menu contextuel
- [ ] Drag-drop barre se déplace
- [ ] Pinch-zoom dans le Gantt
- [ ] Deux-doigts glissement scroll horizontal
- [ ] Double-tap pour édition

#### Orientation
| Portrait | Paysage |
|----------|---------|
| Gantt condensé | Gantt complet |
| Tableau scrollable | Tableau fluide |
| 1 colonne visible | 2-3 colonnes |

#### Responsive design
- [ ] iPhone 12/13/14/15 (375px) adapté
- [ ] iPhone Max (430px) adapté
- [ ] iPad Standard (768px) adapté
- [ ] iPad Pro (1024px) adapté
- [ ] Rotation portrait ↔ paysage sans bug

#### Performance
- [ ] Pas de lag au scroll
- [ ] Pinch-zoom fluide (60 FPS)
- [ ] Glisser-déposer responsif
- [ ] Pas de freeze lors d'édition

#### Accès réseau
- [ ] Google Drive authentification via OAuth
- [ ] Upload/Download des fichiers
- [ ] Sync en arrière-plan
- [ ] Gestion du WiFi/LTE

#### Batterie/Chaleur
- [ ] Pas de surchauffe (>5min d'utilisation)
- [ ] Consommation batterie normale

#### Claviers
- [ ] Clavier virtuel n'obstrue pas le contenu
- [ ] Entrée confirme (si applicable)
- [ ] Tabulation nav-click disponible
- [ ] Cmd-C/V fonctionne via Magic Keyboard

#### Sécurité
- [ ] Face ID / Touch ID respecté
- [ ] Permissions LocalStorage OK
- [ ] Pas d'avertissements de sécurité

---

## 🤖 Android

### Chrome Android
**Version minimale** : v120+

#### Spécificités Touch
- [ ] Tapotement sélectionne tâche
- [ ] Long-press menu contextuel
- [ ] Drag-drop se déplace
- [ ] Pinch-zoom fonctionne
- [ ] Back button ne quitte pas l'app

#### Appareils testés
- [ ] Téléphone standard (360x720)
- [ ] Téléphone large (412x915)
- [ ] Tablette (600x960)

#### Performance
- [ ] Pas de jank au scroll
- [ ] Animations fluides
- [ ] Pas de crashes

#### Réseau
- [ ] Google Drive import/export
- [ ] Connexion 4G stable
- [ ] Reprise après connexion perdue

#### Permissions
- [ ] Stockage (fichiers import/export)
- [ ] Caméra (si upload photo)
- [ ] Contacts (ressources)

---

### Firefox Android
**Version minimale** : v120+

#### Checklist Firefox Android
- [ ] LocalStorage fonctionnel
- [ ] Zoom fluide
- [ ] Touche de menu (3 points)
- [ ] Orientation portrait/paysage OK
- [ ] Google Drive intégration

---

## 🖥️ Résolutions d'écran critiques

### Desktop
```
1920x1080 (Full HD)    ✅ Cible prioritaire
1600x900  (16:9)       ✅ Common laptop
1440x900  (16:10)      ✅ MacBook Air
1366x768  (16:9)       ✅ Budget laptop
1280x720  (720p)       ⚠️ Minimal
2560x1440 (QHD)        ✅ Gamers/Professionals
3840x2160 (4K)         ✅ High-end
```

### Tablet
```
1024x1366 (iPad)           ✅ Standard
768x1024  (iPad, portrait) ✅ Standard
810x1080  (Larger tablet)  ✅
600x960   (Android tablet) ✅
```

### Mobile
```
390x844   (iPhone 12-14)   ✅ Prioritaire
430x932   (iPhone 14+)     ✅ Prioritaire
375x812   (iPhone X-13)    ✅
360x720   (Android standard) ✅
412x915   (Galaxy standard)  ✅
```

---

## 🌍 Profils réseau

### Test sur connexions lentes

#### 4G LTE (connexion commune mobile)
```bash
# Simule 4G LTE
Chrome DevTools > Network > Throttling > "4G LTE"
Mesurer :
  - Temps chargement initial
  - Lag sur drag-drop
  - Upload Google Drive
```

**Cibles** :
- Page chargée en < 5 secondes
- Interactions réactives (< 500ms)

#### 3G (réseau dégradé)
```bash
Chrome DevTools > Network > Throttling > "Slow 3G"
```

**Cibles** :
- Page chargée en < 10 secondes
- Aucun timeout
- Pas de données perdues

#### Offline (mode avion)
```bash
Chrome DevTools > Network > Offline
```

**À vérifier** :
- [ ] Page reste fonctionnelle (localStorage)
- [ ] Données locales accessibles
- [ ] Message "Connexion perdue" affiché
- [ ] Sync au retour de connexion

---

## 🧪 Checklist par Plateforme

### Windows
**Durée estimée** : 2-3 heures par navigateur

```
Préalable:
- [ ] Windows 10 ou 11 (dernière version)
- [ ] Chrome/Edge/Firefox à jour
- [ ] Connexion internet stable
- [ ] Résolutions : 1920x1080, 1366x768

Étapes:
- [ ] Charger Gantt Planner
- [ ] Créer projet test
- [ ] Tester toutes les 20 fonctionnalités clés
- [ ] Tester 10 interactions Gantt
- [ ] Vérifier raccourcis clavier
- [ ] Tester import/export
- [ ] Vérifier mode sombre/clair
- [ ] Tester Google Drive
- [ ] Signaler tout bug

Notes spécifiques:
__________________________________________________________
__________________________________________________________
```

### macOS (Intel)
**Durée estimée** : 2-3 heures par navigateur

```
Préalable:
- [ ] macOS 13+ (Big Sur ou plus récent)
- [ ] Safari/Chrome/Firefox à jour
- [ ] Connexion internet stable
- [ ] Résolutions : 1440x900, 1920x1080

Étapes:
- [ ] Charger Gantt Planner
- [ ] Créer projet test
- [ ] Tester Cmd+Z annulation
- [ ] Tester drag-drop sur barre
- [ ] Tester Magic Trackpad
- [ ] Vérifier performances
- [ ] Tester Google Drive
- [ ] Signaler tout bug

Notes spécifiques:
__________________________________________________________
__________________________________________________________
```

### macOS (Apple Silicon)
**Durée estimée** : 1-2 heures

```
Préalable:
- [ ] macOS 13+ avec Apple Silicon (M1+)
- [ ] Safari/Chrome/Firefox à jour
- [ ] Connexion internet stable

Étapes:
- [ ] Vérifier GPU performance
- [ ] Tester zoom/pinch fluide
- [ ] Vérifier aucun lag
- [ ] Tester interactions rapides

Notes spécifiques:
__________________________________________________________
__________________________________________________________
```

### iOS/iPadOS
**Durée estimée** : 1-2 heures par appareil

```
Préalable:
- [ ] iPhone/iPad avec iOS 15+
- [ ] Safari à jour
- [ ] Connexion WiFi stable
- [ ] Test 4G si possible

Étapes:
- [ ] Charger Gantt Planner
- [ ] Tester tapotement (selection)
- [ ] Tester long-press (menu)
- [ ] Tester drag-drop (déplacer tâche)
- [ ] Tester pinch-zoom
- [ ] Tester rotation écran
- [ ] Tester import/export
- [ ] Tester Google Drive
- [ ] Signaler tout bug

Orientations testées:
- [ ] Portrait
- [ ] Paysage

Notes spécifiques:
__________________________________________________________
__________________________________________________________
```

### Android
**Durée estimée** : 1-2 heures

```
Préalable:
- [ ] Téléphone/Tablette Android 10+
- [ ] Chrome à jour
- [ ] Connexion WiFi + 4G

Étapes:
- [ ] Charger Gantt Planner
- [ ] Tester interactions touch
- [ ] Tester drag-drop
- [ ] Tester pinch-zoom
- [ ] Tester import/export
- [ ] Tester Google Drive
- [ ] Tester sans connexion
- [ ] Vérifier batterie (pas de drain)

Configurations testées:
- [ ] Téléphone standard
- [ ] Téléphone large (6.5"+)
- [ ] Tablette

Notes spécifiques:
__________________________________________________________
__________________________________________________________
```

---

## 🔍 Points critiques à vérifier

### Tous les navigateurs
- [ ] Aucune erreur dans Console
- [ ] LocalStorage fonctionnel (F12 > Application)
- [ ] Pas de warning CORS
- [ ] Pas de memory leak (DevTools Memory tab)
- [ ] Zoom navigateur (110%, 125%) fonctionnel

### Interaction Gantt
- [ ] Drag-drop barre se déplace sans lag
- [ ] Dépendances respectées après déplacement
- [ ] Redimensionnement barre responsive
- [ ] Infobulle apparaît sur hover
- [ ] Zoom change granularité correctement

### Formulaires
- [ ] Modal apparaît centrée
- [ ] Date picker compatible
- [ ] Validation affichée correctement
- [ ] Boutons accessibles au clavier
- [ ] Champs sélectionnables avec Tab

### Import/Export
- [ ] Fichier généré valide
- [ ] Dates préservées
- [ ] Dépendances exportées/importées
- [ ] Aucun corruption de données

---

## 📊 Template Résumé Test

```
RÉSUMÉ DE TEST - Gantt Planner Pro v2.0

Plateforme    : ____________________
Navigateur    : ____________________
Résolution    : ____________________
Date          : ____________________
Durée         : ____ minutes

RÉSULTATS
✅ Passé      : ____ tests
⚠️  Avertissement : ____ tests
❌ Échoué     : ____ tests

BUGS CRITIQUES
1. ______________________________________
2. ______________________________________

BUGS MAJEURS
1. ______________________________________
2. ______________________________________

OBSERVATIONS
__________________________________________________________
__________________________________________________________

VERDICT
[ ] ✅ Production-Ready
[ ] ⚠️  Production avec réserves
[ ] ❌ Blocker - Ne pas déployer

Testeur: ________________    Signature: ______________
```

---

## 🚀 Procédure de Lancement Production

**Une fois tous les tests passés:**

1. [ ] Tous les bugs critiques corrigés
2. [ ] Tous les bugs majeurs adressés
3. [ ] Performance acceptable sur toutes plateformes
4. [ ] Accessibilité WCAG 2.1 AA vérifiée
5. [ ] Manuel utilisateur à jour
6. [ ] Versioning en place (v2.0.0)
7. [ ] Release notes rédigées
8. [ ] Notification utilisateurs prévue

---

**Document créé** : Mars 2026
**Dernière mise à jour** : Mars 2026

