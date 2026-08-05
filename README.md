# dony ADMIN

Back-office web réservé aux administrateurs dony (`SUPER_ADMIN`, `ADMIN`, `SUPPORT`).

## Stack
- Nuxt 4 (SSR) + TypeScript + TailwindCSS + shadcn-vue
- Firebase Email/Password Auth (ID token en mémoire — jamais persisté en `localStorage`)
- Backend : Spring Boot existant (`dony-back/`), endpoints `/admin/**` — source de vérité pour le rôle, le statut et `mustChangePassword`

## Setup
```bash
pnpm install
cp .env.example .env   # remplir les 4 variables Firebase + NUXT_PUBLIC_API_BASE_URL (même projet Firebase que dony_app/ et dony-pro/)
pnpm dev
```

`.env.example` liste les 4 variables Firebase requises (`NUXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`) plus `NUXT_PUBLIC_API_BASE_URL`. Toutes publiques — aucune n'est un secret.

## Authentification

La connexion se fait par **email** (pas de compte de démo). Le premier compte
`SUPER_ADMIN` est provisionné côté backend via un bootstrap one-shot — voir
`dony-back/docs/admin-auth-bootstrap.md` pour la procédure complète. Ce
dépôt ne contient et n'affiche jamais d'identifiant temporaire ; les
identifiants générés par `/administrateurs` ne sont montrés qu'une seule
fois, dans le navigateur de la personne qui les crée.

## Tests
```bash
pnpm test:coverage   # gate 90%
pnpm e2e
```

## Modules (P0 = placeholders)
Vue d'ensemble · Utilisateurs · Transactions · Colis · Incidents · Alertes · Modération · Codes promo · Audit · Exports · Signalements
