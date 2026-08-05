# Admin Authentication Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les identifiants techniques de l'admin par des emails reels, provisionner un unique super-admin et lui permettre de gerer des comptes `ADMIN` et `SUPPORT` avec mots de passe temporaires.

**Architecture:** Firebase Authentication reste responsable des identites et mots de passe. `dony-back` reste la source de verite pour le role, le statut, `mustChangePassword` et les permissions ; `dony-admin` recharge `/admin/me` a chaque session et ne persiste plus l'ID token dans `localStorage`. Les changements backend sont livres avant le frontend car ils definissent les contrats API.

**Tech Stack:** Java 21, Spring Boot, Spring Security, Firebase Admin SDK, PostgreSQL/Flyway, JUnit 5/Mockito, Nuxt 4, Vue 3, Pinia, Firebase Web SDK, Vitest, Playwright, TypeScript.

## Global Constraints

- Le seul email autorise pour le role `SUPER_ADMIN` est `aboubakar.diakite@yadony.com`.
- Les API du panel n'acceptent que `ADMIN` et `SUPPORT` comme roles gerables.
- Le mot de passe de bootstrap vient d'un secret de deploiement et ne doit jamais apparaitre dans le code, Git, les logs ou les tests.
- Les mots de passe temporaires sont generes avec `SecureRandom`, contiennent 20 caracteres et sont retournes une seule fois.
- Tout nouveau mot de passe contient au moins 12 caracteres ; le backend applique cette limite.
- Un compte avec `mustChangePassword=true` ne peut appeler que `GET /admin/me` et `POST /admin/me/change-password` dans l'espace admin.
- Le backend applique toutes les autorisations ; le masquage frontend n'est qu'une aide d'interface.
- Ne jamais modifier ni supprimer les changements locaux sans rapport. `dony-back` contient deja un plan non suivi sous `docs/superpowers/plans/` a preserver.
- Creer une branche `codex/admin-auth-redesign` dans chacun des deux depots avant leurs premieres modifications ; ne jamais committer sur `main`.

---

### Task 1: Migrer le modele backend de `login` vers `email`

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/resources/db/migration/V189__admin_users_email_identity.sql`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminUserEntity.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminUserRepository.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminAuthorities.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminPrincipal.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/dto/AdminProfileResponse.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/dto/AdminSummary.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/dto/CreateAdminRequest.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/dto/CredentialsResponse.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/dto/UpdateAdminRequest.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/account/AdminUserRepositoryTest.java`

**Interfaces:**
- Consumes: table `admin_users` existante et enum `AdminRole`.
- Produces: `AdminUserEntity#getEmail()`, `findByEmailIgnoreCase(String)`, `existsByEmailIgnoreCase(String)`, `countByRole(AdminRole)`, `CreateAdminRequest(String email, AdminRole role)`, `CredentialsResponse(String email, String temporaryPassword)`, `UpdateAdminRequest(AdminRole role, Map<String, Boolean> permissionOverrides, AdminStatus status)`.

- [ ] **Step 1: Ecrire les tests repository en echec**

```java
@Test
void findByEmailIsCaseInsensitive() {
    repository.save(new AdminUserEntity("uid-1", "admin@yadony.com", AdminRole.ADMIN));
    assertThat(repository.findByEmailIgnoreCase("ADMIN@YADONY.COM")).isPresent();
}

@Test
void onlyOneSuperAdminCanBePersisted() {
    repository.saveAndFlush(new AdminUserEntity("uid-root", "aboubakar.diakite@yadony.com", AdminRole.SUPER_ADMIN));
    assertThatThrownBy(() -> repository.saveAndFlush(
        new AdminUserEntity("uid-root-2", "other@yadony.com", AdminRole.SUPER_ADMIN)))
        .isInstanceOf(DataIntegrityViolationException.class);
}
```

- [ ] **Step 2: Executer le test cible et constater l'echec**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminUserRepositoryTest`

Expected: FAIL car les methodes email et la contrainte d'unicite n'existent pas.

- [ ] **Step 3: Ajouter la migration Flyway**

```sql
ALTER TABLE admin_users RENAME COLUMN login TO email;
ALTER TABLE admin_users ALTER COLUMN email TYPE VARCHAR(320);
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_login_key;
CREATE UNIQUE INDEX uq_admin_users_email_lower
    ON admin_users (LOWER(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_admin_users_single_super_admin
    ON admin_users ((role)) WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL;
```

- [ ] **Step 4: Renommer le modele et les DTO sans conserver d'alias `login`**

```java
@Column(name = "email", nullable = false, length = 320)
private String email;

public AdminUserEntity(String firebaseUid, String email, AdminRole role) {
    this();
    this.firebaseUid = firebaseUid;
    this.email = email;
    this.role = role;
}

public record CreateAdminRequest(String email, AdminRole role) {}
public record CredentialsResponse(String email, String temporaryPassword) {}
public record UpdateAdminRequest(
        AdminRole role,
        Map<String, Boolean> permissionOverrides,
        AdminStatus status
) {}
```

- [ ] **Step 5: Adapter repository, profil, resume, authorities et principal**

```java
Optional<AdminUserEntity> findByEmailIgnoreCase(String email);
boolean existsByEmailIgnoreCase(String email);
long countByRole(AdminRole role);
```

Remplacer chaque champ/accessor `login` par `email` dans les records et mappings admin de cette tache.

- [ ] **Step 6: Executer les tests du package account**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest='AdminUserRepositoryTest,AdminAuthServiceTest,AdminPermissionsTest'`

Expected: PASS.

- [ ] **Step 7: Committer le modele email**

```bash
git add src/main/resources/db/migration/V189__admin_users_email_identity.sql src/main/java/com/yadony/api/admin/account src/test/java/com/yadony/api/admin/account/AdminUserRepositoryTest.java
git commit -m "feat(admin): use email identities"
```

### Task 2: Verrouiller la creation et le cycle de vie des comptes

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminAccountService.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminAccountController.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/account/AdminAccountServiceTest.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/account/AdminAccountControllerIT.java`

**Interfaces:**
- Consumes: DTO email de Task 1, `FirebaseAuth`, `AdminAuthService`, `AuditService`.
- Produces: `createAdmin(CreateAdminRequest, UUID)`, `bootstrapSuperAdmin(String, String)`, `resetPassword(UUID, UUID)`, `updateAdmin(UUID, UpdateAdminRequest, UUID)` avec invariants racine.

- [ ] **Step 1: Ecrire les tests de creation et de gardes en echec**

```java
@Test
void createAdminRejectsSuperAdminRole() {
    CreateAdminRequest req = new CreateAdminRequest("other@yadony.com", AdminRole.SUPER_ADMIN);
    assertThatThrownBy(() -> service.createAdmin(req, actorId))
        .isInstanceOfSatisfying(YadonyBusinessException.class,
            ex -> assertThat(ex.getErrorCode()).isEqualTo("ADMIN_ROLE_FORBIDDEN"));
}

@Test
void createAdminNormalizesEmailAndGeneratesPassword() throws Exception {
    when(firebaseAuth.createUser(any())).thenReturn(firebaseUser("uid-new"));
    CredentialsResponse result = service.createAdmin(
        new CreateAdminRequest(" New.Admin@Yadony.com ", AdminRole.ADMIN), actorId);
    assertThat(result.email()).isEqualTo("new.admin@yadony.com");
    assertThat(result.temporaryPassword()).hasSize(20);
    verify(repository).save(argThat(a -> a.getEmail().equals("new.admin@yadony.com")
        && Boolean.TRUE.equals(a.getMustChangePassword())));
}

@Test
void updateRejectsEveryMutationOfRootAccount() {
    when(repository.findById(rootId)).thenReturn(Optional.of(rootEntity()));
    assertThatThrownBy(() -> service.updateAdmin(rootId,
        new UpdateAdminRequest(AdminRole.ADMIN, null, null), actorId))
        .isInstanceOfSatisfying(YadonyBusinessException.class,
            ex -> assertThat(ex.getErrorCode()).isEqualTo("ADMIN_SUPER_ADMIN_IMMUTABLE"));
}
```

- [ ] **Step 2: Executer les tests et constater l'echec**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminAccountServiceTest`

Expected: FAIL sur les nouveaux contrats et codes metier.

- [ ] **Step 3: Implementer validation email et creation publique**

```java
private static final String ROOT_EMAIL = "aboubakar.diakite@yadony.com";

public CredentialsResponse createAdmin(CreateAdminRequest req, UUID actorId) {
    if (req.role() == null || req.role() == AdminRole.SUPER_ADMIN) {
        throw business(HttpStatus.FORBIDDEN, "ADMIN_ROLE_FORBIDDEN", "Role forbidden");
    }
    String email = normalizeEmail(req.email());
    return createFirebaseAndPersist(email, generatePassword(), req.role(), actorId);
}

private String normalizeEmail(String raw) {
    String email = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    if (!EMAIL_PATTERN.matcher(email).matches()) {
        throw business(HttpStatus.BAD_REQUEST, "ADMIN_EMAIL_INVALID", "Invalid email");
    }
    return email;
}
```

`createFirebaseAndPersist` doit refuser toute collision Firebase ou PostgreSQL, poser le claim `ROLE_ADMIN`, supprimer le nouvel utilisateur Firebase si les claims ou la sauvegarde echouent, puis retourner les identifiants une seule fois.

- [ ] **Step 4: Implementer les gardes de mutation et la revocation**

```java
private void rejectRootMutation(AdminUserEntity entity) {
    if (entity.getRole() == AdminRole.SUPER_ADMIN || ROOT_EMAIL.equalsIgnoreCase(entity.getEmail())) {
        throw business(HttpStatus.CONFLICT, "ADMIN_SUPER_ADMIN_IMMUTABLE", "SUPER_ADMIN is immutable");
    }
}
```

Appeler cette garde au debut de `updateAdmin`, `resetPassword` et `deleteAdmin`. Lors d'une desactivation ou reinitialisation ordinaire, appeler `firebaseAuth.revokeRefreshTokens(firebaseUid)` apres la mise a jour Firebase et vider `adminAuthz`.

- [ ] **Step 5: Simplifier les contrats controller**

Le `POST /admin/admins` accepte seulement `{ "email": "...", "role": "ADMIN|SUPPORT" }`. Le `PATCH` n'accepte plus d'email et aucune route du panel n'appelle la creation racine.

```java
@PostMapping("/admins")
@ResponseStatus(HttpStatus.CREATED)
public CredentialsResponse create(@RequestBody CreateAdminRequest req, Authentication auth) {
    return adminAccountService.createAdmin(req, extractActorId(auth));
}

@PatchMapping("/admins/{id}")
public AdminSummary update(@PathVariable UUID id, @RequestBody UpdateAdminRequest req,
                           Authentication auth) {
    return AdminSummary.from(adminAccountService.updateAdmin(id, req, extractActorId(auth)));
}
```

- [ ] **Step 6: Executer les tests service et controller**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest='AdminAccountServiceTest,AdminAccountControllerIT'`

Expected: PASS, y compris rollback Firebase, collisions email et invariants racine.

- [ ] **Step 7: Committer le cycle de vie**

```bash
git add src/main/java/com/yadony/api/admin/account src/test/java/com/yadony/api/admin/account
git commit -m "feat(admin): secure account lifecycle"
```

### Task 3: Transformer le bootstrap en creation ponctuelle

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminBootstrapController.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminAccountService.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/resources/application.yml`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/.env.example`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/account/AdminBootstrapControllerIT.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/account/AdminAccountServiceTest.java`

**Interfaces:**
- Consumes: `bootstrapSuperAdmin(email, password)` de Task 2.
- Produces: `POST /admin/bootstrap` creation-only, `201` au premier appel, `409` ensuite, `404` quand le secret est absent.

- [ ] **Step 1: Remplacer les tests break-glass par les tests creation-only**

```java
@Test
void existingSuperAdminReturns409WithoutReset() throws Exception {
    when(repository.countByRole(AdminRole.SUPER_ADMIN)).thenReturn(1L);
    mockMvc.perform(post("/admin/bootstrap").header("X-Bootstrap-Secret", VALID_SECRET))
        .andExpect(status().isConflict());
    verify(service, never()).resetPassword(any(), any());
}

@Test
void configuredIdentityCreatesCanonicalRoot() throws Exception {
    when(repository.countByRole(AdminRole.SUPER_ADMIN)).thenReturn(0L);
    mockMvc.perform(post("/admin/bootstrap").header("X-Bootstrap-Secret", VALID_SECRET))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.email").value("aboubakar.diakite@yadony.com"));
    verify(service).bootstrapSuperAdmin("aboubakar.diakite@yadony.com", "test-only-password");
}
```

- [ ] **Step 2: Executer les tests et constater l'echec**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest=AdminBootstrapControllerIT`

Expected: FAIL car le mode break-glass existe encore.

- [ ] **Step 3: Ajouter les trois proprietes de bootstrap**

```yaml
yadony:
  admin:
    bootstrap:
      secret: ${ADMIN_BOOTSTRAP_SECRET:}
      email: ${ADMIN_BOOTSTRAP_EMAIL:}
      password: ${ADMIN_BOOTSTRAP_PASSWORD:}
```

Documenter seulement les noms de variables dans `.env.example`, sans valeur reelle.

- [ ] **Step 4: Implementer le controller creation-only**

Le controller retourne `404` si un des trois secrets manque, compare `X-Bootstrap-Secret` en temps constant, refuse un email different de l'identite racine, retourne `409` si une ligne `SUPER_ADMIN` existe et appelle `bootstrapSuperAdmin` sinon. La reponse `201` expose seulement l'email, jamais le mot de passe configure.

```java
if (!bootstrapConfigured()) return ResponseEntity.notFound().build();
if (!constantTimeEquals(bootstrapSecret, providedSecret)) return forbidden();
if (!ROOT_EMAIL.equalsIgnoreCase(bootstrapEmail)) return invalidRootIdentity();
if (adminUserRepository.countByRole(AdminRole.SUPER_ADMIN) > 0) return conflict();
adminAccountService.bootstrapSuperAdmin(bootstrapEmail, bootstrapPassword);
return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("email", bootstrapEmail));
```

- [ ] **Step 5: Executer les tests bootstrap et service**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest='AdminBootstrapControllerIT,AdminAccountServiceTest'`

Expected: PASS.

- [ ] **Step 6: Committer le bootstrap**

```bash
git add .env.example src/main/resources/application.yml src/main/java/com/yadony/api/admin/account src/test/java/com/yadony/api/admin/account
git commit -m "feat(admin): make bootstrap one-shot"
```

### Task 4: Appliquer `mustChangePassword` dans le filtre backend

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/auth/FirebaseTokenFilter.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/AdminAccountService.java`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/main/java/com/yadony/api/admin/account/dto/ChangePasswordRequest.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/auth/FirebaseTokenFilterTest.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/account/AdminAccountServiceTest.java`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-back/src/test/java/com/yadony/api/admin/account/AdminAccountControllerIT.java`

**Interfaces:**
- Consumes: `AdminAuthorities.mustChangePassword()` et routes admin existantes.
- Produces: Problem Detail `403` avec propriete `code=PASSWORD_CHANGE_REQUIRED`, et changement de mot de passe valide a 12 caracteres minimum.

- [ ] **Step 1: Ecrire les tests du filtre en echec**

```java
@Test
void passwordChangeRequiredBlocksOtherAdminRoutes() throws Exception {
    when(request.getRequestURI()).thenReturn("/api/v1/admin/users");
    when(request.getContextPath()).thenReturn("/api/v1");
    when(adminAuthService.resolve(FIREBASE_UID)).thenReturn(Optional.of(requiredPasswordAdmin()));
    authenticateAdminRequest();
    verify(response).setStatus(SC_FORBIDDEN);
    verify(filterChain, never()).doFilter(any(), any());
}

@Test
void passwordChangeRequiredAllowsOwnPasswordEndpoint() throws Exception {
    when(request.getMethod()).thenReturn("POST");
    when(request.getRequestURI()).thenReturn("/api/v1/admin/me/change-password");
    when(adminAuthService.resolve(FIREBASE_UID)).thenReturn(Optional.of(requiredPasswordAdmin()));
    authenticateAdminRequest();
    verify(filterChain).doFilter(request, response);
}

@Test
void rootCanChangeOwnPassword() {
    AdminUserEntity root = rootEntity();
    when(repository.findById(rootId)).thenReturn(Optional.of(root));
    service.changeOwnPassword(rootId, "NewSecurePass123!", rootId);
    verify(firebaseAuth).updateUser(any(UserRecord.UpdateRequest.class));
    assertThat(root.getMustChangePassword()).isFalse();
}
```

- [ ] **Step 2: Executer les tests et constater l'echec**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest='FirebaseTokenFilterTest,AdminAccountServiceTest,AdminAccountControllerIT'`

Expected: FAIL car le filtre ne bloque pas encore et le service accepte les mots de passe courts.

- [ ] **Step 3: Ajouter la garde de route au fast-path admin**

```java
if (admin.mustChangePassword() && !isPasswordChangeAllowed(request)) {
    writeForbidden(response, "PASSWORD_CHANGE_REQUIRED", "Password change required");
    return true;
}
```

`isPasswordChangeAllowed` autorise exactement `GET /admin/me` et `POST /admin/me/change-password` apres retrait du context path. `writeForbidden` ajoute `problem.setProperty("code", code)`.

- [ ] **Step 4: Valider le nouveau mot de passe dans le backend**

```java
if (newPassword == null || newPassword.length() < 12) {
    throw business(HttpStatus.BAD_REQUEST, "ADMIN_PASSWORD_TOO_SHORT",
        "Password must contain at least 12 characters");
}
```

Apres `FirebaseAuth.updateUser`, sauvegarder `mustChangePassword=false`, vider `adminAuthz`, revoquer les anciens refresh tokens et auditer sans mot de passe.

- [ ] **Step 5: Executer les tests cibles**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test -Dtest='FirebaseTokenFilterTest,AdminAccountServiceTest,AdminAccountControllerIT'`

Expected: PASS.

- [ ] **Step 6: Executer toute la suite backend**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-back && ./mvnw test`

Expected: BUILD SUCCESS, zero test failure.

- [ ] **Step 7: Committer l'enforcement backend**

```bash
git add src/main/java/com/yadony/api/auth/FirebaseTokenFilter.java src/main/java/com/yadony/api/admin/account src/test/java/com/yadony/api/auth/FirebaseTokenFilterTest.java src/test/java/com/yadony/api/admin/account
git commit -m "feat(admin): require initial password change"
```

### Task 5: Passer le frontend a la connexion email et a une session resynchronisee

**Files:**
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/stores/auth.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/auth/composables/useFirebaseAuth.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/plugins/firebase.client.ts`
- Delete: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/plugins/auth-persist.client.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/types/runtime.d.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/composables/useApi.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/middleware/auth.global.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/pages/login.vue`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/pages/change-password.vue`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/components/layout/AppSidebar.vue`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/stores/auth.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/features/auth/useFirebaseAuth.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/composables/useApi.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/middleware/auth.global.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/components/LoginPage.spec.ts`

**Interfaces:**
- Consumes: `GET /admin/me`, `POST /admin/me/change-password`, Problem Detail de Task 4.
- Produces: `AdminUser.email`, `signIn(email, password)`, `refreshProfile()`, session Pinia en memoire, garde `mustChangePassword`.

- [ ] **Step 1: Ecrire les tests frontend en echec**

```ts
it('signs in with the exact email', async () => {
  await useFirebaseAuth().signIn('Admin@Yadony.com', 'pass12345678')
  expect(fbSignInMock).toHaveBeenCalledWith(auth, 'admin@yadony.com', 'pass12345678')
})

it('does not persist the token in localStorage', () => {
  useAuthStore().setSession('token', adminUser)
  expect(localStorage.getItem('dony-admin-session')).toBeNull()
})

it('redirects required-password sessions to change-password', async () => {
  useAuthStore().setSession('token', { ...adminUser, mustChangePassword: true })
  await middleware({ path: '/users' })
  expect(navigateToMock).toHaveBeenCalledWith('/change-password')
})
```

- [ ] **Step 2: Executer les tests et constater l'echec**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm vitest run tests/unit/stores/auth.spec.ts tests/unit/features/auth/useFirebaseAuth.spec.ts tests/unit/composables/useApi.spec.ts tests/unit/middleware/auth.global.spec.ts tests/components/LoginPage.spec.ts`

Expected: FAIL sur `email`, la transformation technique et la persistance locale.

- [ ] **Step 3: Remplacer `login` par `email` et retirer la persistance manuelle**

```ts
export interface AdminUser {
  id: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT'
  status: 'ACTIVE' | 'DISABLED'
  mustChangePassword: boolean
  permissionOverrides: Record<string, boolean>
}
```

Supprimer `rehydrate`, tout acces a `dony-admin-session` et le plugin `auth-persist.client.ts`. Garder `idToken` uniquement en memoire pour les requetes en cours.

- [ ] **Step 4: Connecter Firebase avec l'email exact et recharger `/admin/me`**

```ts
async function signIn(email: string, password: string): Promise<AdminUser> {
  const normalized = email.trim().toLowerCase()
  const credential = await signInWithEmailAndPassword($firebaseAuth, normalized, password)
  const token = await credential.user.getIdToken(true)
  return refreshProfile(token)
}
```

Au demarrage Firebase, appeler toujours `/admin/me` quand `currentUser` existe. En cas d'echec, fermer Firebase et vider Pinia. Declarer `$firebaseApp` et `$firebaseAuth` comme nullable dans `runtime.d.ts`.

- [ ] **Step 5: Rendre les erreurs API coherentes**

Dans `useApi`, construire les headers avec `new Headers(options.headers)`, rafraichir le token Firebase avant requete, fermer Firebase sur `401`, rediriger vers `/change-password` pour `403` avec `data.code === 'PASSWORD_CHANGE_REQUIRED'`, et conserver la session pour les autres `403`.

```ts
const headers = new Headers(options.headers)
if (token) headers.set('Authorization', `Bearer ${token}`)
options.headers = headers

if (response.status === 401) await clearFirebaseSession()
if (response.status === 403 && response._data?.code === 'PASSWORD_CHANGE_REQUIRED') {
  await navigateTo('/change-password')
}
```

- [ ] **Step 6: Mettre a jour les pages et le middleware**

La page login utilise `type="email"`, `autocomplete="email"` et n'affiche plus le bouton demo trompeur. Le middleware autorise `/login` et `/denied`, exige une session pour `/change-password`, et redirige toute session forcee vers cette page. Apres changement, forcer un token frais puis `refreshProfile()` avant `navigateTo('/')`.

```ts
if (to.path === '/change-password' && !auth.isAuthenticated) return navigateTo('/login')
if (auth.user?.mustChangePassword && to.path !== '/change-password') {
  return navigateTo('/change-password')
}
```

- [ ] **Step 7: Executer les tests frontend cibles**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm vitest run tests/unit/stores/auth.spec.ts tests/unit/features/auth/useFirebaseAuth.spec.ts tests/unit/composables/useApi.spec.ts tests/unit/middleware/auth.global.spec.ts tests/components/LoginPage.spec.ts`

Expected: PASS.

- [ ] **Step 8: Committer la session frontend**

```bash
git add app/stores/auth.ts app/features/auth app/plugins app/types/runtime.d.ts app/composables/useApi.ts app/middleware/auth.global.ts app/pages/login.vue app/pages/change-password.vue app/components/layout/AppSidebar.vue tests
git commit -m "feat(auth): sign in admins by email"
```

### Task 6: Ajouter le client de gestion des administrateurs

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/admin-accounts/types/index.ts`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/admin-accounts/services/adminAccountsService.ts`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/admin-accounts/composables/useAdminAccounts.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/features/admin-accounts/adminAccountsService.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/features/admin-accounts/useAdminAccounts.spec.ts`

**Interfaces:**
- Consumes: endpoints `/admin/admins` de Task 2.
- Produces: `AdminAccount`, `TemporaryCredentials`, `adminAccountsService`, `useAdminAccounts()`.

- [ ] **Step 1: Ecrire les tests service en echec**

```ts
it('creates an ADMIN without sending a password', async () => {
  await adminAccountsService.create('new@yadony.com', 'ADMIN')
  expect(apiMock).toHaveBeenCalledWith('/admin/admins', {
    method: 'POST', body: { email: 'new@yadony.com', role: 'ADMIN' },
  })
})

it('resets a password and returns one-time credentials', async () => {
  await adminAccountsService.resetPassword('id-1')
  expect(apiMock).toHaveBeenCalledWith('/admin/admins/id-1/reset-password', { method: 'POST' })
})
```

- [ ] **Step 2: Executer les tests et constater l'echec**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm vitest run tests/unit/features/admin-accounts`

Expected: FAIL car le module n'existe pas.

- [ ] **Step 3: Definir les types et le service**

```ts
export type ManagedAdminRole = 'ADMIN' | 'SUPPORT'
export type AdminStatus = 'ACTIVE' | 'DISABLED'
export interface TemporaryCredentials { email: string; temporaryPassword: string }
export interface AdminAccount {
  id: string; email: string; role: 'SUPER_ADMIN' | ManagedAdminRole
  status: AdminStatus; mustChangePassword: boolean
  createdAt: string | null; lastLoginAt: string | null
}
```

Le service expose `list(page, size)`, `create(email, role)`, `update(id, { role?, status? })` et `resetPassword(id)` avec les signatures retournees par le backend.

- [ ] **Step 4: Implementer le composable d'etat**

`useAdminAccounts()` expose la liste, pagination, chargement, erreur, `temporaryCredentials`, ainsi que `fetchAccounts`, `createAccount`, `setRole`, `setStatus`, `resetPassword` et `clearTemporaryCredentials`. Une action reussie recharge la liste ; les identifiants temporaires restent dans un `ref` et sont detruits a la fermeture.

```ts
async function createAccount(email: string, role: ManagedAdminRole) {
  temporaryCredentials.value = await adminAccountsService.create(email, role)
  await fetchAccounts()
}
function clearTemporaryCredentials() {
  temporaryCredentials.value = null
}
```

- [ ] **Step 5: Executer les tests du module**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm vitest run tests/unit/features/admin-accounts`

Expected: PASS.

- [ ] **Step 6: Committer le client admin accounts**

```bash
git add app/features/admin-accounts tests/unit/features/admin-accounts
git commit -m "feat(admin): add account management client"
```

### Task 7: Construire la page Administrateurs reservee au super-admin

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/middleware/super-admin-only.ts`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/pages/administrateurs/index.vue`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/admin-accounts/components/AdminAccountsTable.vue`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/admin-accounts/components/CreateAdminDialog.vue`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/admin-accounts/components/TemporaryCredentialsDialog.vue`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/components/layout/AppSidebar.vue`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/middleware/super-admin-only.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/features/admin-accounts/AdminAccountsTable.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/features/admin-accounts/CreateAdminDialog.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/unit/features/admin-accounts/TemporaryCredentialsDialog.spec.ts`
- Test: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/components/AppSidebar.spec.ts`

**Interfaces:**
- Consumes: `useAdminAccounts()` de Task 6 et `auth.user.role` de Task 5.
- Produces: route `/administrateurs`, middleware `super-admin-only`, formulaire email/role, affichage ponctuel des identifiants.

- [ ] **Step 1: Ecrire les tests d'acces et d'interface en echec**

```ts
it('redirects ADMIN to denied', async () => {
  useAuthStore().setSession('token', { ...adminUser, role: 'ADMIN' })
  await middleware()
  expect(navigateToMock).toHaveBeenCalledWith('/denied')
})

it('shows Administrateurs only to SUPER_ADMIN', () => {
  useAuthStore().setSession('token', { ...adminUser, role: 'SUPER_ADMIN' })
  expect(mountSidebar().text()).toContain('Administrateurs')
})

it('never offers SUPER_ADMIN in the creation role selector', () => {
  const wrapper = mount(CreateAdminDialog)
  expect(wrapper.find('select').text()).not.toContain('SUPER_ADMIN')
})
```

- [ ] **Step 2: Executer les tests et constater l'echec**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm vitest run tests/unit/middleware/super-admin-only.spec.ts tests/unit/features/admin-accounts tests/components/AppSidebar.spec.ts`

Expected: FAIL car la route et les composants n'existent pas.

- [ ] **Step 3: Implementer le middleware et la navigation**

```ts
export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (auth.user?.role !== 'SUPER_ADMIN') return navigateTo('/denied')
})
```

Ajouter le lien avec l'icone Lucide `ShieldCheck` uniquement quand `auth.user?.role === 'SUPER_ADMIN'`.

- [ ] **Step 4: Implementer la table et les actions**

La table affiche email, role, statut, changement requis et actions. La ligne racine affiche les actions desactivees. Les autres lignes proposent un menu pour basculer `ADMIN`/`SUPPORT`, activer/desactiver et reinitialiser le mot de passe, avec confirmation avant les mutations.

```ts
const emit = defineEmits<{
  role: [id: string, role: ManagedAdminRole]
  status: [id: string, status: AdminStatus]
  reset: [id: string]
}>()
const isRoot = (account: AdminAccount) => account.role === 'SUPER_ADMIN'
```

- [ ] **Step 5: Implementer creation et identifiants ponctuels**

Le formulaire utilise un input email et un controle de role limite a `ADMIN`/`SUPPORT`. Apres creation ou reset, ouvrir `TemporaryCredentialsDialog`. Le bouton avec icone `Copy` appelle `navigator.clipboard.writeText(credentials.temporaryPassword)`. A la fermeture, emettre `close` puis appeler `clearTemporaryCredentials()` afin que le secret disparaisse de la memoire applicative.

```ts
const roles: ManagedAdminRole[] = ['ADMIN', 'SUPPORT']
async function copyPassword() {
  await navigator.clipboard.writeText(props.credentials.temporaryPassword)
}
```

- [ ] **Step 6: Assembler la page**

```ts
definePageMeta({
  middleware: ['admin-only', 'super-admin-only'],
  pageTitle: 'Administrateurs',
  pageSubtitle: 'Comptes et acces au back-office',
})
```

La page monte la liste, gere la pagination et connecte chaque evenement aux actions du composable.

- [ ] **Step 7: Executer les tests UI cibles**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm vitest run tests/unit/middleware/super-admin-only.spec.ts tests/unit/features/admin-accounts tests/components/AppSidebar.spec.ts`

Expected: PASS.

- [ ] **Step 8: Committer le panel**

```bash
git add app/middleware/super-admin-only.ts app/pages/administrateurs app/features/admin-accounts/components app/components/layout/AppSidebar.vue tests
git commit -m "feat(admin): manage administrator accounts"
```

### Task 8: Ajouter les parcours E2E et le typecheck CI

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/e2e/admin-auth.spec.ts`
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/e2e/admin-accounts.spec.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/tests/e2e/navigation.spec.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/plugins/expose-auth.client.ts`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/package.json`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/.github/workflows/ci.yml`
- Modify if still failing: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/components/ui/avatar/AvatarImage.vue`
- Modify if still failing: `/Users/aboubakardiakite/Desktop/dony/dony-admin/app/features/incidents/services/incidentsService.ts`

**Interfaces:**
- Consumes: flux frontend des Tasks 5-7 et API mockees selon les contrats backend.
- Produces: couverture E2E des trois roles et commande `pnpm typecheck` bloquante dans la CI.

- [ ] **Step 1: Ecrire le parcours E2E du mot de passe obligatoire**

```ts
test('required password session cannot open dashboard', async ({ page }) => {
  await seedAdmin(page, { ...ADMIN, mustChangePassword: true })
  await page.goto('/users')
  await expect(page).toHaveURL(/\/change-password$/)
})
```

- [ ] **Step 2: Ecrire le parcours E2E du panel super-admin**

Le test seed un `SUPER_ADMIN`, mocke `GET/POST/PATCH /admin/admins`, cree `new.admin@yadony.com`, verifie l'affichage ponctuel du mot de passe, ferme la boite puis confirme que le secret n'est plus dans le DOM. Un second test seed un `ADMIN` puis un `SUPPORT` et verifie l'absence du lien et la redirection `/denied`.

```ts
await page.getByRole('button', { name: 'Créer un administrateur' }).click()
await page.getByLabel('Email').fill('new.admin@yadony.com')
await page.getByLabel('Rôle').selectOption('ADMIN')
await page.getByRole('button', { name: 'Créer' }).click()
await expect(page.getByText('TempPass123!Example')).toBeVisible()
await page.getByRole('button', { name: 'Fermer' }).click()
await expect(page.getByText('TempPass123!Example')).toHaveCount(0)
```

- [ ] **Step 3: Executer les E2E et constater les eventuels ecarts**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm e2e -- tests/e2e/admin-auth.spec.ts tests/e2e/admin-accounts.spec.ts tests/e2e/navigation.spec.ts`

Expected: PASS apres adaptation du seed E2E au champ `email`.

- [ ] **Step 4: Ajouter le script typecheck et corriger toutes les erreurs**

```json
"typecheck": "nuxi typecheck"
```

Ajouter `pnpm typecheck` apres `pnpm lint` dans le job `unit`. Utiliser `Headers` dans `useApi`, rendre les injections Firebase nullable, fournir une valeur `src` non nullable a `AvatarImage` et reduire l'inference generique excessive d'`incidentsService` par un type de retour explicite. Ajouter `vue-tsc` aux devDependencies si `nuxi typecheck` le telecharge encore implicitement.

- [ ] **Step 5: Executer la verification frontend complete**

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm lint`

Expected: zero error.

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm typecheck`

Expected: exit 0.

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm test:coverage`

Expected: all tests pass and thresholds remain at statements 90%, branches 85%, functions 90%, lines 90%.

Run: `cd /Users/aboubakardiakite/Desktop/dony/dony-admin && fnm exec --using 24 pnpm e2e`

Expected: all Playwright tests pass.

- [ ] **Step 6: Committer E2E et CI**

```bash
git add tests/e2e app/plugins/expose-auth.client.ts package.json pnpm-lock.yaml .github/workflows/ci.yml app/components/ui/avatar/AvatarImage.vue app/features/incidents/services/incidentsService.ts
git commit -m "test(auth): cover admin account workflows"
```

### Task 9: Verifier le deploiement et documenter le bootstrap

**Files:**
- Create: `/Users/aboubakardiakite/Desktop/dony/dony-back/docs/admin-auth-bootstrap.md`
- Modify: `/Users/aboubakardiakite/Desktop/dony/dony-admin/README.md`

**Interfaces:**
- Consumes: variables et endpoint de Task 3, commandes de verification des Tasks 4 et 8.
- Produces: procedure sans secret pour provisionner, verifier puis desactiver le bootstrap.

- [ ] **Step 1: Ecrire la procedure operationnelle**

Le document doit decrire exactement : configurer `ADMIN_BOOTSTRAP_SECRET`, `ADMIN_BOOTSTRAP_EMAIL` et `ADMIN_BOOTSTRAP_PASSWORD` dans le gestionnaire de secrets ; deployer le backend ; appeler une fois `POST /api/v1/admin/bootstrap` avec `X-Bootstrap-Secret` ; verifier le `201` et l'email ; se connecter ; changer le mot de passe ; supprimer les trois secrets ; redemarrer ; verifier que l'endpoint retourne `404`.

- [ ] **Step 2: Ajouter la note frontend**

Le README admin indique les quatre variables Firebase/API requises, precise que l'authentification se fait par email et renvoie vers la procedure backend. Il ne contient aucun identifiant temporaire.

- [ ] **Step 3: Scanner les secrets et verifier les deux worktrees**

Run: `rg -n "ADMIN_BOOTSTRAP_(SECRET|PASSWORD)=.+" /Users/aboubakardiakite/Desktop/dony/dony-admin /Users/aboubakardiakite/Desktop/dony/dony-back --glob '!node_modules/**' --glob '!target/**' --glob '!.git/**'`

Expected: aucune correspondance contenant un secret reel ; seuls les noms de variables et placeholders documentaires sont autorises.

Run: `git -C /Users/aboubakardiakite/Desktop/dony/dony-admin diff --check`

Expected: exit 0.

Run: `git -C /Users/aboubakardiakite/Desktop/dony/dony-back diff --check`

Expected: exit 0, sans inclure ni supprimer le plan utilisateur non suivi deja present.

- [ ] **Step 4: Committer la documentation dans chaque depot**

```bash
git -C /Users/aboubakardiakite/Desktop/dony/dony-back add docs/admin-auth-bootstrap.md
git -C /Users/aboubakardiakite/Desktop/dony/dony-back commit -m "docs(admin): document secure bootstrap"
git -C /Users/aboubakardiakite/Desktop/dony/dony-admin add README.md
git -C /Users/aboubakardiakite/Desktop/dony/dony-admin commit -m "docs(auth): document admin email login"
```

- [ ] **Step 5: Faire la verification finale sans provisionner la production**

Executer `./mvnw test` dans `dony-back`, puis `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` et `pnpm e2e` sous Node 24 dans `dony-admin`. Verifier les diffs et historiques des deux branches. Le provisionnement du vrai compte racine reste une action de deploiement explicite et n'est jamais execute automatiquement depuis les tests ou le poste local.
