# Tests End-to-End (Playwright) — Lot 5

Ces tests pilotent un vrai navigateur (Chromium headless) : clics, formulaires,
glisser-déposer du Gantt, rendu réel — ce que les tests unitaires (jsdom) ne
peuvent pas vérifier.

## Prérequis

L'application exige une session Supabase valide dès l'ouverture (pas de mode
hors-ligne). Les tests utilisent un compte dédié, séparé des comptes réels.

## Installation locale

```bash
npm install
npx playwright install --with-deps chromium   # une seule fois
cp .env.example .env                          # puis renseigner les identifiants
export $(cat .env | xargs)                    # ou utiliser dotenv-cli
npm run test:e2e
```

- `npm run test:e2e:ui` — mode interactif (pas à pas, inspection DOM)
- `npm run test:e2e:report` — rouvrir le dernier rapport HTML

## Comment ça marche

- `e2e/server/static-server.js` sert le dépôt sous `/Gantt-Planner-V2/`, pour
  reproduire la structure de sous-répertoire de GitHub Pages (là où le bug du
  lien d'invitation cassé s'était produit).
- `e2e/auth.setup.js` se connecte une fois via le formulaire et sauvegarde la
  session (`e2e/.auth/user.json`, non commité) ; les autres tests démarrent
  déjà connectés.
- Chaque test qui crée un projet le supprime en fin de test.

## Écrire un nouveau scénario

`docs/TEST_PLAN.md` décrit les parcours en langage courant — un scénario par
fichier dans `e2e/tests/*.spec.js` en s'appuyant sur les helpers de
`e2e/helpers.js`.

## CI (GitHub Actions)

`.github/workflows/e2e.yml` lance ces tests à chaque push/PR. Il faut
configurer deux secrets du dépôt (Settings → Secrets and variables → Actions) :

- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
