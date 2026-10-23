# Réorganisation de la page Colis, partie backend : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à `GET /admin/bids` une recherche multi-critères, des vues rapides avec alertes et nombres, des suggestions, un point d'accès photos par étape et un bloc incidents dans la fiche.

**Architecture:** On étend `AdminBidsController` et `AdminBidDetailAssembler` existants (package `com.yadony.api.admin`). Le calcul d'alerte vit une seule fois dans des fragments SQL constants (`AdminBidSql`) réutilisés par la liste, les nombres, le tri et l'étiquette de ligne. `BidRepository.findAdminFiltered` est remplacé (pas de code mort). Les photos sont assemblées par un nouveau composant `AdminBidPhotoAssembler`.

**Tech Stack:** Spring Boot 3.4 (Java 21), SQL natif PostgreSQL ET H2 (tests, Flyway désactivé), JUnit 5, MockMvc, Mockito.

**Spec:** `dony-admin/docs/superpowers/specs/2026-10-23-colis-reorganisation-design.md` (lire en premier ; en cas de conflit avec ce plan, le spec gagne). Plan jumeau : `…-colis-reorganisation-admin.md`. Maquette : https://claude.ai/artifact/XjPUyVwDKSRcKDe9q9Zx3b.

Travail dans `dony-back`, worktree `dony-back/.claude/worktrees/colis-reorganisation`, branche `feature/admin-colis-reorganisation` créée depuis `origin/main` (`a1508f17`). Les chemins sont relatifs à `src/main/java/com/yadony/api/` (tests : `src/test/java/com/yadony/api/`). Commandes : `./mvnw test -Dtest=<Classe>`, suite complète : `./mvnw verify -DforkCount=2` (jamais 3 : l'`initdb` de PostgreSQL embarqué échoue en parallèle).

## Global Constraints

- Jamais de commit sur `main`. Messages de commit se terminent par `Claude-Session: https://claude.ai/code/session_01Ab8Dd9TaHrGuJbHPnaxbdb`. Pas de ligne `Co-Authored-By`.
- Aucune migration, aucune nouvelle extension, aucune nouvelle `AdminPermission`. Droits existants : `BID_VIEW` (classe `AdminBidsController`), `PAYMENT_VIEW`, `DISPUTE_VIEW`, `MODERATION_VIEW`, `USER_VIEW` lus via `AdminBidDetailAssembler.Access.of(authentication)`.
- Jackson `NON_NULL` : un champ null est omis du JSON. Les tests utilisent `jsonPath(...).doesNotExist()`.
- Tous les DTO existants gardent leur contrat : on **ajoute en fin** de record (avec constructeur secondaire pour les appelants existants si besoin), jamais de renommage.
- `phone` : les téléphones restent masqués (quatre derniers chiffres, `AdminBidDetailAssembler.maskPhone`). Seul `bids.recipient_phone` (en clair en base) est cherchable, et seulement si `Access.users()`.
- Le SQL natif doit tourner sur PostgreSQL ET H2 (mode PostgreSQL). Pas de `ILIKE` sans repli : le plan impose `LIKE` sur colonnes repliées en minuscules/sans accents (voir Task 1) ; pas de fonctions propres à PostgreSQL (`unaccent`, `similarity`, `::`). `CAST(x AS VARCHAR)` et `COALESCE`, `EXISTS`, `TRANSLATE`, `LOWER` sont communs.
- Les fils de négociation (`BidStatus.NEGOTIATION_STATUSES`) sortent de la liste, des nombres et de « Tous » sauf si `status=NEGOTIATING|NEGOTIATION_CLOSED` est demandé explicitement.
- Les comptes supprimés : leurs colis restent dans la liste ; ils n'apparaissent pas dans les suggestions.
- Code mort interdit (CLAUDE.md règle 22) : l'ancien `findAdminFiltered` et ses tests disparaissent dans la Task 2.
- Couverture JaCoCo ≥ 90 % (vérifiée sur le rapport de la suite complète). Un test de régression pour chaque comportement existant touché.
- Montants : `netEur` reste en unités principales dans la devise du bid (`AdminBidAmounts.netOf`). Rien de nouveau n'additionne des devises.

## Contrat d'API (source de vérité des deux plans)

`GET /admin/bids` (existant, étendu). Paramètres, tous optionnels : `view` (`ALL` par défaut, `TODO`, `ACTIVE`, `RECENT`, `COMPLETED`, `CLOSED`), `status` (`BidStatus`, comme avant), `announcementId`, `query`, `scope` (`ALL` par défaut, `TRACKING`, `SENDER`, `TRAVELER`, `RECIPIENT`, `TRIP`), `paymentMethod` (nom de `PaymentMethod`), `content` (texte, replié), `alert` (`DISPUTE_OPEN`, `NO_SHOW`, `PAYMENT_PENDING`, `LATE`), `dateFrom`, `dateTo`, `page=0`, `size=20`. Un paramètre `view`, `scope`, `status`, `paymentMethod` ou `alert` inconnu répond 400 (conversion Spring), comme `status` aujourd'hui.

Nouveaux champs de `AdminBidListItemResponse`, ajoutés à la suite de `trackingNumber` dans cet ordre : `UUID senderId`, `UUID travelerId`, `String recipientName`, `LocalDate departureDate`, `LocalDateTime updatedAt`, `String alert` (un des quatre codes ci-dessus, absent si aucun). Le constructeur secondaire à 12 arguments et un nouveau constructeur à 13 arguments (avec `trackingNumber`) restent disponibles et délèguent avec `null`.

`GET /admin/bids/counts` : mêmes paramètres que la liste **sauf** `view`, `status`, `alert`, `page`, `size`. Réponse `AdminBidCountsResponse(long todo, long active, long recent, long completed, long closed, long all, Alerts alerts)` avec `Alerts(long disputeOpen, long noShow, long paymentPending, long late)`.

`GET /admin/bids/suggest?q=` (`q` de 2 caractères minimum, sinon 200 avec groupes vides) : `AdminBidSuggestResponse(List<Person> senders, List<Person> travelers, List<Recipient> recipients, List<Trip> trips, List<Parcel> parcels)` ; `Person(UUID id, String name, long count)` ; `Recipient(String name, long count)` ; `Trip(String label, String departureCity, String arrivalCity, long count)` ; `Parcel(UUID bidId, String trackingNumber, String status, String content)`. Cinq éléments maximum par groupe.

`GET /admin/bids/{id}/photos` : `AdminBidPhotosResponse(UUID bidId, List<Photo> photos)` ; `Photo(String id, String stage, String label, LocalDateTime at, String url, String gpsLabel)`, `stage` ∈ `CREATION`, `DEPART`, `TRANSIT`, `ARRIVEE`, `REFUSAL`, `DISPUTE`, triées par étape (ordre ci-dessus) puis par date. 404 `bid-not-found` si le colis n'existe pas.

`GET /admin/bids/{id}` gagne, en dernier, `Incidents incidents` : `Incidents(List<Dispute> disputes, List<Cancellation> cancellations)` ; `Dispute(UUID id, String type, String status, LocalDateTime createdAt, LocalDateTime resolvedAt, String resolutionType)` ; `Cancellation(UUID id, String scope, String noShowStatus, String reason, LocalDateTime createdAt)`. Absent (null) sans `DISPUTE_VIEW`. Il gagne aussi, après `incidents`, `String alert` (même code que dans la liste, calculé par `BidRepository.alertRanks` pour ce seul colis ; absent si aucune alerte).

## Définitions (valeurs par défaut du spec §Appels n° 3, constantes dans `AdminBidSql`)

- Fenêtres : `UNPAID_AFTER_HOURS = 24`, `LATE_AFTER_DAYS = 1`, `RECENT_DELIVERY_HOURS = 72`.
- Rang d'alerte (le plus petit gagne ; 0 = aucune) : 1 `DISPUTE_OPEN` (un litige `status='OPEN'`, `deleted_at IS NULL` sur le colis, quel que soit le statut du colis) ; 2 `NO_SHOW` (statut `NO_SHOW`) ; 3 `PAYMENT_PENDING` (statut `AWAITING_PAYMENT` et `updated_at < :now - 24 h`) ; 4 `LATE` (statut `ACCEPTED`, `HANDED_OVER` ou `IN_TRANSIT`, `delivered_at IS NULL`, et `COALESCE(a.arrival_date, a.departure_date) < CAST(:lateBefore AS DATE)` avec `lateBefore` = date de `now - 1 jour`).
- Vues : `TODO` = rang > 0 ; `ACTIVE` = statuts `AWAITING_PAYMENT, PENDING, PAYMENT_ESCROWED, ACCEPTED, HANDED_OVER, IN_TRANSIT, ARRIVED` ; `RECENT` = `COMPLETED` et `delivered_at >= :now - 72 h` ; `COMPLETED` = `COMPLETED` ; `CLOSED` = `REJECTED, CANCELLED, EXPIRED, PARCEL_REFUSED, NO_SHOW` ; `ALL` = tout sauf négociations.
- Tri : vue `TODO` → rang croissant, puis `created_at` croissant, puis `id` ; toute autre vue → `created_at` décroissant puis `id` décroissant.
- L'horloge est un paramètre `:now` (`LocalDateTime` UTC) fourni par le contrôleur via un `java.time.Clock` injecté, pour tester sans dormir.

## Review Focus

1. Un colis qui cumule litige ouvert et no-show n'affiche qu'une alerte (la plus urgente) et compte une seule fois dans « À traiter ».
2. Le compte de chaque vue est égal au nombre de lignes de la liste avec la même recherche et les mêmes filtres (test de cohérence).
3. Une recherche « Paris Dakar » (deux mots) trouve les colis du trajet Paris → Dakar et pas ceux de Paris → Abidjan.
4. « Aïcha », « aicha » et « AÏCHA » trouvent la même personne ; un nom contenant `%` ou `_` n'est pas un motif.
5. Un colis dont l'expéditeur est supprimé reste dans la liste (nom null) ; il n'est pas dans les suggestions.
6. Un admin sans `USER_VIEW` ne peut pas retrouver un colis par téléphone du destinataire (le terme ne cherche pas ce champ) ; avec `USER_VIEW` oui, et l'affichage reste masqué.
7. Une photo de scan purgée (`photoPurgedAt` non nul) n'apparaît ni dans la chronologie ni dans `/photos` ; une clé de stockage illisible est ignorée sans faire échouer l'appel.
8. Les images de conversation ne sortent qu'avec `MODERATION_VIEW` **et** si un litige existe sur le colis, et jamais les images purgées.

---

### Task 1: Normalisation des termes de recherche

**Files:**
- Modify: `admin/AdminSearchTerms.java`
- Test: `admin/AdminSearchTermsTest.java` (créer si absent)

**Interfaces:**
- Produces (static, publics) :
  - `String fold(String input)` : minuscules (`Locale.ROOT`), accents français repliés par la table `ACCENT_FROM = "àâäáãåçéèêëíìîïñóòôöõúùûüýÿœ"` → `ACCENT_TO = "aaaaaaceeeeiiiinooooouuuuyyo"` (mêmes longueurs, une lettre pour une lettre, `œ` → `o`), espaces multiples réduits à un, `strip()`. `null` → `null`.
  - `List<String> tokens(String query, int max)` : `fold`, retire `%` et `_`, coupe sur les espaces, ignore les mots vides, garde les `max` premiers. `null` ou vide → liste vide.
  - `String likeFolded(String token)` : `"%" + token + "%"` sur un jeton déjà replié.
  - `String digitsOnly(String s)` : uniquement les chiffres, `null` si moins de 4 chiffres.
  - Constantes publiques `ACCENT_FROM`, `ACCENT_TO` (réutilisées par `AdminBidSql`, Task 2).
- Les méthodes existantes `uuid` et `like` ne changent pas.

- [ ] **Step 1: Write the failing tests** : `fold_lowercasesAndRemovesFrenchAccents` (`"ÀÂÄ Çé"` → `"aaa ce"` ; `"Aïcha"` → `"aicha"` ; `"Cœur"` → `"cour"`, car `œ` devient une seule lettre `o`), `fold_collapsesSpaces`, `fold_null_returnsNull`, `tokens_splitsOnSpacesAndStripsPatternChars` (`"Paris  Dakar"` → `["paris","dakar"]` ; `"100%_x"` → `["100x"]`), `tokens_limitsToMax` (max 4), `tokens_blank_returnsEmpty`, `likeFolded_wrapsWithPercent`, `digitsOnly_keepsDigits` (`"+33 6 12-34"` → `"3361234"` ; `"12"` → `null`).
- [ ] **Step 2: Run** `./mvnw test -Dtest=AdminSearchTermsTest` → FAIL (méthodes absentes).
- [ ] **Step 3: Implement** les méthodes ci-dessus dans `AdminSearchTerms` (javadoc en français, courte).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(admin): normalisation des termes de recherche des colis`.

---

### Task 2: Requête de liste, vues et alertes (remplace `findAdminFiltered`)

**Files:**
- Create: `admin/AdminBidSql.java` (fragments SQL constants), `admin/AdminBidView.java` (enum), `admin/AdminBidScope.java` (enum), `admin/AdminBidAlert.java` (enum), `admin/AdminBidQuery.java` (record des paramètres)
- Modify: `matching/BidRepository.java` (retirer `findAdminFiltered` lignes ~818-833, ajouter les deux requêtes ci-dessous)
- Test: `admin/AdminBidSearchIT.java` (SpringBootTest, base H2, `@ActiveProfiles("test")`, sur le modèle de `admin/userview/AdminUserParcelsIT`: `UserRepository`, `AnnouncementRepository`, `BidRepository`, `JdbcTemplate`, helpers `saveUser`, `announcement`, `bid`)

**Interfaces:**
- Produces :
  - `enum AdminBidView { ALL, TODO, ACTIVE, RECENT, COMPLETED, CLOSED }`, `enum AdminBidScope { ALL, TRACKING, SENDER, TRAVELER, RECIPIENT, TRIP }`, `enum AdminBidAlert { DISPUTE_OPEN(1), NO_SHOW(2), PAYMENT_PENDING(3), LATE(4) }` avec `int rank()` et `static Optional<AdminBidAlert> ofRank(int)`.
  - `record AdminBidQuery(AdminBidView view, String status, String announcementId, List<String> tokens, UUID idTerm, AdminBidScope scope, boolean withRecipientPhone, String paymentMethod, String content, Integer alertRank, LocalDateTime from, LocalDateTime to, LocalDateTime now)` avec une fabrique `static AdminBidQuery of(...)` qui replie `content`, calcule `idTerm` par `AdminSearchTerms.uuid`, et `tokens` par `AdminSearchTerms.tokens(query, 4)`.
  - `BidRepository.searchAdmin(` paramètres nommés : `view`, `status`, `announcementId`, `t1`, `t2`, `t3`, `t4`, `idTerm`, `scope`, `phones`, `paymentMethod`, `content`, `alertRank`, `from`, `to`, `now`, `lateBefore`, `Pageable pageable)` → `Page<BidEntity>` (requête native avec `countQuery`).
  - `BidRepository.alertRanks(Collection<UUID> ids, LocalDateTime now, LocalDate lateBefore)` → `List<AlertRankRow>` où `AlertRankRow` est une interface de projection `getBidId()`, `getRank()` (un seul calcul d'alerte, mêmes fragments).
  - `AdminBidSql` expose les constantes (public static final String) : `ALERT_RANK` (expression `CASE … END` donnant 0 à 4, avec les alias `b`, `a`), `VIEW_PREDICATE`, `SEARCH_PREDICATE`, `FILTER_PREDICATE`, `ORDER_BY`, et la jointure `FROM_JOIN` : `bids b LEFT JOIN announcements a ON a.id = b.announcement_id AND a.deleted_at IS NULL LEFT JOIN users s ON s.id = b.sender_id LEFT JOIN users t ON t.id = a.traveler_id`. Les valeurs sont concaténées dans les annotations `@Query` (constantes de compilation).
- Consumes : `AdminSearchTerms.ACCENT_FROM/ACCENT_TO`.

Règles du SQL (à respecter dans `AdminBidSql`) :
- `b.deleted_at IS NULL` toujours ; négociations exclues sauf si `:status` les nomme.
- Repli : `TRANSLATE(LOWER(col), '<ACCENT_FROM>', '<ACCENT_TO>')` sur `s.first_name`, `s.last_name`, `s.username`, `t.first_name`, `t.last_name`, `t.username`, `b.recipient_name`, `a.departure_city`, `a.arrival_city`, `b.tracking_number`. `LIKE` (pas `ILIKE`).
- Chaque jeton non nul doit matcher **au moins un** champ autorisé par `:scope` ; tous les jetons non nuls doivent matcher (ET). `TRACKING` : `tracking_number` ; `SENDER` : `s.*` ; `TRAVELER` : `t.*` ; `RECIPIENT` : `b.recipient_name` + `b.recipient_phone` (chiffres, seulement si `:phones` vrai, comparaison `LIKE` sur le téléphone réduit aux chiffres via `REPLACE` imbriqués de `+`, espace, `-`, `.`, `(`, `)`) ; `TRIP` : villes ; `ALL` : tout.
- `:idTerm` non nul : égalité exacte (`CAST(x AS VARCHAR) = LOWER(:idTerm)`) sur `b.id`, `b.announcement_id`, et `EXISTS` paiement (`payments.bid_id = b.id AND payments.id`) et litige (`disputes.bid_id = b.id AND disputes.id`). En plus des jetons.
- Le jeton qui ressemble à un n° de suivi est couvert par `tracking_number LIKE`.
- `:content` : `TRANSLATE(LOWER(b.content_category), …) LIKE '%' || :content || '%'`.
- `:alertRank` : filtre `ALERT_RANK = :alertRank`.
- `ORDER_BY` selon `:view` comme défini ci-dessus (`CASE WHEN :view = 'TODO' THEN rank END ASC, CASE WHEN :view = 'TODO' THEN b.created_at END ASC, b.created_at DESC, b.id DESC` ; vérifier la compatibilité H2 de `ORDER BY CASE`).

- [ ] **Step 1: Write the failing tests** dans `AdminBidSearchIT` (données créées en base H2 via les helpers, dates posées par `jdbc.update("update bids set …")` comme dans `AdminUserParcelsIT`) :
  - `search_byTrackingNumber_partial_matches`, `search_bySenderName_ignoresCaseAndAccents` (`"AICHA"` trouve « Aïcha »), `search_byTravelerName`, `search_byRecipientName`, `search_byTripCities_twoWordsBothRequired` (`"paris dakar"` oui, `"paris abidjan"` non sur le même colis), `search_scopeSender_doesNotMatchTravelerName`, `search_byBidId_exact`, `search_byAnnouncementId_exact`, `search_byPaymentId_exact` et `search_byDisputeId_exact` (insérer une ligne `payments` / `disputes` minimale par `JdbcTemplate` ; si le schéma H2 généré par Hibernate l'exige, créer via les repositories existants), `search_percentAndUnderscore_areLiteralText`, `search_recipientPhone_onlyWhenPhonesAllowed` (même requête, `phones=false` → 0 résultat, `phones=true` → 1).
  - Filtres : `filter_paymentMethod`, `filter_content`, `filter_dateRange`, `filter_status_negotiating_explicit_isReturned`, `default_excludesNegotiationThreads`, `deletedSender_parcelStillListed`.
  - Vues : `view_todo_includesOpenDisputeOnCompletedBid`, `view_todo_includesNoShow`, `view_todo_unpaidOver24h_notUnder24h` (avec `now` fixé), `view_todo_late_onlyEnRouteStatusesPastArrivalDate` (arrivée dépassée d'un jour vs même jour ; `arrival_date` nulle → `departure_date`), `view_active`, `view_recent_only72hDelivered`, `view_completed`, `view_closed`, `view_all`.
  - Tri : `order_todo_byAlertRankThenOldestFirst`, `order_default_newestFirstWithIdTieBreak` (deux colis même `created_at`).
  - Alertes : `alertRanks_returnsOneRankPerBid_mostUrgent` (colis avec litige ouvert + `NO_SHOW` → rang 1), `alertRanks_noAlert_returnsZeroOrAbsent` (documenter le choix : ligne absente).
  - Mettre à jour/supprimer les tests de l'ancien `findAdminFiltered` dans `admin/AdminBidsControllerTest` (le stub à six arguments disparaît : le test sera réécrit à la Task 3 ; dans cette tâche, adapter seulement ce qu'il faut pour que la compilation passe en remplaçant l'appel par `searchAdmin` avec `any()`).
- [ ] **Step 2: Run** `./mvnw test -Dtest=AdminBidSearchIT` → FAIL.
- [ ] **Step 3: Implement** `AdminBidSql`, les enums, `AdminBidQuery`, `searchAdmin` et `alertRanks` dans `BidRepository`; supprimer `findAdminFiltered`. Un seul endroit définit l'alerte.
- [ ] **Step 4: Run** `AdminBidSearchIT` → PASS, puis `./mvnw test -Dtest='AdminBids*'` → PASS.
- [ ] **Step 5: Commit** `feat(admin): requête de liste des colis avec recherche, vues et alertes`.

---

### Task 3: Liste `GET /admin/bids` étendue

**Files:**
- Modify: `admin/AdminBidsController.java` (constructeur : ajouter `Clock clock` ; méthode `listBids`), `admin/dto/AdminBidListItemResponse.java`
- Test: `admin/AdminBidsControllerTest.java` (réécrire les tests de liste), `admin/AdminBidsListIT.java` (nouveau, MockMvc + base H2, auth `as(AdminRole)` comme `AdminBidsControllerIT`)

**Interfaces:**
- Consumes : `AdminBidQuery.of`, `BidRepository.searchAdmin`, `BidRepository.alertRanks`, `AdminBidDetailAssembler.Access.of`.
- Produces : paramètres et champs du « Contrat d'API » ci-dessus. `listBids` calcule `Access.of(authentication)` (ajouter `Authentication authentication` en paramètre), appelle `searchAdmin`, charge en lot annonces et noms (existant), appelle `alertRanks` pour les ids de la page, remplit `senderId`, `travelerId` (de l'annonce), `recipientName`, `departureDate` (de l'annonce), `updatedAt`, `alert`.
- Un bean `java.time.Clock` (UTC) : le réutiliser s'il existe (`grep -rn "Clock" config/`), sinon l'ajouter à `config/` avec `@Bean Clock clock() { return Clock.systemUTC(); }`.

- [ ] **Step 1: Write the failing tests** : `AdminBidsListIT` : `list_withoutBidView_403`, `list_returnsNewFields` (senderId, travelerId, recipientName, departureDate, updatedAt présents ; recipientName absent si non renseigné), `list_alertField_mostUrgentOnly`, `list_viewTodo_ordersByUrgency`, `list_query_twoWords`, `list_support_cannotSearchByRecipientPhone` (rôle SUPPORT a `USER_VIEW` : adapter avec un rôle/une surcharge sans `USER_VIEW` via `authWith(role, permissions)` si disponible, sinon construire l'authentification à la main), `list_admin_canSearchByRecipientPhone_andPhoneStaysMaskedInDetail`, `list_unknownView_400`, `list_defaultExcludesNegotiation`, `list_oldClientParams_stillWork` (appel avec seulement `status`, `query`, `dateFrom`, `dateTo`, `announcementId` comme avant). `AdminBidsControllerTest` : réécrire `listBids_returnsPage` & co. avec le nouveau constructeur (`Clock.fixed`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** le contrôleur et le DTO (constructeurs de compatibilité conservés si utilisés ailleurs : `grep -rn "new AdminBidListItemResponse"`).
- [ ] **Step 4: Run** `./mvnw test -Dtest='AdminBids*,AdminBidDetailAssemblerTest'` → PASS.
- [ ] **Step 5: Commit** `feat(admin): liste des colis avec vues, alertes et nouveaux champs`.

---

### Task 4: Nombres par vue

**Files:**
- Create: `admin/dto/AdminBidCountsResponse.java`
- Modify: `matching/BidRepository.java` (requête `countAdmin`), `admin/AdminBidsController.java` (endpoint)
- Test: `admin/AdminBidsCountsIT.java`

**Interfaces:**
- Produces : `GET /admin/bids/counts` du contrat. `BidRepository.countAdmin(…mêmes filtres que searchAdmin sauf view/status/alertRank…, now, lateBefore)` → `Object[]` ou projection `AdminCountsRow` (`getTodo()`, `getActive()`, `getRecent()`, `getCompleted()`, `getClosed()`, `getAll()`, `getDisputeOpen()`, `getNoShow()`, `getPaymentPending()`, `getLate()`) : une requête, agrégation conditionnelle `SUM(CASE WHEN <prédicat de vue> THEN 1 ELSE 0 END)`, mêmes fragments `AdminBidSql`.
- Consumes : `AdminBidSql`, `AdminBidQuery`.

- [ ] **Step 1: Write the failing tests** : `counts_matchListSizes_forEachView` (Review Focus 2 : pour chaque vue, `counts.x == total de GET /admin/bids?view=X` avec la même recherche), `counts_respectSearchAndFilters`, `counts_alertsBreakdown_sumsToTodoOrMore` (un colis = une alerte, donc `disputeOpen + noShow + paymentPending + late == todo`), `counts_negotiationExcluded`, `counts_withoutBidView_403`, `counts_emptyDatabase_allZero`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(admin): nombres de colis par vue`.

---

### Task 5: Suggestions de recherche

**Files:**
- Create: `admin/dto/AdminBidSuggestResponse.java`
- Modify: `matching/BidRepository.java` (requêtes de suggestion), `auth/UserRepository.java` seulement si une requête y est plus naturelle, `admin/AdminBidsController.java`
- Test: `admin/AdminBidsSuggestIT.java`

**Interfaces:**
- Produces : `GET /admin/bids/suggest` du contrat. Requêtes natives limitées à 5 : expéditeurs (`users` joint aux `bids` par `sender_id`, `u.deleted_at IS NULL`, nom replié `LIKE`, groupés par utilisateur, triés par nombre de colis décroissant puis nom), voyageurs (via `announcements.traveler_id`), destinataires (`recipient_name` replié, groupés par nom replié, nom affiché = première occurrence), trajets (`departure_city`/`arrival_city` repliés, ou concaténation `departure || ' ' || arrival` repliée pour deux mots ; groupés), colis (`tracking_number LIKE` replié, plus récents d'abord). Négociations exclues des comptes.
- Consumes : `AdminSearchTerms.fold/tokens/likeFolded`, `MatchingTextUtil.buildName`.

- [ ] **Step 1: Write the failing tests** : `suggest_groupsByRole`, `suggest_countsParcelsPerPerson`, `suggest_ignoresAccentsAndCase`, `suggest_limitsToFivePerGroup`, `suggest_deletedUser_notSuggested_butParcelStillInList`, `suggest_shortQuery_returnsEmptyGroups` (1 caractère), `suggest_tripTwoWords`, `suggest_trackingPartial`, `suggest_withoutBidView_403`, `suggest_doesNotLeakPhones` (aucun champ téléphone dans la réponse).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(admin): suggestions de recherche des colis`.

---

### Task 6: Bloc incidents de la fiche et photos purgées de la chronologie

**Files:**
- Modify: `admin/dto/AdminBidDetailResponse.java` (ajouter `Incidents incidents` puis `String alert` en derniers + records imbriqués), `admin/AdminBidDetailAssembler.java` (`Extras` + `extras(...)` + `signed` côté chronologie), `admin/AdminBidsController.java` (passer le nouveau champ au record de détail)
- Test: `admin/AdminBidDetailAssemblerTest.java` (compléter), `admin/AdminBidsControllerIT.java` (compléter)

**Interfaces:**
- Consumes : `DisputeRepository.findByBidIdIn`, `CancellationRepository.findAllByBidId` (via `cancellationsOf`, existant), `Access.disputes()`.
- Produces : `AdminBidDetailResponse.Incidents` et `alert` du contrat (le contrôleur appelle `bidRepo.alertRanks(List.of(id), now, lateBefore)` avec la `Clock` de la Task 3) ; `Extras` gagne `Incidents incidents` (dernier composant). Dans `timeline(...)`, une photo de scan dont `getPhotoPurgedAt() != null` donne `photoUrl` absent (aucune URL).

- [ ] **Step 1: Write the failing tests** : `extras_incidents_listsDisputesAndCancellations_withDisputeView`, `extras_incidents_absent_withoutDisputeView`, `extras_incidents_orderedNewestFirst`, `extras_incidents_emptyLists_whenNone` (objet présent, listes vides, pour qui a `DISPUTE_VIEW`), `detail_alert_sameRuleAsList` (un colis avec litige ouvert expose `alert=DISPUTE_OPEN` dans le détail et dans la liste ; sans alerte, le champ est absent), `timeline_purgedScanPhoto_hasNoUrl`, `timeline_unpurgedScanPhoto_stillSigned`. IT : `detail_incidents_jsonShape` (chemins `$.incidents.disputes[0].status`…), `detail_withoutDisputeView_noIncidentsKey`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Mettre à jour tous les `new AdminBidDetailResponse(...)` et `new Extras(...)` existants (tests inclus).
- [ ] **Step 4: Run** `./mvnw test -Dtest='AdminBid*'` → PASS.
- [ ] **Step 5: Commit** `feat(admin): incidents du colis dans la fiche, photos purgées masquées`.

---

### Task 7: Photos par étape

**Files:**
- Create: `admin/AdminBidPhotoAssembler.java`, `admin/dto/AdminBidPhotosResponse.java`
- Modify: `admin/AdminBidsController.java` (endpoint + constructeur)
- Test: `admin/AdminBidPhotoAssemblerTest.java` (Mockito), `admin/AdminBidPhotosIT.java` (MockMvc)

**Interfaces:**
- Consumes : `BidPhotoService.activePhotos(UUID)` (étape `CREATION`, `id` = id de la photo, `at` = date de création si disponible sinon celle du colis), `TrackingEventRepository.findByBidIdOrderByScannedAtAsc` (étapes `DEPART`/`TRANSIT`/`ARRIVEE`, `label` = type, `gpsLabel`, ignorer `photoUrl` vide et `photoPurgedAt != null`), `BidEntity.getRefusalPhotoUrl()` (étape `REFUSAL`, `at` = `updatedAt` du colis), `ConversationRepository.findByBidId` + `MessagingImageRepository.findByConversationId` (étape `DISPUTE`, uniquement si `Access.moderation()` ET `Access.disputes()` ET au moins un litige existe sur le colis ; ignorer `purged` ; `label` = « Image de la conversation » ; clé = `imageKey`), `StorageService.generatePresignedUrl(key, Duration.ofMinutes(15))` (la constante `AdminBidDetailAssembler.PHOTO_TTL` est à rendre accessible, package-private suffit).
- Produces : `AdminBidPhotoAssembler#photos(BidEntity bid, AdminBidDetailAssembler.Access access)` → `List<AdminBidPhotosResponse.Photo>` triée par étape puis date. Une clé qui ne se signe pas est ignorée (log WARN sans la clé complète) ; une erreur de stockage ne fait jamais échouer l'appel (liste partielle).

- [ ] **Step 1: Write the failing tests** : `photos_creation_fromBidPhotos`, `photos_scans_skipPurgedAndBlank`, `photos_scans_orderedDepartTransitArrivee`, `photos_refusal_included`, `photos_dispute_requiresModerationAndDisputeAndExistingDispute` (trois cas négatifs), `photos_dispute_skipsPurgedImages`, `photos_unsignableKey_isSkipped`, `photos_storageDown_returnsPartialList`, `photos_urlsAreNeverStoredOrLogged` (le log ne contient pas l'URL signée : vérifier par `ListAppender` ou en s'assurant qu'aucun log n'inclut `X-Amz-Signature`), IT : `photos_unknownBid_404ProblemDetail`, `photos_withoutBidView_403`, `photos_jsonShape`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(admin): photos du colis par étape`.

---

### Task 8: Vérification d'ensemble et documentation

**Files:**
- Create: `docs/stories-done/story-admin-colis-reorganisation.md` (modèle de CLAUDE.md : résumé, fichiers, flux, points d'entrée, pièges, tests, décisions)
- Test: aucun nouveau (mais combler les trous de couverture trouvés)

- [ ] **Step 1:** `./mvnw verify -DforkCount=2` → tout vert, SpotBugs sans défaut, couverture globale ≥ 90 % (lignes). Lire `target/site/jacoco/index.html` ou `jacoco.csv` et noter le pourcentage dans le document. Si un échec `initdb` apparaît, relancer ce seul module de tests puis la suite : ne pas conclure sur un échec d'infrastructure.
- [ ] **Step 2:** Vérifier à la main avec `git diff origin/main --stat` qu'aucune migration n'a été ajoutée et que `findAdminFiltered` n'a plus aucune référence (`grep -rn findAdminFiltered src`).
- [ ] **Step 3:** Écrire le document de fin de story (pièges : alerte écrite une seule fois en SQL ; horloge injectée ; repli des accents par `TRANSLATE` identique en Java et SQL ; téléphones masqués ; négociations exclues ; H2 vs PostgreSQL).
- [ ] **Step 4: Commit** `docs(admin): fin de story réorganisation des colis (backend)`.
