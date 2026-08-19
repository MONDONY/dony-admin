# Lot C — Users avancé : KYC admin + suppression RGPD admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Câbler les deux permissions mortes `USER_KYC` et `USER_GDPR_DELETE` de bout en bout — consultation/réinitialisation du KYC et file + exécution des demandes RGPD — en corrigeant au passage les défauts d'anonymisation préexistants et la dette laissée par le Lot B.

**Architecture:** Côté back, deux services dédiés (`KycAdminService` dans `kyc/`, `AdminGdprService` dans `auth/`) exposés par deux contrôleurs dans `admin/`. Le KYC admin est **UUID-based** (jamais `firebaseUid`) et lit Stripe Identity en direct avec dégradation propre ; le reset fait un **UPDATE en place** de l'unique ligne KYC et resynchronise les deux enums de statut. Le RGPD admin réutilise `AccountFinalizationService.finalize(user, ADMIN_INITIATED)` — jamais `AuthService.deleteImmediately`. Côté front, un onglet KYC dans la fiche utilisateur, une page `users/rgpd`, et une extension additive de `ConfirmActionDialog` pour la double confirmation par saisie du nom.

**Tech Stack:** Spring Boot 3.4 / Java 21 / JPA+Flyway / stripe-java 26.12 / JUnit 5 + Mockito + MockMvc — Nuxt 4 SSR / TypeScript strict / Pinia / Vitest + @vue/test-utils / Playwright.

**Spec:** `/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin/docs/superpowers/specs/2026-08-18-admin-rbac-completion-design.md` (section 5 « Lot C », lignes 197-308 ; section 7 « Règles transverses »).
**Reconnaissance du code réel :** `/Users/aboubakardiakite/.claude/jobs/bd5ae304/tmp/recon-lot-c.md`.

---

## Global Constraints

Ces contraintes s'appliquent **à toutes les tâches**, sans être répétées dans chacune.

### Dépôts et branches
- **Back** : `/Users/aboubakardiakite/Desktop/dony/dony-back`, branche `feature/admin-lot-b-moderation`. Package racine réel : **`com.yadony.api`** (le `com.dony.api` du CLAUDE.md racine est obsolète).
- **Front** : `/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin`, branche `feature/admin-lot-b-moderation`.
- Le Lot C se branche sur la **pointe de ces branches Lot B** (PR empilées), pas sur `main`.
- **Ne jamais faire tourner deux agents sur le même dépôt en parallèle.** Les tâches 1→7 (back) et 8→12 (front) sont séquençables indépendamment l'une de l'autre, mais à l'intérieur d'un dépôt les tâches sont strictement séquentielles.

### TDD strict
Chaque tâche : écrire le test d'abord → **le lancer et constater l'échec réel** (lire le message) → implémenter le minimum → relancer et constater le vert. Ne jamais écrire l'implémentation avant d'avoir vu le rouge.

### Non-régression — décompte réel obligatoire
Chaque tâche relance la suite **COMPLÈTE** de son dépôt et rapporte le décompte exact affiché, jamais une paraphrase.

- **Back — baseline :** `Tests run: 3540, Failures: 0, Errors: 0, Skipped: 7`
  ```bash
  cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
  ```
  Le décompte doit être ≥ 3540 et `Failures: 0, Errors: 0`.
- **Front — baseline :** 447 tests unitaires verts, couverture ≥ **90 statements / 85 branches / 90 functions / 90 lines**.
  ```bash
  cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin && pnpm test
  pnpm test:coverage   # les seuils sont dans vitest.config.ts, un dépassement fait échouer la commande
  pnpm lint && pnpm typecheck
  ```

### Règles back
- Erreurs **RFC 7807 `ProblemDetail`** via `GlobalExceptionHandler` — jamais de `String`/`Map` brut. Lever `YadonyBusinessException(HttpStatus, errorCode, title, detail)` : le handler pose `type`, `title`, `detail` et la propriété `code`.
- **Refus = 422**, avec les slugs **existants** (`active-transactions`, `wallet-balance-not-empty`), jamais 409. Un 409 pour un refus identique créerait deux conventions, et l'app mobile mappe déjà ces slugs.
- Tout endpoint `/admin/**` **d'écriture** : `@PreAuthorize("hasRole('ADMIN') and hasAuthority('<PERMISSION>')")` **et** une entrée `audit_log` via `AuditService.log(entityType, entityId, action, actorId, payload)`.
  ⚠️ Dans ce codebase, `hasRole('ADMIN')` signifie « est un admin » (tout `AdminPrincipal` reçoit l'authority `ROLE_ADMIN`, y compris SUPPORT — cf. `AdminSecurityIT.supportAuthorities()` ligne 87), **pas** « rôle == ADMIN ». Le seul filtre qui exclut réellement SUPPORT est `hasAuthority(...)`.
- **Soft delete uniquement**, jamais de DELETE physique. `audit_log` est immuable (trigger PostgreSQL) : jamais d'UPDATE/DELETE.
- **Migrations en V(n+1) seulement**, jamais de modification d'une migration existante. **Dernière migration = `V219__add_messaging_muted_until.sql`** → la prochaine est `V220`.
- `AuditService.redact()` masque automatiquement les clés PII (contient `siret`, `birth`, `phone`, `email`, finit par `name`…). Ne jamais compter sur le payload d'audit pour tracer une valeur personnelle.

### Règles front
- `definePageMeta({ middleware: 'admin-only', permission: '<PERMISSION>' })` sur **chaque** page.
- `auth.can('<PERMISSION>')` sur **chaque** geste, et une modale de confirmation sur **chaque** geste destructif.
- Sidebar filtrée par `can()`.
- **Pas d'i18n** : tous les libellés d'interface sont des chaînes **françaises codées en dur** dans les composants Vue.
- Les appels API passent par `useApi()` (`app/composables/useApi.ts`) — jamais `$fetch` direct.

### Commits
- Message en français, préfixe conventionnel (`feat(...)`, `fix(...)`, `test(...)`, `chore(...)`).
- **Jamais** de ligne `Co-Authored-By: Claude`. Les commits sont au nom du développeur uniquement.

---

## File Structure

### Back — `/Users/aboubakardiakite/Desktop/dony/dony-back`

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `src/main/resources/db/migration/V220__announcements_status_before_removal.sql` | Colonne mémorisant le statut d'avant-retrait | 1 |
| `src/main/java/com/yadony/api/matching/AnnouncementEntity.java` | + champ `statusBeforeRemoval` | 1 |
| `src/main/java/com/yadony/api/matching/AnnouncementService.java` | `removeByAdmin` mémorise / `restoreByAdmin` restitue | 1 |
| `src/main/java/com/yadony/api/payments/cash/CashCommissionService.java` | Gardes élargies à `OUT_OF_MARKET` | 2 |
| `src/main/java/com/yadony/api/auth/FinalizationReason.java` | + `ADMIN_INITIATED` | 3 |
| `src/main/java/com/yadony/api/auth/AccountFinalizationService.java` | 4 défauts d'anonymisation corrigés | 3 |
| `src/main/java/com/yadony/api/kyc/dto/KycAdminStatusResponse.java` | DTO de la vue KYC admin | 4 |
| `src/main/java/com/yadony/api/kyc/KycAdminService.java` | Consultation enrichie Stripe + reset UUID-based | 4 |
| `src/main/java/com/yadony/api/admin/dto/KycResetRequest.java` | Corps du POST reset | 5 |
| `src/main/java/com/yadony/api/admin/AdminUserKycController.java` | `/admin/users/{userId}/kyc[/reset]` | 5 |
| `src/main/java/com/yadony/api/auth/UserRepository.java` | + requête de la file RGPD | 6 |
| `src/main/java/com/yadony/api/auth/AdminGdprService.java` | File + exécution RGPD | 6 |
| `src/main/java/com/yadony/api/admin/dto/AdminGdprRequestResponse.java` | DTO d'une ligne de file | 7 |
| `src/main/java/com/yadony/api/admin/dto/GdprExecuteRequest.java` | Corps du POST d'exécution | 7 |
| `src/main/java/com/yadony/api/admin/AdminGdprController.java` | `/admin/users/gdpr-requests`, `/admin/users/{userId}/gdpr-execute` | 7 |

### Front — worktree `fix+rbac-support-isadmin`

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `app/components/ui/ConfirmActionDialog.vue` | + saisie de contrôle (double confirmation) | 8 |
| `app/lib/problemDetail.ts` | Extraction du `detail` RFC 7807, partagée | 9 |
| `app/features/users/types/index.ts` | + `AdminKycDetail`, `AdminGdprRequest(Page)` | 9 |
| `app/features/users/services/usersService.ts` | + 4 appels KYC/RGPD | 9 |
| `app/features/users/composables/useUserDetail.ts` | Utilise `problemDetail` | 9 |
| `app/features/users/composables/useUserKyc.ts` | État de l'onglet KYC | 10 |
| `app/features/users/components/UserKycTab.vue` | Rendu de l'onglet KYC | 10 |
| `app/features/users/components/UserDetailPanel.vue` | Barre d'onglets Profil/KYC | 10 |
| `app/features/users/composables/useGdprRequests.ts` | File RGPD + exécution | 11 |
| `app/features/users/components/GdprRequestsTable.vue` | Tableau de la file | 11 |
| `app/pages/users/rgpd.vue` | Page `/users/rgpd` | 11 |
| `app/components/layout/AppSidebar.vue` | + entrée « Demandes RGPD » | 11 |
| `tests/e2e/users-kyc-rgpd.spec.ts` | Parcours E2E | 12 |

---

## Arbitrages spec ↔ code réel

Trois écarts ont été tranchés en lisant le code ; ils sont documentés ici parce qu'ils changent ce que les tests doivent affirmer.

1. **SUPPORT conserve l'accès au reset KYC.** Le critère d'acceptation global n°1 dit « SUPPORT ne peut exécuter aucun geste destructif ». Mais `AdminRole.SUPPORT` (ligne 32) accorde déjà `USER_KYC`, et un reset KYC ne détruit aucune donnée : il annule une session Stripe et remet l'utilisateur en état de refaire sa vérification — c'est précisément le geste de support pour lequel `USER_KYC` a été déclarée. Modifier `AdminRole` serait une régression du Lot A/B hors périmètre. **Décision : `USER_KYC` gate la lecture ET le reset ; SUPPORT y a donc accès.** Le geste réellement irréversible du lot, l'exécution RGPD, reste fermé à SUPPORT (`USER_GDPR_DELETE` absent de son set). Les tests d'intégration prouvent la morsure de l'authority avec un principal ADMIN **privé** de `USER_KYC`, pas avec SUPPORT.
2. **`acceptCashBid` : le refus reste 409 `announcement-not-accepting`.** La règle « refus = 422 » de la spec vise les refus RGPD (`active-transactions`, `wallet-balance-not-empty`). Le 409 de `acceptCashBid` est un contrat existant, déjà asserté par `CashCommissionServiceTest.announcementRemovedByAdmin_rejectsBeforeAnyDebit` et aligné sur `BidCheckoutService` (`announcement-not-active`, 409). Seule la **condition** est élargie, jamais le code HTTP ni le slug.
3. **`proCompanyName` n'est pas effacé.** La spec liste exactement quatre défauts d'anonymisation, dont `proSiret` seul côté PRO. `proSiret` est un identifiant de personne (SIRET d'entrepreneur, chiffré au repos) ; `proCompanyName` est une dénomination commerciale déjà publiée sur le profil PRO. Le périmètre de la spec est respecté à la lettre — ni plus, ni moins.

---

# BACK — dony-back

### Task 1: Reprise de dette Lot B — `restoreByAdmin` restitue le statut d'origine

**Dépôt :** `dony-back`

**Contexte du défaut :** `AnnouncementService.removeByAdmin` (ligne 1237) n'a **aucune garde de statut** — il peut retirer une annonce `COMPLETED` ou `CANCELLED`. `restoreByAdmin` (ligne 1298) force ensuite `AnnouncementStatus.ACTIVE`, ce qui remet sur le marché un trajet terminé ou annulé, avec une date de départ passée.

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/resources/db/migration/V220__announcements_status_before_removal.sql`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/matching/AnnouncementEntity.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/matching/AnnouncementService.java:1237-1315`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/matching/AnnouncementModerationServiceTest.java`

**Interfaces:**
- Consumes: `AnnouncementStatus` (`DRAFT, ACTIVE, FULL, IN_PROGRESS, COMPLETED, CANCELLED, REMOVED_BY_ADMIN`), `AuditService.log(String, UUID, String, UUID, Map<String,Object>)`.
- Produces:
  - `AnnouncementEntity.getStatusBeforeRemoval() : AnnouncementStatus`
  - `AnnouncementEntity.setStatusBeforeRemoval(AnnouncementStatus) : void`
  - `AnnouncementService.restoreByAdmin(UUID announcementId, UUID adminId) : AnnouncementEntity` — signature **inchangée**, comportement corrigé.

- [ ] **Step 1: Écrire les tests en échec**

Ajouter ces trois tests à la fin de `AnnouncementModerationServiceTest` (avant l'accolade fermante de la classe). Le fichier possède déjà les helpers `setId` / `setField` et les mocks `announcementRepository`, `bidRepository`, `auditService`, `notificationDispatcher`, `eventPublisher`.

```java
    @Test
    @DisplayName("removeByAdmin : mémorise le statut d'origine avant de retirer")
    void removeByAdmin_memorizesPreviousStatus() throws Exception {
        setField(announcement, "status", AnnouncementStatus.COMPLETED);
        when(announcementRepository.findById(ANN_ID)).thenReturn(Optional.of(announcement));
        when(bidRepository.existsByAnnouncementIdAndStatusIn(eq(ANN_ID), anyList())).thenReturn(false);
        when(announcementRepository.save(any())).thenReturn(announcement);

        service.removeByAdmin(ANN_ID, ADMIN_ID, "signalement");

        assertThat(announcement.getStatus()).isEqualTo(AnnouncementStatus.REMOVED_BY_ADMIN);
        assertThat(announcement.getStatusBeforeRemoval()).isEqualTo(AnnouncementStatus.COMPLETED);
    }

    @Test
    @DisplayName("restoreByAdmin : une annonce COMPLETED retirée redevient COMPLETED, jamais ACTIVE")
    void restoreByAdmin_restoresMemorizedStatus() throws Exception {
        setField(announcement, "status", AnnouncementStatus.REMOVED_BY_ADMIN);
        announcement.setStatusBeforeRemoval(AnnouncementStatus.COMPLETED);
        when(announcementRepository.findById(ANN_ID)).thenReturn(Optional.of(announcement));
        when(announcementRepository.save(any())).thenReturn(announcement);

        AnnouncementEntity result = service.restoreByAdmin(ANN_ID, ADMIN_ID);

        assertThat(result.getStatus()).isEqualTo(AnnouncementStatus.COMPLETED);
        assertThat(result.getStatusBeforeRemoval()).isNull();
    }

    @Test
    @DisplayName("restoreByAdmin : statut d'origine inconnu (ligne retirée avant V220) → ACTIVE")
    void restoreByAdmin_withoutMemorizedStatus_fallsBackToActive() throws Exception {
        setField(announcement, "status", AnnouncementStatus.REMOVED_BY_ADMIN);
        announcement.setStatusBeforeRemoval(null);
        when(announcementRepository.findById(ANN_ID)).thenReturn(Optional.of(announcement));
        when(announcementRepository.save(any())).thenReturn(announcement);

        AnnouncementEntity result = service.restoreByAdmin(ANN_ID, ADMIN_ID);

        assertThat(result.getStatus()).isEqualTo(AnnouncementStatus.ACTIVE);
    }
```

- [ ] **Step 2: Lancer les tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AnnouncementModerationServiceTest
```
Attendu : **échec de compilation** — `cannot find symbol: method getStatusBeforeRemoval()`.

- [ ] **Step 3: Créer la migration V220**

Fichier `src/main/resources/db/migration/V220__announcements_status_before_removal.sql` :

```sql
-- Lot C — reprise de dette Lot B.
-- restoreByAdmin forçait ACTIVE : restaurer une annonce COMPLETED/CANCELLED la remettait
-- sur le marché avec une date de départ passée. On mémorise donc le statut d'avant-retrait.
-- NULL pour les lignes retirées avant cette migration : la restauration retombe alors sur ACTIVE.
ALTER TABLE announcements
    ADD COLUMN status_before_removal VARCHAR(20);
```

- [ ] **Step 4: Ajouter le champ à l'entité**

Dans `AnnouncementEntity.java`, juste après la déclaration du champ `status` (bloc `@Column(name = "status", ...)`) :

```java
    /**
     * Lot C — statut porté par l'annonce juste avant un retrait par la modération.
     * {@code null} tant qu'aucun retrait n'a eu lieu, et pour les lignes retirées avant
     * la migration V220 : {@code restoreByAdmin} retombe alors sur {@code ACTIVE}.
     */
    @Column(name = "status_before_removal", length = 20)
    @Enumerated(EnumType.STRING)
    private AnnouncementStatus statusBeforeRemoval;
```

Et parmi les accesseurs :

```java
    public AnnouncementStatus getStatusBeforeRemoval() { return statusBeforeRemoval; }
    public void setStatusBeforeRemoval(AnnouncementStatus statusBeforeRemoval) {
        this.statusBeforeRemoval = statusBeforeRemoval;
    }
```

- [ ] **Step 5: Mémoriser dans `removeByAdmin`**

Dans `AnnouncementService.removeByAdmin`, remplacer la ligne unique :

```java
        ann.setStatus(AnnouncementStatus.REMOVED_BY_ADMIN);
```

par :

```java
        // Lot C — mémorisé AVANT l'écrasement, et seulement si l'annonce n'était pas déjà
        // retirée : un second retrait ne doit pas mémoriser REMOVED_BY_ADMIN comme statut
        // « d'origine », ce qui rendrait la restauration impossible.
        if (ann.getStatus() != AnnouncementStatus.REMOVED_BY_ADMIN) {
            ann.setStatusBeforeRemoval(ann.getStatus());
        }
        ann.setStatus(AnnouncementStatus.REMOVED_BY_ADMIN);
```

- [ ] **Step 6: Restituer dans `restoreByAdmin`**

Remplacer, dans `restoreByAdmin`, les deux lignes :

```java
        ann.setStatus(AnnouncementStatus.ACTIVE);
        AnnouncementEntity saved = announcementRepository.save(ann);

        auditService.log("ANNOUNCEMENT", announcementId, "ANNOUNCEMENT_RESTORED_BY_ADMIN", adminId, Map.of());
```

par :

```java
        // Lot C — restitution du statut d'origine. Forcer ACTIVE remettait sur le marché
        // un trajet COMPLETED/CANCELLED, réservable avec une date de départ passée.
        // Fallback ACTIVE pour les lignes retirées avant la migration V220 (colonne NULL).
        AnnouncementStatus target = ann.getStatusBeforeRemoval() != null
                ? ann.getStatusBeforeRemoval()
                : AnnouncementStatus.ACTIVE;
        ann.setStatus(target);
        ann.setStatusBeforeRemoval(null);
        AnnouncementEntity saved = announcementRepository.save(ann);

        auditService.log("ANNOUNCEMENT", announcementId, "ANNOUNCEMENT_RESTORED_BY_ADMIN", adminId,
                Map.of("restoredStatus", target.name()));
```

- [ ] **Step 7: Relancer les tests de la classe**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AnnouncementModerationServiceTest
```
Attendu : `Tests run: <n>, Failures: 0, Errors: 0`. Le test existant `restoreByAdmin_returnsToActiveAndAudits` passe toujours : il ne pose pas `statusBeforeRemoval`, donc le fallback rend `ACTIVE`.

- [ ] **Step 8: Suite complète du dépôt**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
```
Attendu : `Tests run: 3543, Failures: 0, Errors: 0, Skipped: 7` (3540 + 3). Rapporter le décompte réel affiché.

- [ ] **Step 9: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/resources/db/migration/V220__announcements_status_before_removal.sql \
        src/main/java/com/yadony/api/matching/AnnouncementEntity.java \
        src/main/java/com/yadony/api/matching/AnnouncementService.java \
        src/test/java/com/yadony/api/matching/AnnouncementModerationServiceTest.java
git commit -m "fix(matching): restoreByAdmin restitue le statut d'origine au lieu de forcer ACTIVE"
```

---

### Task 2: Reprise de dette Lot B — garde `acceptCashBid` élargie à `OUT_OF_MARKET`

**Dépôt :** `dony-back`

**Contexte du défaut :** `CashCommissionService.acceptCashBid` (ligne 818) ne refuse que `REMOVED_BY_ADMIN`, alors qu'une annonce `CANCELLED` ou `COMPLETED` doit tout autant refuser un nouvel engagement d'argent — c'est exactement ce que fait déjà `AnnouncementStatus.OUT_OF_MARKET` (`EnumSet.of(REMOVED_BY_ADMIN, CANCELLED, COMPLETED)`) dans `BidCheckoutService:304` et `PaymentService:401`. Le même rétrécissement existe dans `finalizeBidAcceptance` (ligne 983), atteignable **sans passer par la garde d'entrée** via `confirmAcceptance` (chemin 3DS, lignes 885 et 896) : l'annonce y serait ressuscitée en `FULL`.

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/payments/cash/CashCommissionService.java:818` et `:983`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/payments/cash/CashCommissionServiceTest.java` (classe imbriquée `AcceptCashBid`)

**Interfaces:**
- Consumes: `AnnouncementStatus.OUT_OF_MARKET : Set<AnnouncementStatus>` (Task 1 ne le modifie pas), `AnnouncementEntity.getStatusBeforeRemoval()` non utilisé ici.
- Produces: aucune nouvelle signature. `acceptCashBid(UUID bidId, UUID travelerId, CommissionSource)` conserve son contrat : refus **409** avec le slug **`announcement-not-accepting`**.

- [ ] **Step 1: Écrire les tests en échec**

Dans `CashCommissionServiceTest`, classe imbriquée `AcceptCashBid`, ajouter à la suite de `announcementRemovedByAdmin_cardSource_rejectsBeforeAnyStripeCall` :

```java
        @Test
        // Lot C — même garde, élargie : une annonce CANCELLED est aussi hors marché.
        void announcementCancelled_rejectsBeforeAnyDebit() {
            announcement.setStatus(AnnouncementStatus.CANCELLED);

            assertThatThrownBy(() -> service.acceptCashBid(
                    bid.getId(), travelerId, com.yadony.api.payments.cash.CommissionSource.WALLET_FIRST))
                    .isInstanceOf(com.yadony.api.common.YadonyBusinessException.class)
                    .satisfies(e -> {
                        var y = (com.yadony.api.common.YadonyBusinessException) e;
                        assertThat(y.getStatus()).isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
                        assertThat(y.getErrorCode()).isEqualTo("announcement-not-accepting");
                    });

            assertThat(bid.getStatus()).isEqualTo(BidStatus.PENDING);
            verify(walletService, never()).getBalance(any(), any());
            verify(walletService, never()).debit(any(), any(), any(), any(), any());
            verify(bidRepo, never()).save(any());
            verify(announcementRepo, never()).save(any());
        }

        @Test
        // Lot C — une annonce COMPLETED est hors marché : plus aucun colis ne s'y ajoute.
        void announcementCompleted_rejectsBeforeAnyDebit() {
            announcement.setStatus(AnnouncementStatus.COMPLETED);

            assertThatThrownBy(() -> service.acceptCashBid(
                    bid.getId(), travelerId, com.yadony.api.payments.cash.CommissionSource.WALLET_FIRST))
                    .isInstanceOf(com.yadony.api.common.YadonyBusinessException.class)
                    .satisfies(e -> assertThat(((com.yadony.api.common.YadonyBusinessException) e).getErrorCode())
                            .isEqualTo("announcement-not-accepting"));

            assertThat(bid.getStatus()).isEqualTo(BidStatus.PENDING);
            verify(walletService, never()).debit(any(), any(), any(), any(), any());
        }

        @Test
        // Lot C — le passage FULL de finalizeBidAcceptance ne doit ressusciter aucun statut
        // hors marché, pas seulement REMOVED_BY_ADMIN : confirmAcceptance (chemin 3DS)
        // appelle finalizeBidAcceptance sans repasser par la garde d'entrée.
        void finalizeDoesNotResurrectACancelledAnnouncementAsFull() {
            announcement.setStatus(AnnouncementStatus.CANCELLED);
            announcement.setAvailableKg(new java.math.BigDecimal("5")); // le bid consomme tout

            assertThatThrownBy(() -> service.acceptCashBid(
                    bid.getId(), travelerId, com.yadony.api.payments.cash.CommissionSource.WALLET_FIRST))
                    .isInstanceOf(com.yadony.api.common.YadonyBusinessException.class);

            assertThat(announcement.getStatus()).isEqualTo(AnnouncementStatus.CANCELLED);
        }
```

- [ ] **Step 2: Lancer les tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=CashCommissionServiceTest
```
Attendu : `announcementCancelled_rejectsBeforeAnyDebit` et `announcementCompleted_rejectsBeforeAnyDebit` échouent — aucune exception levée, `walletService.getBalance` appelé.

- [ ] **Step 3: Élargir la garde d'entrée d'`acceptCashBid`**

Ligne 818 de `CashCommissionService.java`, remplacer :

```java
        if (announcement.getStatus() == AnnouncementStatus.REMOVED_BY_ADMIN) {
```

par :

```java
        // Lot C : élargi de REMOVED_BY_ADMIN à tout OUT_OF_MARKET (CANCELLED, COMPLETED
        // inclus) — un trajet annulé ou terminé ne doit pas plus accepter de colis qu'un
        // trajet retiré. Même allowlist que BidCheckoutService et PaymentService. Le code
        // HTTP (409) et le slug (announcement-not-accepting) sont un contrat existant :
        // seule la condition change.
        if (AnnouncementStatus.OUT_OF_MARKET.contains(announcement.getStatus())) {
```

Et adapter le message de détail, juste en dessous :

```java
            throw new YadonyBusinessException(HttpStatus.CONFLICT,
                    "announcement-not-accepting", "Announcement Not Accepting",
                    "Ce trajet n'accepte plus de colis");
```

- [ ] **Step 4: Élargir la garde de `finalizeBidAcceptance`**

Ligne 983, remplacer :

```java
            if (announcement.getAvailableKg().compareTo(BigDecimal.ZERO) <= 0
                    && announcement.getStatus() != AnnouncementStatus.REMOVED_BY_ADMIN) {
```

par :

```java
            // Lot C : élargi à tout OUT_OF_MARKET. confirmAcceptance (chemin 3DS) appelle
            // cette méthode sans repasser par la garde d'entrée d'acceptCashBid : restreinte
            // à REMOVED_BY_ADMIN, elle laissait un trajet CANCELLED/COMPLETED réapparaître en
            // FULL, donc dans les allowlists ACTIVE/FULL (recherche corridor, alertes).
            if (announcement.getAvailableKg().compareTo(BigDecimal.ZERO) <= 0
                    && !AnnouncementStatus.OUT_OF_MARKET.contains(announcement.getStatus())) {
```

- [ ] **Step 5: Relancer les tests de la classe**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=CashCommissionServiceTest
```
Attendu : `Failures: 0, Errors: 0`. Les deux tests existants `announcementRemovedByAdmin_*` passent toujours — `REMOVED_BY_ADMIN` appartient à `OUT_OF_MARKET`.

- [ ] **Step 6: Suite complète du dépôt**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
```
Attendu : `Tests run: 3546, Failures: 0, Errors: 0, Skipped: 7`. Rapporter le décompte réel.

- [ ] **Step 7: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/payments/cash/CashCommissionService.java \
        src/test/java/com/yadony/api/payments/cash/CashCommissionServiceTest.java
git commit -m "fix(payments): refuse un bid cash sur tout trajet hors marché, pas seulement retiré"
```

---

### Task 3: `FinalizationReason.ADMIN_INITIATED` + correction des 4 défauts d'anonymisation

**Dépôt :** `dony-back`

**Contexte des défauts** (relevés en reconnaissance, `AccountFinalizationService.java:45-88`) :
1. `proSiret` — identifiant d'entreprise réel (chiffré au repos mais **jamais anonymisé**) : la donnée reste ré-identifiante après suppression RGPD.
2. `kycStatus` n'est pas remis à `NOT_STARTED`.
3. `deletionRequestedAt` n'est jamais effacé (contrairement à `reactivateAccount`, `UserService.java:170`).
4. La ligne `kyc_schema` est seulement soft-deletée : `stripe_verification_session_id`, pointeur vers les pièces d'identité détenues par Stripe, **survit** à la suppression du compte.

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/auth/FinalizationReason.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/auth/AccountFinalizationService.java:45-88`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/auth/AccountFinalizationServiceTest.java`

**Interfaces:**
- Consumes: `KycRepository.findByUserId(UUID) : Optional<KycVerificationEntity>`, `KycVerificationEntity.setStripeVerificationSessionId(String)` / `.setRejectionReason(String)` / `.setRejectionCode(String)` / `.softDelete()`, `UserEntity.setProSiret(String)` / `.setKycStatus(KycStatus)` / `.setDeletionRequestedAt(Instant)`.
- Produces :
  - `FinalizationReason` = `{ SOFT_GRACE_EXPIRED, HARD_IMMEDIATE, ADMIN_INITIATED }` — `ADMIN_INITIATED` est consommé par la Task 6.
  - `AccountFinalizationService.finalize(UserEntity user, FinalizationReason reason) : void` — signature **inchangée**, anonymisation élargie.

- [ ] **Step 1: Enrichir le helper de test existant**

Dans `AccountFinalizationServiceTest`, remplacer le corps de `makeUser()` (lignes 41-51) par :

```java
    private UserEntity makeUser() {
        UserEntity u = new UserEntity();
        setId(u, UUID.randomUUID());
        u.setFirebaseUid("uid-test");
        u.setFirstName("Jean");
        u.setLastName("Dupont");
        u.setStatus(UserStatus.PENDING_DELETION);
        u.setBirthDate(java.time.LocalDate.of(1990, 1, 1));
        u.setCity("Paris");
        u.setProAccount(true);
        u.setProSiret("12345678901234");
        u.setKycStatus(KycStatus.VERIFIED);
        u.setDeletionRequestedAt(java.time.Instant.parse("2026-07-01T00:00:00Z"));
        return u;
    }
```

`KycStatus` est dans le même package `com.yadony.api.auth` que la classe de test : aucun import à ajouter.

- [ ] **Step 2: Écrire les tests en échec**

Ajouter ces quatre tests à la fin de `AccountFinalizationServiceTest`, avant l'accolade fermante :

```java
    @Test
    @DisplayName("anonymise proSiret — un SIRET reste un identifiant ré-identifiant")
    void clearsProSiret() {
        UserEntity user = makeUser();
        when(kycRepository.findByUserId(any())).thenReturn(Optional.empty());

        service.finalize(user, FinalizationReason.HARD_IMMEDIATE);

        assertThat(user.getProSiret()).isNull();
    }

    @Test
    @DisplayName("remet kycStatus à NOT_STARTED et efface deletionRequestedAt")
    void resetsKycStatusAndDeletionRequestedAt() {
        UserEntity user = makeUser();
        when(kycRepository.findByUserId(any())).thenReturn(Optional.empty());

        service.finalize(user, FinalizationReason.HARD_IMMEDIATE);

        assertThat(user.getKycStatus()).isEqualTo(KycStatus.NOT_STARTED);
        assertThat(user.getDeletionRequestedAt()).isNull();
    }

    @Test
    @DisplayName("efface le pointeur de session Stripe sur la ligne KYC, pas seulement soft-delete")
    void clearsStripeSessionPointerOnKycRow() {
        UserEntity user = makeUser();
        KycVerificationEntity kyc = new KycVerificationEntity();
        kyc.setStripeVerificationSessionId("vs_test_001");
        kyc.setRejectionReason("document_expired");
        kyc.setRejectionCode("document_expired");
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.of(kyc));

        service.finalize(user, FinalizationReason.HARD_IMMEDIATE);

        assertThat(kyc.getStripeVerificationSessionId()).isNull();
        assertThat(kyc.getRejectionReason()).isNull();
        assertThat(kyc.getRejectionCode()).isNull();
        assertThat(kyc.getDeletedAt()).isNotNull();
    }

    @Test
    @DisplayName("ADMIN_INITIATED est propagée telle quelle dans l'event et l'audit")
    void adminInitiatedReasonIsPropagated() {
        UserEntity user = makeUser();
        UUID userId = user.getId();
        when(kycRepository.findByUserId(any())).thenReturn(Optional.empty());

        service.finalize(user, FinalizationReason.ADMIN_INITIATED);

        // finalize() publie DEUX events (AccountDeletionRequestedEvent puis UserFinalizedEvent) :
        // d'où atLeastOnce() + anySatisfy plutôt que le verify() simple des tests voisins.
        ArgumentCaptor<UserFinalizedEvent> captor = ArgumentCaptor.forClass(UserFinalizedEvent.class);
        verify(eventPublisher, atLeastOnce()).publishEvent(captor.capture());
        assertThat(captor.getAllValues())
                .anySatisfy(e -> assertThat(e.getReason()).isEqualTo(FinalizationReason.ADMIN_INITIATED));
        verify(auditService).log(eq("USER"), eq(userId), eq("USER_GDPR_DELETION"), eq(userId), any());
    }
```

- [ ] **Step 3: Lancer les tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AccountFinalizationServiceTest
```
Attendu : **échec de compilation** — `cannot find symbol: variable ADMIN_INITIATED`.

- [ ] **Step 4: Ajouter la valeur d'enum**

Contenu complet de `FinalizationReason.java` :

```java
package com.yadony.api.auth;

public enum FinalizationReason {
    /** Fin du délai de grâce de 30 jours (AccountDeletionScheduler). */
    SOFT_GRACE_EXPIRED,
    /** Suppression immédiate demandée par l'utilisateur lui-même (AuthService.deleteImmediately). */
    HARD_IMMEDIATE,
    /** Lot C — exécution déclenchée par un administrateur depuis la file RGPD. */
    ADMIN_INITIATED
}
```

- [ ] **Step 5: Corriger l'anonymisation**

Dans `AccountFinalizationService.finalize`, remplacer les blocs 1 et 2 (lignes 50-66) par :

```java
        // 1. Pseuyadonymise personal data
        // Téléphone et email ne sont plus stockés ici : ils disparaissent avec le
        // compte Firebase supprimé à l'étape 5.
        user.setFirstName("Utilisateur");
        user.setLastName("supprimé");
        user.setBirthDate(null);
        user.setCity(null);
        user.setFcmToken(null);
        // Lot C — le SIRET identifie nommément un entrepreneur : le laisser en base rendait
        // ré-identifiable un compte pourtant « anonymisé ». La dénomination commerciale
        // (proCompanyName) est conservée : identité d'entreprise déjà publiée sur le profil PRO.
        user.setProSiret(null);
        // Lot C — sans ça, un compte supprimé restait affiché VERIFIED côté admin.
        user.setKycStatus(KycStatus.NOT_STARTED);
        // Lot C — symétrique de reactivateAccount : la demande est consommée, plus en attente.
        user.setDeletionRequestedAt(null);
        user.setStatus(UserStatus.BANNED);
        user.setDeletedAt(LocalDateTime.now(ZoneOffset.UTC));
        userRepository.save(user);

        // 2. Purge puis soft-delete de la ligne KYC.
        // Lot C — le soft-delete seul laissait survivre stripe_verification_session_id,
        // pointeur vers les pièces d'identité détenues par Stripe. UPDATE en place puis
        // softDelete : jamais de suppression physique (règle du projet), et jamais de
        // recréation (uq_kyc_user_id est une contrainte UNIQUE classique).
        kycRepository.findByUserId(userId).ifPresent(kyc -> {
            kyc.setStripeVerificationSessionId(null);
            kyc.setRejectionReason(null);
            kyc.setRejectionCode(null);
            kyc.softDelete();
            kycRepository.save(kyc);
        });
```

- [ ] **Step 6: Relancer les tests de la classe**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AccountFinalizationServiceTest
```
Attendu : `Tests run: 10, Failures: 0, Errors: 0`. Les 6 tests préexistants passent toujours — aucun n'assertait ces champs.

- [ ] **Step 7: Suite complète du dépôt**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
```
Attendu : `Tests run: 3550, Failures: 0, Errors: 0, Skipped: 7`. Surveiller `AuthServiceDeleteImmediatelyTest`, `UserServiceDeleteAccountTest` et `AccountDeletionSchedulerTest`, qui traversent `finalize()`. Rapporter le décompte réel.

- [ ] **Step 8: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/auth/FinalizationReason.java \
        src/main/java/com/yadony/api/auth/AccountFinalizationService.java \
        src/test/java/com/yadony/api/auth/AccountFinalizationServiceTest.java
git commit -m "fix(auth): anonymise proSiret, kycStatus, deletionRequestedAt et le pointeur Stripe KYC"
```

---

### Task 4: `KycAdminService` — consultation enrichie par Stripe + reset UPDATE en place

**Dépôt :** `dony-back`

**Pièges à respecter (tous vérifiés dans le code) :**
- ⚠️ **Incompatibilité d'identifiant** : `KycService.createSession/abandonSession/getStatus` sont keyés sur `String firebaseUid`, tout `/admin/**` sur `UUID userId`. Ne **pas** réutiliser `KycService` : nouveau service, UUID-based via `KycRepository.findByUserId(UUID)` qui existe déjà.
- ⚠️ **Jamais soft-delete + recréation** pour le reset : `uq_kyc_user_id` (`V2__init_kyc_schema.sql:19`) est une contrainte UNIQUE **classique**, sans `WHERE deleted_at IS NULL` — la ligne soft-deletée reste physiquement présente et une réinsertion violerait la contrainte. **UPDATE en place obligatoire.**
- ⚠️ **Deux enums à resynchroniser** : `KycVerificationStatus` (`PENDING/VERIFIED/REJECTED`, sur `kyc_schema`) et `KycStatus` (`NOT_STARTED/PENDING/VERIFIED/REJECTED`, sur `public.users`). N'en toucher qu'un ferait diverger les sources de vérité en silence.
- ⚠️ **Aucun document en base ni en S3** : `V46__kyc_cleanup.sql` a supprimé `id_document_encrypted` et `selfie_url`. Rien à présigner — l'enrichissement passe par l'API Stripe Identity.
- ⚠️ **Dégradation propre** : un échec Stripe ne doit **jamais** produire un 500 — retourner l'état local avec `stripeUnavailable = true`.

**État cible après reset** — identique à celui que produit déjà `KycService.abandonSession` (lignes 126-141) : `users.kyc_status = NOT_STARTED`, ligne KYC **conservée** avec `status = PENDING`, `stripe_verification_session_id = null`, motif et code de rejet effacés. `KycService.createSession` reprend alors le chemin `NOT_STARTED` (ligne 67) et **réécrit la ligne existante** (ligne 95, `findByUserId(...).orElseGet(...)`) — aucune violation de `uq_kyc_user_id`.

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/kyc/dto/KycAdminStatusResponse.java`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/kyc/KycAdminService.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/kyc/KycAdminServiceTest.java`

**Interfaces:**
- Consumes: `KycRepository.findByUserId(UUID)`, `UserRepository.findById(UUID)`, `AuditService.log(String, UUID, String, UUID, Map<String,Object>)`, `NotificationDispatcher.notifyUser(UUID, String, String, Map<String,String>)`, et le statique `com.stripe.model.identity.VerificationSession.retrieve(String)` avec `getStatus() : String`, `getCreated() : Long`, `getLastError() : VerificationSession.LastError` (`getCode()`, `getReason()`), `.cancel()`.
- Produces (consommés par la Task 5) :
  - `record KycAdminStatusResponse(UUID userId, String kycStatus, String verificationStatus, String rejectionReason, String rejectionCode, String stripeSessionId, String stripeStatus, String stripeLastErrorCode, String stripeLastErrorReason, LocalDateTime stripeCreatedAt, boolean stripeUnavailable)`
  - `KycAdminService.getForUser(UUID userId) : KycAdminStatusResponse`
  - `KycAdminService.resetForUser(UUID userId, UUID adminId, String reason) : KycAdminStatusResponse`

- [ ] **Step 1: Écrire le test en échec**

Créer `src/test/java/com/yadony/api/kyc/KycAdminServiceTest.java` :

```java
package com.yadony.api.kyc;

import com.yadony.api.auth.KycStatus;
import com.yadony.api.auth.UserEntity;
import com.yadony.api.auth.UserRepository;
import com.yadony.api.common.AuditService;
import com.yadony.api.common.YadonyBusinessException;
import com.yadony.api.kyc.dto.KycAdminStatusResponse;
import com.yadony.api.notifications.NotificationDispatcher;
import com.stripe.model.identity.VerificationSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("KycAdminService — consultation et réinitialisation KYC côté admin")
class KycAdminServiceTest {

    @Mock KycRepository kycRepository;
    @Mock UserRepository userRepository;
    @Mock AuditService auditService;
    @Mock NotificationDispatcher notificationDispatcher;

    KycAdminService service;

    private static final UUID ADMIN_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new KycAdminService(kycRepository, userRepository, auditService, notificationDispatcher);
    }

    private UserEntity buildUser(KycStatus status) {
        UserEntity u = new UserEntity();
        setId(u, UUID.randomUUID());
        u.setFirebaseUid("uid-001");
        u.setKycStatus(status);
        return u;
    }

    private KycVerificationEntity buildKyc(UUID userId, KycVerificationStatus status, String sessionId) {
        KycVerificationEntity kyc = new KycVerificationEntity();
        setId(kyc, UUID.randomUUID());
        kyc.setUserId(userId);
        kyc.setStatus(status);
        kyc.setStripeVerificationSessionId(sessionId);
        return kyc;
    }

    private static void setId(Object entity, UUID id) {
        try {
            Field f = entity.getClass().getSuperclass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    // ── getForUser ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("utilisateur introuvable → 404 user-not-found")
    void getForUser_userNotFound_throws404() {
        UUID unknown = UUID.randomUUID();
        when(userRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getForUser(unknown))
                .isInstanceOf(YadonyBusinessException.class)
                .satisfies(e -> {
                    YadonyBusinessException y = (YadonyBusinessException) e;
                    assertThat(y.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(y.getErrorCode()).isEqualTo("user-not-found");
                });
    }

    @Test
    @DisplayName("aucune ligne KYC → NOT_STARTED des deux côtés, Stripe non interrogé")
    void getForUser_noKycRow_returnsNotStarted() {
        UserEntity user = buildUser(KycStatus.NOT_STARTED);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.empty());

        KycAdminStatusResponse resp = service.getForUser(user.getId());

        assertThat(resp.kycStatus()).isEqualTo("NOT_STARTED");
        assertThat(resp.verificationStatus()).isEqualTo("NOT_STARTED");
        assertThat(resp.stripeSessionId()).isNull();
        assertThat(resp.stripeStatus()).isNull();
        // Absence de session ≠ indisponibilité Stripe.
        assertThat(resp.stripeUnavailable()).isFalse();
    }

    @Test
    @DisplayName("session courante enrichie par l'appel live Stripe")
    void getForUser_enrichesWithStripeSession() {
        UserEntity user = buildUser(KycStatus.REJECTED);
        KycVerificationEntity kyc = buildKyc(user.getId(), KycVerificationStatus.REJECTED, "vs_001");
        kyc.setRejectionReason("document_expired");
        kyc.setRejectionCode("document_expired");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.of(kyc));

        try (MockedStatic<VerificationSession> vs = mockStatic(VerificationSession.class)) {
            VerificationSession session = mock(VerificationSession.class);
            VerificationSession.LastError lastError = mock(VerificationSession.LastError.class);
            when(session.getStatus()).thenReturn("requires_input");
            when(session.getCreated()).thenReturn(1_770_000_000L);
            when(session.getLastError()).thenReturn(lastError);
            when(lastError.getCode()).thenReturn("document_expired");
            when(lastError.getReason()).thenReturn("The document has expired.");
            vs.when(() -> VerificationSession.retrieve("vs_001")).thenReturn(session);

            KycAdminStatusResponse resp = service.getForUser(user.getId());

            assertThat(resp.kycStatus()).isEqualTo("REJECTED");
            assertThat(resp.verificationStatus()).isEqualTo("REJECTED");
            assertThat(resp.stripeSessionId()).isEqualTo("vs_001");
            assertThat(resp.stripeStatus()).isEqualTo("requires_input");
            assertThat(resp.stripeLastErrorCode()).isEqualTo("document_expired");
            assertThat(resp.stripeLastErrorReason()).isEqualTo("The document has expired.");
            assertThat(resp.stripeCreatedAt()).isNotNull();
            assertThat(resp.stripeUnavailable()).isFalse();
        }
    }

    @Test
    @DisplayName("Stripe injoignable → état local + stripeUnavailable, jamais d'exception")
    void getForUser_stripeFails_degradesGracefully() {
        UserEntity user = buildUser(KycStatus.PENDING);
        KycVerificationEntity kyc = buildKyc(user.getId(), KycVerificationStatus.PENDING, "vs_001");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.of(kyc));

        try (MockedStatic<VerificationSession> vs = mockStatic(VerificationSession.class)) {
            vs.when(() -> VerificationSession.retrieve("vs_001"))
                    .thenThrow(new RuntimeException("stripe down"));

            KycAdminStatusResponse resp = service.getForUser(user.getId());

            assertThat(resp.stripeUnavailable()).isTrue();
            assertThat(resp.stripeStatus()).isNull();
            assertThat(resp.kycStatus()).isEqualTo("PENDING");
            assertThat(resp.stripeSessionId()).isEqualTo("vs_001");
        }
    }

    // ── resetForUser ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("reset : UPDATE en place et resynchronisation des DEUX enums de statut")
    void resetForUser_updatesRowInPlaceAndSyncsBothEnums() {
        UserEntity user = buildUser(KycStatus.REJECTED);
        KycVerificationEntity kyc = buildKyc(user.getId(), KycVerificationStatus.REJECTED, "vs_001");
        kyc.setRejectionReason("document_expired");
        kyc.setRejectionCode("document_expired");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.of(kyc));

        try (MockedStatic<VerificationSession> vs = mockStatic(VerificationSession.class)) {
            VerificationSession session = mock(VerificationSession.class);
            vs.when(() -> VerificationSession.retrieve("vs_001")).thenReturn(session);

            KycAdminStatusResponse resp = service.resetForUser(user.getId(), ADMIN_ID, "document illisible");

            assertThat(user.getKycStatus()).isEqualTo(KycStatus.NOT_STARTED);
            assertThat(kyc.getStatus()).isEqualTo(KycVerificationStatus.PENDING);
            assertThat(kyc.getStripeVerificationSessionId()).isNull();
            assertThat(kyc.getRejectionReason()).isNull();
            assertThat(kyc.getRejectionCode()).isNull();
            // La ligne n'est JAMAIS soft-deletée : uq_kyc_user_id est une contrainte UNIQUE
            // classique, une recréation ultérieure la violerait.
            assertThat(kyc.getDeletedAt()).isNull();
            assertThat(resp.kycStatus()).isEqualTo("NOT_STARTED");
            assertThat(resp.stripeSessionId()).isNull();

            verify(kycRepository).save(kyc);
            verify(userRepository).save(user);
            verify(session).cancel();
        }
    }

    @Test
    @DisplayName("reset : audit KYC_RESET_BY_ADMIN + notification à l'utilisateur")
    void resetForUser_auditsAndNotifies() {
        UserEntity user = buildUser(KycStatus.VERIFIED);
        KycVerificationEntity kyc = buildKyc(user.getId(), KycVerificationStatus.VERIFIED, null);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.of(kyc));

        service.resetForUser(user.getId(), ADMIN_ID, "fraude suspectée");

        verify(auditService).log(eq("kyc_verification"), eq(kyc.getId()), eq("KYC_RESET_BY_ADMIN"),
                eq(ADMIN_ID), any());
        verify(notificationDispatcher).notifyUser(eq(user.getId()), any(), any(), any());
    }

    @Test
    @DisplayName("reset : l'échec de l'annulation Stripe ne bloque pas la remise à zéro locale")
    void resetForUser_stripeCancelFails_stillResetsLocally() {
        UserEntity user = buildUser(KycStatus.PENDING);
        KycVerificationEntity kyc = buildKyc(user.getId(), KycVerificationStatus.PENDING, "vs_001");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.of(kyc));

        try (MockedStatic<VerificationSession> vs = mockStatic(VerificationSession.class)) {
            vs.when(() -> VerificationSession.retrieve("vs_001"))
                    .thenThrow(new RuntimeException("stripe down"));

            service.resetForUser(user.getId(), ADMIN_ID, "motif");

            assertThat(user.getKycStatus()).isEqualTo(KycStatus.NOT_STARTED);
            assertThat(kyc.getStripeVerificationSessionId()).isNull();
        }
    }

    @Test
    @DisplayName("reset : aucune ligne KYC → 422 kyc-not-started")
    void resetForUser_noKycRow_throws422() {
        UserEntity user = buildUser(KycStatus.NOT_STARTED);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(kycRepository.findByUserId(user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetForUser(user.getId(), ADMIN_ID, "motif"))
                .isInstanceOf(YadonyBusinessException.class)
                .satisfies(e -> {
                    YadonyBusinessException y = (YadonyBusinessException) e;
                    assertThat(y.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(y.getErrorCode()).isEqualTo("kyc-not-started");
                });
    }
}
```

- [ ] **Step 2: Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=KycAdminServiceTest
```
Attendu : **échec de compilation** — `cannot find symbol: class KycAdminService` / `class KycAdminStatusResponse`.

- [ ] **Step 3: Créer le DTO**

`src/main/java/com/yadony/api/kyc/dto/KycAdminStatusResponse.java` :

```java
package com.yadony.api.kyc.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Vue KYC administrateur : les DEUX statuts locaux (public.users.kyc_status et
 * kyc_schema.kyc_verifications.status, maintenus en parallèle), enrichis par un appel
 * live à Stripe Identity sur la session courante.
 *
 * <p>Ni document ni URL présignée à exposer : les colonnes {@code id_document_encrypted}
 * et {@code selfie_url} ont été supprimées par {@code V46__kyc_cleanup.sql} — Stripe est la
 * seule source de vérité des pièces.
 *
 * <p>Pas d'historique non plus : {@code uq_kyc_user_id} impose une seule ligne par
 * utilisateur, chaque nouvelle session écrasant l'identifiant précédent. Cette vue décrit
 * donc la <em>session courante</em>.
 *
 * @param stripeUnavailable {@code true} uniquement si l'appel Stripe a échoué — jamais
 *                          quand il n'y a simplement aucune session à interroger.
 */
public record KycAdminStatusResponse(
        UUID userId,
        String kycStatus,
        String verificationStatus,
        String rejectionReason,
        String rejectionCode,
        String stripeSessionId,
        String stripeStatus,
        String stripeLastErrorCode,
        String stripeLastErrorReason,
        LocalDateTime stripeCreatedAt,
        boolean stripeUnavailable
) {}
```

- [ ] **Step 4: Créer le service**

`src/main/java/com/yadony/api/kyc/KycAdminService.java` :

```java
package com.yadony.api.kyc;

import com.yadony.api.auth.KycStatus;
import com.yadony.api.auth.UserEntity;
import com.yadony.api.auth.UserRepository;
import com.yadony.api.common.AuditService;
import com.yadony.api.common.YadonyBusinessException;
import com.yadony.api.kyc.dto.KycAdminStatusResponse;
import com.yadony.api.notifications.NotificationDispatcher;
import com.stripe.model.identity.VerificationSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * KYC côté administrateur — délibérément distinct de {@link KycService}.
 *
 * <p>{@code KycService} est keyé sur {@code String firebaseUid} (self-service mobile), alors
 * que toute route {@code /admin/**} est keyée sur {@code UUID userId}. Réutiliser ses
 * méthodes imposerait une résolution supplémentaire à chaque appel ; ce service travaille
 * directement en UUID via {@link KycRepository#findByUserId(UUID)}.
 */
@Service
public class KycAdminService {

    private static final Logger log = LoggerFactory.getLogger(KycAdminService.class);

    /** Rendu quand aucune ligne KYC n'existe : l'enum de kyc_schema n'a pas de NOT_STARTED. */
    private static final String NOT_STARTED = "NOT_STARTED";

    private final KycRepository kycRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final NotificationDispatcher notificationDispatcher;

    public KycAdminService(KycRepository kycRepository,
                           UserRepository userRepository,
                           AuditService auditService,
                           NotificationDispatcher notificationDispatcher) {
        this.kycRepository = kycRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.notificationDispatcher = notificationDispatcher;
    }

    @Transactional(readOnly = true)
    public KycAdminStatusResponse getForUser(UUID userId) {
        UserEntity user = requireUser(userId);
        Optional<KycVerificationEntity> kyc = kycRepository.findByUserId(userId);
        String sessionId = kyc.map(KycVerificationEntity::getStripeVerificationSessionId).orElse(null);

        StripeView stripe = sessionId != null ? retrieveStripeView(sessionId) : StripeView.absent();

        return new KycAdminStatusResponse(
                userId,
                user.getKycStatus().name(),
                kyc.map(k -> k.getStatus().name()).orElse(NOT_STARTED),
                kyc.map(KycVerificationEntity::getRejectionReason).orElse(null),
                kyc.map(KycVerificationEntity::getRejectionCode).orElse(null),
                sessionId,
                stripe.status(),
                stripe.lastErrorCode(),
                stripe.lastErrorReason(),
                stripe.createdAt(),
                stripe.unavailable()
        );
    }

    /**
     * Réinitialise le KYC d'un utilisateur : annule la session Identity en cours côté Stripe
     * (best-effort), puis remet la ligne locale à zéro <strong>par UPDATE en place</strong>.
     *
     * <p>Jamais de soft-delete suivi d'une recréation : {@code uq_kyc_user_id}
     * ({@code V2__init_kyc_schema.sql:19}) est une contrainte UNIQUE classique, sans
     * {@code WHERE deleted_at IS NULL} — la ligne soft-deletée resterait physiquement
     * présente et l'insertion suivante violerait la contrainte.
     *
     * <p>L'état obtenu ({@code users.kyc_status = NOT_STARTED} + ligne conservée en
     * {@code PENDING} sans session) est exactement celui que produit déjà
     * {@code KycService.abandonSession} : {@code createSession} reprend ensuite le chemin
     * {@code NOT_STARTED} et réécrit la ligne existante.
     */
    @Transactional
    public KycAdminStatusResponse resetForUser(UUID userId, UUID adminId, String reason) {
        UserEntity user = requireUser(userId);
        KycVerificationEntity kyc = kycRepository.findByUserId(userId)
                .orElseThrow(() -> new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "kyc-not-started", "Unprocessable",
                        "Cet utilisateur n'a jamais démarré de vérification d'identité"));

        String previousSessionId = kyc.getStripeVerificationSessionId();
        KycVerificationStatus previousStatus = kyc.getStatus();

        // Best-effort : une session Stripe injoignable ou déjà terminée ne doit jamais bloquer
        // la remise à zéro locale (même politique que KycService.abandonSession).
        if (previousSessionId != null) {
            try {
                VerificationSession.retrieve(previousSessionId).cancel();
            } catch (Exception e) {
                log.warn("Could not cancel Stripe KYC session {} on admin reset: {}",
                        previousSessionId, e.getMessage());
            }
        }

        kyc.setStatus(KycVerificationStatus.PENDING);
        kyc.setStripeVerificationSessionId(null);
        kyc.setRejectionReason(null);
        kyc.setRejectionCode(null);
        kycRepository.save(kyc);

        // Les deux enums sont resynchronisés à la main à chaque transition : n'en toucher
        // qu'un ferait diverger les sources de vérité en silence.
        user.setKycStatus(KycStatus.NOT_STARTED);
        userRepository.save(user);

        auditService.log("kyc_verification", kyc.getId(), "KYC_RESET_BY_ADMIN", adminId,
                Map.of("userId", userId.toString(),
                        "reason", reason != null ? reason : "",
                        "previousStatus", previousStatus.name(),
                        "previousSessionId", previousSessionId != null ? previousSessionId : ""));

        notificationDispatcher.notifyUser(userId,
                "Vérification d'identité réinitialisée",
                "Votre vérification d'identité a été réinitialisée par un administrateur. "
                        + "Vous pouvez la relancer depuis l'application.",
                Map.of("type", "KYC_RESET"));

        log.info("KYC reset for user {} by admin {}", userId, adminId);

        return new KycAdminStatusResponse(
                userId, KycStatus.NOT_STARTED.name(), KycVerificationStatus.PENDING.name(),
                null, null, null, null, null, null, null, false);
    }

    private UserEntity requireUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new YadonyBusinessException(HttpStatus.NOT_FOUND,
                        "user-not-found", "Not Found", "Utilisateur introuvable"));
    }

    /**
     * Lecture Stripe en dégradation propre : toute erreur devient {@code unavailable = true},
     * jamais une 5xx renvoyée à l'admin.
     */
    private StripeView retrieveStripeView(String sessionId) {
        try {
            VerificationSession session = VerificationSession.retrieve(sessionId);
            VerificationSession.LastError lastError = session.getLastError();
            LocalDateTime createdAt = session.getCreated() != null
                    ? LocalDateTime.ofInstant(Instant.ofEpochSecond(session.getCreated()), ZoneOffset.UTC)
                    : null;
            return new StripeView(
                    session.getStatus(),
                    lastError != null ? lastError.getCode() : null,
                    lastError != null ? lastError.getReason() : null,
                    createdAt,
                    false);
        } catch (Exception e) {
            log.warn("Stripe Identity unavailable for session {}: {}", sessionId, e.getMessage());
            return new StripeView(null, null, null, null, true);
        }
    }

    private record StripeView(String status, String lastErrorCode, String lastErrorReason,
                              LocalDateTime createdAt, boolean unavailable) {
        /** Aucune session à interroger : ce n'est pas une indisponibilité Stripe. */
        static StripeView absent() {
            return new StripeView(null, null, null, null, false);
        }
    }
}
```

- [ ] **Step 5: Relancer le test de la classe**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=KycAdminServiceTest
```
Attendu : `Tests run: 8, Failures: 0, Errors: 0`.

- [ ] **Step 6: Suite complète du dépôt**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
```
Attendu : `Tests run: 3558, Failures: 0, Errors: 0, Skipped: 7`. Rapporter le décompte réel.

- [ ] **Step 7: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/kyc/dto/KycAdminStatusResponse.java \
        src/main/java/com/yadony/api/kyc/KycAdminService.java \
        src/test/java/com/yadony/api/kyc/KycAdminServiceTest.java
git commit -m "feat(kyc): service admin de consultation et de réinitialisation du KYC"
```

---

### Task 5: Endpoints REST `/admin/users/{userId}/kyc` et `/kyc/reset`

**Dépôt :** `dony-back`

⚠️ **Rappel d'arbitrage (cf. « Arbitrages » en tête de plan) :** `hasRole('ADMIN')` n'exclut PAS SUPPORT — tout `AdminPrincipal` porte l'authority `ROLE_ADMIN`. `AdminRole.SUPPORT` accorde déjà `USER_KYC` : SUPPORT peut donc consulter **et** réinitialiser un KYC, ce qui est le geste de support pour lequel cette permission a été déclarée. Les tests d'intégration prouvent la morsure de l'authority avec un principal admin **privé** de `USER_KYC`, pas avec SUPPORT.

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/dto/KycResetRequest.java`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/AdminUserKycController.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/AdminUserKycControllerIT.java`

**Interfaces:**
- Consumes (Task 4) : `KycAdminService.getForUser(UUID) : KycAdminStatusResponse`, `KycAdminService.resetForUser(UUID, UUID, String) : KycAdminStatusResponse`. Et `AdminPrincipal.adminId() : UUID` (cf. `AdminAnnouncementModerationController.adminId(Authentication)`).
- Produces (consommés par le front, Tasks 9-10) :
  - `GET /admin/users/{userId}/kyc` → `200` + `KycAdminStatusResponse` (JSON) — permission `USER_KYC`.
  - `POST /admin/users/{userId}/kyc/reset` body `{"reason": "..."}` → `200` + `KycAdminStatusResponse` — permission `USER_KYC`. Motif vide → `422` (bean validation). Utilisateur inconnu → `404` `user-not-found`. Aucune ligne KYC → `422` `kyc-not-started`.
  - `record KycResetRequest(String reason)`

- [ ] **Step 1: Écrire le test d'intégration en échec**

Créer `src/test/java/com/yadony/api/admin/AdminUserKycControllerIT.java`, calqué sur `AdminAnnouncementModerationControllerIT` (`@SpringBootTest` + `MockMvc` + `authentication(...)`, qui court-circuite `FirebaseTokenFilter`) :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.account.AdminRole;
import com.yadony.api.admin.dto.KycResetRequest;
import com.yadony.api.common.YadonyBusinessException;
import com.yadony.api.kyc.KycAdminService;
import com.yadony.api.kyc.dto.KycAdminStatusResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lot C — matrice de permission et mapping HTTP de /admin/users/{userId}/kyc.
 *
 * <p>SUPPORT possède USER_KYC (cf. AdminRole.SUPPORT) : il a donc accès aux deux endpoints.
 * Le test de refus utilise un principal admin PRIVÉ de USER_KYC — hasRole('ADMIN') seul
 * n'exclut personne, tout AdminPrincipal portant ROLE_ADMIN.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("AdminUserKycControllerIT — /admin/users/{userId}/kyc")
class AdminUserKycControllerIT {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean KycAdminService kycAdminService;

    private static final UUID USER_ID = UUID.randomUUID();

    /** Admin complet : ROLE_ADMIN + USER_KYC. */
    private static UsernamePasswordAuthenticationToken adminAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "admin@yadony.test", AdminRole.ADMIN, false, "uid-admin-lotc");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("USER_KYC")));
    }

    /** SUPPORT : AdminRole.SUPPORT accorde USER_KYC — accès attendu. */
    private static UsernamePasswordAuthenticationToken supportAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "support@yadony.test", AdminRole.SUPPORT, false, "uid-support-lotc");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("USER_KYC")));
    }

    /** Admin dont USER_KYC a été révoquée par override : c'est l'authority qui doit mordre. */
    private static UsernamePasswordAuthenticationToken adminWithoutKycAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "nokyc@yadony.test", AdminRole.ADMIN, false, "uid-nokyc-lotc");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private static KycAdminStatusResponse sampleResponse() {
        return new KycAdminStatusResponse(USER_ID, "REJECTED", "REJECTED",
                "document_expired", "document_expired", "vs_001", "requires_input",
                "document_expired", "The document has expired.", null, false);
    }

    // ── GET /admin/users/{userId}/kyc ─────────────────────────────────────────

    @Test
    @DisplayName("GET — admin avec USER_KYC → 200 + les deux statuts et la session Stripe")
    void get_withUserKyc_returns200() throws Exception {
        when(kycAdminService.getForUser(USER_ID)).thenReturn(sampleResponse());

        mockMvc.perform(get("/admin/users/{userId}/kyc", USER_ID)
                        .with(authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kycStatus").value("REJECTED"))
                .andExpect(jsonPath("$.verificationStatus").value("REJECTED"))
                .andExpect(jsonPath("$.stripeSessionId").value("vs_001"))
                .andExpect(jsonPath("$.stripeUnavailable").value(false));
    }

    @Test
    @DisplayName("GET — SUPPORT (qui possède USER_KYC) → 200")
    void get_withSupportRole_returns200() throws Exception {
        when(kycAdminService.getForUser(USER_ID)).thenReturn(sampleResponse());

        mockMvc.perform(get("/admin/users/{userId}/kyc", USER_ID)
                        .with(authentication(supportAuth())))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET — admin sans USER_KYC → 403")
    void get_withoutUserKyc_returns403() throws Exception {
        mockMvc.perform(get("/admin/users/{userId}/kyc", USER_ID)
                        .with(authentication(adminWithoutKycAuth())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET — Stripe indisponible → 200 avec stripeUnavailable, jamais 500")
    void get_stripeUnavailable_returns200() throws Exception {
        when(kycAdminService.getForUser(USER_ID)).thenReturn(new KycAdminStatusResponse(
                USER_ID, "PENDING", "PENDING", null, null, "vs_001", null, null, null, null, true));

        mockMvc.perform(get("/admin/users/{userId}/kyc", USER_ID)
                        .with(authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stripeUnavailable").value(true))
                .andExpect(jsonPath("$.stripeStatus").doesNotExist());
    }

    // ── POST /admin/users/{userId}/kyc/reset ──────────────────────────────────

    @Test
    @DisplayName("POST /reset — admin sans USER_KYC → 403")
    void reset_withoutUserKyc_returns403() throws Exception {
        mockMvc.perform(post("/admin/users/{userId}/kyc/reset", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new KycResetRequest("document illisible")))
                        .with(authentication(adminWithoutKycAuth())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /reset — admin avec USER_KYC → 200 + statuts remis à zéro")
    void reset_withUserKyc_returns200() throws Exception {
        when(kycAdminService.resetForUser(eq(USER_ID), any(), eq("document illisible")))
                .thenReturn(new KycAdminStatusResponse(USER_ID, "NOT_STARTED", "PENDING",
                        null, null, null, null, null, null, null, false));

        mockMvc.perform(post("/admin/users/{userId}/kyc/reset", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new KycResetRequest("document illisible")))
                        .with(authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kycStatus").value("NOT_STARTED"))
                .andExpect(jsonPath("$.stripeSessionId").doesNotExist());
    }

    @Test
    @DisplayName("POST /reset — motif vide → 422 (bean validation)")
    void reset_blankReason_returns422() throws Exception {
        mockMvc.perform(post("/admin/users/{userId}/kyc/reset", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new KycResetRequest("")))
                        .with(authentication(adminAuth())))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("POST /reset — aucune vérification démarrée → 422 kyc-not-started (RFC 7807)")
    void reset_kycNotStarted_returns422WithCode() throws Exception {
        when(kycAdminService.resetForUser(eq(USER_ID), any(), any()))
                .thenThrow(new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "kyc-not-started", "Unprocessable",
                        "Cet utilisateur n'a jamais démarré de vérification d'identité"));

        mockMvc.perform(post("/admin/users/{userId}/kyc/reset", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new KycResetRequest("motif")))
                        .with(authentication(adminAuth())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("kyc-not-started"));
    }

    @Test
    @DisplayName("GET — utilisateur introuvable → 404 user-not-found (RFC 7807)")
    void get_userNotFound_returns404WithCode() throws Exception {
        when(kycAdminService.getForUser(USER_ID))
                .thenThrow(new YadonyBusinessException(HttpStatus.NOT_FOUND,
                        "user-not-found", "Not Found", "Utilisateur introuvable"));

        mockMvc.perform(get("/admin/users/{userId}/kyc", USER_ID)
                        .with(authentication(adminAuth())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("user-not-found"));
    }
}
```

- [ ] **Step 2: Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminUserKycControllerIT
```
Attendu : **échec de compilation** — `cannot find symbol: class KycResetRequest`.

- [ ] **Step 3: Créer le DTO de requête**

`src/main/java/com/yadony/api/admin/dto/KycResetRequest.java` :

```java
package com.yadony.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Lot C — réinitialisation du KYC d'un utilisateur par un administrateur. */
public record KycResetRequest(
        @NotBlank(message = "Le motif est obligatoire")
        @Size(max = 500) String reason
) {}
```

- [ ] **Step 4: Créer le contrôleur**

`src/main/java/com/yadony/api/admin/AdminUserKycController.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.dto.KycResetRequest;
import com.yadony.api.common.YadonyBusinessException;
import com.yadony.api.kyc.KycAdminService;
import com.yadony.api.kyc.dto.KycAdminStatusResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Lot C — KYC d'un utilisateur vu par l'administration.
 *
 * <p>Contrôleur séparé d'{@code AdminUserController} : celui-ci porte déjà dix gestes de
 * compte, et la vue KYC dépend d'un service et d'un DTO qui lui sont propres.
 *
 * <p>SUPPORT possède {@code USER_KYC} ({@code AdminRole.SUPPORT}) : il a accès aux deux
 * endpoints. C'est délibéré — un reset KYC ne détruit aucune donnée, il remet l'utilisateur
 * en état de refaire sa vérification. Le geste irréversible du lot est l'exécution RGPD,
 * fermée à SUPPORT.
 */
@RestController
@RequestMapping("/admin/users/{userId}/kyc")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserKycController {

    private final KycAdminService kycAdminService;

    public AdminUserKycController(KycAdminService kycAdminService) {
        this.kycAdminService = kycAdminService;
    }

    @PreAuthorize("hasAuthority('USER_KYC')")
    @GetMapping
    public KycAdminStatusResponse get(@PathVariable UUID userId) {
        return kycAdminService.getForUser(userId);
    }

    @PreAuthorize("hasRole('ADMIN') and hasAuthority('USER_KYC')")
    @PostMapping("/reset")
    public KycAdminStatusResponse reset(@PathVariable UUID userId,
                                        @RequestBody @Valid KycResetRequest request,
                                        Authentication authentication) {
        return kycAdminService.resetForUser(userId, adminId(authentication), request.reason());
    }

    /** Même extraction que {@code AdminAnnouncementModerationController} : l'audit doit
     *  porter l'identifiant de l'administrateur, jamais celui de l'utilisateur ciblé. */
    private UUID adminId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AdminPrincipal principal) {
            return principal.adminId();
        }
        throw new YadonyBusinessException(HttpStatus.FORBIDDEN,
                "admin-principal-required", "Admin Principal Required",
                "Authentification administrateur requise");
    }
}
```

- [ ] **Step 5: Relancer le test de la classe**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminUserKycControllerIT
```
Attendu : `Tests run: 9, Failures: 0, Errors: 0`.

- [ ] **Step 6: Suite complète du dépôt**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
```
Attendu : `Tests run: 3567, Failures: 0, Errors: 0, Skipped: 7`. Rapporter le décompte réel.

- [ ] **Step 7: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/dto/KycResetRequest.java \
        src/main/java/com/yadony/api/admin/AdminUserKycController.java \
        src/test/java/com/yadony/api/admin/AdminUserKycControllerIT.java
git commit -m "feat(admin): endpoints de consultation et de réinitialisation du KYC (USER_KYC)"
```

---

### Task 6: `AdminGdprService` — file des demandes + exécution via `finalize(ADMIN_INITIATED)`

**Dépôt :** `dony-back`

⚠️ **Ne jamais passer par `AuthService.deleteImmediately`** : cette méthode exige un `auth_time` Firebase de moins de 5 minutes **de l'utilisateur lui-même** (`AuthService.java:334-347`, lu dans `SecurityContextHolder...getCredentials()`). Un token admin ne le satisfera jamais → `401 reauth-required` systématique. Le point d'entrée correct est `AccountFinalizationService.finalize(user, FinalizationReason.ADMIN_INITIATED)`, appelé **en synchrone**.

⚠️ **Refus = 422 avec les slugs existants.** Les deux gardes sont déjà portées par `UserService` — `hasActiveEscrow(UUID)` (→ `active-transactions`) et `assertNoWalletBalance(UUID)` (→ `wallet-balance-not-empty`, qui lève elle-même la 422). Les réutiliser tel quel garantit un seul jeu de codes entre le self-service mobile et le geste admin.

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/auth/UserRepository.java`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/auth/AdminGdprService.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/auth/AdminGdprServiceTest.java`

**Interfaces:**
- Consumes: `UserService.hasActiveEscrow(UUID) : boolean`, `UserService.assertNoWalletBalance(UUID) : void`, `AccountFinalizationService.finalize(UserEntity, FinalizationReason)` (Task 3), `FinalizationReason.ADMIN_INITIATED` (Task 3), `AuditService.log(...)`.
- Produces (consommés par la Task 7) :
  - `UserRepository.findByDeletionRequestedAtIsNotNullOrderByDeletionRequestedAtAsc(Pageable) : Page<UserEntity>`
  - `AdminGdprService.listDeletionRequests(Pageable pageable) : Page<UserEntity>`
  - `AdminGdprService.executeDeletion(UUID userId, UUID adminId, String reason) : void`

- [ ] **Step 1: Écrire le test en échec**

Créer `src/test/java/com/yadony/api/auth/AdminGdprServiceTest.java` :

```java
package com.yadony.api.auth;

import com.yadony.api.common.AuditService;
import com.yadony.api.common.YadonyBusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminGdprService — file des demandes RGPD et exécution par un administrateur")
class AdminGdprServiceTest {

    @Mock UserRepository userRepository;
    @Mock UserService userService;
    @Mock AccountFinalizationService accountFinalizationService;
    @Mock AuditService auditService;

    AdminGdprService service;

    private static final UUID ADMIN_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new AdminGdprService(userRepository, userService, accountFinalizationService, auditService);
    }

    private UserEntity buildPendingUser() {
        UserEntity u = new UserEntity();
        setId(u, UUID.randomUUID());
        u.setFirebaseUid("uid-001");
        u.setFirstName("Jean");
        u.setLastName("Dupont");
        u.setStatus(UserStatus.PENDING_DELETION);
        u.setDeletionRequestedAt(Instant.parse("2026-07-01T00:00:00Z"));
        return u;
    }

    private static void setId(Object entity, UUID id) {
        try {
            Field f = entity.getClass().getSuperclass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    // ── listDeletionRequests ──────────────────────────────────────────────────

    @Test
    @DisplayName("file : les demandes les plus anciennes d'abord, comptes finalisés exclus")
    void listDeletionRequests_delegatesToRepositoryOrderedByAge() {
        UserEntity user = buildPendingUser();
        Pageable pageable = PageRequest.of(0, 20);
        when(userRepository.findByDeletionRequestedAtIsNotNullOrderByDeletionRequestedAtAsc(pageable))
                .thenReturn(new PageImpl<>(List.of(user), pageable, 1));

        Page<UserEntity> page = service.listDeletionRequests(pageable);

        assertThat(page.getContent()).containsExactly(user);
        // @Where(deleted_at IS NULL) sur UserEntity exclut déjà les comptes finalisés :
        // la requête dérivée en hérite, aucun filtre supplémentaire n'est nécessaire.
        verify(userRepository).findByDeletionRequestedAtIsNotNullOrderByDeletionRequestedAtAsc(pageable);
    }

    // ── executeDeletion ───────────────────────────────────────────────────────

    @Test
    @DisplayName("exécution : finalize appelé avec ADMIN_INITIATED, pas deleteImmediately")
    void executeDeletion_callsFinalizeWithAdminInitiated() {
        UserEntity user = buildPendingUser();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userService.hasActiveEscrow(user.getId())).thenReturn(false);

        service.executeDeletion(user.getId(), ADMIN_ID, "demande utilisateur confirmée");

        verify(accountFinalizationService).finalize(user, FinalizationReason.ADMIN_INITIATED);
    }

    @Test
    @DisplayName("exécution : audit USER_GDPR_EXECUTED avec l'admin comme acteur")
    void executeDeletion_auditsWithAdminAsActor() {
        UserEntity user = buildPendingUser();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userService.hasActiveEscrow(user.getId())).thenReturn(false);

        service.executeDeletion(user.getId(), ADMIN_ID, "demande utilisateur confirmée");

        verify(auditService).log(eq("USER"), eq(user.getId()), eq("USER_GDPR_EXECUTED"),
                eq(ADMIN_ID), any());
    }

    @Test
    @DisplayName("exécution : escrow actif → 422 active-transactions, rien n'est finalisé")
    void executeDeletion_activeEscrow_throws422() {
        UserEntity user = buildPendingUser();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userService.hasActiveEscrow(user.getId())).thenReturn(true);

        assertThatThrownBy(() -> service.executeDeletion(user.getId(), ADMIN_ID, "motif"))
                .isInstanceOf(YadonyBusinessException.class)
                .satisfies(e -> {
                    YadonyBusinessException y = (YadonyBusinessException) e;
                    assertThat(y.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(y.getErrorCode()).isEqualTo("active-transactions");
                });

        verifyNoInteractions(accountFinalizationService);
        verifyNoInteractions(auditService);
    }

    @Test
    @DisplayName("exécution : solde wallet non vide → 422 wallet-balance-not-empty via UserService")
    void executeDeletion_walletBalance_throws422() {
        UserEntity user = buildPendingUser();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userService.hasActiveEscrow(user.getId())).thenReturn(false);
        doThrow(new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                "wallet-balance-not-empty", "Unprocessable", "Solde wallet non nul"))
                .when(userService).assertNoWalletBalance(user.getId());

        assertThatThrownBy(() -> service.executeDeletion(user.getId(), ADMIN_ID, "motif"))
                .isInstanceOf(YadonyBusinessException.class)
                .satisfies(e -> assertThat(((YadonyBusinessException) e).getErrorCode())
                        .isEqualTo("wallet-balance-not-empty"));

        verifyNoInteractions(accountFinalizationService);
    }

    @Test
    @DisplayName("exécution : utilisateur inconnu ou déjà finalisé → 404 user-not-found")
    void executeDeletion_unknownOrAlreadyFinalized_throws404() {
        UUID unknown = UUID.randomUUID();
        when(userRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.executeDeletion(unknown, ADMIN_ID, "motif"))
                .isInstanceOf(YadonyBusinessException.class)
                .satisfies(e -> {
                    YadonyBusinessException y = (YadonyBusinessException) e;
                    assertThat(y.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(y.getErrorCode()).isEqualTo("user-not-found");
                });
    }
}
```

- [ ] **Step 2: Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminGdprServiceTest
```
Attendu : **échec de compilation** — `cannot find symbol: class AdminGdprService`.

- [ ] **Step 3: Ajouter la requête au repository**

Dans `UserRepository.java`, juste après `findByStatusAndDeletionRequestedAtBefore` (ligne 90) :

```java
    /**
     * Lot C — file des demandes de suppression RGPD, les plus anciennes d'abord.
     *
     * <p>Requête dérivée délibérée : elle hérite du {@code @Where(deleted_at IS NULL)} de
     * {@link UserEntity}, ce qui exclut d'office les comptes déjà finalisés — la file ne
     * montre donc que les demandes encore à traiter, sans filtre supplémentaire.
     */
    Page<UserEntity> findByDeletionRequestedAtIsNotNullOrderByDeletionRequestedAtAsc(Pageable pageable);
```

- [ ] **Step 4: Créer le service**

`src/main/java/com/yadony/api/auth/AdminGdprService.java` :

```java
package com.yadony.api.auth;

import com.yadony.api.common.AuditService;
import com.yadony.api.common.YadonyBusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * Lot C — traitement administrateur des demandes de suppression RGPD.
 *
 * <p>Ce service ne réimplémente aucune anonymisation : il délègue à
 * {@link AccountFinalizationService#finalize}, point d'entrée unique et déjà fonctionnel.
 *
 * <p>Il ne passe délibérément <strong>pas</strong> par {@code AuthService.deleteImmediately} :
 * celle-ci exige un {@code auth_time} Firebase de moins de 5 minutes appartenant à
 * l'utilisateur lui-même, condition qu'un token administrateur ne satisfait jamais — le
 * geste échouerait systématiquement en {@code 401 reauth-required}.
 */
@Service
public class AdminGdprService {

    private static final Logger log = LoggerFactory.getLogger(AdminGdprService.class);

    private final UserRepository userRepository;
    private final UserService userService;
    private final AccountFinalizationService accountFinalizationService;
    private final AuditService auditService;

    public AdminGdprService(UserRepository userRepository,
                            UserService userService,
                            AccountFinalizationService accountFinalizationService,
                            AuditService auditService) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.accountFinalizationService = accountFinalizationService;
        this.auditService = auditService;
    }

    /** File des demandes en attente, les plus anciennes d'abord. */
    @Transactional(readOnly = true)
    public Page<UserEntity> listDeletionRequests(Pageable pageable) {
        return userRepository.findByDeletionRequestedAtIsNotNullOrderByDeletionRequestedAtAsc(pageable);
    }

    /**
     * Exécute immédiatement l'anonymisation d'un compte. <strong>Irréversible.</strong>
     *
     * <p>Mêmes gardes et mêmes codes de refus que le chemin self-service, portés par
     * {@link UserService} : escrow actif → 422 {@code active-transactions}, solde wallet non
     * vide → 422 {@code wallet-balance-not-empty}. Introduire un 409 ici créerait deux
     * conventions pour un refus identique, déjà mappé par l'application mobile.
     *
     * <p>Un compte déjà finalisé n'est plus visible ({@code @Where(deleted_at IS NULL)}) :
     * un second appel répond 404, ce qui est l'issue attendue pour un geste irréversible.
     */
    @Transactional
    public void executeDeletion(UUID userId, UUID adminId, String reason) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new YadonyBusinessException(HttpStatus.NOT_FOUND,
                        "user-not-found", "Not Found", "Utilisateur introuvable"));

        if (userService.hasActiveEscrow(user.getId())) {
            throw new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "active-transactions",
                    "Unprocessable", "Impossible — cet utilisateur a des transactions en cours");
        }
        userService.assertNoWalletBalance(user.getId());

        // Écrit AVANT finalize() : celui-ci journalise USER_GDPR_DELETION avec l'utilisateur
        // comme acteur. Sans cette entrée, l'administrateur à l'origine du geste ne serait
        // tracé nulle part — audit_log étant immuable, la trace ne pourrait plus être ajoutée.
        auditService.log("USER", user.getId(), "USER_GDPR_EXECUTED", adminId,
                Map.of("initiatedBy", "admin", "reason", reason != null ? reason : ""));

        accountFinalizationService.finalize(user, FinalizationReason.ADMIN_INITIATED);
        log.info("GDPR deletion executed for user {} by admin {}", userId, adminId);
    }
}
```

- [ ] **Step 5: Relancer le test de la classe**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminGdprServiceTest
```
Attendu : `Tests run: 6, Failures: 0, Errors: 0`.

- [ ] **Step 6: Suite complète du dépôt**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
```
Attendu : `Tests run: 3573, Failures: 0, Errors: 0, Skipped: 7`. Rapporter le décompte réel.

- [ ] **Step 7: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/auth/UserRepository.java \
        src/main/java/com/yadony/api/auth/AdminGdprService.java \
        src/test/java/com/yadony/api/auth/AdminGdprServiceTest.java
git commit -m "feat(auth): file des demandes RGPD et exécution administrateur de l'anonymisation"
```

---

### Task 7: Endpoints REST `/admin/users/gdpr-requests` et `/admin/users/{userId}/gdpr-execute`

**Dépôt :** `dony-back`

⚠️ **Piège de routage à couvrir par un test.** `AdminUserController` déclare déjà `GET /admin/users/{userId}` avec `@PathVariable UUID userId`. `GET /admin/users/gdpr-requests` a un segment littéral : le `PathPatternParser` de Spring classe un motif littéral **avant** un motif à variable, donc la route littérale gagne. Le test `list_literalPathWinsOverUuidTemplate` verrouille ce comportement — sans lui, une régression de routage renverrait un 400 de conversion UUID en silence.

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/dto/AdminGdprRequestResponse.java`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/dto/GdprExecuteRequest.java`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/AdminGdprController.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/AdminGdprControllerIT.java`

**Interfaces:**
- Consumes (Task 6) : `AdminGdprService.listDeletionRequests(Pageable) : Page<UserEntity>`, `AdminGdprService.executeDeletion(UUID, UUID, String) : void`. Et `FirebaseContactService.getContacts(List<String>) : Map<String, Contact>` + `Contact.EMPTY` (cf. `AdminUserController.listUsers` lignes 75-78).
- Produces (consommés par le front, Tasks 9 et 11) :
  - `GET /admin/users/gdpr-requests?page=&size=` → `200` + `Page<AdminGdprRequestResponse>` — permission `USER_GDPR_DELETE`.
  - `POST /admin/users/{userId}/gdpr-execute` body `{"reason": "..."}` → `204 No Content` — permission `USER_GDPR_DELETE`. Refus → `422` `active-transactions` / `wallet-balance-not-empty`. Motif vide → `422`.
  - `record AdminGdprRequestResponse(UUID id, String firstName, String lastName, String email, String status, LocalDateTime deletionRequestedAt, long ageDays)`
  - `record GdprExecuteRequest(String reason)`

- [ ] **Step 1: Écrire le test d'intégration en échec**

Créer `src/test/java/com/yadony/api/admin/AdminGdprControllerIT.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.account.AdminRole;
import com.yadony.api.admin.dto.GdprExecuteRequest;
import com.yadony.api.auth.AdminGdprService;
import com.yadony.api.auth.FirebaseContactService;
import com.yadony.api.auth.UserEntity;
import com.yadony.api.auth.UserStatus;
import com.yadony.api.common.YadonyBusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lot C — matrice de permission et mapping HTTP de la file RGPD.
 * SUPPORT ne reçoit PAS USER_GDPR_DELETE (cf. AdminRole.SUPPORT) : les deux endpoints
 * doivent lui être fermés.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("AdminGdprControllerIT — /admin/users/gdpr-requests & /gdpr-execute")
class AdminGdprControllerIT {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean AdminGdprService adminGdprService;
    @MockitoBean FirebaseContactService firebaseContact;

    private static final UUID USER_ID = UUID.randomUUID();

    private static UsernamePasswordAuthenticationToken adminAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "admin@yadony.test", AdminRole.ADMIN, false, "uid-admin-gdpr");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("USER_GDPR_DELETE")));
    }

    /** SUPPORT — AdminRole.SUPPORT n'inclut pas USER_GDPR_DELETE. */
    private static UsernamePasswordAuthenticationToken supportAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "support@yadony.test", AdminRole.SUPPORT, false, "uid-support-gdpr");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private UserEntity buildPendingUser() {
        UserEntity u = new UserEntity();
        ReflectionTestUtils.setField(u, "id", USER_ID);
        u.setFirebaseUid("uid-001");
        u.setFirstName("Jean");
        u.setLastName("Dupont");
        u.setStatus(UserStatus.PENDING_DELETION);
        u.setDeletionRequestedAt(Instant.now().minus(12, ChronoUnit.DAYS));
        return u;
    }

    // ── GET /admin/users/gdpr-requests ────────────────────────────────────────

    @Test
    @DisplayName("GET — SUPPORT (sans USER_GDPR_DELETE) → 403")
    void list_withSupportRole_returns403() throws Exception {
        mockMvc.perform(get("/admin/users/gdpr-requests").with(authentication(supportAuth())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET — la route littérale l'emporte sur /admin/users/{userId}, et l'âge est calculé")
    void list_literalPathWinsOverUuidTemplate() throws Exception {
        when(adminGdprService.listDeletionRequests(any()))
                .thenReturn(new PageImpl<>(List.of(buildPendingUser()), PageRequest.of(0, 20), 1));
        when(firebaseContact.getContacts(anyList()))
                .thenReturn(Map.of("uid-001", new FirebaseContactService.Contact("+33600000000", "jean@x.fr")));

        mockMvc.perform(get("/admin/users/gdpr-requests").with(authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(USER_ID.toString()))
                .andExpect(jsonPath("$.content[0].email").value("jean@x.fr"))
                .andExpect(jsonPath("$.content[0].status").value("PENDING_DELETION"))
                .andExpect(jsonPath("$.content[0].ageDays").value(12));
    }

    // ── POST /admin/users/{userId}/gdpr-execute ───────────────────────────────

    @Test
    @DisplayName("POST — SUPPORT (sans USER_GDPR_DELETE) → 403")
    void execute_withSupportRole_returns403() throws Exception {
        mockMvc.perform(post("/admin/users/{userId}/gdpr-execute", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GdprExecuteRequest("motif")))
                        .with(authentication(supportAuth())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST — admin avec USER_GDPR_DELETE → 204 et délégation au service")
    void execute_withPermission_returns204() throws Exception {
        mockMvc.perform(post("/admin/users/{userId}/gdpr-execute", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new GdprExecuteRequest("demande utilisateur confirmée")))
                        .with(authentication(adminAuth())))
                .andExpect(status().isNoContent());

        verify(adminGdprService).executeDeletion(eq(USER_ID), any(), eq("demande utilisateur confirmée"));
    }

    @Test
    @DisplayName("POST — escrow actif → 422 active-transactions (RFC 7807), jamais 409")
    void execute_activeEscrow_returns422() throws Exception {
        doThrow(new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "active-transactions",
                "Unprocessable", "Impossible — cet utilisateur a des transactions en cours"))
                .when(adminGdprService).executeDeletion(eq(USER_ID), any(), any());

        mockMvc.perform(post("/admin/users/{userId}/gdpr-execute", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GdprExecuteRequest("motif")))
                        .with(authentication(adminAuth())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("active-transactions"));
    }

    @Test
    @DisplayName("POST — solde wallet non vide → 422 wallet-balance-not-empty")
    void execute_walletBalance_returns422() throws Exception {
        doThrow(new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "wallet-balance-not-empty",
                "Unprocessable", "Solde wallet non nul"))
                .when(adminGdprService).executeDeletion(eq(USER_ID), any(), any());

        mockMvc.perform(post("/admin/users/{userId}/gdpr-execute", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GdprExecuteRequest("motif")))
                        .with(authentication(adminAuth())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("wallet-balance-not-empty"));
    }

    @Test
    @DisplayName("POST — motif vide → 422 (bean validation)")
    void execute_blankReason_returns422() throws Exception {
        mockMvc.perform(post("/admin/users/{userId}/gdpr-execute", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GdprExecuteRequest("")))
                        .with(authentication(adminAuth())))
                .andExpect(status().isUnprocessableEntity());
    }
}
```

⚠️ Vérifier la forme réelle du record `FirebaseContactService.Contact` avant de lancer (`Contact(String phoneNumber, String email)` d'après `AdminUserDetailResponse.from`, qui appelle `contact.phoneNumber()` puis `contact.email()`). Si l'ordre ou l'arité diffère, adapter l'instanciation du test — jamais la production.

- [ ] **Step 2: Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminGdprControllerIT
```
Attendu : **échec de compilation** — `cannot find symbol: class GdprExecuteRequest`.

- [ ] **Step 3: Créer les deux DTO**

`src/main/java/com/yadony/api/admin/dto/GdprExecuteRequest.java` :

```java
package com.yadony.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Lot C — exécution administrateur d'une suppression RGPD. Irréversible. */
public record GdprExecuteRequest(
        @NotBlank(message = "Le motif est obligatoire")
        @Size(max = 500) String reason
) {}
```

`src/main/java/com/yadony/api/admin/dto/AdminGdprRequestResponse.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.auth.FirebaseContactService;
import com.yadony.api.auth.UserEntity;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Une ligne de la file des demandes de suppression RGPD.
 *
 * <p>{@code ageDays} est calculé au rendu plutôt que stocké : c'est ce que l'administrateur
 * lit pour prioriser, et le délai de grâce (30 jours) est en dur côté back.
 *
 * <p>L'email vient de Firebase, jamais de la base : {@code public.users} ne stocke ni
 * téléphone ni email.
 */
public record AdminGdprRequestResponse(
        UUID id,
        String firstName,
        String lastName,
        String email,
        String status,
        LocalDateTime deletionRequestedAt,
        long ageDays
) {
    public static AdminGdprRequestResponse from(UserEntity u, FirebaseContactService.Contact contact) {
        Instant requestedAt = u.getDeletionRequestedAt();
        return new AdminGdprRequestResponse(
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                contact.email(),
                u.getStatus().name(),
                requestedAt != null ? LocalDateTime.ofInstant(requestedAt, ZoneOffset.UTC) : null,
                requestedAt != null ? ChronoUnit.DAYS.between(requestedAt, Instant.now()) : 0L
        );
    }
}
```

- [ ] **Step 4: Créer le contrôleur**

`src/main/java/com/yadony/api/admin/AdminGdprController.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.dto.AdminGdprRequestResponse;
import com.yadony.api.admin.dto.GdprExecuteRequest;
import com.yadony.api.auth.AdminGdprService;
import com.yadony.api.auth.FirebaseContactService;
import com.yadony.api.auth.UserEntity;
import com.yadony.api.common.YadonyBusinessException;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Lot C — file des demandes de suppression RGPD et exécution administrateur.
 *
 * <p>{@code /admin/users/gdpr-requests} cohabite avec le {@code /admin/users/{userId}} d'
 * {@code AdminUserController} : le {@code PathPatternParser} classe un segment littéral
 * avant un segment à variable, la route littérale gagne donc. Comportement verrouillé par
 * {@code AdminGdprControllerIT.list_literalPathWinsOverUuidTemplate}.
 */
@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminGdprController {

    private final AdminGdprService adminGdprService;
    private final FirebaseContactService firebaseContact;

    public AdminGdprController(AdminGdprService adminGdprService,
                               FirebaseContactService firebaseContact) {
        this.adminGdprService = adminGdprService;
        this.firebaseContact = firebaseContact;
    }

    @PreAuthorize("hasAuthority('USER_GDPR_DELETE')")
    @GetMapping("/gdpr-requests")
    public Page<AdminGdprRequestResponse> listRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<UserEntity> users = adminGdprService.listDeletionRequests(PageRequest.of(page, size));
        // Un seul aller-retour Firebase pour toute la page, comme AdminUserController.listUsers.
        Map<String, FirebaseContactService.Contact> contacts = firebaseContact.getContacts(
                users.getContent().stream().map(UserEntity::getFirebaseUid).toList());
        return users.map(u -> AdminGdprRequestResponse.from(
                u, contacts.getOrDefault(u.getFirebaseUid(), FirebaseContactService.Contact.EMPTY)));
    }

    /** Irréversible : 204 sans corps, l'utilisateur ciblé n'existe plus sous sa forme lisible. */
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('USER_GDPR_DELETE')")
    @PostMapping("/{userId}/gdpr-execute")
    public ResponseEntity<Void> execute(@PathVariable UUID userId,
                                        @RequestBody @Valid GdprExecuteRequest request,
                                        Authentication authentication) {
        adminGdprService.executeDeletion(userId, adminId(authentication), request.reason());
        return ResponseEntity.noContent().build();
    }

    private UUID adminId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AdminPrincipal principal) {
            return principal.adminId();
        }
        throw new YadonyBusinessException(HttpStatus.FORBIDDEN,
                "admin-principal-required", "Admin Principal Required",
                "Authentification administrateur requise");
    }
}
```

- [ ] **Step 5: Relancer le test de la classe**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminGdprControllerIT
```
Attendu : `Tests run: 7, Failures: 0, Errors: 0`.

- [ ] **Step 6: Suite complète du dépôt**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test
```
Attendu : `Tests run: 3580, Failures: 0, Errors: 0, Skipped: 7`. Vérifier qu'aucun test existant de `AdminUserControllerTest` ou de routage `/admin/users/**` n'est cassé par le second contrôleur monté sur le même préfixe. Rapporter le décompte réel.

- [ ] **Step 7: Couverture back**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test jacoco:report
```
Ouvrir `target/site/jacoco/index.html` et vérifier ≥ 90 % global. Si la couverture des nouvelles classes est en dessous, ajouter des tests avant de clore la tâche.

- [ ] **Step 8: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/dto/AdminGdprRequestResponse.java \
        src/main/java/com/yadony/api/admin/dto/GdprExecuteRequest.java \
        src/main/java/com/yadony/api/admin/AdminGdprController.java \
        src/test/java/com/yadony/api/admin/AdminGdprControllerIT.java
git commit -m "feat(admin): file des demandes RGPD et exécution de la suppression (USER_GDPR_DELETE)"
```

---

# FRONT — yadony-admin (worktree `fix+rbac-support-isadmin`)

> Toutes les commandes front s'exécutent depuis
> `/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin`.

### Task 8: `ConfirmActionDialog` — saisie de contrôle (double confirmation par nom)

**Dépôt :** `yadony-admin`

⚠️ **Étendre, ne pas dupliquer.** Aucun composant de saisie-pour-confirmer n'existe ; `ConfirmActionDialog` ne fait qu'un motif libre optionnel, sans comparaison de texte. La spec impose d'ajouter une prop optionnelle plutôt que de créer un composant concurrent. Les deux nouvelles props sont **additives** : les 4 tests existants de `ConfirmActionDialog.spec.ts` et les ~30 de `UserDetailPanel.spec.ts` doivent rester verts sans modification.

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin/app/components/ui/ConfirmActionDialog.vue`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin/tests/components/ConfirmActionDialog.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces (consommé par la Task 11) — props du composant :
  ```ts
  {
    open: boolean; title: string; message: string; confirmLabel: string
    requireReason?: boolean
    confirmationPhrase?: string   // si défini, la saisie doit correspondre exactement (trim)
    confirmationLabel?: string    // libellé au-dessus du champ, défaut « Saisissez … pour confirmer »
  }
  ```
  Emits **inchangés** : `confirm: [reason: string]`, `cancel: []`.
  Sélecteur de test : `[data-test="confirmation-input"]`.

- [ ] **Step 1: Écrire les tests en échec**

Ajouter à la fin du `describe('ConfirmActionDialog', ...)` de `tests/components/ConfirmActionDialog.spec.ts` :

```ts
  it('ne montre pas de saisie de contrôle sans confirmationPhrase', () => {
    const w = mount(ConfirmActionDialog, { props: { open: true, title: 'T', message: 'M', confirmLabel: 'OK' } })
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
  })

  it('désactive la confirmation tant que la saisie ne correspond pas exactement', async () => {
    const w = mount(ConfirmActionDialog, {
      props: { open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer', confirmationPhrase: 'Jean Dupont' },
    })
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirmation-input"]').setValue('Jean Dupon')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
  })

  it('active la confirmation quand la saisie correspond, espaces autour ignorés', async () => {
    const w = mount(ConfirmActionDialog, {
      props: { open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer', confirmationPhrase: 'Jean Dupont' },
    })
    await w.find('[data-test="confirmation-input"]').setValue('  Jean Dupont  ')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('exige motif ET saisie de contrôle quand les deux sont demandés', async () => {
    const w = mount(ConfirmActionDialog, {
      props: {
        open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer',
        requireReason: true, confirmationPhrase: 'Jean Dupont',
      },
    })
    await w.find('[data-test="confirmation-input"]').setValue('Jean Dupont')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="reason"]').setValue('demande RGPD')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['demande RGPD'])
  })

  it('réinitialise motif et saisie de contrôle à chaque réouverture', async () => {
    const w = mount(ConfirmActionDialog, {
      props: {
        open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer',
        requireReason: true, confirmationPhrase: 'Jean Dupont',
      },
    })
    await w.find('[data-test="confirmation-input"]').setValue('Jean Dupont')
    await w.find('[data-test="reason"]').setValue('motif')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="confirmation-input"]').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
  })

  it('affiche le libellé de contrôle personnalisé', () => {
    const w = mount(ConfirmActionDialog, {
      props: {
        open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer',
        confirmationPhrase: 'Jean Dupont', confirmationLabel: 'Saisissez le nom du compte',
      },
    })
    expect(w.text()).toContain('Saisissez le nom du compte')
  })
```

- [ ] **Step 2: Lancer les tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/components/ConfirmActionDialog.spec.ts
```
Attendu : les 6 nouveaux tests échouent — `Cannot call setValue on an empty DOMWrapper` (le champ `[data-test="confirmation-input"]` n'existe pas).

- [ ] **Step 3: Étendre le composant**

Contenu complet de `app/components/ui/ConfirmActionDialog.vue` :

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = defineProps<{
  open: boolean; title: string; message: string; confirmLabel: string
  requireReason?: boolean
  /** Si défini, la confirmation exige la saisie exacte de cette phrase (double confirmation). */
  confirmationPhrase?: string
  confirmationLabel?: string
}>()
const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>()
const reason = ref('')
const confirmation = ref('')
watch(() => props.open, (o) => { if (o) { reason.value = ''; confirmation.value = '' } })

const controlLabel = computed(
  () => props.confirmationLabel ?? `Saisissez « ${props.confirmationPhrase} » pour confirmer`,
)
// Comparaison après trim des deux côtés : un espace collé par le presse-papiers ne doit pas
// bloquer un administrateur qui a bien saisi le bon nom.
const canConfirm = () => {
  if (props.requireReason && reason.value.trim().length === 0) return false
  if (props.confirmationPhrase && confirmation.value.trim() !== props.confirmationPhrase.trim()) return false
  return true
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="overlay">
    <div class="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-xl">
      <h2 class="font-display text-lg font-semibold mb-1">{{ title }}</h2>
      <p class="text-sm text-text-muted mb-4">{{ message }}</p>
      <textarea
        v-if="requireReason" data-test="reason" v-model="reason" rows="3"
        placeholder="Motif (obligatoire)"
        class="w-full rounded-btn border border-border bg-bg p-2 text-sm mb-4"
      />
      <div v-if="confirmationPhrase" class="mb-4">
        <label class="mb-1 block text-xs text-text-muted">{{ controlLabel }}</label>
        <input
          data-test="confirmation-input" v-model="confirmation" type="text" autocomplete="off"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
        >
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="confirm" :disabled="!canConfirm()"
          class="rounded-btn px-4 py-2 text-sm bg-danger text-white disabled:opacity-40 hover:bg-danger/90"
          @click="emit('confirm', reason)"
        >{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Relancer les tests du composant**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/components/ConfirmActionDialog.spec.ts
```
Attendu : `10 passed` (4 existants + 6 nouveaux).

- [ ] **Step 5: Suite complète, lint et typecheck**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm test && pnpm lint && pnpm typecheck
```
Attendu : `453 passed` (447 + 6), 0 erreur ESLint, 0 erreur `vue-tsc`. Vérifier en particulier que `UserDetailPanel.spec.ts` et `moderation`/`incidents` (qui montent tous `ConfirmActionDialog`) restent verts. Rapporter le décompte réel.

- [ ] **Step 6: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
git add app/components/ui/ConfirmActionDialog.vue tests/components/ConfirmActionDialog.spec.ts
git commit -m "feat(ui): double confirmation par saisie de contrôle dans ConfirmActionDialog"
```

---

### Task 9: Types, extraction du message RFC 7807 et appels API KYC/RGPD

**Dépôt :** `yadony-admin`

Cette tâche pose toute la couche données consommée par les Tasks 10 à 12. Elle extrait aussi vers `app/lib/` le helper `extractMessage` aujourd'hui privé dans `useUserDetail.ts`, pour que les deux nouveaux composables le réutilisent sans duplication.

⚠️ `app/lib/**` est **inclus** dans la couverture Vitest (`app/components/ui/**`, `app/plugins/**` et `app/pages/**` en sont exclus) : le nouveau module doit avoir son propre test unitaire.

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin/app/lib/problemDetail.ts`
- Modify: `.../app/features/users/types/index.ts`
- Modify: `.../app/features/users/services/usersService.ts`
- Modify: `.../app/features/users/composables/useUserDetail.ts:12-16`
- Test: `.../tests/unit/lib/problemDetail.spec.ts` (créer)
- Test: `.../tests/unit/features/users/usersService.spec.ts` (compléter)

**Interfaces:**
- Consumes (Tasks 5 et 7) : `GET /admin/users/{id}/kyc`, `POST /admin/users/{id}/kyc/reset`, `GET /admin/users/gdpr-requests`, `POST /admin/users/{id}/gdpr-execute`.
- Produces (consommés par les Tasks 10, 11, 12) :
  ```ts
  // app/lib/problemDetail.ts
  export function extractProblemMessage(e: unknown, fallback: string): string

  // app/features/users/types/index.ts
  export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
  export interface AdminKycDetail {
    userId: string
    kycStatus: KycStatus
    verificationStatus: KycVerificationStatus | 'NOT_STARTED'
    rejectionReason: string | null
    rejectionCode: string | null
    stripeSessionId: string | null
    stripeStatus: string | null
    stripeLastErrorCode: string | null
    stripeLastErrorReason: string | null
    stripeCreatedAt: string | null
    stripeUnavailable: boolean
  }
  export interface AdminGdprRequest {
    id: string; firstName: string | null; lastName: string | null; email: string | null
    status: UserStatus; deletionRequestedAt: string; ageDays: number
  }
  export interface AdminGdprRequestPage {
    content: AdminGdprRequest[]; totalElements: number; totalPages: number; number: number; size: number
  }

  // app/features/users/services/usersService.ts
  usersService.getKyc(id: string): Promise<AdminKycDetail>
  usersService.resetKyc(id: string, reason: string): Promise<AdminKycDetail>
  usersService.listGdprRequests(page: number, size: number): Promise<AdminGdprRequestPage>
  usersService.executeGdprDeletion(id: string, reason: string): Promise<void>
  ```

- [ ] **Step 1: Écrire les tests en échec**

Créer `tests/unit/lib/problemDetail.spec.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { extractProblemMessage } from '@/lib/problemDetail'

describe('extractProblemMessage', () => {
  it('préfère le champ detail du ProblemDetail RFC 7807', () => {
    const err = { data: { detail: 'Impossible — cet utilisateur a des transactions en cours' } }
    expect(extractProblemMessage(err, 'secours')).toBe('Impossible — cet utilisateur a des transactions en cours')
  })

  it('ignore un detail vide ou blanc et retombe sur error.message', () => {
    const err = Object.assign(new Error('Network error'), { data: { detail: '   ' } })
    expect(extractProblemMessage(err, 'secours')).toBe('Network error')
  })

  it('retombe sur le message de secours quand ni detail ni message ne sont exploitables', () => {
    expect(extractProblemMessage({}, 'secours')).toBe('secours')
    expect(extractProblemMessage(undefined, 'secours')).toBe('secours')
  })
})
```

Compléter `tests/unit/features/users/usersService.spec.ts` — ajouter dans le `describe('usersService', ...)` :

```ts
  it('getKyc() interroge /admin/users/{id}/kyc', async () => {
    apiMock.mockResolvedValue({ userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED' })
    const r = await usersService.getKyc('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/kyc')
    expect(r.kycStatus).toBe('REJECTED')
  })

  it('resetKyc() POSTe le motif sur /kyc/reset', async () => {
    apiMock.mockResolvedValue({ userId: 'u1', kycStatus: 'NOT_STARTED', verificationStatus: 'PENDING' })
    const r = await usersService.resetKyc('u1', 'document illisible')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/kyc/reset', {
      method: 'POST',
      body: { reason: 'document illisible' },
    })
    expect(r.kycStatus).toBe('NOT_STARTED')
  })

  it('listGdprRequests() interroge la file paginée', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.listGdprRequests(1, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/users/gdpr-requests', { query: { page: 1, size: 20 } })
  })

  it('executeGdprDeletion() POSTe le motif sur /gdpr-execute', async () => {
    apiMock.mockResolvedValue(undefined)
    await usersService.executeGdprDeletion('u1', 'demande confirmée')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/gdpr-execute', {
      method: 'POST',
      body: { reason: 'demande confirmée' },
    })
  })
```

- [ ] **Step 2: Lancer les tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/unit/lib/problemDetail.spec.ts tests/unit/features/users/usersService.spec.ts
```
Attendu : `Failed to resolve import "@/lib/problemDetail"` et `usersService.getKyc is not a function`.

- [ ] **Step 3: Créer `app/lib/problemDetail.ts`**

```ts
/**
 * Le backend renvoie du RFC 7807 (`ProblemDetail`) : `detail` porte le message écrit pour
 * un humain, `code` le slug technique. `useApi()` (ofetch) expose le corps parsé via
 * `error.data`. On ne retombe sur `error.message` (générique, type « 422 Unprocessable
 * Entity ») que si `data.detail` est absent ou vide.
 */
export function extractProblemMessage(e: unknown, fallback: string): string {
  const data = (e as { data?: { detail?: string } } | undefined)?.data
  if (typeof data?.detail === 'string' && data.detail.trim().length > 0) return data.detail
  return (e as Error | undefined)?.message || fallback
}
```

- [ ] **Step 4: Faire consommer le helper par `useUserDetail`**

Dans `app/features/users/composables/useUserDetail.ts`, supprimer la fonction locale `extractMessage` (lignes 5-16) et remplacer l'entête du fichier par :

```ts
import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminUserDetail } from '@/features/users/types/index'
```

puis remplacer les deux appels `extractMessage(...)` par `extractProblemMessage(...)` (lignes 28 et 37) :

```ts
    catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger l\'utilisateur') }
```
```ts
    catch (e) { error.value = extractProblemMessage(e, 'Action échouée') }
```

- [ ] **Step 5: Ajouter les types**

À la fin de `app/features/users/types/index.ts` :

```ts
/** Miroir de com.yadony.api.kyc.KycVerificationStatus (table kyc_schema.kyc_verifications). */
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

/**
 * Vue KYC admin. Les deux statuts sont maintenus en parallèle côté back :
 * `kycStatus` sur public.users, `verificationStatus` sur kyc_schema.
 * `'NOT_STARTED'` en `verificationStatus` signifie « aucune ligne KYC ».
 *
 * Il n'existe ni document ni historique de session : Stripe détient les pièces, et une
 * seule ligne par utilisateur est conservée (contrainte uq_kyc_user_id).
 */
export interface AdminKycDetail {
  userId: string
  kycStatus: KycStatus
  verificationStatus: KycVerificationStatus | 'NOT_STARTED'
  rejectionReason: string | null
  rejectionCode: string | null
  stripeSessionId: string | null
  stripeStatus: string | null
  stripeLastErrorCode: string | null
  stripeLastErrorReason: string | null
  stripeCreatedAt: string | null
  /** true uniquement si l'appel Stripe a échoué — pas quand il n'y a aucune session. */
  stripeUnavailable: boolean
}

/** Une ligne de la file des demandes de suppression RGPD. */
export interface AdminGdprRequest {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  status: UserStatus
  deletionRequestedAt: string
  ageDays: number
}

export interface AdminGdprRequestPage {
  content: AdminGdprRequest[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
```

- [ ] **Step 6: Ajouter les quatre appels au service**

Dans `app/features/users/services/usersService.ts`, compléter l'import de types :

```ts
import type {
  AdminGdprRequestPage, AdminKycDetail, AdminUserDetail, AdminUserPage, UsersFilterState,
} from '@/features/users/types/index'
```

puis ajouter, à la fin de l'objet `usersService` (après `unmuteMessaging`) :

```ts
  getKyc(id: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${id}/kyc`)
  },
  resetKyc(id: string, reason: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${id}/kyc/reset`, { method: 'POST', body: { reason } })
  },
  listGdprRequests(page: number, size: number): Promise<AdminGdprRequestPage> {
    return useApi()<AdminGdprRequestPage>('/admin/users/gdpr-requests', { query: { page, size } })
  },
  /** Irréversible : le back répond 204 sans corps. */
  executeGdprDeletion(id: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${id}/gdpr-execute`, { method: 'POST', body: { reason } })
  },
```

- [ ] **Step 7: Relancer les tests ciblés**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/unit/lib/problemDetail.spec.ts tests/unit/features/users
```
Attendu : tous verts, dont les tests existants de `useUserDetail.spec.ts` (le refactor du helper ne change aucun comportement observable).

- [ ] **Step 8: Suite complète, lint, typecheck, couverture**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm test && pnpm lint && pnpm typecheck && pnpm test:coverage
```
Attendu : `460 passed` (453 + 7), seuils 90/85/90/90 tenus. Rapporter le décompte réel.

- [ ] **Step 9: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
git add app/lib/problemDetail.ts app/features/users/types/index.ts \
        app/features/users/services/usersService.ts \
        app/features/users/composables/useUserDetail.ts \
        tests/unit/lib/problemDetail.spec.ts tests/unit/features/users/usersService.spec.ts
git commit -m "feat(users): types et appels API pour le KYC admin et la file RGPD"
```

---

### Task 10: Onglet KYC dans la fiche utilisateur

**Dépôt :** `yadony-admin`

⚠️ **Non-régression du panneau existant.** `UserDetailPanel.spec.ts` contient une trentaine de tests qui montent le panneau et cherchent directement `[data-test="action-suspend"]`, `[data-test="commission-input"]`, etc. L'onglet **« Profil » doit donc être actif par défaut** : tous ces sélecteurs restent immédiatement présents au montage.

⚠️ **Aucun document à afficher.** `kyc_schema` ne porte plus ni pièce d'identité ni selfie (`V46__kyc_cleanup.sql`) : l'onglet montre les statuts, le motif de rejet et la **session Stripe courante** — pas d'aperçu de document, pas d'URL présignée, pas d'historique.

**Files:**
- Create: `.../app/features/users/composables/useUserKyc.ts`
- Create: `.../app/features/users/components/UserKycTab.vue`
- Modify: `.../app/features/users/components/UserDetailPanel.vue`
- Test: `.../tests/unit/features/users/useUserKyc.spec.ts` (créer)
- Test: `.../tests/unit/features/users/UserKycTab.spec.ts` (créer)
- Test: `.../tests/unit/features/users/UserDetailPanel.spec.ts` (compléter)

**Interfaces:**
- Consumes (Task 9) : `usersService.getKyc(id)`, `usersService.resetKyc(id, reason)`, `AdminKycDetail`, `extractProblemMessage`. Et (Task 8) la prop `confirmationPhrase` de `ConfirmActionDialog` — **non utilisée ici** : le reset KYC n'est pas irréversible, une confirmation simple avec motif suffit.
- Produces :
  ```ts
  // useUserKyc.ts
  export function useUserKyc(): {
    kyc: Ref<AdminKycDetail | null>
    isLoading: Ref<boolean>
    error: Ref<string | null>
    busy: Ref<boolean>
    load: (userId: string) => Promise<void>
    reset: (userId: string, reason: string) => Promise<void>
  }
  ```
  `UserKycTab.vue` — props `{ kyc: AdminKycDetail | null; loading?: boolean; error?: string | null; busy?: boolean }`, emit `{ reset: [reason: string] }`.
  Sélecteurs de test : `[data-test="tab-profil"]`, `[data-test="tab-kyc"]`, `[data-test="kyc-status"]`, `[data-test="kyc-verification-status"]`, `[data-test="kyc-stripe-session"]`, `[data-test="kyc-stripe-unavailable"]`, `[data-test="action-reset-kyc"]`.

- [ ] **Step 1: Écrire le test du composable en échec**

Créer `tests/unit/features/users/useUserKyc.spec.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getKyc = vi.fn()
const resetKyc = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: { getKyc: (...a: unknown[]) => getKyc(...a), resetKyc: (...a: unknown[]) => resetKyc(...a) },
}))

import { useUserKyc } from '@/features/users/composables/useUserKyc'

const KYC = {
  userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
  rejectionReason: 'document_expired', rejectionCode: 'document_expired',
  stripeSessionId: 'vs_001', stripeStatus: 'requires_input',
  stripeLastErrorCode: 'document_expired', stripeLastErrorReason: 'The document has expired.',
  stripeCreatedAt: '2026-08-01T10:00:00', stripeUnavailable: false,
}

describe('useUserKyc', () => {
  beforeEach(() => { getKyc.mockReset(); resetKyc.mockReset() })

  it('load() remplit kyc et retombe isLoading à false', async () => {
    getKyc.mockResolvedValue(KYC)
    const c = useUserKyc()
    await c.load('u1')
    expect(getKyc).toHaveBeenCalledWith('u1')
    expect(c.kyc.value?.stripeSessionId).toBe('vs_001')
    expect(c.isLoading.value).toBe(false)
    expect(c.error.value).toBeNull()
  })

  it('load() expose le detail RFC 7807 en cas d\'erreur', async () => {
    getKyc.mockRejectedValue({ data: { detail: 'Utilisateur introuvable' } })
    const c = useUserKyc()
    await c.load('u1')
    expect(c.error.value).toBe('Utilisateur introuvable')
    expect(c.kyc.value).toBeNull()
  })

  it('reset() remplace kyc par la réponse du back', async () => {
    getKyc.mockResolvedValue(KYC)
    resetKyc.mockResolvedValue({ ...KYC, kycStatus: 'NOT_STARTED', verificationStatus: 'PENDING', stripeSessionId: null })
    const c = useUserKyc()
    await c.load('u1')
    await c.reset('u1', 'document illisible')
    expect(resetKyc).toHaveBeenCalledWith('u1', 'document illisible')
    expect(c.kyc.value?.kycStatus).toBe('NOT_STARTED')
    expect(c.kyc.value?.stripeSessionId).toBeNull()
    expect(c.busy.value).toBe(false)
  })

  it('reset() en échec expose le message et laisse kyc inchangé', async () => {
    getKyc.mockResolvedValue(KYC)
    resetKyc.mockRejectedValue({ data: { detail: "Cet utilisateur n'a jamais démarré de vérification d'identité" } })
    const c = useUserKyc()
    await c.load('u1')
    await c.reset('u1', 'motif')
    expect(c.error.value).toBe("Cet utilisateur n'a jamais démarré de vérification d'identité")
    expect(c.kyc.value?.kycStatus).toBe('REJECTED')
  })
})
```

- [ ] **Step 2: Écrire le test du composant en échec**

Créer `tests/unit/features/users/UserKycTab.spec.ts` :

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UserKycTab from '@/features/users/components/UserKycTab.vue'
import { seedAuth } from '~/tests/helpers/auth'

const KYC = {
  userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
  rejectionReason: 'document_expired', rejectionCode: 'document_expired',
  stripeSessionId: 'vs_001', stripeStatus: 'requires_input',
  stripeLastErrorCode: 'document_expired', stripeLastErrorReason: 'The document has expired.',
  stripeCreatedAt: '2026-08-01T10:00:00', stripeUnavailable: false,
}

describe('UserKycTab', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche les deux statuts et la session Stripe courante', () => {
    const w = mount(UserKycTab, { props: { kyc: KYC } })
    expect(w.find('[data-test="kyc-status"]').text()).toContain('REJECTED')
    expect(w.find('[data-test="kyc-verification-status"]').text()).toContain('REJECTED')
    expect(w.find('[data-test="kyc-stripe-session"]').text()).toContain('vs_001')
    expect(w.text()).toContain('The document has expired.')
  })

  it('signale une indisponibilité Stripe sans masquer les données locales', () => {
    const w = mount(UserKycTab, {
      props: { kyc: { ...KYC, stripeStatus: null, stripeLastErrorCode: null, stripeLastErrorReason: null, stripeUnavailable: true } },
    })
    expect(w.find('[data-test="kyc-stripe-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-status"]').text()).toContain('REJECTED')
  })

  it('indique clairement l\'absence de vérification démarrée', () => {
    const w = mount(UserKycTab, {
      props: {
        kyc: {
          ...KYC, kycStatus: 'NOT_STARTED', verificationStatus: 'NOT_STARTED',
          rejectionReason: null, rejectionCode: null, stripeSessionId: null,
          stripeStatus: null, stripeLastErrorCode: null, stripeLastErrorReason: null,
          stripeCreatedAt: null, stripeUnavailable: false,
        },
      },
    })
    expect(w.find('[data-test="kyc-stripe-session"]').text()).toContain('Aucune session')
  })

  it('émet reset avec le motif après confirmation', async () => {
    const w = mount(UserKycTab, { props: { kyc: KYC } })
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('reset')![0]).toEqual(['document illisible'])
  })

  it('cache le bouton de réinitialisation sans la permission USER_KYC', () => {
    seedAuth('ADMIN', { USER_KYC: false })
    const w = mount(UserKycTab, { props: { kyc: KYC } })
    expect(w.find('[data-test="action-reset-kyc"]').exists()).toBe(false)
  })

  it('affiche l\'erreur remontée par le back', () => {
    const w = mount(UserKycTab, { props: { kyc: KYC, error: 'Action échouée' } })
    expect(w.find('[data-test="kyc-error"]').text()).toContain('Action échouée')
  })
})
```

- [ ] **Step 3: Écrire les tests d'onglets en échec**

Ajouter à `tests/unit/features/users/UserDetailPanel.spec.ts`, dans le `describe('UserDetailPanel', ...)` :

```ts
  it('affiche l\'onglet Profil par défaut, avec toutes les actions de compte', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="tab-profil"]').exists()).toBe(true)
    expect(w.find('[data-test="action-suspend"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-status"]').exists()).toBe(false)
  })

  it('bascule sur l\'onglet KYC et émet openKyc une seule fois', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="tab-kyc"]').trigger('click')
    expect(w.emitted('openKyc')).toHaveLength(1)
    expect(w.find('[data-test="action-suspend"]').exists()).toBe(false)
  })

  it('cache l\'onglet KYC sans la permission USER_KYC', () => {
    seedAuth('ADMIN', { USER_KYC: false })
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="tab-kyc"]').exists()).toBe(false)
  })

  it('relaie l\'événement reset de l\'onglet KYC en resetKyc', async () => {
    const w = mount(UserDetailPanel, {
      props: { user: baseUser, open: true, kyc: {
        userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
        rejectionReason: null, rejectionCode: null, stripeSessionId: 'vs_001',
        stripeStatus: 'requires_input', stripeLastErrorCode: null, stripeLastErrorReason: null,
        stripeCreatedAt: null, stripeUnavailable: false,
      } },
    })
    await w.find('[data-test="tab-kyc"]').trigger('click')
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('resetKyc')![0]).toEqual(['document illisible'])
  })
```

- [ ] **Step 4: Lancer les tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/unit/features/users
```
Attendu : `Failed to resolve import "@/features/users/composables/useUserKyc"` et `"@/features/users/components/UserKycTab.vue"`.

- [ ] **Step 5: Créer le composable**

`app/features/users/composables/useUserKyc.ts` :

```ts
import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminKycDetail } from '@/features/users/types/index'

/**
 * État de l'onglet KYC d'une fiche utilisateur.
 *
 * Chargement paresseux : `load()` n'est appelé qu'à l'ouverture de l'onglet, parce que la
 * lecture back déclenche un appel live à Stripe Identity — inutile de le payer pour tous
 * les administrateurs qui ouvrent une fiche sans regarder le KYC.
 */
export function useUserKyc() {
  const kyc = ref<AdminKycDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)

  async function load(userId: string) {
    isLoading.value = true
    error.value = null
    try { kyc.value = await usersService.getKyc(userId) }
    catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger le KYC') }
    finally { isLoading.value = false }
  }

  async function reset(userId: string, reason: string) {
    error.value = null
    busy.value = true
    try { kyc.value = await usersService.resetKyc(userId, reason) }
    catch (e) { error.value = extractProblemMessage(e, 'Réinitialisation impossible') }
    finally { busy.value = false }
  }

  return { kyc, isLoading, error, busy, load, reset }
}
```

- [ ] **Step 6: Créer le composant d'onglet**

`app/features/users/components/UserKycTab.vue` :

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { AdminKycDetail } from '@/features/users/types/index'

const props = defineProps<{
  kyc: AdminKycDetail | null; loading?: boolean; error?: string | null; busy?: boolean
}>()
const emit = defineEmits<{ reset: [reason: string] }>()
const auth = useAuthStore()

// Réinitialiser un KYC ne détruit aucune donnée (l'utilisateur refait sa vérification) :
// confirmation simple avec motif, pas de double confirmation par saisie de nom — celle-ci
// est réservée à l'exécution RGPD, irréversible.
const confirming = ref(false)
function confirmReset(reason: string) {
  confirming.value = false
  emit('reset', reason)
}
function fmt(d: string | null) { return d ? new Date(d).toLocaleString('fr-FR') : '—' }
</script>

<template>
  <div>
    <p v-if="loading" data-test="kyc-loading" class="text-sm text-text-muted">Chargement du KYC…</p>

    <template v-else-if="props.kyc">
      <p
        v-if="props.kyc.stripeUnavailable" data-test="kyc-stripe-unavailable"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      >Statut Stripe indisponible — seules les données locales sont affichées.</p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div>
          <dt class="text-text-muted">Statut du compte</dt>
          <dd data-test="kyc-status">{{ props.kyc.kycStatus }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Statut de vérification</dt>
          <dd data-test="kyc-verification-status">{{ props.kyc.verificationStatus }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Motif de rejet</dt>
          <dd>{{ props.kyc.rejectionReason ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Code de rejet</dt>
          <dd>{{ props.kyc.rejectionCode ?? '—' }}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-text-muted">Session Stripe courante</dt>
          <dd data-test="kyc-stripe-session" class="break-all">
            {{ props.kyc.stripeSessionId ?? 'Aucune session — vérification jamais démarrée' }}
          </dd>
        </div>
        <div>
          <dt class="text-text-muted">Statut Stripe</dt>
          <dd>{{ props.kyc.stripeStatus ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Créée le</dt>
          <dd>{{ fmt(props.kyc.stripeCreatedAt) }}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-text-muted">Dernière erreur Stripe</dt>
          <dd>
            {{ props.kyc.stripeLastErrorReason ?? '—' }}
            <span v-if="props.kyc.stripeLastErrorCode" class="text-text-muted">
              ({{ props.kyc.stripeLastErrorCode }})</span>
          </dd>
        </div>
      </dl>

      <p class="mb-4 text-xs text-text-muted">
        Les pièces d'identité sont détenues par Stripe et ne sont pas stockées par Yadony :
        seule la session courante est consultable, sans historique.
      </p>

      <p
        v-if="props.error" data-test="kyc-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ props.error }}</p>

      <button
        v-if="auth.can('USER_KYC')" type="button" data-test="action-reset-kyc" :disabled="props.busy"
        class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30 disabled:opacity-40"
        @click="confirming = true"
      >Réinitialiser le KYC</button>
    </template>

    <p v-else data-test="kyc-empty" class="text-sm text-text-muted">Aucune donnée KYC.</p>

    <ConfirmActionDialog
      :open="confirming"
      title="Réinitialiser le KYC"
      message="La session de vérification en cours sera annulée côté Stripe et l'utilisateur devra refaire sa vérification d'identité."
      confirm-label="Réinitialiser"
      :require-reason="true"
      @confirm="confirmReset"
      @cancel="confirming = false"
    />
  </div>
</template>
```

- [ ] **Step 7: Ajouter la barre d'onglets au panneau**

Dans `app/features/users/components/UserDetailPanel.vue` :

1. Compléter le `<script setup>` — ajouter les imports et l'état d'onglet après la ligne `import { useAuthStore } from '@/stores/auth'` :

```ts
import UserKycTab from './UserKycTab.vue'
import type { AdminKycDetail } from '@/features/users/types/index'
```

2. Étendre `defineProps` :

```ts
const props = defineProps<{
  user: AdminUserDetail; open: boolean; error?: string | null; busy?: boolean
  kyc?: AdminKycDetail | null; kycLoading?: boolean; kycError?: string | null
}>()
```

3. Étendre `defineEmits` (ajouter les deux dernières lignes) :

```ts
const emit = defineEmits<{
  close: []; suspend: [reason: string]; ban: [reason: string]; unsuspend: [];
  suspendPublishing: [reason: string]; liftPublishing: []; setCommission: [rate: number | null];
  muteMessaging: [durationHours: number | null, reason: string]; unmuteMessaging: [];
  openKyc: []; resetKyc: [reason: string];
}>()
```

4. Ajouter l'état d'onglet, juste après `const pending = ref<Pending>(null)` :

```ts
// « profil » par défaut : les gestes de compte restent immédiatement accessibles à
// l'ouverture de la fiche. L'onglet KYC déclenche un chargement paresseux (openKyc), car
// la lecture back interroge Stripe Identity en direct — inutile de la payer sans besoin.
type Tab = 'profil' | 'kyc'
const tab = ref<Tab>('profil')
const kycLoaded = ref(false)
function openTab(next: Tab) {
  tab.value = next
  if (next === 'kyc' && !kycLoaded.value) {
    kycLoaded.value = true
    emit('openKyc')
  }
}
```

5. Dans le `<template>`, insérer la barre d'onglets juste après le bloc d'en-tête (après `</div>` fermant le `flex items-start justify-between mb-4`) :

```vue
      <div class="mb-4 flex gap-1 border-b border-border" role="tablist">
        <button
          type="button" data-test="tab-profil" role="tab" :aria-selected="tab === 'profil'"
          class="rounded-t-btn px-4 py-2 text-sm"
          :class="tab === 'profil' ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'"
          @click="openTab('profil')"
        >Profil</button>
        <button
          v-if="auth.can('USER_KYC')" type="button" data-test="tab-kyc" role="tab" :aria-selected="tab === 'kyc'"
          class="rounded-t-btn px-4 py-2 text-sm"
          :class="tab === 'kyc' ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'"
          @click="openTab('kyc')"
        >KYC</button>
      </div>
```

6. Envelopper le contenu du profil dans `<template v-if="tab === 'profil'">` : la balise ouvrante se place **juste avant** `<dl class="grid grid-cols-2 gap-3 text-sm mb-6">` (ligne 114 actuelle) et la balise fermante `</template>` **juste après** le `</div>` qui clôt le bloc commission (`<div v-if="auth.can('USER_COMMISSION')" class="mt-4 space-y-2">`, ligne 210 actuelle). Sont donc englobés, dans l'ordre : la `<dl>` de 10 paires, le paragraphe `[data-test="user-error"]`, la rangée de boutons d'action, le bloc `mute-duration`, et le bloc commission. Restent **hors** du `v-if` : l'en-tête, la barre d'onglets, et le `<ConfirmActionDialog>` final.

⚠️ Le bouton « Fermer » (`[data-test="action-close"]`) est aujourd'hui **dans** la rangée d'actions, donc englobé par le `v-if`. Le sortir : le déplacer dans le bloc d'en-tête, à droite du `StatusBadge`, pour rester accessible depuis les deux onglets :

```vue
        <div class="flex items-center gap-2">
          <StatusBadge v-bind="userStatusMeta(user.status)" />
          <button
            type="button" data-test="action-close"
            class="rounded-btn px-3 py-1.5 text-sm border border-border"
            @click="emit('close')"
          >Fermer</button>
        </div>
```
(et supprimer le bouton `action-close` de la rangée d'actions, ainsi que sa classe `ml-auto`).

Puis ajouter juste après le `</template>` de fermeture :

```vue
      <UserKycTab
        v-if="tab === 'kyc'"
        :kyc="props.kyc ?? null" :loading="props.kycLoading" :error="props.kycError" :busy="props.busy"
        @reset="(reason) => emit('resetKyc', reason)"
      />
```

⚠️ Le `<ConfirmActionDialog>` du panneau reste **hors** du `v-if` : il sert aux gestes de compte de l'onglet Profil, et son `:open="pending !== null"` ne peut être vrai que depuis cet onglet. Le bouton « Fermer », lui, a été déplacé dans l'en-tête (item 6) pour rester accessible depuis les deux onglets. Aucun test existant ne cible `[data-test="action-close"]` (vérifié par grep sur `UserDetailPanel.spec.ts` et `tests/e2e/users.spec.ts`), ce déplacement ne casse donc rien.

- [ ] **Step 8: Brancher le composable dans la page**

Dans `app/pages/users/index.vue`, ajouter après `const detail = useUserDetail()` :

```ts
const kyc = useUserKyc()
```
et l'import correspondant :
```ts
import { useUserKyc } from '@/features/users/composables/useUserKyc'
```

Puis compléter le `<UserDetailPanel>` avec les props et handlers KYC :

```vue
      :kyc="kyc.kyc.value" :kyc-loading="kyc.isLoading.value" :kyc-error="kyc.error.value"
      @open-kyc="() => kyc.load(detail.user.value!.id)"
      @reset-kyc="async (reason) => { await kyc.reset(detail.user.value!.id, reason); await afterAction() }"
```

- [ ] **Step 9: Relancer les tests ciblés**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/unit/features/users tests/components/pages.spec.ts
```
Attendu : tous verts, y compris les ~30 tests préexistants de `UserDetailPanel.spec.ts` (onglet « Profil » actif par défaut).

- [ ] **Step 10: Suite complète, lint, typecheck, couverture**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm test && pnpm lint && pnpm typecheck && pnpm test:coverage
```
Attendu : `474 passed` (460 + 14), seuils 90/85/90/90 tenus. Rapporter le décompte réel.

- [ ] **Step 11: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
git add app/features/users/composables/useUserKyc.ts \
        app/features/users/components/UserKycTab.vue \
        app/features/users/components/UserDetailPanel.vue \
        app/pages/users/index.vue \
        tests/unit/features/users/useUserKyc.spec.ts \
        tests/unit/features/users/UserKycTab.spec.ts \
        tests/unit/features/users/UserDetailPanel.spec.ts
git commit -m "feat(users): onglet KYC dans la fiche utilisateur avec réinitialisation"
```

---

### Task 11: Page `users/rgpd` — file des demandes et exécution avec double confirmation

**Dépôt :** `yadony-admin`

**Files:**
- Create: `.../app/features/users/composables/useGdprRequests.ts`
- Create: `.../app/features/users/components/GdprRequestsTable.vue`
- Create: `.../app/pages/users/rgpd.vue`
- Modify: `.../app/components/layout/AppSidebar.vue`
- Test: `.../tests/unit/features/users/useGdprRequests.spec.ts` (créer)
- Test: `.../tests/unit/features/users/GdprRequestsTable.spec.ts` (créer)
- Test: `.../tests/components/AppSidebar.spec.ts` (compléter)
- Test: `.../tests/components/pages.spec.ts` (compléter)

**Interfaces:**
- Consumes (Tasks 8 et 9) : `usersService.listGdprRequests(page, size)`, `usersService.executeGdprDeletion(id, reason)`, `AdminGdprRequest`, `AdminGdprRequestPage`, `extractProblemMessage`, et la prop `confirmationPhrase` de `ConfirmActionDialog`.
- Produces :
  ```ts
  export function useGdprRequests(): {
    requests: Ref<AdminGdprRequest[]>
    isLoading: Ref<boolean>
    error: Ref<string | null>
    busy: Ref<boolean>
    currentPage: Ref<number>
    totalPages: Ref<number>
    fetchRequests: () => Promise<void>
    goToPage: (p: number) => Promise<void>
    execute: (id: string, reason: string) => Promise<void>
  }
  ```
  `GdprRequestsTable.vue` — props `{ requests: AdminGdprRequest[]; loading?: boolean }`, emit `{ execute: [request: AdminGdprRequest] }`.
  Sélecteurs de test : `[data-test="row-<id>"]`, `[data-test="action-gdpr-execute-<id>"]`, `[data-test="gdpr-empty"]`, `[data-test="gdpr-error"]`.

- [ ] **Step 1: Écrire le test du composable en échec**

Créer `tests/unit/features/users/useGdprRequests.spec.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listGdprRequests = vi.fn()
const executeGdprDeletion = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    listGdprRequests: (...a: unknown[]) => listGdprRequests(...a),
    executeGdprDeletion: (...a: unknown[]) => executeGdprDeletion(...a),
  },
}))

import { useGdprRequests } from '@/features/users/composables/useGdprRequests'

const PAGE = {
  content: [
    { id: 'u1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr', status: 'PENDING_DELETION', deletionRequestedAt: '2026-07-01T00:00:00', ageDays: 48 },
    { id: 'u2', firstName: 'Awa', lastName: 'Diallo', email: 'awa@x.fr', status: 'PENDING_DELETION', deletionRequestedAt: '2026-08-10T00:00:00', ageDays: 8 },
  ],
  totalElements: 2, totalPages: 1, number: 0, size: 20,
}

describe('useGdprRequests', () => {
  beforeEach(() => { listGdprRequests.mockReset(); executeGdprDeletion.mockReset() })

  it('fetchRequests() charge la première page', async () => {
    listGdprRequests.mockResolvedValue(PAGE)
    const c = useGdprRequests()
    await c.fetchRequests()
    expect(listGdprRequests).toHaveBeenCalledWith(0, 20)
    expect(c.requests.value).toHaveLength(2)
    expect(c.totalPages.value).toBe(1)
    expect(c.isLoading.value).toBe(false)
  })

  it('goToPage() recharge sur la page demandée', async () => {
    listGdprRequests.mockResolvedValue({ ...PAGE, number: 1 })
    const c = useGdprRequests()
    await c.goToPage(1)
    expect(listGdprRequests).toHaveBeenCalledWith(1, 20)
    expect(c.currentPage.value).toBe(1)
  })

  it('fetchRequests() expose le detail RFC 7807 en cas d\'erreur', async () => {
    listGdprRequests.mockRejectedValue({ data: { detail: 'Accès refusé' } })
    const c = useGdprRequests()
    await c.fetchRequests()
    expect(c.error.value).toBe('Accès refusé')
    expect(c.requests.value).toHaveLength(0)
  })

  it('execute() recharge la file après une suppression réussie', async () => {
    listGdprRequests.mockResolvedValue(PAGE)
    executeGdprDeletion.mockResolvedValue(undefined)
    const c = useGdprRequests()
    await c.fetchRequests()
    listGdprRequests.mockClear()
    await c.execute('u1', 'demande confirmée')
    expect(executeGdprDeletion).toHaveBeenCalledWith('u1', 'demande confirmée')
    expect(listGdprRequests).toHaveBeenCalledTimes(1)
    expect(c.busy.value).toBe(false)
  })

  it('execute() en refus 422 expose le message et ne recharge pas', async () => {
    listGdprRequests.mockResolvedValue(PAGE)
    executeGdprDeletion.mockRejectedValue({
      data: { code: 'active-transactions', detail: 'Impossible — cet utilisateur a des transactions en cours' },
    })
    const c = useGdprRequests()
    await c.fetchRequests()
    listGdprRequests.mockClear()
    await c.execute('u1', 'motif')
    expect(c.error.value).toBe('Impossible — cet utilisateur a des transactions en cours')
    expect(listGdprRequests).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Écrire le test du tableau en échec**

Créer `tests/unit/features/users/GdprRequestsTable.spec.ts` :

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GdprRequestsTable from '@/features/users/components/GdprRequestsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const REQUESTS = [
  { id: 'u1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr', status: 'PENDING_DELETION' as const, deletionRequestedAt: '2026-07-01T00:00:00', ageDays: 48 },
  { id: 'u2', firstName: 'Awa', lastName: 'Diallo', email: 'awa@x.fr', status: 'PENDING_DELETION' as const, deletionRequestedAt: '2026-08-10T00:00:00', ageDays: 8 },
]

describe('GdprRequestsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche une ligne par demande, avec nom, email et âge', () => {
    const w = mount(GdprRequestsTable, { props: { requests: REQUESTS } })
    expect(w.find('[data-test="row-u1"]').exists()).toBe(true)
    expect(w.text()).toContain('Jean Dupont')
    expect(w.text()).toContain('jean@x.fr')
    expect(w.text()).toContain('48')
  })

  it('affiche un état vide explicite', () => {
    const w = mount(GdprRequestsTable, { props: { requests: [] } })
    expect(w.find('[data-test="gdpr-empty"]').exists()).toBe(true)
  })

  it('émet execute avec la demande visée', async () => {
    const w = mount(GdprRequestsTable, { props: { requests: REQUESTS } })
    await w.find('[data-test="action-gdpr-execute-u1"]').trigger('click')
    expect(w.emitted('execute')![0]).toEqual([REQUESTS[0]])
  })

  it('cache le geste sans la permission USER_GDPR_DELETE', () => {
    seedAuth('SUPPORT')
    const w = mount(GdprRequestsTable, { props: { requests: REQUESTS } })
    expect(w.find('[data-test="action-gdpr-execute-u1"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 3: Compléter les tests de sidebar et de pages**

Dans `tests/components/AppSidebar.spec.ts`, ajouter au `describe('AppSidebar', ...)` :

```ts
  it('montre « Demandes RGPD » à un ADMIN (USER_GDPR_DELETE)', () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    expect(mountSidebar().text()).toContain('Demandes RGPD')
  })

  it('cache « Demandes RGPD » à SUPPORT (pas de USER_GDPR_DELETE)', () => {
    useAuthStore().setSession('token', makeAdmin('SUPPORT'))
    expect(mountSidebar().text()).not.toContain('Demandes RGPD')
  })
```

Dans `tests/components/pages.spec.ts`, ajouter la page à la liste `stubPages` (après `@/pages/users/index.vue`) :

```ts
    () => import('@/pages/users/rgpd.vue'),
```
et ajouter `GdprRequestsTable: true,` à l'objet `stubs`.

- [ ] **Step 4: Lancer les tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/unit/features/users tests/components/AppSidebar.spec.ts tests/components/pages.spec.ts
```
Attendu : `Failed to resolve import "@/features/users/composables/useGdprRequests"`, `"@/features/users/components/GdprRequestsTable.vue"`, `"@/pages/users/rgpd.vue"`, et les deux tests de sidebar en échec.

- [ ] **Step 5: Créer le composable**

`app/features/users/composables/useGdprRequests.ts` :

```ts
import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminGdprRequest } from '@/features/users/types/index'

const PAGE_SIZE = 20

/**
 * File des demandes de suppression RGPD, les plus anciennes d'abord (tri porté par le back).
 *
 * Un refus du back (escrow actif, solde wallet non vide) arrive en 422 avec un `detail`
 * lisible : on l'affiche tel quel et on NE recharge PAS la file — la demande est toujours
 * là, et un rechargement masquerait le message sans rien changer.
 */
export function useGdprRequests() {
  const requests = ref<AdminGdprRequest[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)
  const currentPage = ref(0)
  const totalPages = ref(0)

  async function fetchRequests() {
    isLoading.value = true
    error.value = null
    try {
      const page = await usersService.listGdprRequests(currentPage.value, PAGE_SIZE)
      requests.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les demandes RGPD')
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) {
    currentPage.value = p
    await fetchRequests()
  }

  async function execute(id: string, reason: string) {
    error.value = null
    busy.value = true
    try {
      await usersService.executeGdprDeletion(id, reason)
      await fetchRequests()
    } catch (e) {
      error.value = extractProblemMessage(e, 'Suppression impossible')
    } finally {
      busy.value = false
    }
  }

  return { requests, isLoading, error, busy, currentPage, totalPages, fetchRequests, goToPage, execute }
}
```

- [ ] **Step 6: Créer le tableau**

`app/features/users/components/GdprRequestsTable.vue` :

```vue
<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import type { AdminGdprRequest } from '@/features/users/types/index'

defineProps<{ requests: AdminGdprRequest[]; loading?: boolean }>()
const emit = defineEmits<{ execute: [request: AdminGdprRequest] }>()
const auth = useAuthStore()

function fullName(r: AdminGdprRequest) {
  return [r.firstName, r.lastName].filter(Boolean).join(' ') || '—'
}
function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border">
    <p v-if="loading" class="p-4 text-sm text-text-muted">Chargement…</p>
    <p v-else-if="requests.length === 0" data-test="gdpr-empty" class="p-4 text-sm text-text-muted">
      Aucune demande de suppression en attente.
    </p>
    <table v-else class="w-full text-sm">
      <thead class="border-b border-border text-left text-text-muted">
        <tr>
          <th class="px-4 py-3 font-medium">Utilisateur</th>
          <th class="px-4 py-3 font-medium">Email</th>
          <th class="px-4 py-3 font-medium">Demandée le</th>
          <th class="px-4 py-3 font-medium">Ancienneté</th>
          <th class="px-4 py-3 font-medium" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in requests" :key="r.id" :data-test="`row-${r.id}`" class="border-b border-border last:border-0">
          <td class="px-4 py-3">{{ fullName(r) }}</td>
          <td class="px-4 py-3">{{ r.email ?? '—' }}</td>
          <td class="px-4 py-3 tabular-nums">{{ fmt(r.deletionRequestedAt) }}</td>
          <td class="px-4 py-3 tabular-nums">{{ r.ageDays }} j</td>
          <td class="px-4 py-3 text-right">
            <button
              v-if="auth.can('USER_GDPR_DELETE')" type="button" :data-test="`action-gdpr-execute-${r.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-danger/20 text-danger hover:bg-danger/30"
              @click="emit('execute', r)"
            >Exécuter la suppression</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 7: Créer la page**

`app/pages/users/rgpd.vue` :

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import GdprRequestsTable from '@/features/users/components/GdprRequestsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useGdprRequests } from '@/features/users/composables/useGdprRequests'
import type { AdminGdprRequest } from '@/features/users/types/index'

definePageMeta({
  middleware: 'admin-only',
  permission: 'USER_GDPR_DELETE',
  pageTitle: 'Demandes RGPD',
  pageSubtitle: 'File des suppressions de compte',
})

const { requests, isLoading, error, busy, currentPage, totalPages, fetchRequests, goToPage, execute }
  = useGdprRequests()

// Geste irréversible : double confirmation par saisie du nom exact de l'utilisateur,
// en plus du motif obligatoire.
const pending = ref<AdminGdprRequest | null>(null)
const pendingName = computed(() =>
  pending.value ? [pending.value.firstName, pending.value.lastName].filter(Boolean).join(' ') : '',
)

async function confirmExecute(reason: string) {
  const target = pending.value
  pending.value = null
  if (target) await execute(target.id, reason)
}

onMounted(fetchRequests)
</script>

<template>
  <div>
    <p
      v-if="error" data-test="gdpr-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <GdprRequestsTable :requests="requests" :loading="isLoading" @execute="(r) => pending = r" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <ConfirmActionDialog
      :open="pending !== null"
      title="Supprimer définitivement ce compte"
      :message="`Le compte de ${pendingName} sera anonymisé et banni. Cette action est irréversible.`"
      confirm-label="Supprimer définitivement"
      :require-reason="true"
      :confirmation-phrase="pendingName"
      :confirmation-label="`Saisissez « ${pendingName} » pour confirmer`"
      @confirm="confirmExecute"
      @cancel="pending = null"
    />
  </div>
</template>
```

- [ ] **Step 8: Ajouter l'entrée de sidebar**

Dans `app/components/layout/AppSidebar.vue` :

1. Ajouter `UserX` à l'import `lucide-vue-next` :

```ts
import {
  LayoutDashboard, Users, UserX, CreditCard, Package, AlertTriangle,
  Bell, MessageSquare, Ticket, ScrollText, Download, Flag, ShieldCheck, KeyRound,
} from 'lucide-vue-next'
```

2. Insérer le `NavItem` juste après celui de `/users` :

```vue
      <NavItem v-if="can('USER_GDPR_DELETE')" to="/users/rgpd" label="Demandes RGPD"><template #icon><UserX class="w-4 h-4" /></template></NavItem>
```

- [ ] **Step 9: Relancer les tests ciblés**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm vitest run tests/unit/features/users tests/components/AppSidebar.spec.ts tests/components/pages.spec.ts
```
Attendu : tous verts. Le test existant `renders all 11 module links` reste vert — il vérifie des `toContain`, pas un décompte.

- [ ] **Step 10: Suite complète, lint, typecheck, couverture**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm test && pnpm lint && pnpm typecheck && pnpm test:coverage
```
Attendu : `486 passed` (474 + 12), seuils 90/85/90/90 tenus. Rapporter le décompte réel.

- [ ] **Step 11: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
git add app/features/users/composables/useGdprRequests.ts \
        app/features/users/components/GdprRequestsTable.vue \
        app/pages/users/rgpd.vue app/components/layout/AppSidebar.vue \
        tests/unit/features/users/useGdprRequests.spec.ts \
        tests/unit/features/users/GdprRequestsTable.spec.ts \
        tests/components/AppSidebar.spec.ts tests/components/pages.spec.ts
git commit -m "feat(users): page des demandes RGPD avec double confirmation par saisie du nom"
```

---

### Task 12: E2E Playwright — onglet KYC et file RGPD

**Dépôt :** `yadony-admin`

⚠️ **Piège de routage Playwright, déjà rencontré dans `users.spec.ts`** : les branches d'un handler `page.route` sont évaluées dans l'ordre, et plusieurs chemins se contiennent mutuellement. Ici :
- `/u1/kyc/reset` **contient** `/u1/kyc` → tester `reset` **avant** la lecture ;
- `/gdpr-requests` et `/gdpr-execute` partagent le préfixe `/gdpr-` → discriminer sur la méthode (`GET` vs `POST`) **et** le chemin complet.

**Files:**
- Create: `.../tests/e2e/users-kyc-rgpd.spec.ts`

**Interfaces:**
- Consumes : toutes les routes back des Tasks 5 et 7, et tous les `data-test` des Tasks 8, 10 et 11 (`tab-kyc`, `kyc-status`, `kyc-stripe-session`, `kyc-stripe-unavailable`, `action-reset-kyc`, `reason`, `confirmation-input`, `confirm`, `row-u1`, `action-gdpr-execute-u1`, `gdpr-error`, `gdpr-empty`).
- Produces : rien (feuille de l'arbre).

- [ ] **Step 1: Écrire le spec E2E**

Créer `tests/e2e/users-kyc-rgpd.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

const ADMIN = {
  id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN',
  status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {},
}

const LIST_PAGE = {
  content: [{
    id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33611111111',
    city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'REJECTED',
    isProAccount: false, averageRating: 4.5, totalTrips: 2, totalShipments: 3,
    createdAt: '2026-01-01',
  }],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}

const DETAIL_U1 = {
  ...LIST_PAGE.content[0],
  email: 'jean@x.fr', roles: ['SENDER'], stripeAccountStatus: 'ONBOARDING_COMPLETE',
  commissionRateOverride: null, publishingSuspended: false, kiloPro: false,
  cancellationCount: 0, noShowCount: 1, refusedCount: 0, senderHandoverIncidentCount: 0,
  ratingCount: 10, deletionRequestedAt: null, messagingMutedUntil: null,
}

const KYC_REJECTED = {
  userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
  rejectionReason: 'document_expired', rejectionCode: 'document_expired',
  stripeSessionId: 'vs_001', stripeStatus: 'requires_input',
  stripeLastErrorCode: 'document_expired', stripeLastErrorReason: 'The document has expired.',
  stripeCreatedAt: '2026-08-01T10:00:00', stripeUnavailable: false,
}

const KYC_RESET = {
  userId: 'u1', kycStatus: 'NOT_STARTED', verificationStatus: 'PENDING',
  rejectionReason: null, rejectionCode: null, stripeSessionId: null, stripeStatus: null,
  stripeLastErrorCode: null, stripeLastErrorReason: null, stripeCreatedAt: null,
  stripeUnavailable: false,
}

const GDPR_PAGE = {
  content: [{
    id: 'u1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr',
    status: 'PENDING_DELETION', deletionRequestedAt: '2026-07-01T00:00:00', ageDays: 48,
  }],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}

const GDPR_EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

async function seedAdmin(page: import('@playwright/test').Page) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, ADMIN)
}

test.beforeEach(async ({ page }) => {
  await seedAdmin(page)
})

test('admin consulte le KYC d\'un utilisateur puis le réinitialise', async ({ page }) => {
  const resetCalls: { reason: string }[] = []
  let kycState = KYC_REJECTED

  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    // '/u1/kyc/reset' contient '/u1/kyc' : la branche reset passe en premier.
    if (method === 'POST' && url.includes('/u1/kyc/reset')) {
      resetCalls.push(req.postDataJSON() as { reason: string })
      kycState = KYC_RESET
      return route.fulfill({ json: KYC_RESET })
    }
    if (method === 'GET' && url.includes('/u1/kyc')) {
      return route.fulfill({ json: kycState })
    }
    if (method === 'GET' && url.includes('/u1')) {
      return route.fulfill({ json: DETAIL_U1 })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await page.locator('[data-test="tab-kyc"]').click()

  await expect(page.locator('[data-test="kyc-status"]')).toContainText('REJECTED')
  await expect(page.locator('[data-test="kyc-stripe-session"]')).toContainText('vs_001')
  await expect(page.getByText('The document has expired.')).toBeVisible()

  await page.locator('[data-test="action-reset-kyc"]').click()
  await page.locator('[data-test="reason"]').fill('document illisible')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="kyc-status"]')).toContainText('NOT_STARTED')
  await expect(page.locator('[data-test="kyc-stripe-session"]')).toContainText('Aucune session')
  await expect.poll(() => resetCalls.length).toBe(1)
  expect(resetCalls[0]).toEqual({ reason: 'document illisible' })
})

test('Stripe indisponible : le KYC local reste affiché avec un avertissement', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'GET' && url.includes('/u1/kyc')) {
      return route.fulfill({ json: { ...KYC_REJECTED, stripeStatus: null, stripeLastErrorReason: null, stripeUnavailable: true } })
    }
    if (req.method() === 'GET' && url.includes('/u1')) {
      return route.fulfill({ json: DETAIL_U1 })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await page.locator('[data-test="tab-kyc"]').click()

  await expect(page.locator('[data-test="kyc-stripe-unavailable"]')).toBeVisible()
  await expect(page.locator('[data-test="kyc-status"]')).toContainText('REJECTED')
})

test('admin exécute une suppression RGPD après double confirmation par le nom', async ({ page }) => {
  const executeCalls: { reason: string }[] = []
  let queue = GDPR_PAGE

  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    // '/gdpr-requests' et '/gdpr-execute' partagent le préfixe '/gdpr-' :
    // on discrimine sur la méthode ET le chemin complet.
    if (method === 'POST' && url.includes('/u1/gdpr-execute')) {
      executeCalls.push(req.postDataJSON() as { reason: string })
      queue = GDPR_EMPTY
      return route.fulfill({ status: 204, body: '' })
    }
    if (method === 'GET' && url.includes('/gdpr-requests')) {
      return route.fulfill({ json: queue })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users/rgpd')
  await expect(page.locator('h1').first()).toContainText('Demandes RGPD')
  await expect(page.getByText('Jean Dupont')).toBeVisible()
  await expect(page.getByText('48 j')).toBeVisible()

  await page.locator('[data-test="action-gdpr-execute-u1"]').click()

  // La confirmation reste bloquée tant que le nom exact n'est pas saisi.
  await page.locator('[data-test="reason"]').fill('demande utilisateur confirmée')
  await expect(page.locator('[data-test="confirm"]')).toBeDisabled()
  await page.locator('[data-test="confirmation-input"]').fill('Jean Dupon')
  await expect(page.locator('[data-test="confirm"]')).toBeDisabled()
  await page.locator('[data-test="confirmation-input"]').fill('Jean Dupont')
  await expect(page.locator('[data-test="confirm"]')).toBeEnabled()
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="gdpr-empty"]')).toBeVisible()
  await expect.poll(() => executeCalls.length).toBe(1)
  expect(executeCalls[0]).toEqual({ reason: 'demande utilisateur confirmée' })
})

test('un refus 422 du back est affiché et la demande reste dans la file', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (method === 'POST' && url.includes('/u1/gdpr-execute')) {
      return route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        json: {
          type: 'https://yadony.com/problems/active-transactions',
          title: 'Unprocessable', status: 422,
          detail: 'Impossible — cet utilisateur a des transactions en cours',
          code: 'active-transactions',
        },
      })
    }
    if (method === 'GET' && url.includes('/gdpr-requests')) {
      return route.fulfill({ json: GDPR_PAGE })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users/rgpd')
  await page.locator('[data-test="action-gdpr-execute-u1"]').click()
  await page.locator('[data-test="reason"]').fill('motif')
  await page.locator('[data-test="confirmation-input"]').fill('Jean Dupont')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="gdpr-error"]'))
    .toContainText('Impossible — cet utilisateur a des transactions en cours')
  await expect(page.locator('[data-test="row-u1"]')).toBeVisible()
})
```

- [ ] **Step 2: Lancer le spec et constater l'état**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm e2e tests/e2e/users-kyc-rgpd.spec.ts
```
Attendu : `4 passed`. Si l'onglet KYC met un instant à s'hydrater, appliquer le même remède que le commit `fde633a` (« attendre l'hydratation avant de basculer d'onglet ») : insérer `await expect(page.locator('[data-test="tab-kyc"]')).toBeEnabled()` avant le `click()`.

- [ ] **Step 3: Rejouer TOUTE la suite E2E (non-régression)**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm e2e
```
Attendu : tous les specs existants verts, en particulier `users.spec.ts` (l'ajout de la barre d'onglets ne doit casser aucun de ses 5 parcours) et `navigation.spec.ts` (nouvelle entrée de sidebar). Rapporter le décompte réel.

- [ ] **Step 4: Vérification finale du dépôt front**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm test && pnpm lint && pnpm typecheck && pnpm test:coverage
```
Attendu : `486 passed`, 0 erreur, seuils 90/85/90/90 tenus.

- [ ] **Step 5: Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
git add tests/e2e/users-kyc-rgpd.spec.ts
git commit -m "test(e2e): parcours de consultation/réinitialisation KYC et de suppression RGPD"
```

---

## Vérification finale du lot

Une fois les 12 tâches terminées, avant d'ouvrir les deux PR.

- [ ] **Back — suite complète et couverture**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test jacoco:report
```
`Failures: 0, Errors: 0`, `Tests run` ≥ 3580, couverture globale ≥ 90 % (`target/site/jacoco/index.html`).

- [ ] **Front — suite, lint, types, couverture, E2E**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin
pnpm test && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm e2e
```
`486 passed` en unitaire, seuils 90/85/90/90 tenus, E2E verte.

- [ ] **Critères d'acceptation du lot**

| Critère | Preuve |
|---|---|
| `USER_KYC` et `USER_GDPR_DELETE` ne sont plus des permissions mortes | `AdminUserKycController` + `AdminGdprController` (back), onglet KYC + page `users/rgpd` (front) |
| SUPPORT ne peut exécuter aucune suppression RGPD | `AdminGdprControllerIT.list_withSupportRole_returns403` et `execute_withSupportRole_returns403` |
| Tout endpoint d'écriture écrit dans `audit_log` | `KYC_RESET_BY_ADMIN` (Task 4), `USER_GDPR_EXECUTED` (Task 6) |
| Les refus restent en 422 avec les slugs existants | `AdminGdprControllerIT.execute_activeEscrow_returns422` / `execute_walletBalance_returns422` |
| La consultation KYC dégrade proprement | `KycAdminServiceTest.getForUser_stripeFails_degradesGracefully` + E2E « Stripe indisponible » |
| Le reset resynchronise les deux enums sans violer `uq_kyc_user_id` | `KycAdminServiceTest.resetForUser_updatesRowInPlaceAndSyncsBothEnums` (assert `getDeletedAt()).isNull()`) |
| Les 4 défauts d'anonymisation sont corrigés | 3 tests de `AccountFinalizationServiceTest` (Task 3) |
| La dette Lot B est reprise | `AnnouncementModerationServiceTest` (Task 1), `CashCommissionServiceTest` (Task 2) |
| Chaque page a `definePageMeta({ permission })` | `app/pages/users/rgpd.vue` |
| Chaque geste destructif a `auth.can(...)` + modale | `GdprRequestsTable` (`can('USER_GDPR_DELETE')`), `UserKycTab` (`can('USER_KYC')`) |

- [ ] **Deux PR empilées**, back mergée d'abord :
  - `dony-back` : `feature/admin-lot-b-moderation` → PR Lot C (7 commits)
  - `yadony-admin` : `feature/admin-lot-b-moderation` → PR Lot C (5 commits)
  - Aucun message de commit ne porte de ligne `Co-Authored-By: Claude`.
