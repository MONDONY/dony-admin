# Fiche utilisateur, partie backend : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer en lecture, par utilisateur, tout ce que la page « fiche utilisateur » de l'admin affiche, et retirer à `SUPPORT` les gestes de suspension, bannissement et coupure de messagerie.

**Architecture:** Un nouveau package `com.yadony.api.admin.userview` (contrôleur + services + DTO) lit directement les repositories des autres packages (précédent : `AdminMetricsService`, `AdminBidsController`) sans injecter de service étranger. Une synthèse `GET /admin/users/{userId}/overview` renvoie des sections absentes (null) quand l'appelant n'a pas la permission de lecture correspondante ; des listes paginées par onglet vivent sous `/admin/users/{userId}/...`. Le wallet, les tickets support et le KYC par utilisateur existent déjà et ne sont pas refaits.

**Tech Stack:** Spring Boot 3.4 (Java 21), JPA/Hibernate, SQL natif et `NamedParameterJdbcTemplate` là où le code existant les utilise, JUnit 5 + Mockito + MockMvc (H2 en mode PostgreSQL pour les tests), JaCoCo, SpotBugs.

**Spec:** `dony-admin/docs/superpowers/specs/2026-10-23-fiche-utilisateur-design.md` (dépôt `dony-admin`). Maquette : https://claude.ai/artifact/TqG8DKnXSphj6XKbPxi3Qz

Travail dans le dépôt `dony-back`, sur `origin/main` (le checkout local est en retard : toujours partir d'`origin/main`). Worktree : `git worktree add .claude/worktrees/fiche-utilisateur -b feature/admin-fiche-utilisateur origin/main` depuis `dony-back/`. Chemins ci-dessous : `J=src/main/java/com/yadony/api`, `T=src/test/java/com/yadony/api`.

## Global Constraints

- Branche dédiée, jamais de commit sur `main` ; pas de ligne `Co-Authored-By` ; PR backend fusionnée AVANT la PR admin jumelle.
- Erreurs RFC 7807 via `GlobalExceptionHandler` (`YadonyBusinessException(HttpStatus, code, title, detail)`), jamais de String/Map brute. Utilisateur inconnu ou soft-deleted : 404, code `user-not-found`, détail « Utilisateur introuvable ».
- `@PreAuthorize` sur CHAQUE méthode : `hasRole('ADMIN') and hasAuthority('<PERMISSION>')` (le niveau méthode remplace celui de la classe).
- Entités en suppression douce (`deleted_at IS NULL`) ; aucun DELETE physique ; `audit_log` en lecture seule.
- Ne pas filtrer sur `bids.deletedBySender` / `deletedByTraveler` (drapeaux de masquage côté utilisateur, sans objet pour l'admin).
- Pas d'injection de service d'un autre package. Les repositories et les classes déjà dans `admin/` (`AdminBidDetailAssembler`, `AdminPaymentInsights`, `AdminPackageRequestQueryService`, `AdminSupportTicketViews`) sont réutilisables.
- Chaque montant porte sa devise ; jamais de total mêlant deux devises.
- Fenêtre « livré récemment » : constante nommée `RECENT_DELIVERY_WINDOW = Duration.ofDays(3)` (72 h), comparée à `Instant.now(clock)` en UTC.
- Ne pas ajouter de valeur à l'enum `AdminPermission` (garde les tests `hasSize(39)` et `AdminPermissionCoverageTest` intacts).
- Ne pas ajouter de dépendance au constructeur d'`AdminUserController` (tests Mockito construits à la main).
- Flyway : aucune migration prévue. Si une devenait nécessaire : prochaine version libre `V347` (max sur `origin/main` au 2026-10-23 : V346), vérifier les collisions avec les PR ouvertes.
- Tests : `./mvnw test -Dtest=Classe` pour une classe ; avant PR `./mvnw verify -Dspring.profiles.active=test -DforkCount=3` puis `./mvnw spotbugs:check`. Couverture ≥ 90 % visée sur le code ajouté (JaCoCo exclut `admin/**` du plancher global, tester quand même).

## Review Focus

1. Identifiant inconnu, utilisateur supprimé/anonymisé : 404 `user-not-found` sur TOUS les nouveaux endpoints, jamais 500 ni 200 vide.
2. Rôle à permissions partielles (`SUPPORT` sans `AUDIT_VIEW`) : la synthèse omet (null) les sections interdites, aucune donnée d'un domaine non autorisé ne fuit via la synthèse ou la frise ; un endpoint de liste répond 403.
3. Compte neuf sans aucune donnée : réponses valides (listes vides, compteurs à 0, note moyenne null), pas de NPE ni de division par zéro.
4. Compte avec plusieurs devises : « argent retenu » ventilé par devise, jamais additionné.
5. Compte volumineux (centaines de colis) : la synthèse reste bornée (limites explicites), pas de N+1, listes paginées avec `size` plafonné.
6. Colis livré pile à la limite de 72 h et colis jamais livré (`deliveredAt` null) : le tableau « en cours et livrés » ne les traite pas de travers ; un colis où l'utilisateur est à la fois expéditeur d'un côté et voyageur d'un autre ne se duplique pas.

---

### Task 1: Retirer 3 permissions au rôle SUPPORT

**Files:**
- Modify: `J/admin/account/AdminRole.java` (ensemble SUPPORT l.27-50, Javadoc « 18 total » l.10)
- Test: `T/admin/account/AdminPermissionsTest.java` (`testSupportHasExactly18Permissions`, l.53-85)
- Test: tout IT/Test existant qui attend un 200 pour `AdminRole.SUPPORT` sur suspend, ban, mute (chercher avec `git grep -n "SUPPORT" T | grep -iE "suspend|ban|mute"`)

**Interfaces:**
- Produces: `AdminRole.SUPPORT.permissions()` ne contient plus `USER_SUSPEND`, `USER_BAN`, `USER_MESSAGE_MUTE`, et garde les 15 autres (dont `USER_KYC`, `ALERT_RESOLVE`, `REPORT_RESOLVE`, `MESSAGE_DELETE`, `RATING_MODERATE`, `SUPPORT_TICKET_VIEW`, `SUPPORT_TICKET_MANAGE`, `USER_VIEW`, `PAYMENT_VIEW`, `BID_VIEW`, `DISPUTE_VIEW`, `ALERT_VIEW`, `MODERATION_VIEW`, `REPORT_VIEW`, `METRICS_VIEW`).

- [ ] **Step 1: Réécrire `testSupportHasExactly18Permissions`** en `testSupportHasExactly15Permissions` : assertions `size() == 15`, `doesNotContain(USER_SUSPEND, USER_BAN, USER_MESSAGE_MUTE)`, `contains(...)` des 15 permissions listées ci-dessus.
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminPermissionsTest` ; attendu : FAIL (taille 18).
- [ ] **Step 3: Retirer les 3 permissions** de l'`EnumSet` SUPPORT dans `AdminRole`, corriger le Javadoc (18 → 15).
- [ ] **Step 4: Lancer** `./mvnw test -Dtest='AdminPermission*Test,AdminRolePermissionsTest,AdminSecurityIT,AdminUserControllerTest,AdminUserCancelDeletionIT'` ; corriger les tests qui prouvaient un 200 pour SUPPORT sur suspend/ban/mute (ils doivent maintenant prouver un 403 pour SUPPORT et un 200 pour ADMIN). Attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): le rôle SUPPORT ne suspend, ne bannit ni ne coupe la messagerie`.

### Task 2: Squelette du contrôleur et synthèse minimale

**Files:**
- Create: `J/admin/userview/AdminUserViewController.java`, `J/admin/userview/AdminUserOverviewService.java`, `J/admin/userview/dto/AdminUserOverviewResponse.java`
- Test: `T/admin/userview/AdminUserViewControllerIT.java`

**Interfaces:**
- Produces (réutilisé par toutes les tâches suivantes) :
  - `AdminUserViewController` : `@RestController @RequestMapping("/admin/users/{userId}")`, `GET /overview` gardé `hasRole('ADMIN') and hasAuthority('USER_VIEW')`, retourne `AdminUserOverviewResponse`. Charge l'utilisateur avec la même règle que `AdminUserController.requireUser` (404 `user-not-found`), puis délègue au service avec l'ensemble des autorités de l'appelant.
  - `AdminUserOverviewService.overview(UUID userId, Set<String> authorities): AdminUserOverviewResponse`.
  - `record AdminUserOverviewResponse(Kpis kpis, List<InProgressItem> inProgress, List<TimelineEntry> timeline)` ; `record Kpis(Integer parcelsInProgress, Integer activeTrips, List<MoneyAmount> heldByCurrency, Integer openDisputes, Integer totalDisputes, Integer reportsReceived, Integer reportsSent, Integer reportsPending, Double averageRating, Integer ratingCount)` ; `record MoneyAmount(String currency, long amountCents)` ; `record InProgressItem(String kind, UUID id, String reference, String corridor, String role, String status, Instant updatedAt, MoneyAmount amount)` (`kind` ∈ `PARCEL`, `TRIP`) ; `record TimelineEntry(String kind, String title, String detail, Instant at, String refType, UUID refId)`. Tout champ non autorisé ou non encore implémenté vaut `null` (jamais 0).
  - Constante `AdminUserOverviewService.RECENT_DELIVERY_WINDOW`.
- Règle de gating : un champ de `Kpis`/liste n'est calculé que si `authorities` contient la permission de son domaine : colis/trajets → `BID_VIEW` ; argent → `PAYMENT_VIEW` ; litiges → `DISPUTE_VIEW` ; signalements → `REPORT_VIEW`. Note moyenne et nombre d'avis : toujours (viennent de `UserEntity`).

- [ ] **Step 1: Écrire `AdminUserViewControllerIT`** (copier le montage de `T/admin/AdminUserCancelDeletionIT` : `@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc`, principal `AdminPrincipal` à 5 arguments, `.with(authentication(auth(role)))`). Tests : `overview_unknownUser_returns404UserNotFound`, `overview_softDeletedUser_returns404`, `overview_newUser_returnsAveragesAndNullSections` (ADMIN, compte neuf : `kpis.ratingCount == 0`, `averageRating` null, autres champs de domaine à 0 ou liste vide pour ADMIN), `overview_withoutUserView_returns403`, `overview_supportRole_omitsNothingItAlreadyMayRead` (SUPPORT : champs colis/argent/litiges/signalements présents car il a ces droits).
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserViewControllerIT` ; attendu : FAIL (classe absente).
- [ ] **Step 3: Implémenter** les classes et records ci-dessus ; à ce stade `inProgress` et `timeline` renvoient des listes vides, `heldByCurrency` vide, les compteurs de domaine 0 ; seule la note vient de `UserEntity`. Le 404 réutilise `YadonyBusinessException(NOT_FOUND, "user-not-found", "Not Found", "Utilisateur introuvable")`.
- [ ] **Step 4: Lancer** le même test ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): squelette de la synthèse par utilisateur`.

### Task 3: Colis, trajets et « en cours / livrés depuis 3 jours »

**Files:**
- Modify: `J/matching/BidRepository.java`, `J/matching/AnnouncementRepository.java`, `J/admin/userview/AdminUserOverviewService.java`, `J/admin/userview/AdminUserViewController.java`
- Create: `J/admin/userview/AdminUserListingService.java`, `J/admin/userview/dto/AdminUserParcelRow.java`
- Test: `T/admin/userview/AdminUserParcelsIT.java`

**Interfaces:**
- Consumes: Task 2 (contrôleur, `Kpis`, `InProgressItem`).
- Produces :
  - `BidRepository` : `Page<BidEntity> findAdminByParty(UUID userId, Pageable p)` (colis où `senderId = :userId` OU `announcement.travelerId = :userId`, jointure sur `AnnouncementEntity`, tri `createdAt DESC`, sans filtre `deletedBy*`) ; `List<BidEntity> findAdminInProgressByParty(UUID userId, Collection<BidStatus> statuses, Instant deliveredSince, Pageable p)` (colis dont le statut est dans `statuses`, OU `COMPLETED` avec `deliveredAt >= :deliveredSince`) ; `long countAdminByPartyAndStatusIn(UUID userId, Collection<BidStatus> statuses)`.
  - `AnnouncementRepository` : `long countByTravelerIdAndStatusIn(UUID, Collection<AnnouncementStatus>)` ; `List<AnnouncementEntity> findAdminRecentByTraveler(UUID travelerId, Collection<AnnouncementStatus> statuses, Instant completedSince, Pageable p)` ; `Page<AnnouncementEntity> findByTravelerId(UUID, Pageable)` existe déjà.
  - `AdminUserListingService.parcels(UUID userId, int page, int size): Page<AdminUserParcelRow>` et `trips(...)`. `AdminUserParcelRow(UUID id, String trackingNumber, String corridor, String role, String status, Instant createdAt, Instant deliveredAt, MoneyAmount amount, UUID announcementId)` avec `role` ∈ `SENDER`, `TRAVELER`.
  - `GET /admin/users/{userId}/parcels?page&size` et `GET /admin/users/{userId}/trips?page&size`, gardés `hasRole('ADMIN') and hasAuthority('BID_VIEW')`, `size` plafonné à 100 (défaut 20).
  - Ensembles de statuts (constantes dans `AdminUserOverviewService`) : colis « en cours » = `AWAITING_PAYMENT, PENDING, PAYMENT_ESCROWED, ACCEPTED, HANDED_OVER, IN_TRANSIT, ARRIVED` ; trajets « actifs » = `ACTIVE, FULL, IN_PROGRESS`. Un trajet `COMPLETED` dont `updatedAt` est dans la fenêtre de 72 h apparaît dans `inProgress` aussi. `NEGOTIATING`/`NEGOTIATION_CLOSED` ne sont pas « en cours ».
- Le rôle (`SENDER`/`TRAVELER`) se déduit en comparant l'utilisateur à `senderId` et à `announcement.travelerId`. Les noms/références réutilisent `AdminBidsController.toBidListItem` si extractible, sinon un mapping local minimal. Limite de la synthèse : au plus 50 éléments dans `inProgress`, les plus récemment mis à jour d'abord ; résoudre les annonces des colis en UNE requête (pas de N+1).

- [ ] **Step 1: Écrire `AdminUserParcelsIT`** (données H2 : un voyageur, un expéditeur, annonces et colis dans divers statuts). Tests : `parcels_listsBothRolesWithRole`, `parcels_isPaginatedAndSizeCapped`, `overview_inProgress_includesActiveAndDeliveredWithin72h`, `overview_inProgress_excludesDeliveredOlderThan72h`, `overview_inProgress_deliveredJustInsideAndJustOutsideBoundary` (livré à 71 h 59 min vs 72 h 01 min, horloge fixée), `overview_inProgress_neverDeliveredCompletedParcelIsNotRecent` (`deliveredAt` null), `overview_inProgress_hasNoDuplicateForSameBid`, `overview_inProgress_isCappedAt50MostRecent` (60 colis en cours → 50 éléments, les plus récemment mis à jour), `overview_kpis_countParcelsAndTrips`, `parcels_withoutBidView_returns403`, `overview_withoutBidView_omitsParcelAndTripFields` (autorités sans `BID_VIEW` : `inProgress` null, `parcelsInProgress`/`activeTrips` null), `trips_returnsTravelerAnnouncements`.
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserParcelsIT` ; attendu : FAIL.
- [ ] **Step 3: Implémenter** les méthodes de repository (JPQL ou SQL natif compatible H2 mode PostgreSQL), `AdminUserListingService.parcels/trips`, le branchement dans `AdminUserOverviewService` (KPI + `inProgress`) et les deux endpoints.
- [ ] **Step 4: Lancer** `AdminUserParcelsIT` + `AdminUserViewControllerIT` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): colis, trajets et éléments en cours d'un utilisateur`.

### Task 4: Argent retenu par devise et paiements d'un utilisateur

**Files:**
- Modify: `J/admin/AdminPaymentInsights.java` (nouvelle méthode, sans toucher au record `AdminPaymentFilter`), `J/admin/userview/AdminUserOverviewService.java`, `J/admin/userview/AdminUserListingService.java`, `J/admin/userview/AdminUserViewController.java`
- Create: `J/admin/userview/dto/AdminUserPaymentRow.java`
- Test: `T/admin/userview/AdminUserPaymentsIT.java`

**Interfaces:**
- Consumes: Task 2 (`MoneyAmount`, `Kpis.heldByCurrency`), `AdminPaymentInsights.PARTIES_OF_P` (`J/admin/AdminPaymentInsights.java` l.51-64 : tous les participants d'un paiement via bid, fil de négociation ou demande).
- Produces :
  - `AdminPaymentInsights.searchByUser(UUID userId, Pageable p): Page<AdminPaymentListItemResponse>` (paiements dont l'utilisateur est une des parties, tri `created_at DESC, id DESC`, en réutilisant `PARTIES_OF_P` et `load(ids)`).
  - `List<MoneyAmount> AdminUserOverviewService.heldByCurrency(UUID travelerId)` : somme par devise des paiements `status = 'ESCROW' AND payout_held_at IS NOT NULL` dont l'utilisateur est le BÉNÉFICIAIRE (voyageur), même définition que le filtre `held=true` (`AdminPaymentInsights` l.162-163).
  - `GET /admin/users/{userId}/payments?page&size`, gardé `hasRole('ADMIN') and hasAuthority('PAYMENT_VIEW')`, `size` plafonné à 100. `AdminUserPaymentRow` = les champs de `AdminPaymentListItemResponse` utiles à l'onglet (id, bidId, status, method, amountCents, commissionCents, currency, createdAt, payoutHeldAt, beneficiaryHeld) + `role` ∈ `PAYER`, `BENEFICIARY`.
- Le wallet (`GET /admin/users/{userId}/wallet` et `/transactions`) existe déjà : ne pas le refaire.

- [ ] **Step 1: Écrire `AdminUserPaymentsIT`**. Tests : `payments_returnsOnlyPaymentsWhereUserIsAPartyViaBidOrThread`, `payments_isPaginated`, `overview_heldByCurrency_groupsPerCurrencyNeverSums` (deux devises EUR et XOF retenues → deux entrées), `overview_heldByCurrency_ignoresNonHeldAndNonBeneficiary`, `overview_heldByCurrency_emptyForNewUser`, `payments_withoutPaymentView_returns403`, `overview_withoutPaymentView_omitsHeldByCurrency` (null).
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserPaymentsIT` ; attendu : FAIL.
- [ ] **Step 3: Implémenter** `searchByUser`, `heldByCurrency`, l'endpoint, et le branchement dans la synthèse.
- [ ] **Step 4: Lancer** `AdminUserPaymentsIT` et `AdminPaymentInsightsIT` + `AdminPaymentControllerTest` (non-régression : le record `AdminPaymentFilter` n'a pas changé) ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): paiements et argent retenu d'un utilisateur`.

### Task 5: Incidents (litiges, absences, annulations) d'un utilisateur

**Files:**
- Modify: `J/disputes/DisputeRepository.java`, `J/cancellation/CancellationRepository.java`, `J/admin/userview/AdminUserOverviewService.java`, `J/admin/userview/AdminUserListingService.java`, `J/admin/userview/AdminUserViewController.java`
- Create: `J/admin/userview/dto/AdminUserDisputeRow.java`, `J/admin/userview/dto/AdminUserCancellationRow.java`
- Test: `T/admin/userview/AdminUserIncidentsIT.java`

**Interfaces:**
- Consumes: Task 2 (`Kpis.openDisputes/totalDisputes`).
- Produces :
  - `DisputeRepository` : `Page<DisputeEntity> findAdminByParty(UUID userId, Pageable p)` (litiges où `senderId`, `travelerId` ou `reporterId` = userId, tri `createdAt DESC`) ; `long countByPartyAndStatus(UUID userId, String status)` (utiliser `DisputeTypes.STATUS_OPEN`, jamais un littéral).
  - `CancellationRepository` : `Page<CancellationEntity> findAdminByParty(UUID userId, Pageable p)` (annulations/absences dont l'utilisateur est le déclarant `cancelledBy` OU une des parties du colis, via jointure bid + annonce).
  - `GET /admin/users/{userId}/disputes?page&size` gardé `hasRole('ADMIN') and hasAuthority('DISPUTE_VIEW')` ; `GET /admin/users/{userId}/cancellations?page&size` mêmes garde et plafond. `AdminUserDisputeRow(UUID id, UUID bidId, String type, String status, String role, Instant createdAt, Instant resolvedAt)` ; `AdminUserCancellationRow(UUID id, UUID bidId, String reason, String scope, String status, boolean declaredByUser, Instant createdAt)`.
  - Synthèse : `Kpis.openDisputes` et `totalDisputes` (null sans `DISPUTE_VIEW`).
- Compter avec les constantes (`DisputeTypes.STATUS_OPEN`/`STATUS_RESOLVED`, `NoShowReasons`) car `status`, `type` et `reason` sont des chaînes.

- [ ] **Step 1: Écrire `AdminUserIncidentsIT`**. Tests : `disputes_listsWhereUserIsSenderTravelerOrReporter`, `disputes_isPaginated`, `cancellations_includesDeclaredAndSufferedByUser`, `overview_kpis_openAndTotalDisputes`, `overview_kpis_newUserHasZeroDisputes`, `disputes_withoutDisputeView_returns403`, `overview_withoutDisputeView_omitsDisputeKpis` (null).
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserIncidentsIT` ; attendu : FAIL.
- [ ] **Step 3: Implémenter** les requêtes, les deux endpoints, et les KPI.
- [ ] **Step 4: Lancer** `AdminUserIncidentsIT` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): litiges et annulations d'un utilisateur`.

### Task 6: Signalements et avis d'un utilisateur

**Files:**
- Modify: `J/signalements/ReportRepository.java`, `J/ratings/RatingRepository.java` (si besoin), `J/admin/userview/AdminUserOverviewService.java`, `J/admin/userview/AdminUserListingService.java`, `J/admin/userview/AdminUserViewController.java`
- Create: `J/admin/userview/dto/AdminUserReportRow.java`, `J/admin/userview/dto/AdminUserRatingRow.java`
- Test: `T/admin/userview/AdminUserReportsRatingsIT.java`

**Interfaces:**
- Consumes: Task 2 (`Kpis.reportsReceived/reportsSent/reportsPending`).
- Produces :
  - `ReportRepository` : `Page<ReportEntity> findAdminReceivedByUser(UUID userId, Pageable)` (`targetType = USER AND targetId = :userId`) ; `Page<ReportEntity> findAdminSentByUser(UUID userId, Pageable)` (`reporterId = :userId`) ; `long countReceivedPending(UUID userId)` (statut `OPEN`).
  - Périmètre v1 des signalements « reçus » : ceux qui visent directement le compte (`targetType = USER`). Les signalements sur ses annonces, colis, avis ou messages ne sont PAS inclus (à l'écran un libellé le dit).
  - `RatingRepository.findByRatedUserId(UUID, Pageable)` existe : réutiliser. `GET /admin/users/{userId}/reports?direction=RECEIVED|SENT&page&size` gardé `REPORT_VIEW` ; `GET /admin/users/{userId}/ratings?page&size` gardé `RATING_MODERATE` (même garde que `GET /admin/ratings`). `AdminUserReportRow(UUID id, String direction, String targetType, String reason, String status, Instant createdAt)` ; `AdminUserRatingRow(UUID id, UUID bidId, int stars, String comment, boolean flagged, Instant createdAt)`. `direction` invalide : 400 ProblemDetail.
  - Synthèse : `reportsReceived`, `reportsSent`, `reportsPending` (null sans `REPORT_VIEW`).

- [ ] **Step 1: Écrire `AdminUserReportsRatingsIT`**. Tests : `reports_received_onlyDirectUserTargets`, `reports_sent_byReporter`, `reports_invalidDirection_returns400`, `reports_isPaginated`, `ratings_listsReceivedRatings`, `overview_kpis_reportCounts`, `reports_withoutReportView_returns403`, `ratings_withoutRatingModerate_returns403`, `overview_withoutReportView_omitsReportKpis`.
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserReportsRatingsIT` ; attendu : FAIL.
- [ ] **Step 3: Implémenter** les requêtes, endpoints, KPI.
- [ ] **Step 4: Lancer** `AdminUserReportsRatingsIT` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): signalements et avis d'un utilisateur`.

### Task 7: Demandes d'envoi d'un utilisateur

**Files:**
- Modify: `J/requests/repository/PackageRequestRepository.java` (si besoin), `J/admin/userview/AdminUserListingService.java`, `J/admin/userview/AdminUserViewController.java`
- Create: `J/admin/userview/dto/AdminUserRequestRow.java`
- Test: `T/admin/userview/AdminUserRequestsIT.java`

**Interfaces:**
- Consumes: Task 2/3 (contrôleur, `AdminUserListingService`).
- Produces : `GET /admin/users/{userId}/requests?page&size` gardé `hasRole('ADMIN') and hasAuthority('BID_VIEW')` (même garde que `/admin/package-requests`), via `PackageRequestRepository.findBySenderIdOrderByCreatedAtDesc(UUID, Pageable)` (existe). `AdminUserRequestRow(UUID id, String corridor, String status, Double weightKg, Instant desiredDate, Instant createdAt, int openNegotiationCount)`. Les demandes ne comptent pas dans « en cours ».

- [ ] **Step 1: Écrire `AdminUserRequestsIT`**. Tests : `requests_listsSenderRequests`, `requests_isPaginatedAndSizeCapped`, `requests_withoutBidView_returns403`, `requests_unknownUser_returns404`, `requests_newUser_returnsEmptyPage`.
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserRequestsIT` ; attendu : FAIL.
- [ ] **Step 3: Implémenter** l'endpoint et le mapping (réutiliser `AdminPackageRequestQueryService` pour le nombre de négociations si disponible, sinon un comptage groupé en une requête).
- [ ] **Step 4: Lancer** `AdminUserRequestsIT` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): demandes d'envoi d'un utilisateur`.

### Task 8: Journal des gestes admin sur un compte

**Files:**
- Modify: `J/common/AuditLogRepository.java`, `J/admin/userview/AdminUserListingService.java`, `J/admin/userview/AdminUserViewController.java`
- Create: `J/admin/userview/dto/AdminUserAuditRow.java`
- Test: `T/admin/userview/AdminUserAuditIT.java`

**Interfaces:**
- Produces :
  - `AuditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDescIdDesc(String entityType, UUID entityId, Pageable): Page<AuditLogEntity>` (l'index `(entity_type, entity_id)` de V7 le sert : aucune migration).
  - `GET /admin/users/{userId}/audit?page&size` gardé `hasRole('ADMIN') and hasAuthority('AUDIT_VIEW')` ; lit `entity_type = 'USER'` et `entity_id = :userId`. `AdminUserAuditRow(long id, String action, String actorName, UUID actorId, String reason, Instant createdAt)` ; `reason` extrait du `payload` quand la clé existe, sinon null. Aucune adresse IP exposée.
  - Les noms d'acteur se résolvent via `AdminUserRepository` (table `admin_users`), PAS via `users` (les acteurs sont des administrateurs) ; un acteur qui est l'utilisateur lui-même (action automatique) se résout via `UserRepository`.
- Limite assumée (à répéter dans la PR) : seuls les gestes tracés sur l'entité `USER` apparaissent (suspension, bannissement, commission, suppression, etc.) ; les gestes KYC, portefeuille, avis, signalements ont leurs propres historiques dans leurs onglets.

- [ ] **Step 1: Écrire `AdminUserAuditIT`**. Tests : `audit_returnsUserTargetedEntriesNewestFirst`, `audit_resolvesAdminNamesFromAdminUsers`, `audit_isPaginated`, `audit_doesNotExposeIpAddress`, `audit_supportWithoutAuditView_returns403`, `audit_adminWithAuditView_returns200`, `audit_unknownUser_returns404`.
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserAuditIT` ; attendu : FAIL.
- [ ] **Step 3: Implémenter** la méthode de repository, le mapping et l'endpoint.
- [ ] **Step 4: Lancer** `AdminUserAuditIT` + `AdminAuditControllerTest` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): journal des gestes admin sur un compte`.

### Task 9: Frise « dernière activité »

**Files:**
- Create: `J/admin/userview/AdminUserTimelineAssembler.java`
- Modify: `J/admin/userview/AdminUserOverviewService.java`
- Test: `T/admin/userview/AdminUserTimelineIT.java`

**Interfaces:**
- Consumes: les repositories et requêtes des tâches 3 à 6.
- Produces : `AdminUserTimelineAssembler.build(UUID userId, Set<String> authorities, Instant now): List<TimelineEntry>` ; sources et permission de chacune : colis créés/pris en charge/livrés (`BID_VIEW`), paiements reçus/retenus (`PAYMENT_VIEW`), litiges ouverts/résolus (`DISPUTE_VIEW`), signalements reçus (`REPORT_VIEW`). Une source dont la permission manque est ignorée. Tri `at DESC`. Contenu : tous les événements des 72 dernières heures (plafond 100), complétés au besoin par les plus récents jusqu'à 10 au total. `TimelineEntry.kind` ∈ `PARCEL`, `PAYMENT`, `DISPUTE`, `REPORT`.

- [ ] **Step 1: Écrire `AdminUserTimelineIT`**. Tests : `timeline_mergesSourcesNewestFirst`, `timeline_includesEverythingFromLast72h`, `timeline_padsToTenMostRecentWhenQuiet`, `timeline_ignoresSourcesWithoutPermission` (autorités sans `PAYMENT_VIEW` : aucune entrée `PAYMENT`), `timeline_newUserIsEmpty`, `overview_includesTimeline`.
- [ ] **Step 2: Lancer** `./mvnw test -Dtest=AdminUserTimelineIT` ; attendu : FAIL.
- [ ] **Step 3: Implémenter** l'assembleur (une requête bornée par source, pas de N+1) et le brancher dans la synthèse.
- [ ] **Step 4: Lancer** toute la suite du package : `./mvnw test -Dtest='AdminUser*IT,AdminPermission*Test'` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(admin): frise d'activité d'un utilisateur`.

### Task 10: Vérification finale et PR

- [ ] **Step 1: Suite complète** `./mvnw verify -Dspring.profiles.active=test -DforkCount=3` ; attendu : BUILD SUCCESS, couverture au-dessus du plancher JaCoCo.
- [ ] **Step 2: SpotBugs** `./mvnw spotbugs:check` ; attendu : aucun nouveau défaut (corriger ou, en dernier recours, justifier dans `spotbugs-exclude.xml`).
- [ ] **Step 3: Documentation** : corriger le Javadoc périmé de `J/kyc/dto/KycAdminStatusResponse.java` (l'historique existe) ; ne rien changer d'autre.
- [ ] **Step 4: PR** vers `main` : titre `feat(admin): lecture par utilisateur pour la fiche utilisateur de l'admin` ; description : endpoints ajoutés, retrait de 3 permissions à SUPPORT (annonce aux agents avant la production), limites assumées (signalements reçus = ciblant directement le compte ; journal = gestes sur l'entité USER), aucune migration. Annoncer que la PR admin jumelle suit.
