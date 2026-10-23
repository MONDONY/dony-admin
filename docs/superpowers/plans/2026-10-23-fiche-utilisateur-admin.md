# Fiche utilisateur, partie admin : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le drawer utilisateur par une page complète `/users/<id>` (résumé, onglets, menu d'actions) alimentée par les nouveaux endpoints backend, avec les droits de chaque rôle respectés et un repli sur l'ancien drawer si le backend est plus ancien.

**Architecture:** Une nouvelle feature `app/features/user-profile/` (types, service, composables, composants) et une page `app/pages/users/[id].vue`. La page charge en parallèle le détail existant (`usersService.get`) et la synthèse (`/admin/users/{id}/overview`) ; chaque onglet charge sa liste à l'ouverture via un composable générique de section paginée. Les actions réutilisent `useUserDetail` (qui contient déjà suspendre, bannir, commission, PRO, etc.) ; le wallet, le KYC et les conversations support réutilisent les composants existants. Le drawer actuel reste en place comme repli (`/users?open=<id>&legacy=1`) jusqu'à une PR de retrait ultérieure.

**Tech Stack:** Nuxt 4 + Vue 3 (`<script setup lang="ts">`), Pinia, TailwindCSS, lucide-vue-next, Vitest + happy-dom + @vue/test-utils, Playwright (e2e avec `page.route`).

**Spec:** `docs/superpowers/specs/2026-10-23-fiche-utilisateur-design.md`. **Plan backend jumeau (à fusionner AVANT cette PR) :** `docs/superpowers/plans/2026-10-23-fiche-utilisateur-backend.md`. Maquette : https://claude.ai/artifact/TqG8DKnXSphj6XKbPxi3Qz

Travail dans `dony-admin`, depuis ce worktree (`dony-admin-worktrees/fiche-utilisateur`, branche `feature/fiche-utilisateur`). Commandes : `pnpm vitest run <fichier>`, `pnpm lint`, `pnpm typecheck`, `pnpm vitest run --coverage`, `pnpm e2e <fichier> --reporter=line`.

## Global Constraints

- Branche dédiée ; jamais de commit sur `main` ; pas de ligne `Co-Authored-By` ; la PR cite la PR backend jumelle et ne se fusionne qu'après elle ; la production reste au propriétaire.
- Couverture ≥ 90 % (seuil Vitest dans `vitest.config.ts`) ; tests existants corrigés, nouveaux tests dans le même commit ; lint (0 erreur) et typecheck (0 erreur) propres.
- Composants à réutiliser, pas à recréer : `TabBar` (`@/components/ui/TabBar.vue`, `aria-pressed`, `data-test="tab-<id>"`), `StateBlock` (chargement, vide, erreur + « Réessayer »), `StatusBadge`, `ConfirmActionDialog`, `PaginationControls`, `UserWalletTab`, `UserKycTab`, `UserSupportConversations`, `UserGpProSection`, `UserRecetteTesterSection`, `UserDeletionDialog`.
- Droits : toujours `auth.can('<PERMISSION>')` (jamais le nom du rôle) ; le serveur reste l'autorité, l'interface masque ce qu'il refuserait.
- Textes d'interface en français correct (accents), sans tiret cadratin, sans dégradé (couleurs unies), montants avec `formatAmount(cents, currency)` de `@/features/finance/types/index`, jamais de somme entre devises.
- Un échec de chargement n'est jamais montré comme une liste vide (`StateBlock` avec `error`).
- Backend plus ancien que l'admin : `isEndpointMissing(e)` (`@/lib/endpointMissing`) décide du repli ; pas d'autre détection de version.
- Liens vers les objets (écrans existants) : colis `/colis?open=<bidId>`, paiement `/transactions?open=<paymentId>`, litige `/incidents?open=<disputeId>`, signalement `/signalements?open=<reportId>`, utilisateur `/users/<id>`.
- **Source de vérité des formes de réponse** (le backend est livré avant cette PR) : les records Java de `dony-back/.claude/worktrees/fiche-utilisateur/src/main/java/com/yadony/api/admin/userview/dto/` et les endpoints de `AdminUserViewController.java` dans le même dépôt. Les types TypeScript de la Task 2 doivent les reproduire champ pour champ ; en cas d'écart avec le plan, le code backend gagne.
- **Contrats connus du backend** : tout `amountCents` / `commissionCents` = montant × 100 pour TOUTES les devises, XOF compris (donc `formatAmount(cents, devise)` partout, sans cas particulier) ; toutes les dates sont des `Instant` ISO avec `Z` ; `AdminUserRequestRow.desiredDate` est un jour calendaire envoyé comme minuit UTC : le formater avec `timeZone: 'UTC'` pour ne pas décaler d'un jour ; `AdminUserAuditRow.actorName` d'un administrateur = son e-mail ; les signalements « reçus » ne couvrent que ceux qui visent directement le compte (le dire dans l'interface) ; le journal ne contient que les gestes tracés sur le compte lui-même ; « argent retenu » est le montant brut (commission comprise) ; un champ de synthèse `null` = permission absente (masquer), jamais 0.
- Mocks de tests Nuxt : `vi.stubGlobal('useRoute', ...)`, `vi.stubGlobal('useRouter', ...)`, `vi.stubGlobal('definePageMeta', vi.fn())`, `vi.stubGlobal('navigateTo', vi.fn())` (voir `tests/unit/pages/users-index.spec.ts`) ; `seedAuth(role, overrides)` de `tests/helpers/auth`.

## Review Focus

1. Backend plus ancien (404/405 sans code sur `/overview`) : repli vers l'ancien drawer sans boucle de redirection ni message d'erreur trompeur.
2. Rôle SUPPORT : aucun bouton interdit visible (suspendre, bannir, couper la messagerie, commission, PRO, GP Pro, recette, suppression, correction de solde, décision KYC) ; il garde « Écrire à l'utilisateur » ; l'onglet Gestion et la carte journal sont absents.
3. Section `null` renvoyée par le serveur (permission manquante) : le chiffre ou le tableau est masqué, jamais affiché comme `0` ou « Aucun ».
4. Compte neuf (listes vides, note null, aucun statut spécial) et compte avec plusieurs devises retenues : rendu correct, une ligne de montant par devise.
5. Identifiant d'URL invalide ou utilisateur introuvable (404 avec code `user-not-found`) : message clair avec lien de retour, pas de page blanche.
6. Anciens liens `/users?query=<id>&open=<id>` (alertes, paiements, recherche ⌘K, KYC, no-shows) : redirigés vers `/users/<id>`, et le bouton Retour du navigateur ne piège pas l'utilisateur.

---

### Task 1: Miroir des permissions SUPPORT

**Files:**
- Modify: `app/stores/auth.ts` (tableau `ROLE_PERMISSIONS.SUPPORT`, commentaire « 18 permissions »)
- Test: `tests/unit/stores/` (spec qui fige la matrice des rôles) et `tests/components/AppSidebarGating.spec.ts` si impacté

**Interfaces:**
- Produces: `ROLE_PERMISSIONS.SUPPORT` sans `USER_SUSPEND`, `USER_BAN`, `USER_MESSAGE_MUTE` (15 permissions restantes), miroir exact de `AdminRole.SUPPORT` après la tâche 1 du plan backend.

- [ ] **Step 1: Test d'abord** : dans la spec du store des permissions (chercher avec `rtk proxy grep -rln "SUPPORT" tests/unit/stores`), ajouter `it('SUPPORT n’a plus suspendre, bannir ni couper la messagerie')` : `seedAuth('SUPPORT')` puis `auth.can('USER_SUSPEND'|'USER_BAN'|'USER_MESSAGE_MUTE')` vaut `false` ; `auth.can('USER_KYC')`, `'SUPPORT_TICKET_MANAGE'`, `'REPORT_RESOLVE'`, `'ALERT_RESOLVE'`, `'MESSAGE_DELETE'`, `'RATING_MODERATE'` valent `true`. Lancer ; attendu FAIL.
- [ ] **Step 2: Retirer les 3 entrées** du tableau SUPPORT de `auth.ts`, corriger le commentaire.
- [ ] **Step 3: Lancer** `pnpm vitest run tests/unit/stores tests/components tests/unit/features/users` ; corriger les tests qui supposaient ces droits pour SUPPORT (ils doivent soit utiliser ADMIN, soit prouver l'absence du bouton). Attendu : PASS (hors `permissionCoverage.spec.ts` si le backend local est périmé : ne pas le « réparer » en changeant le test, vérifier qu'il passe contre le backend de la PR jumelle).
- [ ] **Step 4: Commit** `feat(roles): SUPPORT ne suspend, ne bannit ni ne coupe la messagerie`.

### Task 2: Types, service et composables de la fiche

**Files:**
- Create: `app/features/user-profile/types/index.ts`, `app/features/user-profile/services/userProfileService.ts`, `app/features/user-profile/composables/useUserOverview.ts`, `app/features/user-profile/composables/useUserSection.ts`, `app/features/user-profile/lib/userProfileAlerts.ts`
- Test: `tests/unit/features/user-profile/userProfileService.spec.ts`, `useUserOverview.spec.ts`, `useUserSection.spec.ts`, `userProfileAlerts.spec.ts`

**Interfaces:**
- Produces (toutes les tâches suivantes en dépendent) :
  - Types dans `types/index.ts` : `MoneyAmount {currency: string; amountCents: number}` ; `UserOverviewKpis {parcelsInProgress: number|null; activeTrips: number|null; heldByCurrency: MoneyAmount[]|null; openDisputes: number|null; totalDisputes: number|null; reportsReceived: number|null; reportsSent: number|null; reportsPending: number|null; averageRating: number|null; ratingCount: number|null}` ; `InProgressItem {kind: 'PARCEL'|'TRIP'; id: string; reference: string; corridor: string; role: string; status: string; updatedAt: string; amount: MoneyAmount|null}` ; `TimelineEntry {kind: 'PARCEL'|'PAYMENT'|'DISPUTE'|'REPORT'; title: string; detail: string; at: string; refType: string|null; refId: string|null}` ; `UserOverview {kpis: UserOverviewKpis; inProgress: InProgressItem[]|null; timeline: TimelineEntry[]|null}` ; `type UserSection = 'parcels'|'trips'|'requests'|'payments'|'disputes'|'cancellations'|'reports'|'ratings'|'audit'` ; `interface SectionPage<T> {content: T[]; totalPages: number; number: number; totalElements: number}`.
  - `userProfileService.overview(id: string): Promise<UserOverview>` → `GET /admin/users/{id}/overview` ; `userProfileService.section<T>(id: string, section: UserSection, page: number, size: number, extra?: Record<string, string>): Promise<SectionPage<T>>` → `GET /admin/users/{id}/{section}?page&size&...extra` (`useApi()` comme `usersService`).
  - `useUserOverview(userId: string)` → `{ overview: Ref<UserOverview|null>; isLoading: Ref<boolean>; error: Ref<string|null>; unavailable: Ref<boolean>; load(): Promise<void> }` ; `unavailable` vaut true si `isEndpointMissing`, et dans ce cas `error` reste null.
  - `useUserSection<T>(userId: string, section: UserSection, extra?: Record<string, string>)` → `{ rows: Ref<T[]>; page: Ref<number>; totalPages: Ref<number>; isLoading: Ref<boolean>; error: Ref<string|null>; loaded: Ref<boolean>; load(): Promise<void>; goToPage(p: number): Promise<void> }` ; `load()` ne rappelle pas le serveur si `loaded`, `goToPage` oui ; erreurs via `extractProblemMessage(e, 'Impossible de charger cette section')`.
  - `buildAlerts(user: {status: string; deletionScheduledFor?: string|null}, kpis: UserOverviewKpis): UserAlert[]` avec `UserAlert {id: string; text: string}` : une alerte par condition vraie parmi : compte suspendu, banni, suppression demandée ; `openDisputes > 0` (« N litige(s) ouvert(s) ») ; `heldByCurrency` non vide (une phrase listant chaque devise) ; `reportsPending > 0`. Un champ `null` ne produit jamais d'alerte.

- [ ] **Step 1: Écrire les specs** : service (URL et query exactes pour `overview` et `section('payments', 2, 20)` ; `extra` ajouté), `useUserOverview` (succès ; 404 sans code → `unavailable` true et `error` null ; 500 → `error` rempli ; 404 avec `code` → `error`), `useUserSection` (charge une fois ; `goToPage` recharge ; erreur ; `loaded` passe à true), `buildAlerts` (chaque condition ; `null` partout → aucune alerte ; deux devises → une seule alerte listant EUR et XOF séparément).
- [ ] **Step 2: Lancer** `pnpm vitest run tests/unit/features/user-profile` ; attendu FAIL.
- [ ] **Step 3: Implémenter** les fichiers ci-dessus.
- [ ] **Step 4: Relancer** ; attendu PASS.
- [ ] **Step 5: Commit** `feat(user-profile): types, service et composables de la fiche utilisateur`.

### Task 3: Page `/users/[id]` : coquille, en-tête, alertes, chiffres, onglets, repli

**Files:**
- Create: `app/pages/users/[id].vue`, `app/features/user-profile/components/UserProfileHeader.vue`, `UserAlertBand.vue`, `UserKpiGrid.vue`, `app/features/user-profile/lib/userProfileTabs.ts`
- Modify: `app/pages/users/index.vue` (clic sur une ligne et redirection des anciens liens)
- Test: `tests/unit/pages/users-profile.spec.ts`, `tests/unit/features/user-profile/UserKpiGrid.spec.ts`, `UserAlertBand.spec.ts`, `userProfileTabs.spec.ts`, et mise à jour de `tests/unit/pages/users-index.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`useUserOverview`, `buildAlerts`), `usersService.get`, `useUserDetail`.
- Produces :
  - `userProfileTabs.ts` : `type ProfileTab = 'overview'|'parcels'|'money'|'incidents'|'identity'|'support'|'manage'` ; `visibleTabs(can: (p: AdminPermission) => boolean): TabItem<ProfileTab>[]` (ordre et libellés de la maquette : Vue d'ensemble, Colis, trajets et demandes, Argent, Incidents et signalements, Identité (KYC), Support et journal, Gestion). Règles : `overview` toujours ; `parcels` si `BID_VIEW` ; `money` si `PAYMENT_VIEW` ; `incidents` si `DISPUTE_VIEW` ou `REPORT_VIEW` ; `identity` si `USER_KYC` ; `support` si `SUPPORT_TICKET_VIEW` ou `AUDIT_VIEW` ; `manage` si l'une de `USER_MESSAGE_MUTE`, `USER_COMMISSION`, `USER_PRO_GRANT`, `GP_PRO_REVIEW`, `ADMIN_MANAGE`, `USER_DELETE`, `WALLET_ADJUST`.
  - Page : `definePageMeta({ middleware: 'admin-only', permission: 'USER_VIEW', pageTitle: 'Utilisateur', pageSubtitle: 'Fiche complète du compte' })` ; l'onglet courant vit dans `?tab=` (défaut `overview`, valeur inconnue ou interdite → `overview`) ; au montage, `usersService.get(id)` et `userProfileService.overview(id)` en parallèle.
  - Comportements : chargement → `StateBlock`; détail 404 → message « Utilisateur introuvable » + lien « Retour aux utilisateurs » ; synthèse `unavailable` → `navigateTo(`/users?open=${id}&legacy=1`, { replace: true })` (une seule fois) ; autre erreur de synthèse → `StateBlock` erreur avec « Réessayer » sans bloquer l'en-tête ; `UserAlertBand` n'est rendu que s'il y a au moins une alerte (`role="status"`) ; `UserKpiGrid` n'affiche une carte que si sa valeur n'est pas null (argent retenu : une ligne par devise via `formatAmount`).
  - `pages/users/index.vue` : `openUser(id)` → `navigateTo(`/users/${id}`)` ; au montage, si `?open=<id>` est présent ET `legacy` ne vaut pas `1` → `navigateTo(`/users/${id}`, { replace: true })` (les anciens liens fonctionnent) ; avec `legacy=1` le comportement actuel du drawer est conservé tel quel.

- [ ] **Step 1: Écrire les specs** : `visibleTabs` (matrice par rôle : SUPPORT voit overview, parcels, money, incidents, identity, support, PAS manage ; ADMIN voit tout ; un rôle sans aucune permission voit seulement overview) ; page (rend l'en-tête avec le nom ; `?tab=money` ouvre Argent ; `?tab=manage` pour un SUPPORT retombe sur overview ; détail 404 → message de retour ; `/overview` 404 sans code → `navigateTo` appelé avec `/users?open=<id>&legacy=1` et `replace: true`, une seule fois ; `/overview` 500 → `StateBlock` erreur, en-tête toujours là) ; `UserKpiGrid` (champ null masqué, `heldByCurrency` à deux devises → deux lignes, aucune somme) ; `UserAlertBand` (absente sans alerte) ; `users-index.spec.ts` (clic sur une ligne → `navigateTo('/users/<id>')` ; `?open=<id>` → `navigateTo('/users/<id>', {replace:true})` ; `?open=<id>&legacy=1` → le drawer s'ouvre comme avant).
- [ ] **Step 2: Lancer** `pnpm vitest run tests/unit/pages/users-profile.spec.ts tests/unit/pages/users-index.spec.ts tests/unit/features/user-profile` ; attendu FAIL.
- [ ] **Step 3: Implémenter** la page, les trois composants, `userProfileTabs.ts` et les modifications de `users/index.vue`. L'en-tête reprend la maquette (avatar initiales, nom, statuts via `userStatusMeta`, coordonnées, ID copiable, rôles). Les onglets utilisent `TabBar`. Le contenu des onglets est branché dans les tâches 4 à 7 (ici, des emplacements vides par onglet).
- [ ] **Step 4: Relancer** ; attendu PASS.
- [ ] **Step 5: Commit** `feat(user-profile): page /users/[id] avec en-tête, alertes, chiffres et onglets`.

### Task 4: Vue d'ensemble : « en cours et livrés », frise

**Files:**
- Create: `app/features/user-profile/components/UserOverviewTab.vue`, `UserInProgressTable.vue`, `UserTimeline.vue`, `app/features/user-profile/lib/objectLinks.ts`
- Modify: `app/pages/users/[id].vue` (brancher l'onglet)
- Test: `tests/unit/features/user-profile/UserOverviewTab.spec.ts`, `objectLinks.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`InProgressItem`, `TimelineEntry`), Task 3 (page).
- Produces : `objectLinks.ts` : `linkForItem(item: {kind: string; id: string}): string | null` (`PARCEL` → `/colis?open=<id>`; `TRIP` → `/colis?tab=announcements&announcement=<id>`) et `linkForTimeline(e: TimelineEntry): string | null` (`PARCEL` → colis, `PAYMENT` → `/transactions?open=<id>`, `DISPUTE` → `/incidents?open=<id>`, `REPORT` → `/signalements?open=<id>` ; `refId` null → null). `UserOverviewTab` props : `inProgress: InProgressItem[]|null`, `timeline: TimelineEntry[]|null`.
- Comportement : `inProgress` null → la carte est masquée (jamais « Aucun ») ; liste vide → « Rien en cours ni livré depuis 3 jours » ; chaque ligne a un lien « Ouvrir » (absent si `linkForItem` renvoie null) ; la frise est masquée si `timeline` est null, affiche « Aucune activité récente » si vide.

- [ ] **Step 1: Écrire les specs** : `objectLinks` (chaque `kind`, `refId` null) ; `UserOverviewTab` (null masqué ; vide ; lignes avec statut, trajet, montant formaté par devise ; lien présent ; frise triée telle que reçue).
- [ ] **Step 2: Lancer** `pnpm vitest run tests/unit/features/user-profile/UserOverviewTab.spec.ts tests/unit/features/user-profile/objectLinks.spec.ts` ; attendu FAIL.
- [ ] **Step 3: Implémenter** les composants et brancher l'onglet dans la page.
- [ ] **Step 4: Relancer** ; attendu PASS.
- [ ] **Step 5: Commit** `feat(user-profile): vue d'ensemble, éléments en cours et frise`.

### Task 5: Onglets de listes (colis, trajets, demandes, paiements, incidents, signalements, avis)

**Files:**
- Create: `app/features/user-profile/components/UserListSection.vue`, `UserParcelsTab.vue`, `UserMoneyTab.vue`, `UserIncidentsTab.vue`, `app/features/user-profile/lib/sectionColumns.ts`
- Modify: `app/pages/users/[id].vue`
- Test: `tests/unit/features/user-profile/UserListSection.spec.ts`, `UserParcelsTab.spec.ts`, `UserMoneyTab.spec.ts`, `UserIncidentsTab.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`useUserSection`, types), `objectLinks`, `UserWalletTab`.
- Produces :
  - `UserListSection` props : `title: string; hint?: string; columns: SectionColumn[]; section: UserSection; userId: string; extra?: Record<string,string>; linkFor?: (row: any) => string | null; emptyLabel: string; actionLabel?: string` (slot `action` pour un bouton d'en-tête). `SectionColumn {key: string; label: string; format?: (row: any) => string; tone?: (row: any) => 'success'|'warning'|'danger'|'info'|'neutral'}` (`tone` rend un `StatusBadge`). Charge sa liste au montage (donc seulement quand son onglet est affiché), `StateBlock` pour chargement/erreur/vide, `PaginationControls` si plusieurs pages.
  - `sectionColumns.ts` : colonnes de chaque section selon les champs des DTO du plan backend : `parcelColumns`, `tripColumns`, `requestColumns`, `paymentColumns`, `disputeColumns`, `cancellationColumns`, `reportColumns`, `ratingColumns`, `auditColumns` ; montants avec `formatAmount` ; dates en `fr-FR`.
  - `UserParcelsTab` : sections Colis (`parcels`), Trajets (`trips`), Demandes d'envoi (`requests`). `UserMoneyTab` : `UserWalletTab` (existant, avec son bouton de correction de solde déjà gardé par `WALLET_ADJUST`) puis Paiements (`payments`). `UserIncidentsTab` : Litiges (`disputes`, visible avec `DISPUTE_VIEW`), Absences et annulations (`cancellations`, `DISPUTE_VIEW`), Signalements reçus et envoyés (`reports` avec `extra: {direction: 'RECEIVED'}` puis `'SENT'`, `REPORT_VIEW`) avec la mention « Signalements visant directement ce compte », Avis reçus (`ratings`, `RATING_MODERATE`). Chaque section est masquée si l'utilisateur n'a pas sa permission.

- [ ] **Step 1: Écrire les specs** : `UserListSection` (appelle `section` avec `page=0,size=20` au montage ; vide → `emptyLabel` ; 500 → erreur + « Réessayer » qui recharge ; changer de page recharge ; ligne avec lien) ; `UserParcelsTab` (trois sections, chacune appelle son endpoint) ; `UserMoneyTab` (`UserWalletTab` monté ; bouton de correction absent sans `WALLET_ADJUST`) ; `UserIncidentsTab` (sans `REPORT_VIEW` : pas de signalements ; sans `DISPUTE_VIEW` : pas de litiges ; avec les deux : directions `RECEIVED` et `SENT` appelées).
- [ ] **Step 2: Lancer** `pnpm vitest run tests/unit/features/user-profile` ; attendu FAIL.
- [ ] **Step 3: Implémenter** les composants et les brancher sur les onglets `parcels`, `money`, `incidents` de la page.
- [ ] **Step 4: Relancer** ; attendu PASS.
- [ ] **Step 5: Commit** `feat(user-profile): onglets colis, argent, incidents et signalements`.

### Task 6: Onglets Identité (KYC) et Support et journal

**Files:**
- Create: `app/features/user-profile/components/UserIdentityTab.vue`, `UserSupportTab.vue`
- Modify: `app/pages/users/[id].vue`
- Test: `tests/unit/features/user-profile/UserIdentityTab.spec.ts`, `UserSupportTab.spec.ts`

**Interfaces:**
- Consumes: `useUserKyc` (`@/features/users/composables/useUserKyc`), `UserKycTab`, `UserSupportConversations`, `UserListSection` (Task 5), colonnes `auditColumns`.
- Produces : `UserIdentityTab` (props `user: AdminUserDetail`) : charge le KYC à l'ouverture de l'onglet (équivalent de l'événement `openKyc` du drawer), monte `UserKycTab` avec les mêmes props et les mêmes événements (`reset`, `decided`, `stale`) que dans `UserDetailPanel`, et rafraîchit le détail utilisateur après une décision ou une réinitialisation. `UserSupportTab` : `UserSupportConversations` (avec `SUPPORT_TICKET_VIEW`) puis `UserListSection` journal (`section: 'audit'`, visible seulement avec `AUDIT_VIEW`, libellé « Gestes des administrateurs sur ce compte »).

- [ ] **Step 1: Écrire les specs** : identité (appelle le chargement KYC une seule fois ; l'événement `reset` appelle `useUserKyc().reset` puis recharge le détail ; sans `USER_KYC` l'onglet n'est pas offert, déjà couvert par `visibleTabs`) ; support (SUPPORT : conversations visibles, journal absent ; ADMIN : les deux ; journal en erreur → « Réessayer »).
- [ ] **Step 2: Lancer** `pnpm vitest run tests/unit/features/user-profile` ; attendu FAIL.
- [ ] **Step 3: Implémenter** et brancher.
- [ ] **Step 4: Relancer** ; attendu PASS.
- [ ] **Step 5: Commit** `feat(user-profile): onglets identité et support`.

### Task 7: Menu « Actions du compte » et onglet Gestion

**Files:**
- Create: `app/features/user-profile/components/UserActionsMenu.vue`, `UserManageTab.vue`, `app/features/user-profile/lib/accountActions.ts`
- Modify: `app/pages/users/[id].vue`
- Test: `tests/unit/features/user-profile/UserActionsMenu.spec.ts`, `UserManageTab.spec.ts`, `accountActions.spec.ts`

**Interfaces:**
- Consumes: `useUserDetail` (actions : `suspend`, `ban`, `unsuspend`, `suspendPublishing`, `liftPublishing`, `muteMessaging`, `unmuteMessaging`, `setCommissionRate`, `grantPro`, `revokePro`, `cancelDeletion`, `open`), `ConfirmActionDialog`, `StartSupportConversationDialog`, `useUserDeletion` + `UserDeletionDialog`, `UserGpProSection`, `UserRecetteTesterSection`, logique de dérogation de commission et d'accès PRO copiée de `UserDetailPanel.vue` (mêmes règles : `canGrantPro`, `hasLiveStripeSubscription`, bornes 0 à 99,9 %).
- Produces : `accountActions.ts` : `availableActions(user: AdminUserDetail, can: (p: AdminPermission) => boolean): AccountAction[]` avec `AccountAction {id: 'notify'|'writeSupport'|'suspend'|'ban'|'unsuspend'|'unban'|'suspendPublishing'|'liftPublishing'|'mute'|'unmute'; group: 'Communiquer'|'Compte'|'Activité'; label: string; hint: string; danger: boolean; requiresReason: boolean}`. Règles (identiques au drawer) : `notify` si `NOTIFICATION_SEND` ; `writeSupport` si `SUPPORT_TICKET_MANAGE` et statut ≠ `PENDING_DELETION` ; `suspend`/`ban` si statut `ACTIVE` et `USER_SUSPEND`/`USER_BAN` ; `unsuspend` si `SUSPENDED` et `USER_SUSPEND` ; `unban` si `BANNED` et `USER_SUSPEND` ET `USER_BAN` ; `suspendPublishing` si non suspendue et `USER_SUSPEND` ; `liftPublishing` si suspendue et `USER_SUSPEND` ; `mute` si `USER_MESSAGE_MUTE` (durée 24 h / 7 jours / indéfinie choisie dans la confirmation) ; `unmute` si `messagingMutedUntil` non null et `USER_MESSAGE_MUTE`. Groupes vides non rendus.
- `UserActionsMenu` : bouton « Actions du compte » (`aria-haspopup="menu"`, `aria-expanded`), menu avec `role="menu"`/`menuitem`, fermeture par Échap et clic extérieur ; les gestes qui exigent un motif ouvrent `ConfirmActionDialog` avec les mêmes titres/messages que le drawer (copier `dialogConfig` de `UserDetailPanel.vue`) ; les gestes directs (réactiver, rétablir) s'exécutent sans dialogue. Un utilisateur sans aucune action disponible ne voit pas le bouton.
- `UserManageTab` : cartes Commission, Accès PRO, Badge GP Pro (`UserGpProSection`, `GP_PRO_REVIEW`), Mode recette (`UserRecetteTesterSection`, `ADMIN_MANAGE`), Zone de danger (`USER_DELETE`, ouvre `UserDeletionDialog` après `useUserDeletion().loadImpact`), chacune avec ses règles de permission du drawer ; bandeau « Annuler la suppression » (si `PENDING_DELETION` et `USER_DELETE`) et lien « Voir les versements retenus » (si `heldPaymentsCount > 0` et `PAYMENT_VIEW`) placés dans l'en-tête de la page.

- [ ] **Step 1: Écrire les specs** : `availableActions` (tableau de vérité par statut et permission, dont SUPPORT : seulement `writeSupport`, pas de suspend/ban/mute/unmute ; ADMIN actif : notify, writeSupport, suspend, ban, suspendPublishing, mute) ; `UserActionsMenu` (confirmer « Suspendre » avec motif appelle `suspend(reason)` ; Échap ferme ; sans action → bouton absent ; couper la messagerie transmet la durée choisie) ; `UserManageTab` (commission 8 → `setCommissionRate(0.08)` après confirmation ; valeur > 99,9 refusée ; PRO offert → `grantPro(motif)` ; zone de danger absente sans `USER_DELETE` ; recette absente pour ADMIN, présente pour SUPER_ADMIN).
- [ ] **Step 2: Lancer** `pnpm vitest run tests/unit/features/user-profile` ; attendu FAIL.
- [ ] **Step 3: Implémenter** (réutiliser les textes et la logique du drawer sans changer les règles ; l'ancien `UserDetailPanel` reste inchangé car il sert de repli).
- [ ] **Step 4: Relancer** ; attendu PASS.
- [ ] **Step 5: Commit** `feat(user-profile): menu d'actions du compte et onglet Gestion`.

### Task 8: Parcours e2e, rôles et vérifications finales

**Files:**
- Create: `tests/e2e/user-profile.spec.ts`
- Modify: `tests/e2e/users.spec.ts` si le clic sur une ligne attend encore le drawer
- Test: ce même fichier + suite complète

**Interfaces:** Consumes tout ce qui précède (parcours complet avec `page.route` sur `**/admin/users/**`, session seedée comme dans `tests/e2e/users.spec.ts`).

- [ ] **Step 1: Écrire `user-profile.spec.ts`** : `admin ouvre la fiche depuis la liste` (clic ligne → URL `/users/<id>`, en-tête et chiffres visibles, bande « À surveiller » avec un litige ouvert) ; `onglet Argent charge le wallet et les paiements` ; `admin suspend depuis le menu Actions du compte` (motif saisi, `POST …/suspend` reçu avec le motif) ; `SUPPORT ne voit ni Gestion ni les gestes de modération mais peut écrire au support` (session SUPPORT) ; `ancien backend : /overview en 404 → retour sur le drawer (legacy=1)` ; `ancien lien /users?open=<id> redirige vers la fiche` ; `utilisateur introuvable → message et lien de retour`.
- [ ] **Step 2: Adapter** `tests/e2e/users.spec.ts` et `users-deletion.spec.ts` : ils ouvrent la fiche en cliquant une ligne ; désormais ouvrir `/users?open=<id>&legacy=1` pour tester le drawer de repli, ou migrer leurs assertions vers la page (les gestes de mise en sourdine et de suppression se testent via le menu et l'onglet Gestion).
- [ ] **Step 3: Vérifier tout** : `pnpm lint` (0 erreur), `pnpm typecheck` (0 erreur), `pnpm vitest run --coverage --exclude "tests/e2e/**"` (≥ 90 %, aucun test rouge hors `permissionCoverage.spec.ts` s'il compare à un backend local périmé), `pnpm e2e --reporter=line` (tout vert).
- [ ] **Step 4: PR** vers `main` : titre `feat(users): fiche utilisateur complète (page /users/[id])` ; description : captures ou lien de maquette, tableau « où va chaque action », rôles, citation de la PR backend jumelle (`yadony-back#<n>`), mention « le drawer reste en repli, retiré dans une PR suivante », « les agents SUPPORT perdent suspendre/bannir/couper dès le déploiement du backend ». Ne pas fusionner avant la PR backend.
- [ ] **Step 5: Commit** `test(user-profile): parcours e2e de la fiche utilisateur`.

## Suite hors de ce plan

Retrait du drawer `UserDetailPanel`, de la prop `initialTab`, du paramètre `legacy=1` et du repli, une fois la synthèse déployée en production : PR dédiée ensuite.
