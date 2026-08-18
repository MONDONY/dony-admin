# Lot B — Retrait de contenu + mute messagerie : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Permettre à un administrateur de retirer/restaurer une annonce de trajet, et de couper la messagerie d'un utilisateur de façon réellement bloquante (règle Firestore), le tout sous permissions dédiées.

**Architecture :** Trois repos. `dony-back` (Spring Boot) porte la source de vérité PostgreSQL, les endpoints admin et la propagation vers Firestore via l'Admin SDK. `dony-functions` porte la règle Firestore qui applique effectivement le mute — c'est le seul point où l'écriture d'un message peut être refusée, les clients écrivant directement dans Firestore. `dony-admin` (Nuxt 4) porte l'UI.

**Tech Stack :** Spring Boot 3.4 / Java 21, Flyway, Firebase Admin SDK ; Firestore security rules ; Nuxt 4 + TypeScript strict, Pinia, Vitest, Playwright.

**Spec :** `docs/superpowers/specs/2026-08-18-admin-rbac-completion-design.md` (§4, révisée le 2026-08-18)

## Global Constraints

- Jamais de commit sur `main` — branches `feature/<nom>` ou `fix/<nom>`. Jamais de `Co-Authored-By: Claude`.
- Erreurs back : `YadonyBusinessException` (code slug sans préfixe de domaine, ex. `publishing-suspended`) pour tout ce qui remonte à un client mobile — le catalogue `dony_app/lib/core/error/error_catalog.dart` route sur ce code.
- Soft delete uniquement ; jamais de modification d'une migration existante — la prochaine est **V219** (dernière : `V218__bid_status_negotiation_closed.sql`).
- `audit_log` est immuable : insertion seulement.
- Pas d'injection de service entre packages — événements Spring, ou lecture directe d'entité.
- Tout endpoint `/admin/**` d'écriture : `hasRole('ADMIN')` **et** une authority dédiée.
- Front : `definePageMeta({ permission })` par page, `auth.can(...)` + confirmation sur tout geste destructif.
- Le miroir `AdminPermission.java` ↔ `app/stores/auth.ts` doit rester exact.
- Une seule exécution Maven à la fois (des runs concurrents produisent de faux échecs Testcontainers).

---

## Partie 1 — BACK : permissions et retrait d'annonce

Repo `dony-back`, branche `feature/admin-lot-b-moderation` (créer depuis `origin/main`).

### Task 1 : deux nouvelles permissions

**Files:**
- Modify: `src/main/java/com/yadony/api/admin/account/AdminPermission.java`
- Test (create): `src/test/java/com/yadony/api/admin/account/AdminPermissionsLotBTest.java`

**Interfaces:**
- Produces : les valeurs d'enum `CONTENT_REMOVE` et `USER_MESSAGE_MUTE`. Attribution : `SUPER_ADMIN` les a (via `EnumSet.allOf`), `ADMIN` les a (via `complementOf(ADMIN_MANAGE)`), `SUPPORT` ne les a **pas** (sa liste est explicite dans `AdminRole.permissions()` et ne doit pas être modifiée).

- [ ] **Step 1 : Écrire le test qui échoue**

```java
package com.yadony.api.admin.account;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Lot B : CONTENT_REMOVE et USER_MESSAGE_MUTE ne sont pas des permissions de support. */
class AdminPermissionsLotBTest {

    @Test
    void superAdmin_hasBothNewPermissions() {
        Set<AdminPermission> perms = AdminPermissions.effective(AdminRole.SUPER_ADMIN, Map.of());
        assertThat(perms).contains(AdminPermission.CONTENT_REMOVE, AdminPermission.USER_MESSAGE_MUTE);
    }

    @Test
    void admin_hasBothNewPermissions() {
        Set<AdminPermission> perms = AdminPermissions.effective(AdminRole.ADMIN, Map.of());
        assertThat(perms).contains(AdminPermission.CONTENT_REMOVE, AdminPermission.USER_MESSAGE_MUTE);
    }

    @Test
    void support_hasNeitherNewPermission() {
        Set<AdminPermission> perms = AdminPermissions.effective(AdminRole.SUPPORT, Map.of());
        assertThat(perms).doesNotContain(AdminPermission.CONTENT_REMOVE, AdminPermission.USER_MESSAGE_MUTE);
    }

    @Test
    void support_canReceiveContentRemoveViaOverride() {
        Set<AdminPermission> perms = AdminPermissions.effective(
                AdminRole.SUPPORT, Map.of("CONTENT_REMOVE", true));
        assertThat(perms).contains(AdminPermission.CONTENT_REMOVE);
    }

    @Test
    void enumHasExactlyTwentySixValues() {
        assertThat(AdminPermission.values()).hasSize(26);
    }
}
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd <dony-back> && ./mvnw test -Dtest=AdminPermissionsLotBTest`
Attendu : échec de compilation — `CONTENT_REMOVE` et `USER_MESSAGE_MUTE` n'existent pas.

- [ ] **Step 3 : Implémentation.** Dans `AdminPermission.java`, ajouter à la section « Alerts & moderation » :

```java
    MODERATION_VIEW,
    MESSAGE_DELETE,
    CONTENT_REMOVE,
    USER_MESSAGE_MUTE,
```

Corriger au passage le javadoc de l'enum : il annonce « 25 granular permissions » alors que l'enum en comptait 24 ; il en compte désormais **26**.

Ne pas toucher `AdminRole.permissions()` : `SUPER_ADMIN` et `ADMIN` héritent automatiquement, `SUPPORT` a une liste explicite qui reste inchangée.

- [ ] **Step 4 : Vérifier**

Run : `cd <dony-back> && ./mvnw test -Dtest='AdminPermission*'`
Attendu : PASS (y compris les tests existants sur les permissions).

- [ ] **Step 5 : Commit**

```bash
git add src/main/java/com/yadony/api/admin/account/AdminPermission.java \
        src/test/java/com/yadony/api/admin/account/AdminPermissionsLotBTest.java
git commit -m "feat(admin): permissions CONTENT_REMOVE et USER_MESSAGE_MUTE

SUPPORT ne les reçoit pas par défaut — retirer du contenu et couper la
messagerie sont des gestes de modération réservés aux administrateurs."
```

---

### Task 2 : statut REMOVED_BY_ADMIN et endpoints de retrait

**Files:**
- Modify: `src/main/java/com/yadony/api/matching/AnnouncementStatus.java`
- Create: `src/main/java/com/yadony/api/admin/AdminAnnouncementModerationController.java`
- Create: `src/main/java/com/yadony/api/admin/dto/RemoveAnnouncementRequest.java`
- Modify: `src/main/java/com/yadony/api/matching/AnnouncementService.java` (ajout des méthodes de retrait/restauration)
- Test (create): `src/test/java/com/yadony/api/matching/AnnouncementModerationServiceTest.java`

**Interfaces:**
- Consumes : `AnnouncementRepository`, `AuditService.log(String entityType, UUID entityId, String action, UUID actorId, Map<String,String> details)`, `NotificationDispatcher.notifyUser(UUID userId, String title, String body, Map<String,String> data)`, `BidRepository` pour détecter les bids acceptés.
- Produces :
  - `AnnouncementStatus.REMOVED_BY_ADMIN`
  - `AnnouncementService.removeByAdmin(UUID announcementId, UUID adminId, String reason)` → `AnnouncementEntity`
  - `AnnouncementService.restoreByAdmin(UUID announcementId, UUID adminId)` → `AnnouncementEntity`
  - `POST /admin/announcements/{id}/remove` body `{"reason": "..."}` → 200
  - `POST /admin/announcements/{id}/restore` → 200

**Contexte à lire avant d'écrire :** la recherche publique filtre sur `AnnouncementSpecification.hasStatus(AnnouncementStatus.ACTIVE)` (`AnnouncementService.java:166`) — une annonce en `REMOVED_BY_ADMIN` disparaît donc des résultats publics sans autre changement. Aucun `switch` exhaustif n'existe sur `AnnouncementStatus`, mais **audite les comparaisons `==`/`!=` existantes** sur ce type (notamment dans `BidService`, `FavoriteService`, `CancellationService`) et signale dans ton rapport toute logique qui traiterait à tort une annonce retirée comme active.

- [ ] **Step 1 : Écrire les tests qui échouent.** Reprends le setup de `src/test/java/com/yadony/api/matching/NoShowServiceTest.java` (`@ExtendWith(MockitoExtension.class)`, `@Mock`, `ArgumentCaptor`) :

```java
package com.yadony.api.matching;

import com.yadony.api.common.YadonyBusinessException;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Lot B : retrait administratif d'une annonce de trajet. */
class AnnouncementModerationServiceTest {

    // Setup identique à NoShowServiceTest : mocks du repository, de l'audit,
    // du dispatcher de notifications et du repository de bids.

    @Test
    void removeByAdmin_setsStatusAndAudits() {
        // annonce ACTIVE, aucun bid accepté
        AnnouncementEntity result = service.removeByAdmin(annId, adminId, "contenu frauduleux");

        assertThat(result.getStatus()).isEqualTo(AnnouncementStatus.REMOVED_BY_ADMIN);
        verify(auditService).log(eq("ANNOUNCEMENT"), eq(annId),
                eq("ANNOUNCEMENT_REMOVED_BY_ADMIN"), eq(adminId), anyMap());
    }

    @Test
    void removeByAdmin_notifiesOwner() {
        service.removeByAdmin(annId, adminId, "contenu frauduleux");
        verify(notificationDispatcher).notifyUser(eq(ownerId), anyString(), anyString(), anyMap());
    }

    @Test
    void removeByAdmin_rejectedWhenAcceptedBidsExist() {
        // stub : le repository de bids renvoie au moins un bid accepté
        assertThatThrownBy(() -> service.removeByAdmin(annId, adminId, "peu importe"))
                .isInstanceOf(YadonyBusinessException.class)
                .satisfies(e -> {
                    YadonyBusinessException y = (YadonyBusinessException) e;
                    assertThat(y.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(y.getErrorCode()).isEqualTo("announcement-has-accepted-bids");
                });
    }

    @Test
    void restoreByAdmin_returnsToActiveAndAudits() {
        // annonce en REMOVED_BY_ADMIN
        AnnouncementEntity result = service.restoreByAdmin(annId, adminId);

        assertThat(result.getStatus()).isEqualTo(AnnouncementStatus.ACTIVE);
        verify(auditService).log(eq("ANNOUNCEMENT"), eq(annId),
                eq("ANNOUNCEMENT_RESTORED_BY_ADMIN"), eq(adminId), anyMap());
    }

    @Test
    void restoreByAdmin_rejectedWhenNotRemoved() {
        // annonce ACTIVE
        assertThatThrownBy(() -> service.restoreByAdmin(annId, adminId))
                .isInstanceOf(YadonyBusinessException.class)
                .satisfies(e -> assertThat(((YadonyBusinessException) e).getErrorCode())
                        .isEqualTo("announcement-not-removed"));
    }
}
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd <dony-back> && ./mvnw test -Dtest=AnnouncementModerationServiceTest`
Attendu : échec de compilation (statut et méthodes absents).

- [ ] **Step 3 : Implémentation.**

`AnnouncementStatus.java` — ajouter la valeur en fin d'enum :

```java
public enum AnnouncementStatus {
    DRAFT,
    ACTIVE,
    FULL,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED,
    /** Retirée par un administrateur (modération). Restaurable vers ACTIVE. */
    REMOVED_BY_ADMIN
}
```

`AnnouncementService` — deux méthodes transactionnelles. Le refus de retrait quand des bids acceptés existent protège une livraison engagée :

```java
    @Transactional
    @CacheEvict(value = "announcements-search", allEntries = true)
    public AnnouncementEntity removeByAdmin(UUID announcementId, UUID adminId, String reason) {
        AnnouncementEntity ann = announcementRepository.findById(announcementId)
                .orElseThrow(() -> new YadonyBusinessException(HttpStatus.NOT_FOUND,
                        "announcement-not-found", "Not Found", "Annonce introuvable"));
        if (bidRepository.existsByAnnouncementIdAndStatusIn(announcementId, ACTIVE_BID_STATUSES)) {
            throw new YadonyBusinessException(HttpStatus.CONFLICT,
                    "announcement-has-accepted-bids", "Conflict",
                    "Des colis acceptés sont en cours sur cette annonce.");
        }
        ann.setStatus(AnnouncementStatus.REMOVED_BY_ADMIN);
        AnnouncementEntity saved = announcementRepository.save(ann);

        auditService.log("ANNOUNCEMENT", announcementId, "ANNOUNCEMENT_REMOVED_BY_ADMIN", adminId,
                Map.of("reason", reason));
        notificationDispatcher.notifyUser(ann.getTravelerId(),
                "Annonce retirée",
                "Votre annonce a été retirée par la modération. Motif : " + reason,
                Map.of("type", "ANNOUNCEMENT_REMOVED", "announcementId", announcementId.toString()));
        return saved;
    }

    @Transactional
    @CacheEvict(value = "announcements-search", allEntries = true)
    public AnnouncementEntity restoreByAdmin(UUID announcementId, UUID adminId) {
        AnnouncementEntity ann = announcementRepository.findById(announcementId)
                .orElseThrow(() -> new YadonyBusinessException(HttpStatus.NOT_FOUND,
                        "announcement-not-found", "Not Found", "Annonce introuvable"));
        if (ann.getStatus() != AnnouncementStatus.REMOVED_BY_ADMIN) {
            throw new YadonyBusinessException(HttpStatus.CONFLICT,
                    "announcement-not-removed", "Conflict",
                    "Cette annonce n'a pas été retirée par la modération.");
        }
        ann.setStatus(AnnouncementStatus.ACTIVE);
        AnnouncementEntity saved = announcementRepository.save(ann);
        auditService.log("ANNOUNCEMENT", announcementId, "ANNOUNCEMENT_RESTORED_BY_ADMIN", adminId,
                Map.of());
        return saved;
    }
```

Vérifie le nom exact du getter du propriétaire sur `AnnouncementEntity` (`getTravelerId()` ou équivalent) et la constante des statuts de bid « engagés » — s'il n'existe pas de méthode `existsByAnnouncementIdAndStatusIn`, ajoute-la au repository de bids en suivant les conventions Spring Data du fichier.

`RemoveAnnouncementRequest.java` :

```java
package com.yadony.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Motif de retrait d'une annonce par la modération. */
public record RemoveAnnouncementRequest(
        @NotBlank(message = "Le motif est obligatoire")
        @Size(max = 500, message = "Le motif ne peut pas dépasser 500 caractères")
        String reason
) {}
```

`AdminAnnouncementModerationController.java` — calque-toi sur `AdminUserController` pour la résolution de l'identité de l'administrateur courant :

```java
package com.yadony.api.admin;

@RestController
@PreAuthorize("hasRole('ADMIN') and hasAuthority('CONTENT_REMOVE')")
public class AdminAnnouncementModerationController {

    @PostMapping("/admin/announcements/{id}/remove")
    public AdminAnnouncementListItemResponse remove(@PathVariable UUID id,
            @RequestBody @Valid RemoveAnnouncementRequest request) { ... }

    @PostMapping("/admin/announcements/{id}/restore")
    public AdminAnnouncementListItemResponse restore(@PathVariable UUID id) { ... }
}
```

Réutilise le DTO de réponse déjà servi par `AdminBidsController` pour `/admin/announcements` (`AdminAnnouncementListItemResponse`) afin que le front puisse remplacer la ligne dans sa table sans second aller-retour.

- [ ] **Step 4 : Vérifier**

Run : `cd <dony-back> && ./mvnw test -Dtest=AnnouncementModerationServiceTest` puis `./mvnw test -Dtest='Announcement*'`
Attendu : PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(admin): retrait et restauration d'une annonce de trajet

Statut REMOVED_BY_ADMIN, refusé si des colis acceptés sont en cours.
La recherche publique filtrant déjà sur ACTIVE, l'annonce disparaît
des résultats sans changement supplémentaire."
```

---

## Partie 2 — BACK : mute messagerie

### Task 3 : migration et colonne de mute

**Files:**
- Create: `src/main/resources/db/migration/V219__add_messaging_muted_until.sql`
- Modify: `src/main/java/com/yadony/api/auth/UserEntity.java`
- Test (create): `src/test/java/com/yadony/api/auth/UserEntityMuteTest.java`

**Interfaces:**
- Produces : colonne `users.messaging_muted_until TIMESTAMPTZ NULL` ; sur `UserEntity`, champ `messagingMutedUntil` de type `java.time.Instant` avec `getMessagingMutedUntil()` / `setMessagingMutedUntil(Instant)` ; méthode `isMessagingMuted(Instant now)` renvoyant `true` si l'échéance est postérieure à `now`.

- [ ] **Step 1 : Écrire le test qui échoue**

```java
package com.yadony.api.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** Lot B : état de coupure de la messagerie, borné dans le temps. */
class UserEntityMuteTest {

    @Test
    void notMutedByDefault() {
        assertThat(new UserEntity().isMessagingMuted(Instant.now())).isFalse();
    }

    @Test
    void mutedWhenDeadlineInFuture() {
        UserEntity u = new UserEntity();
        u.setMessagingMutedUntil(Instant.now().plus(1, ChronoUnit.HOURS));
        assertThat(u.isMessagingMuted(Instant.now())).isTrue();
    }

    @Test
    void notMutedWhenDeadlinePassed() {
        UserEntity u = new UserEntity();
        u.setMessagingMutedUntil(Instant.now().minus(1, ChronoUnit.SECONDS));
        assertThat(u.isMessagingMuted(Instant.now())).isFalse();
    }
}
```

- [ ] **Step 2 :** `cd <dony-back> && ./mvnw test -Dtest=UserEntityMuteTest` → échec de compilation.

- [ ] **Step 3 : Implémentation.**

`V219__add_messaging_muted_until.sql` :

```sql
-- Lot B : coupure administrative de la messagerie d'un utilisateur.
-- NULL = messagerie autorisée. Une échéance très lointaine matérialise un
-- mute indéfini, ce qui garde la règle Firestore à une seule comparaison.
ALTER TABLE users ADD COLUMN messaging_muted_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.messaging_muted_until IS
  'Échéance de la coupure de messagerie décidée par la modération. NULL = pas de coupure.';
```

`UserEntity.java` — à côté des champs de suspension de publication existants :

```java
    @Column(name = "messaging_muted_until")
    private Instant messagingMutedUntil;
```

avec accesseurs, et la méthode métier :

```java
    /** Vrai si la messagerie est coupée à l'instant donné. */
    public boolean isMessagingMuted(Instant now) {
        return messagingMutedUntil != null && messagingMutedUntil.isAfter(now);
    }
```

- [ ] **Step 4 :** `cd <dony-back> && ./mvnw test -Dtest=UserEntityMuteTest` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/main/resources/db/migration/V219__add_messaging_muted_until.sql \
        src/main/java/com/yadony/api/auth/UserEntity.java \
        src/test/java/com/yadony/api/auth/UserEntityMuteTest.java
git commit -m "feat(auth): colonne messaging_muted_until sur users"
```

---

### Task 4 : propagation Firestore + endpoints de mute

**Files:**
- Modify: `src/main/java/com/yadony/api/messaging/FirestoreService.java`
- Modify: `src/main/java/com/yadony/api/auth/UserService.java`
- Modify: `src/main/java/com/yadony/api/admin/AdminUserController.java`
- Create: `src/main/java/com/yadony/api/admin/dto/MuteMessagingRequest.java`
- Modify: `src/main/java/com/yadony/api/admin/dto/AdminUserDetailResponse.java`
- Modify: `src/main/java/com/yadony/api/messaging/MessagingNotifyController.java`
- Test (create): `src/test/java/com/yadony/api/auth/UserServiceMuteTest.java`

**Interfaces:**
- Consumes : `UserEntity.isMessagingMuted(Instant)` et `setMessagingMutedUntil(Instant)` (Task 3), `AuditService.log(...)`, `NotificationDispatcher.notifyUser(...)`.
- Produces :
  - `FirestoreService.setMessagingMute(String firebaseUid, Instant until)` et `FirestoreService.clearMessagingMute(String firebaseUid)` — écrivent/suppriment le document `moderation/{firebaseUid}` avec le champ `messagingMutedUntil`, écrit comme un **Timestamp Firestore** (pas une chaîne ISO, contrairement au reste du fichier).
  - `UserService.muteMessaging(UUID userId, Integer durationHours, String reason)` → `UserEntity` (`durationHours == null` ⇒ mute indéfini)
  - `UserService.unmuteMessaging(UUID userId)` → `UserEntity`
  - `POST /admin/users/{id}/mute-messaging` body `{"durationHours": 24, "reason": "..."}` → `AdminUserDetailResponse`
  - `POST /admin/users/{id}/unmute-messaging` → `AdminUserDetailResponse`
  - `AdminUserDetailResponse` gagne le champ `messagingMutedUntil` (ISO-8601 ou `null`)

**Point d'attention 1 — l'identifiant du document. C'est l'UID Firebase, PAS l'UUID PostgreSQL.** Une règle de sécurité Firestore ne voit que `request.auth.uid`, c'est-à-dire l'UID Firebase. `UserEntity` porte les deux : son `id` (UUID généré par la base) et sa colonne `firebaseUid`. Clé-er le document sur l'UUID rendrait le mute **totalement inopérant tout en paraissant fonctionner** : colonne remplie, audit écrit, notification envoyée, interface admin verte, et l'utilisateur continue d'écrire. Le reste du code traduit déjà systématiquement UUID → firebaseUid avant d'écrire dans Firestore — regarde `ConversationService` et fais pareil. Passe donc `user.getFirebaseUid()`, pas `userId.toString()`.

**Point d'attention 2 — le type du champ. Un test de type est OBLIGATOIRE ici.** Écris `messagingMutedUntil` comme un **Timestamp Firestore**, pas comme une chaîne ISO, bien que toutes les autres dates de `FirestoreService` (`sentAt`, `deletedAt`, `lastMessageAt`) soient écrites en chaîne — la convention du fichier pousse donc vers l'erreur.

La règle Firestore a été durcie en fail-open : si le champ n'est pas un Timestamp, **le mute ne s'applique pas du tout**, silencieusement. Écrire une chaîne ici transformerait donc la sanction en no-op parfait : colonne PostgreSQL remplie, audit_log écrit, notification envoyée, interface admin verte, et l'utilisateur continue d'écrire. C'est le jumeau exact du piège de l'identifiant décrit au point 1.

**Ajoute donc un test qui assère le TYPE de la valeur écrite dans Firestore** (un `com.google.cloud.Timestamp`, pas une `String`), et pas seulement sa valeur. Sans ce test, rien dans la chaîne de vérification ne détecterait l'erreur.

**Point d'attention 3 — la collection.** Écris dans `moderation`, **jamais** dans `userMeta/{uid}` : cette dernière est écrivable par le client (`allow read, write: if request.auth.uid == uid`), y placer une sanction la rendrait contournable. La collection `moderation` n'aura aucune règle `allow write` : seul l'Admin SDK (qui ignore les règles) pourra l'écrire.

- [ ] **Step 1 : Écrire les tests qui échouent.** Setup calqué sur les tests existants de `UserService` :

```java
package com.yadony.api.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Lot B : coupure de messagerie — base de données, Firestore, audit, notification. */
class UserServiceMuteTest {

    @Test
    void muteMessaging_withDuration_setsDeadlineAndPropagatesToFirestore() {
        UserEntity saved = service.muteMessaging(userId, 24, "harcèlement");

        assertThat(saved.getMessagingMutedUntil()).isAfter(Instant.now().plusSeconds(23 * 3600));
        verify(firestoreService).setMessagingMute(eq(userId), any(Instant.class));
        verify(auditService).log(eq("USER"), eq(userId), eq("USER_MESSAGING_MUTED"), any(), anyMap());
        verify(notificationDispatcher).notifyUser(eq(userId), anyString(), anyString(), anyMap());
    }

    @Test
    void muteMessaging_indefinite_setsFarFutureDeadline() {
        UserEntity saved = service.muteMessaging(userId, null, "fraude");
        // Une échéance très lointaine matérialise l'indéfini et garde la règle
        // Firestore à une seule comparaison.
        assertThat(saved.getMessagingMutedUntil()).isAfter(Instant.now().plusSeconds(365L * 24 * 3600));
    }

    @Test
    void unmuteMessaging_clearsDeadlineAndDeletesFirestoreDoc() {
        UserEntity saved = service.unmuteMessaging(userId);

        assertThat(saved.getMessagingMutedUntil()).isNull();
        verify(firestoreService).clearMessagingMute(userId);
        verify(auditService).log(eq("USER"), eq(userId), eq("USER_MESSAGING_UNMUTED"), any(), anyMap());
    }
}
```

- [ ] **Step 2 :** `cd <dony-back> && ./mvnw test -Dtest=UserServiceMuteTest` → échec.

- [ ] **Step 3 : Implémentation.**

`FirestoreService` — deux méthodes, sur le modèle des méthodes existantes du fichier (elles gèrent déjà le cas où le bean Firestore est nul : reprends exactement cette garde) :

```java
    /**
     * Publie l'état de coupure de messagerie dans Firestore.
     * La règle de sécurité lit ce document pour refuser l'écriture d'un message :
     * c'est le seul point d'application réel, les clients écrivant directement
     * dans Firestore sans passer par ce backend.
     */
    public void setMessagingMute(UUID userId, Instant until) { ... }

    /** Retire la coupure — le document est supprimé, pas laissé avec une date passée. */
    public void clearMessagingMute(UUID userId) { ... }
```

Document écrit : collection `moderation`, identifiant `userId.toString()`, champ `messagingMutedUntil` (Timestamp Firestore).

`UserService` — deux méthodes transactionnelles. Pour l'indéfini, utilise une échéance à +100 ans (`Instant.now().plus(36500, ChronoUnit.DAYS)`), ce qui évite un cas particulier dans la règle Firestore.

`MuteMessagingRequest.java` :

```java
package com.yadony.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Coupure de la messagerie d'un utilisateur.
 * {@code durationHours} null = coupure indéfinie jusqu'à levée manuelle.
 */
public record MuteMessagingRequest(
        Integer durationHours,
        @NotBlank(message = "Le motif est obligatoire")
        @Size(max = 500) String reason
) {}
```

`AdminUserController` — deux endpoints :

```java
    @PreAuthorize("hasAuthority('USER_MESSAGE_MUTE')")
    @PostMapping("/{userId}/mute-messaging")
    public AdminUserDetailResponse muteMessaging(@PathVariable UUID userId,
            @RequestBody @Valid MuteMessagingRequest request) {
        return detail(userService.muteMessaging(userId, request.durationHours(), request.reason()));
    }

    @PreAuthorize("hasAuthority('USER_MESSAGE_MUTE')")
    @PostMapping("/{userId}/unmute-messaging")
    public AdminUserDetailResponse unmuteMessaging(@PathVariable UUID userId) {
        return detail(userService.unmuteMessaging(userId));
    }
```

`AdminUserDetailResponse` — ajouter `messagingMutedUntil` en suivant exactement la façon dont les autres champs temporels du record sont mappés depuis l'entité.

`MessagingNotifyController.notify()` — défense en profondeur : si l'expéditeur est muté, ne pas envoyer la notification. Ajoute la vérification après la résolution de la conversation et avant `notificationDispatcher.sendMessageNotification(...)`, en documentant que la règle Firestore est le blocage principal et ceci un filet.

- [ ] **Step 4 :** `cd <dony-back> && ./mvnw test -Dtest=UserServiceMuteTest` puis `./mvnw test -Dtest='*Messaging*'` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(admin): coupure de messagerie propagée à Firestore

La source de vérité reste PostgreSQL ; l'état est publié dans la collection
Firestore moderation/{userId}, que seul l'Admin SDK peut écrire. La règle
Firestore s'appuie dessus pour refuser l'écriture d'un message — les clients
écrivant directement dans Firestore, c'est le seul point de blocage réel.
La suppression de la notification côté backend n'est qu'un filet."
```

---

### Task 5 : couverture et PR back

- [ ] **Step 1 :** `cd <dony-back> && ./mvnw test` — suite complète verte (une seule exécution à la fois).
- [ ] **Step 2 :** Pousser, ouvrir la PR en décrivant : les deux permissions, le retrait d'annonce avec son refus 409, la coupure de messagerie et **le fait que la règle Firestore doit être déployée pour que le mute bloque réellement** (voir Partie 3).

---

## Partie 3 — FIRESTORE : la règle qui applique le mute

Repo `dony-functions`, branche `feature/mute-messaging-rule`.

### Task 6 : règle de sécurité

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes : documents `moderation/{userId}` écrits par le back (Task 4), champ `messagingMutedUntil`.
- Produces : refus de `create` sur `conversations/{convId}/messages/{msgId}` quand l'expéditeur est muté.

- [ ] **Step 1 : Écrire la règle.** Dans `firestore.rules`, ajouter la fonction à côté de `isValidClientMessage` :

```
    // Un utilisateur dont la modération a coupé la messagerie ne peut pas
    // écrire de message. Le document moderation/{uid} est écrit par le backend
    // via l'Admin SDK ; aucune règle `allow write` ne le couvre, un client ne
    // peut donc ni le créer ni le supprimer.
    function isMessagingMuted(uid) {
      return exists(/databases/$(database)/documents/moderation/$(uid))
             && get(/databases/$(database)/documents/moderation/$(uid))
                  .data.messagingMutedUntil > request.time;
    }
```

et l'appliquer à la création de message :

```
      match /messages/{msgId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn()
                      && request.resource.data.senderId == request.auth.uid
                      && !isMessagingMuted(request.auth.uid)
                      && isValidClientMessage(request.resource.data);
        allow update: if isSignedIn();
      }
```

Ne déclare **aucune** règle pour `match /moderation/{uid}` : l'absence de règle vaut refus pour les clients, et l'Admin SDK ignore les règles.

- [ ] **Step 2 : Tester avec l'émulateur.** Vérifie si le repo a déjà une configuration d'émulateur ou des tests de règles (`firebase.json`, dossier `test/`). S'il en existe, ajoute deux cas : un utilisateur non muté peut créer un message, un utilisateur muté reçoit un refus. **S'il n'existe aucune infrastructure de test de règles, ne l'invente pas dans cette tâche** : signale-le dans ton rapport et documente la vérification manuelle à faire (émulateur `firebase emulators:start --only firestore`).

- [ ] **Step 3 : Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): un utilisateur muté ne peut plus écrire de message

Les clients écrivant directement dans Firestore, la règle est le seul point
où l'envoi peut être refusé. L'état est lu dans moderation/{uid}, écrit par
le backend via l'Admin SDK et inaccessible en écriture aux clients."
```

- [ ] **Step 4 :** Ouvrir la PR en précisant que **le déploiement des règles doit précéder ou accompagner** l'activation du geste côté admin, sans quoi la coupure ne bloquerait rien.

---

## Partie 4 — FRONT : UI de modération

Repo `dony-admin`, branche `feature/admin-lot-b-moderation` (déjà créée depuis `origin/main`).

### Task 7 : miroir des permissions

**Files:**
- Modify: `app/stores/auth.ts`
- Test (modify): `tests/unit/stores/auth.spec.ts`

**Interfaces:**
- Produces : `'CONTENT_REMOVE'` et `'USER_MESSAGE_MUTE'` dans le type `AdminPermission` et dans `ALL_PERMISSIONS` (qui passe de 24 à 26 entrées). `ROLE_PERMISSIONS.SUPPORT` **n'est pas modifié** — SUPPORT ne reçoit ni l'une ni l'autre.

- [ ] **Step 1 : Tests qui échouent** — dans `tests/unit/stores/auth.spec.ts` :

```ts
  it('ADMIN can remove content and mute messaging', () => {
    seedAuth('ADMIN')
    const auth = useAuthStore()
    expect(auth.can('CONTENT_REMOVE')).toBe(true)
    expect(auth.can('USER_MESSAGE_MUTE')).toBe(true)
  })

  it('SUPPORT can neither remove content nor mute messaging', () => {
    seedAuth('SUPPORT')
    const auth = useAuthStore()
    expect(auth.can('CONTENT_REMOVE')).toBe(false)
    expect(auth.can('USER_MESSAGE_MUTE')).toBe(false)
  })

  it('SUPPORT can receive CONTENT_REMOVE via an override', () => {
    seedAuth('SUPPORT', { CONTENT_REMOVE: true })
    expect(useAuthStore().can('CONTENT_REMOVE')).toBe(true)
  })

  it('exposes 26 permissions, mirroring the backend enum', () => {
    expect(ALL_PERMISSIONS).toHaveLength(26)
  })
```

- [ ] **Step 2 :** `pnpm vitest run tests/unit/stores/auth.spec.ts` → FAIL.

- [ ] **Step 3 :** Ajouter les deux valeurs au type union `AdminPermission` et à `ALL_PERMISSIONS`, à la même position que dans l'enum back (après `MESSAGE_DELETE`), pour que les deux listes se lisent en parallèle.

- [ ] **Step 4 :** `pnpm vitest run tests/unit/stores/auth.spec.ts` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add app/stores/auth.ts tests/unit/stores/auth.spec.ts
git commit -m "feat(auth): miroir des permissions CONTENT_REMOVE et USER_MESSAGE_MUTE"
```

---

### Task 8 : service et composable de modération d'annonce

**Files:**
- Modify: `app/features/bids/services/` (fichier de service des annonces — le localiser)
- Modify: `app/features/bids/types/index.ts` (statut `REMOVED_BY_ADMIN`)
- Create ou Modify: composable de la table des annonces
- Test (modify/create): specs unitaires correspondantes

**Interfaces:**
- Produces : `removeAnnouncement(id: string, reason: string): Promise<AdminAnnouncement>` et `restoreAnnouncement(id: string): Promise<AdminAnnouncement>`, appelant `POST /admin/announcements/{id}/remove` (body `{reason}`) et `POST /admin/announcements/{id}/restore`. Les deux renvoient la ligne mise à jour, à substituer dans la liste sans rechargement complet.
- Le type de statut des annonces gagne `'REMOVED_BY_ADMIN'`.

- [ ] **Step 1 :** Lire le service et les types existants du dossier `app/features/bids/` pour suivre leurs conventions exactes (nom du fichier de service, forme des types, mock `useApi` dans les specs).
- [ ] **Step 2 : Tests qui échouent** — vérifier l'URL, la méthode et le corps de chaque appel, sur le modèle de `tests/unit/features/users/usersService.spec.ts`.
- [ ] **Step 3 : Implémentation** — utiliser un paramètre de type explicite sur `useApi()` (l'absence de generic a déjà provoqué une erreur `Excessive stack depth` au typecheck).
- [ ] **Step 4 :** `pnpm vitest run tests/unit/features/bids/` → PASS.
- [ ] **Step 5 : Commit.**

---

### Task 9 : actions de retrait dans la table des annonces

**Files:**
- Modify: `app/features/bids/components/AnnouncementsTable.vue`
- Modify: `app/pages/colis/index.vue`
- Test (modify): `tests/unit/features/bids/AnnouncementsTable.spec.ts`

**Interfaces:**
- Consumes : `auth.can('CONTENT_REMOVE')`, le service de la Task 8.
- Produces : emits `remove: [id: string, reason: string]` et `restore: [id: string]`.

**Contexte :** `AnnouncementsTable` est aujourd'hui **purement en lecture** — colonnes Trajet, Voyageur, Départ, Capacité, Prix/kg, Statut, aucune action. Le mapping `annTone` (lignes 7-13) couvre `ACTIVE, FULL, IN_PROGRESS, COMPLETED, CANCELLED`. Le badge réutilisable est `app/components/ui/StatusBadge.vue` (props `label`, `tone`).

- [ ] **Step 1 : Tests qui échouent :**
  - une colonne d'actions apparaît quand `auth.can('CONTENT_REMOVE')`, et pas sinon (`seedAuth('SUPPORT')`)
  - « Retirer » sur une annonce `ACTIVE` ouvre une confirmation exigeant un motif, et émet `remove` avec l'identifiant et le motif
  - « Restaurer » n'apparaît que sur une annonce `REMOVED_BY_ADMIN`, et émet `restore`
  - le badge d'une annonce retirée porte le ton `danger`

- [ ] **Step 2 :** `pnpm vitest run tests/unit/features/bids/AnnouncementsTable.spec.ts` → FAIL.

- [ ] **Step 3 : Implémentation.** Ajouter `REMOVED_BY_ADMIN: 'danger'` à `annTone`, une colonne d'actions conditionnée par la permission, et réutiliser `ConfirmActionDialog` avec `require-reason` pour le retrait. Suivre le pattern d'état `pending` de `UserDetailPanel`. Câbler les emits dans `app/pages/colis/index.vue`.

- [ ] **Step 4 :** `pnpm vitest run tests/unit/features/bids/` → PASS.

- [ ] **Step 5 : Commit.**

---

### Task 10 : coupure de messagerie dans la fiche utilisateur

**Files:**
- Modify: `app/features/users/types/index.ts` (`messagingMutedUntil: string | null`)
- Modify: `app/features/users/services/usersService.ts`
- Modify: `app/features/users/composables/useUserDetail.ts`
- Modify: `app/features/users/components/UserDetailPanel.vue`
- Modify: `app/pages/users/index.vue`
- Test (modify): specs unitaires correspondantes

**Interfaces:**
- Produces :
  - `usersService.muteMessaging(id, durationHours: number | null, reason: string): Promise<AdminUserDetail>`
  - `usersService.unmuteMessaging(id): Promise<AdminUserDetail>`
  - `useUserDetail().muteMessaging(durationHours, reason)` et `.unmuteMessaging()`
  - emits `muteMessaging: [durationHours: number | null, reason: string]` et `unmuteMessaging: []`

**Contexte :** `UserDetailPanel` possède déjà le type `Pending = 'suspend' | 'ban' | 'suspendPublishing' | 'setCommission' | 'resetCommission' | null`, un `computed` `dialogConfig` qui fait un `switch` sur `pending` en renvoyant `{ title, message, confirmLabel, requireReason }`, et `confirmReason(reason)` qui route vers le bon emit. Un nouveau geste s'y greffe en ajoutant une valeur au type, un `case` au `switch`, un emit et un branchement.

**Décision de conception à respecter :** le choix de durée (24 h / 7 j / indéfini) se fait **dans le panneau**, pas dans la modale — aucun composant de sélection multi-options n'existe pour `ConfirmActionDialog`, et modifier son contrat d'emit toucherait tous ses appelants. On suit le motif déjà en place pour l'éditeur de commission : contrôle dans le panneau, puis confirmation avec motif.

- [ ] **Step 1 : Tests qui échouent :**
  - le sélecteur de durée et le bouton « Couper la messagerie » n'apparaissent qu'avec `USER_MESSAGE_MUTE`
  - confirmer émet `muteMessaging` avec la durée choisie et le motif
  - « Rétablir la messagerie » n'apparaît que si l'utilisateur est muté, et émet `unmuteMessaging`
  - l'échéance du mute est affichée quand elle existe

- [ ] **Step 2 :** lancer les specs → FAIL.
- [ ] **Step 3 : Implémentation** dans l'ordre : type → service → composable → composant → page.
- [ ] **Step 4 :** `pnpm vitest run tests/unit/features/users/` → PASS.
- [ ] **Step 5 : Commit.**

---

### Task 11 : E2E et vérification finale front

**Files:**
- Modify: `tests/e2e/users.spec.ts` et/ou `tests/e2e/colis.spec.ts`

- [ ] **Step 1 :** Ajouter un parcours E2E de retrait d'annonce et un de coupure de messagerie, sur le modèle de `tests/e2e/moderation.spec.ts` (mock `page.route` branché sur URL + méthode, session semée via `__yadonyAuthSeed`). **Attention** : `/users/{id}/mute-messaging` et `/users/{id}/suspend` partagent un préfixe — ordonner les branches du routeur de mock de la plus spécifique à la plus générale, un piège déjà rencontré sur ce fichier.
- [ ] **Step 2 :** `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm e2e` — tout vert, couverture au-dessus des seuils de `vitest.config.ts` (lines/functions/statements 90, branches 85).
- [ ] **Step 3 :** Ouvrir la PR front, en signalant la dépendance à la PR back **et** à la PR de règles Firestore.

---

## Ordre de livraison

1. PR `dony-back` (Tasks 1-5)
2. PR `dony-functions` (Task 6) — **doit être déployée avant ou avec** l'activation du geste de mute côté admin
3. PR `dony-admin` (Tasks 7-11)

Le retrait d'annonce ne dépend que du back. La coupure de messagerie n'est réellement bloquante qu'une fois les règles Firestore déployées : tant qu'elles ne le sont pas, le geste enregistre la sanction et supprime les notifications, mais n'empêche pas l'écriture du message.
