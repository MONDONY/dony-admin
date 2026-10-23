# Réorganisation de la page Transactions, partie admin : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réorganiser `/transactions` (quatre sections, vues à nombre, recherche à suggestions, lignes lisibles, tiroir à cinq onglets, listes finance avec noms et filtres) et faire de **chaque information qui vit ailleurs un lien qui atterrit sur l'élément précis**, dans les deux sens, via un registre unique d'URL.

**Architecture:** Un registre `app/lib/adminLinks.ts` construit toute URL interne (permission incluse) et remplace les chaînes écrites à la main. La logique vit dans `app/features/payments/**`, `app/features/finance/**` et un petit `app/features/transactions/**` (sections, nombres des pastilles) ; `app/pages/transactions/index.vue` ne fait plus que les assembler (exclu de la couverture). Même démarche que la page Colis (`app/features/bids/**`).

**Tech Stack:** Nuxt 4, Vue 3 `<script setup lang="ts">`, Tailwind, Pinia, Vitest + happy-dom, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-transactions-reorganisation-design.md` (lire en premier ; en cas de conflit avec ce plan, le spec gagne). Plan jumeau : `…-transactions-reorganisation-backend.md` (il contient le **contrat d'API**, source de vérité : types et URL ci-dessous le suivent mot pour mot). Maquette : https://claude.ai/artifact/KMizmg9VkAW8hyUh1Jj8DF. Modèle à imiter : la page Colis (`app/features/bids/**`, `tests/e2e/colis-reorganisation.spec.ts`).

Travail dans `dony-admin`, worktree `dony-admin-worktrees/transactions-reorganisation`, branche `feature/transactions-reorganisation` créée depuis `origin/main` (`1301ce4`). Chemins relatifs à `app/` (tests : `tests/unit/**`, `tests/e2e/**`). Commandes : `npx vitest run <fichier>`, `npm run lint`, `npm run typecheck`, `npx playwright test tests/e2e/<fichier>`. La PR admin cite la PR backend jumelle et se fusionne **après** elle.

## Global Constraints

- Jamais de commit sur `main`. Messages de commit terminés par `Claude-Session: https://claude.ai/code/session_01Ab8Dd9TaHrGuJbHPnaxbdb`. Pas de `Co-Authored-By`.
- **Repli ancien backend** : `counts`, `suggest`, `finance/counts`, `GET /admin/alerts/{id}` absents (404/405 sans `code`, `isEndpointMissing`) = comportement actuel : onglets plats visibles, vues cachées, recherche simple, liens construits avec ce qui existe ; jamais de « 0 » inventé. Champ absent = ancien backend ; `null` = non autorisé. Un test par repli.
- Droits : la page reste `PAYMENT_VIEW`. Chaque lien sortant passe par le registre, derrière la permission de sa destination (`BID_VIEW`, `USER_VIEW`, `DISPUTE_VIEW`, `MODERATION_VIEW`, `ALERT_VIEW`, `AUDIT_VIEW`, `SUPPORT_TICKET_VIEW`, `USER_KYC`) : sans elle, **pas de `<a>`**, du texte. Identifiant absent = pas de lien. Gestes (`PAYMENT_RELEASE`, `PAYMENT_REFUND`), export (`EXPORT_RUN`) inchangés.
- Montants : `formatMoney(cents, currency)`, une carte de totaux par devise, jamais d'addition entre devises. Dates : `parseServerDate`, jamais `new Date(string)` sur un instant du serveur.
- Liens : de vrais `<a href>` (`NuxtLink`) pour permettre Ctrl/Cmd-clic ; ouverture dans le même onglet.
- Tous les liens entrants existants continuent de marcher à l'identique : `?tab=` (les sept identifiants), `?open=<paiement>`, `?held=true`, `?status=`, `?method=`, `?currency=`, `?dateFrom=`, `?dateTo=`, `?hideAbandoned=`.
- Filtres de la page dans l'URL (`useUrlFilters`, `defaultFrom` pour la vue par défaut qui dépend des autres paramètres), valeurs inconnues ignorées, `router.replace` sans pile d'historique.
- Échap ferme le tiroir (`useEscapeClose` avec son paramètre `root`). Cibles tactiles ≥ 40 px (`min-h-10`), `focus-visible`, `aria-label` sur les boutons-icônes, `tabular-nums` sur les montants, pas de dégradé, couleurs unies (règle du propriétaire).
- Couverture ≥ 90 % (la logique vit dans `features/` et `lib/`, pas dans `app/pages/**`). Les tests existants (`transactions.spec.ts`, `versements-retenus.spec.ts`, tests unitaires `payments`/`finance`) restent verts ; on ne les assouplit pas.
- Pas de nouvelle action métier : les gestes existants sont regroupés dans le menu « Actions », jamais modifiés.

## Contrat des URL (source de vérité, spec §Carte des liens)

Entrées de `/transactions` : `tab` (`payments`, `chargebacks`, `mobile-money`, `mm-commissions`, `wallets`, `wallet-refunds`, `cash-commissions`), `open` (identifiant du paiement, ou de la ligne ouverte dans l'onglet : litige bancaire, demande de remboursement wallet), `section` (onglet du tiroir : `incidents`, `money`, `timeline`, `references` ; Résumé = absent), `view` (`ATTENTION`, `ESCROW`, `RELEASED_RECENT`, `REFUNDED`, `FAILED`, `ALL`), `alert` (`HELD`, `CHARGEBACK_OPEN`, `MM_FAILED`, `ESCROW_J48`), `partyId`, `announcementId`, `bidId`, `query`, `amountMin`/`amountMax` (en unités principales dans l'URL, convertis en centimes à l'envoi), `held=true` (alias de `view=ATTENTION&alert=HELD`), plus les filtres existants. Défaut de `view` : `ATTENTION` sans autre filtre, `ALL` dès qu'un paramètre de filtre est présent (même règle que `defaultViewFor` de Colis).

Sorties (registre `adminLinks`) : `/users/<id>` (+ `?tab=money|identity|manage`), `/support?userId=<id>`, `/colis?open=<colis>` (+ `&section=tracking|money|chat|incidents`), `/colis?tab=announcements&announcement=<annonce>`, `/colis?announcementId=<annonce>`, `/colis?tab=demandes&open=<demande>`, `/incidents?open=<litige>`, `/incidents?tab=noshows&open=<annulation>`, `/moderation?open=<conversation>`, `/alertes?open=<alerte>`, `/audit?entityType=PAYMENT&entityId=<paiement>`, et vers `/transactions` lui-même depuis les autres pages (`?open=`, `?open=…&section=incidents`, `?announcementId=`, `?partyId=`, `?view=attention&alert=ESCROW_J48`, `?tab=mobile-money&view=failed`, `?tab=wallets&partyId=`).

## Review Focus (cas que le spec suppose sans que les tâches les nomment)

1. Lien sans permission : aucun `<a>` dans le DOM, le texte reste lisible (pas de lien mort, pas de 403 à l'arrivée).
2. Identifiant absent (ancien backend, négociation sans colis, compte supprimé) : pas de lien, pas de « undefined » dans l'URL.
3. Un lien entrant `?tab=wallets` ou `?held=true` ouvre la bonne section ET le bon sous-onglet, y compris page déjà ouverte (changement de query seul).
4. Le nombre de la pastille ou de la vue égale la longueur de la liste affichée après un clic (carte `escrowJ48`, pastille de section).
5. Échap ferme le tiroir ; le bouton Retour du navigateur d'une page liée revient à la fiche d'où l'on vient (liens normaux, pas de `router.replace`).

---

### Task 1: Registre des liens et migration des constructeurs existants

**Files:**
- Create: `app/lib/adminLinks.ts`, `tests/unit/lib/adminLinks.spec.ts`
- Modify: `app/features/bids/lib/bidLinks.ts`, `app/features/alerts/lib/alertCatalog.ts` (`entityLink`, `alertLinks`), `app/features/user-profile/lib/objectLinks.ts`, `app/features/user-profile/lib/sectionColumns.ts` (`paymentLink`), `app/features/search/services/globalSearchService.ts`, `app/features/search/lib/searchPages.ts`, `app/features/overview/composables/useOverview.ts`, `app/features/user-profile/components/UserAccountBanners.vue`, `app/features/users/components/UserDetailPanel.vue`
- Test: les specs existantes de ces fichiers passent inchangées

**Interfaces:**
- Produces: `type AdminRoute = { path: string; query?: Record<string, string> }` ; `type CanFn = (permission: string) => boolean` ; constructeurs purs, chacun `(…ids) => AdminRoute | null` (`null` si un identifiant manque ou n'est pas un UUID, via `uuidParam` de `@/lib/safeInput`) : `userRoute(id, tab?)`, `supportOfRoute(userId)`, `bidRoute(id, section?)`, `tripRoute(announcementId)`, `tripBidsRoute(announcementId)`, `packageRequestRoute(id)`, `disputeRoute(id)`, `noShowRoute(cancellationId)`, `conversationRoute(firestoreId)`, `alertRoute(id)`, `auditRoute(entityType, entityId)`, `paymentRoute(id, section?)`, `paymentsOfTripRoute(announcementId)`, `paymentsOfPartyRoute(userId)`, `paymentsOfBidRoute(bidId)` (→ `/transactions?bidId=<colis>&view=ALL`), `transactionsViewRoute({ view?, alert?, tab? })`, `chargebackRoute(id)`, `walletRefundRoute(id)`, `walletsOfPartyRoute(userId)` ; et `gate(can, permission, route): AdminRoute | null` (route si la permission est détenue, sinon `null`) ; `toHref(route): string`. Les identifiants Firestore (`conversationRoute`) passent par `firestoreIdParam` de `@/lib/safeInput`.

- [ ] **Step 1: Write the failing tests** (`adminLinks.spec.ts`) : une assertion `toEqual` par constructeur sur l'URL exacte du contrat ci-dessus (`bidRoute(B, 'tracking')` → `{ path: '/colis', query: { open: B, section: 'tracking' } }`, `tripRoute(T)` → `{ path: '/colis', query: { tab: 'announcements', announcement: T } }`, `auditRoute('PAYMENT', P)` → `{ path: '/audit', query: { entityType: 'PAYMENT', entityId: P } }`, etc.) ; chaque constructeur renvoie `null` pour `undefined`, `''`, `'pas-un-uuid'` ; `gate` renvoie `null` sans la permission ; `toHref` encode correctement (`/colis?open=…&section=tracking`). Les specs existantes des fichiers migrés (`bidLinks`, `alertCatalog`, `objectLinks`, `globalSearchService`, `useOverview`, bannières) doivent produire **les mêmes URL qu'avant** : ajouter aux specs existantes un cas d'égalité là où il manque.
- [ ] **Step 2: Run to verify they fail** — `npx vitest run tests/unit/lib/adminLinks.spec.ts` → FAIL.
- [ ] **Step 3: Implement** le registre, puis remplacer les chaînes construites à la main des fichiers listés par des appels au registre (aucun changement de comportement ; les imports de `@/lib/safeInput` existent déjà).
- [ ] **Step 4: Run** `npx vitest run tests/unit` (toute la suite) → PASS, puis `npm run lint && npm run typecheck`.
- [ ] **Step 5: Commit** — `refactor(liens): registre unique des URL internes de l'admin`.

### Task 2: Types et services

**Files:**
- Modify: `app/features/payments/types/index.ts`, `app/features/payments/services/paymentsService.ts`, `app/features/finance/types/index.ts`, `app/features/finance/services/financeService.ts`, `app/features/alerts/services/*` (ajout `get(id)`), `app/features/audit/services/*` et `app/features/audit/types/index.ts` (filtre `entityId`)
- Create: `app/features/transactions/types.ts`, `app/features/transactions/services/transactionsService.ts`
- Test: `tests/unit/features/payments/paymentsService.spec.ts` (étendre), `tests/unit/features/finance/financeService.spec.ts` (étendre), `tests/unit/features/transactions/transactionsService.spec.ts`

**Interfaces:**
- Produces (types, noms du contrat backend) : `PaymentView`, `PaymentAlertCode`, `PaymentViewCounts` (`attention, escrow, releasedRecent, refunded, failed, all, abandoned, alerts{held, chargebackOpen, mmFailed, escrowJ48}`), `PaymentSuggest` (`exactPaymentId?, senders[], travelers[], trips[], parcels[]`), `AdminPaymentListItem` gagne `alert?`, `trackingNumber?`, `announcementId?`, `AdminPaymentDetail` gagne `alert?`, `trackingNumber?`, `links?` (`announcementId?, disputeId?, disputeStatus?, cancellationId?, conversationId?, chargebackId?, packageRequestId?`), `openAlerts?`, `chargeback?` ; `PaymentsFilterState` gagne `view`, `alert`, `partyId`, `announcementId`, `bidId`, `amountMin`, `amountMax` (centimes ou `null`) ; `AdminMobileMoneyPayment` gagne `purpose?, personId?, personName?, role?, bidId?, trackingNumber?, corridor?, walletRefundRequestId?, retryable?` ; `AdminWallet` gagne `userName?` ; `AdminCashCommission` gagne `trackingNumber?, corridor?, travelerId?, travelerName?` ; `AdminChargeback` gagne `paymentId?, trackingNumber?, corridor?, senderId?, senderName?, travelerId?, travelerName?, outcome?, resolvedAt?` ; `FinanceCounts` (`payments, mobileMoney, soldes, chargebacks, details{…}`).
- Services : `paymentsService.counts(f)`, `.suggest(q)` ; `paymentsService.list/summary/exportCsv` envoient `view`, `alert`, `partyId`, `announcementId`, `bidId`, `amountMin`, `amountMax` (omis à leur défaut) ; `financeService.listMobileMoneyPayments(params)`, `.mobileMoneyCounts(params)`, `.listWallets(params)`, `.listCashCommissions(params)`, `.cashCommissionCounts()` ; `paymentsService.listChargebacks(params)`, `.chargebackCounts()` ; `transactionsService.counts()` (`GET /admin/finance/counts`) ; `alertsService.get(id)` ; l'audit envoie `entityId`.

- [ ] **Step 1: Write the failing tests** : chaque méthode appelle la bonne URL avec les bons paramètres (`$fetch` simulé comme dans les specs existantes) ; les paramètres à leur défaut (`view=ALL`, `alert` absent, `partyId` vide) ne sont **pas** envoyés ; `amountMin: 12000` part en `amountMin=12000` ; les signatures historiques `(page, size)` des listes finance restent acceptées pendant la migration des appelants (surcharge) et disparaissent à la Task 10.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Champs optionnels partout (ancien backend) ; un seul normalisateur par réponse (`normalizeMobileMoney` etc. si une valeur doit être défaut).
- [ ] **Step 4: Run** tests unitaires + typecheck → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): types et services des nouvelles listes`.

### Task 3: Bibliothèques pures (vues, alertes, filtres d'URL, sections)

**Files:**
- Create: `app/features/payments/lib/paymentViews.ts`, `app/features/payments/lib/paymentPageFilters.ts`, `app/features/transactions/lib/sections.ts`
- Test: `tests/unit/features/payments/paymentViews.spec.ts`, `paymentPageFilters.spec.ts`, `tests/unit/features/transactions/sections.spec.ts`

**Interfaces:**
- Produces : `PAYMENT_VIEWS: { id: PaymentView; label: string; countKey: keyof PaymentViewCounts }[]` (ordre de la maquette : À traiter, En séquestre, Versés (3 j), Remboursés, Échoués / annulés, Tous) ; `PAYMENT_ALERTS: Record<PaymentAlertCode, { label; shortLabel; tone }>` (`HELD` « Versement retenu » danger, `CHARGEBACK_OPEN` « Litige bancaire ouvert » danger, `MM_FAILED` « Versement échoué » danger, `ESCROW_J48` « En séquestre depuis plus de 48 h » warning) ; `paymentAlertMeta(code?)` ; `defaultPaymentViewFor(query): PaymentView` (`ATTENTION` sans paramètre de filtre, sinon `ALL` ; `held=true` compte comme filtre) ; `PAYMENT_URL_SPECS` (spécifications pour `useUrlFilters`, y compris `view` avec `defaultFrom`, `alert`, `partyId`, `announcementId`, `bidId`, `amountMin`, `amountMax`) ; `legacyHeldToFilters(query)` (`held=true` → `view=ATTENTION`, `alert=HELD`) ; `paymentActiveChips(filters, labels): { key; label }[]` (une puce par filtre actif, libellés « Personne : Awa Diallo », « Trajet : Paris → Dakar », « Montant : 100 – 200 € », « Alerte : Versement retenu », « Méthode : Carte », « Devise : EUR », « Période : … ») ; `SECTIONS`, `TAB_TO_SECTION: Record<Tab, { section; sub }>` (les sept `?tab=` → quatre sections + sous-onglet) et `sectionOf(tab)`.

- [ ] **Step 1: Write the failing tests** : les sept `tab` mappent exactement ainsi — `payments`→Paiements ; `chargebacks`→Litiges bancaires ; `mobile-money`, `mm-commissions`→Mobile money (sous-onglets Opérations, Commissions) ; `wallets`, `wallet-refunds`, `cash-commissions`→Soldes ; `defaultPaymentViewFor({})` = `ATTENTION`, `({ query: 'awa' })` = `ALL`, `({ held: 'true' })` = `ALL` avec alerte ; un `view` inconnu est ignoré ; `held=true` ne casse pas une query qui porte déjà `alert` ; les puces suivent l'ordre et les libellés ci-dessus ; `paymentAlertMeta('NIMPORTE')` = `null`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** (fonctions pures, aucune dépendance Vue).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): vues, alertes et filtres d'URL des paiements`.

### Task 4: Composables (liste, nombres, suggestions, nombres des sections)

**Files:**
- Modify: `app/features/payments/composables/usePayments.ts`
- Create: `app/features/payments/composables/usePaymentCounts.ts`, `usePaymentSuggestions.ts`, `app/features/transactions/composables/useFinanceCounts.ts`
- Test: `tests/unit/features/payments/usePayments.spec.ts` (étendre), `usePaymentCounts.spec.ts`, `usePaymentSuggestions.spec.ts`, `tests/unit/features/transactions/useFinanceCounts.spec.ts`

**Interfaces:**
- Consumes: Tasks 2-3. Modèles : `useBidCounts`, `useBidSuggestions`, `useAdminBids`.
- Produces : `usePayments()` gagne `setView`, `setAlert`, `setParty`, `setAnnouncement`, `setAmountRange`, `clearFilter(key)`, `clearAll()` et `filters` étendu (`view` défaut `ATTENTION`) ; `usePaymentCounts(filters)` → `{ counts, unavailable, error, settled, reload, sync }` (clé de rechargement : filtres autres que `view`, `alert`, `status`, comme `useBidCounts`) ; `usePaymentSuggestions()` → `{ suggestions, unavailable, query, clear }` (200 ms, 2 caractères, réponses périmées écartées) ; `useFinanceCounts()` → `{ counts, unavailable, reload }` (recharge à l'ouverture de la page et après chaque geste).

- [ ] **Step 1: Write the failing tests** : `setView('ESCROW')` remet la page à 0 et recharge ; les nombres ne se rechargent pas quand seule la vue change (clé inchangée) mais se rechargent quand `query`, `currency`, `partyId` changent ; réponse périmée écartée (deux appels, le second plus rapide) ; 404 sans `code` → `unavailable = true`, `counts = null`, pas d'erreur affichée ; autre erreur → message, rechargement permis au prochain `sync` ; `clearAll()` rétablit les défauts (dont `hideAbandoned: true`) ; **l'ancien comportement** (aucun nouveau filtre, aucun `view`) envoie la même requête qu'avant.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): composables de liste, nombres et suggestions`.

### Task 5: Briques d'interface réutilisables

**Files:**
- Create: `app/components/ui/SuggestSearchBox.vue`, `app/components/ui/ActiveFilters.vue` (déplacé depuis `app/features/bids/components/BidActiveFilters.vue`), `app/features/payments/components/PaymentViewTabs.vue`, `PaymentAlertBadge.vue`, `PaymentSearchBox.vue`, `PaymentFilters.vue` (remplace l'actuel), `PaymentTotalsBar.vue` (adapté)
- Modify: `app/features/bids/components/BidsTable.vue` ou la page Colis (import de `ActiveFilters`), suppression de `BidActiveFilters.vue`
- Test: `tests/unit/components/ui/SuggestSearchBox.spec.ts`, `ActiveFilters.spec.ts` (renommé), `tests/unit/features/payments/PaymentViewTabs.spec.ts`, `PaymentAlertBadge.spec.ts`, `PaymentSearchBox.spec.ts`, `PaymentFilters.spec.ts`, `PaymentTotalsBar.spec.ts`

**Interfaces:**
- Produces : `SuggestSearchBox` générique : props `modelQuery: string`, `groups: { key: string; label: string; items: { key: string; title: string; sub?: string; count?: number; mono?: boolean }[] }[]`, `placeholder`, `ariaLabel`, `testPrefix`, `disabled`, `resetKey?` ; émet `update:query`, `type`, `pick(groupKey, itemKey)` ; mécanique combobox ARIA identique à `BidSearchBox` (listbox, flèches, Entrée, Échap, mousedown.prevent, clic extérieur). **Décision** : `BidSearchBox` n'est pas réécrite (risque de régression sur Colis ; sa migration vers ce composant est une suite possible) — consigner la décision dans le ledger. `PaymentViewTabs` : `TabBar` `variant="underline"`, props `modelValue`, `counts`, émet `update:modelValue` ; l'onglet « À traiter » est rouge s'il reste du travail, le 0 reste visible ; sous la barre « Les nombres d'« À traiter » se recoupent avec les autres vues ». `PaymentFilters` : méthode, devise, période, montant (min–max), « Plus de filtres » (bascule « Checkouts abandonnés ») ; lignes de pastilles supprimées. `PaymentTotalsBar` : mêmes cartes par devise, libellés de la maquette (« Retenu (versement gelé) » en rouge).

- [ ] **Step 1: Write the failing tests** : `SuggestSearchBox` : liste fermée sous 2 caractères ; ↓/↑ naviguent en boucle, Entrée choisit l'option active sinon soumet, Échap ferme sans vider le champ, `aria-activedescendant`/`aria-expanded` corrects ; `ActiveFilters` : mêmes assertions que `BidActiveFilters.spec` (renommé) ; `PaymentViewTabs` : six onglets dans l'ordre, nombres affichés, « À traiter » en alerte si `attention > 0`, sans `counts` aucun nombre ; `PaymentAlertBadge` : libellé et ton par code, rien pour un code inconnu ; `PaymentFilters` : changer le montant émet `update:amountRange` en centimes (`100` → `10000`), saisie invalide ignorée ; `PaymentTotalsBar` : une carte par devise, montants `formatMoney`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** `git mv` pour `ActiveFilters` (historique conservé), imports de la page Colis mis à jour.
- [ ] **Step 4: Run** `npx vitest run tests/unit` (la suite Colis doit rester verte) → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): briques de recherche, vues et filtres`.

### Task 6: Tableau des paiements et section Paiements dans la page

**Files:**
- Modify: `app/features/payments/components/PaymentsTable.vue`, `app/pages/transactions/index.vue` (section Paiements), `app/features/payments/lib/paymentLabels.ts` si besoin
- Create: `app/features/transactions/components/TransactionSectionTabs.vue`
- Test: `tests/unit/features/payments/PaymentsTable.spec.ts` (étendre), `tests/unit/features/transactions/TransactionSectionTabs.spec.ts`

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces : `TransactionSectionTabs` : props `section`, `sub`, `counts: FinanceCounts | null` ; émet `update:tab(tab: Tab)` ; quatre sections avec pastilles rouges (`counts.payments`, `.mobileMoney`, `.soldes`, `.chargebacks`), sous-onglets pour Mobile money (Opérations | Commissions) et Soldes (Portefeuilles | Remboursements wallet | Commissions cash) ; sans `counts` : **les sept onglets plats actuels** (repli). `PaymentsTable` : colonnes de la maquette (À faire = statut + `PaymentAlertBadge`, Colis = trajet lien `tripRoute`/`bidRoute`, type, n° de suivi lien, Expéditeur → Voyageur liens `userRoute`, Montant + net voyageur + commission, Méthode, Depuis), ligne cliquable ouvrant le tiroir **sans** gêner les liens internes (`@click.stop` sur chaque `<a>`), liens derrière `gate` avec `BID_VIEW`/`USER_VIEW`.

- [ ] **Step 1: Write the failing tests** : tableau : étiquette d'alerte affichée par code ; trajet et n° de suivi sont des `<a>` vers `/colis?open=<colis>` avec `BID_VIEW`, du texte sans ; noms = `<a>` vers `/users/<id>` avec `USER_VIEW`, texte sans ; cliquer sur un lien n'émet pas `select` ; cliquer ailleurs sur la ligne émet `select(paymentId)` ; négociation sans colis : pas de lien colis, étiquette « Négociation » ; section : quatre sections, pastilles masquées à 0, sous-onglets exacts, `update:tab` émet l'identifiant historique (`mobile-money`, `wallet-refunds`…) ; sans `counts`, sept onglets plats.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** la section Paiements dans la page : `TransactionSectionTabs` en haut, `PaymentViewTabs`, `PaymentSearchBox`, `PaymentFilters`, `ActiveFilters`, totaux, tableau, export CSV (`EXPORT_RUN`), lien « N checkouts abandonnés masqués · les afficher » (nombre `counts.abandoned`), pagination. La page ne contient plus de logique : tout passe par `usePayments`, `usePaymentCounts`, `usePaymentSuggestions`, `useUrlFilters`. `?tab=` : conversion legacy via `TAB_TO_SECTION` ; `held=true` converti par `legacyHeldToFilters`.
- [ ] **Step 4: Run** tests unitaires + `npx playwright test tests/e2e/transactions.spec.ts tests/e2e/versements-retenus.spec.ts` (les e2e existants doivent rester verts, adaptés seulement si un sélecteur de pastille a disparu, motif noté dans le ledger) → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): sections, vues et tableau des paiements`.

### Task 7: Tiroir paiement : coquille, en-tête, bandeau et onglet Résumé

**Files:**
- Modify: `app/features/payments/components/PaymentDetailPanel.vue` (réduit à la coquille : en-tête, bandeau, onglets, dialogues), `app/features/payments/composables/usePaymentDetail.ts` (onglet courant, rechargement)
- Create: `PaymentDrawerHeader.vue`, `PaymentAlertBanner.vue`, `PaymentFlow.vue`, `PaymentPartiesRow.vue`, `PaymentActionsMenu.vue`, `PaymentSummaryTab.vue`, `app/features/payments/lib/paymentFlow.ts`, `paymentActions.ts`
- Test: `tests/unit/features/payments/` : un spec par composant et par lib

**Interfaces:**
- Consumes: Tasks 1-4. Modèles : `BidDetailPanel`, `BidDrawerHeader`, `BidAlertBanner`, `BidStepper`, `BidActionsMenu`.
- Produces : `paymentFlow(payment): { steps: { id; label; date?: string; state: 'done'|'current'|'todo'|'stop' }[] }` (Payé → Encaissé → Colis livré → Versé/Remboursé ; « Versement retenu » = étape `stop` ; carte : `capturedAt` ; mobile money : étape Encaissé selon l'opération) ; `paymentActions(payment, can, held): { id; label; enabled; reason?; tone }[]` (Débloquer, Rembourser, Relancer le versement, Relancer le remboursement, Resynchroniser Stripe : mêmes gardes que `PaymentDetailPanel` actuel — `PAYMENT_RELEASE`, `PAYMENT_REFUND`, rail, statut, identifiants pawaPay connus — chacune **grisée avec la raison** quand impossible, jamais cachée) ; le tiroir émet les mêmes événements qu'avant (`force-release`, `refund`, `retry-payout`, `retry-refund`, `override-dismiss`, `resynced`, `close`) ; `section` du tiroir lue et écrite dans `?section=` (`useUrlFilters`-like, `router.replace`) ; Échap ferme.

- [ ] **Step 1: Write the failing tests** : `paymentFlow` : paiement carte libéré → quatre étapes `done` avec dates ; retenu → dernière étape `stop` « retenu » ; abandonné → pas d'étape `done` après la première ; `paymentActions` : paiement `ESCROW` + `PAYMENT_RELEASE` → « Débloquer » activé ; sans permission → grisé avec la raison « permission manquante » ; `RELEASED` mobile money sans `pawapayPayoutId` → « Relancer le versement » grisé avec la raison ; bandeau : paiement retenu → rouge, texte « À traiter : versement retenu depuis le <date>. <cause> », deux boutons (« Rembourser l'expéditeur », « Payer le voyageur (dérogation) ») qui ouvrent les dialogues existants (`ConfirmActionDialog`, `PayoutOverrideDialog`), sans alerte → pas de bandeau ; checkout abandonné → bandeau neutre « rien à faire » (texte actuel conservé) ; en-tête : trajet + type + statut, n° de suivi avec « Copier » ; parties : expéditeur et voyageur = liens `userRoute` avec `USER_VIEW`, badge « Banni » depuis `beneficiaryHoldReason` ; Résumé : montants en gros (payé, net, commission), colis lié = lien `bidRoute`, Échap ferme, onglet courant dans l'URL. Régression : les e2e `transactions.spec.ts` et `versements-retenus.spec.ts` (gestes, dérogation) passent.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Le dialogue de dérogation et la logique 409 (`overrideRequest`) restent dans `usePaymentDetail` et la coquille, inchangés.
- [ ] **Step 4: Run** tests unitaires + e2e existants → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): tiroir paiement à onglets, résumé et bandeau d'alerte`.

### Task 8: Onglets Argent, Chronologie, Incidents et Références

**Files:**
- Create: `PaymentMoneyTab.vue`, `PaymentTimelineTab.vue`, `PaymentIncidentsTab.vue`, `PaymentReferencesTab.vue`, `app/features/payments/lib/paymentLinks.ts`
- Modify: `PaymentDetailPanel.vue` (branchement des onglets), `PaymentTimeline.vue` (nom d'acteur lié à `userRoute` quand l'acteur est un compte utilisateur et que `USER_VIEW`), `StripeResyncPanel.vue` (déplacé dans Références)
- Test: un spec par composant + `paymentLinks.spec.ts`

**Interfaces:**
- Produces : `paymentLinks(payment, can): PaymentLinkSet` — `{ sender, traveler, senderSupport, travelerSupport, bid, bidTracking, bidMoney, bidIncidents, bidChat, trip, tripBids, packageRequest, dispute, noShow, conversation, chargeback, alerts[], audit, holdCause }`, chacun `AdminRoute | null` produit par le registre et `gate` (permissions du tableau §Carte des liens) ; `holdCause` = `userRoute(travelerId,'manage')` si `BANNED`, `'identity'` si `KYC_REVOKED`.
- Onglet **Argent** : payé → commission → net → remboursé, taux de change, encaissement carte, libération ; lien « Voir la ventilation côté colis » (`bidMoney`). **Chronologie** : `PaymentTimeline` + lien « Voir tout le journal » (`audit`). **Incidents** : bloc retenue (cause = lien `holdCause`), litige bancaire (statut, motif, issue, lien vers l'onglet Litiges bancaires `chargebackRoute`), litige du colis (`dispute`), absence (`noShow`), conversation (`conversation`), alertes ouvertes (une ligne par alerte, lien `alertRoute`), support des deux parties (`supportOfRoute`) ; sans aucun incident : « Aucun incident » + rappel des liens. **Références** : PaymentIntent, charge, identifiants pawaPay avec « Copier », « Ouvrir dans Stripe », fil de négociation (lien `packageRequest` si résolu, sinon identifiant copiable), resynchronisation Stripe (carte, super-admin).

- [ ] **Step 1: Write the failing tests** : `paymentLinks` : toutes permissions → tous les liens présents aux URL exactes du contrat ; sans `DISPUTE_VIEW` → `dispute`, `noShow` `null` ; sans `MODERATION_VIEW` → `conversation` `null` ; sans `BID_VIEW` → `bid*`, `trip*` `null` ; sans `ALERT_VIEW` → `alerts` vide ; sans `AUDIT_VIEW` → `audit` `null` ; sans `SUPPORT_TICKET_VIEW` → supports `null` ; identifiants absents (ancien backend) → `null` ; composants : chaque lien rendu est un `<a>` au bon `href` (assertion sur `href`), absent du DOM sans la permission, texte conservé (Review Focus 1-2) ; Incidents : retenue + litige + alerte → trois blocs ; Argent : montants et taux ; Références : « Copier » écrit dans le presse-papiers ; resynchronisation visible seulement pour une carte avec PaymentIntent (comportement actuel).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests unitaires → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): onglets du tiroir et liens de la fiche paiement`.

### Task 9: Section Mobile money

**Files:**
- Modify: `app/features/finance/components/MobileMoneyTable.vue`, `mobileMoneyStatus.ts`, page `transactions/index.vue` (section)
- Create: `app/features/finance/composables/useMobileMoney.ts`, `app/features/finance/components/FinanceViewTabs.vue` (générique : `views: { id; label; countKey; alert? }[]`, `counts`), `app/features/finance/lib/mobileMoneyViews.ts`
- Test: specs correspondantes

**Interfaces:**
- Produces : `useMobileMoney()` → `{ rows, isLoading, error, totalPages, currentPage, filters (view, kind, provider, query), counts, unavailable, setView, setKind, setProvider, setQuery, goToPage }` ; `MOBILE_MONEY_VIEWS` : Échecs (`failed`, alerte avec `attention`), En cours (`open`), Réussies (`done`), Toutes (`all`) ; ligne : Type, Colis (trajet + n° de suivi liens `bidRoute`/`tripRoute`), Personne (lien `userRoute`, rôle), Opérateur + numéro masqué, Montant, Statut + motif d'échec, Créée ; « Ouvrir le paiement » (lien `paymentRoute`) pour les opérations liées à un paiement, **« Relancer depuis le paiement »** vers `paymentRoute(id, 'incidents')` quand `retryable` (le geste lui-même reste dans le tiroir) ; selon `purpose` : `WALLET_TOPUP` → personne seule (`userRoute(personId,'money')`), `WALLET_REFUND` → lien `walletRefundRoute`, `BID_SUPPLEMENT` → lien colis (`bidRoute(bidId,'money')`).

- [ ] **Step 1: Write the failing tests** : vues et compteurs ; changer de vue remet la page à 0 ; `q` temporisé 300 ms ; liens selon `purpose` (un cas par valeur : `BID_PAYMENT`, `WALLET_TOPUP`, `WALLET_REFUND`, `BID_SUPPLEMENT`) ; permissions (`BID_VIEW`, `USER_VIEW`) ; le numéro n'apparaît **que masqué** (`maskPhoneNumber` reste appliqué) ; repli ancien backend : pas de vues, liste plate comme avant ; vue « Échecs » vide : « Aucune opération en échec ». Régression : e2e mobile money existants.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests unitaires + e2e `transactions.spec.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): mobile money lisible, filtrable et relié`.

### Task 10: Section Soldes et Litiges bancaires

**Files:**
- Modify: `WalletsTable.vue`, `CashCommissionsTable.vue`, `WalletRefundRequestsTable.vue` (noms liés à `userRoute`, ouverture par `?open=`), `app/features/payments/components/ChargebacksTable.vue`, page (sections)
- Create: `app/features/finance/composables/useWallets.ts`, `useCashCommissions.ts`, `app/features/payments/composables/useChargebacks.ts`, `app/features/finance/lib/cashCommissionViews.ts`, `chargebackViews.ts`
- Modify: `financeService.ts`/`paymentsService.ts` (supprimer les signatures `(page, size)` historiques maintenant sans appelant)
- Test: specs correspondantes

**Interfaces:**
- Produces : portefeuilles : colonnes Titulaire (nom, lien `userRoute(userId,'money')`), Solde, Devise, Mis à jour ; recherche (nom/pseudo), filtres devise et signe du solde ; `?partyId=` ; commissions cash : colonnes Colis (trajet + n° de suivi, lien `bidRoute(bidId,'money')`), Voyageur (lien), Montant, Commission, Statut, Canal, Tentatives, Créé ; vues « À traiter » (`attention`) / « Toutes » ; litiges bancaires : vues Ouverts / Gagnés / Perdus / Tous avec nombres, colonnes Colis, Expéditeur → Voyageur, Montant, Motif, Statut + issue, Ouvert, liens « Ouvrir le paiement » (`paymentRoute`) et colis ; ligne ouverte par `?open=<id>` mise en évidence (`scrollIntoView`) pour litiges et remboursements wallet ; demandeur d'un remboursement wallet = lien fiche, `parentRequestId` = lien `walletRefundRoute`.

- [ ] **Step 1: Write the failing tests** : un spec par tableau (noms rendus à la place des UUID ; **aucun UUID brut visible** quand le nom existe ; sans nom (compte supprimé), l'identifiant abrégé en texte simple, pas de lien) ; vues et compteurs ; recherche et filtres envoient les bons paramètres ; `?open=` met la ligne en évidence et l'ouvre ; liens selon permissions ; repli ancien backend : colonnes d'avant avec UUID abrégés (jamais de colonne vide) ; suppression des signatures `(page, size)` : plus aucun appelant (`grep`).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests unitaires + e2e existants (`transactions.spec.ts`, `users-wallet.spec.ts`) → PASS.
- [ ] **Step 5: Commit** — `feat(transactions): soldes et litiges bancaires lisibles et reliés`.

### Task 11: Destinations et points d'entrée dans le reste de l'admin

**Files:**
- Modify: `app/pages/alertes/index.vue` (+ `features/alerts/composables/useAlerts.ts` : `?open=<alerte>` ouvre l'alerte via `alertsService.get`, repli si 404 : message « Alerte introuvable »), `app/pages/audit/index.vue` + `features/audit/composables/useAudit.ts` (`?entityType=&entityId=` préremplissent et appliquent les filtres ; champ « ID entité » ajouté au formulaire), `app/features/bids/components/BidMoneyTab.vue` (lien « Voir la retenue » → `paymentRoute(id,'incidents')` si le paiement est retenu), `app/features/bids/components/AnnouncementsTable.vue` ou fiche d'annonce (lien « Paiements de ce trajet » → `paymentsOfTripRoute`, `PAYMENT_VIEW`), `app/features/incidents/components/DisputeDetailPanel.vue` et `NoShowDetailPanel.vue` (lien « Voir le paiement de ce colis » → `paymentsOfBidRoute(bidId)`, `PAYMENT_VIEW`, à côté du lien colis existant ; le litige affiche son colis par `bidId`), onglet Argent de la fiche utilisateur (liens « Tous ses paiements » → `paymentsOfPartyRoute`, « Son portefeuille » → `walletsOfPartyRoute`), `features/overview/composables/useOverview.ts` (carte `escrowJ48` → `transactionsViewRoute({ view:'ATTENTION', alert:'ESCROW_J48' })`), `features/alerts/lib/alertCatalog.ts` (INV-11 et `MM_PAYOUT_ORPHAN_*` → `?tab=mobile-money&view=failed`), `features/notifications/lib/navBadges.ts` (pastille de `/transactions` = `useFinanceCounts().payments + mobileMoney + soldes + chargebacks` quand disponibles, sinon clés actuelles `heldPayouts`/`walletRefunds`), `features/search/lib/searchPages.ts` (entrée « Versements échoués » → `?tab=mobile-money&view=failed`)
- Test: specs correspondantes + e2e de la Task 12

**Interfaces:** Consumes Task 1 (constructeurs) et Task 4 (`useFinanceCounts`).

- [ ] **Step 1: Write the failing tests** : incidents : litige et absence affichent « Voir le paiement de ce colis » (lien `/transactions?bidId=<colis>&view=ALL`) avec `PAYMENT_VIEW`, rien sans ; `/transactions?bidId=…` affiche la puce « Colis : <n° de suivi ou identifiant abrégé> » retirable ; alertes : `?open=<id>` appelle `alertsService.get(id)` et ouvre le panneau, un 404 affiche « Alerte introuvable » sans planter, la page sans `?open` est inchangée ; audit : `?entityType=PAYMENT&entityId=<uuid>` pré-remplit les champs et envoie `entityType`/`entityId` ; `entityId` mal formé ignoré ; liens : chaque ajout n'existe qu'avec sa permission et vise l'URL du contrat ; carte `escrowJ48` pointe sur la vue qui contient le même nombre (Review Focus 4) ; pastille de `/transactions` : somme des quatre sections, repli sur les clés actuelles quand `finance/counts` est absent.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests unitaires + e2e `alertes.spec.ts`, `audit.spec.ts`, `overview.spec.ts`, `user-profile.spec.ts`, `colis-reorganisation.spec.ts` (non-régression) → PASS.
- [ ] **Step 5: Commit** — `feat(liens): arrivées précises depuis alertes, audit, colis, fiche utilisateur et vue d'ensemble`.

### Task 12: Tests e2e, vérifications finales et documentation

**Files:**
- Create: `tests/e2e/transactions-reorganisation.spec.ts`, `tests/e2e/transactions-liens.spec.ts`
- Modify: `docs/` si une page d'aide admin existe (sinon rien)
- Test: suite complète

- [ ] **Step 1: e2e `transactions-reorganisation.spec.ts`** (routes du back simulées par un gestionnaire `/admin/payments**` qui lit le chemin, comme `colis-reorganisation.spec.ts`) : vue « À traiter » par défaut avec nombres ; suggestions et choix d'un expéditeur → puce retirable + URL ; recherche par trajet et par montant ; vue « En séquestre » ; tiroir à cinq onglets avec onglet dans l'URL (`?section=incidents`) ; bandeau de retenue et dérogation ; menu « Actions » grisé avec raisons selon permissions ; export CSV ; quatre sections avec pastilles ; sous-onglets ; mobile money « Échecs » ; portefeuilles avec noms ; litiges bancaires ; **repli ancien back** (counts/suggest/finance counts en 404 → sept onglets plats, pas de nombres) ; liens entrants historiques (`?tab=wallets`, `?tab=wallet-refunds`, `?held=true`, `?open=<paiement>`) ; Échap ferme le tiroir ; support sans `DISPUTE_VIEW`/`MODERATION_VIEW` : ces liens absents du DOM.
- [ ] **Step 2: e2e `transactions-liens.spec.ts`** : un test **aller** par destination du tableau « Sortants » (clic dans le tiroir → l'URL cible exacte est atteinte et la page cible montre l'élément : colis `?open=<colis>&section=tracking` ouvre l'onglet Suivi ; trajet ouvre l'annonce en évidence ; litige ouvre le litige ; conversation ouvre la modération ; alerte ouvre l'alerte ; journal affiche les filtres PAYMENT + identifiant ; fiche utilisateur ouvre l'onglet voulu) et un test **retour** par ligne du tableau « Entrants » (colis → paiement retenu onglet Incidents ; annonce → liste filtrée avec puce « Trajet » ; fiche utilisateur → liste filtrée sur la personne ; carte `escrowJ48` → liste dont le nombre égale celui de la carte ; alerte mobile money → vue Échecs). Bouton Retour du navigateur : revient à la fiche d'origine.
- [ ] **Step 3: Vérifications** : `npm run lint` et `npm run typecheck` sans erreur ; `npx vitest run --coverage` → 0 rouge (en local, `permissionCoverage.spec.ts` peut échouer si le `dony-back` voisin est périmé : vérifier qu'il passe en CI) et couverture lignes ≥ 90 % (relever le pourcentage) ; `npx playwright test` complet → 0 rouge ; `grep` : plus aucune chaîne `'/transactions?` ni `'/colis?` écrite à la main hors `adminLinks.ts` et des tests.
- [ ] **Step 4: Ouvrir la PR** (description citant la PR backend jumelle, la maquette et le spec, terminée par `https://claude.ai/code/session_01Ab8Dd9TaHrGuJbHPnaxbdb`) ; CI verte ; **fusion après le backend**, puis vérification que le backend est déployé sur l'environnement visé (règle des PR jumelles).
- [ ] **Step 5: Commit** — `test(transactions): e2e de la réorganisation et des liens`.
