# Réorganisation de la page Colis, partie admin : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réorganiser `/colis` : vues rapides avec nombres et alertes, recherche à suggestions, tableau enrichi, tiroir rangé en cinq onglets, photos par étape avec visionneuse.

**Architecture:** On garde la page `app/pages/colis/index.vue` (barre Colis · Annonces · Demandes, liens entrants) et on réécrit l'onglet Colis et le tiroir `BidDetailPanel` en coquille + sous-composants dans `app/features/bids/`. Les endpoints neufs (`counts`, `suggest`, `photos`) sont optionnels : chacun qui répond 404/405 sans `code` désactive seulement sa fonction (repli). `components/ui/PhotoViewer.vue` est étendu (zoom, navigation, téléchargement) sans casser ses usages actuels.

**Tech Stack:** Nuxt 4 + Vue 3 (`<script setup lang="ts">`), Pinia, TailwindCSS, lucide-vue-next, Vitest + happy-dom + @vue/test-utils, Playwright (e2e avec `page.route`).

**Spec:** `docs/superpowers/specs/2026-10-23-colis-reorganisation-design.md` (lire en premier ; en cas de conflit avec ce plan, le spec gagne). Plan backend jumeau : `docs/superpowers/plans/2026-10-23-colis-reorganisation-backend.md` : **son « Contrat d'API » est la source de vérité des formes de réponse**. Maquette : https://claude.ai/artifact/XjPUyVwDKSRcKDe9q9Zx3b (source : `dony/tmp/colis-maquette/project/`).

Travail dans `dony-admin`, worktree `dony-admin-worktrees/colis-reorganisation` (branche `feature/colis-reorganisation`, créée depuis `origin/main` `779df15`). Chemins relatifs à ce worktree. Commandes : `pnpm vitest run <fichier>`, `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm e2e <fichier> --reporter=line`. Avant toute interface : lire `~/.agents/skills/make-interfaces-feel-better/SKILL.md` (consigne du projet pour le travail UI).

## Global Constraints

- Jamais de commit sur `main`. Chaque commit se termine par `Claude-Session: https://claude.ai/code/session_01Ab8Dd9TaHrGuJbHPnaxbdb`. Pas de `Co-Authored-By`.
- PR jumelle : la PR admin cite la PR backend et se fusionne après elle. L'admin tolère l'ancien backend : champ absent (`undefined`) = ancien backend, `null` = non autorisé, jamais « 0 » ni « vide » affiché à la place d'un champ non reçu. Un endpoint neuf qui répond 404/405 sans `code` (`isEndpointMissing` de `@/lib/endpointMissing`) désactive sa fonction : `counts` → pas d'onglets de vue (l'onglet Colis garde le filtre de statut et l'ancienne liste), `suggest` → pas de suggestions (recherche à Entrée), `photos` → la galerie utilise `bid.photoUrls` et les photos de la chronologie.
- Jackson `NON_NULL` : le backend omet les champs null. Normaliser une fois dans `bidsAdminService`, tester `== null` ensuite. Les fixtures de tests omettent les clés au lieu de mettre `null`.
- Montants : `formatMajorAmount(amount, currency)` pour `netEur` (unités principales), `formatMoney(cents, currency)` pour `amountCents`. Jamais de somme entre devises.
- Dates : jours calendaires avec `formatDay` (UTC) ; instants du serveur avec `parseServerDate` (`@/lib/serverDate`) puis affichage Europe/Paris dans la frise et la galerie (réutiliser `@/features/user-profile/lib/formatInstant` pour les ISO avec `Z`).
- Droits : `auth.can('BID_VIEW' | 'PAYMENT_VIEW' | 'DISPUTE_VIEW' | 'MODERATION_VIEW' | 'USER_VIEW' | 'SUPPORT_TICKET_MANAGE' | 'ADMIN_MANAGE')` ; jamais le rôle. Aucune permission nouvelle (`permissionCoverage.spec.ts` ne change pas ; ce test est rouge en local si le checkout `dony-back` voisin est périmé, vert en CI : ne pas le « corriger »).
- Textes en français avec accents, sans tiret cadratin, sans dégradé (couleurs unies), `tabular-nums` sur les chiffres alignés, cibles tactiles ≥ 40 px (`min-h-10`), focus visible, `aria-label` sur les boutons icône.
- Liens entrants à conserver tels quels : `/colis?open=<id>`, `/colis?tab=announcements&announcement=<id>`, `/colis?tab=demandes&open=<id>`, `/colis?announcementId=<id>`. Ids validés par `uuidParam` avant tout appel.
- Liens sortants : personnes → `/users/<id>` (nouvelle fiche) et non plus `/users?query=…&open=…` ; paiement → `/transactions?open=<paymentId>` ; litige → `/incidents?open=<id>` ; no-show → `/incidents?tab=noshows&open=<id>` ; conversation → `/moderation?open=<conversationId>`.
- Composants à réutiliser : `TabBar` (props `tabs`, `modelValue`, `ariaLabel`, `variant`, `testPrefix`, `idPrefix`), `StatusBadge`, `StateBlock`, `PaginationControls`, `useUrlFilters`/`urlFilters.ts`, `useEscapeClose`, `safeHttpsUrl`, `bidLabels.ts`, `bidStatus.ts`. Aucun composant Drawer générique n'existe : ne pas en créer un, garder le motif `fixed inset-0 z-40 … aside` du tiroir actuel.
- Séquençage des chargements : tout chargement asynchrone porte un compteur de séquence (motif `useUserSection` : `const my = ++seq` … `if (my !== seq) return`) pour qu'une réponse périmée ne remplace pas une récente.
- La couverture exclut `app/pages/**` et `app/components/ui/**` : mettre la logique dans `features/bids/{lib,composables,components}`. Seuil 90 % (lignes, fonctions, branches, instructions) sur le reste. `PhotoViewer` (ui) est exclu de la couverture mais **testé quand même**.
- Tests Nuxt : `vi.stubGlobal('definePageMeta', vi.fn())`, `useRoute`, `useRouter` ; mock du service avec `vi.hoisted` + `vi.mock('@/features/bids/services/bidsAdminService', …)` ; `seedAuth(role, overrides)` de `~/tests/helpers/auth`. E2E : `page.addInitScript` avec `window.__yadonyAuthSeed`, un seul handler `page.route('**/api/v1/admin/bids**', …)` qui branche sur l'URL.
- `data-test` : conserver ceux qui existent (`bid-detail`, `bid-tracking`, `bid-status`, `section-*`, `action-*`, `bid-row-<id>`, `chip-status-*` n'existe plus, voir Task 4) ; tout nouveau suit `famille-nom`.

## Contrat de l'interface (types partagés, définis Task 1)

```
BidView = 'ALL' | 'TODO' | 'ACTIVE' | 'RECENT' | 'COMPLETED' | 'CLOSED'
BidSearchScope = 'ALL' | 'TRACKING' | 'SENDER' | 'TRAVELER' | 'RECIPIENT' | 'TRIP'
BidAlertCode = 'DISPUTE_OPEN' | 'NO_SHOW' | 'PAYMENT_PENDING' | 'LATE'
PhotoStage = 'CREATION' | 'DEPART' | 'TRANSIT' | 'ARRIVEE' | 'REFUSAL' | 'DISPUTE'
```
Les formes de réponse (`counts`, `suggest`, `photos`, `incidents`, nouveaux champs de la liste) sont celles du plan backend.

## Review Focus

1. Backend ancien : aucun écran n'affiche « 0 » ou « Aucun » à la place d'une donnée non reçue ; la page reste utilisable.
2. Un lien entrant `/colis?announcementId=<id>` ou `?status=…` affiche les colis (vue « Tous »), pas une vue « À traiter » vide ; `/colis?open=<id>` ouvre le tiroir sans toucher aux filtres.
3. Réponses périmées : taper vite dans la recherche, changer de vue, ouvrir deux colis de suite : seule la dernière réponse s'affiche.
4. Le raccourci global `/` (palette ⌘K) n'est pas détourné ; Échap ferme d'abord la visionneuse, puis le tiroir.
5. Photo expirée ou purgée : jamais une image cassée silencieuse (état d'erreur avec « Recharger »).
6. Un clic sur le nom d'une personne dans le tableau n'ouvre pas aussi le tiroir.
7. Les permissions retirées masquent l'onglet, pas seulement son contenu (Échanges sans `MODERATION_VIEW`, Incidents sans `DISPUTE_VIEW`).
8. Gestes « Annuler le colis » et « Ouvrir un litige » : mêmes garde-fous, mêmes textes, mêmes `data-test` qu'avant, juste déplacés dans le menu « Actions ».

---

### Task 1: Types et service

**Files:**
- Modify: `app/features/bids/types/index.ts`, `app/features/bids/services/bidsAdminService.ts`
- Test: `tests/unit/features/bids/bidsAdminService.spec.ts` (compléter)

**Interfaces:**
- Produces (types) : `BidView`, `BidSearchScope`, `BidAlertCode`, `PhotoStage` (ci-dessus) ; `AdminBidListItem` gagne `senderId?: string | null`, `travelerId?: string | null`, `recipientName?: string | null`, `departureDate?: string | null`, `updatedAt?: string | null`, `alert?: BidAlertCode | null` ; `AdminBidDetail` gagne `incidents?: AdminBidIncidents | null` et `alert?: BidAlertCode | null` ; `BidsFilterState` devient `{ status: BidStatusFilter; announcementId: string | null; query: string; scope: BidSearchScope; view: BidView; paymentMethod: string | null; content: string; alert: BidAlertCode | null; dateFrom: string | null; dateTo: string | null }`. Nouveaux : `AdminBidCounts { todo; active; recent; completed; closed; all; alerts: { disputeOpen; noShow; paymentPending; late } }`, `AdminBidSuggest { senders: SuggestPerson[]; travelers: SuggestPerson[]; recipients: { name; count }[]; trips: { label; departureCity; arrivalCity; count }[]; parcels: { bidId; trackingNumber; status; content }[] }`, `AdminBidPhoto { id; stage: PhotoStage; label; at; url; gpsLabel? }`, `AdminBidPhotos { bidId; photos: AdminBidPhoto[] }`, `AdminBidIncidents { disputes: …[]; cancellations: …[] }` (champs du contrat backend).
- Produces (service) : `bidsAdminService.listBids(filters, page, size)` envoie `view` (sauf `ALL`), `scope` (sauf `ALL`), `paymentMethod`, `content` (trim, si non vide), `alert`, en plus des paramètres existants ; `counts(filters): Promise<AdminBidCounts>` (`GET /admin/bids/counts`, mêmes filtres sauf view/status/alert) ; `suggest(q: string): Promise<AdminBidSuggest>` ; `photos(id: string): Promise<AdminBidPhotos>` (`isUuid` validé comme `getBid`). Chaque réponse est normalisée : listes absentes → `[]` pour `suggest`/`photos`, `alerts` absent → zéros pour `counts`.

- [ ] **Step 1: Write the failing tests** : `listBids_sendsNewParams_andOmitsDefaults`, `listBids_stillSendsLegacyParams`, `counts_sendsFiltersWithoutViewStatusAlert`, `counts_normalizesMissingAlerts`, `suggest_trimsAndEncodesQuery`, `suggest_normalizesMissingGroups`, `photos_rejectsNonUuid`, `photos_normalizesMissingList`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/features/bids/bidsAdminService.spec.ts` → FAIL.
- [ ] **Step 3: Implement** types et service.
- [ ] **Step 4: Run** → PASS, puis `pnpm typecheck` : corriger les fixtures qui construisent `BidsFilterState` (`useAdminBids`, pages, tests) en ajoutant les nouveaux champs avec leurs défauts (`scope: 'ALL'`, `view: 'ALL'`, `paymentMethod: null`, `content: ''`, `alert: null`).
- [ ] **Step 5: Commit** `feat(colis): types et service pour vues, recherche, nombres et photos`.

---

### Task 2: Bibliothèques pures (vues, alertes, étapes, photos)

**Files:**
- Create: `app/features/bids/lib/bidViews.ts`, `app/features/bids/lib/bidSteps.ts`, `app/features/bids/lib/bidPhotos.ts`
- Test: `tests/unit/features/bids/bidViews.spec.ts`, `bidSteps.spec.ts`, `bidPhotos.spec.ts`

**Interfaces:**
- Produces :
  - `bidViews.ts` : `BID_VIEWS: { id: BidView; label: string; countKey: keyof AdminBidCounts }[]` dans l'ordre `TODO` « À traiter », `ACTIVE` « En cours », `RECENT` « Livrés depuis 3 jours », `COMPLETED` « Terminés », `CLOSED` « Annulés / refusés », `ALL` « Tous » ; `isBidView(v: unknown): v is BidView` ; `BID_ALERTS: Record<BidAlertCode, { label: string; shortLabel: string; tone: 'danger' | 'warning' }>` (« Litige ouvert » danger, « No-show » danger, « Paiement en attente » warning, « En retard » warning ; `shortLabel` pour l'étiquette de ligne) ; `alertMeta(code?: string | null)` (inconnu → `null`) ; `defaultViewFor(query: Record<string, unknown>): BidView` : `'TODO'` quand aucun de `view`, `status`, `query`, `announcementId`, `dateFrom`, `dateTo`, `paymentMethod`, `content`, `alert`, `scope` n'est présent, sinon `'ALL'`.
  - `bidSteps.ts` : `type BidStep = { id: 'created' | 'paid' | 'accepted' | 'handed' | 'transit' | 'delivered'; label: string; state: 'done' | 'current' | 'todo'; at?: string | null }` et `type BidStepperModel = { steps: BidStep[]; ended: { label: string; tone: 'danger' | 'neutral' } | null }` ; `bidStepper(bid: AdminBidDetail): BidStepperModel`. Règles : états terminaux (`REJECTED` « Refusé », `CANCELLED` « Annulé », `EXPIRED` « Expiré », `PARCEL_REFUSED` « Colis refusé », `NO_SHOW` « No-show ») → `ended` rempli, les étapes non atteintes restent `todo`, la dernière atteinte `done`. `AWAITING_PAYMENT` → « Créé » courant. `PENDING` → Créé fait, Payé courant si `money` absent sinon fait. `PAYMENT_ESCROWED` → Payé fait, Accepté courant. `ACCEPTED` → Accepté fait, Remis courant. `HANDED_OVER` → Remis fait, En transit courant. `IN_TRANSIT` et `ARRIVED` → En transit courant. `COMPLETED` → toutes faites (Livré avec `milestones.deliveredAt`). Dates : Créé = `createdAt`, Payé = `money.capturedAt`, Livré = `milestones.deliveredAt`.
  - `bidPhotos.ts` : `PHOTO_STAGE_LABELS: Record<PhotoStage, string>` (« Photos du colis », « Remise du colis », « En transit », « Livraison », « Refus du colis », « Preuves du litige ») ; `groupPhotos(photos: AdminBidPhoto[]): { stage: PhotoStage; label: string; photos: AdminBidPhoto[] }[]` : toujours `CREATION`, `DEPART`, `TRANSIT`, `ARRIVEE` (même vides), `REFUSAL` et `DISPUTE` seulement si non vides ; `safePhotos(photos)` ne garde que les URL `https:` (via `safeHttpsUrl`) ; `fallbackPhotos(bid: AdminBidDetail, timeline: AdminBidTimeline | null): AdminBidPhoto[]` (repli ancien backend : `bid.photoUrls` en `CREATION`, entrées de chronologie `kind === 'SCAN'` avec `photoUrl` en `DEPART`/`TRANSIT`/`ARRIVEE` d'après leur `label`).

- [ ] **Step 1: Write the failing tests** : `bidViews` : ordre et libellés, `isBidView`, `alertMeta_unknown_null`, `defaultViewFor_empty_TODO`, `defaultViewFor_announcementId_ALL`, `defaultViewFor_status_ALL`, `defaultViewFor_ignoresTabAndOpen` (une query avec seulement `open` ou `tab` donne `TODO`). `bidSteps` : un test par statut (tableau `it.each`) vérifiant la liste des états, `bidStepper_noShow_endedDanger`, `bidStepper_completed_allDone_withDates`, `bidStepper_pendingWithoutMoney_paymentCurrent`. `bidPhotos` : `groupPhotos_alwaysFourStages`, `groupPhotos_refusalOnlyIfPresent`, `groupPhotos_keepsOrderWithinStage`, `safePhotos_dropsHttpAndJavascript`, `fallbackPhotos_mapsLegacyFields`.
- [ ] **Step 2: Run** les trois fichiers → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(colis): bibliothèques de vues, d'étapes et de photos`.

---

### Task 3: Composables de liste, nombres et suggestions

**Files:**
- Modify: `app/features/bids/composables/useAdminBids.ts`
- Create: `app/features/bids/composables/useBidCounts.ts`, `app/features/bids/composables/useBidSuggestions.ts`
- Test: `tests/unit/features/bids/useAdminBids.spec.ts` (réécrire/compléter), `useBidCounts.spec.ts`, `useBidSuggestions.spec.ts`

**Interfaces:**
- Consumes : `bidsAdminService.listBids/counts/suggest`, `isEndpointMissing`, types Task 1.
- Produces :
  - `useAdminBids()` retourne, en plus de l'existant (`bids, isLoading, error, totalPages, currentPage, pageSize, filters, fetchBids, goToPage, setStatusFilter, setSearch, setDateRange, setAnnouncementFilter`) : `setView(v: BidView)`, `setScope(s: BidSearchScope)`, `setPaymentMethod(m: string | null)`, `setContent(c: string)`, `setAlert(a: BidAlertCode | null)`, `resetFilters()` (remet tout sauf `announcementId` aux défauts, `view` à `'ALL'`). `filters` est un `reactive<BidsFilterState>` initialisé aux défauts de Task 1. Garde de séquence sur `fetchBids`. Chaque setter remet `currentPage` à 0 puis recharge. `setView('TODO')` remet `status` à `'TOUS'` et `alert` à `null` ; `setStatusFilter` ne remet pas la vue.
  - `useBidCounts(filters)` : `{ counts: Ref<AdminBidCounts | null>, unavailable: Ref<boolean>, isLoading, error, reload(): Promise<void> }`. `reload` appelle `bidsAdminService.counts(filters)` avec garde de séquence ; 404/405 sans `code` → `unavailable = true`, `counts = null`, pas d'erreur ; autre échec → `error`, `counts` conservé.
  - `useBidSuggestions()` : `{ suggestions: Ref<AdminBidSuggest | null>, unavailable: Ref<boolean>, isLoading, query(q: string): void, clear(): void }`. Debounce 200 ms (`setTimeout`), minimum 2 caractères, compteur de génération qui écarte les réponses périmées (modèle `features/search/composables/useGlobalSearch.ts`), indisponible comme `useBidCounts`.

- [ ] **Step 1: Write the failing tests** : `useAdminBids` : `setView_resetsPageAndReloads`, `setView_todo_clearsStatusAndAlert`, `setters_sendFilterToService`, `resetFilters_keepsTripFilter`, `fetchBids_ignoresStaleResponse` (deux appels, le premier répond après le second), `fetchBids_error_setsMessage`. `useBidCounts` : `reload_fillsCounts`, `reload_missingEndpoint_marksUnavailable_noError`, `reload_otherError_keepsPreviousCounts`, `reload_ignoresStaleResponse`. `useBidSuggestions` (avec `vi.useFakeTimers`) : `query_debounces200ms`, `query_shorterThanTwo_clears`, `query_ignoresStaleResponse`, `query_missingEndpoint_marksUnavailable`, `clear_resets`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(colis): composables de liste, nombres et suggestions`.

---

### Task 4: Composants de l'onglet Colis

**Files:**
- Create: `app/features/bids/components/BidViewTabs.vue`, `BidAlertPills.vue`, `BidAlertBadge.vue`, `BidSearchBox.vue`
- Modify (réécriture): `app/features/bids/components/BidFilters.vue`, `BidsTable.vue`
- Test: `tests/unit/features/bids/BidViewTabs.spec.ts`, `BidAlertPills.spec.ts`, `BidAlertBadge.spec.ts`, `BidSearchBox.spec.ts`, `BidFilters.spec.ts` (réécrire), `BidsTable.spec.ts` (réécrire), `tests/components/ListTablesError.spec.ts` (adapter à `BidsTable`)

**Interfaces:**
- Consumes : `BID_VIEWS`, `BID_ALERTS`, `alertMeta` (Task 2), `TabBar` (variant `underline`, `testPrefix="bid-view"`, `idPrefix="bid-view"`, `ariaLabel="Vues des colis"`), `useBidSuggestions`.
- Produces :
  - `BidViewTabs` : props `modelValue: BidView`, `counts: AdminBidCounts | null`. Émet `update:modelValue`. Pastille de nombre via `TabItem.count` (rouge/« alerte » pour `TODO` si > 0, sinon neutre ; `TabBar` masque déjà 0, afficher 0 explicitement pour `TODO` : « Rien à traiter » est dit par la liste vide). Texte d'aide sous les onglets : « Les nombres d’« À traiter » se recoupent avec les autres vues. » seulement quand `counts` est présent.
  - `BidAlertPills` : props `modelValue: BidAlertCode | null`, `alerts: AdminBidCounts['alerts'] | null`. Émet `update:modelValue`. Quatre pastilles filtrantes avec nombre (`data-test="alert-pill-<CODE>"`), re-clic = désélection. Rien si `alerts` null.
  - `BidAlertBadge` : prop `code?: string | null`. Étiquette courte colorée (`data-test="bid-alert"`), rien si inconnu.
  - `BidSearchBox` : props `modelQuery: string`, `modelScope: BidSearchScope`, `suggestions: AdminBidSuggest | null`, `suggestionsDisabled: boolean`. Émet `update:query` (Entrée, clic sur « Chercher » ou choix d'une suggestion), `update:scope`, `type: [string]` (à chaque frappe, pour déclencher `useBidSuggestions.query`), `pick: [kind, payload]` où `kind` ∈ `sender | traveler | recipient | trip | parcel` (le parent traduit en filtre ; `parcel` = ouvrir le tiroir `bidId`). Liste déroulante groupée (rôles : « Expéditeurs », « Voyageurs », « Destinataires », « Trajets », « N° de suivi »), `role="listbox"`, navigation ↑ ↓ Entrée Échap, `aria-activedescendant`, nombre de colis par suggestion. Sélecteur de portée (boutons radio ou `<select>` accessible) : Tout, N° de suivi, Expéditeur, Voyageur, Destinataire, Trajet. Resynchronise son champ depuis `modelQuery` (`watch`), contrairement à l'ancien `BidFilters`. Pas de raccourci clavier global.
  - `BidFilters` (secondaire) : props `filters: BidsFilterState`, `viewsAvailable: boolean`. Émet `update:status`, `update:dateRange`, `update:paymentMethod`, `update:content`, `reset`. Contient : `<select>` de statut précis (13 statuts + « Tous les statuts », dont `ARRIVED` « Arrivé » et `PARCEL_REFUSED`), deux dates, `<select>` de mode de paiement (Carte, Espèces à la remise, Mobile money, Wave, Orange Money, libellés de `bidPaymentMethodLabel`), champ « Contenu », bouton « Réinitialiser » (visible si un filtre est actif). Chaque `<select>`/champ a un `<label>` ou `aria-label`. Les puces actives (filtres posés par la recherche : expéditeur, trajet, etc.) sont gérées par le parent (Task 5) via `BidActiveFilters` ci-dessous.
  - `BidActiveFilters.vue` (créer) : props `chips: { key: string; label: string }[]` ; émet `remove: [key]` et `clear`. Rien si `chips` vide. `data-test="active-chip-<key>"`.
  - `BidsTable` : props `bids`, `loading`, `error?` ; émet `select: [id]`, `retry`. Colonnes : Suivi (n° en monospace + « Créé le … »), Colis (contenu + poids), Trajet (corridor + « Départ … » via `formatDay`), Personnes (expéditeur et voyageur en `NuxtLink` vers `/users/<id>` quand l'id est connu et `auth.can('USER_VIEW')`, sinon texte ; destinataire en texte « Pour … »), Net voyageur (+ `bidPaymentMethodLabel`), Statut (`StatusBadge` + `BidAlertBadge`), Mis à jour (`formatDateTime`). Le clic sur un lien de personne n'ouvre pas le tiroir (`@click.stop`). Champs absents (ancien backend) : texte « — », colonnes conservées. `data-test` conservés : `bid-row-<id>`, `bid-net-<id>`.

- [ ] **Step 1: Write the failing tests** : une suite par composant couvrant : rendu des libellés et nombres, émissions, états vides, `BidSearchBox_keyboardNavigation` (↓ ↓ Entrée émet `pick` avec la bonne charge), `BidSearchBox_enterWithoutSelection_emitsQuery`, `BidSearchBox_scopeChange_emitsScope`, `BidSearchBox_resyncsFromProp`, `BidSearchBox_suggestionsDisabled_hidesList`, `BidViewTabs_todoZeroStillShown`, `BidAlertPills_toggleOffOnSecondClick`, `BidFilters_reset_visibleOnlyWhenActive`, `BidsTable_personLink_stopsRowClick`, `BidsTable_legacyRow_showsDashes`, `BidsTable_alertBadgeShown`, `BidsTable_linksUseUsersIdRoute`, `BidsTable_withoutUserView_noLinks`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (couleurs unies, états de survol, `active:scale-[0.96]` comme le reste du code).
- [ ] **Step 4: Run** les suites + `pnpm lint` + `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(colis): vues, alertes, recherche et tableau enrichi`.

---

### Task 5: Intégration dans la page

**Files:**
- Modify: `app/pages/colis/index.vue`
- Test: `tests/unit/pages/colis-index.spec.ts`, `colis-fiche.spec.ts`, `colis-recherche-globale.spec.ts`, `colis-url-filters.spec.ts` (adapter), nouveau `tests/unit/pages/colis-vues.spec.ts`

**Interfaces:**
- Consumes : tout ce qui précède. `useUrlFilters` avec les spécifications : `view` (défaut calculé, voir ci-dessous, autorisé : les six vues), `status` (existant), `query`, `scope` (autorisé : les six portées), `paymentMethod`, `content`, `alert` (autorisé : quatre codes), `dateFrom`, `dateTo`. `OWN_KEYS` gagne `section` (onglet du tiroir, Task 7).
- Produces (comportements de la page) :
  - Vue initiale : `defaultViewFor(route.query)` ; `urlFilters.restore()` avant le premier rendu. Les paramètres `view=ALL` etc. sont conservés dans l'URL ; le défaut n'est pas écrit.
  - L'onglet Colis rend : `BidViewTabs` (si `counts` disponible) → `BidSearchBox` → `BidAlertPills` (vue `TODO` ou `ALL`, si `counts` disponible) → `BidFilters` → `BidActiveFilters` → bandeau de focus de trajet existant (`data-test="trip-filter"`) → `BidsTable` → `PaginationControls` → tiroir. Sans `counts` (ancien backend) : pas d'onglets de vue ni de pastilles, `view` forcé à `ALL`.
  - Suggestion choisie : `sender|traveler|recipient|trip` → pose le jeton dans la requête **et** la portée correspondante (ex. expéditeur : `query = nom`, `scope = SENDER`) et ajoute une puce active retirable ; `parcel` → ouvre le tiroir de `bidId` comme `openBid`. Une recherche validée avec Entrée dont le texte est exactement un n° de suivi connu dans les suggestions affichées ouvre directement le tiroir.
  - Les nombres sont rechargés quand la recherche ou un filtre (hors vue/statut/alerte) change, et après `onBidChanged`.
  - Vue vide `TODO` : message « Rien à traiter pour l’instant. » avec un lien « Voir tous les colis » (`StateBlock` `empty-label`/`hint`).
  - Tous les liens entrants listés dans Global Constraints continuent de marcher, y compris le `watch` « page déjà ouverte » (⌘K).
  - Changement de vue ou de filtre : `closeBid` n'est pas appelé (le tiroir ouvert reste), mais `?open=` n'est pas effacé.

- [ ] **Step 1: Write the failing tests** : `colis-vues.spec.ts` : `defaultView_isTodo_withoutParams`, `defaultView_isAll_withAnnouncementIdParam`, `defaultView_isAll_withStatusParam`, `restoresViewFromUrl`, `switchingView_updatesUrlAndReloads`, `legacyBackend_countsMissing_hidesViewTabsAndPills`, `pickSender_setsScopeAndChip`, `removeChip_reloads`, `pickParcel_opensDrawer`, `exactTrackingEnter_opensDrawer`, `countsReloadAfterFilterChange`, `emptyTodo_showsNothingToDo`. Adapter les quatre specs existantes (sélecteurs `chip-status-*` disparus, nouveaux défauts de filtres, vue par défaut).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run tests/unit/pages tests/unit/features/bids` → PASS.
- [ ] **Step 5: Commit** `feat(colis): page Colis avec vues rapides, recherche et filtres dans l'URL`.

---

### Task 6: Visionneuse de photos et galerie par étape

**Files:**
- Modify: `app/components/ui/PhotoViewer.vue` (étendre sans casser l'API actuelle `urls: string[] | null`, `title`, `alt`, événement `close`, `data-test="photo-viewer"`/`photo-viewer-close`)
- Create: `app/features/bids/components/BidPhotoGallery.vue`, `app/features/bids/composables/useBidPhotos.ts`
- Test: `tests/components/PhotoViewer.spec.ts` (compléter ; vérifier d'abord les specs existantes avec `grep -rn PhotoViewer tests`), `tests/unit/features/bids/BidPhotoGallery.spec.ts`, `useBidPhotos.spec.ts`

**Interfaces:**
- Produces :
  - `PhotoViewer` accepte en plus (tous optionnels) `items?: { url: string; caption?: string; subcaption?: string }[]` (prioritaire sur `urls`), `startIndex?: number` ; émet `close` et `reload` (pour une URL expirée). Fonctions : précédent/suivant (boutons `data-test="photo-prev"`, `photo-next"`, flèches ← →, désactivés aux extrémités), zoom + / − (boutons, touches `+` `-` `0`, Ctrl+molette ; plage 50 % à 400 %, 100 % par défaut, affichage « 100 % »), déplacement dans l'image zoomée par défilement du conteneur, bande de vignettes cliquables (`data-test="photo-thumb-<i>"`), légende, lien « Ouvrir dans un onglet » (`target="_blank" rel="noopener noreferrer"`), « Télécharger » (lien `href` + `download` ; si le navigateur l'ignore, il ouvre l'image : acceptable), « Fermer ». Focus placé sur le dialogue à l'ouverture et rendu à l'élément déclencheur à la fermeture. Échap ferme **la visionneuse seulement** (`stopPropagation`) ; `useEscapeClose` du tiroir ne doit pas se déclencher en plus. Erreur de chargement d'image (`@error`) : message « Cette photo n’est plus disponible. » et bouton « Recharger » (`data-test="photo-reload"`) qui émet `reload`. Respecte `prefers-reduced-motion`.
  - `useBidPhotos(bidId)` : `{ photos: Ref<AdminBidPhoto[]>, isLoading, error, unavailable, load(): Promise<void>, reload(): Promise<void> }`. Garde de séquence ; 404/405 sans `code` → `unavailable = true` (le composant utilise `fallbackPhotos`). Ne charge qu'une fois sauf `reload`.
  - `BidPhotoGallery` : props `bid: AdminBidDetail`, `timeline: AdminBidTimeline | null`. Charge via `useBidPhotos` quand elle devient visible (montée), regroupe par `groupPhotos(safePhotos(...))`, affiche pour chaque étape un titre, la date de la première photo (`formatInstant`), le lieu (`gpsLabel`) et des vignettes 4:3 (`<img loading="lazy" alt="Photo : <étape> <n>">`, bouton plein cadre pour ouvrir la visionneuse à cette photo, `data-test="photo-<stage>-<i>"`). Étape vide : encart pointillé « Aucune photo pour cette étape » (`data-test="photos-empty-<stage>"`). Chargement : squelette ; erreur : `StateBlock` avec « Réessayer ». La visionneuse reçoit **toutes** les photos dans l'ordre des étapes pour naviguer d'un bout à l'autre, avec légende « <étape> · <date> ». `reload` de la visionneuse relance `useBidPhotos.reload()` puis rouvre au même index.

- [ ] **Step 1: Write the failing tests** : `PhotoViewer` : `legacyUrlsStillWork`, `items_override_urls`, `nextPrev_buttonsAndKeys`, `disabledAtBounds`, `zoom_buttonsKeysAndWheel_clamped`, `zoomResetOnPhotoChange`, `thumbs_selectPhoto`, `caption_shown`, `openInNewTab_hasRelNoopener`, `download_hasDownloadAttribute`, `escape_closesOnlyViewer` (le `close` du tiroir parent n'est pas appelé), `imageError_showsReload_andEmitsReload`, `focusRestored_onClose`. `useBidPhotos` : `load_once`, `reload_forces`, `missingEndpoint_unavailable`, `staleResponseIgnored`. `BidPhotoGallery` : `groupsByStage_fourFixedStages`, `emptyStage_showsPlaceholder`, `refusalAndDispute_onlyWhenPresent`, `click_opensViewerAtIndex`, `legacyBackend_usesFallbackPhotos`, `dropsNonHttpsUrls`, `reload_refetchesAndReopens`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS ; vérifier que les specs des pages qui utilisent déjà `PhotoViewer` (signalements, demandes) passent toujours : `pnpm vitest run tests/unit` filtré sur `signalements` et `package-requests`.
- [ ] **Step 5: Commit** `feat(colis): visionneuse de photos avec zoom et galerie par étape`.

---

### Task 7: Coquille du tiroir et onglet Résumé

**Files:**
- Modify (réécriture en coquille): `app/features/bids/components/BidDetailPanel.vue`
- Create: `app/features/bids/components/BidDrawerHeader.vue`, `BidAlertBanner.vue`, `BidStepper.vue`, `BidPartiesRow.vue`, `BidActionsMenu.vue`, `BidSummaryTab.vue`
- Modify: `app/features/bids/components/BidPartyCard.vue` (lien `/users/<id>`)
- Test: `tests/unit/features/bids/BidDetailPanel.spec.ts` (adapter en profondeur), `BidDetailPanelActions.spec.ts` (adapter), `BidDrawerHeader.spec.ts`, `BidAlertBanner.spec.ts`, `BidStepper.spec.ts`, `BidPartiesRow.spec.ts`, `BidActionsMenu.spec.ts`, `BidSummaryTab.spec.ts`, `BidPartyCard.spec.ts` (adapter)

**Interfaces:**
- Consumes : `bidStepper` (Task 2), `TabBar` (`variant="underline"`, `testPrefix="bid-tab"`, `idPrefix="bid-tab"`), contenu actuel de `BidDetailPanel.vue` (sections Trajet, Personnes, Colis, Identifiants, Actions), `useBidAdminActions`, `bidActions.ts`, dialogues existants.
- Produces :
  - `BidDetailPanel` (coquille) : mêmes props qu'aujourd'hui (`bid`, `timeline`, `open`, `timelineLoading?`, `timelineError?`) et mêmes événements (`close`, `show-announcement`, `show-trip-bids`, `resynced`, `changed`) + prop optionnelle `section?: BidDrawerTab` et événement `update:section`. Onglets : `type BidDrawerTab = 'summary' | 'tracking' | 'money' | 'chat' | 'incidents'` ; libellés Résumé · Suivi · Argent · Échanges · Incidents ; `chat` visible seulement si `auth.can('MODERATION_VIEW') && bid.links?.conversationId` ; `incidents` visible seulement si `bid.incidents` est défini (pastille rouge avec le nombre de litiges ouverts + annulations si > 0). Onglet actif invalide → `summary`. Structure : en-tête collant (`BidDrawerHeader`), `BidAlertBanner`, `BidStepper`, `BidPartiesRow`, `TabBar`, panneau d'onglet (`role="tabpanel"`), pied (bouton Fermer existant `data-test="bid-close"`). Le bandeau « ancien serveur » (`data-test="bid-legacy"`) et les dialogues (`BidCancelDialog`, `BidDisputeDialog`, `StartSupportConversationDialog`) restent dans la coquille. `useEscapeClose` inchangé. Le tiroir se réinitialise (onglet, dialogues, copie) au changement de `bid.id` comme aujourd'hui.
  - `BidDrawerHeader` : props `bid`, `title`, `countries`, `copied: string | null` ; émet `copy: [string]`, `close`. Contient n° de suivi + Copier (`data-test="bid-tracking"`, `bid-copy-tracking`), titre, pays, `StatusBadge` (`data-test="bid-status"`), phrase de statut (`bid-phrase`), motif de refus (`bid-refusal`) et le slot `actions` (le menu).
  - `BidAlertBanner` : prop `bid`. Affiche `bid.alert` (fourni par le backend, **jamais recalculé côté front**) avec un texte par code : `DISPUTE_OPEN` « Litige ouvert » + détail du statut du litige et lien « Voir l'incident » (`/incidents?open=<id>` si `DISPUTE_VIEW` et `links.disputeId`), `NO_SHOW` « Absence signalée » + lien no-show, `PAYMENT_PENDING` « Paiement en attente », `LATE` « Livraison en retard ». Rien si `alert` est absent (y compris ancien backend).
  - `BidStepper` : prop `bid` ; rend `bidStepper(bid)` (pastilles, libellés, dates `formatDay`/`formatInstant`, `ended` en bandeau rouge/neutre). `role="list"`, étape courante `aria-current="step"`.
  - `BidPartiesRow` : trois cartes (expéditeur, voyageur via `BidPartyCard`, destinataire reprenant le bloc `data-test="party-recipient"` et `recipient-phone` actuels) ; événement `contact` relayé.
  - `BidPartyCard` : le lien « Voir le compte » devient `{ path: `/users/${party.id}` }` (garde `USER_VIEW` conservée).
  - `BidActionsMenu` : bouton « Actions » (`data-test="bid-actions-menu"`, `aria-haspopup="menu"`, `aria-expanded`), menu `role="menu"` fermé par Échap/clic extérieur, flèches. Entrées, avec **les mêmes `data-test` qu'aujourd'hui** : Voir le paiement (`action-payment`), Voir le litige (`action-dispute`), Voir l'absence signalée (`action-noshow`), Voir la conversation (`action-conversation`), Copier les identifiants (`action-copy-ids`), Annuler le colis (`action-cancel`), Ouvrir un litige (`action-open-dispute`), avec leurs raisons de blocage affichées (`cancel-disabled-reason`, `dispute-disabled-reason`, `unavailable-*`, `actions-unavailable`), messages `action-success` / `action-error`. Les conditions de visibilité et de désactivation sont celles de `BidDetailPanel` actuel (copiées, pas réinventées). La resynchronisation Stripe quitte ce menu pour l'onglet Argent (Task 8). Chaque entrée-lien est un `NuxtLink`.
  - `BidSummaryTab` : sections Trajet (`section-trip`, contenu actuel avec boutons `trip-open-announcement`, `trip-other-bids`), Colis (`section-parcel`, sans les photos qui passent dans « Suivi »), Identifiants (`section-ids`). Contenu et `data-test` identiques à l'existant.
- Les `data-test` `section-people`, `section-money`, `section-timeline`, `section-actions` : `section-people` est porté par `BidPartiesRow`, `section-money` par l'onglet Argent, `section-timeline` par l'onglet Suivi, `section-actions` par `BidActionsMenu`.

- [ ] **Step 1: Write the failing tests** : adapter `BidDetailPanel.spec.ts` et `BidDetailPanelActions.spec.ts` (le contenu des sections existantes doit toujours se retrouver, les sélecteurs d'onglet sont nouveaux) ; nouveaux : `shell_showsFiveTabs_forAdmin`, `shell_hidesChatTab_withoutModerationView`, `shell_hidesChatTab_withoutConversationId`, `shell_hidesIncidentsTab_whenFieldAbsent`, `shell_unknownSection_fallsBackToSummary`, `shell_resetsOnBidChange`, `shell_legacyBackend_showsBanner_andStillRendersSummary`, `header_copyEmitsTracking`, `banner_disputeOpen`, `banner_noShow`, `banner_paymentPending`, `banner_late`, `banner_none_whenAlertAbsent`, `banner_disputeLink_requiresDisputeView`, `stepper_renders`, `partiesRow_recipientMasked`, `partyCard_linksToUsersId`, `menu_opensAndClosesWithEscape`, `menu_cancelDisabledReason_shown`, `menu_hidesPaymentLinkWithoutPaymentView`, `menu_dialogsOpenAndEmitChanged`, `summary_hasTripParcelIds`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** en déplaçant le code (pas de réécriture de la logique des gestes).
- [ ] **Step 4: Run** `pnpm vitest run tests/unit/features/bids` → PASS ; `pnpm lint && pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(colis): tiroir en onglets avec en-tête, étapes, personnes et menu d'actions`.

---

### Task 8: Onglets Suivi, Argent et Incidents

**Files:**
- Create: `app/features/bids/components/BidTrackingTab.vue`, `BidMoneyTab.vue`, `BidIncidentsTab.vue`
- Modify: `app/features/bids/components/BidTimeline.vue` (heure Europe/Paris, libellés inchangés), `BidDetailPanel.vue` (brancher les onglets)
- Test: `tests/unit/features/bids/BidTrackingTab.spec.ts`, `BidMoneyTab.spec.ts`, `BidIncidentsTab.spec.ts`, `BidTimeline.spec.ts` (compléter)

**Interfaces:**
- Consumes : `BidPhotoGallery` (Task 6), `BidTimeline`, `StripeResyncPanel`, contenu actuel de la section Argent, `disputeStatusLabel`, `bidStatusMeta`.
- Produces :
  - `BidTrackingTab` : `data-test="section-timeline"` ; haut : `BidPhotoGallery` ; bas : `BidTimeline` (chronologie complète, props actuelles `timeline`, `loading`, `error`). Photos en miniature dans la chronologie : inchangé tant que la galerie montre aussi ces photos (une seule ouverture de visionneuse par photo : pas de doublon cliquable dans la chronologie ; la chronologie affiche une pastille « Photo » sans image quand la galerie est active).
  - `BidMoneyTab` : `data-test="section-money"` ; contenu actuel de la section Argent (mêmes `data-test` : `money-amount`, `money-commission`, `bid-detail-net`, `bid-detail-currency`, `money-method`, `money-status`, `money-captured`, `money-released`, `money-empty`), plus `StripeResyncPanel` (`data-test="action-resync"`, conditions actuelles `canSeePayments && money.rail === 'STRIPE'`, événement `resynced` relayé), plus lien « Voir le paiement » (déjà dans le menu : ne pas dupliquer).
  - `BidIncidentsTab` : props `bid`. Pour chaque litige : type lisible, `disputeStatusLabel(status)`, dates (`formatInstant`), résolution si présente, lien « Ouvrir le litige » (`/incidents?open=<id>`). Pour chaque annulation : portée (remise / livraison), état du no-show, motif, date, lien « Ouvrir l’absence » (`/incidents?tab=noshows&open=<id>`). Vide : « Aucun incident sur ce colis. » (`data-test="incidents-empty"`). Libellés inconnus affichés bruts en neutre (comme `bidStatusMeta`).
- La chronologie reste la source des événements non photo ; les photos de scan de la chronologie sont aussi dans la galerie.

- [ ] **Step 1: Write the failing tests** : `trackingTab_rendersGalleryAndTimeline`, `trackingTab_timelineErrorStillShowsGallery`, `timeline_hoursInParis` (entrée `2026-10-23T22:30:00` UTC sans `Z` → affichage `00:30` le lendemain), `moneyTab_keepsAllFieldsAndTestIds` (reprendre les assertions de l'ancien panneau), `moneyTab_resyncOnlyForStripeWithPaymentView`, `moneyTab_emptyMessages` (cash, sans droit, aucun paiement), `incidentsTab_listsDisputesAndCancellations`, `incidentsTab_empty`, `incidentsTab_unknownLabelsFallback`, `incidentsTab_linksPointToIncidents`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run tests/unit/features/bids` → PASS.
- [ ] **Step 5: Commit** `feat(colis): onglets Suivi, Argent et Incidents du tiroir`.

---

### Task 9: Onglet Échanges

**Files:**
- Create: `app/features/bids/components/BidChatTab.vue`, `app/features/bids/composables/useBidChat.ts`
- Modify: `app/features/bids/components/BidDetailPanel.vue`
- Test: `tests/unit/features/bids/BidChatTab.spec.ts`, `useBidChat.spec.ts`

**Interfaces:**
- Consumes : le service de modération existant qui appelle `GET /admin/conversations/{conversationId}/messages` (à repérer : `grep -rn "conversations/" app/features/moderation`) ; réutiliser son service et ses types, et le composant d'affichage d'un message de la modération s'il existe et se prête au réemploi (sinon un rendu simple : auteur, heure Europe/Paris, texte, image en vignette ouvrant `PhotoViewer`).
- Produces : `useBidChat(conversationId)` : `{ messages, isLoading, error, load(), reload() }` avec garde de séquence, chargement à l'ouverture de l'onglet seulement (pas au montage du tiroir). `BidChatTab` : props `conversationId: string`. Lecture seule : aucune action de suppression (elle reste dans `/moderation`) ; un lien « Ouvrir dans la modération » (`/moderation?open=<id>`). Messages supprimés (`deletedAt`) affichés en « Message supprimé ». États chargement / erreur (`StateBlock` + Réessayer) / vide (« Aucun message. »). Les images (URL signées 15 min) passent par `safeHttpsUrl` ; image expirée → même état « Cette photo n’est plus disponible. ».
- Le compteur de la pastille de l'onglet n'est affiché que lorsque les messages sont chargés.

- [ ] **Step 1: Write the failing tests** : `useBidChat_loadsOnce`, `useBidChat_staleResponseIgnored`, `useBidChat_error`, `chatTab_rendersMessagesInOrder`, `chatTab_deletedMessagePlaceholder`, `chatTab_noDeleteButton`, `chatTab_empty`, `chatTab_errorRetry`, `chatTab_imageOpensViewer`, `chatTab_linkToModeration`, `panel_chatTabLoadsOnlyWhenOpened`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(colis): onglet Échanges du tiroir`.

---

### Task 10: Onglet du tiroir dans l'URL, e2e, vérifications finales

**Files:**
- Modify: `app/pages/colis/index.vue` (paramètre `section`), `tests/e2e/colis.spec.ts` (adapter), `tests/e2e/colis-demandes.spec.ts` (vérifier)
- Create: `tests/e2e/colis-reorganisation.spec.ts`
- Test: `tests/unit/pages/colis-fiche.spec.ts` (compléter)

**Interfaces:**
- Produces : `?section=tracking|money|chat|incidents` (absent = `summary`) lu à l'ouverture et réécrit à chaque changement d'onglet du tiroir avec `router.replace` ; valeur inconnue ignorée.
- E2E (`tests/e2e/colis-reorganisation.spec.ts`, handler unique pour `**/api/v1/admin/bids**` qui distingue : liste, `counts`, `suggest`, `/<id>`, `/<id>/timeline`, `/<id>/photos`, et pour `**/api/v1/admin/conversations/**` les messages) : `landsOnTodoView_withCounts`, `switchView_changesListAndUrl`, `alertPill_filtersList`, `searchTyping_showsGroupedSuggestions`, `pickSender_addsRemovableChip`, `removeChip_restoresList`, `exactTracking_opensDrawer`, `rowClick_opensDrawerWithTabs`, `personLink_goesToUsersId_withoutOpeningDrawer`, `tabs_summaryTrackingMoneyIncidents`, `sectionParam_opensTab`, `photosGallery_groupsByStage`, `photoViewer_keyboardZoomNavEscape` (Échap ferme la visionneuse puis le tiroir au second Échap), `photoViewer_expiredPhoto_reload`, `chatTab_loadsMessages`, `actionsMenu_cancelAndDisputeStillAvailable`, `legacyBackend_countsSuggestPhotos404_stillUsable` (les trois endpoints répondent 404 sans `code` : page utilisable, recherche à Entrée, photos du détail), `deepLink_announcementId_showsAllView`, `deepLink_openId_opensDrawer`, `supportRole_noChatTabWithoutModerationView` (surcharge de permissions), `announcementsAndDemandesTabs_untouched`.

- [ ] **Step 1: Write the failing tests** (unitaire `colis-fiche` : `section_param_selectsTab`, `section_invalid_ignored`, `tabChange_rewritesUrl` ; e2e ci-dessus).
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/pages/colis-fiche.spec.ts` et `pnpm e2e tests/e2e/colis-reorganisation.spec.ts --reporter=line` → FAIL.
- [ ] **Step 3: Implement** `section`, adapter `colis.spec.ts` aux nouveaux sélecteurs et au tiroir à onglets (garder les scénarios existants : ouverture, actions, liens).
- [ ] **Step 4: Verify** : `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (seuils 90 %), `pnpm e2e --reporter=line` (suite complète, `workers: 1`). Tout doit être vert, sauf `permissionCoverage.spec.ts` si le `dony-back` voisin est périmé (le dire explicitement). Contrôler à la main : `grep -rn "chip-status" app tests` (aucun résidu), pas de tiret cadratin dans les textes (`grep -rn "—" app/features/bids` ne doit montrer que des valeurs de repli « — » déjà existantes dans les tableaux).
- [ ] **Step 5: Commit** `feat(colis): onglet du tiroir dans l'URL et scénarios e2e`.
