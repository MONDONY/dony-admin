# Lot D — Plateforme : broadcast, configuration et finances étendues — Plan d'implémentation

> **Pour les agents d'exécution :** SOUS-SKILL REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe case à cocher (`- [ ]`).

**Goal :** livrer le dernier lot de la complétion RBAC — envoi de notifications en masse (`NOTIFICATION_SEND`), configuration plateforme éditable à chaud (`CONFIG_MANAGE`) et trois vues financières en lecture seule (`PAYMENT_VIEW`) — pour qu'aucune permission déclarée ne reste morte.

**Architecture :** back Spring Boot — deux nouvelles permissions dans `AdminPermission`, deux nouvelles tables (`admin_broadcasts`, `platform_settings`), un exécuteur asynchrone borné dédié au broadcast, un cache Caffeine `platform-settings` invalidé à l'écriture qui devient la source des quatre valeurs déjà exposées par le `ConfigController` public (contrat de réponse inchangé), et trois requêtes paginées de lecture sur `wallet_accounts` / `mobile_money_payments` / `bids`. Front Nuxt — miroir strict des permissions dans le store `auth`, trois features (`broadcast`, `settings`, `finance`), deux pages neuves (`/communications`, `/parametres`) et trois onglets supplémentaires dans `/transactions`.

**Tech Stack :** Spring Boot 3.4 / Java 21 / PostgreSQL 16 / Flyway / Caffeine / JUnit 5 + Mockito + MockMvc + AssertJ + `zonky` EmbeddedPostgres — Nuxt 4 SSR / TypeScript strict / Pinia / Vitest + @vue/test-utils / Playwright.

**Spec :** `docs/superpowers/specs/2026-08-18-admin-rbac-completion-design.md` (section 6 « Lot D », section 7 « Règles transverses », section 8 « Critères d'acceptation »).
**Reconnaissance :** `/Users/aboubakardiakite/.claude/jobs/bd5ae304/tmp/recon-lot-d.md` — voir « Écarts tranchés » ci-dessous : plusieurs de ses conclusions ont été vérifiées fausses et sont corrigées ici.

---

## Global Constraints

Ces contraintes font partie des exigences de **chaque** tâche. Aucune tâche n'est terminée si l'une d'elles est violée.

### Dépôts et séquencement
- **Back :** `/Users/aboubakardiakite/Desktop/dony/dony-back`, branche `feature/admin-lot-b-moderation`, package racine `com.yadony.api`.
- **Front :** `/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin`, branche `feature/admin-lot-b-moderation`.
- **Jamais deux agents en parallèle sur le même dépôt.** Les tâches 1 à 10 (back) puis 11 à 17 (front) puis 18 (les deux) s'exécutent **strictement en séquence**.
- Les deux dépôts sont **vivants** : d'autres chantiers y committent. Avant chaque tâche : `git pull --ff-only` puis re-vérifier les numéros de migration et les décomptes de tests.

### TDD strict — non négociable
1. Écrire le test **avant** le code de production.
2. Le lancer et **constater l'échec réel** (copier le message d'erreur, ne pas le supposer).
3. Écrire l'implémentation minimale.
4. Le relancer et **constater le vert réel**.
5. Commiter.

### Non-régression
- Chaque tâche relance la suite **COMPLÈTE** de son dépôt et **rapporte le décompte réel**, pas « tout passe ».
- Back — baseline attendue autour de `Tests run: 3580, Failures: 0, Errors: 0, Skipped: 7`. **À reconfirmer à la tâche 1** : la branche a avancé (dernier commit vérifié `1168b430 feat(admin): détache RATING_DELETE et accorde le mute au support`).
- Front — baseline au démarrage du Lot D : **488 tests, 488 verts, 0 rouge** (commit `d233846`). Les deux rouges transitoires observés pendant la reconnaissance ont été corrigés : ils venaient du commit `bd4d03e` qui accordait `USER_MESSAGE_MUTE` à SUPPORT alors que deux tests utilisaient ce rôle comme substitut de « rôle sans cette permission ». Ils testent désormais le gating par un override explicite. Rien à reprendre à la tâche 11.
- Couverture front ≥ **90 lignes / 85 branches / 90 fonctions / 90 statements** (seuils réels de `vitest.config.ts`). `app/pages/**` et `app/components/ui/**` sont exclus de la couverture — les tests de pages servent le comportement, pas le seuil.
- Couverture back ≥ 90 % (`./mvnw test jacoco:report`).

### Règles back
- Erreurs **RFC 7807** via `GlobalExceptionHandler` : lever `YadonyBusinessException(HttpStatus, errorCode, title, detail)`. **Jamais** de `String`/`Map` brut renvoyé depuis un contrôleur.
- Tout endpoint `/admin/**` d'écriture porte `@PreAuthorize("hasRole('ADMIN') and hasAuthority('<PERMISSION>')")` **et** écrit une entrée `audit_log`.
- ⚠️ **Une `@PreAuthorize` de méthode REMPLACE celle de la classe, elle ne s'y ajoute pas.** Si vous en posez une sur une méthode, re-déclarez **toutes** les conditions. Et `hasRole('ADMIN')` ne discrimine personne (tout compte admin la porte, SUPPORT compris) : **seule l'authority filtre**.
- Migrations en **V(n+1) uniquement**. Dernière migration vérifiée le 2026-08-19 : **`V220__announcements_status_before_removal.sql`** → le lot pose **V221** et **V222**. **Reconfirmer par `ls src/main/resources/db/migration/ | sort -V | tail -3` au début de chaque tâche de migration.** Jamais de modification d'une migration existante.
- `audit_log` **immuable** (trigger PostgreSQL) : jamais d'UPDATE/DELETE. `entityType` et `action` sont des `VARCHAR(50)` libres, pas un enum — aucun enum à étendre.
- ⚠️ `AuditService.redact()` masque toute clé dont le nom finit par `name` ou contient `phone`/`email`/`address`/`city`/`label`/`lat`/`lng`/… **Aucune** clé de payload de ce lot ne doit tomber dedans (`title`, `body`, `targetType`, `recipientCount`, `key`, `oldValue`, `newValue`, `origin`, `destination` sont toutes sûres — `city` ne l'est pas, d'où `origin`/`destination`).
- Soft delete uniquement (`BaseEntity` + `@Where(clause = "deleted_at IS NULL")`). Exception connue : `wallet_transactions` n'étend pas `BaseEntity` et n'a pas de `deleted_at` — ne pas supposer le filtre.
- ⚠️ **Les tests tournent sur H2 avec `spring.flyway.enabled: false` et `ddl-auto: create`** (`src/test/resources/application-test.yml`) : le schéma des `@SpringBootTest` vient des entités JPA, **pas** des migrations. Seuls les `@DataJpaTest` avec `EmbeddedPostgres` (modèle : `src/test/java/com/yadony/api/admin/account/AdminUserRepositoryTest.java`) exécutent réellement Flyway et valident l'accord migration↔entité. **Chaque nouvelle table a donc son `@DataJpaTest` EmbeddedPostgres**, sinon un décalage migration/entité passe en prod sans qu'aucun test ne le voie.

### Règles front
- `definePageMeta({ middleware: 'admin-only', permission: '<PERMISSION>', pageTitle, pageSubtitle })` sur **chaque** page.
- `auth.can('<PERMISSION>')` sur **chaque** geste ; modale `ConfirmActionDialog` sur **chaque** geste destructif ou à effet de bord.
- Entrée de sidebar filtrée par `can()` dans `app/components/layout/AppSidebar.vue`.
- Le store `app/stores/auth.ts` est le **miroir exact** de l'enum back : `AdminPermission` (type), `ALL_PERMISSIONS` (tableau), `ROLE_PERMISSIONS.SUPPORT`. Toute divergence est un bug.
- Erreurs backend lues via `extractProblemMessage(e, fallback)` (`app/lib/problemDetail.ts`), jamais `e.message` brut.
- Pagination : composant partagé `app/components/ui/PaginationControls.vue`. **Il n'existe aucun composant `<Tabs>`** — les onglets se recodent à la main (`ref` + classes conditionnelles), comme dans `app/pages/transactions/index.vue`.
- **Libellés d'interface en français.**
- **Node ≥ 22.13** : préfixer toute commande front de
  `export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"`.

### Commits
- Messages en français, format Conventional Commits, **au nom du développeur**.
- **Jamais** de ligne `Co-Authored-By: Claude`.
- Ne jamais commiter directement sur `main` — la branche de travail est `feature/admin-lot-b-moderation`.

---

## Écarts tranchés (spec/recon vs code réel)

Chaque point ci-dessous a été vérifié par lecture directe du code le 2026-08-19. **Ils prévalent sur le rapport de reconnaissance.**

| # | Ce que dit la source | Ce que dit le code | Décision retenue |
|---|---|---|---|
| E1 | Recon §A6/§E7 : `@EnableAsync` sans exécuteur → `SimpleAsyncTaskExecutor`, un thread par appel, non borné | **Faux.** Spring Boot auto-configure `applicationTaskExecutor` (aliasé `taskExecutor`), core 8 / file illimitée. `@Async` sans qualifieur l'utilise déjà | Le risque réel est la **file qui gonfle** et le **volume d'appels FCM**, pas l'explosion de threads. On ajoute un exécuteur **dédié et borné** `broadcastExecutor` (T4), toujours **explicitement qualifié** : `@Async("broadcastExecutor")`. Sans qualifieur, Spring résout par le nom `taskExecutor` — les 25 listeners existants restent donc intacts |
| E2 | Recon §C2/§E13 : filtrer les commissions cash sur `commissionChargedVia = CASH` | **Faux.** `CommissionChargedVia` ne vaut que `WALLET` ou `CARD`. Le mode de paiement est `BidEntity.paymentMethod` (`PaymentMethod` = `STRIPE, CASH, WAVE, ORANGE_MONEY`) | Le filtre est `b.payment_method <> 'STRIPE' AND b.commission_status IS NOT NULL` (T10) |
| E3 | Spec §6 : `CORRIDOR` avec `origin?`, `destination?` optionnels | Aucun champ « corridor » en base ; `announcements.departure_city` / `arrival_city` sont `VARCHAR(100) NOT NULL`, les country codes sont nullables | **Les deux sont obligatoires** pour `CORRIDOR` (sinon 422). Appariement insensible à la casse sur les **villes**, jamais sur les codes pays |
| E4 | Spec §6 : table « seedée avec les valeurs actuelles des properties » | Une migration SQL ne voit **pas** `SMS_ENABLED` / `YADONY_COMMISSION_RATE` (variables d'environnement). Un seed en dur `sms_enabled=false` **couperait l'OTP SMS en prod** | La migration crée la table **vide** ; un `PlatformSettingsInitializer` (`ApplicationReadyEvent`) insère les clés manquantes **depuis les properties résolues à chaud** (T6). Bonus : c'est le seul mécanisme qui fonctionne aussi en test, Flyway y étant désactivé |
| E5 | Spec §6 : cache « sur le motif du cache `adminAuthz` » | `@Cacheable` sur une méthode appelée par une autre méthode **du même bean** est contourné (proxy) : chaque getter typé raterait le cache | Le `@Cacheable` vit sur un bean **dédié** `PlatformSettingsCache`, jamais sur `PlatformSettingsService` (T7) |
| E6 | Recon §B3 : ajouter le cache dans `CacheConfig` | `manager.setCacheNames(...)` s'exécute **après** `registerCustomCache(...)` et fait `cacheMap.keySet().retainAll(customCacheNames)` — les caches personnalisés survivent, mais la création dynamique est ensuite désactivée | `platform-settings` s'ajoute via **`registerCustomCache`** (TTL propre de 30 s), **pas** dans la liste `setCacheNames` (qui appliquerait le TTL par défaut de 5 min) |
| E7 | Spec initiale : `urgency_threshold_hours` | `yadony.urgency.threshold-days`, défaut `3`, DTO `UrgencyThresholdResponse(Integer thresholdDays)` | Clé = **`urgency_threshold_days`**, unité **JOURS**, contrat JSON `{"thresholdDays": 3}` inchangé |
| E8 | Spec §6 : bornes « commission 0–30 %, plafond ≤ 500 € » ; rien sur le seuil d'urgence | — | Bornes retenues : `commission_rate` ∈ [0, 0.30] (**taux**, pas pourcentage : 30 % = `0.30`), `reimbursement_cap_eur` ∈ ]0, 500], `urgency_threshold_days` ∈ [1, 30] (**arbitrage de ce plan**, à confirmer par le propriétaire du produit) |
| E9 | Règle transverse : `hasRole('ADMIN') and hasAuthority(...)` | `AdminPaymentController` et `AdminUserController` portent des `@PreAuthorize("hasAuthority('X')")` **nues** sur leurs méthodes, qui remplacent le `hasRole('ADMIN')` de classe | Les contrôleurs neufs du Lot D portent l'expression **complète** sur chaque méthode (modèle Lot B/C). Les contrôleurs existants sont **hors périmètre** mais signalés : leur `hasRole('ADMIN')` de classe est aujourd'hui inopérant sur ces méthodes |
| E10 | Spec §6 : ne pas exposer le téléphone mobile money en clair | `mobile_money_payments` porte aussi `payment_link` (**URL de paiement vivante**) | Le DTO admin masque le téléphone **et n'expose pas du tout `payment_link`** |
| E11 | Recon §A5 : ciblage par rôle cassé (V193, tous les comptes portent SENDER+TRAVELER) | **Vrai, confirmé** (`AuthService:89,399`) | Ciblage **comportemental** uniquement, jamais sur `user_roles` |
| E12 | Recon : 26 permissions | **27** depuis `1168b430` (ajout de `RATING_DELETE`) | Le Lot D porte l'enum à **29**. Aucun test back ne code le nombre en dur (`AdminPermissionsTest` utilise `values().length`) ; côté front `tests/unit/stores/auth.spec.ts` code `toHaveLength(27)` → à passer à 29 (T11) |
| E13 | — | `FcmService.sendToUser` interroge `NotificationPrefsService.isAllowed(userId, type)`, qui **autorise par défaut tout type inconnu** | Le type de broadcast est **`ADMIN_BROADCAST`**, volontairement **non mappé** à une préférence : une annonce plateforme est opérationnelle, pas promotionnelle. Ce choix est documenté en Javadoc pour qu'il reste délibéré |
| E14 | — | `SmsService.isEnabled()` est lu par `SmsOtpService:76,105` et `SmsOtpConfigurationGuard` | Basculer `sms_enabled` **coupe la connexion par OTP SMS**. D'où la double confirmation par saisie côté front et l'avertissement nommant explicitement cette conséquence |

---

## Structure des fichiers

### Back — `dony-back`

| Fichier | Responsabilité |
|---|---|
| `src/main/java/com/yadony/api/admin/account/AdminPermission.java` | *(modifié)* + `NOTIFICATION_SEND`, `CONFIG_MANAGE` |
| `src/main/resources/db/migration/V221__admin_broadcasts.sql` | table d'historique des broadcasts |
| `src/main/java/com/yadony/api/admin/broadcast/BroadcastTargetType.java` | `ALL, SENDERS, TRAVELERS, CORRIDOR, USER` |
| `src/main/java/com/yadony/api/admin/broadcast/BroadcastTarget.java` | record de ciblage validé |
| `src/main/java/com/yadony/api/admin/broadcast/AdminBroadcastEntity.java` | ligne d'historique |
| `src/main/java/com/yadony/api/admin/broadcast/AdminBroadcastRepository.java` | historique paginé |
| `src/main/java/com/yadony/api/admin/broadcast/BroadcastAudienceRepository.java` | requêtes de ciblage comportemental |
| `src/main/java/com/yadony/api/admin/broadcast/BroadcastAudienceService.java` | comptage + pagination des destinataires |
| `src/main/java/com/yadony/api/admin/broadcast/BroadcastExecutorConfig.java` | `broadcastExecutor` borné |
| `src/main/java/com/yadony/api/admin/broadcast/BroadcastService.java` | envoi asynchrone paginé |
| `src/main/java/com/yadony/api/admin/AdminBroadcastController.java` | 3 endpoints + audit |
| `src/main/resources/db/migration/V222__platform_settings.sql` | table clé/valeur |
| `src/main/java/com/yadony/api/config/PlatformSettingKey.java` | 4 clés typées + bornes |
| `src/main/java/com/yadony/api/config/PlatformSettingEntity.java` | ligne clé/valeur |
| `src/main/java/com/yadony/api/config/PlatformSettingRepository.java` | accès table |
| `src/main/java/com/yadony/api/config/PlatformSettingsInitializer.java` | seed des clés manquantes depuis les properties |
| `src/main/java/com/yadony/api/config/PlatformSettingsCache.java` | `@Cacheable` / `@CacheEvict` isolés |
| `src/main/java/com/yadony/api/config/PlatformSettingsService.java` | getters typés + écriture validée + audit |
| `src/main/java/com/yadony/api/config/CacheConfig.java` | *(modifié)* cache `platform-settings` |
| `src/main/java/com/yadony/api/config/ConfigController.java` | *(modifié)* même contrat, nouvelle source |
| `src/main/java/com/yadony/api/common/CommissionRateResolver.java` | *(modifié)* `globalRate()` lit la table |
| `src/main/java/com/yadony/api/notifications/SmsService.java` | *(modifié)* `isEnabled()`/`send()` lisent la table |
| `src/main/java/com/yadony/api/admin/AdminSettingsController.java` | `GET`/`PUT /admin/settings` |
| `src/main/java/com/yadony/api/payments/wallet/WalletAccountRepository.java` | *(modifié)* `findAdminFiltered` |
| `src/main/java/com/yadony/api/payments/mobilemoney/MobileMoneyPaymentRepository.java` | *(modifié)* `findAdminFiltered` |
| `src/main/java/com/yadony/api/matching/BidRepository.java` | *(modifié)* `findAdminCashCommissions` |
| `src/main/java/com/yadony/api/admin/AdminFinanceController.java` | 3 listes en lecture seule |
| `src/main/java/com/yadony/api/admin/dto/*.java` | DTO des trois sujets |

### Front — `yadony-admin`

| Fichier | Responsabilité |
|---|---|
| `app/stores/auth.ts` | *(modifié)* miroir 29 permissions |
| `app/components/layout/AppSidebar.vue` | *(modifié)* entrées « Communications » et « Paramètres » |
| `app/features/broadcast/{types,services,composables,components}` | rédaction, aperçu, historique |
| `app/pages/communications/index.vue` | page « Communications » |
| `app/features/settings/{types,services,composables,components}` | formulaire de configuration |
| `app/pages/parametres/index.vue` | page « Paramètres plateforme » |
| `app/features/finance/{types,services,composables,components}` | wallets / mobile money / commissions cash |
| `app/pages/transactions/index.vue` | *(modifié)* 3 onglets supplémentaires |

---

## Tâches

---

### Task 1 : Ligne de base back + permissions `NOTIFICATION_SEND` et `CONFIG_MANAGE`

**Dépôt :** `dony-back`

**Files:**
- Modify: `src/main/java/com/yadony/api/admin/account/AdminPermission.java`
- Test: `src/test/java/com/yadony/api/admin/account/AdminPermissionsLotDTest.java` *(create)*

**Interfaces:**
- Consumes: `AdminPermissions.effective(AdminRole role, Map<String, Boolean> overrides) -> Set<AdminPermission>` (existant), `AdminRole.permissions() -> Set<AdminPermission>` (existant).
- Produces: `AdminPermission.NOTIFICATION_SEND`, `AdminPermission.CONFIG_MANAGE` — consommées par les tâches 2 à 9 et par le miroir front (T11). `AdminRole.ADMIN` les reçoit automatiquement (`EnumSet.complementOf(EnumSet.of(ADMIN_MANAGE))`), `SUPPORT` non (liste explicite, non modifiée).

- [ ] **Étape 1 : Enregistrer la ligne de base réelle**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git pull --ff-only
git log --oneline -1
ls src/main/resources/db/migration/ | sort -V | tail -3
./mvnw -q test 2>&1 | tail -20
```

Noter : le SHA de HEAD, la dernière migration (attendu `V220__announcements_status_before_removal.sql`) et la ligne exacte `Tests run: … , Failures: … , Errors: … , Skipped: …`. **Si des tests sont déjà rouges, s'arrêter et le signaler — ne rien construire sur une base rouge.**

- [ ] **Étape 2 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/admin/account/AdminPermissionsLotDTest.java` :

```java
package com.yadony.api.admin.account;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lot D — deux permissions neuves pour la plateforme :
 *
 * <ul>
 *   <li>{@code NOTIFICATION_SEND} : envoi d'un broadcast de notifications.</li>
 *   <li>{@code CONFIG_MANAGE} : modification des parametres plateforme.</li>
 * </ul>
 *
 * <p>Aucune des deux ne va au support : couper les SMS, c'est couper la connexion par
 * OTP ({@code SmsOtpService:76,105}), et ecrire a tous les utilisateurs n'est pas un
 * geste de support. L'escalade reste possible au cas par cas via
 * {@code permissionOverrides}.
 */
class AdminPermissionsLotDTest {

    @Test
    void adminAndSuperAdmin_receiveBothNewPermissions() {
        Set<AdminPermission> admin = AdminPermissions.effective(AdminRole.ADMIN, Map.of());
        Set<AdminPermission> superAdmin = AdminPermissions.effective(AdminRole.SUPER_ADMIN, Map.of());

        assertThat(admin).contains(AdminPermission.NOTIFICATION_SEND, AdminPermission.CONFIG_MANAGE);
        assertThat(superAdmin).contains(AdminPermission.NOTIFICATION_SEND, AdminPermission.CONFIG_MANAGE);
    }

    @Test
    void support_receivesNeitherNewPermission() {
        Set<AdminPermission> support = AdminPermissions.effective(AdminRole.SUPPORT, Map.of());

        assertThat(support).doesNotContain(
                AdminPermission.NOTIFICATION_SEND, AdminPermission.CONFIG_MANAGE);
    }

    @Test
    void support_canReceiveConfigManageViaExplicitOverride() {
        Set<AdminPermission> support = AdminPermissions.effective(
                AdminRole.SUPPORT, Map.of("CONFIG_MANAGE", true));

        assertThat(support).contains(AdminPermission.CONFIG_MANAGE);
        assertThat(support).doesNotContain(AdminPermission.NOTIFICATION_SEND);
    }

    @Test
    void enumHolds29Permissions() {
        assertThat(AdminPermission.values()).hasSize(29);
    }
}
```

- [ ] **Étape 3 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminPermissionsLotDTest
```

Attendu : **échec de compilation** — `cannot find symbol: variable NOTIFICATION_SEND`.

- [ ] **Étape 4 : Ajouter les deux valeurs à l'enum**

Dans `src/main/java/com/yadony/api/admin/account/AdminPermission.java`, corriger le Javadoc de tête :

```java
/**
 * Admin permissions enum (Task 2).
 * 29 granular permissions for role-based access control.
 */
```

puis insérer ce bloc juste avant la ligne `// Content & operations` :

```java
    /**
     * Lot D — envoi d'un broadcast de notifications (push + in-app) a un segment
     * d'utilisateurs. Jamais accordee au support : un envoi de masse est irreversible.
     */
    NOTIFICATION_SEND,

    /**
     * Lot D — modification des parametres plateforme (commission globale, seuil
     * d'urgence, plafond de remboursement, activation des SMS). Jamais accordee au
     * support : couper les SMS coupe aussi l'authentification par OTP.
     */
    CONFIG_MANAGE,

    // Content & operations
```

- [ ] **Étape 5 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminPermissionsLotDTest
```

Attendu : `Tests run: 4, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 6 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline de l'étape 1 **+ 4** tests, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 7 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/account/AdminPermission.java \
        src/test/java/com/yadony/api/admin/account/AdminPermissionsLotDTest.java
git commit -m "feat(admin): permissions NOTIFICATION_SEND et CONFIG_MANAGE"
```

---

### Task 2 : Table `admin_broadcasts`, entité et repository

**Dépôt :** `dony-back`

**Files:**
- Create: `src/main/resources/db/migration/V221__admin_broadcasts.sql`
- Create: `src/main/java/com/yadony/api/admin/broadcast/BroadcastTargetType.java`
- Create: `src/main/java/com/yadony/api/admin/broadcast/AdminBroadcastEntity.java`
- Create: `src/main/java/com/yadony/api/admin/broadcast/AdminBroadcastRepository.java`
- Test: `src/test/java/com/yadony/api/admin/broadcast/AdminBroadcastRepositoryTest.java`

**Interfaces:**
- Consumes: `com.yadony.api.common.BaseEntity` (UUID `id`, `createdAt`, `updatedAt`, `deletedAt`, `softDelete()`).
- Produces:
  - `enum BroadcastTargetType { ALL, SENDERS, TRAVELERS, CORRIDOR, USER }`
  - `AdminBroadcastEntity(String title, String body, BroadcastTargetType targetType, String targetOrigin, String targetDestination, UUID targetUserId, int recipientCount, UUID adminId)` + getters `getTitle/getBody/getTargetType/getTargetOrigin/getTargetDestination/getTargetUserId/getRecipientCount/getAdminId`.
  - `AdminBroadcastRepository extends JpaRepository<AdminBroadcastEntity, UUID>` avec `Page<AdminBroadcastEntity> findAllByOrderByCreatedAtDesc(Pageable pageable)`.

- [ ] **Étape 1 : Reconfirmer le numéro de migration**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git pull --ff-only
ls src/main/resources/db/migration/ | sort -V | tail -3
```

Attendu : `V220__announcements_status_before_removal.sql` en dernier. **Si un `V221` existe déjà, prendre le premier numéro libre et le répercuter ici et en tâche 6.**

- [ ] **Étape 2 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/admin/broadcast/AdminBroadcastRepositoryTest.java`. Ce test tourne sur **EmbeddedPostgres avec Flyway actif et `ddl-auto: validate`** : c'est lui qui prouve que la migration et l'entité s'accordent (les `@SpringBootTest` du projet tournent sur H2 sans Flyway et ne le verraient pas).

```java
package com.yadony.api.admin.broadcast;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lot D — l'entite doit s'accorder avec V221 : Flyway est actif et {@code ddl-auto=validate},
 * donc tout ecart colonne/type fait echouer le demarrage du contexte, pas une assertion.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class AdminBroadcastRepositoryTest {

    private static EmbeddedPostgres postgres;

    @BeforeAll
    static void startPostgres() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
    }

    @AfterAll
    static void stopPostgres() throws Exception {
        if (postgres != null) {
            postgres.close();
        }
    }

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.flyway.enabled", () -> true);
    }

    @Autowired
    private AdminBroadcastRepository repository;

    @Test
    void persistsAllTargetingColumns() {
        UUID adminId = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();

        AdminBroadcastEntity saved = repository.saveAndFlush(new AdminBroadcastEntity(
                "Maintenance", "Service indisponible ce soir de 22h a 23h.",
                BroadcastTargetType.CORRIDOR, "Paris", "Dakar", targetUserId, 42, adminId));

        AdminBroadcastEntity reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getTitle()).isEqualTo("Maintenance");
        assertThat(reloaded.getBody()).isEqualTo("Service indisponible ce soir de 22h a 23h.");
        assertThat(reloaded.getTargetType()).isEqualTo(BroadcastTargetType.CORRIDOR);
        assertThat(reloaded.getTargetOrigin()).isEqualTo("Paris");
        assertThat(reloaded.getTargetDestination()).isEqualTo("Dakar");
        assertThat(reloaded.getTargetUserId()).isEqualTo(targetUserId);
        assertThat(reloaded.getRecipientCount()).isEqualTo(42);
        assertThat(reloaded.getAdminId()).isEqualTo(adminId);
        assertThat(reloaded.getCreatedAt()).isNotNull();
    }

    @Test
    void historyIsReturnedMostRecentFirst() {
        UUID adminId = UUID.randomUUID();
        repository.saveAndFlush(new AdminBroadcastEntity(
                "Ancien", "corps", BroadcastTargetType.ALL, null, null, null, 1, adminId));
        repository.saveAndFlush(new AdminBroadcastEntity(
                "Recent", "corps", BroadcastTargetType.SENDERS, null, null, null, 2, adminId));

        var page = repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent().get(0).getRecipientCount()).isEqualTo(2);
    }

    @Test
    void softDeletedRowsAreHidden() {
        AdminBroadcastEntity saved = repository.saveAndFlush(new AdminBroadcastEntity(
                "A supprimer", "corps", BroadcastTargetType.ALL, null, null, null, 0, UUID.randomUUID()));
        saved.softDelete();
        repository.saveAndFlush(saved);

        assertThat(repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 20)).getTotalElements())
                .isZero();
    }
}
```

- [ ] **Étape 3 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminBroadcastRepositoryTest
```

Attendu : **échec de compilation** — `package com.yadony.api.admin.broadcast does not exist`.

- [ ] **Étape 4 : Écrire la migration**

Créer `src/main/resources/db/migration/V221__admin_broadcasts.sql` :

```sql
-- Lot D — historique des broadcasts de notifications envoyes par un administrateur.
--
-- Table d'AUDIT FONCTIONNEL, distincte d'audit_log : elle porte le corps complet du
-- message et le compteur de destinataires, que la page « Communications » relit. Les
-- colonnes de ciblage sont a plat plutot qu'en jsonb : quatre colonnes suffisent, et
-- un filtre SQL sur target_type reste lisible.
CREATE TABLE admin_broadcasts (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(120)  NOT NULL,
    body                VARCHAR(500)  NOT NULL,
    -- ALL | SENDERS | TRAVELERS | CORRIDOR | USER (BroadcastTargetType)
    target_type         VARCHAR(20)   NOT NULL,
    -- Ville de depart / d'arrivee, renseignees uniquement pour target_type = 'CORRIDOR'.
    -- Il n'existe AUCUNE notion de corridor sur users : le ciblage passe par les
    -- annonces et les bids de l'utilisateur, apparies sur la ville.
    target_origin       VARCHAR(100),
    target_destination  VARCHAR(100),
    -- Renseigne uniquement pour target_type = 'USER'.
    target_user_id      UUID,
    recipient_count     INTEGER       NOT NULL DEFAULT 0,
    admin_id            UUID          NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_admin_broadcasts_created_at ON admin_broadcasts (created_at DESC);

COMMENT ON TABLE admin_broadcasts IS
    'Historique des envois de notifications en masse declenches depuis le back-office (Lot D).';
COMMENT ON COLUMN admin_broadcasts.recipient_count IS
    'Nombre de destinataires resolus au moment de l''envoi — fige, jamais recalcule.';
```

- [ ] **Étape 5 : Écrire l'enum, l'entité et le repository**

Créer `src/main/java/com/yadony/api/admin/broadcast/BroadcastTargetType.java` :

```java
package com.yadony.api.admin.broadcast;

/**
 * Segments de destinataires d'un broadcast.
 *
 * <p>⚠️ Le ciblage est <b>comportemental</b>, jamais fonde sur {@code user_roles} :
 * depuis la migration {@code V193}, tout utilisateur porte simultanement
 * {@code SENDER} et {@code TRAVELER} ({@code AuthService:89,399}). Un filtre par role
 * enverrait donc a 100 % des comptes dans les deux cas, silencieusement.
 */
public enum BroadcastTargetType {
    /** Tous les comptes actifs. */
    ALL,
    /** A cree au moins un bid. */
    SENDERS,
    /** A publie au moins une annonce. */
    TRAVELERS,
    /** A publie une annonce ou un bid sur le corridor (ville de depart -> ville d'arrivee). */
    CORRIDOR,
    /** Un utilisateur designe. */
    USER
}
```

Créer `src/main/java/com/yadony/api/admin/broadcast/AdminBroadcastEntity.java` :

```java
package com.yadony.api.admin.broadcast;

import com.yadony.api.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.Where;

import java.util.UUID;

/** Lot D — une ligne d'historique par broadcast envoye. Jamais modifiee apres creation. */
@Entity
@Table(name = "admin_broadcasts")
@Where(clause = "deleted_at IS NULL")
public class AdminBroadcastEntity extends BaseEntity {

    @Column(name = "title", nullable = false, length = 120)
    private String title;

    @Column(name = "body", nullable = false, length = 500)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private BroadcastTargetType targetType;

    @Column(name = "target_origin", length = 100)
    private String targetOrigin;

    @Column(name = "target_destination", length = 100)
    private String targetDestination;

    @Column(name = "target_user_id")
    private UUID targetUserId;

    @Column(name = "recipient_count", nullable = false)
    private int recipientCount;

    @Column(name = "admin_id", nullable = false)
    private UUID adminId;

    protected AdminBroadcastEntity() {
        // Hibernate
    }

    public AdminBroadcastEntity(String title, String body, BroadcastTargetType targetType,
                                String targetOrigin, String targetDestination, UUID targetUserId,
                                int recipientCount, UUID adminId) {
        this.title = title;
        this.body = body;
        this.targetType = targetType;
        this.targetOrigin = targetOrigin;
        this.targetDestination = targetDestination;
        this.targetUserId = targetUserId;
        this.recipientCount = recipientCount;
        this.adminId = adminId;
    }

    public String getTitle() { return title; }
    public String getBody() { return body; }
    public BroadcastTargetType getTargetType() { return targetType; }
    public String getTargetOrigin() { return targetOrigin; }
    public String getTargetDestination() { return targetDestination; }
    public UUID getTargetUserId() { return targetUserId; }
    public int getRecipientCount() { return recipientCount; }
    public UUID getAdminId() { return adminId; }
}
```

Créer `src/main/java/com/yadony/api/admin/broadcast/AdminBroadcastRepository.java` :

```java
package com.yadony.api.admin.broadcast;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AdminBroadcastRepository extends JpaRepository<AdminBroadcastEntity, UUID> {

    /** Historique, le plus recent d'abord. Le @Where de l'entite ecarte les lignes supprimees. */
    Page<AdminBroadcastEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
```

- [ ] **Étape 6 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminBroadcastRepositoryTest
```

Attendu : `Tests run: 3, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 7 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T1 **+ 3**, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 8 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/resources/db/migration/V221__admin_broadcasts.sql \
        src/main/java/com/yadony/api/admin/broadcast/ \
        src/test/java/com/yadony/api/admin/broadcast/
git commit -m "feat(admin): table d'historique des broadcasts de notifications"
```

---

### Task 3 : Ciblage comportemental des destinataires

**Dépôt :** `dony-back`

**Files:**
- Create: `src/main/java/com/yadony/api/admin/broadcast/BroadcastTarget.java`
- Create: `src/main/java/com/yadony/api/admin/broadcast/BroadcastAudienceRepository.java`
- Create: `src/main/java/com/yadony/api/admin/broadcast/BroadcastAudienceService.java`
- Test: `src/test/java/com/yadony/api/admin/broadcast/BroadcastAudienceServiceIT.java`

**Interfaces:**
- Consumes: `BroadcastTargetType` (T2) ; `com.yadony.api.common.YadonyBusinessException(HttpStatus, String errorCode, String title, String detail)` ; tables `users`, `bids`, `announcements`.
- Produces:
  - `record BroadcastTarget(BroadcastTargetType type, String origin, String destination, UUID userId)` — constructeur compact validant et normalisant (trim, mise à `null` des champs hors sujet), lève `YadonyBusinessException` 422 sinon.
  - `BroadcastAudienceService.count(BroadcastTarget target) -> long`
  - `BroadcastAudienceService.page(BroadcastTarget target, int pageNumber) -> Page<UUID>`
  - `BroadcastAudienceService.PAGE_SIZE` = `200` (constante publique, réutilisée par `BroadcastService` en T4).

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/admin/broadcast/BroadcastAudienceServiceIT.java`. Le profil `e2e` fait tourner un vrai PostgreSQL avec Flyway (`src/test/resources/application-e2e.yml`) — indispensable ici, le SQL est natif. Modèle repris de `src/test/java/com/yadony/api/payments/wallet/WalletServiceIT.java`.

```java
package com.yadony.api.admin.broadcast;

import com.yadony.api.auth.KycStatus;
import com.yadony.api.auth.Role;
import com.yadony.api.auth.StripeAccountStatus;
import com.yadony.api.auth.UserEntity;
import com.yadony.api.auth.UserRepository;
import com.yadony.api.auth.UserStatus;
import com.yadony.api.common.YadonyBusinessException;
import com.yadony.api.matching.AnnouncementEntity;
import com.yadony.api.matching.AnnouncementRepository;
import com.yadony.api.matching.BidEntity;
import com.yadony.api.matching.BidRepository;
import com.yadony.api.matching.TransportMode;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Lot D — le ciblage doit etre COMPORTEMENTAL. Le test le prouve en creant un compte
 * qui n'a ni bid ni annonce : il doit sortir de SENDERS et de TRAVELERS, alors qu'un
 * ciblage par role l'aurait ramene dans les deux (V193 donne SENDER+TRAVELER a tous).
 */
@SpringBootTest
@ActiveProfiles("e2e")
@Transactional
class BroadcastAudienceServiceIT {

    private static EmbeddedPostgres postgres;

    @BeforeAll
    static void startPostgres() throws Exception {
        postgres = EmbeddedPostgres.builder().start();
    }

    @AfterAll
    static void stopPostgres() throws Exception {
        if (postgres != null) {
            postgres.close();
        }
    }

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
    }

    @Autowired BroadcastAudienceService service;
    @Autowired UserRepository userRepository;
    @Autowired AnnouncementRepository announcementRepository;
    @Autowired BidRepository bidRepository;

    private UUID persistUser(UserStatus status) {
        UserEntity user = new UserEntity();
        user.setFirebaseUid("broadcast-audience-" + UUID.randomUUID());
        user.setStatus(status);
        user.setKycStatus(KycStatus.PENDING);
        user.setRoles(Set.of(Role.SENDER, Role.TRAVELER));
        user.setStripeAccountStatus(StripeAccountStatus.NOT_CREATED);
        return userRepository.saveAndFlush(user).getId();
    }

    private UUID persistAnnouncement(UUID travelerId, String departureCity, String arrivalCity) {
        AnnouncementEntity a = new AnnouncementEntity();
        a.setTravelerId(travelerId);
        a.setDepartureCity(departureCity);
        a.setArrivalCity(arrivalCity);
        a.setDepartureDate(LocalDate.now().plusDays(10));
        a.setTransportMode(TransportMode.PLANE);
        a.setPickupAddressLabel("12 rue de Rivoli");
        a.setPickupLat(new BigDecimal("48.8566"));
        a.setPickupLng(new BigDecimal("2.3522"));
        a.setDeliveryAddressLabel("Avenue Bourguiba");
        a.setDeliveryLat(new BigDecimal("14.6928"));
        a.setDeliveryLng(new BigDecimal("-17.4467"));
        a.setAvailableKg(new BigDecimal("20"));
        a.setTotalKg(new BigDecimal("20"));
        a.setPricePerKg(new BigDecimal("12"));
        return announcementRepository.saveAndFlush(a).getId();
    }

    private void persistBid(UUID announcementId, UUID senderId) {
        BidEntity bid = new BidEntity();
        bid.setAnnouncementId(announcementId);
        bid.setSenderId(senderId);
        bid.setWeightKg(new BigDecimal("5"));
        bidRepository.saveAndFlush(bid);
    }

    @Test
    void sendersAndTravelersAreBehavioural_notRoleBased() {
        UUID traveler = persistUser(UserStatus.ACTIVE);
        UUID sender = persistUser(UserStatus.ACTIVE);
        UUID idle = persistUser(UserStatus.ACTIVE);
        UUID announcement = persistAnnouncement(traveler, "Paris", "Dakar");
        persistBid(announcement, sender);

        var travelers = service.page(
                new BroadcastTarget(BroadcastTargetType.TRAVELERS, null, null, null), 0);
        var senders = service.page(
                new BroadcastTarget(BroadcastTargetType.SENDERS, null, null, null), 0);

        assertThat(travelers.getContent()).contains(traveler).doesNotContain(sender, idle);
        assertThat(senders.getContent()).contains(sender).doesNotContain(traveler, idle);
    }

    @Test
    void allTargetsOnlyActiveAccounts() {
        UUID active = persistUser(UserStatus.ACTIVE);
        UUID banned = persistUser(UserStatus.BANNED);

        var all = service.page(new BroadcastTarget(BroadcastTargetType.ALL, null, null, null), 0);

        assertThat(all.getContent()).contains(active).doesNotContain(banned);
    }

    @Test
    void corridorMatchesTravelerAndSenderOnBothCities_caseInsensitively() {
        UUID traveler = persistUser(UserStatus.ACTIVE);
        UUID sender = persistUser(UserStatus.ACTIVE);
        UUID otherCorridor = persistUser(UserStatus.ACTIVE);
        persistBid(persistAnnouncement(traveler, "Paris", "Dakar"), sender);
        persistAnnouncement(otherCorridor, "Lyon", "Abidjan");

        var page = service.page(
                new BroadcastTarget(BroadcastTargetType.CORRIDOR, "paris", "DAKAR", null), 0);

        assertThat(page.getContent()).contains(traveler, sender).doesNotContain(otherCorridor);
    }

    @Test
    void userTargetReturnsExactlyThatAccount() {
        UUID target = persistUser(UserStatus.ACTIVE);
        persistUser(UserStatus.ACTIVE);

        var page = service.page(
                new BroadcastTarget(BroadcastTargetType.USER, null, null, target), 0);

        assertThat(page.getContent()).containsExactly(target);
    }

    @Test
    void countMatchesTotalElements() {
        persistUser(UserStatus.ACTIVE);
        BroadcastTarget target = new BroadcastTarget(BroadcastTargetType.ALL, null, null, null);

        assertThat(service.count(target))
                .isEqualTo(service.page(target, 0).getTotalElements());
    }

    @Test
    void corridorWithoutBothCitiesIsRejected() {
        assertThatThrownBy(() ->
                new BroadcastTarget(BroadcastTargetType.CORRIDOR, "Paris", "  ", null))
                .isInstanceOf(YadonyBusinessException.class)
                .hasMessageContaining("ville de depart");
    }

    @Test
    void userTargetWithoutUserIdIsRejected() {
        assertThatThrownBy(() ->
                new BroadcastTarget(BroadcastTargetType.USER, null, null, null))
                .isInstanceOf(YadonyBusinessException.class)
                .hasMessageContaining("identifiant d'utilisateur");
    }
}
```

- [ ] **Étape 2 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=BroadcastAudienceServiceIT
```

Attendu : **échec de compilation** — `cannot find symbol: class BroadcastTarget`.

- [ ] **Étape 3 : Écrire le record de ciblage**

Créer `src/main/java/com/yadony/api/admin/broadcast/BroadcastTarget.java` :

```java
package com.yadony.api.admin.broadcast;

import com.yadony.api.common.YadonyBusinessException;
import org.springframework.http.HttpStatus;

import java.util.UUID;

/**
 * Ciblage valide et normalise d'un broadcast.
 *
 * <p>La validation vit dans le constructeur compact : aucun chemin ne peut fabriquer un
 * ciblage incoherent, ni depuis le contrôleur, ni depuis un test. Les champs hors sujet
 * sont remis a {@code null} pour que la ligne d'historique ne conserve pas une ville
 * saisie puis abandonnee.
 *
 * <p>⚠️ {@code CORRIDOR} exige les DEUX villes. Un demi-corridor est ambigu et les codes
 * pays, seule alternative, sont nullables en base — les villes sont les seules colonnes
 * fiables ({@code announcements.departure_city} / {@code arrival_city}, VARCHAR(100) NOT NULL).
 */
public record BroadcastTarget(BroadcastTargetType type, String origin, String destination, UUID userId) {

    public BroadcastTarget {
        if (type == null) {
            throw invalid("Le type de ciblage est obligatoire");
        }
        if (type == BroadcastTargetType.CORRIDOR) {
            if (isBlank(origin) || isBlank(destination)) {
                throw invalid("Un ciblage par corridor exige une ville de depart ET une ville d'arrivee");
            }
            origin = origin.trim();
            destination = destination.trim();
        } else {
            origin = null;
            destination = null;
        }
        if (type == BroadcastTargetType.USER) {
            if (userId == null) {
                throw invalid("Un ciblage par utilisateur exige un identifiant d'utilisateur");
            }
        } else {
            userId = null;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static YadonyBusinessException invalid(String detail) {
        return new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                "broadcast-target-invalid", "Unprocessable Entity", detail);
    }
}
```

- [ ] **Étape 4 : Écrire le repository de ciblage**

Créer `src/main/java/com/yadony/api/admin/broadcast/BroadcastAudienceRepository.java` :

```java
package com.yadony.api.admin.broadcast;

import com.yadony.api.auth.UserEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

/**
 * Resolution des destinataires d'un broadcast. Requetes natives : elles ne renvoient que
 * des identifiants, jamais des entites — charger 50 000 {@code UserEntity} pour lire leur
 * id saturerait le contexte de persistance.
 *
 * <p>Le pilote PostgreSQL comme H2 mappent une colonne {@code uuid} sur
 * {@code java.util.UUID}, la projection {@code Page<UUID>} est donc directe.
 */
public interface BroadcastAudienceRepository extends Repository<UserEntity, UUID> {

    String ACTIVE = "u.deleted_at IS NULL AND u.status = 'ACTIVE'";

    @Query(value = "SELECT u.id FROM users u WHERE " + ACTIVE + " ORDER BY u.created_at",
           countQuery = "SELECT COUNT(*) FROM users u WHERE " + ACTIVE,
           nativeQuery = true)
    Page<UUID> findActiveIds(Pageable pageable);

    /** Expediteur = a cree au moins un bid. Jamais « porte le role SENDER » (cf. V193). */
    @Query(value = "SELECT u.id FROM users u WHERE " + ACTIVE
            + " AND EXISTS (SELECT 1 FROM bids b WHERE b.sender_id = u.id AND b.deleted_at IS NULL)"
            + " ORDER BY u.created_at",
           countQuery = "SELECT COUNT(*) FROM users u WHERE " + ACTIVE
            + " AND EXISTS (SELECT 1 FROM bids b WHERE b.sender_id = u.id AND b.deleted_at IS NULL)",
           nativeQuery = true)
    Page<UUID> findActiveSenderIds(Pageable pageable);

    /** Voyageur = a publie au moins une annonce. Jamais « porte le role TRAVELER » (cf. V193). */
    @Query(value = "SELECT u.id FROM users u WHERE " + ACTIVE
            + " AND EXISTS (SELECT 1 FROM announcements a WHERE a.traveler_id = u.id AND a.deleted_at IS NULL)"
            + " ORDER BY u.created_at",
           countQuery = "SELECT COUNT(*) FROM users u WHERE " + ACTIVE
            + " AND EXISTS (SELECT 1 FROM announcements a WHERE a.traveler_id = u.id AND a.deleted_at IS NULL)",
           nativeQuery = true)
    Page<UUID> findActiveTravelerIds(Pageable pageable);

    String CORRIDOR_PREDICATE = """
             AND (EXISTS (SELECT 1 FROM announcements a
                          WHERE a.traveler_id = u.id AND a.deleted_at IS NULL
                            AND a.departure_city ILIKE :origin AND a.arrival_city ILIKE :destination)
               OR EXISTS (SELECT 1 FROM bids b
                          JOIN announcements a2 ON a2.id = b.announcement_id
                          WHERE b.sender_id = u.id AND b.deleted_at IS NULL AND a2.deleted_at IS NULL
                            AND a2.departure_city ILIKE :origin AND a2.arrival_city ILIKE :destination))
            """;

    @Query(value = "SELECT u.id FROM users u WHERE " + ACTIVE + CORRIDOR_PREDICATE + " ORDER BY u.created_at",
           countQuery = "SELECT COUNT(*) FROM users u WHERE " + ACTIVE + CORRIDOR_PREDICATE,
           nativeQuery = true)
    Page<UUID> findActiveCorridorIds(@Param("origin") String origin,
                                     @Param("destination") String destination,
                                     Pageable pageable);

    /**
     * Ciblage nominatif. Le filtre de statut est volontairement absent : un administrateur
     * doit pouvoir prevenir un compte suspendu de sa suspension. Seule la suppression
     * (soft delete) ecarte le compte.
     */
    @Query(value = "SELECT u.id FROM users u WHERE u.deleted_at IS NULL AND u.id = :userId",
           countQuery = "SELECT COUNT(*) FROM users u WHERE u.deleted_at IS NULL AND u.id = :userId",
           nativeQuery = true)
    Page<UUID> findExistingIdById(@Param("userId") UUID userId, Pageable pageable);
}
```

- [ ] **Étape 5 : Écrire le service**

Créer `src/main/java/com/yadony/api/admin/broadcast/BroadcastAudienceService.java` :

```java
package com.yadony.api.admin.broadcast;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Resolution paginee des destinataires d'un broadcast. Lecture seule. */
@Service
@Transactional(readOnly = true)
public class BroadcastAudienceService {

    /**
     * 200 destinataires par page. Compromis assume : assez petit pour que la page tienne
     * en memoire et que l'envoi progresse par a-coups visibles, assez grand pour ne pas
     * multiplier les allers-retours SQL. L'envoi FCM restant unitaire
     * ({@code FcmService.sendToToken} boucle sur les jetons), ce nombre borne la memoire,
     * pas le nombre d'appels reseau.
     */
    public static final int PAGE_SIZE = 200;

    private final BroadcastAudienceRepository repository;

    public BroadcastAudienceService(BroadcastAudienceRepository repository) {
        this.repository = repository;
    }

    public long count(BroadcastTarget target) {
        return page(target, 0).getTotalElements();
    }

    public Page<UUID> page(BroadcastTarget target, int pageNumber) {
        Pageable pageable = PageRequest.of(pageNumber, PAGE_SIZE);
        return switch (target.type()) {
            case ALL -> repository.findActiveIds(pageable);
            case SENDERS -> repository.findActiveSenderIds(pageable);
            case TRAVELERS -> repository.findActiveTravelerIds(pageable);
            case CORRIDOR -> repository.findActiveCorridorIds(
                    target.origin(), target.destination(), pageable);
            case USER -> repository.findExistingIdById(target.userId(), pageable);
        };
    }
}
```

- [ ] **Étape 6 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=BroadcastAudienceServiceIT
```

Attendu : `Tests run: 7, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 7 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T2 **+ 7**, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 8 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/broadcast/ src/test/java/com/yadony/api/admin/broadcast/
git commit -m "feat(admin): ciblage comportemental des destinataires d'un broadcast"
```

---

### Task 4 : Exécuteur borné et envoi asynchrone paginé

**Dépôt :** `dony-back`

**Files:**
- Create: `src/main/java/com/yadony/api/admin/broadcast/BroadcastExecutorConfig.java`
- Create: `src/main/java/com/yadony/api/admin/broadcast/BroadcastService.java`
- Test: `src/test/java/com/yadony/api/admin/broadcast/BroadcastServiceTest.java`

**Interfaces:**
- Consumes: `BroadcastAudienceService.count/page` (T3) ; `AdminBroadcastRepository.save` (T2) ; `NotificationDispatcher.notifyUser(UUID userId, String title, String body, Map<String,String> data)` (existant, persiste l'in-app **puis** pousse le FCM).
- Produces:
  - `BroadcastService.record(String title, String body, BroadcastTarget target, UUID adminId) -> AdminBroadcastEntity` — **synchrone** : compte les destinataires et enregistre la ligne d'historique.
  - `BroadcastService.dispatchAsync(UUID broadcastId, String title, String body, BroadcastTarget target)` — **asynchrone** (`@Async("broadcastExecutor")`), boucle page par page.
  - `BroadcastService.NOTIFICATION_TYPE` = `"ADMIN_BROADCAST"`.
  - Bean `broadcastExecutor` (`ThreadPoolTaskExecutor`).

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/admin/broadcast/BroadcastServiceTest.java` — test unitaire Mockito, l'envoi asynchrone est appelé **directement** (sans proxy) pour être déterministe.

```java
package com.yadony.api.admin.broadcast;

import com.yadony.api.notifications.NotificationDispatcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BroadcastServiceTest {

    @Mock BroadcastAudienceService audienceService;
    @Mock AdminBroadcastRepository broadcastRepository;
    @Mock NotificationDispatcher notificationDispatcher;
    @InjectMocks BroadcastService service;

    private static final UUID BROADCAST_ID = UUID.randomUUID();
    private static final BroadcastTarget ALL =
            new BroadcastTarget(BroadcastTargetType.ALL, null, null, null);

    @Test
    void recordCountsRecipientsAndPersistsHistory() {
        UUID adminId = UUID.randomUUID();
        when(audienceService.count(ALL)).thenReturn(37L);
        when(broadcastRepository.save(any(AdminBroadcastEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AdminBroadcastEntity saved = service.record("Titre", "Corps", ALL, adminId);

        assertThat(saved.getRecipientCount()).isEqualTo(37);
        assertThat(saved.getTargetType()).isEqualTo(BroadcastTargetType.ALL);
        assertThat(saved.getAdminId()).isEqualTo(adminId);
    }

    @Test
    void dispatchWalksEveryPageAndNotifiesEachRecipientOnce() {
        UUID u1 = UUID.randomUUID();
        UUID u2 = UUID.randomUUID();
        UUID u3 = UUID.randomUUID();
        when(audienceService.page(ALL, 0)).thenReturn(
                new PageImpl<>(List.of(u1, u2), PageRequest.of(0, 2), 3));
        when(audienceService.page(ALL, 1)).thenReturn(
                new PageImpl<>(List.of(u3), PageRequest.of(1, 2), 3));

        service.dispatchAsync(BROADCAST_ID, "Titre", "Corps", ALL);

        verify(notificationDispatcher).notifyUser(eq(u1), eq("Titre"), eq("Corps"), any());
        verify(notificationDispatcher).notifyUser(eq(u2), eq("Titre"), eq("Corps"), any());
        verify(notificationDispatcher).notifyUser(eq(u3), eq("Titre"), eq("Corps"), any());
    }

    @Test
    void dispatchCarriesBroadcastTypeAndIdInThePayload() {
        UUID u1 = UUID.randomUUID();
        when(audienceService.page(ALL, 0)).thenReturn(
                new PageImpl<>(List.of(u1), PageRequest.of(0, 200), 1));

        service.dispatchAsync(BROADCAST_ID, "Titre", "Corps", ALL);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> payload = ArgumentCaptor.forClass(Map.class);
        verify(notificationDispatcher).notifyUser(eq(u1), anyString(), anyString(), payload.capture());
        assertThat(payload.getValue())
                .containsEntry("type", "ADMIN_BROADCAST")
                .containsEntry("broadcastId", BROADCAST_ID.toString());
    }

    @Test
    void oneFailingRecipientDoesNotAbortTheBroadcast() {
        UUID failing = UUID.randomUUID();
        UUID surviving = UUID.randomUUID();
        when(audienceService.page(ALL, 0)).thenReturn(
                new PageImpl<>(List.of(failing, surviving), PageRequest.of(0, 200), 2));
        doThrow(new IllegalStateException("FCM indisponible"))
                .when(notificationDispatcher).notifyUser(eq(failing), anyString(), anyString(), any());

        service.dispatchAsync(BROADCAST_ID, "Titre", "Corps", ALL);

        verify(notificationDispatcher).notifyUser(eq(surviving), anyString(), anyString(), any());
        verify(notificationDispatcher, times(2)).notifyUser(any(), anyString(), anyString(), any());
    }

    @Test
    void emptyAudienceSendsNothing() {
        when(audienceService.page(ALL, 0)).thenReturn(
                new PageImpl<>(List.of(), PageRequest.of(0, 200), 0));

        service.dispatchAsync(BROADCAST_ID, "Titre", "Corps", ALL);

        verify(notificationDispatcher, times(0)).notifyUser(any(), anyString(), anyString(), any());
    }
}
```

- [ ] **Étape 2 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=BroadcastServiceTest
```

Attendu : **échec de compilation** — `cannot find symbol: class BroadcastService`.

- [ ] **Étape 3 : Écrire l'exécuteur borné**

Créer `src/main/java/com/yadony/api/admin/broadcast/BroadcastExecutorConfig.java` :

```java
package com.yadony.api.admin.broadcast;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * Executeur dedie au broadcast, volontairement etroit.
 *
 * <p>⚠️ Spring Boot auto-configure deja un {@code applicationTaskExecutor} (aliase
 * {@code taskExecutor}) que tous les {@code @Async} sans qualifieur utilisent — dont les
 * 25 listeners de {@code NotificationDispatcher}. Ajouter ce second executeur ne les
 * deplace PAS : Spring resout le defaut par le nom {@code taskExecutor}. En contrepartie,
 * tout point d'entree de broadcast DOIT porter le qualifieur explicite
 * {@code @Async("broadcastExecutor")}, sans quoi un envoi de masse partagerait la file des
 * notifications transactionnelles et les retarderait.
 *
 * <p>Un seul thread : un broadcast doit rester une trainee de fond, jamais une rafale qui
 * concurrence le trafic applicatif. File courte + {@code CallerRunsPolicy} : au-dela de
 * 20 broadcasts en attente, l'appelant execute lui-meme — la requete admin ralentit,
 * ce qui est un signal visible, plutot qu'une file qui gonfle en silence.
 */
@Configuration
public class BroadcastExecutorConfig {

    @Bean("broadcastExecutor")
    public ThreadPoolTaskExecutor broadcastExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("broadcast-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
```

- [ ] **Étape 4 : Écrire le service d'envoi**

Créer `src/main/java/com/yadony/api/admin/broadcast/BroadcastService.java` :

```java
package com.yadony.api.admin.broadcast;

import com.yadony.api.notifications.NotificationDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * Envoi d'un broadcast : comptage et historisation synchrones, diffusion asynchrone.
 *
 * <p>Canaux : notification in-app + push FCM via {@code NotificationDispatcher}.
 * <b>Jamais de SMS</b> — le repli SMS est reserve aux notifications critiques
 * ({@code SmsFallbackScheduler}), et un broadcast n'en est pas une.
 *
 * <p>Le type {@code ADMIN_BROADCAST} n'est volontairement PAS mappe dans
 * {@code NotificationPrefsService.TYPE_TO_PREF} : un type inconnu y est autorise par
 * defaut, donc une annonce plateforme atteint tout le monde. C'est un choix — une
 * information de service n'est pas une promotion dont on se desabonne. Le mapper sur
 * {@code pushPromo} laisserait un utilisateur rater une annonce de maintenance.
 */
@Service
public class BroadcastService {

    public static final String NOTIFICATION_TYPE = "ADMIN_BROADCAST";

    private static final Logger log = LoggerFactory.getLogger(BroadcastService.class);

    private final BroadcastAudienceService audienceService;
    private final AdminBroadcastRepository broadcastRepository;
    private final NotificationDispatcher notificationDispatcher;

    public BroadcastService(BroadcastAudienceService audienceService,
                            AdminBroadcastRepository broadcastRepository,
                            NotificationDispatcher notificationDispatcher) {
        this.audienceService = audienceService;
        this.broadcastRepository = broadcastRepository;
        this.notificationDispatcher = notificationDispatcher;
    }

    /** Compte les destinataires et fige la ligne d'historique. Synchrone : la reponse HTTP en depend. */
    @Transactional
    public AdminBroadcastEntity record(String title, String body, BroadcastTarget target, UUID adminId) {
        long recipientCount = audienceService.count(target);
        return broadcastRepository.save(new AdminBroadcastEntity(
                title, body, target.type(), target.origin(), target.destination(),
                target.userId(), (int) recipientCount, adminId));
    }

    /**
     * Diffusion page par page. Chaque destinataire est isole : une erreur FCM ou une
     * ligne de notification en echec ne doit pas priver les suivants du message.
     */
    @Async("broadcastExecutor")
    public void dispatchAsync(UUID broadcastId, String title, String body, BroadcastTarget target) {
        Map<String, String> data = Map.of(
                "type", NOTIFICATION_TYPE,
                "broadcastId", broadcastId.toString());

        int pageNumber = 0;
        int sent = 0;
        int failed = 0;
        Page<UUID> page;
        do {
            page = audienceService.page(target, pageNumber);
            for (UUID userId : page.getContent()) {
                try {
                    notificationDispatcher.notifyUser(userId, title, body, data);
                    sent++;
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("[BROADCAST] {} — echec pour l'utilisateur {} : {}",
                            broadcastId, userId, e.getMessage());
                }
            }
            pageNumber++;
        } while (page.hasNext());

        log.info("[BROADCAST] {} termine — {} envoyes, {} en echec", broadcastId, sent, failed);
    }
}
```

- [ ] **Étape 5 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=BroadcastServiceTest
```

Attendu : `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 6 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T3 **+ 5**, 0 échec. **Vérifier en particulier qu'aucun test de notification existant ne casse** : l'ajout d'un second `TaskExecutor` est le risque de régression de cette tâche.

- [ ] **Étape 7 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/broadcast/ src/test/java/com/yadony/api/admin/broadcast/
git commit -m "feat(admin): envoi de broadcast asynchrone borne, page par page"
```

---

### Task 5 : Endpoints de broadcast, aperçu et historique

**Dépôt :** `dony-back`

**Files:**
- Create: `src/main/java/com/yadony/api/admin/dto/BroadcastTargetRequest.java`
- Create: `src/main/java/com/yadony/api/admin/dto/BroadcastRequest.java`
- Create: `src/main/java/com/yadony/api/admin/dto/BroadcastAudienceResponse.java`
- Create: `src/main/java/com/yadony/api/admin/dto/AdminBroadcastResponse.java`
- Create: `src/main/java/com/yadony/api/admin/AdminBroadcastController.java`
- Test: `src/test/java/com/yadony/api/admin/AdminBroadcastControllerIT.java`

**Interfaces:**
- Consumes: `BroadcastService.record/dispatchAsync` (T4) ; `BroadcastAudienceService.count` (T3) ; `AdminBroadcastRepository.findAllByOrderByCreatedAtDesc` (T2) ; `AuditService.log(String entityType, UUID entityId, String action, UUID actorId, Map<String,Object> payload)` ; `AdminPrincipal.adminId()`.
- Produces (contrat HTTP consommé par le front en T12) :
  - `POST /admin/notifications/broadcast` → **202** `AdminBroadcastResponse`
  - `POST /admin/notifications/broadcast/preview` → **200** `BroadcastAudienceResponse{ recipientCount: number }`
  - `GET /admin/notifications/broadcasts?page&size` → **200** `Page<AdminBroadcastResponse>` (JSON Spring brut : `content`, `totalElements`, `totalPages`, `number`, `size`)
  - `AdminBroadcastResponse(UUID id, String title, String body, String targetType, String targetOrigin, String targetDestination, UUID targetUserId, int recipientCount, UUID adminId, LocalDateTime createdAt)`

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/admin/AdminBroadcastControllerIT.java`, calqué sur `AdminGdprControllerIT` (même dossier).

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.account.AdminRole;
import com.yadony.api.admin.broadcast.AdminBroadcastEntity;
import com.yadony.api.admin.broadcast.AdminBroadcastRepository;
import com.yadony.api.admin.broadcast.BroadcastAudienceService;
import com.yadony.api.admin.broadcast.BroadcastService;
import com.yadony.api.admin.broadcast.BroadcastTarget;
import com.yadony.api.admin.broadcast.BroadcastTargetType;
import com.yadony.api.common.AuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lot D — matrice de permission et mapping HTTP du broadcast.
 * SUPPORT ne recoit PAS NOTIFICATION_SEND : les trois routes doivent lui etre fermees.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("AdminBroadcastControllerIT — /admin/notifications/broadcast*")
class AdminBroadcastControllerIT {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean BroadcastService broadcastService;
    @MockitoBean BroadcastAudienceService audienceService;
    @MockitoBean AdminBroadcastRepository broadcastRepository;
    @MockitoBean AuditService auditService;

    private static final UUID ADMIN_ID = UUID.randomUUID();

    private static UsernamePasswordAuthenticationToken adminAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                ADMIN_ID, "admin@yadony.test", AdminRole.ADMIN, false, "uid-admin-broadcast");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("NOTIFICATION_SEND")));
    }

    /** SUPPORT — AdminRole.SUPPORT n'inclut pas NOTIFICATION_SEND. */
    private static UsernamePasswordAuthenticationToken supportAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "support@yadony.test", AdminRole.SUPPORT, false, "uid-support-broadcast");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private static AdminBroadcastEntity persisted(int recipientCount) {
        AdminBroadcastEntity entity = new AdminBroadcastEntity(
                "Maintenance", "Service indisponible ce soir.", BroadcastTargetType.ALL,
                null, null, null, recipientCount, ADMIN_ID);
        ReflectionTestUtils.setField(entity, "id", UUID.randomUUID());
        return entity;
    }

    private String body(String json) {
        return json;
    }

    // ── POST /admin/notifications/broadcast ───────────────────────────────────

    @Test
    @DisplayName("POST — SUPPORT (sans NOTIFICATION_SEND) → 403 et rien n'est envoye")
    void send_withSupportRole_returns403() throws Exception {
        mockMvc.perform(post("/admin/notifications/broadcast")
                        .with(authentication(supportAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("""
                                {"title":"T","body":"B","target":{"type":"ALL"}}
                                """)))
                .andExpect(status().isForbidden());

        verify(broadcastService, never()).record(any(), any(), any(), any());
    }

    @Test
    @DisplayName("POST — ADMIN → 202, historique enregistre, diffusion declenchee, audit ecrit")
    void send_withAdmin_returns202AndAudits() throws Exception {
        AdminBroadcastEntity saved = persisted(37);
        when(broadcastService.record(eq("Maintenance"), eq("Service indisponible ce soir."),
                any(BroadcastTarget.class), eq(ADMIN_ID))).thenReturn(saved);

        mockMvc.perform(post("/admin/notifications/broadcast")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("""
                                {"title":"Maintenance","body":"Service indisponible ce soir.",
                                 "target":{"type":"ALL"}}
                                """)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.recipientCount").value(37))
                .andExpect(jsonPath("$.targetType").value("ALL"));

        verify(broadcastService).dispatchAsync(eq(saved.getId()), eq("Maintenance"),
                eq("Service indisponible ce soir."), any(BroadcastTarget.class));
        verify(auditService).log(eq("admin_broadcast"), eq(saved.getId()),
                eq("BROADCAST_SENT"), eq(ADMIN_ID), any(Map.class));
    }

    @Test
    @DisplayName("POST — titre vide → 400 (validation Bean), rien n'est envoye")
    void send_withBlankTitle_returns400() throws Exception {
        mockMvc.perform(post("/admin/notifications/broadcast")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("""
                                {"title":"  ","body":"B","target":{"type":"ALL"}}
                                """)))
                .andExpect(status().isBadRequest());

        verify(broadcastService, never()).dispatchAsync(any(), any(), any(), any());
    }

    @Test
    @DisplayName("POST — corridor sans ville d'arrivee → 422 RFC 7807")
    void send_withIncompleteCorridor_returns422() throws Exception {
        mockMvc.perform(post("/admin/notifications/broadcast")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("""
                                {"title":"T","body":"B","target":{"type":"CORRIDOR","origin":"Paris"}}
                                """)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").exists());
    }

    // ── POST /admin/notifications/broadcast/preview ───────────────────────────

    @Test
    @DisplayName("preview — SUPPORT → 403")
    void preview_withSupportRole_returns403() throws Exception {
        mockMvc.perform(post("/admin/notifications/broadcast/preview")
                        .with(authentication(supportAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("""
                                {"type":"ALL"}
                                """)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("preview — ADMIN → 200 avec le nombre de destinataires, sans rien envoyer")
    void preview_withAdmin_returnsCountOnly() throws Exception {
        when(audienceService.count(any(BroadcastTarget.class))).thenReturn(128L);

        mockMvc.perform(post("/admin/notifications/broadcast/preview")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("""
                                {"type":"CORRIDOR","origin":"Paris","destination":"Dakar"}
                                """)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipientCount").value(128));

        verify(broadcastService, never()).dispatchAsync(any(), any(), any(), any());
    }

    // ── GET /admin/notifications/broadcasts ───────────────────────────────────

    @Test
    @DisplayName("GET historique — SUPPORT → 403")
    void history_withSupportRole_returns403() throws Exception {
        mockMvc.perform(get("/admin/notifications/broadcasts").with(authentication(supportAuth())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET historique — ADMIN → 200, page Spring brute")
    void history_withAdmin_returnsPage() throws Exception {
        when(broadcastRepository.findAllByOrderByCreatedAtDesc(any()))
                .thenReturn(new PageImpl<>(List.of(persisted(5)), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/admin/notifications/broadcasts").with(authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].recipientCount").value(5))
                .andExpect(jsonPath("$.content[0].title").value("Maintenance"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }
}
```

- [ ] **Étape 2 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminBroadcastControllerIT
```

Attendu : **échec de compilation** — `cannot find symbol: class AdminBroadcastController`.

- [ ] **Étape 3 : Écrire les DTO**

Créer `src/main/java/com/yadony/api/admin/dto/BroadcastTargetRequest.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.admin.broadcast.BroadcastTarget;
import com.yadony.api.admin.broadcast.BroadcastTargetType;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Ciblage tel qu'il arrive du front. La coherence (corridor complet, userId present) est
 * validee par {@link BroadcastTarget}, pas ici : une seule regle, un seul endroit.
 */
public record BroadcastTargetRequest(
        @NotNull BroadcastTargetType type,
        String origin,
        String destination,
        UUID userId) {

    public BroadcastTarget toDomain() {
        return new BroadcastTarget(type, origin, destination, userId);
    }
}
```

Créer `src/main/java/com/yadony/api/admin/dto/BroadcastRequest.java` :

```java
package com.yadony.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Longueurs alignees sur les colonnes de admin_broadcasts (120 / 500). */
public record BroadcastRequest(
        @NotBlank @Size(max = 120) String title,
        @NotBlank @Size(max = 500) String body,
        @NotNull @Valid BroadcastTargetRequest target) {
}
```

Créer `src/main/java/com/yadony/api/admin/dto/BroadcastAudienceResponse.java` :

```java
package com.yadony.api.admin.dto;

/** Apercu : combien de comptes recevraient ce broadcast, sans rien envoyer. */
public record BroadcastAudienceResponse(long recipientCount) {}
```

Créer `src/main/java/com/yadony/api/admin/dto/AdminBroadcastResponse.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.admin.broadcast.AdminBroadcastEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminBroadcastResponse(
        UUID id,
        String title,
        String body,
        String targetType,
        String targetOrigin,
        String targetDestination,
        UUID targetUserId,
        int recipientCount,
        UUID adminId,
        LocalDateTime createdAt) {

    public static AdminBroadcastResponse from(AdminBroadcastEntity entity) {
        return new AdminBroadcastResponse(
                entity.getId(), entity.getTitle(), entity.getBody(),
                entity.getTargetType().name(), entity.getTargetOrigin(), entity.getTargetDestination(),
                entity.getTargetUserId(), entity.getRecipientCount(), entity.getAdminId(),
                entity.getCreatedAt());
    }
}
```

- [ ] **Étape 4 : Écrire le contrôleur**

Créer `src/main/java/com/yadony/api/admin/AdminBroadcastController.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.broadcast.AdminBroadcastEntity;
import com.yadony.api.admin.broadcast.AdminBroadcastRepository;
import com.yadony.api.admin.broadcast.BroadcastAudienceService;
import com.yadony.api.admin.broadcast.BroadcastService;
import com.yadony.api.admin.broadcast.BroadcastTarget;
import com.yadony.api.admin.dto.AdminBroadcastResponse;
import com.yadony.api.admin.dto.BroadcastAudienceResponse;
import com.yadony.api.admin.dto.BroadcastRequest;
import com.yadony.api.admin.dto.BroadcastTargetRequest;
import com.yadony.api.common.AuditService;
import com.yadony.api.common.YadonyBusinessException;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Lot D — broadcast de notifications. Reserve a ADMIN/SUPER_ADMIN : SUPPORT ne recoit
 * pas NOTIFICATION_SEND.
 *
 * <p>⚠️ Chaque methode re-declare l'expression COMPLETE : une {@code @PreAuthorize} de
 * methode remplace celle de la classe, elle ne s'y ajoute pas. Et {@code hasRole('ADMIN')}
 * ne discrimine personne — tout compte admin la porte, SUPPORT compris : seule l'authority
 * filtre reellement.
 */
@RestController
@PreAuthorize("hasRole('ADMIN') and hasAuthority('NOTIFICATION_SEND')")
public class AdminBroadcastController {

    private final BroadcastService broadcastService;
    private final BroadcastAudienceService audienceService;
    private final AdminBroadcastRepository broadcastRepository;
    private final AuditService auditService;

    public AdminBroadcastController(BroadcastService broadcastService,
                                    BroadcastAudienceService audienceService,
                                    AdminBroadcastRepository broadcastRepository,
                                    AuditService auditService) {
        this.broadcastService = broadcastService;
        this.audienceService = audienceService;
        this.broadcastRepository = broadcastRepository;
        this.auditService = auditService;
    }

    /**
     * 202 Accepted : le comptage et l'historisation sont faits, la diffusion ne l'est pas
     * encore. Repondre 200 laisserait croire que tout le monde a deja recu le message.
     */
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('NOTIFICATION_SEND')")
    @PostMapping("/admin/notifications/broadcast")
    public ResponseEntity<AdminBroadcastResponse> send(@RequestBody @Valid BroadcastRequest request,
                                                       Authentication authentication) {
        UUID adminId = adminId(authentication);
        BroadcastTarget target = request.target().toDomain();

        AdminBroadcastEntity saved = broadcastService.record(
                request.title(), request.body(), target, adminId);

        // Les cles ci-dessous echappent toutes a la denylist PII d'AuditService.redact()
        // (aucune ne finit par « name » ni ne contient phone/email/city/label).
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", saved.getTitle());
        payload.put("targetType", saved.getTargetType().name());
        payload.put("targetOrigin", saved.getTargetOrigin());
        payload.put("targetDestination", saved.getTargetDestination());
        payload.put("targetUserId", saved.getTargetUserId());
        payload.put("recipientCount", saved.getRecipientCount());
        auditService.log("admin_broadcast", saved.getId(), "BROADCAST_SENT", adminId, payload);

        broadcastService.dispatchAsync(saved.getId(), saved.getTitle(), saved.getBody(), target);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(AdminBroadcastResponse.from(saved));
    }

    /** Apercu du volume avant envoi. Aucune ecriture, donc aucune entree audit_log. */
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('NOTIFICATION_SEND')")
    @PostMapping("/admin/notifications/broadcast/preview")
    public BroadcastAudienceResponse preview(@RequestBody @Valid BroadcastTargetRequest request) {
        return new BroadcastAudienceResponse(audienceService.count(request.toDomain()));
    }

    @PreAuthorize("hasRole('ADMIN') and hasAuthority('NOTIFICATION_SEND')")
    @GetMapping("/admin/notifications/broadcasts")
    public Page<AdminBroadcastResponse> history(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return broadcastRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .map(AdminBroadcastResponse::from);
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

- [ ] **Étape 5 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminBroadcastControllerIT
```

Attendu : `Tests run: 8, Failures: 0, Errors: 0, Skipped: 0`.
**Si `send_withIncompleteCorridor_returns422` échoue en 500** : `YadonyBusinessException` est levée pendant la désérialisation du corps (constructeur compact du record). Déplacer alors l'appel `request.target().toDomain()` **après** l'entrée dans la méthode — c'est déjà le cas ici, `BroadcastTargetRequest` ne construit pas `BroadcastTarget` à la désérialisation.

- [ ] **Étape 6 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T4 **+ 8**, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 7 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/ src/test/java/com/yadony/api/admin/AdminBroadcastControllerIT.java
git commit -m "feat(admin): endpoints d'envoi, d'apercu et d'historique des broadcasts"
```

---

### Task 6 : Table `platform_settings` et amorçage depuis les properties

**Dépôt :** `dony-back`

**Files:**
- Create: `src/main/resources/db/migration/V222__platform_settings.sql`
- Create: `src/main/java/com/yadony/api/config/PlatformSettingKey.java`
- Create: `src/main/java/com/yadony/api/config/PlatformSettingEntity.java`
- Create: `src/main/java/com/yadony/api/config/PlatformSettingRepository.java`
- Create: `src/main/java/com/yadony/api/config/PlatformSettingsInitializer.java`
- Test: `src/test/java/com/yadony/api/config/PlatformSettingsInitializerIT.java`

**Interfaces:**
- Consumes: `YadonyConfigProperties.commission().rate()` (`BigDecimal`), `.urgency().thresholdDays()` (`Integer`), `.reimbursement().maxAmountEur()` (`BigDecimal`) ; property `app.sms.enabled` (défaut `false`).
- Produces:
  - `enum PlatformSettingKey { COMMISSION_RATE("commission_rate", DECIMAL), URGENCY_THRESHOLD_DAYS("urgency_threshold_days", INTEGER), REIMBURSEMENT_CAP_EUR("reimbursement_cap_eur", DECIMAL), SMS_ENABLED("sms_enabled", BOOLEAN) }` avec `key() -> String`, `type() -> PlatformSettingType`, `PlatformSettingKey.fromKey(String) -> PlatformSettingKey`.
  - `enum PlatformSettingType { DECIMAL, INTEGER, BOOLEAN }`
  - `PlatformSettingEntity(String settingKey, String settingValue, PlatformSettingType valueType)` + `getSettingKey/getSettingValue/getValueType/getUpdatedBy`, `setSettingValue(String)`, `setUpdatedBy(UUID)`.
  - `PlatformSettingRepository extends JpaRepository<PlatformSettingEntity, UUID>` avec `Optional<PlatformSettingEntity> findBySettingKey(String settingKey)`.
  - `PlatformSettingsInitializer.seedMissingKeys() -> int` (nombre de lignes insérées).

- [ ] **Étape 1 : Reconfirmer le numéro de migration**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git pull --ff-only
ls src/main/resources/db/migration/ | sort -V | tail -3
```

Attendu : `V221__admin_broadcasts.sql` en dernier (posé en T2).

- [ ] **Étape 2 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/config/PlatformSettingsInitializerIT.java` :

```java
package com.yadony.api.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lot D — l'amorcage se fait a l'EXECUTION, depuis les properties resolues, jamais dans
 * la migration SQL.
 *
 * <p>Raison : une migration ne voit pas {@code SMS_ENABLED} ni {@code YADONY_COMMISSION_RATE},
 * qui sont des variables d'environnement. Un {@code INSERT ... 'false'} en dur aurait coupe
 * l'OTP SMS en production des le deploiement. Accessoirement, Flyway est desactive dans le
 * profil de test : ce mecanisme est aussi le seul qui garnit la table ici.
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("PlatformSettingsInitializerIT — amorcage des parametres plateforme")
class PlatformSettingsInitializerIT {

    @Autowired PlatformSettingsInitializer initializer;
    @Autowired PlatformSettingRepository repository;
    @Autowired YadonyConfigProperties config;

    /**
     * ⚠️ @AfterEach autant que @BeforeEach : la H2 de test est PARTAGEE entre contextes
     * ({@code DB_CLOSE_DELAY=-1}). On rend la table a son etat amorce pour ne pas laisser
     * une valeur bricolee derriere soi.
     */
    @BeforeEach
    void clearTable() {
        repository.deleteAll();
    }

    @AfterEach
    void restoreSeededState() {
        repository.deleteAll();
        initializer.seedMissingKeys();
    }

    @Test
    @DisplayName("insere les quatre cles depuis les properties resolues")
    void seedsAllFourKeysFromProperties() {
        int inserted = initializer.seedMissingKeys();

        assertThat(inserted).isEqualTo(4);
        assertThat(repository.findBySettingKey("commission_rate")).isPresent()
                .get().extracting(PlatformSettingEntity::getSettingValue)
                .isEqualTo(config.commission().rate().toPlainString());
        assertThat(repository.findBySettingKey("urgency_threshold_days")).isPresent()
                .get().extracting(PlatformSettingEntity::getSettingValue)
                .isEqualTo(String.valueOf(config.urgency().thresholdDays()));
        assertThat(repository.findBySettingKey("reimbursement_cap_eur")).isPresent()
                .get().extracting(PlatformSettingEntity::getSettingValue)
                .isEqualTo(config.reimbursement().maxAmountEur().toPlainString());
        assertThat(repository.findBySettingKey("sms_enabled")).isPresent()
                .get().extracting(PlatformSettingEntity::getSettingValue)
                .isEqualTo("false");
    }

    @Test
    @DisplayName("idempotent : un second passage n'insere rien")
    void secondRunInsertsNothing() {
        initializer.seedMissingKeys();

        assertThat(initializer.seedMissingKeys()).isZero();
        assertThat(repository.count()).isEqualTo(4);
    }

    @Test
    @DisplayName("n'ecrase jamais une valeur deja modifiee par un administrateur")
    void neverOverwritesAnAdminEditedValue() {
        initializer.seedMissingKeys();
        PlatformSettingEntity rate = repository.findBySettingKey("commission_rate").orElseThrow();
        rate.setSettingValue("0.12");
        repository.saveAndFlush(rate);

        initializer.seedMissingKeys();

        assertThat(repository.findBySettingKey("commission_rate").orElseThrow().getSettingValue())
                .isEqualTo("0.12");
    }

    @Test
    @DisplayName("chaque cle porte son type")
    void everyKeyCarriesItsType() {
        initializer.seedMissingKeys();

        assertThat(repository.findBySettingKey("commission_rate").orElseThrow().getValueType())
                .isEqualTo(PlatformSettingType.DECIMAL);
        assertThat(repository.findBySettingKey("urgency_threshold_days").orElseThrow().getValueType())
                .isEqualTo(PlatformSettingType.INTEGER);
        assertThat(repository.findBySettingKey("sms_enabled").orElseThrow().getValueType())
                .isEqualTo(PlatformSettingType.BOOLEAN);
    }

    @Test
    @DisplayName("la valeur amorcee du taux vaut bien le taux global du resolveur")
    void seededRateEqualsGlobalRate() {
        initializer.seedMissingKeys();

        assertThat(new BigDecimal(
                repository.findBySettingKey("commission_rate").orElseThrow().getSettingValue()))
                .isEqualByComparingTo(config.commission().rate());
    }
}
```

- [ ] **Étape 3 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=PlatformSettingsInitializerIT
```

Attendu : **échec de compilation** — `cannot find symbol: class PlatformSettingsInitializer`.

- [ ] **Étape 4 : Écrire la migration**

Créer `src/main/resources/db/migration/V222__platform_settings.sql` :

```sql
-- Lot D — parametres plateforme editables a chaud, sans redeploiement.
--
-- Table volontairement VIDE a la creation. L'amorcage se fait a l'execution
-- (PlatformSettingsInitializer, evenement ApplicationReadyEvent) depuis les properties
-- deja resolues : une migration SQL ne voit ni SMS_ENABLED ni YADONY_COMMISSION_RATE,
-- qui sont des variables d'environnement. Un INSERT en dur ici aurait remis sms_enabled
-- a 'false' en production — c'est-a-dire coupe l'authentification par OTP SMS
-- (SmsOtpService:76,105) des le deploiement.
CREATE TABLE platform_settings (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key    VARCHAR(60)  NOT NULL,
    setting_value  VARCHAR(255) NOT NULL,
    -- DECIMAL | INTEGER | BOOLEAN (PlatformSettingType)
    value_type     VARCHAR(10)  NOT NULL,
    -- admin_users.id de l'auteur de la derniere modification. NULL tant que la ligne
    -- n'a ete ecrite que par l'amorcage.
    updated_by     UUID,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ,
    CONSTRAINT uq_platform_settings_key UNIQUE (setting_key)
);

COMMENT ON TABLE platform_settings IS
    'Parametres plateforme editables depuis le back-office (Lot D). Lignes jamais supprimees.';
COMMENT ON COLUMN platform_settings.setting_key IS
    'commission_rate | urgency_threshold_days | reimbursement_cap_eur | sms_enabled';
```

- [ ] **Étape 5 : Écrire les types, l'entité et le repository**

Créer `src/main/java/com/yadony/api/config/PlatformSettingType.java` :

```java
package com.yadony.api.config;

/** Type de la valeur stockee en texte dans platform_settings.setting_value. */
public enum PlatformSettingType {
    DECIMAL,
    INTEGER,
    BOOLEAN
}
```

Créer `src/main/java/com/yadony/api/config/PlatformSettingKey.java` :

```java
package com.yadony.api.config;

import com.yadony.api.common.YadonyBusinessException;
import org.springframework.http.HttpStatus;

import java.util.Arrays;

/**
 * Les quatre parametres plateforme editables.
 *
 * <p>⚠️ {@code URGENCY_THRESHOLD_DAYS} est bien en JOURS : la property historique est
 * {@code yadony.urgency.threshold-days} (defaut 3) et le contrat public expose
 * {@code {"thresholdDays": 3}}. Renommer en heures multiplierait le seuil par 24.
 */
public enum PlatformSettingKey {

    COMMISSION_RATE("commission_rate", PlatformSettingType.DECIMAL),
    URGENCY_THRESHOLD_DAYS("urgency_threshold_days", PlatformSettingType.INTEGER),
    REIMBURSEMENT_CAP_EUR("reimbursement_cap_eur", PlatformSettingType.DECIMAL),
    SMS_ENABLED("sms_enabled", PlatformSettingType.BOOLEAN);

    private final String key;
    private final PlatformSettingType type;

    PlatformSettingKey(String key, PlatformSettingType type) {
        this.key = key;
        this.type = type;
    }

    public String key() {
        return key;
    }

    public PlatformSettingType type() {
        return type;
    }

    public static PlatformSettingKey fromKey(String key) {
        return Arrays.stream(values())
                .filter(k -> k.key.equals(key))
                .findFirst()
                .orElseThrow(() -> new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "platform-setting-unknown", "Unprocessable Entity",
                        "Parametre plateforme inconnu : " + key));
    }
}
```

Créer `src/main/java/com/yadony/api/config/PlatformSettingEntity.java` :

```java
package com.yadony.api.config;

import com.yadony.api.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.Where;

import java.util.UUID;

/**
 * Une ligne = un parametre. Ces lignes ne sont JAMAIS supprimees : la contrainte d'unicite
 * porte sur setting_key sans tenir compte de deleted_at, une ligne effacee en douceur
 * bloquerait donc toute reinsertion de la meme cle.
 */
@Entity
@Table(name = "platform_settings")
@Where(clause = "deleted_at IS NULL")
public class PlatformSettingEntity extends BaseEntity {

    @Column(name = "setting_key", nullable = false, length = 60, unique = true)
    private String settingKey;

    @Column(name = "setting_value", nullable = false, length = 255)
    private String settingValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type", nullable = false, length = 10)
    private PlatformSettingType valueType;

    @Column(name = "updated_by")
    private UUID updatedBy;

    protected PlatformSettingEntity() {
        // Hibernate
    }

    public PlatformSettingEntity(String settingKey, String settingValue, PlatformSettingType valueType) {
        this.settingKey = settingKey;
        this.settingValue = settingValue;
        this.valueType = valueType;
    }

    public String getSettingKey() { return settingKey; }
    public String getSettingValue() { return settingValue; }
    public void setSettingValue(String settingValue) { this.settingValue = settingValue; }
    public PlatformSettingType getValueType() { return valueType; }
    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
```

Créer `src/main/java/com/yadony/api/config/PlatformSettingRepository.java` :

```java
package com.yadony.api.config;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlatformSettingRepository extends JpaRepository<PlatformSettingEntity, UUID> {

    Optional<PlatformSettingEntity> findBySettingKey(String settingKey);
}
```

- [ ] **Étape 6 : Écrire l'amorçage**

Créer `src/main/java/com/yadony/api/config/PlatformSettingsInitializer.java` :

```java
package com.yadony.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.Map;

/**
 * Garnit platform_settings a partir des properties deja resolues, une seule fois, sans
 * jamais ecraser une valeur existante.
 *
 * <p>Le seed vit ici et non dans la migration parce que les quatre valeurs viennent de
 * sources heterogenes : trois sous {@code yadony.*} via {@link YadonyConfigProperties},
 * la quatrieme sous {@code app.sms.enabled}, lue en {@code @Value} — et toutes
 * surchargeables par variable d'environnement, invisible depuis du SQL.
 */
@Component
public class PlatformSettingsInitializer {

    private static final Logger log = LoggerFactory.getLogger(PlatformSettingsInitializer.class);

    private final PlatformSettingRepository repository;
    private final YadonyConfigProperties config;
    private final boolean smsEnabledProperty;

    public PlatformSettingsInitializer(PlatformSettingRepository repository,
                                       YadonyConfigProperties config,
                                       @Value("${app.sms.enabled:false}") boolean smsEnabledProperty) {
        this.repository = repository;
        this.config = config;
        this.smsEnabledProperty = smsEnabledProperty;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        int inserted = seedMissingKeys();
        if (inserted > 0) {
            log.info("[CONFIG] {} parametre(s) plateforme amorce(s) depuis les properties", inserted);
        }
    }

    /** @return le nombre de lignes reellement inserees. Idempotent. */
    @Transactional
    public int seedMissingKeys() {
        Map<PlatformSettingKey, String> defaults = new EnumMap<>(PlatformSettingKey.class);
        defaults.put(PlatformSettingKey.COMMISSION_RATE,
                config.commission().rate().toPlainString());
        defaults.put(PlatformSettingKey.URGENCY_THRESHOLD_DAYS,
                String.valueOf(config.urgency().thresholdDays()));
        defaults.put(PlatformSettingKey.REIMBURSEMENT_CAP_EUR,
                config.reimbursement().maxAmountEur().toPlainString());
        defaults.put(PlatformSettingKey.SMS_ENABLED,
                String.valueOf(smsEnabledProperty));

        int inserted = 0;
        for (Map.Entry<PlatformSettingKey, String> entry : defaults.entrySet()) {
            PlatformSettingKey key = entry.getKey();
            if (repository.findBySettingKey(key.key()).isEmpty()) {
                repository.save(new PlatformSettingEntity(key.key(), entry.getValue(), key.type()));
                inserted++;
            }
        }
        return inserted;
    }
}
```

- [ ] **Étape 7 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=PlatformSettingsInitializerIT
```

Attendu : `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 8 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T5 **+ 5**, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 9 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/resources/db/migration/V222__platform_settings.sql \
        src/main/java/com/yadony/api/config/ \
        src/test/java/com/yadony/api/config/PlatformSettingsInitializerIT.java
git commit -m "feat(config): table des parametres plateforme, amorcee depuis les properties"
```

---

### Task 7 : Lecture cachée, écriture validée et audit des paramètres

**Dépôt :** `dony-back`

**Files:**
- Create: `src/main/java/com/yadony/api/config/PlatformSettingsCache.java`
- Create: `src/main/java/com/yadony/api/config/PlatformSettingsSnapshot.java`
- Create: `src/main/java/com/yadony/api/config/PlatformSettingsService.java`
- Modify: `src/main/java/com/yadony/api/config/CacheConfig.java`
- Test: `src/test/java/com/yadony/api/config/PlatformSettingsServiceIT.java`

**Interfaces:**
- Consumes: `PlatformSettingRepository` / `PlatformSettingKey` / `PlatformSettingEntity` (T6) ; `YadonyConfigProperties` ; `AuditService.log(...)`.
- Produces:
  - `PlatformSettingsCache.all() -> Map<String,String>` (`@Cacheable("platform-settings")`), `PlatformSettingsCache.evict()` (`@CacheEvict allEntries`).
  - `PlatformSettingsService.commissionRate() -> BigDecimal`
  - `PlatformSettingsService.urgencyThresholdDays() -> int`
  - `PlatformSettingsService.reimbursementCapEur() -> BigDecimal`
  - `PlatformSettingsService.smsEnabled() -> boolean`
  - `PlatformSettingsService.snapshot() -> PlatformSettingsSnapshot`
  - `PlatformSettingsService.update(Map<PlatformSettingKey,String> changes, UUID adminId) -> PlatformSettingsSnapshot`
  - `record PlatformSettingsSnapshot(BigDecimal commissionRate, int urgencyThresholdDays, BigDecimal reimbursementCapEur, boolean smsEnabled, LocalDateTime updatedAt, UUID updatedBy)`

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/config/PlatformSettingsServiceIT.java` :

```java
package com.yadony.api.config;

import com.yadony.api.common.AuditService;
import com.yadony.api.common.YadonyBusinessException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@SpringBootTest
@ActiveProfiles("test")
@DisplayName("PlatformSettingsServiceIT — lecture cachee, ecriture bornee, audit")
class PlatformSettingsServiceIT {

    @Autowired PlatformSettingsService service;
    @Autowired PlatformSettingRepository repository;
    @Autowired PlatformSettingsInitializer initializer;
    @Autowired PlatformSettingsCache cache;
    @Autowired CacheManager cacheManager;
    @Autowired YadonyConfigProperties config;

    @MockitoBean AuditService auditService;

    private static final UUID ADMIN_ID = UUID.randomUUID();

    /**
     * ⚠️ @AfterEach autant que @BeforeEach : la H2 de test est PARTAGEE entre contextes
     * ({@code DB_CLOSE_DELAY=-1}) et l'amorcage ne rejoue pas. Laisser {@code sms_enabled=true}
     * derriere soi ferait echouer {@code ConfigControllerSmsEnabledTest}, qui attend false.
     */
    @BeforeEach
    @AfterEach
    void reset() {
        repository.deleteAll();
        cache.evict();
        initializer.seedMissingKeys();
        cache.evict();
    }

    private static Map<PlatformSettingKey, String> change(PlatformSettingKey key, String value) {
        Map<PlatformSettingKey, String> changes = new EnumMap<>(PlatformSettingKey.class);
        changes.put(key, value);
        return changes;
    }

    @Test
    @DisplayName("les getters typent la valeur stockee en texte")
    void typedGettersParseStoredText() {
        assertThat(service.commissionRate()).isEqualByComparingTo(config.commission().rate());
        assertThat(service.urgencyThresholdDays()).isEqualTo(config.urgency().thresholdDays());
        assertThat(service.reimbursementCapEur())
                .isEqualByComparingTo(config.reimbursement().maxAmountEur());
        assertThat(service.smsEnabled()).isFalse();
    }

    @Test
    @DisplayName("une cle absente retombe sur la property, jamais sur une exception")
    void missingRowFallsBackToTheProperty() {
        repository.deleteAll();
        cache.evict();

        assertThat(service.commissionRate()).isEqualByComparingTo(config.commission().rate());
        assertThat(service.smsEnabled()).isFalse();
    }

    @Test
    @DisplayName("l'ecriture est visible immediatement : le cache est evince")
    void writeEvictsTheCache() {
        service.commissionRate();
        assertThat(cacheManager.getCache("platform-settings")).isNotNull();

        service.update(change(PlatformSettingKey.COMMISSION_RATE, "0.12"), ADMIN_ID);

        assertThat(service.commissionRate()).isEqualByComparingTo(new BigDecimal("0.12"));
    }

    @Test
    @DisplayName("chaque cle modifiee produit une entree audit_log avec ancienne et nouvelle valeur")
    void eachChangeIsAudited() {
        service.update(change(PlatformSettingKey.SMS_ENABLED, "true"), ADMIN_ID);

        verify(auditService).log(eq("platform_setting"), any(UUID.class),
                eq("PLATFORM_SETTING_CHANGED"), eq(ADMIN_ID), any(Map.class));
    }

    @Test
    @DisplayName("une valeur identique n'est ni ecrite ni auditee")
    void unchangedValueIsNotAudited() {
        String current = config.commission().rate().toPlainString();

        service.update(change(PlatformSettingKey.COMMISSION_RATE, current), ADMIN_ID);

        verify(auditService, never()).log(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("taux de commission au-dela de 30 % → 422")
    void commissionRateAbove30PercentIsRejected() {
        assertThatThrownBy(() ->
                service.update(change(PlatformSettingKey.COMMISSION_RATE, "0.31"), ADMIN_ID))
                .isInstanceOf(YadonyBusinessException.class)
                .hasMessageContaining("0 et 30");
    }

    @Test
    @DisplayName("taux de commission negatif → 422")
    void negativeCommissionRateIsRejected() {
        assertThatThrownBy(() ->
                service.update(change(PlatformSettingKey.COMMISSION_RATE, "-0.01"), ADMIN_ID))
                .isInstanceOf(YadonyBusinessException.class);
    }

    @Test
    @DisplayName("plafond de remboursement au-dela de 500 € → 422")
    void reimbursementCapAbove500IsRejected() {
        assertThatThrownBy(() ->
                service.update(change(PlatformSettingKey.REIMBURSEMENT_CAP_EUR, "501"), ADMIN_ID))
                .isInstanceOf(YadonyBusinessException.class)
                .hasMessageContaining("500");
    }

    @Test
    @DisplayName("seuil d'urgence hors de 1..30 jours → 422")
    void urgencyThresholdOutOfRangeIsRejected() {
        assertThatThrownBy(() ->
                service.update(change(PlatformSettingKey.URGENCY_THRESHOLD_DAYS, "0"), ADMIN_ID))
                .isInstanceOf(YadonyBusinessException.class)
                .hasMessageContaining("1 et 30");
    }

    @Test
    @DisplayName("valeur non numerique → 422, pas 500")
    void nonNumericValueIsRejectedAs422() {
        assertThatThrownBy(() ->
                service.update(change(PlatformSettingKey.COMMISSION_RATE, "beaucoup"), ADMIN_ID))
                .isInstanceOf(YadonyBusinessException.class);
    }

    @Test
    @DisplayName("le cliche porte l'auteur et la date de la derniere modification")
    void snapshotCarriesLastEditor() {
        service.update(change(PlatformSettingKey.SMS_ENABLED, "true"), ADMIN_ID);

        PlatformSettingsSnapshot snapshot = service.snapshot();

        assertThat(snapshot.smsEnabled()).isTrue();
        assertThat(snapshot.updatedBy()).isEqualTo(ADMIN_ID);
        assertThat(snapshot.updatedAt()).isNotNull();
    }

    @Test
    @DisplayName("une modification refusee ne laisse aucune trace")
    void rejectedUpdateChangesNothing() {
        BigDecimal before = service.commissionRate();

        assertThatThrownBy(() ->
                service.update(change(PlatformSettingKey.COMMISSION_RATE, "0.99"), ADMIN_ID))
                .isInstanceOf(YadonyBusinessException.class);

        assertThat(service.commissionRate()).isEqualByComparingTo(before);
    }
}
```

- [ ] **Étape 2 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=PlatformSettingsServiceIT
```

Attendu : **échec de compilation** — `cannot find symbol: class PlatformSettingsService`.

- [ ] **Étape 3 : Enregistrer le cache**

Dans `src/main/java/com/yadony/api/config/CacheConfig.java`, insérer ce bloc **avant** l'appel `manager.setCacheNames(...)` (juste après la boucle `bids-me` / `traveler-bids-me` / `negotiations-me`) :

```java
        // platform-settings : une seule entree ("all"), TTL courte de 30 s ET eviction
        // explicite a l'ecriture. Contrairement aux caches "/me" ci-dessus, celui-ci a un
        // point d'ecriture UNIQUE (PUT /admin/settings) : l'eviction exhaustive y est donc
        // fiable, et la TTL n'est qu'un filet en cas d'ecriture faite hors application.
        //
        // ⚠️ registerCustomCache et NON setCacheNames : setCacheNames s'execute apres et fait
        // cacheMap.keySet().retainAll(customCacheNames) — les caches personnalises survivent,
        // mais une entree ajoutee a la liste setCacheNames prendrait le spec par defaut
        // (5 min), pas cette TTL.
        manager.registerCustomCache("platform-settings",
                Caffeine.newBuilder()
                        .maximumSize(1)
                        .expireAfterWrite(30, TimeUnit.SECONDS)
                        .build());
```

- [ ] **Étape 4 : Écrire le bean de cache**

Créer `src/main/java/com/yadony/api/config/PlatformSettingsCache.java` :

```java
package com.yadony.api.config;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Bean SEPARE de {@link PlatformSettingsService}, et c'est le point important.
 *
 * <p>{@code @Cacheable} passe par un proxy : une methode annotee appelee depuis une autre
 * methode du MEME bean court-circuite ce proxy et frappe la base a chaque fois, en silence.
 * Si {@code commissionRate()}, {@code smsEnabled()} etc. vivaient dans la meme classe que
 * le {@code @Cacheable}, aucun d'eux ne serait cache — et {@code /config/commission-rate},
 * appele par l'application mobile a chaque demarrage, interrogerait PostgreSQL a chaque fois.
 */
@Service
public class PlatformSettingsCache {

    private final PlatformSettingRepository repository;

    public PlatformSettingsCache(PlatformSettingRepository repository) {
        this.repository = repository;
    }

    /** Cle unique : les quatre parametres tiennent en une entree, lue ensemble. */
    @Cacheable(cacheNames = "platform-settings", key = "'all'")
    @Transactional(readOnly = true)
    public Map<String, String> all() {
        Map<String, String> values = new LinkedHashMap<>();
        for (PlatformSettingEntity entity : repository.findAll()) {
            values.put(entity.getSettingKey(), entity.getSettingValue());
        }
        return values;
    }

    @CacheEvict(cacheNames = "platform-settings", allEntries = true)
    public void evict() {
        // L'annotation fait tout le travail.
    }
}
```

- [ ] **Étape 5 : Écrire le cliché et le service**

Créer `src/main/java/com/yadony/api/config/PlatformSettingsSnapshot.java` :

```java
package com.yadony.api.config;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Etat complet des parametres plateforme, avec la trace de la derniere modification.
 * {@code updatedBy} est null tant qu'aucun administrateur n'a rien change (valeurs amorcees).
 */
public record PlatformSettingsSnapshot(
        BigDecimal commissionRate,
        int urgencyThresholdDays,
        BigDecimal reimbursementCapEur,
        boolean smsEnabled,
        LocalDateTime updatedAt,
        UUID updatedBy) {
}
```

Créer `src/main/java/com/yadony/api/config/PlatformSettingsService.java` :

```java
package com.yadony.api.config;

import com.yadony.api.common.AuditService;
import com.yadony.api.common.YadonyBusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Source unique des quatre parametres plateforme.
 *
 * <p>La table fait autorite ; les properties ne servent plus que de filet de securite
 * quand une ligne manque (fenetre entre la migration et l'amorcage, base restauree
 * partiellement). Sans ce filet, {@code /config/commission-rate} — appele par
 * l'application mobile deployee — repondrait 500 au lieu de sa valeur habituelle.
 */
@Service
public class PlatformSettingsService {

    /** 30 % : au-dela, la commission cesserait d'etre une commission. */
    private static final BigDecimal MAX_COMMISSION_RATE = new BigDecimal("0.30");
    /** 500 € : plafond de la valeur declaree d'un colis, deja applique cote metier. */
    private static final BigDecimal MAX_REIMBURSEMENT_CAP = new BigDecimal("500");
    private static final int MIN_URGENCY_DAYS = 1;
    private static final int MAX_URGENCY_DAYS = 30;

    private final PlatformSettingRepository repository;
    private final PlatformSettingsCache cache;
    private final AuditService auditService;
    private final YadonyConfigProperties config;
    private final boolean smsEnabledProperty;

    public PlatformSettingsService(PlatformSettingRepository repository,
                                   PlatformSettingsCache cache,
                                   AuditService auditService,
                                   YadonyConfigProperties config,
                                   @Value("${app.sms.enabled:false}") boolean smsEnabledProperty) {
        this.repository = repository;
        this.cache = cache;
        this.auditService = auditService;
        this.config = config;
        this.smsEnabledProperty = smsEnabledProperty;
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    public BigDecimal commissionRate() {
        String raw = cache.all().get(PlatformSettingKey.COMMISSION_RATE.key());
        return raw == null ? config.commission().rate() : new BigDecimal(raw);
    }

    public int urgencyThresholdDays() {
        String raw = cache.all().get(PlatformSettingKey.URGENCY_THRESHOLD_DAYS.key());
        return raw == null ? config.urgency().thresholdDays() : Integer.parseInt(raw);
    }

    public BigDecimal reimbursementCapEur() {
        String raw = cache.all().get(PlatformSettingKey.REIMBURSEMENT_CAP_EUR.key());
        return raw == null ? config.reimbursement().maxAmountEur() : new BigDecimal(raw);
    }

    public boolean smsEnabled() {
        String raw = cache.all().get(PlatformSettingKey.SMS_ENABLED.key());
        return raw == null ? smsEnabledProperty : Boolean.parseBoolean(raw);
    }

    @Transactional(readOnly = true)
    public PlatformSettingsSnapshot snapshot() {
        List<PlatformSettingEntity> rows = repository.findAll();
        PlatformSettingEntity mostRecent = rows.stream()
                .filter(row -> row.getUpdatedBy() != null)
                .max((a, b) -> a.getUpdatedAt().compareTo(b.getUpdatedAt()))
                .orElse(null);
        return new PlatformSettingsSnapshot(
                commissionRate(), urgencyThresholdDays(), reimbursementCapEur(), smsEnabled(),
                mostRecent == null ? null : mostRecent.getUpdatedAt(),
                mostRecent == null ? null : mostRecent.getUpdatedBy());
    }

    // ── Ecriture ─────────────────────────────────────────────────────────────

    /**
     * Applique les seules cles presentes dans {@code changes}. Une valeur identique a
     * l'existante n'ecrit rien et n'audite rien : audit_log est immuable, le polluer de
     * non-changements le rendrait illisible.
     */
    @Transactional
    public PlatformSettingsSnapshot update(Map<PlatformSettingKey, String> changes, UUID adminId) {
        boolean touched = false;
        for (Map.Entry<PlatformSettingKey, String> entry : changes.entrySet()) {
            PlatformSettingKey key = entry.getKey();
            String newValue = normalize(key, entry.getValue());

            PlatformSettingEntity row = repository.findBySettingKey(key.key())
                    .orElseGet(() -> repository.save(
                            new PlatformSettingEntity(key.key(), newValue, key.type())));
            String oldValue = row.getSettingValue();
            if (oldValue.equals(newValue)) {
                continue;
            }

            row.setSettingValue(newValue);
            row.setUpdatedBy(adminId);
            repository.save(row);
            touched = true;

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("key", key.key());
            payload.put("oldValue", oldValue);
            payload.put("newValue", newValue);
            auditService.log("platform_setting", row.getId(),
                    "PLATFORM_SETTING_CHANGED", adminId, payload);
        }
        if (touched) {
            cache.evict();
        }
        return snapshot();
    }

    /** Valide les bornes ET normalise la forme, pour que « 0.10 » et « 0.1 » ne divergent pas. */
    private String normalize(PlatformSettingKey key, String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            throw invalid("La valeur de " + key.key() + " est obligatoire");
        }
        String value = rawValue.trim();
        return switch (key) {
            case COMMISSION_RATE -> {
                BigDecimal rate = parseDecimal(key, value);
                if (rate.signum() < 0 || rate.compareTo(MAX_COMMISSION_RATE) > 0) {
                    throw invalid("Le taux de commission doit etre compris entre 0 et 30 %");
                }
                yield rate.toPlainString();
            }
            case REIMBURSEMENT_CAP_EUR -> {
                BigDecimal cap = parseDecimal(key, value);
                if (cap.signum() <= 0 || cap.compareTo(MAX_REIMBURSEMENT_CAP) > 0) {
                    throw invalid("Le plafond de remboursement doit etre compris entre 0 et 500 euros");
                }
                yield cap.toPlainString();
            }
            case URGENCY_THRESHOLD_DAYS -> {
                int days;
                try {
                    days = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    throw invalid("Le seuil d'urgence doit etre un nombre entier de jours");
                }
                if (days < MIN_URGENCY_DAYS || days > MAX_URGENCY_DAYS) {
                    throw invalid("Le seuil d'urgence doit etre compris entre 1 et 30 jours");
                }
                yield String.valueOf(days);
            }
            case SMS_ENABLED -> {
                if (!"true".equalsIgnoreCase(value) && !"false".equalsIgnoreCase(value)) {
                    throw invalid("L'activation des SMS attend true ou false");
                }
                yield String.valueOf(Boolean.parseBoolean(value));
            }
        };
    }

    private BigDecimal parseDecimal(PlatformSettingKey key, String value) {
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException e) {
            throw invalid("La valeur de " + key.key() + " doit etre un nombre");
        }
    }

    private YadonyBusinessException invalid(String detail) {
        return new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                "platform-setting-invalid", "Unprocessable Entity", detail);
    }
}
```

- [ ] **Étape 6 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=PlatformSettingsServiceIT
```

Attendu : `Tests run: 11, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 7 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T6 **+ 11**, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 8 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/config/ src/test/java/com/yadony/api/config/PlatformSettingsServiceIT.java
git commit -m "feat(config): lecture cachee, ecriture bornee et audit des parametres plateforme"
```

---

### Task 8 : Bascule des consommateurs sur la table, contrat public inchangé

**Dépôt :** `dony-back`

**Files:**
- Modify: `src/main/java/com/yadony/api/config/ConfigController.java`
- Modify: `src/main/java/com/yadony/api/common/CommissionRateResolver.java`
- Modify: `src/main/java/com/yadony/api/notifications/SmsService.java`
- Test: `src/test/java/com/yadony/api/config/PlatformSettingsLiveEffectIT.java` *(create)*

**Interfaces:**
- Consumes: `PlatformSettingsService.commissionRate/urgencyThresholdDays/reimbursementCapEur/smsEnabled` (T7).
- Produces (contrats **strictement inchangés**, l'application mobile déployée en dépend) :
  - `GET /config/commission-rate` → `{"rate": <BigDecimal>}`
  - `GET /config/urgency-threshold` → `{"thresholdDays": <Integer>}`
  - `GET /config/reimbursement-cap` → `{"maxAmountEur": <BigDecimal>}`
  - `GET /config/sms-enabled` → `{"enabled": <boolean>}`
  - `CommissionRateResolver.globalRate()` garde sa signature `-> BigDecimal` (tous les consommateurs en aval — `BidService`, `PriceGridService`, `PaymentService`, `CashCommissionService`, `NegotiationService`, `BidNegotiationService`, `PackageRequestService`, `MobileMoneyCommissionListener` — restent intacts).
  - `SmsService.isEnabled() -> boolean` garde sa signature (lue par `SmsOtpService:76,105` et `SmsOtpConfigurationGuard`).

> ⚠️ **Le geste le plus risqué du lot.** `/config/**` est `permitAll` (`SecurityConfig`, ligne « `/config/**` ») et consommé **en production** par l'application mobile. Toute modification de forme — un champ renommé, un niveau d'imbrication, un `null` là où il y avait une valeur — casse des installations déjà déployées. On change **la source**, jamais la forme.

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/config/PlatformSettingsLiveEffectIT.java`. Ce test est la preuve du critère d'acceptation n°6 (« effective sans redéploiement ») **et** le garde-fou du contrat public.

```java
package com.yadony.api.config;

import com.yadony.api.common.AuditService;
import com.yadony.api.common.CommissionRateResolver;
import com.yadony.api.notifications.SmsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lot D — critere d'acceptation n°6 : une modification de parametre est effective sans
 * redeploiement, sur les trois consommateurs (contrat public, resolveur de commission,
 * service SMS) — et le contrat JSON de {@code /config/**} ne bouge pas d'un octet.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("PlatformSettingsLiveEffectIT — effet a chaud, contrat public preserve")
class PlatformSettingsLiveEffectIT {

    @Autowired MockMvc mockMvc;
    @Autowired PlatformSettingsService settingsService;
    @Autowired PlatformSettingRepository repository;
    @Autowired PlatformSettingsInitializer initializer;
    @Autowired PlatformSettingsCache cache;
    @Autowired CommissionRateResolver commissionRateResolver;
    @Autowired SmsService smsService;

    @MockitoBean AuditService auditService;

    private static final UUID ADMIN_ID = UUID.randomUUID();

    @BeforeEach
    @AfterEach
    void reset() {
        repository.deleteAll();
        cache.evict();
        initializer.seedMissingKeys();
        cache.evict();
    }

    private static Map<PlatformSettingKey, String> change(PlatformSettingKey key, String value) {
        Map<PlatformSettingKey, String> changes = new EnumMap<>(PlatformSettingKey.class);
        changes.put(key, value);
        return changes;
    }

    // ── Contrat public : la FORME ne change pas ──────────────────────────────

    @Test
    @DisplayName("les quatre routes publiques gardent leurs noms de champ exacts, sans authentification")
    void publicContractShapeIsUnchanged() throws Exception {
        mockMvc.perform(get("/config/commission-rate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rate").value(0.12));
        mockMvc.perform(get("/config/urgency-threshold"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.thresholdDays").value(3));
        mockMvc.perform(get("/config/reimbursement-cap"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxAmountEur").value(50));
        mockMvc.perform(get("/config/sms-enabled"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
    }

    // ── Effet a chaud sur chacun des trois consommateurs ─────────────────────

    @Test
    @DisplayName("le taux modifie est servi par /config/commission-rate sans redemarrage")
    void commissionRateChangeIsVisibleOnThePublicRoute() throws Exception {
        settingsService.update(change(PlatformSettingKey.COMMISSION_RATE, "0.07"), ADMIN_ID);

        mockMvc.perform(get("/config/commission-rate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rate").value(0.07));
    }

    @Test
    @DisplayName("le taux modifie devient le taux global du resolveur de commission")
    void commissionRateChangeReachesTheResolver() {
        settingsService.update(change(PlatformSettingKey.COMMISSION_RATE, "0.07"), ADMIN_ID);

        assertThat(commissionRateResolver.globalRate()).isEqualByComparingTo(new BigDecimal("0.07"));
    }

    @Test
    @DisplayName("le seuil d'urgence modifie est servi en JOURS, pas en heures")
    void urgencyThresholdStaysInDays() throws Exception {
        settingsService.update(change(PlatformSettingKey.URGENCY_THRESHOLD_DAYS, "5"), ADMIN_ID);

        mockMvc.perform(get("/config/urgency-threshold"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.thresholdDays").value(5));
    }

    @Test
    @DisplayName("le plafond de remboursement modifie est servi par la route publique")
    void reimbursementCapChangeIsVisible() throws Exception {
        settingsService.update(change(PlatformSettingKey.REIMBURSEMENT_CAP_EUR, "80"), ADMIN_ID);

        mockMvc.perform(get("/config/reimbursement-cap"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxAmountEur").value(80));
    }

    @Test
    @DisplayName("basculer sms_enabled change AUSSI SmsService.isEnabled — donc l'OTP SMS")
    void smsEnabledChangeReachesSmsService() throws Exception {
        assertThat(smsService.isEnabled()).isFalse();

        settingsService.update(change(PlatformSettingKey.SMS_ENABLED, "true"), ADMIN_ID);

        assertThat(smsService.isEnabled()).isTrue();
        mockMvc.perform(get("/config/sms-enabled"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    @DisplayName("table videe : les routes publiques repondent encore, depuis les properties")
    void emptyTableFallsBackToPropertiesInsteadOfFailing() throws Exception {
        repository.deleteAll();
        cache.evict();

        mockMvc.perform(get("/config/commission-rate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rate").value(0.12));
        mockMvc.perform(get("/config/sms-enabled"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
    }
}
```

- [ ] **Étape 2 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=PlatformSettingsLiveEffectIT
```

Attendu : échec sur `commissionRateChangeIsVisibleOnThePublicRoute` — `expected 0.07 but was 0.12` (le contrôleur lit encore les properties statiques).

- [ ] **Étape 3 : Basculer le contrôleur public**

Remplacer intégralement `src/main/java/com/yadony/api/config/ConfigController.java` :

```java
package com.yadony.api.config;

import com.yadony.api.config.dto.CommissionRateResponse;
import com.yadony.api.config.dto.ContentCategoryResponse;
import com.yadony.api.config.dto.ReimbursementCapResponse;
import com.yadony.api.config.dto.SmsEnabledResponse;
import com.yadony.api.config.dto.UrgencyThresholdResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Configuration publique lue par l'application mobile. Routes {@code permitAll}
 * ({@code SecurityConfig}).
 *
 * <p>⚠️ Lot D : la SOURCE a change (table {@code platform_settings} + cache Caffeine), la
 * FORME des reponses n'a pas bouge d'un octet — memes routes, memes DTO, memes noms de
 * champ. Des installations deja deployees consomment ces quatre routes : renommer un champ
 * ou imbriquer une valeur les casserait sans qu'aucun test de ce depot ne s'en apercoive.
 * {@link PlatformSettingsLiveEffectIT} verrouille cette forme.
 */
@RestController
@RequestMapping("/config")
public class ConfigController {

    private final PlatformSettingsService settings;

    public ConfigController(PlatformSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping("/commission-rate")
    public ResponseEntity<CommissionRateResponse> getCommissionRate() {
        return ResponseEntity.ok(new CommissionRateResponse(settings.commissionRate()));
    }

    @GetMapping("/urgency-threshold")
    public ResponseEntity<UrgencyThresholdResponse> getUrgencyThreshold() {
        return ResponseEntity.ok(new UrgencyThresholdResponse(settings.urgencyThresholdDays()));
    }

    @GetMapping("/reimbursement-cap")
    public ResponseEntity<ReimbursementCapResponse> getReimbursementCap() {
        return ResponseEntity.ok(new ReimbursementCapResponse(settings.reimbursementCapEur()));
    }

    @GetMapping("/content-categories")
    public ResponseEntity<List<ContentCategoryResponse>> getContentCategories() {
        return ResponseEntity.ok(ContentCatalog.CATEGORIES);
    }

    @GetMapping("/sms-enabled")
    public ResponseEntity<SmsEnabledResponse> getSmsEnabled() {
        return ResponseEntity.ok(new SmsEnabledResponse(settings.smsEnabled()));
    }
}
```

- [ ] **Étape 4 : Basculer le résolveur de commission**

Dans `src/main/java/com/yadony/api/common/CommissionRateResolver.java` :

1. Remplacer le champ et l'injection `YadonyConfigProperties config` par `PlatformSettingsService settings` (ajouter l'import `com.yadony.api.config.PlatformSettingsService`, retirer celui de `YadonyConfigProperties` s'il devient inutilisé).
2. Remplacer le corps de `globalRate()` :

```java
    /**
     * Taux global par defaut. Lot D : lu dans {@code platform_settings} (cache Caffeine,
     * TTL 30 s, evince a l'ecriture) au lieu de la property {@code yadony.commission.rate},
     * qui n'en reste que le repli quand la ligne manque. Point de bascule UNIQUE : les huit
     * services consommateurs passent tous par ici et n'ont pas ete touches.
     */
    public BigDecimal globalRate() {
        return settings.commissionRate();
    }
```

3. Adapter le constructeur :

```java
    public CommissionRateResolver(UserRepository userRepository,
                                  PlatformSettingsService settings,
                                  PromoService promoService) {
        this.userRepository = userRepository;
        this.settings = settings;
        this.promoService = promoService;
    }
```

> Si `CommissionRateResolverTest` (`src/test/java/com/yadony/api/common/CommissionRateResolverTest.java`) instancie le résolveur avec un `YadonyConfigProperties`, y remplacer le mock par un `PlatformSettingsService` mocké dont `commissionRate()` renvoie la même valeur. **Ne pas changer les valeurs attendues** : le test doit rester le même sur le fond.

- [ ] **Étape 5 : Basculer le service SMS**

Dans `src/main/java/com/yadony/api/notifications/SmsService.java` :

1. Supprimer le champ `@Value("${app.sms.enabled:false}") private boolean smsEnabled;`.
2. Injecter `PlatformSettingsService` dans le constructeur existant (ajouter l'import `com.yadony.api.config.PlatformSettingsService`) :

```java
    private final RestTemplate restTemplate;
    private final PlatformSettingsService settings;

    public SmsService(RestTemplate restTemplate, PlatformSettingsService settings) {
        this.restTemplate = restTemplate;
        this.settings = settings;
    }

    /**
     * ⚠️ Lot D : cette valeur est desormais editable a chaud depuis le back-office.
     * Elle ne pilote PAS que les SMS de repli des notifications critiques : elle conditionne
     * aussi l'envoi des codes OTP ({@code SmsOtpService:76,105}). La passer a false coupe la
     * connexion par telephone pour tout le monde — d'ou la double confirmation par saisie
     * exigee cote back-office.
     */
    public boolean isEnabled() {
        return settings.smsEnabled();
    }
```

3. Dans `send(String phoneNumber, String message)`, remplacer la garde `if (!smsEnabled) {` par `if (!isEnabled()) {` — sinon le toggle n'aurait aucun effet sur l'envoi réel.
4. Vérifier qu'aucune autre occurrence du champ ne subsiste :

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
grep -n "smsEnabled" src/main/java/com/yadony/api/notifications/SmsService.java
```

Attendu : aucune ligne référençant un champ (seuls les appels `isEnabled()`).

- [ ] **Étape 6 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=PlatformSettingsLiveEffectIT
```

Attendu : `Tests run: 7, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 7 : Vérifier explicitement les tests de contrat existants**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest='ConfigControllerIT,ConfigControllerSmsEnabledTest,ConfigControllerReimbursementTest,CommissionRateResolverTest,SmsServiceTest'
```

Attendu : **tous verts sans avoir modifié la moindre assertion**. C'est la preuve que le contrat public est intact. Si l'un d'eux exige une modification d'assertion, **s'arrêter** : cela signifie que la forme a changé, ce que ce lot interdit.

- [ ] **Étape 8 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T7 **+ 7**, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 9 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/config/ConfigController.java \
        src/main/java/com/yadony/api/common/CommissionRateResolver.java \
        src/main/java/com/yadony/api/notifications/SmsService.java \
        src/test/java/com/yadony/api/config/PlatformSettingsLiveEffectIT.java \
        src/test/java/com/yadony/api/common/CommissionRateResolverTest.java
git commit -m "feat(config): les parametres plateforme deviennent la source, contrat public inchange"
```

---

### Task 9 : Endpoints admin de lecture et d'écriture des paramètres

**Dépôt :** `dony-back`

**Files:**
- Create: `src/main/java/com/yadony/api/admin/dto/PlatformSettingsResponse.java`
- Create: `src/main/java/com/yadony/api/admin/dto/PlatformSettingsUpdateRequest.java`
- Create: `src/main/java/com/yadony/api/admin/AdminSettingsController.java`
- Test: `src/test/java/com/yadony/api/admin/AdminSettingsControllerIT.java`

**Interfaces:**
- Consumes: `PlatformSettingsService.snapshot/update` (T7) ; `PlatformSettingsSnapshot` ; `AdminUserRepository.findById(UUID) -> Optional<AdminUserEntity>` + `AdminUserEntity.getEmail()` ; `AdminPrincipal.adminId()`.
- Produces (contrat HTTP consommé par le front en T14) :
  - `GET /admin/settings` → **200** `List<PlatformSettingResponse>`
  - `PUT /admin/settings/{key}` body `{"value": "..."}` → **200** `PlatformSettingResponse`
  - `record PlatformSettingResponse(String key, String value, String type, LocalDateTime updatedAt, String updatedByEmail)` — `type` ∈ `INT | DECIMAL | BOOLEAN`
  - `record PlatformSettingUpdateRequest(String value)`

> ⚠️ **CONTRAT TRANCHÉ — ne pas revenir au format objet typé.** Une version antérieure de ce
> plan décrivait ici un objet unique `PlatformSettingsResponse` à champs typés, avec un
> seul couple `updatedAt`/`updatedBy` pour l'ensemble des réglages. C'était incompatible
> avec la tâche 14 (déjà livrée, commit `e993da0`) et surtout **moins juste** : la table
> `platform_settings` est nativement clé/valeur, l'audit `PLATFORM_SETTING_CHANGED` est
> écrit **par clé**, et le spec exige d'afficher qui a modifié quoi et quand. Un objet plat
> écrase cette information — on ne saurait plus quel réglage a été touché par qui.
>
> Le `PlatformSettingsSnapshot` typé de la tâche 7 **reste inchangé** : c'est la
> représentation interne mise en cache, lue par le `ConfigController` public qui a besoin
> d'un accès typé rapide. Seuls les endpoints d'administration exposent la liste par clé.

> ⚠️ `spring.jackson.default-property-inclusion: NON_NULL` (application.yml) : `updatedAt`
> et `updatedByEmail` sont **absents du JSON** tant qu'un réglage n'a jamais été modifié.
> Le front les traite déjà comme optionnels (T14).

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `src/test/java/com/yadony/api/admin/AdminSettingsControllerIT.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.account.AdminRole;
import com.yadony.api.admin.account.AdminUserEntity;
import com.yadony.api.admin.account.AdminUserRepository;
import com.yadony.api.common.YadonyBusinessException;
import com.yadony.api.config.PlatformSettingKey;
import com.yadony.api.config.PlatformSettingsService;
import com.yadony.api.config.PlatformSettingsSnapshot;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lot D — matrice de permission et mapping HTTP des parametres plateforme.
 * SUPPORT ne recoit PAS CONFIG_MANAGE : lecture comme ecriture lui sont fermees.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("AdminSettingsControllerIT — /admin/settings")
class AdminSettingsControllerIT {

    @Autowired MockMvc mockMvc;

    @MockitoBean PlatformSettingsService settingsService;
    @MockitoBean AdminUserRepository adminUserRepository;

    private static final UUID ADMIN_ID = UUID.randomUUID();

    private static UsernamePasswordAuthenticationToken adminAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                ADMIN_ID, "admin@yadony.test", AdminRole.ADMIN, false, "uid-admin-settings");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("CONFIG_MANAGE")));
    }

    private static UsernamePasswordAuthenticationToken supportAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "support@yadony.test", AdminRole.SUPPORT, false, "uid-support-settings");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private static PlatformSettingsSnapshot snapshot(boolean smsEnabled, UUID updatedBy) {
        return new PlatformSettingsSnapshot(
                new BigDecimal("0.12"), 3, new BigDecimal("50"), smsEnabled,
                updatedBy == null ? null : LocalDateTime.of(2026, 8, 19, 10, 0), updatedBy);
    }

    // ── GET ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET — SUPPORT (sans CONFIG_MANAGE) → 403")
    void get_withSupportRole_returns403() throws Exception {
        mockMvc.perform(get("/admin/settings").with(authentication(supportAuth())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET — ADMIN → 200 avec les quatre valeurs et l'auteur de la derniere modification")
    void get_withAdmin_returnsSettingsAndLastEditor() throws Exception {
        when(settingsService.snapshot()).thenReturn(snapshot(false, ADMIN_ID));
        AdminUserEntity editor = new AdminUserEntity("uid-editor", "editeur@yadony.test", AdminRole.ADMIN);
        when(adminUserRepository.findById(ADMIN_ID)).thenReturn(Optional.of(editor));

        mockMvc.perform(get("/admin/settings").with(authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commissionRate").value(0.12))
                .andExpect(jsonPath("$.urgencyThresholdDays").value(3))
                .andExpect(jsonPath("$.reimbursementCapEur").value(50))
                .andExpect(jsonPath("$.smsEnabled").value(false))
                .andExpect(jsonPath("$.updatedByEmail").value("editeur@yadony.test"));
    }

    @Test
    @DisplayName("GET — jamais modifie : les champs de derniere modification sont absents")
    void get_neverEdited_omitsEditorFields() throws Exception {
        when(settingsService.snapshot()).thenReturn(snapshot(false, null));

        mockMvc.perform(get("/admin/settings").with(authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedBy").doesNotExist())
                .andExpect(jsonPath("$.updatedByEmail").doesNotExist());
    }

    // ── PUT ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("PUT — SUPPORT (sans CONFIG_MANAGE) → 403 et rien n'est ecrit")
    void put_withSupportRole_returns403() throws Exception {
        mockMvc.perform(put("/admin/settings")
                        .with(authentication(supportAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"commissionRate":0.07}
                                """))
                .andExpect(status().isForbidden());

        verify(settingsService, never()).update(anyMap(), any());
    }

    @Test
    @DisplayName("PUT — seules les cles presentes sont transmises au service")
    void put_appliesOnlyProvidedKeys() throws Exception {
        when(settingsService.update(anyMap(), eq(ADMIN_ID))).thenReturn(snapshot(false, ADMIN_ID));
        when(adminUserRepository.findById(ADMIN_ID)).thenReturn(Optional.empty());

        mockMvc.perform(put("/admin/settings")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"commissionRate":0.07}
                                """))
                .andExpect(status().isOk());

        verify(settingsService).update(
                eq(Map.of(PlatformSettingKey.COMMISSION_RATE, "0.07")), eq(ADMIN_ID));
    }

    @Test
    @DisplayName("PUT — bascule de sms_enabled transmise telle quelle")
    void put_togglesSmsEnabled() throws Exception {
        when(settingsService.update(anyMap(), eq(ADMIN_ID))).thenReturn(snapshot(true, ADMIN_ID));
        when(adminUserRepository.findById(ADMIN_ID)).thenReturn(Optional.empty());

        mockMvc.perform(put("/admin/settings")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"smsEnabled":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.smsEnabled").value(true));

        verify(settingsService).update(
                eq(Map.of(PlatformSettingKey.SMS_ENABLED, "true")), eq(ADMIN_ID));
    }

    @Test
    @DisplayName("PUT — corps entierement vide → 422, on ne valide pas un formulaire sans changement")
    void put_withNoKeyAtAll_returns422() throws Exception {
        mockMvc.perform(put("/admin/settings")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").exists());

        verify(settingsService, never()).update(anyMap(), any());
    }

    @Test
    @DisplayName("PUT — borne depassee : le 422 du service remonte en RFC 7807")
    void put_outOfRange_propagatesProblemDetail() throws Exception {
        doThrow(new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                "platform-setting-invalid", "Unprocessable Entity",
                "Le taux de commission doit etre compris entre 0 et 30 %"))
                .when(settingsService).update(anyMap(), eq(ADMIN_ID));

        mockMvc.perform(put("/admin/settings")
                        .with(authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"commissionRate":0.90}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Le taux de commission doit etre compris entre 0 et 30 %"));
    }
}
```

- [ ] **Étape 2 : Lancer le test et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminSettingsControllerIT
```

Attendu : **échec de compilation** — `cannot find symbol: class AdminSettingsController`.

- [ ] **Étape 3 : Écrire les DTO**

Créer `src/main/java/com/yadony/api/admin/dto/PlatformSettingsResponse.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.config.PlatformSettingsSnapshot;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ⚠️ {@code spring.jackson.default-property-inclusion: NON_NULL} : les trois derniers champs
 * sont ABSENTS du JSON tant qu'aucun administrateur n'a rien modifie. Le back-office doit
 * les traiter comme optionnels.
 */
public record PlatformSettingsResponse(
        BigDecimal commissionRate,
        int urgencyThresholdDays,
        BigDecimal reimbursementCapEur,
        boolean smsEnabled,
        LocalDateTime updatedAt,
        UUID updatedBy,
        String updatedByEmail) {

    public static PlatformSettingsResponse from(PlatformSettingsSnapshot snapshot, String updatedByEmail) {
        return new PlatformSettingsResponse(
                snapshot.commissionRate(), snapshot.urgencyThresholdDays(),
                snapshot.reimbursementCapEur(), snapshot.smsEnabled(),
                snapshot.updatedAt(), snapshot.updatedBy(), updatedByEmail);
    }
}
```

Créer `src/main/java/com/yadony/api/admin/dto/PlatformSettingsUpdateRequest.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.config.PlatformSettingKey;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Map;

/**
 * Mise a jour PARTIELLE : un champ absent (null) n'est pas modifie. Les bornes ne sont pas
 * declarees ici en annotations Bean Validation mais dans
 * {@code PlatformSettingsService.normalize} — une seule regle, un seul endroit, et le meme
 * 422 RFC 7807 quel que soit le chemin d'appel.
 */
public record PlatformSettingsUpdateRequest(
        BigDecimal commissionRate,
        Integer urgencyThresholdDays,
        BigDecimal reimbursementCapEur,
        Boolean smsEnabled) {

    public Map<PlatformSettingKey, String> toChanges() {
        Map<PlatformSettingKey, String> changes = new EnumMap<>(PlatformSettingKey.class);
        if (commissionRate != null) {
            changes.put(PlatformSettingKey.COMMISSION_RATE, commissionRate.toPlainString());
        }
        if (urgencyThresholdDays != null) {
            changes.put(PlatformSettingKey.URGENCY_THRESHOLD_DAYS, String.valueOf(urgencyThresholdDays));
        }
        if (reimbursementCapEur != null) {
            changes.put(PlatformSettingKey.REIMBURSEMENT_CAP_EUR, reimbursementCapEur.toPlainString());
        }
        if (smsEnabled != null) {
            changes.put(PlatformSettingKey.SMS_ENABLED, String.valueOf(smsEnabled));
        }
        return changes;
    }
}
```

- [ ] **Étape 4 : Écrire le contrôleur**

Créer `src/main/java/com/yadony/api/admin/AdminSettingsController.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.account.AdminUserEntity;
import com.yadony.api.admin.account.AdminUserRepository;
import com.yadony.api.admin.dto.PlatformSettingsResponse;
import com.yadony.api.admin.dto.PlatformSettingsUpdateRequest;
import com.yadony.api.common.YadonyBusinessException;
import com.yadony.api.config.PlatformSettingKey;
import com.yadony.api.config.PlatformSettingsService;
import com.yadony.api.config.PlatformSettingsSnapshot;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Lot D — parametres plateforme. Reserve a ADMIN/SUPER_ADMIN : SUPPORT ne recoit pas
 * CONFIG_MANAGE.
 *
 * <p>⚠️ Chaque methode re-declare l'expression COMPLETE : une {@code @PreAuthorize} de
 * methode remplace celle de la classe. Et {@code hasRole('ADMIN')} seule ne filtrerait rien,
 * SUPPORT la portant aussi.
 *
 * <p>La lecture est protegee au meme titre que l'ecriture : le taux de commission global et
 * l'etat des SMS renseignent sur l'economie de la plateforme.
 */
@RestController
@RequestMapping("/admin/settings")
@PreAuthorize("hasRole('ADMIN') and hasAuthority('CONFIG_MANAGE')")
public class AdminSettingsController {

    private final PlatformSettingsService settingsService;
    private final AdminUserRepository adminUserRepository;

    public AdminSettingsController(PlatformSettingsService settingsService,
                                   AdminUserRepository adminUserRepository) {
        this.settingsService = settingsService;
        this.adminUserRepository = adminUserRepository;
    }

    @PreAuthorize("hasRole('ADMIN') and hasAuthority('CONFIG_MANAGE')")
    @GetMapping
    public PlatformSettingsResponse get() {
        return present(settingsService.snapshot());
    }

    /**
     * L'audit_log est ecrit par {@code PlatformSettingsService.update}, cle par cle, avec
     * l'ancienne et la nouvelle valeur — pas ici : une seule ecriture, une seule trace.
     */
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('CONFIG_MANAGE')")
    @PutMapping
    public PlatformSettingsResponse update(@RequestBody @Valid PlatformSettingsUpdateRequest request,
                                           Authentication authentication) {
        Map<PlatformSettingKey, String> changes = request.toChanges();
        if (changes.isEmpty()) {
            throw new YadonyBusinessException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "platform-settings-empty-update", "Unprocessable Entity",
                    "Aucun parametre a modifier");
        }
        return present(settingsService.update(changes, adminId(authentication)));
    }

    /** Resout l'email de l'auteur pour que l'interface affiche un nom, pas un UUID. */
    private PlatformSettingsResponse present(PlatformSettingsSnapshot snapshot) {
        String email = snapshot.updatedBy() == null ? null
                : adminUserRepository.findById(snapshot.updatedBy())
                        .map(AdminUserEntity::getEmail)
                        .orElse(null);
        return PlatformSettingsResponse.from(snapshot, email);
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

- [ ] **Étape 5 : Relancer le test et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest=AdminSettingsControllerIT
```

Attendu : `Tests run: 7, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Étape 6 : Suite complète**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
```

Attendu : baseline T8 **+ 7**, 0 échec. Rapporter le décompte réel.

- [ ] **Étape 7 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/ src/test/java/com/yadony/api/admin/AdminSettingsControllerIT.java
git commit -m "feat(admin): lecture et ecriture des parametres plateforme (CONFIG_MANAGE)"
```

---

### Task 10 : Finances étendues — wallets, mobile money, commissions cash

**Dépôt :** `dony-back`

**Files:**
- Modify: `src/main/java/com/yadony/api/payments/wallet/WalletAccountRepository.java`
- Modify: `src/main/java/com/yadony/api/payments/mobilemoney/MobileMoneyPaymentRepository.java`
- Modify: `src/main/java/com/yadony/api/matching/BidRepository.java`
- Create: `src/main/java/com/yadony/api/admin/dto/AdminWalletAccountResponse.java`
- Create: `src/main/java/com/yadony/api/admin/dto/AdminMobileMoneyPaymentResponse.java`
- Create: `src/main/java/com/yadony/api/admin/dto/AdminCashCommissionResponse.java`
- Create: `src/main/java/com/yadony/api/admin/AdminFinanceController.java`
- Test: `src/test/java/com/yadony/api/admin/AdminFinanceControllerIT.java`
- Test: `src/test/java/com/yadony/api/admin/dto/AdminMobileMoneyPaymentResponseTest.java`

**Interfaces:**
- Consumes: `WalletAccountEntity` (`getUserId/getBalance/getCurrency/getId/getUpdatedAt`) ; `MobileMoneyPaymentEntity` ; `BidEntity` (`getAnnouncementId/getSenderId/getPaymentMethod/getCommissionStatus/getCommissionChargedVia/getCommissionRetryCount/getCommissionRate/getCommissionPaymentIntentId`) ; `UserRepository.findAllById(Iterable<UUID>)` ; `MatchingTextUtil.buildName(UserEntity) -> String`.
- Produces (contrat HTTP consommé par le front en T16) :
  - `GET /admin/finance/wallets?userId&currency&page&size` → `Page<AdminWalletAccountResponse>`
  - `GET /admin/finance/mobile-money?status&provider&page&size` → `Page<AdminMobileMoneyPaymentResponse>`
  - `GET /admin/finance/cash-commissions?commissionStatus&paymentMethod&page&size` → `Page<AdminCashCommissionResponse>`
  - `AdminMobileMoneyPaymentResponse.maskPhone(String raw) -> String` (visible pour le test)

> ⚠️ **Trois pièges tranchés ici.**
> 1. `CommissionChargedVia` ne vaut que `WALLET` ou `CARD` — **il n'existe pas de valeur `CASH`**. Le caractère « hors escrow » se lit sur `BidEntity.paymentMethod` (`STRIPE`, `CASH`, `WAVE`, `ORANGE_MONEY`). Le filtre est donc `payment_method <> 'STRIPE' AND commission_status IS NOT NULL`.
> 2. `mobile_money_payments.phone_number` est un numéro **en clair** : le DTO ne le renvoie que masqué. `payment_link` — une URL de paiement vivante — n'est **pas exposé du tout**.
> 3. `wallet_transactions` **n'a pas** de `deleted_at` (l'entité n'étend pas `BaseEntity`) ; `wallet_accounts` en a un. Ne pas supposer le filtre sur les deux.

- [ ] **Étape 1 : Écrire le test unitaire du masquage (le plus rapide à faire échouer)**

Créer `src/test/java/com/yadony/api/admin/dto/AdminMobileMoneyPaymentResponseTest.java` :

```java
package com.yadony.api.admin.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lot D — mobile_money_payments.phone_number est une donnee personnelle stockee en clair.
 * La vue admin n'en montre que les quatre derniers chiffres : assez pour rapprocher un
 * paiement d'un signalement, pas assez pour recomposer le numero.
 */
@DisplayName("AdminMobileMoneyPaymentResponse.maskPhone")
class AdminMobileMoneyPaymentResponseTest {

    @Test
    void keepsTheLeadingPlusAndTheLastFourDigits() {
        assertThat(AdminMobileMoneyPaymentResponse.maskPhone("+221771234567"))
                .isEqualTo("+********4567");
    }

    @Test
    void masksANumberWithoutInternationalPrefix() {
        assertThat(AdminMobileMoneyPaymentResponse.maskPhone("0771234567"))
                .isEqualTo("******4567");
    }

    @Test
    void masksEverythingWhenTheNumberIsTooShort() {
        assertThat(AdminMobileMoneyPaymentResponse.maskPhone("123")).isEqualTo("***");
    }

    @Test
    void returnsNullForNullOrBlank() {
        assertThat(AdminMobileMoneyPaymentResponse.maskPhone(null)).isNull();
        assertThat(AdminMobileMoneyPaymentResponse.maskPhone("   ")).isNull();
    }
}
```

- [ ] **Étape 2 : Écrire le test d'intégration des trois endpoints**

Créer `src/test/java/com/yadony/api/admin/AdminFinanceControllerIT.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.account.AdminPrincipal;
import com.yadony.api.admin.account.AdminRole;
import com.yadony.api.auth.UserEntity;
import com.yadony.api.auth.UserRepository;
import com.yadony.api.matching.BidEntity;
import com.yadony.api.matching.BidRepository;
import com.yadony.api.payments.cash.CommissionChargedVia;
import com.yadony.api.payments.cash.CommissionStatus;
import com.yadony.api.payments.cash.PaymentMethod;
import com.yadony.api.payments.mobilemoney.MobileMoneyPaymentEntity;
import com.yadony.api.payments.mobilemoney.MobileMoneyPaymentRepository;
import com.yadony.api.payments.wallet.WalletAccountEntity;
import com.yadony.api.payments.wallet.WalletAccountRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lot D — trois vues financieres en LECTURE SEULE, gardees par PAYMENT_VIEW (deja detenue
 * par SUPPORT). Aucune ecriture, donc aucune entree audit_log attendue.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("AdminFinanceControllerIT — /admin/finance/**")
class AdminFinanceControllerIT {

    @Autowired MockMvc mockMvc;

    @MockitoBean WalletAccountRepository walletAccountRepository;
    @MockitoBean MobileMoneyPaymentRepository mobileMoneyPaymentRepository;
    @MockitoBean BidRepository bidRepository;
    @MockitoBean UserRepository userRepository;

    private static final UUID USER_ID = UUID.randomUUID();

    /** SUPPORT porte PAYMENT_VIEW (cf. AdminRole.SUPPORT) : ces vues lui sont ouvertes. */
    private static UsernamePasswordAuthenticationToken supportAuth() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "support@yadony.test", AdminRole.SUPPORT, false, "uid-support-finance");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("PAYMENT_VIEW")));
    }

    /** Compte admin sans PAYMENT_VIEW (override revoquant la permission). */
    private static UsernamePasswordAuthenticationToken adminWithoutPaymentView() {
        AdminPrincipal principal = new AdminPrincipal(
                UUID.randomUUID(), "admin@yadony.test", AdminRole.ADMIN, false, "uid-admin-finance");
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private static WalletAccountEntity wallet() {
        WalletAccountEntity w = new WalletAccountEntity();
        ReflectionTestUtils.setField(w, "id", UUID.randomUUID());
        w.setUserId(USER_ID);
        w.setBalance(new BigDecimal("42.50"));
        w.setCurrency("EUR");
        return w;
    }

    private static MobileMoneyPaymentEntity mobileMoney() {
        MobileMoneyPaymentEntity m = new MobileMoneyPaymentEntity();
        ReflectionTestUtils.setField(m, "id", UUID.randomUUID());
        m.setBidId(UUID.randomUUID());
        m.setTravelerId(UUID.randomUUID());
        m.setProvider("WAVE");
        m.setCountryCode("SN");
        m.setPhoneNumber("+221771234567");
        m.setAmount(new BigDecimal("15000"));
        m.setCurrency("XOF");
        m.setStatus("PENDING");
        m.setPaymentLink("https://pay.wave.com/secret-token");
        m.setExternalReference("WAVE-REF-1");
        return m;
    }

    private static BidEntity cashBid() {
        BidEntity bid = new BidEntity();
        ReflectionTestUtils.setField(bid, "id", UUID.randomUUID());
        bid.setAnnouncementId(UUID.randomUUID());
        bid.setSenderId(UUID.randomUUID());
        bid.setPaymentMethod(PaymentMethod.CASH);
        bid.setCommissionStatus(CommissionStatus.CHARGED);
        ReflectionTestUtils.setField(bid, "commissionChargedVia", CommissionChargedVia.CARD);
        ReflectionTestUtils.setField(bid, "commissionRate", new BigDecimal("0.12"));
        return bid;
    }

    // ── Wallets ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("wallets — sans PAYMENT_VIEW → 403")
    void wallets_withoutPaymentView_returns403() throws Exception {
        mockMvc.perform(get("/admin/finance/wallets").with(authentication(adminWithoutPaymentView())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("wallets — page Spring brute, avec le nom du titulaire resolu en un seul appel")
    void wallets_returnsPageWithHolderName() throws Exception {
        when(walletAccountRepository.findAdminFiltered(isNull(), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of(wallet()), PageRequest.of(0, 20), 1));
        UserEntity holder = new UserEntity();
        ReflectionTestUtils.setField(holder, "id", USER_ID);
        holder.setFirstName("Awa");
        holder.setLastName("Diop");
        when(userRepository.findAllById(anyIterable())).thenReturn(List.of(holder));

        mockMvc.perform(get("/admin/finance/wallets").with(authentication(supportAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].balance").value(42.50))
                .andExpect(jsonPath("$.content[0].currency").value("EUR"))
                .andExpect(jsonPath("$.content[0].userName").value("Awa Diop"))
                .andExpect(jsonPath("$.totalElements").value(1));

        verify(userRepository).findAllById(anyIterable());
    }

    @Test
    @DisplayName("wallets — les filtres sont transmis au repository")
    void wallets_passesFiltersDown() throws Exception {
        when(walletAccountRepository.findAdminFiltered(any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/admin/finance/wallets")
                        .param("userId", USER_ID.toString())
                        .param("currency", "EUR")
                        .with(authentication(supportAuth())))
                .andExpect(status().isOk());

        verify(walletAccountRepository).findAdminFiltered(eq(USER_ID.toString()), eq("EUR"), any());
    }

    // ── Mobile money ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("mobile money — sans PAYMENT_VIEW → 403")
    void mobileMoney_withoutPaymentView_returns403() throws Exception {
        mockMvc.perform(get("/admin/finance/mobile-money").with(authentication(adminWithoutPaymentView())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("mobile money — le telephone est masque et le lien de paiement absent")
    void mobileMoney_masksPhoneAndHidesPaymentLink() throws Exception {
        when(mobileMoneyPaymentRepository.findAdminFiltered(isNull(), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of(mobileMoney()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/admin/finance/mobile-money").with(authentication(supportAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].maskedPhoneNumber").value("+********4567"))
                .andExpect(jsonPath("$.content[0].provider").value("WAVE"))
                .andExpect(jsonPath("$.content[0].status").value("PENDING"))
                .andExpect(jsonPath("$.content[0].phoneNumber").doesNotExist())
                .andExpect(jsonPath("$.content[0].paymentLink").doesNotExist());
    }

    // ── Commissions cash ─────────────────────────────────────────────────────

    @Test
    @DisplayName("commissions cash — sans PAYMENT_VIEW → 403")
    void cashCommissions_withoutPaymentView_returns403() throws Exception {
        mockMvc.perform(get("/admin/finance/cash-commissions")
                        .with(authentication(adminWithoutPaymentView())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("commissions cash — vue construite sur les bids, pas sur une table de commissions")
    void cashCommissions_readsFromBids() throws Exception {
        when(bidRepository.findAdminCashCommissions(isNull(), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of(cashBid()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/admin/finance/cash-commissions").with(authentication(supportAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].paymentMethod").value("CASH"))
                .andExpect(jsonPath("$.content[0].commissionStatus").value("CHARGED"))
                .andExpect(jsonPath("$.content[0].commissionChargedVia").value("CARD"))
                .andExpect(jsonPath("$.content[0].commissionRate").value(0.12));
    }

    @Test
    @DisplayName("commissions cash — les filtres sont transmis au repository")
    void cashCommissions_passesFiltersDown() throws Exception {
        when(bidRepository.findAdminCashCommissions(any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/admin/finance/cash-commissions")
                        .param("commissionStatus", "FAILED")
                        .param("paymentMethod", "WAVE")
                        .with(authentication(supportAuth())))
                .andExpect(status().isOk());

        verify(bidRepository).findAdminCashCommissions(eq("FAILED"), eq("WAVE"), any());
    }
}
```

- [ ] **Étape 3 : Lancer les deux tests et constater l'échec**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest='AdminMobileMoneyPaymentResponseTest,AdminFinanceControllerIT'
```

Attendu : **échec de compilation** — `cannot find symbol: class AdminMobileMoneyPaymentResponse`.

- [ ] **Étape 4 : Ajouter les trois requêtes paginées**

Dans `src/main/java/com/yadony/api/payments/wallet/WalletAccountRepository.java`, ajouter (avec les imports `org.springframework.data.domain.Page`, `org.springframework.data.domain.Pageable`) :

```java
    /**
     * Listing admin (Lot D, lecture seule). {@code userId} arrive en VARCHAR : un parametre
     * UUID nullable dans une requete native force PostgreSQL a deviner le type et echoue en
     * « could not determine data type ». Meme motif que UserRepository.findAdminFiltered.
     */
    @Query(value = """
            SELECT w.* FROM wallet_accounts w
            WHERE w.deleted_at IS NULL
              AND (CAST(:userId AS VARCHAR) IS NULL OR w.user_id = CAST(:userId AS UUID))
              AND (CAST(:currency AS VARCHAR) IS NULL OR w.currency = :currency)
            ORDER BY w.balance DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM wallet_accounts w
            WHERE w.deleted_at IS NULL
              AND (CAST(:userId AS VARCHAR) IS NULL OR w.user_id = CAST(:userId AS UUID))
              AND (CAST(:currency AS VARCHAR) IS NULL OR w.currency = :currency)
            """,
            nativeQuery = true)
    Page<WalletAccountEntity> findAdminFiltered(@Param("userId") String userId,
                                                @Param("currency") String currency,
                                                Pageable pageable);
```

Dans `src/main/java/com/yadony/api/payments/mobilemoney/MobileMoneyPaymentRepository.java` (imports `Page`, `Pageable`, `Query`, `Param`) :

```java
    /** Listing admin (Lot D, lecture seule). Le statut est une chaine libre, pas un enum Java. */
    @Query(value = """
            SELECT m.* FROM mobile_money_payments m
            WHERE m.deleted_at IS NULL
              AND (CAST(:status AS VARCHAR) IS NULL OR m.status = :status)
              AND (CAST(:provider AS VARCHAR) IS NULL OR m.provider = :provider)
            ORDER BY m.created_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM mobile_money_payments m
            WHERE m.deleted_at IS NULL
              AND (CAST(:status AS VARCHAR) IS NULL OR m.status = :status)
              AND (CAST(:provider AS VARCHAR) IS NULL OR m.provider = :provider)
            """,
            nativeQuery = true)
    Page<MobileMoneyPaymentEntity> findAdminFiltered(@Param("status") String status,
                                                     @Param("provider") String provider,
                                                     Pageable pageable);
```

Dans `src/main/java/com/yadony/api/matching/BidRepository.java`, à côté de `findAdminFiltered` :

```java
    /**
     * Commissions hors escrow (Lot D, lecture seule).
     *
     * <p>⚠️ Il n'existe PAS de table de commissions cash : les colonnes vivent sur bids.
     * Et {@code CommissionChargedVia} ne vaut que WALLET ou CARD — le caractere « hors
     * escrow » se lit sur {@code payment_method}, pas sur {@code commission_charged_via}.
     */
    @Query(value = """
            SELECT b.* FROM bids b
            WHERE b.deleted_at IS NULL
              AND b.payment_method <> 'STRIPE'
              AND b.commission_status IS NOT NULL
              AND (CAST(:commissionStatus AS VARCHAR) IS NULL OR b.commission_status = :commissionStatus)
              AND (CAST(:paymentMethod AS VARCHAR) IS NULL OR b.payment_method = :paymentMethod)
            ORDER BY b.created_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM bids b
            WHERE b.deleted_at IS NULL
              AND b.payment_method <> 'STRIPE'
              AND b.commission_status IS NOT NULL
              AND (CAST(:commissionStatus AS VARCHAR) IS NULL OR b.commission_status = :commissionStatus)
              AND (CAST(:paymentMethod AS VARCHAR) IS NULL OR b.payment_method = :paymentMethod)
            """,
            nativeQuery = true)
    Page<BidEntity> findAdminCashCommissions(@Param("commissionStatus") String commissionStatus,
                                             @Param("paymentMethod") String paymentMethod,
                                             Pageable pageable);
```

- [ ] **Étape 5 : Écrire les trois DTO**

Créer `src/main/java/com/yadony/api/admin/dto/AdminWalletAccountResponse.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.payments.wallet.WalletAccountEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record AdminWalletAccountResponse(
        UUID id,
        UUID userId,
        String userName,
        BigDecimal balance,
        String currency,
        LocalDateTime updatedAt) {

    public static AdminWalletAccountResponse from(WalletAccountEntity entity, String userName) {
        return new AdminWalletAccountResponse(
                entity.getId(), entity.getUserId(), userName,
                entity.getBalance(), entity.getCurrency(), entity.getUpdatedAt());
    }
}
```

Créer `src/main/java/com/yadony/api/admin/dto/AdminMobileMoneyPaymentResponse.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.payments.mobilemoney.MobileMoneyPaymentEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ⚠️ Deux colonnes de {@code mobile_money_payments} ne sortent JAMAIS telles quelles :
 * {@code phone_number} (donnee personnelle stockee en clair — seuls les quatre derniers
 * chiffres transitent) et {@code payment_link} (URL de paiement vivante, absente du DTO).
 * Le chiffrement de la colonne telephone est un chantier distinct, hors perimetre du Lot D.
 */
public record AdminMobileMoneyPaymentResponse(
        UUID id,
        UUID bidId,
        UUID travelerId,
        String provider,
        String countryCode,
        String maskedPhoneNumber,
        BigDecimal amount,
        String currency,
        String status,
        String failureReason,
        String externalReference,
        LocalDateTime createdAt,
        LocalDateTime webhookReceivedAt) {

    public static AdminMobileMoneyPaymentResponse from(MobileMoneyPaymentEntity entity) {
        return new AdminMobileMoneyPaymentResponse(
                entity.getId(), entity.getBidId(), entity.getTravelerId(),
                entity.getProvider(), entity.getCountryCode(), maskPhone(entity.getPhoneNumber()),
                entity.getAmount(), entity.getCurrency(), entity.getStatus(),
                entity.getFailureReason(), entity.getExternalReference(),
                entity.getCreatedAt(), entity.getWebhookReceivedAt());
    }

    /** Conserve un eventuel « + » de tete et les quatre derniers caracteres, masque le reste. */
    static String maskPhone(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        boolean international = trimmed.startsWith("+");
        String digits = international ? trimmed.substring(1) : trimmed;
        String prefix = international ? "+" : "";
        if (digits.length() <= 4) {
            return prefix + "*".repeat(digits.length());
        }
        return prefix + "*".repeat(digits.length() - 4) + digits.substring(digits.length() - 4);
    }
}
```

Créer `src/main/java/com/yadony/api/admin/dto/AdminCashCommissionResponse.java` :

```java
package com.yadony.api.admin.dto;

import com.yadony.api.matching.BidEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Vue construite sur bids : il n'existe pas d'entite dediee aux commissions hors escrow. */
public record AdminCashCommissionResponse(
        UUID bidId,
        UUID announcementId,
        UUID senderId,
        String paymentMethod,
        String commissionStatus,
        String commissionChargedVia,
        int commissionRetryCount,
        BigDecimal commissionRate,
        String commissionPaymentIntentId,
        LocalDateTime createdAt) {

    public static AdminCashCommissionResponse from(BidEntity bid) {
        return new AdminCashCommissionResponse(
                bid.getId(), bid.getAnnouncementId(), bid.getSenderId(),
                bid.getPaymentMethod() == null ? null : bid.getPaymentMethod().name(),
                bid.getCommissionStatus() == null ? null : bid.getCommissionStatus().name(),
                bid.getCommissionChargedVia() == null ? null : bid.getCommissionChargedVia().name(),
                bid.getCommissionRetryCount(), bid.getCommissionRate(),
                bid.getCommissionPaymentIntentId(), bid.getCreatedAt());
    }
}
```

- [ ] **Étape 6 : Écrire le contrôleur**

Créer `src/main/java/com/yadony/api/admin/AdminFinanceController.java` :

```java
package com.yadony.api.admin;

import com.yadony.api.admin.dto.AdminCashCommissionResponse;
import com.yadony.api.admin.dto.AdminMobileMoneyPaymentResponse;
import com.yadony.api.admin.dto.AdminWalletAccountResponse;
import com.yadony.api.auth.UserEntity;
import com.yadony.api.auth.UserRepository;
import com.yadony.api.common.MatchingTextUtil;
import com.yadony.api.matching.BidRepository;
import com.yadony.api.payments.mobilemoney.MobileMoneyPaymentRepository;
import com.yadony.api.payments.wallet.WalletAccountEntity;
import com.yadony.api.payments.wallet.WalletAccountRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Lot D — trois vues financieres jusque-la invisibles pour l'administration : soldes wallet,
 * paiements mobile money, commissions hors escrow.
 *
 * <p>LECTURE SEULE, garde par {@code PAYMENT_VIEW} — permission deja detenue par SUPPORT,
 * qui doit pouvoir instruire un signalement de paiement. Aucune ecriture, donc aucune entree
 * audit_log : la regle « tout geste d'ecriture est audite » ne s'applique pas ici.
 *
 * <p>Motif de pagination identique au reste de {@code /admin/**} : {@code Page<Dto>} Spring
 * brut, jamais le {@code PageResponse} maison de {@code NotificationService}.
 */
@RestController
@RequestMapping("/admin/finance")
@PreAuthorize("hasRole('ADMIN') and hasAuthority('PAYMENT_VIEW')")
public class AdminFinanceController {

    private final WalletAccountRepository walletAccountRepository;
    private final MobileMoneyPaymentRepository mobileMoneyPaymentRepository;
    private final BidRepository bidRepository;
    private final UserRepository userRepository;

    public AdminFinanceController(WalletAccountRepository walletAccountRepository,
                                  MobileMoneyPaymentRepository mobileMoneyPaymentRepository,
                                  BidRepository bidRepository,
                                  UserRepository userRepository) {
        this.walletAccountRepository = walletAccountRepository;
        this.mobileMoneyPaymentRepository = mobileMoneyPaymentRepository;
        this.bidRepository = bidRepository;
        this.userRepository = userRepository;
    }

    @PreAuthorize("hasRole('ADMIN') and hasAuthority('PAYMENT_VIEW')")
    @GetMapping("/wallets")
    public Page<AdminWalletAccountResponse> wallets(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String currency,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<WalletAccountEntity> raw = walletAccountRepository.findAdminFiltered(
                blankToNull(userId), blankToNull(currency), PageRequest.of(page, size));

        // Un seul aller-retour pour toute la page, comme AdminUserController.listUsers :
        // resoudre le nom compte par compte ferait un N+1 sur une vue de listing.
        Set<UUID> holderIds = raw.getContent().stream()
                .map(WalletAccountEntity::getUserId)
                .collect(Collectors.toSet());
        Map<UUID, String> names = new HashMap<>();
        if (!holderIds.isEmpty()) {
            List<UserEntity> holders = userRepository.findAllById(holderIds);
            for (UserEntity holder : holders) {
                names.put(holder.getId(), MatchingTextUtil.buildName(holder));
            }
        }
        return raw.map(w -> AdminWalletAccountResponse.from(w, names.get(w.getUserId())));
    }

    @PreAuthorize("hasRole('ADMIN') and hasAuthority('PAYMENT_VIEW')")
    @GetMapping("/mobile-money")
    public Page<AdminMobileMoneyPaymentResponse> mobileMoney(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String provider,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        return mobileMoneyPaymentRepository
                .findAdminFiltered(blankToNull(status), blankToNull(provider), PageRequest.of(page, size))
                .map(AdminMobileMoneyPaymentResponse::from);
    }

    @PreAuthorize("hasRole('ADMIN') and hasAuthority('PAYMENT_VIEW')")
    @GetMapping("/cash-commissions")
    public Page<AdminCashCommissionResponse> cashCommissions(
            @RequestParam(required = false) String commissionStatus,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        return bidRepository
                .findAdminCashCommissions(blankToNull(commissionStatus), blankToNull(paymentMethod),
                        PageRequest.of(page, size))
                .map(AdminCashCommissionResponse::from);
    }

    /** Un filtre vide venu d'un champ de formulaire vaut « pas de filtre », pas « chaine vide ». */
    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}
```

- [ ] **Étape 7 : Relancer les tests et constater le vert**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test -Dtest='AdminMobileMoneyPaymentResponseTest,AdminFinanceControllerIT'
```

Attendu : `Tests run: 12, Failures: 0, Errors: 0, Skipped: 0` (4 + 8).

- [ ] **Étape 8 : Suite complète + couverture**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
./mvnw -q test 2>&1 | tail -20
./mvnw -q test jacoco:report
```

Attendu : baseline T9 **+ 12**, 0 échec. Ouvrir `target/site/jacoco/index.html` et **rapporter le pourcentage global réel** (seuil ≥ 90 %).

- [ ] **Étape 9 : Commit**

```bash
cd /Users/aboubakardiakite/Desktop/dony/dony-back
git add src/main/java/com/yadony/api/admin/ \
        src/main/java/com/yadony/api/payments/wallet/WalletAccountRepository.java \
        src/main/java/com/yadony/api/payments/mobilemoney/MobileMoneyPaymentRepository.java \
        src/main/java/com/yadony/api/matching/BidRepository.java \
        src/test/java/com/yadony/api/admin/
git commit -m "feat(admin): vues financieres wallets, mobile money et commissions hors escrow"
```

---

### Task 11 : Ligne de base front + miroir des deux nouvelles permissions

**Dépôt :** `yadony-admin` (worktree `fix+rbac-support-isadmin`)

**Files:**
- Modify: `app/stores/auth.ts`
- Test: `tests/unit/stores/auth.spec.ts`
- Test: `tests/unit/features/users/UserDetailPanel.spec.ts` *(correction de deux rouges préexistants)*

**Interfaces:**
- Consumes: `AdminPermission.NOTIFICATION_SEND` / `CONFIG_MANAGE` côté back (T1).
- Produces: type `AdminPermission` élargi à **29** valeurs et `ALL_PERMISSIONS` à 29 entrées — consommés par `auth.can(...)`, `definePageMeta({ permission })` et la sidebar dans les tâches 13, 15 et 17.

> ⚠️ **La branche front est vivante** : une modification non commitée d'un autre agent a été observée sur `tests/unit/stores/auth.spec.ts` pendant la rédaction de ce plan. Faire `git pull --ff-only` **et** `git status --short` avant de toucher quoi que ce soit.

- [ ] **Étape 1 : Mesurer la ligne de base réelle**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
git pull --ff-only
git status --short
git log --oneline -1
npm test 2>&1 | tail -8
```

Baseline mesurée le 2026-08-19 : **488 tests, 486 verts, 2 rouges**. Les deux rouges sont dans `tests/unit/features/users/UserDetailPanel.spec.ts` :
`hides the mute duration selector and the mute button without USER_MESSAGE_MUTE` et
`hides the unmute action without USER_MESSAGE_MUTE even if the user is muted`.
**Rapporter le décompte réel obtenu.** S'ils sont déjà corrigés par un autre agent, passer directement à l'étape 3.

- [ ] **Étape 2 : Corriger les deux rouges préexistants**

Cause : le commit `bd4d03e` a accordé `USER_MESSAGE_MUTE` à SUPPORT, mais ces deux tests utilisent encore `seedAuth('SUPPORT')` pour simuler « un compte sans cette permission ». L'intention du test reste valable — c'est le moyen qui a cessé de l'être. Dans `tests/unit/features/users/UserDetailPanel.spec.ts`, remplacer les deux occurrences :

```ts
    seedAuth('SUPPORT')
```

par :

```ts
    // SUPPORT porte USER_MESSAGE_MUTE depuis le Lot C : on la lui retire explicitement
    // par un override, le test portant sur le gating, pas sur la matrice des rôles.
    seedAuth('SUPPORT', { USER_MESSAGE_MUTE: false })
```

Puis vérifier :

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
npx vitest run tests/unit/features/users/UserDetailPanel.spec.ts 2>&1 | tail -8
```

Attendu : 0 échec.

- [ ] **Étape 3 : Écrire les tests qui échouent**

Dans `tests/unit/stores/auth.spec.ts`, remplacer le dernier test par :

```ts
  // 29 depuis le Lot D, qui ajoute NOTIFICATION_SEND et CONFIG_MANAGE.
  it('exposes 29 permissions, mirroring the backend enum', () => {
    expect(ALL_PERMISSIONS).toHaveLength(29)
  })

  it('ADMIN peut diffuser une notification et modifier la configuration', () => {
    seedAuth('ADMIN')
    const auth = useAuthStore()
    expect(auth.can('NOTIFICATION_SEND')).toBe(true)
    expect(auth.can('CONFIG_MANAGE')).toBe(true)
  })

  it('SUPER_ADMIN les porte aussi', () => {
    seedAuth('SUPER_ADMIN')
    const auth = useAuthStore()
    expect(auth.can('NOTIFICATION_SEND')).toBe(true)
    expect(auth.can('CONFIG_MANAGE')).toBe(true)
  })

  it('SUPPORT ne peut ni diffuser ni configurer', () => {
    seedAuth('SUPPORT')
    const auth = useAuthStore()
    expect(auth.can('NOTIFICATION_SEND')).toBe(false)
    expect(auth.can('CONFIG_MANAGE')).toBe(false)
  })

  it('SUPPORT peut recevoir CONFIG_MANAGE via un override explicite', () => {
    seedAuth('SUPPORT', { CONFIG_MANAGE: true })
    const auth = useAuthStore()
    expect(auth.can('CONFIG_MANAGE')).toBe(true)
    expect(auth.can('NOTIFICATION_SEND')).toBe(false)
  })
```

- [ ] **Étape 4 : Lancer et constater l'échec**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
npx vitest run tests/unit/stores/auth.spec.ts 2>&1 | tail -20
```

Attendu : **échec de typage/assertion** — `expected [...] to have a length of 29 but got 27`, et une erreur TypeScript `Argument of type '"NOTIFICATION_SEND"' is not assignable to parameter of type 'AdminPermission'`.

- [ ] **Étape 5 : Mettre le miroir à jour**

Dans `app/stores/auth.ts` :

1. Corriger le commentaire de tête du type :

```ts
/** Miroir exact de com.yadony.api.admin.account.AdminPermission (29 permissions). */
```

2. Ajouter les deux entrées au type `AdminPermission`, juste après `'USER_MESSAGE_MUTE'` :

```ts
  | 'USER_MESSAGE_MUTE'
  | 'NOTIFICATION_SEND'
  | 'CONFIG_MANAGE'
```

3. Ajouter les deux mêmes entrées à `ALL_PERMISSIONS`, **dans le même ordre**, juste après `'USER_MESSAGE_MUTE',` :

```ts
  'USER_MESSAGE_MUTE',
  'NOTIFICATION_SEND',
  'CONFIG_MANAGE',
```

4. **Ne pas toucher `ROLE_PERMISSIONS`** : `ADMIN` est calculé par `ALL_PERMISSIONS.filter((p) => p !== 'ADMIN_MANAGE')` et reçoit donc les deux automatiquement, exactement comme le `EnumSet.complementOf` du back ; `SUPPORT` est une liste explicite qui ne les mentionne pas, exactement comme `AdminRole.SUPPORT`.

- [ ] **Étape 6 : Relancer et constater le vert**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
npx vitest run tests/unit/stores/auth.spec.ts 2>&1 | tail -8
```

Attendu : 0 échec.

- [ ] **Étape 7 : Suite complète + typage + lint**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
npm test 2>&1 | tail -8
npm run typecheck
npm run lint
```

Attendu : **0 rouge** (les deux rouges préexistants inclus), typage et lint propres. Rapporter le décompte réel.

- [ ] **Étape 8 : Commit**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
git add app/stores/auth.ts tests/unit/stores/auth.spec.ts tests/unit/features/users/UserDetailPanel.spec.ts
git commit -m "feat(auth): miroir des permissions NOTIFICATION_SEND et CONFIG_MANAGE"
```

---

### Task 12 : Feature front « broadcast » — types, service, composable

**Dépôt :** `yadony-admin`

**Files:**
- Create: `app/features/broadcast/types/index.ts`
- Create: `app/features/broadcast/services/broadcastService.ts`
- Create: `app/features/broadcast/composables/useBroadcast.ts`
- Test: `tests/unit/features/broadcast/broadcastService.spec.ts`
- Test: `tests/unit/features/broadcast/useBroadcast.spec.ts`

**Interfaces:**
- Consumes: endpoints de la T5 ; `useApi()` (`app/composables/useApi.ts`) ; `extractProblemMessage(e, fallback)` (`app/lib/problemDetail.ts`).
- Produces (consommés par la page en T13) :
  - `type BroadcastTargetType = 'ALL' | 'SENDERS' | 'TRAVELERS' | 'CORRIDOR' | 'USER'`
  - `interface BroadcastTarget { type: BroadcastTargetType; origin?: string; destination?: string; userId?: string }`
  - `interface AdminBroadcast { id, title, body, targetType, targetOrigin, targetDestination, targetUserId, recipientCount, adminId, createdAt }`
  - `interface AdminBroadcastPage { content: AdminBroadcast[]; totalElements: number; totalPages: number; number: number; size: number }`
  - `broadcastService.preview(target) -> Promise<{ recipientCount: number }>`
  - `broadcastService.send(title, body, target) -> Promise<AdminBroadcast>`
  - `broadcastService.listHistory(page, size) -> Promise<AdminBroadcastPage>`
  - `useBroadcast()` → `{ history, isLoading, error, busy, recipientCount, previewing, currentPage, totalPages, fetchHistory, goToPage, preview, send }`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `tests/unit/features/broadcast/broadcastService.spec.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { broadcastService } from '@/features/broadcast/services/broadcastService'

describe('broadcastService', () => {
  beforeEach(() => apiMock.mockReset())

  it('preview POSTe le ciblage et ne renvoie que le compteur', async () => {
    apiMock.mockResolvedValue({ recipientCount: 128 })
    const res = await broadcastService.preview({ type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' })
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast/preview', {
      method: 'POST',
      body: { type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' },
    })
    expect(res.recipientCount).toBe(128)
  })

  it('preview omet les villes pour un ciblage non-corridor', async () => {
    apiMock.mockResolvedValue({ recipientCount: 3 })
    await broadcastService.preview({ type: 'ALL' })
    expect(apiMock.mock.calls[0][1].body).toEqual({ type: 'ALL' })
  })

  it('send POSTe titre, corps et ciblage', async () => {
    apiMock.mockResolvedValue({ id: 'b1', recipientCount: 12 })
    await broadcastService.send('Titre', 'Corps', { type: 'USER', userId: 'u1' })
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title: 'Titre', body: 'Corps', target: { type: 'USER', userId: 'u1' } },
    })
  })

  it('listHistory GETe une page', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await broadcastService.listHistory(1, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcasts', { query: { page: 1, size: 20 } })
  })
})
```

Créer `tests/unit/features/broadcast/useBroadcast.spec.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/broadcast/services/broadcastService')
import { useBroadcast } from '@/features/broadcast/composables/useBroadcast'
import { broadcastService } from '@/features/broadcast/services/broadcastService'

const svc = broadcastService as unknown as Record<string, ReturnType<typeof vi.fn>>
const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

describe('useBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listHistory = vi.fn().mockResolvedValue(emptyPage)
    svc.preview = vi.fn().mockResolvedValue({ recipientCount: 0 })
    svc.send = vi.fn().mockResolvedValue({ id: 'b1', recipientCount: 5 })
  })

  it('fetchHistory charge la page courante', async () => {
    svc.listHistory.mockResolvedValue({ ...emptyPage, content: [{ id: 'b1' }], totalPages: 1, totalElements: 1 })
    const b = useBroadcast()
    await b.fetchHistory()
    expect(b.history.value).toHaveLength(1)
    expect(b.totalPages.value).toBe(1)
  })

  it('preview stocke le nombre de destinataires', async () => {
    svc.preview.mockResolvedValue({ recipientCount: 42 })
    const b = useBroadcast()
    await b.preview({ type: 'ALL' })
    expect(b.recipientCount.value).toBe(42)
  })

  it('preview remet le compteur a null en cas d erreur et affiche le detail RFC 7807', async () => {
    svc.preview.mockRejectedValue({ data: { detail: 'Ciblage invalide' } })
    const b = useBroadcast()
    await b.preview({ type: 'CORRIDOR', origin: 'Paris' })
    expect(b.recipientCount.value).toBeNull()
    expect(b.error.value).toBe('Ciblage invalide')
  })

  it('send recharge l historique et remet le compteur a zero', async () => {
    const b = useBroadcast()
    await b.preview({ type: 'ALL' })
    await b.send('T', 'B', { type: 'ALL' })
    expect(svc.send).toHaveBeenCalledWith('T', 'B', { type: 'ALL' })
    expect(svc.listHistory).toHaveBeenCalled()
    expect(b.recipientCount.value).toBeNull()
  })

  it('send capture l erreur backend sans recharger l historique', async () => {
    svc.send.mockRejectedValue({ data: { detail: 'Envoi impossible' } })
    const b = useBroadcast()
    await b.send('T', 'B', { type: 'ALL' })
    expect(b.error.value).toBe('Envoi impossible')
    expect(svc.listHistory).not.toHaveBeenCalled()
  })

  it('goToPage change de page et recharge', async () => {
    const b = useBroadcast()
    await b.goToPage(2)
    expect(b.currentPage.value).toBe(2)
    expect(svc.listHistory).toHaveBeenCalledWith(2, 20)
  })
})
```

- [ ] **Étape 2 : Lancer et constater l'échec**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
npx vitest run tests/unit/features/broadcast 2>&1 | tail -20
```

Attendu : `Failed to resolve import "@/features/broadcast/services/broadcastService"`.

- [ ] **Étape 3 : Écrire les types**

Créer `app/features/broadcast/types/index.ts` :

```ts
/**
 * ⚠️ Le ciblage est comportemental côté back : `SENDERS` = a créé au moins un bid,
 * `TRAVELERS` = a publié au moins une annonce. Ce n'est PAS un filtre par rôle — tout
 * compte porte SENDER et TRAVELER depuis la migration V193, un filtre par rôle enverrait
 * donc à tout le monde dans les deux cas.
 */
export type BroadcastTargetType = 'ALL' | 'SENDERS' | 'TRAVELERS' | 'CORRIDOR' | 'USER'

export interface BroadcastTarget {
  type: BroadcastTargetType
  /** Ville de départ — obligatoire, et seulement, pour `CORRIDOR`. */
  origin?: string
  /** Ville d'arrivée — obligatoire, et seulement, pour `CORRIDOR`. */
  destination?: string
  /** Obligatoire, et seulement, pour `USER`. */
  userId?: string
}

export interface AdminBroadcast {
  id: string
  title: string
  body: string
  targetType: BroadcastTargetType
  targetOrigin: string | null
  targetDestination: string | null
  targetUserId: string | null
  recipientCount: number
  adminId: string
  createdAt: string
}

export interface AdminBroadcastPage {
  content: AdminBroadcast[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface BroadcastAudience {
  recipientCount: number
}

export const TARGET_LABELS: Record<BroadcastTargetType, string> = {
  ALL: 'Tous les comptes actifs',
  SENDERS: 'Expéditeurs (ont déjà fait une demande)',
  TRAVELERS: 'Voyageurs (ont déjà publié un trajet)',
  CORRIDOR: 'Corridor (ville de départ → ville d’arrivée)',
  USER: 'Un utilisateur précis',
}
```

- [ ] **Étape 4 : Écrire le service**

Créer `app/features/broadcast/services/broadcastService.ts` :

```ts
import { useApi } from '@/composables/useApi'
import type {
  AdminBroadcast, AdminBroadcastPage, BroadcastAudience, BroadcastTarget,
} from '@/features/broadcast/types/index'

/** N'envoie que les champs pertinents : le back refuse un corridor incomplet en 422. */
function serializeTarget(target: BroadcastTarget): Record<string, string> {
  const body: Record<string, string> = { type: target.type }
  if (target.type === 'CORRIDOR') {
    if (target.origin) body.origin = target.origin
    if (target.destination) body.destination = target.destination
  }
  if (target.type === 'USER' && target.userId) body.userId = target.userId
  return body
}

export const broadcastService = {
  preview(target: BroadcastTarget): Promise<BroadcastAudience> {
    return useApi()<BroadcastAudience>('/admin/notifications/broadcast/preview', {
      method: 'POST',
      body: serializeTarget(target),
    })
  },
  send(title: string, body: string, target: BroadcastTarget): Promise<AdminBroadcast> {
    return useApi()<AdminBroadcast>('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title, body, target: serializeTarget(target) },
    })
  },
  listHistory(page: number, size: number): Promise<AdminBroadcastPage> {
    return useApi()<AdminBroadcastPage>('/admin/notifications/broadcasts', { query: { page, size } })
  },
}
```

- [ ] **Étape 5 : Écrire le composable**

Créer `app/features/broadcast/composables/useBroadcast.ts` :

```ts
import { ref } from 'vue'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminBroadcast, BroadcastTarget } from '@/features/broadcast/types/index'

const PAGE_SIZE = 20

/**
 * Rédaction, aperçu et historique des broadcasts.
 *
 * Le back répond 202 : la diffusion n'a pas encore eu lieu quand la promesse se résout.
 * On recharge donc l'historique (la ligne y est déjà, avec son compteur figé) mais on
 * n'affiche jamais « tout le monde a reçu le message ».
 */
export function useBroadcast() {
  const history = ref<AdminBroadcast[]>([])
  const isLoading = ref(false)
  const busy = ref(false)
  const previewing = ref(false)
  const error = ref<string | null>(null)
  const recipientCount = ref<number | null>(null)
  const currentPage = ref(0)
  const totalPages = ref(0)

  async function fetchHistory() {
    isLoading.value = true
    error.value = null
    try {
      const page = await broadcastService.listHistory(currentPage.value, PAGE_SIZE)
      history.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger l’historique des envois')
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) {
    currentPage.value = p
    await fetchHistory()
  }

  async function preview(target: BroadcastTarget) {
    previewing.value = true
    error.value = null
    try {
      recipientCount.value = (await broadcastService.preview(target)).recipientCount
    } catch (e) {
      recipientCount.value = null
      error.value = extractProblemMessage(e, 'Impossible d’estimer le nombre de destinataires')
    } finally {
      previewing.value = false
    }
  }

  async function send(title: string, body: string, target: BroadcastTarget) {
    busy.value = true
    error.value = null
    try {
      await broadcastService.send(title, body, target)
      recipientCount.value = null
      await fetchHistory()
    } catch (e) {
      error.value = extractProblemMessage(e, 'Envoi impossible')
    } finally {
      busy.value = false
    }
  }

  return {
    history, isLoading, busy, previewing, error, recipientCount, currentPage, totalPages,
    fetchHistory, goToPage, preview, send,
  }
}
```

- [ ] **Étape 6 : Relancer et constater le vert**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
npx vitest run tests/unit/features/broadcast 2>&1 | tail -8
```

Attendu : 10 tests, 0 échec.

- [ ] **Étape 7 : Suite complète + couverture**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.2/installation/bin:$PATH"
npm test 2>&1 | tail -8
npm run test:coverage 2>&1 | tail -25
npm run typecheck
```

Attendu : baseline T11 **+ 10**, 0 rouge, seuils ≥ 90/85/90/90 tenus. Rapporter les chiffres réels.

- [ ] **Étape 8 : Commit**

```bash
cd "/Users/aboubakardiakite/Desktop/dony/dony-admin/.claude/worktrees/fix+rbac-support-isadmin"
git add app/features/broadcast tests/unit/features/broadcast
git commit -m "feat(broadcast): types, appels API et composable de diffusion"
```

---
### Task 13 : Page « Communications » — rédaction, aperçu, envoi, historique

**Dépôt :** `yadony-admin`

**Files:**
- Create: `app/features/broadcast/components/BroadcastComposer.vue`
- Create: `app/features/broadcast/components/BroadcastHistoryTable.vue`
- Create: `app/pages/communications.vue`
- Modify: `app/components/layout/AppSidebar.vue` (entrée filtrée par `can('NOTIFICATION_SEND')`)
- Test: `tests/unit/features/broadcast/BroadcastComposer.spec.ts`
- Test: `tests/unit/features/broadcast/BroadcastHistoryTable.spec.ts`

**Interfaces:**
- Consumes: `useBroadcast()` et les types de la T12 ; `ConfirmActionDialog` ; `PaginationControls`.
- Produces: page routée `/communications`, portant `definePageMeta({ permission: 'NOTIFICATION_SEND' })`.

- [ ] **Étape 1 : Tests qui échouent.** Couvrir, dans `BroadcastComposer.spec.ts` :
  - le bouton d'envoi est désactivé tant que le titre ou le corps est vide ;
  - choisir la cible `CORRIDOR` révèle les deux champs origine/destination, les autres cibles les cachent ;
  - choisir la cible `USER` révèle le champ d'identifiant utilisateur ;
  - cliquer « Estimer les destinataires » émet `preview` avec le ciblage exact composé ;
  - le nombre de destinataires estimé est affiché quand il est fourni ;
  - l'envoi passe par une modale de confirmation rappelant **le nombre de destinataires** — un broadcast est irrattrapable une fois parti ;
  - les commandes sont désactivées pendant l'envoi (`busy`).

  Dans `BroadcastHistoryTable.spec.ts` : rendu d'une ligne (titre, cible lisible en français, compteur, date), état vide explicite, état de chargement.

- [ ] **Étape 2 :** `pnpm vitest run tests/unit/features/broadcast/` → **constater l'échec réel**.

- [ ] **Étape 3 : Implémentation.** `BroadcastComposer.vue` : champs titre/corps, sélecteur de cible, champs conditionnels, bouton d'estimation, bouton d'envoi ouvrant `ConfirmActionDialog` dont le message nomme le nombre de destinataires. `BroadcastHistoryTable.vue` : tableau + `PaginationControls`. `communications.vue` : câblage pur sur `useBroadcast()`, bannière d'erreur affichant le message du backend.

  Libellés de cible en français : `ALL` → « Tous les utilisateurs », `SENDERS` → « Expéditeurs (a déjà fait une demande) », `TRAVELERS` → « Voyageurs (a déjà publié un trajet) », `CORRIDOR` → « Corridor », `USER` → « Un utilisateur ». Les deux libellés comportementaux disent explicitement le critère : c'est ce qui empêche un admin de croire à un ciblage par rôle.

- [ ] **Étape 4 :** `pnpm vitest run tests/unit/features/broadcast/` → **vert**.

- [ ] **Étape 5 : Commit**

```bash
git add app/features/broadcast app/pages/communications.vue app/components/layout/AppSidebar.vue tests/unit/features/broadcast
git commit -m "feat(broadcast): page de diffusion avec aperçu, confirmation et historique"
```

---

### Task 14 : Feature front « settings » — types, service, composable

**Dépôt :** `yadony-admin`

**Files:**
- Create: `app/features/settings/types/index.ts`
- Create: `app/features/settings/services/settingsService.ts`
- Create: `app/features/settings/composables/usePlatformSettings.ts`
- Test: `tests/unit/features/settings/settingsService.spec.ts`
- Test: `tests/unit/features/settings/usePlatformSettings.spec.ts`

**Interfaces:**
- Consumes: endpoints admin de la T9 ; `useApi()` ; `extractProblemMessage`.
- Produces (consommés en T15) :
  - `interface PlatformSetting { key: string; value: string; type: 'INT' | 'DECIMAL' | 'BOOLEAN'; updatedAt: string | null; updatedByEmail: string | null }`
  - `settingsService.list() -> Promise<PlatformSetting[]>`
  - `settingsService.update(key, value) -> Promise<PlatformSetting>`
  - `usePlatformSettings()` → `{ settings, isLoading, error, busy, load, update }`

- [ ] **Étape 1 : Tests qui échouent.** Le service appelle les bons chemins et méthodes ; le composable remplace en place le réglage modifié (sans recharger toute la liste) ; une erreur backend est extraite via `extractProblemMessage` et exposée ; `busy` est vrai pendant l'appel et faux après, y compris en cas d'échec.

- [ ] **Étape 2 :** `pnpm vitest run tests/unit/features/settings/` → **échec réel constaté**.

- [ ] **Étape 3 : Implémentation**, sur le motif exact de `useAdminAnnouncements` (Lot B) et `useUserDetail` (Lot C).

- [ ] **Étape 4 :** → **vert**.

- [ ] **Étape 5 : Commit**

```bash
git add app/features/settings tests/unit/features/settings
git commit -m "feat(settings): types, appels API et composable des paramètres plateforme"
```

---

### Task 15 : Page « Paramètres plateforme »

**Dépôt :** `yadony-admin`

**Files:**
- Create: `app/features/settings/components/SettingsForm.vue`
- Create: `app/pages/parametres.vue`
- Modify: `app/components/layout/AppSidebar.vue` (entrée filtrée par `can('CONFIG_MANAGE')`)
- Test: `tests/unit/features/settings/SettingsForm.spec.ts`

**Interfaces:**
- Consumes: `usePlatformSettings()` (T14) ; `ConfirmActionDialog` **avec sa saisie de contrôle** (livrée au Lot C).
- Produces: page routée `/parametres`, `definePageMeta({ permission: 'CONFIG_MANAGE' })`.

**Point critique — `sms_enabled`.** Ce réglage conditionne aussi l'authentification par OTP : le passer à `false` empêcherait **tout le monde de se connecter**. Son geste exige donc la **double confirmation par saisie**, et son message d'avertissement doit nommer cette conséquence en toutes lettres. Les trois autres clés se modifient par confirmation simple.

- [ ] **Étape 1 : Tests qui échouent.**
  - chaque réglage affiche sa valeur, son unité lisible et sa dernière modification (qui, quand) ;
  - modifier `commission_rate_percent` hors bornes (0–30) désactive l'enregistrement et affiche pourquoi, **sans appel réseau** ;
  - modifier `reimbursement_cap_eur` au-delà de 500 est refusé de même ;
  - `urgency_threshold_days` est présenté **en jours** — un test verrouille le libellé, l'unité étant le piège documenté du lot ;
  - désactiver `sms_enabled` ouvre une confirmation **avec saisie de contrôle** dont le message mentionne la connexion des utilisateurs ; tant que la saisie ne correspond pas, la validation reste désactivée ;
  - modifier un autre réglage ouvre une confirmation **simple** (pas de saisie) — la protection lourde ne doit pas être infligée à tous les gestes ;
  - les commandes sont désactivées pendant l'appel.

- [ ] **Étape 2 :** `pnpm vitest run tests/unit/features/settings/` → **échec réel constaté**.

- [ ] **Étape 3 : Implémentation.** Bornes validées côté client **en plus** du backend : le backend reste l'autorité, le client évite l'aller-retour et explique.

- [ ] **Étape 4 :** → **vert**.

- [ ] **Étape 5 : Commit**

```bash
git add app/features/settings app/pages/parametres.vue app/components/layout/AppSidebar.vue tests/unit/features/settings
git commit -m "feat(settings): page des paramètres plateforme, double confirmation sur les SMS"
```

---

### Task 16 : Finances étendues — trois onglets en lecture seule

**Dépôt :** `yadony-admin`

**Files:**
- Create: `app/features/finance/types/index.ts`
- Create: `app/features/finance/services/financeService.ts`
- Create: `app/features/finance/components/WalletsTable.vue`
- Create: `app/features/finance/components/MobileMoneyTable.vue`
- Create: `app/features/finance/components/CashCommissionsTable.vue`
- Modify: `app/pages/transactions/index.vue` (trois onglets supplémentaires)
- Test: `tests/unit/features/finance/financeService.spec.ts`
- Test: `tests/unit/features/finance/tables.spec.ts`

**Interfaces:**
- Consumes: endpoints de la T10 ; motif d'onglets déjà en place dans `transactions/index.vue`.
- Produces: trois onglets, **aucun geste d'écriture**.

**Point critique — donnée personnelle.** `mobile_money_payments.phone_number` est stocké en clair. La table front affiche le numéro **masqué par défaut** (seuls les derniers chiffres). Un test verrouille ce masquage : c'est une donnée personnelle, et rien ne justifie de l'étaler dans une vue de consultation.

- [ ] **Étape 1 : Tests qui échouent.** Service : chemins et pagination exacts. Tables : rendu des colonnes, formatage des montants avec leur devise, état vide, état de chargement, **masquage du numéro de téléphone**, et absence de tout bouton d'action (la lecture seule est vérifiée, pas supposée).

- [ ] **Étape 2 :** `pnpm vitest run tests/unit/features/finance/` → **échec réel constaté**.

- [ ] **Étape 3 : Implémentation.**

- [ ] **Étape 4 :** → **vert**.

- [ ] **Étape 5 : Commit**

```bash
git add app/features/finance app/pages/transactions tests/unit/features/finance
git commit -m "feat(finance): onglets wallets, mobile money et commissions cash"
```

---

### Task 17 : Parcours E2E du Lot D

**Dépôt :** `yadony-admin`

**Files:**
- Create: `tests/e2e/communications.spec.ts`
- Create: `tests/e2e/parametres.spec.ts`
- Modify: `tests/e2e/transactions.spec.ts` (onglets financiers)

**Deux pièges déjà payés dans les lots précédents — ne pas les rejouer :**
1. **Ordre des routes de mock** : brancher de la plus spécifique à la plus générale. `/broadcast/preview` contient `/broadcast` ; une branche générale placée avant avale la spécifique.
2. **Attendre l'hydratation avant le premier clic** : un clic envoyé juste après `page.goto()` part avant que Nuxt n'ait hydraté et ne déclenche rien. S'ancrer sur un élément déjà rendu. C'est exactement ce qui a fait échouer un test du Lot B en CI.

- [ ] **Étape 1 : Écrire les parcours.**
  - Communications : composer un message ciblé sur un corridor, estimer les destinataires, confirmer, voir l'entrée apparaître dans l'historique.
  - Paramètres : modifier la commission (confirmation simple) ; tenter de désactiver les SMS et vérifier que la validation reste bloquée tant que la saisie de contrôle est incorrecte.
  - Transactions : basculer sur chacun des trois nouveaux onglets et vérifier le rendu, dont le masquage du numéro de téléphone.
  - Un parcours de permission : un compte sans `CONFIG_MANAGE` ne voit pas l'entrée de menu et est redirigé s'il force l'URL.

- [ ] **Étape 2 :** lancer les specs ciblées réellement et **rapporter la sortie réelle**.

- [ ] **Étape 3 : Commit**

```bash
git add tests/e2e
git commit -m "test(e2e): parcours de diffusion, de paramètres et d'onglets financiers"
```

---

### Task 18 : Vérification finale — aucune permission morte

**Dépôts :** les deux

**Files:**
- Create: `src/test/java/com/yadony/api/admin/account/AdminPermissionCoverageTest.java` (back)
- Test: `tests/unit/stores/permissionCoverage.spec.ts` (front)

**Objet :** prouver le **critère d'acceptation n°2** de la feature — *toute permission déclarée est consommée par au moins un endpoint et un élément d'interface ; plus aucune permission morte*. Ce lot a été vendu comme celui qui referme ce critère : il doit le démontrer, pas l'affirmer.

- [ ] **Étape 1 : Test back.** Balayer par réflexion toutes les valeurs de `AdminPermission` et, pour chacune, vérifier qu'au moins une méthode annotée `@PreAuthorize` sous `com.yadony.api.admin.**` la référence. Le test **échoue en nommant la permission morte** — un message du type « permission déclarée mais consommée par aucun endpoint : X ». Un tel test protège durablement : toute permission ajoutée sans être câblée fera rougir la suite.

- [ ] **Étape 2 :** le lancer → **constater le résultat réel**. S'il trouve des permissions mortes, les traiter : soit les câbler, soit — si elles n'ont plus d'objet — le documenter explicitement dans une liste d'exemption justifiée, jamais les supprimer silencieusement.

- [ ] **Étape 3 : Test front.** Vérifier que `ALL_PERMISSIONS` et l'enum back ont exactement la même cardinalité et les mêmes noms (le miroir est manuel, donc dérivable seulement par vigilance), et que chaque permission de l'interface est référencée par au moins un `can(...)` ou un `definePageMeta({ permission })`.

- [ ] **Étape 4 :** suites complètes des deux dépôts, décomptes réels rapportés.

- [ ] **Étape 5 : Commit**

```bash
git commit -m "test(rbac): verrouille l'absence de permission morte des deux côtés"
```

---
