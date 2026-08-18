# Lot A — Sécurité + gestes orphelins : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Fermer le trou de sécurité `confirm-noshow`, bloquer la publication de colis pour un user suspendu de publication, et brancher dans l'UI admin les gestes back orphelins (suspension de publication, taux de commission).

**Architecture :** Deux repos, deux PRs indépendantes. Back (`dony-back`, Spring Boot, package `com.yadony.api`) : durcissement d'une annotation `@PreAuthorize` + réplication d'une garde métier existante. Front (`yadony-admin`, Nuxt 4) : extension du service/composable/panel users existants, gating par `auth.can(...)`.

**Tech Stack :** Spring Boot 3.4 (Java 21), JUnit 5 + Mockito ; Nuxt 4 + TypeScript strict, Pinia, Vitest + @vue/test-utils, Playwright (API mockée via `page.route`).

**Spec :** `docs/superpowers/specs/2026-08-18-admin-rbac-completion-design.md` (§3 Lot A)

## Global Constraints

- Jamais de commit sur `main` — branches `fix/<nom>` ou `feature/<nom>`.
- Jamais de ligne `Co-Authored-By: Claude` dans les commits.
- Erreurs back : RFC 7807 / codes problème existants — jamais de String/Map brut depuis un contrôleur.
- Tests : tout doit passer (`./mvnw test` back, `pnpm test` front), couverture ≥ 90 % maintenue, nouveaux tests dans le même commit que le code.
- Front : aucun `setState`-like hors Pinia/composables existants ; gestes destructifs = `auth.can(...)` + confirmation.
- Back : le taux de commission est une **fraction** `[0, 0.999]` (`0.08` = 8 %) — l'UI saisit des **%** et convertit.

---

## Partie BACK — repo `dony-back`, branche `fix/admin-lot-a-security`

Créer la branche : `git checkout -b fix/admin-lot-a-security origin/main` (depuis le checkout dony-back).

### Task 1 : confirm-noshow exige DISPUTE_RESOLVE

**Files:**
- Modify: `src/main/java/com/yadony/api/cancellation/CancellationController.java:62-67`
- Test (create): `src/test/java/com/yadony/api/cancellation/CancellationControllerSecurityTest.java`

**Interfaces:**
- Consumes : `CancellationController.confirmNoShow(UUID)` existant, annoté `@PreAuthorize("hasRole('ADMIN')")`.
- Produces : même endpoint, annoté `@PreAuthorize("hasRole('ADMIN') and hasAuthority('DISPUTE_RESOLVE')")`. Aucun changement de signature.

- [ ] **Step 1 : Écrire le test qui échoue** (aucun test `PreAuthorize` n'existe dans ce repo — on teste l'annotation par réflexion, pattern déterministe et sans contexte Spring)

```java
package com.yadony.api.cancellation;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Garde-fou RBAC : confirm-noshow est un geste de résolution de litige.
 * Un compte SUPPORT (ROLE_ADMIN sans DISPUTE_RESOLVE) ne doit pas pouvoir le déclencher.
 */
class CancellationControllerSecurityTest {

    @Test
    void confirmNoShow_requiresDisputeResolveAuthority() throws NoSuchMethodException {
        PreAuthorize annotation = CancellationController.class
                .getMethod("confirmNoShow", UUID.class)
                .getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).contains("hasRole('ADMIN')");
        assertThat(annotation.value()).contains("hasAuthority('DISPUTE_RESOLVE')");
    }
}
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `./mvnw test -Dtest=CancellationControllerSecurityTest`
Attendu : FAIL — `annotation.value()` ne contient pas `hasAuthority('DISPUTE_RESOLVE')`.

- [ ] **Step 3 : Implémentation minimale** — dans `CancellationController.java`, remplacer :

```java
    @PostMapping("/bids/{bidId}/confirm-noshow")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> confirmNoShow(@PathVariable UUID bidId) {
```

par :

```java
    @PostMapping("/bids/{bidId}/confirm-noshow")
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('DISPUTE_RESOLVE')")
    public ResponseEntity<Void> confirmNoShow(@PathVariable UUID bidId) {
```

- [ ] **Step 4 : Vérifier que le test passe**

Run : `./mvnw test -Dtest=CancellationControllerSecurityTest`
Attendu : PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/main/java/com/yadony/api/cancellation/CancellationController.java \
        src/test/java/com/yadony/api/cancellation/CancellationControllerSecurityTest.java
git commit -m "fix(security): confirm-noshow exige l'authority DISPUTE_RESOLVE

Un compte SUPPORT (ROLE_ADMIN sans DISPUTE_RESOLVE) pouvait confirmer un
no-show via l'API alors que l'UI admin masquait déjà le geste."
```

---

### Task 2 : suspension de publication appliquée aux colis

Contexte : `publishingSuspended` n'est appliqué que dans `AnnouncementService.assertPublishingNotSuspended` (`matching/AnnouncementService.java:1187`). Les demandes de colis (`requests/`) l'ignorent. Le package `requests/` utilise `ResponseStatusException` avec des codes `domaine/slug` (ex. `kyc/not-verified`) — suivre CE pattern local, pas `YadonyBusinessException`.

**Files:**
- Modify: `src/main/java/com/yadony/api/requests/service/PackageRequestService.java` (méthodes `createAndReturnEntity` ~l.187 et `publish` ~l.392)
- Test (create): `src/test/java/com/yadony/api/requests/service/PackageRequestServicePublishingSuspensionTest.java`

**Interfaces:**
- Consumes : `UserEntity.isPublishingSuspended()` (existant), `userRepository.findById(...)` déjà appelé dans les deux méthodes.
- Produces : création non-brouillon et publication rejettent en 403 `user/publishing-suspended` si `sender.isPublishingSuspended()`.

- [ ] **Step 1 : Écrire les tests qui échouent.** Reprendre le setup (mocks + construction du service + builder de requête valide) de `src/test/java/com/yadony/api/requests/service/PackageRequestServiceTest.java` — le lire AVANT d'écrire ce test et copier sa mécanique exacte. Squelette :

```java
package com.yadony.api.requests.service;

import com.yadony.api.auth.UserEntity;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * D4 côté colis : un utilisateur suspendu de publication ne peut ni créer
 * une demande publiée ni publier un brouillon (parité avec AnnouncementService).
 */
class PackageRequestServicePublishingSuspensionTest {

    // Reprendre ici le même setup (mocks + new PackageRequestService(...))
    // que PackageRequestServiceTest.java (même package).

    @Test
    void create_nonDraft_rejectedWhenPublishingSuspended() {
        UserEntity sender = /* user VERIFIED du setup existant */;
        sender.setPublishingSuspended(true);

        assertThatThrownBy(() -> service.createAndReturnEntity(sender.getId(), validNonDraftRequest()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> {
                    ResponseStatusException rse = (ResponseStatusException) e;
                    org.assertj.core.api.Assertions.assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    org.assertj.core.api.Assertions.assertThat(rse.getReason()).isEqualTo("user/publishing-suspended");
                });
    }

    @Test
    void create_draft_allowedWhenPublishingSuspended() {
        UserEntity sender = /* user du setup */;
        sender.setPublishingSuspended(true);
        // requête avec saveAsDraft = true → aucune exception attendue
        service.createAndReturnEntity(sender.getId(), validDraftRequest());
    }

    @Test
    void publish_rejectedWhenPublishingSuspended() {
        UserEntity sender = /* user du setup, propriétaire d'un brouillon existant */;
        sender.setPublishingSuspended(true);

        assertThatThrownBy(() -> service.publish(sender.getId(), draftId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> org.assertj.core.api.Assertions
                        .assertThat(((ResponseStatusException) e).getReason())
                        .isEqualTo("user/publishing-suspended"));
    }
}
```

(Si `UserEntity` n'a pas de setter `setPublishingSuspended`, vérifier son nom exact dans `auth/UserEntity.java` et l'utiliser — il existe puisque `UserService.suspendPublishing` positionne le flag.)

- [ ] **Step 2 : Vérifier l'échec**

Run : `./mvnw test -Dtest=PackageRequestServicePublishingSuspensionTest`
Attendu : FAIL — aucune exception levée (la garde n'existe pas).

- [ ] **Step 3 : Implémentation.** Dans `PackageRequestService` :

Ajouter la garde privée (même javadoc D4 que côté annonces) :

```java
    /** D4 : expéditeur suspendu de publication (décision admin) — parité avec AnnouncementService. */
    private static void assertPublishingNotSuspended(UserEntity sender) {
        if (sender.isPublishingSuspended()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "user/publishing-suspended");
        }
    }
```

Dans `createAndReturnEntity`, juste après le contrôle KYC non-brouillon :

```java
        if (!isDraft && sender.getKycStatus() != KycStatus.VERIFIED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "kyc/not-verified");
        }
        if (!isDraft) {
            assertPublishingNotSuspended(sender);
        }
```

Dans `publish(UUID callerUid, UUID requestId)`, juste après le chargement du sender (`userRepository.findById(callerUid)...`) :

```java
        assertPublishingNotSuspended(sender);
```

- [ ] **Step 4 : Vérifier que tout passe (non-régression comprise)**

Run : `./mvnw test -Dtest='PackageRequest*'` puis `./mvnw test`
Attendu : PASS partout.

- [ ] **Step 5 : Commit**

```bash
git add src/main/java/com/yadony/api/requests/service/PackageRequestService.java \
        src/test/java/com/yadony/api/requests/service/PackageRequestServicePublishingSuspensionTest.java
git commit -m "fix: la suspension de publication bloque aussi les demandes de colis

La garde publishingSuspended n'existait que dans AnnouncementService :
un utilisateur suspendu pouvait encore publier des demandes de colis."
```

---

### Task 3 : couverture back + PR

- [ ] **Step 1 :** `./mvnw test jacoco:report` — vérifier couverture globale ≥ 90 % (`target/site/jacoco/index.html`).
- [ ] **Step 2 :** Pousser et ouvrir la PR :

```bash
git push -u origin fix/admin-lot-a-security
gh pr create --title "fix(security): Lot A — confirm-noshow RBAC + suspension publication colis" --body "## Lot A back (spec 2026-08-18-admin-rbac-completion-design.md §3)

- confirm-noshow exige désormais hasAuthority('DISPUTE_RESOLVE') — un SUPPORT ne peut plus le déclencher
- publishingSuspended appliqué aux demandes de colis (création publiée + publication de brouillon), parité annonces
- Tests : annotation par réflexion + matrice création/brouillon/publication

https://claude.ai/code/session_01FtU6HzNLifyjmbsvsuQJnk"
```

---

## Partie FRONT — repo `yadony-admin`, branche `feature/admin-lot-a-gestes-users`

Créer la branche : `git checkout -b feature/admin-lot-a-gestes-users origin/main`.

Rappels d'API back consommée :
- `POST /admin/users/{id}/suspend-publishing?reason=...` → **204, corps vide** (raison en query param, optionnelle côté back mais obligatoire côté UI)
- `POST /admin/users/{id}/lift-publishing-suspension` → **204, corps vide**
- `PUT /admin/users/{id}/commission-rate` body `{ "rate": 0.08 | null }` → **200 AdminUserDetail** (fraction `[0, 0.999]`, `null` = retour au taux global)

### Task 4 : service users — 2 nouveaux appels

**Files:**
- Modify: `app/features/users/services/usersService.ts`
- Test (modify): `tests/unit/features/users/usersService.spec.ts`

**Interfaces:**
- Produces : `usersService.suspendPublishing(id: string, reason: string): Promise<void>` et `usersService.liftPublishingSuspension(id: string): Promise<void>`. (`setCommissionRate` existe déjà — ne pas le recréer.)

- [ ] **Step 1 : Tests qui échouent** — dans `usersService.spec.ts`, suivre le pattern de mock `useApi` déjà utilisé dans ce fichier (le lire d'abord ; il mocke `@/composables/useApi`), puis ajouter :

```ts
  it('suspendPublishing POSTs reason as query param', async () => {
    await usersService.suspendPublishing('u1', 'annonces frauduleuses')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/suspend-publishing', {
      method: 'POST',
      query: { reason: 'annonces frauduleuses' },
    })
  })

  it('liftPublishingSuspension POSTs without body', async () => {
    await usersService.liftPublishingSuspension('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/lift-publishing-suspension', {
      method: 'POST',
    })
  })
```

(`apiMock` = le mock de l'instance retournée par `useApi()` tel que nommé dans ce fichier de spec — réutiliser le nom existant.)

- [ ] **Step 2 :** `pnpm vitest run tests/unit/features/users/usersService.spec.ts` → FAIL (méthodes absentes).

- [ ] **Step 3 : Implémentation** — ajouter dans l'objet `usersService` :

```ts
  suspendPublishing(id: string, reason: string): Promise<void> {
    return useApi()(`/admin/users/${id}/suspend-publishing`, { method: 'POST', query: { reason } })
  },
  liftPublishingSuspension(id: string): Promise<void> {
    return useApi()(`/admin/users/${id}/lift-publishing-suspension`, { method: 'POST' })
  },
```

- [ ] **Step 4 :** `pnpm vitest run tests/unit/features/users/usersService.spec.ts` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add app/features/users/services/usersService.ts tests/unit/features/users/usersService.spec.ts
git commit -m "feat(users): appels service suspension/levée de publication"
```

---

### Task 5 : composable useUserDetail — gestes publication

**Files:**
- Modify: `app/features/users/composables/useUserDetail.ts`
- Test (modify): `tests/unit/features/users/useUserDetail.spec.ts`

**Interfaces:**
- Consumes : `usersService.suspendPublishing/liftPublishingSuspension` (Task 4), `usersService.get` (existant), helper interne `run(fn)` (existant — il remplace `user.value` par le retour de `fn`).
- Produces : `suspendPublishing(reason: string): Promise<void>` et `liftPublishing(): Promise<void>` exposés par `useUserDetail()`. Les endpoints répondant 204, on ré-hydrate via `usersService.get`.

- [ ] **Step 1 : Tests qui échouent** — dans `useUserDetail.spec.ts` (réutiliser le mock de `usersService` existant du fichier) :

```ts
  it('suspendPublishing calls the service then refetches the detail', async () => {
    usersServiceMock.get.mockResolvedValue({ ...detail, publishingSuspended: true })
    const d = useUserDetail()
    await d.open('u1')
    await d.suspendPublishing('fraude')
    expect(usersServiceMock.suspendPublishing).toHaveBeenCalledWith('u1', 'fraude')
    expect(d.user.value?.publishingSuspended).toBe(true)
  })

  it('liftPublishing calls the service then refetches the detail', async () => {
    usersServiceMock.get.mockResolvedValue({ ...detail, publishingSuspended: false })
    const d = useUserDetail()
    await d.open('u1')
    await d.liftPublishing()
    expect(usersServiceMock.liftPublishingSuspension).toHaveBeenCalledWith('u1')
  })
```

- [ ] **Step 2 :** `pnpm vitest run tests/unit/features/users/useUserDetail.spec.ts` → FAIL.

- [ ] **Step 3 : Implémentation** — dans `useUserDetail.ts`, après `unsuspend` :

```ts
  const suspendPublishing = (reason: string) =>
    run(async () => { await usersService.suspendPublishing(user.value!.id, reason); return usersService.get(user.value!.id) })
  const liftPublishing = () =>
    run(async () => { await usersService.liftPublishingSuspension(user.value!.id); return usersService.get(user.value!.id) })
```

et les ajouter au `return` : `{ ..., suspendPublishing, liftPublishing }`.

- [ ] **Step 4 :** `pnpm vitest run tests/unit/features/users/useUserDetail.spec.ts` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add app/features/users/composables/useUserDetail.ts tests/unit/features/users/useUserDetail.spec.ts
git commit -m "feat(users): gestes suspension/levée de publication dans useUserDetail"
```

---

### Task 6 : UserDetailPanel — UI publication + commission

**Files:**
- Modify: `app/features/users/components/UserDetailPanel.vue`
- Test (modify): `tests/unit/features/users/UserDetailPanel.spec.ts`

**Interfaces:**
- Consumes : `auth.can('USER_SUSPEND')` / `auth.can('USER_COMMISSION')` (store existant), prop `user: AdminUserDetail` (champs `publishingSuspended: boolean`, `commissionRateOverride: number | null` — fraction).
- Produces : nouveaux emits `suspendPublishing: [reason: string]`, `liftPublishing: []`, `setCommission: [rate: number | null]` (rate = **fraction** déjà convertie, ex. `0.08`). Le dialog raison/confirmation existant (`pending`, `data-test="reason"`, `data-test="confirm"`) est réutilisé pour la suspension de publication.

- [ ] **Step 1 : Tests qui échouent** — ajouter dans `UserDetailPanel.spec.ts` (le `baseUser` du fichier a déjà `publishingSuspended: false` et `commissionRateOverride: null`) :

```ts
  it('shows suspend-publishing action for ADMIN when not suspended', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="action-suspend-publishing"]').exists()).toBe(true)
    expect(w.find('[data-test="action-lift-publishing"]').exists()).toBe(false)
  })

  it('shows lift-publishing action when publishing is suspended', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, publishingSuspended: true }, open: true } })
    expect(w.find('[data-test="action-lift-publishing"]').exists()).toBe(true)
    expect(w.find('[data-test="action-suspend-publishing"]').exists()).toBe(false)
  })

  it('emits suspendPublishing with reason via the confirm dialog', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="action-suspend-publishing"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('annonces frauduleuses')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('suspendPublishing')![0]).toEqual(['annonces frauduleuses'])
  })

  it('hides publishing actions without USER_SUSPEND permission', () => {
    seedAuth('SUPPORT', { USER_SUSPEND: false })
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="action-suspend-publishing"]').exists()).toBe(false)
  })

  it('commission editor: converts percent input to fraction on apply', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="commission-input"]').setValue('8')
    await w.find('[data-test="commission-apply"]').trigger('click')
    expect(w.emitted('setCommission')![0]).toEqual([0.08])
  })

  it('commission editor: reset emits null', async () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, commissionRateOverride: 0.08 }, open: true } })
    await w.find('[data-test="commission-reset"]').trigger('click')
    expect(w.emitted('setCommission')![0]).toEqual([null])
  })

  it('hides commission editor without USER_COMMISSION permission', () => {
    seedAuth('SUPPORT')
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="commission-input"]').exists()).toBe(false)
  })
```

- [ ] **Step 2 :** `pnpm vitest run tests/unit/features/users/UserDetailPanel.spec.ts` → FAIL (nouveaux tests uniquement ; les anciens restent verts).

- [ ] **Step 3 : Implémentation.** Dans `UserDetailPanel.vue` :

Script — étendre emits et l'état `Pending`, ajouter l'état commission :

```ts
const emit = defineEmits<{
  close: []; suspend: [reason: string]; ban: [reason: string]; unsuspend: [];
  suspendPublishing: [reason: string]; liftPublishing: []; setCommission: [rate: number | null];
}>()

type Pending = 'suspend' | 'ban' | 'suspendPublishing' | null

const commissionPercent = ref<string>(
  props.user.commissionRateOverride !== null ? String(props.user.commissionRateOverride * 100) : ''
)

function applyCommission() {
  const pct = Number.parseFloat(commissionPercent.value)
  if (Number.isNaN(pct) || pct < 0 || pct >= 100) return
  emit('setCommission', Math.round(pct * 10) / 1000) // % → fraction, 1 décimale de %
}
```

Étendre le handler de confirmation existant (celui qui émet selon `pending`) :

```ts
  if (pending.value === 'suspend') emit('suspend', reason)
  else if (pending.value === 'ban') emit('ban', reason)
  else if (pending.value === 'suspendPublishing') emit('suspendPublishing', reason)
```

et le titre/message/label de la modale existante : cas `suspendPublishing` → titre « Suspendre la publication », message « L'utilisateur ne pourra plus publier ni trajets ni colis. », label « Suspendre la publication ».

Template — dans le bloc d'actions, après unsuspend :

```html
<button
  v-if="!user.publishingSuspended && auth.can('USER_SUSPEND')" type="button"
  data-test="action-suspend-publishing"
  @click="pending = 'suspendPublishing'"
>Suspendre la publication</button>
<button
  v-if="user.publishingSuspended && auth.can('USER_SUSPEND')" type="button"
  data-test="action-lift-publishing"
  @click="emit('liftPublishing')"
>Lever la suspension de publication</button>
```

Affichage d'état dans la `<dl>` descriptive (à côté de KYC) :

```html
<div><dt class="text-text-muted">Publication</dt>
  <dd>{{ user.publishingSuspended ? 'Suspendue' : 'Autorisée' }}</dd></div>
```

Éditeur commission (section dédiée, mêmes classes utilitaires que le reste du panel) :

```html
<div v-if="auth.can('USER_COMMISSION')" class="mt-4 space-y-2">
  <p class="text-text-muted">Commission
    <span v-if="user.commissionRateOverride !== null">
      — dérogation actuelle : {{ (user.commissionRateOverride * 100).toFixed(1) }} %</span>
    <span v-else> — taux global appliqué</span>
  </p>
  <div class="flex items-center gap-2">
    <input data-test="commission-input" v-model="commissionPercent" type="number"
           min="0" max="99.9" step="0.1" placeholder="ex. 8" />
    <button type="button" data-test="commission-apply" @click="applyCommission">Appliquer</button>
    <button v-if="user.commissionRateOverride !== null" type="button"
            data-test="commission-reset" @click="emit('setCommission', null)">Réinitialiser</button>
  </div>
</div>
```

Styles : reprendre exactement les classes des boutons/inputs déjà présents dans ce fichier (ne pas inventer de nouvelles variantes).

- [ ] **Step 4 :** `pnpm vitest run tests/unit/features/users/UserDetailPanel.spec.ts` → PASS (anciens + nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add app/features/users/components/UserDetailPanel.vue tests/unit/features/users/UserDetailPanel.spec.ts
git commit -m "feat(users): UI suspension de publication + éditeur de commission (RBAC)"
```

---

### Task 7 : câblage page users + E2E

**Files:**
- Modify: `app/pages/users/index.vue:32-38`
- Test (modify): `tests/e2e/users.spec.ts`

**Interfaces:**
- Consumes : emits du panel (Task 6), méthodes du composable (Task 5), `detail.setCommissionRate` (existant).

- [ ] **Step 1 : Câbler la page** — sur `<UserDetailPanel>`, après `@unsuspend` :

```html
      @suspend-publishing="async (r) => { await detail.suspendPublishing(r); await afterAction() }"
      @lift-publishing="async () => { await detail.liftPublishing(); await afterAction() }"
      @set-commission="async (rate) => { await detail.setCommissionRate(rate); await afterAction() }"
```

- [ ] **Step 2 : Test E2E qui échoue** — dans `tests/e2e/users.spec.ts`, suivre le pattern existant (seed `ADMIN`, `page.route('**/api/v1/admin/users**')` branché sur URL/méthode). Ajouter au routeur mock une branche :

```ts
    if (method === 'POST' && url.includes('/suspend-publishing')) {
      return route.fulfill({ status: 204, body: '' })
    }
```

et le test (adapter `DETAIL_U1` : il doit contenir `publishingSuspended: false` ; prévoir une variante `{ ...DETAIL_U1, publishingSuspended: true }` renvoyée après le POST, même mécanique d'état que le mock suspend existant) :

```ts
test('admin suspend la publication depuis la fiche user', async ({ page }) => {
  // seed + navigation identiques aux tests existants du fichier
  await page.locator('[data-test="user-row"]').first().click()
  await page.locator('[data-test="action-suspend-publishing"]').click()
  await page.locator('[data-test="reason"]').fill('annonces frauduleuses')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="action-lift-publishing"]')).toBeVisible()
})
```

- [ ] **Step 3 :** `pnpm e2e tests/e2e/users.spec.ts` → le nouveau test PASS, les anciens restent verts.

- [ ] **Step 4 : Commit**

```bash
git add app/pages/users/index.vue tests/e2e/users.spec.ts
git commit -m "feat(users): câblage page + E2E suspension de publication et commission"
```

---

### Task 8 : vérification finale + PR front

- [ ] **Step 1 :** `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm e2e` — tout vert, couverture ≥ 90 %.
- [ ] **Step 2 :** Pousser et ouvrir la PR :

```bash
git push -u origin feature/admin-lot-a-gestes-users
gh pr create --title "feat(users): Lot A — suspension de publication + commission par user" --body "## Lot A front (spec 2026-08-18-admin-rbac-completion-design.md §3)

- Gestes « Suspendre/Lever la publication » sur la fiche user (USER_SUSPEND, raison + confirmation)
- Éditeur de dérogation de commission en % → fraction back [0, 0.999] (USER_COMMISSION)
- 204 → re-fetch du détail ; tests service/composable/panel + E2E

Dépend de la PR back fix/admin-lot-a-security (endpoints déjà en prod pour publishing ; RBAC inchangé côté front).

https://claude.ai/code/session_01FtU6HzNLifyjmbsvsuQJnk"
```

- [ ] **Step 3 :** Après merge des deux PRs : rejouer la suite E2E complète sur `main` (non-régression des gestes existants, critère spec §7).
