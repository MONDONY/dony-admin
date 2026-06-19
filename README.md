# dony ADMIN

Back-office web réservé aux administrateurs dony (`ROLE_ADMIN`).

## Stack
- Nuxt 4 (SSR) + TypeScript + TailwindCSS + shadcn-vue
- Firebase Phone Auth (token JWT en mémoire — pas de localStorage)
- Backend : Spring Boot existant (`dony-back/`), endpoints `/admin/**`

## Setup
```bash
pnpm install
cp .env.example .env   # remplir Firebase (même projet que dony_app/)
pnpm dev
```

## Tests
```bash
pnpm test:coverage   # gate 90%
pnpm e2e
```

## Modules (P0 = placeholders)
Vue d'ensemble · Utilisateurs · Transactions · Colis · Incidents · Alertes · Modération · Codes promo · Audit · Exports · Signalements
