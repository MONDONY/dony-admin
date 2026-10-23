# Réorganisation de la page Transactions, partie backend : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux listes Transactions du back-office des vues à nombre avec une alerte unique, une recherche multi-critères avec suggestions, des lignes enrichies (noms, trajet, n° de suivi, identifiants de destination) et les identifiants de liens qui permettent à l'admin de rebondir vers le colis, le trajet, le litige, la conversation, l'alerte et le journal.

**Architecture:** On étend `AdminPaymentController`, `AdminFinanceController` et `AdminChargebackController` (package `com.yadony.api.admin`). Le calcul d'alerte vit **une seule fois** dans des fragments SQL constants (`AdminPaymentSql`), réutilisés par la liste, les nombres, le tri, l'étiquette de ligne et la carte `escrowJ48` de la vue d'ensemble. Les listes finance (portefeuilles, commissions cash, mobile money, litiges bancaires) passent par une classe de lecture dédiée (`AdminFinanceListings`, SQL natif) au lieu des dépôts JPA. Même méthode que la page Colis (`AdminBidSql`).

**Tech Stack:** Spring Boot 3.4 (Java 21), `NamedParameterJdbcTemplate` en SQL natif PostgreSQL ET H2 (tests, Flyway désactivé), JUnit 5, MockMvc, Mockito.

**Spec:** `dony-admin/docs/superpowers/specs/2026-10-23-transactions-reorganisation-design.md` (lire en premier ; en cas de conflit avec ce plan, le spec gagne). Plan jumeau : `…-transactions-reorganisation-admin.md`. Maquette : https://claude.ai/artifact/KMizmg9VkAW8hyUh1Jj8DF. Modèle à imiter : le plan et le code de la page Colis (`AdminBidSql`, `AdminBidsController`, `AdminBidsCountsIT`, `AdminBidsSuggestIT`, `AdminBidSearchIT`).

Travail dans `dony-back`, worktree `dony-back/.claude/worktrees/transactions-reorganisation`, branche `feature/admin-transactions-reorganisation` créée depuis `origin/main` (`5582347c`). Chemins relatifs à `src/main/java/com/yadony/api/` (tests : `src/test/java/com/yadony/api/`). Commandes : `./mvnw test -Dtest=<Classe>`, suite complète : `./mvnw verify -DforkCount=2` (jamais 3 : l'`initdb` de PostgreSQL embarqué échoue en parallèle).

## Global Constraints

- Jamais de commit sur `main`. Messages de commit terminés par `Claude-Session: https://claude.ai/code/session_01Ab8Dd9TaHrGuJbHPnaxbdb`. Pas de `Co-Authored-By`.
- Aucune migration, aucune nouvelle extension, aucune nouvelle `AdminPermission`. Droits existants : `PAYMENT_VIEW` (classes `AdminPaymentController`, `AdminFinanceController`, `AdminChargebackController`), `BID_VIEW`, `DISPUTE_VIEW`, `MODERATION_VIEW`, `USER_VIEW`, `ALERT_VIEW`, `AUDIT_VIEW`, lus par `AdminBidDetailAssembler.Access.of(authentication)` ou par `hasAuthority`. **Chaque identifiant de lien n'est renvoyé que si l'appelant détient la permission de la destination** (spec §Carte des liens).
- Jackson `NON_NULL` : un champ null est omis du JSON. Les tests utilisent `jsonPath(...).doesNotExist()`.
- Les DTO existants gardent leur contrat : on **ajoute en fin** de record (constructeur secondaire pour les appelants existants), jamais de renommage ni de retrait.
- Le SQL natif tourne sur PostgreSQL ET H2 (mode PostgreSQL) : `TRANSLATE`, `LOWER`, `CONCAT_WS`, `COALESCE`, `EXISTS`, `CAST(x AS VARCHAR)`, `INTERVAL 'n' HOUR`. Pas de `ILIKE`, `unaccent`, `::`, `similarity`. Paramètres facultatifs via `CAST(:p AS …)`.
- Repli d'accents identique en Java et en SQL : réutiliser `AdminSearchTerms.fold/tokens` et les fragments `FOLD_OPEN/FOLD_CLOSE` (les rendre `public` dans `AdminBidSql` ou les déplacer dans `AdminSearchTerms` sans changer leur valeur ; la page Colis ne doit pas bouger).
- **Aucune recherche par numéro de téléphone mobile money** : `msisdn` est chiffré, `msisdn_masked` vaut `+221 •••• 67`. Le numéro reste masqué dans toutes les réponses.
- Montants en centimes (`AdminWalletResponse.toCents`), une ligne de totaux par devise, jamais d'addition entre devises.
- Les checkouts abandonnés (`PENDING` depuis plus de 24 h) restent filtrés par `hideAbandoned` comme aujourd'hui ; les vues ne les cachent pas d'elles-mêmes.
- Horloge : un `java.time.Clock` injecté (`config/ClockConfig`), paramètre `:now` (UTC) ; les tests utilisent `Clock.fixed`.
- Code mort interdit (CLAUDE.md règle 22) : toute méthode de dépôt JPA remplacée (`findCashCommissions`, `findAllByOrderByOpenedAtDesc`, `findAllByOrderByCreatedAtDesc` de `PawapayOperationRepository`, `findAll(pageable)` des portefeuilles pour la liste admin) est supprimée avec ses tests dès qu'elle n'a plus d'appelant (vérifier par `grep` avant).
- Couverture JaCoCo ≥ 90 % sur la suite complète. Un test de régression pour chaque comportement existant touché (gestes, export CSV, totaux, chronologie).
- Aucune fiche de l'assistant à changer (rien de visible dans l'app mobile).

## Contrat d'API (source de vérité des deux plans)

**`GET /admin/payments`** (existant, étendu). Paramètres existants inchangés (`status`, `method`, `currency`, `dateFrom`, `dateTo`, `held`, `q`, `hideAbandoned`, `page`, `size`). Nouveaux, tous optionnels : `view` (`ALL` par défaut ; `ATTENTION`, `ESCROW`, `RELEASED_RECENT`, `REFUNDED`, `FAILED`), `alert` (`HELD`, `CHARGEBACK_OPEN`, `MM_FAILED`, `ESCROW_J48`), `partyId` (UUID, expéditeur OU voyageur), `announcementId` (UUID), `bidId` (UUID, colis direct ou lié au fil), `amountMin`, `amountMax` (centimes, bornes incluses). Une valeur inconnue de `view` ou `alert` répond 400 (conversion Spring). `GET /admin/payments/summary` et `/export` acceptent exactement les mêmes filtres (même périmètre, déjà la règle).

Nouveaux champs de `AdminPaymentListItemResponse`, ajoutés après `insight` dans cet ordre : `String alert` (code de l'alerte la plus urgente, absent si aucune), `String trackingNumber` (colis direct ou lié, absent si inconnu), `UUID announcementId`.

**`GET /admin/payments/counts`** : mêmes paramètres que la liste **sauf** `view`, `alert`, `status`, `page`, `size`. Réponse `AdminPaymentCountsResponse(long attention, long escrow, long releasedRecent, long refunded, long failed, long all, long abandoned, Alerts alerts)` avec `Alerts(long held, long chargebackOpen, long mmFailed, long escrowJ48)`. `abandoned` = checkouts abandonnés dans le périmètre, **même quand** `hideAbandoned` les masque (c'est le nombre du lien « les afficher »).

**`GET /admin/payments/suggest?q=`** (`q` de 2 caractères minimum, sinon 200 avec groupes vides) : `AdminPaymentSuggestResponse(UUID exactPaymentId, List<Person> senders, List<Person> travelers, List<Trip> trips, List<Parcel> parcels)` ; `Person(UUID id, String name, long count)` ; `Trip(String label, String departureCity, String arrivalCity, long count)` ; `Parcel(UUID paymentId, String trackingNumber, String status, long amountCents, String currency)`. Cinq éléments maximum par groupe. `exactPaymentId` renseigné quand `q` est l'UUID d'un paiement, d'un colis, d'une négociation, d'une opération pawaPay, ou une référence Stripe/pawaPay exacte d'un seul paiement.

**`GET /admin/payments/{id}`** (existant) gagne, après les champs actuels : `String alert`, `String trackingNumber`, `Links links`, `List<OpenAlert> openAlerts`, `Chargeback chargeback`. `Links(UUID announcementId, UUID disputeId, String disputeStatus, UUID cancellationId, String conversationId, UUID chargebackId, UUID packageRequestId)`. `OpenAlert(UUID id, String type, String severity)`. `Chargeback(UUID id, String status, String reason, String outcome, LocalDateTime openedAt)`. Permissions : `links.disputeId/disputeStatus/cancellationId` avec `DISPUTE_VIEW`, `links.conversationId` avec `MODERATION_VIEW`, `links.announcementId/packageRequestId` avec `BID_VIEW`, `links.chargebackId` et `chargeback` avec `PAYMENT_VIEW` (toujours vraie ici), `openAlerts` avec `ALERT_VIEW` ; sinon absents.

**`GET /admin/alerts/{id}`** (nouveau, `ALERT_VIEW`) : `AdminAlertResponse` existant ; 404 `alert-not-found`.

**`GET /admin/mobile-money-payments`** (existant, étendu) : paramètres `view` (`ALL` par défaut ; `FAILED`, `OPEN`, `DONE`), `kind` (`DEPOSIT`, `PAYOUT`, `REFUND`), `provider`, `q`, `page`, `size`. Nouveaux champs de `AdminMobileMoneyResponse`, en fin : `String purpose`, `UUID personId`, `String personName`, `String role` (`SENDER`, `TRAVELER`, `USER`), `UUID bidId`, `String trackingNumber`, `String corridor` (« Paris → Dakar »), `UUID walletRefundRequestId`, `boolean retryable`. **`GET /admin/mobile-money-payments/counts`** (mêmes `kind`, `provider`, `q`) : `AdminMobileMoneyCountsResponse(long failed, long open, long done, long all, long attention)`.

**`GET /admin/wallets`** (existant, étendu) : `q` (nom, prénom, pseudo ou UUID du titulaire), `currency`, `balanceSign` (`POSITIVE`, `NEGATIVE`, `ZERO`), `partyId` (UUID du titulaire). Nouveau champ de `AdminWalletResponse`, en fin : `String userName`.

**`GET /admin/cash-commissions`** (existant, étendu) : `view` (`ALL` par défaut, `ATTENTION` = `FAILED`, `REQUIRES_3DS`, `REFUND_FAILED`), `status` (`CommissionStatus`), `q`, `partyId` (le voyageur). Nouveaux champs de `AdminCashCommissionResponse`, en fin : `String trackingNumber`, `String corridor`, `UUID travelerId`, `String travelerName`. **`GET /admin/cash-commissions/counts`** : `AdminCashCommissionCountsResponse(long attention, long all)`.

**`GET /admin/chargebacks`** (existant, étendu) : `view` (`ALL` par défaut, `OPEN`, `WON`, `LOST`), `q`. Nouveaux champs de `AdminChargebackResponse`, en fin : `UUID paymentId`, `String trackingNumber`, `String corridor`, `UUID senderId`, `String senderName`, `UUID travelerId`, `String travelerName`, `String outcome`, `LocalDateTime resolvedAt`. **`GET /admin/chargebacks/counts`** : `AdminChargebackCountsResponse(long open, long won, long lost, long all)`.

**`GET /admin/finance/counts`** (nouveau, `PAYMENT_VIEW`) : `AdminFinanceCountsResponse(long payments, long mobileMoney, long soldes, long chargebacks, Details details)` ; `Details(long paymentsAttention, long mobileMoneyAttention, long walletRefundsPending, long cashCommissionsAttention, long chargebacksOpen)` ; `payments = paymentsAttention`, `mobileMoney = mobileMoneyAttention`, `soldes = walletRefundsPending + cashCommissionsAttention`, `chargebacks = chargebacksOpen`. `walletRefundsPending` vient de `AdminQueueCounter.countPendingWalletRefunds()` (le rendre `public`) : même nombre que la pastille du menu.

**`GET /admin/audit-log`** (existant) gagne le paramètre `entityId` (UUID texte).

## Définitions (valeurs de mon choix, constantes dans `AdminPaymentSql`, spec §Appels n° 4)

- Rang d'alerte du paiement (le plus petit gagne ; 0 = aucune) : **1 `HELD`** (`status = 'ESCROW'` et `payout_held_at IS NOT NULL`, c'est le filtre `held` actuel) ; **2 `CHARGEBACK_OPEN`** (un litige bancaire `status = 'OPEN'` avec `payment_id = p.id`, ou sans `payment_id` et `bid_id` égal au colis effectif du paiement) ; **3 `MM_FAILED`** (une opération `pawapay_operations` de ce paiement, `kind IN ('PAYOUT','REFUND')`, `status IN ('FAILED','SUBMIT_REJECTED')`, **sans** opération plus récente du même `kind` et du même paiement dont le `status` ne soit pas dans ('FAILED','SUBMIT_REJECTED')) ; **4 `ESCROW_J48`** (`status = 'ESCROW'` et `created_at < :now - 48 h`, identique à `AdminMetricsService.countEscrowJ48` et à l'alerte `ESCROW_J48_TIMEOUT`).
- Vues : `ATTENTION` = rang > 0 ; `ESCROW` = `status = 'ESCROW'` ; `RELEASED_RECENT` = `status = 'RELEASED'` et `COALESCE(escrow_released_at, created_at) >= :now - 72 h` ; `REFUNDED` = `status = 'REFUNDED'` ; `FAILED` = `status IN ('FAILED','CANCELLED')` ; `ALL` = sans restriction.
- Tri : vue `ATTENTION` → rang croissant, puis `created_at` croissant, puis `id` ; toute autre vue → `created_at` décroissant puis `id` décroissant.
- Colis effectif d'un paiement : `COALESCE(b.id, lb.id)` où `b` = `bids.id = p.bid_id` et `lb` = colis lié au fil (`p.bid_id IS NULL AND lb.linked_negotiation_thread_id = p.negotiation_thread_id`), comme `AdminPaymentInsights.linksOf`. Expéditeur effectif : `COALESCE(b.sender_id, lb.sender_id, r.sender_id)` ; voyageur effectif : `COALESCE(a.traveler_id, la.traveler_id, t.traveler_id)` ; villes : `COALESCE(a.departure_city, la.departure_city, r.departure_city)` et l'arrivée de même ; n° de suivi : `COALESCE(b.tracking_number, lb.tracking_number)`.

## Review Focus (cas que le spec suppose sans que les tâches les nomment)

1. Un fil de négociation avec colis lié ne doit **pas** dupliquer le paiement dans la liste, les nombres ni l'export (jointure `lb`).
2. Un compte supprimé : ses paiements restent dans la liste ; il n'apparaît pas dans les suggestions.
3. Saisie `%`, `'` ou `_` seule : liste vide (`NO_MATCH_TOKEN`), jamais « tout ».
4. Un opérateur sans `ALERT_VIEW`, `DISPUTE_VIEW` ou `MODERATION_VIEW` ne reçoit **aucun** identifiant de lien de ces destinations (champ absent, pas `null` explicite).
5. Les trois nombres « séquestre de plus de 48 h » (carte `escrowJ48`, alerte `ESCROW_J48_TIMEOUT`, `alerts.escrowJ48`) sont égaux sur le même jeu de données.

---

### Task 1: Filtre étendu, vues, alertes et montants

**Files:**
- Create: `admin/AdminPaymentView.java`, `admin/AdminPaymentAlert.java` (enums), `admin/AdminPaymentSql.java`
- Modify: `admin/AdminPaymentFilter.java`, `admin/AdminSearchTerms.java`, `admin/AdminBidSql.java` (rendre `FOLD_OPEN`/`FOLD_CLOSE` publics)
- Test: `admin/AdminSearchTermsTest.java` (existant, étendre), `admin/AdminPaymentFilterTest.java` (nouveau)

**Interfaces:**
- Produces: `enum AdminPaymentView { ALL, ATTENTION, ESCROW, RELEASED_RECENT, REFUNDED, FAILED }` ; `enum AdminPaymentAlert { HELD(1), CHARGEBACK_OPEN(2), MM_FAILED(3), ESCROW_J48(4) }` avec `int rank()` et `static Optional<AdminPaymentAlert> ofRank(int)` ; `AdminSearchTerms.amountCents(String): OptionalLong` ; `AdminPaymentFilter` gagne `AdminPaymentView view`, `AdminPaymentAlert alert`, `UUID partyId`, `UUID announcementId`, `UUID bidId`, `Long amountMin`, `Long amountMax` et une fabrique `of(...)` à 15 arguments ; l'ancienne fabrique à 8 arguments reste et délègue avec les valeurs par défaut.

- [ ] **Step 1: Write the failing tests**

`AdminSearchTermsTest` : `amountCents("120")` = 12000 ; `("120,00")` = 12000 ; `("120.5")` = 12050 ; `("1 200,50 €")` = 120050 ; `("120 000 F")` = 12000000 ; `("12,345")` = vide (trois décimales) ; `("abc")`, `("")`, `(null)`, `("pi_3Q8")` = vide ; `("-5")` = vide.

`AdminPaymentFilterTest` : l'ancienne fabrique à 8 arguments donne `view = ALL`, `alert = null`, `partyId/announcementId/bidId = null`, bornes nulles ; la nouvelle normalise `view`/`alert` en majuscules et vide → défaut ; `AdminPaymentAlert.ofRank(3)` = `MM_FAILED`, `ofRank(0)` vide, `ofRank(9)` vide.

- [ ] **Step 2: Run to verify they fail** — `./mvnw test -Dtest=AdminSearchTermsTest+AdminPaymentFilterTest` → FAIL (symboles absents).

- [ ] **Step 3: Implement**

`AdminSearchTerms.amountCents` : retire espaces (y compris insécables), `€`, `F`, `CFA`, `XOF`, `XAF`, `$` ; accepte une virgule ou un point décimal, au plus deux décimales ; renvoie des centimes ; rien d'autre. `AdminPaymentSql` : constantes de compilation exposant `FROM_JOIN` (alias `p`, `b`, `lb`, `a`, `la`, `t`, `r`, `s` expéditeur effectif, `tr` voyageur effectif), `EFF_BID_ID`, `EFF_TRACKING`, `EFF_ANNOUNCEMENT_ID`, `EFF_SENDER_ID`, `EFF_TRAVELER_ID`, `EFF_DEPARTURE`, `EFF_ARRIVAL` (définitions ci-dessus), `ALERT_RANK`, un fragment par vue et `VIEW_PREDICATE` (même technique que `AdminBidSql.VIEW_PREDICATE`), `ORDER_BY`, `COUNTS_SELECT`. Tout est écrit une seule fois ici.

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): filtres, vues et alerte des transactions`.

### Task 2: Requête de liste, totaux et export sur la jointure effective

**Files:**
- Modify: `admin/AdminPaymentInsights.java` (`where`, `search`, `exportRows`, `totals`, `load`), `admin/AdminPaymentController.java` (`list`, `summary`, `export` : nouveaux paramètres et `Clock`)
- Test: `admin/AdminPaymentViewsIT.java` (nouveau), `admin/AdminPaymentInsightsIT.java` (régression, existant)

**Interfaces:**
- Consumes: Task 1.
- Produces: `AdminPaymentInsights.search(AdminPaymentFilter, LocalDateTime now, Pageable)`, `totals(filter, now)`, `exportRows(filter, now)` ; `Map<UUID,Integer> alertRanks(Collection<UUID> paymentIds, LocalDateTime now)` (même SQL `ALERT_RANK`, un aller-retour).

- [ ] **Step 1: Write the failing tests** (`AdminPaymentViewsIT`, un jeu de données par test, scopé par son propre pseudo d'expéditeur comme `AdminPaymentInsightsIT`, horloge fixe) :
  - `attentionContainsHeldChargebackFailedMobileMoneyAndLateEscrow` : quatre paiements, un par alerte ; `ATTENTION` les renvoie dans l'ordre HELD, CHARGEBACK_OPEN, MM_FAILED, ESCROW_J48 ; un cinquième paiement `ESCROW` créé il y a 2 h n'y figure pas.
  - `onlyMostUrgentAlertCounts` : un paiement à la fois retenu et `ESCROW` de 3 jours porte le rang 1 ; `alert=ESCROW_J48` ne le contient pas.
  - `failedMobileMoneyIsClearedBySuccessfulRetry` : un `PAYOUT` en échec puis un `PAYOUT` `COMPLETED` plus récent : plus d'alerte `MM_FAILED` ; un `PAYOUT` en échec puis un `PAYOUT` `PROCESSING` plus récent : plus d'alerte non plus ; un `DEPOSIT` en échec seul : pas d'alerte.
  - `chargebackWithoutPaymentIdMatchesByBid` : litige `OPEN` sans `payment_id`, `bid_id` du colis du paiement : alerte `CHARGEBACK_OPEN`.
  - `viewsFilterByStatus` : `ESCROW`, `RELEASED_RECENT` (libéré il y a 2 j inclus, il y a 5 j exclus), `REFUNDED`, `FAILED` (`FAILED` et `CANCELLED`), `ALL`.
  - `linkedNegotiationBidDoesNotDuplicatePayment` : un paiement de négociation dont le colis est lié apparaît **une fois** en liste, en export et dans `totals` (Review Focus 1).
  - `partyAnnouncementBidAndAmountFilters` : `partyId` (l'expéditeur puis le voyageur renvoient le même paiement ; un tiers aucun), `announcementId`, `bidId` (direct et lié au fil), `amountMin/Max` inclusifs en centimes.
  - `hideAbandonedStillWorksWithViews`.
  - Régression : les 12 cas existants d'`AdminPaymentInsightsIT` passent inchangés.

- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** `where(filter, params, now)` utilise `AdminPaymentSql.FROM_JOIN` et les expressions effectives ; toutes les requêtes (`COUNT`, page, export, totaux) partagent le même `FROM_JOIN` + `WHERE`. Le contrôleur injecte `Clock` et passe `LocalDateTime.now(clock)`. Les paramètres `partyId`, `announcementId`, `bidId` mal formés répondent 400.
- [ ] **Step 4: Run** `./mvnw test -Dtest='AdminPayment*IT,AdminPaymentControllerTest'` → PASS.
- [ ] **Step 5: Commit** — `feat(admin): vues et alerte unique des paiements`.

### Task 3: Recherche multi-critères

**Files:**
- Modify: `admin/AdminPaymentSql.java` (`SEARCH_PREDICATE`), `admin/AdminPaymentInsights.java` (`appendSearch` remplacé)
- Test: `admin/AdminPaymentSearchIT.java` (nouveau)

**Interfaces:** Produces rien de public ; `q` de la liste, des totaux, des nombres et de l'export s'enrichit.

- [ ] **Step 1: Write the failing tests** (`AdminPaymentSearchIT`) :
  - Jetons (jusqu'à 4, tous requis, ET) cherchés dans un texte replié : n° de suivi, nom/prénom/pseudo de l'expéditeur et du voyageur, ville de départ, ville d'arrivée. « Paris Dakar » trouve le trajet ; « paris dakar » aussi ; « Awa Diallo » trouve ; « diallo awa » aussi.
  - Accents et apostrophes repliés : « Aïcha » = « aicha », « N'Diaye » = « ndiaye » ; accent dans la ville (« Thiès »).
  - Partiel : « 8f3k » trouve `YD-8F3K2Q` ; `DON-` historique aussi.
  - Montant : « 120 », « 120,00 », « 120.00 € » trouvent un paiement de 120,00 ; « 120 » ne trouve pas 1 200,00 ; un montant se combine en OU avec les jetons (« 120 » trouve aussi le colis `YD-120AB`).
  - Identifiants exacts (UUID) : paiement, colis direct, colis lié au fil, négociation, annonce, opération pawaPay du paiement, litige bancaire du paiement.
  - Références : `pi_…` et `ch_…` exacts (inchangé), identifiant du fournisseur d'une opération pawaPay (`provider_transaction_id`).
  - `%`, `_`, `'` seuls : liste vide. Chaîne de 5 mots : seuls les 4 premiers comptent.
  - Compte supprimé : le paiement reste trouvable par n° de suivi.
  - **Le téléphone d'une opération n'est jamais cherché** : un `q` égal à un numéro (« 221771234567 » ou « 67 ») ne trouve rien de plus que le texte.
  - Régression : les recherches de `AdminPaymentInsightsIT` (pi_, ch_, DON-, nom) passent inchangées.

- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Même construction que `AdminBidSql.SEARCH_PREDICATE` : `:t1` à `:t4` (déjà repliés), `:idTerm`, `:refTerm`, `:amountCents`. Le texte replié concatène par des espaces les champs effectifs ci-dessus plus `s.first_name, s.last_name, s.username` et les mêmes du voyageur. Les anciens cas `pi_/ch_/mm_` et `DON-` sont absorbés (le préfixe `DON-` devient un jeton ordinaire).
- [ ] **Step 4: Run** `./mvnw test -Dtest='AdminPayment*IT'` → PASS.
- [ ] **Step 5: Commit** — `feat(admin): recherche multi-critères des paiements`.

### Task 4: Liste enrichie (étiquette, n° de suivi, trajet)

**Files:**
- Modify: `admin/dto/AdminPaymentListItemResponse.java`, `admin/AdminPaymentController.java` (`list`), `admin/AdminPaymentInsights.java` (`toItems`/`insightsOf` : n° de suivi et annonce)
- Test: `admin/AdminPaymentControllerListIT.java` (nouveau)

**Interfaces:** Produces les champs `alert`, `trackingNumber`, `announcementId` (contrat ci-dessus).

- [ ] **Step 1: Write the failing tests** : MockMvc avec `PAYMENT_VIEW` : `alert` vaut `HELD` pour un paiement retenu, absent sans alerte ; `trackingNumber` présent pour un colis direct et pour un colis lié au fil, absent pour une négociation sans colis ; `announcementId` présent quand l'annonce existe ; `view=ATTENTION` renvoie l'ordre d'urgence ; `view=nimporte` répond 400 ; sans `PAYMENT_VIEW` : 403. Régression : les champs historiques (`insight`, `beneficiaryHeld`…) sont inchangés.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** `Links` interne de `AdminPaymentInsights` gagne `trackingNumber` et `announcementId` (déjà joints) ; `alert` vient d'`alertRanks` en un aller-retour pour la page.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): lignes de paiement enrichies`.

### Task 5: Nombres par vue

**Files:**
- Create: `admin/dto/AdminPaymentCountsResponse.java`
- Modify: `admin/AdminPaymentController.java` (`GET /counts`), `admin/AdminPaymentInsights.java` (`counts`), `admin/AdminPaymentSql.java` (`COUNTS_SELECT`)
- Test: `admin/AdminPaymentCountsIT.java`

**Interfaces:** Produces `AdminPaymentCountsResponse` (contrat ci-dessus).

- [ ] **Step 1: Write the failing tests** : un jeu de données varié : chaque nombre égale la taille de la liste renvoyée par la vue correspondante pour les mêmes filtres ; `attention` = somme des quatre `alerts` ; `all` égale le total de la liste sans vue ; `abandoned` compte les `PENDING` de plus de 24 h **même avec `hideAbandoned=true`** et `all` les exclut dans ce cas ; la recherche `q`, `currency`, `partyId` restreignent tous les nombres ; `alerts.escrowJ48` égale `AdminMetricsService.countEscrowJ48` sur le même jeu (Review Focus 5) ; 403 sans `PAYMENT_VIEW`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** par agrégation conditionnelle en un aller-retour (`COALESCE(SUM(CASE …), 0)`), sur la même jointure et le même `WHERE` (sans `view`, `alert`, `status`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): nombres par vue des paiements`.

### Task 6: Suggestions de recherche

**Files:**
- Create: `admin/dto/AdminPaymentSuggestResponse.java`
- Modify: `admin/AdminPaymentController.java` (`GET /suggest`), `admin/AdminPaymentSql.java` (cinq requêtes de suggestion, `SUGGEST_LIMIT = 5`), `admin/AdminPaymentInsights.java` (`suggest`)
- Test: `admin/AdminPaymentSuggestIT.java`

**Interfaces:** Produces `AdminPaymentSuggestResponse` (contrat ci-dessus).

- [ ] **Step 1: Write the failing tests** (modèle `AdminBidsSuggestIT`) : `q` d'un caractère → groupes vides, 200 ; « awa » → expéditeurs et voyageurs correspondants avec leur nombre de paiements, triés par nombre décroissant puis nom ; « paris dak » → un trajet groupé sur le couple (départ, arrivée) replié (« Paris » et « paris » ne font qu'un) ; « yd-8f » → n° de suivi avec statut et montant ; 5 maximum par groupe ; compte supprimé absent des personnes ; `exactPaymentId` renseigné pour l'UUID d'un paiement, d'un colis, d'une négociation, d'une opération, pour un `pi_` exact, et **absent** quand la référence est ambiguë ; 403 sans `PAYMENT_VIEW` ; aucun numéro de téléphone dans aucune réponse.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** comme `AdminBidSql.SUGGEST_*` (sous-requêtes `x.hay` repliées, mêmes jetons `:t1..:t4`), sur les colonnes effectives.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): suggestions de recherche des paiements`.

### Task 7: Fiche paiement : alerte, liens et alertes ouvertes

**Files:**
- Create: `admin/AdminPaymentLinks.java` (résolution des identifiants de destination), `admin/dto/AdminPaymentDetailLinks.java` (ou records imbriqués), `GET /admin/alerts/{id}` dans `admin/AdminAlertController.java`
- Modify: `admin/AdminPaymentController.java` (`get` ajoute les blocs), `admin/AdminBidDetailAssembler.java` (extraire la recherche litige/annulation/conversation d'un colis en méthode partagée, sans changer la fiche colis), `admin/AdminAlertRepository.java` (alertes ouvertes d'un paiement)
- Test: `admin/AdminPaymentLinksIT.java`, `admin/AdminAlertControllerTest.java` (étendre)

**Interfaces:**
- Consumes: Task 4 (`alertRanks`).
- Produces: `AdminPaymentLinks.of(PaymentEntity, AdminPaymentInsight, Access access, boolean canViewAlerts): Result` avec `links`, `openAlerts`, `chargeback` selon la permission.

- [ ] **Step 1: Write the failing tests** : un administrateur avec toutes les permissions reçoit `links.announcementId`, `links.disputeId` + `disputeStatus` (dernier litige du colis), `links.cancellationId` (dernière annulation/no-show), `links.conversationId` (identifiant Firestore), `links.chargebackId`, `links.packageRequestId` (via le fil de négociation), `openAlerts` (alertes `resolved=false` dont le `payload` contient l'identifiant du paiement, comme `EscrowScheduler`), `chargeback` (le plus récent) et `alert`/`trackingNumber` ; **un support sans `DISPUTE_VIEW`, `MODERATION_VIEW`, `ALERT_VIEW` ne reçoit pas** `disputeId`, `cancellationId`, `conversationId`, `openAlerts` (champs absents) mais reçoit toujours `announcementId` et `chargebackId` (Review Focus 4) ; paiement de négociation sans colis : `packageRequestId` présent, le reste absent ; ancien contrat conservé (champs historiques inchangés) ; `GET /admin/alerts/{id}` : 200 avec `ALERT_VIEW`, 404 `alert-not-found` sinon, 403 sans la permission. Régression : `AdminBidDetailAssemblerTest` passe inchangé.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Le blocage par permission se fait dans `AdminPaymentLinks`, jamais dans le front.
- [ ] **Step 4: Run** `./mvnw test -Dtest='AdminPayment*,AdminBidDetailAssemblerTest,AdminAlertControllerTest'` → PASS.
- [ ] **Step 5: Commit** — `feat(admin): liens et alertes de la fiche paiement`.

### Task 8: Mobile money : vues, recherche, personne et colis

**Files:**
- Create: `admin/AdminFinanceListings.java`, `admin/AdminFinanceSql.java`, `admin/dto/AdminMobileMoneyCountsResponse.java`
- Modify: `admin/AdminFinanceController.java` (`mobileMoneyPayments`, `GET /mobile-money-payments/counts`), `admin/dto/AdminMobileMoneyResponse.java`, `payments/pawapay/PawapayOperationRepository.java` (retirer `findAllByOrderByCreatedAtDesc` s'il n'a plus d'appelant)
- Test: `admin/AdminMobileMoneyListingIT.java`

**Interfaces:**
- Produces: `AdminFinanceListings.mobileMoney(view, kind, provider, q, Pageable, now)` et `mobileMoneyCounts(kind, provider, q)`.

- [ ] **Step 1: Write the failing tests** : `view=FAILED` ne renvoie que `FAILED` et `SUBMIT_REJECTED` ; `OPEN` renvoie `CREATED, ACCEPTED, PROCESSING, ENQUEUED, IN_RECONCILIATION` ; `DONE` renvoie `COMPLETED` ; `attention` du compteur = échecs `PAYOUT`/`REFUND` non remplacés (même règle que `MM_FAILED`) ; personne : un `PAYOUT` d'un paiement de colis → voyageur (`role=TRAVELER`), un `DEPOSIT` ou `REFUND` → expéditeur (`SENDER`), un `WALLET_TOPUP`/`WALLET_REFUND` → `user_id` (`USER`) avec `walletRefundRequestId` quand elle est retrouvable, un `BID_SUPPLEMENT` → expéditeur du colis du supplément avec `bidId` ; `trackingNumber`, `corridor` (« Paris → Dakar ») pour les opérations liées à un colis ; `retryable` vrai seulement pour le dernier `PAYOUT` mort d'un paiement `RELEASED` ou le dernier `REFUND` mort d'un paiement `REFUNDED`/`CANCELLED` ; recherche `q` : identifiant d'opération, identifiant du fournisseur, identifiant de paiement ou de colis, n° de suivi, nom de la personne, trajet, accents repliés ; **`q` égal à un numéro de téléphone ne trouve rien** ; le numéro reste masqué (`+221 •••• 67`) ; 403 sans `PAYMENT_VIEW`. Régression : `AdminFinanceControllerIT` (mobile money) passe inchangé.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** en SQL natif (une requête de page, une de total, résolution de la personne par `CASE` sur `purpose` et `kind`, jointure sur les colonnes effectives de `AdminPaymentSql`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): mobile money lisible et filtrable`.

### Task 9: Portefeuilles et commissions cash

**Files:**
- Modify: `admin/AdminFinanceListings.java`, `admin/AdminFinanceSql.java`, `admin/AdminFinanceController.java` (`wallets`, `cashCommissions`, `GET /cash-commissions/counts`), `admin/dto/AdminWalletResponse.java`, `admin/dto/AdminCashCommissionResponse.java`, `matching/BidRepository.java` (retirer `findCashCommissions` si sans appelant), `payments/wallet/WalletAccountRepository.java` (idem pour l'usage de liste)
- Create: `admin/dto/AdminCashCommissionCountsResponse.java`
- Test: `admin/AdminWalletsListingIT.java`, `admin/AdminCashCommissionsListingIT.java`

**Interfaces:** Produces `AdminFinanceListings.wallets(q, currency, balanceSign, partyId, pageable)`, `cashCommissions(view, status, q, partyId, pageable)`, `cashCommissionCounts()`.

- [ ] **Step 1: Write the failing tests** : portefeuilles : `userName` rendu (« Prénom Nom (@pseudo) » comme `namesOf`), `q` par nom/pseudo/UUID, accents repliés, `currency`, `balanceSign` (`POSITIVE`, `NEGATIVE`, `ZERO`), `partyId`, compte supprimé : le portefeuille reste listé avec `userName` absent ; commissions cash : `trackingNumber`, `corridor`, `travelerId`, `travelerName` rendus, `view=ATTENTION` = `FAILED`, `REQUIRES_3DS`, `REFUND_FAILED`, `status` exact, `q` par n° de suivi/nom/trajet, `partyId` = voyageur, `counts.attention` égal à la taille de la vue ; seuls les colis `PaymentMethod.CASH` avec `commissionStatus` non nul sont listés (comportement actuel conservé) ; ordre `created_at` décroissant. Régression : `AdminFinanceControllerIT` (portefeuilles, cash) passe inchangé.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): portefeuilles et commissions cash lisibles`.

### Task 10: Litiges bancaires, nombres des sections et filtre d'audit

**Files:**
- Create: `admin/dto/AdminChargebackCountsResponse.java`, `admin/dto/AdminFinanceCountsResponse.java`
- Modify: `admin/AdminChargebackController.java` (`list` + `GET /counts`), `admin/dto/AdminChargebackResponse.java`, `admin/AdminFinanceListings.java`, `admin/AdminFinanceController.java` (`GET /admin/finance/counts`), `admin/metrics/AdminQueueCounter.java` (`countPendingWalletRefunds` public), `admin/AdminAuditController.java`, `common/AuditLogRepository.java` (`findFiltered` + `entityId`), `payments/chargeback/ChargebackRepository.java` (retirer `findAllByOrderByOpenedAtDesc` si sans appelant)
- Test: `admin/AdminChargebackListingIT.java`, `admin/AdminFinanceCountsIT.java`, `admin/AdminAuditControllerTest.java` (étendre)

**Interfaces:** Produces `AdminFinanceListings.chargebacks(view, q, pageable)`, `chargebackCounts()` ; `AdminFinanceCountsResponse` (contrat ci-dessus).

- [ ] **Step 1: Write the failing tests** : litiges : `paymentId` rendu (celui du litige, à défaut le paiement du colis), `trackingNumber`, `corridor`, noms expéditeur/voyageur, `outcome`, `resolvedAt` ; `view=OPEN|WON|LOST|ALL` ; `q` par n° de suivi/nom/trajet ; compteurs cohérents avec les vues ; **nombres de sections** : `payments` égale `attention` de `/payments/counts` sans filtre ; `mobileMoney` égale `attention` de `/mobile-money-payments/counts` ; `soldes` = remboursements wallet en attente (même nombre que `AdminQueueCounter`) + `cashCommissionsAttention` ; `chargebacks` = `OPEN` ; 403 sans `PAYMENT_VIEW` ; **audit** : `entityType=PAYMENT&entityId=<id>` ne renvoie que les entrées de ce paiement, `entityId` mal formé répond 400, sans `entityId` le comportement est celui d'avant. Régression : `AdminAuditControllerTest` et `AdminFinanceControllerIT` (litiges) passent inchangés.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Le filtre d'audit ajoute `AND (CAST(:entityId AS VARCHAR) IS NULL OR a.entity_id = CAST(:entityId AS UUID))` à `findFiltered`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): litiges bancaires, nombres des sections et filtre d'audit`.

### Task 11: Vérification d'ensemble et documentation

**Files:**
- Create: `docs/stories-done/story-admin-transactions-reorganisation.md` (modèle : `story-admin-colis-reorganisation.md`)
- Test: suite complète

- [ ] **Step 1: Test de cohérence transverse** `AdminTransactionsConsistencyIT` : sur un jeu de données unique, `payments.attention` (liste, comptes, section), `alerts.escrowJ48` et `AdminMetricsService.countEscrowJ48` sont égaux ; un paiement dans chaque état apparaît dans la bonne vue et nulle part ailleurs ; aucune réponse de la page (liste, détail, mobile money, portefeuilles, litiges) ne contient un numéro de téléphone en clair.
- [ ] **Step 2: Suite complète** `./mvnw verify -DforkCount=2` → 0 rouge ; SpotBugs 0 ; couverture JaCoCo ≥ 90 % (relever les pourcentages dans la story). Si `AdminPaymentController` grossit, ne rien y ajouter de logique : elle vit dans `AdminPaymentInsights`, `AdminPaymentSql`, `AdminPaymentLinks`, `AdminFinanceListings`.
- [ ] **Step 3: Un test sur PostgreSQL réel** : étendre `AdminPaymentInsightsPostgresIT` (ou créer `AdminPaymentSearchPostgresIT`, modèle `AdminBidSearchPostgresIT`) : recherche accentuée, vue `ATTENTION`, nombres, tri d'urgence sur PostgreSQL embarqué.
- [ ] **Step 4: Story** : résumé, fichiers, flux, pièges (jointure `lb`, numéro chiffré, trois nombres J+48 égaux, repli ancien front), décisions ; à déployer **avant** l'admin (PR jumelle).
- [ ] **Step 5: Commit** — `docs(admin): story de la réorganisation Transactions` ; ouvrir la PR (description citant le plan jumeau admin et se terminant par `https://claude.ai/code/session_01Ab8Dd9TaHrGuJbHPnaxbdb`), CI verte, fusion backend d'abord.
