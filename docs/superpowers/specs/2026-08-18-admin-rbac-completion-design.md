# Spec — Complétion fonctionnelle yadony-admin (RBAC par permission)

**Date :** 2026-08-18
**Statut :** validé en design, en attente de revue de spec
**Périmètre :** yadony-admin (Nuxt 4) + dony-back (Spring Boot, package `com.yadony.api`)
**Hors périmètre :** gestion des comptes PRO (refonte en cours : le PRO sera ouvert à tous — aucune fonctionnalité admin PRO dans ce chantier)

---

## 1. Contexte et constat

Audit réalisé le 2026-08-18 sur `main` (CI verte, déployé VPS).

### Couvert et fonctionnel (back + front + RBAC)
metrics, users (suspend/ban/unsuspend), payments (force-release/refund), chargebacks,
bids/annonces/timeline, disputes (resolve/guarantee-fund), cancellations, alerts,
modération conversations (suppression message), signalements, ratings (exclude/delete),
promo CRUD, audit-log, exports, gestion des admins (SUPER_ADMIN).

### Écarts identifiés
1. **Trou de sécurité back** : `POST /cancellations/bids/{bidId}/confirm-noshow` protégé
   par `hasRole('ADMIN')` seul → un compte SUPPORT peut confirmer un no-show côté API.
2. **Gestes back sans UI** : `suspend-publishing`/`lift-publishing-suspension`
   (USER_SUSPEND) et `commission-rate` (USER_COMMISSION — service front écrit
   `usersService.ts:31` mais jamais branché).
3. **Bug back** : `publishingSuspended` n'est appliqué que dans `AnnouncementService`
   (trajets) — les demandes de colis (`PackageRequestService`) ne sont pas bloquées.
4. **Permissions mortes** : `USER_KYC` et `USER_GDPR_DELETE` déclarées (enum back +
   store front) mais aucun endpoint ne les utilise.
5. **Domaines invisibles pour l'admin** : retrait de contenu unitaire, mute messagerie,
   broadcast de notifications, configuration plateforme, wallet/mobile money/commission
   cash (lecture).

---

## 2. Nouvelles permissions

Ajout à l'enum `AdminPermission` (back) et au type `AdminPermission` + `ALL_PERMISSIONS`
+ `ROLE_PERMISSIONS` (front, `app/stores/auth.ts`) :

| Permission | Usage |
|---|---|
| `CONTENT_REMOVE` | Retirer/restaurer une annonce de trajet ou une demande de colis |
| `USER_MESSAGE_MUTE` | Interdire à un utilisateur d'envoyer des messages |
| `NOTIFICATION_SEND` | Broadcast de notifications |
| `CONFIG_MANAGE` | Modifier les paramètres plateforme |

**Attribution par rôle :**
- `SUPER_ADMIN` : tout (inchangé — ignore les overrides)
- `ADMIN` : tout sauf `ADMIN_MANAGE` (donc reçoit les 4 nouvelles)
- `SUPPORT` : **aucune des 4 nouvelles** (escalade possible via `permissionOverrides`)

Miroir strict back/front : toute divergence entre `AdminPermission.java` et
`auth.ts` est un bug.

---

## 3. Lot A — Sécurité + gestes orphelins

### Back (dony-back)
- `CancellationController.confirmNoShow` : `@PreAuthorize("hasRole('ADMIN')")` →
  `@PreAuthorize("hasRole('ADMIN') and hasAuthority('DISPUTE_RESOLVE')")`.
- `PackageRequestService` : refuser la création/publication d'une demande de colis si
  `user.isPublishingSuspended()` (même erreur RFC 7807 que côté annonces).
- Tests : matrice permissions MockMvc (SUPPORT sans override → 403 ; ADMIN → 200),
  test de blocage colis pour user suspendu de publication.

### Front (yadony-admin)
- `UserDetailPanel` : deux gestes supplémentaires, avec raison obligatoire +
  modale de confirmation, gated `auth.can('USER_SUSPEND')` :
  - « Suspendre la publication » → `POST /admin/users/{id}/suspend-publishing`
  - « Lever la suspension de publication » → `POST /admin/users/{id}/lift-publishing-suspension`
  - Affichage de l'état `publishingSuspended` dans la fiche.
- Éditeur de taux de commission par utilisateur, gated `auth.can('USER_COMMISSION')` :
  champ % (0–100, null = taux global) + confirmation → `PUT /admin/users/{id}/commission-rate`
  (service `setCommissionRate` existant).
- Tests : Vitest (gating par permission, émissions), E2E happy path.

---

## 4. Lot B — Modération de contenu + mute messagerie

### Back
- **Annonces** : nouveau statut `REMOVED_BY_ADMIN` dans `AnnouncementStatus`.
  - `POST /admin/announcements/{id}/remove` (`CONTENT_REMOVE`) — motif obligatoire,
    audit_log `ANNOUNCEMENT_REMOVED_BY_ADMIN`, notification FCM+in-app au propriétaire.
    Refus (409) si des bids acceptés en cours.
  - `POST /admin/announcements/{id}/restore` (`CONTENT_REMOVE`) — retour à `ACTIVE`,
    audit_log.
- **Colis** : `POST /admin/package-requests/{id}/remove` (`CONTENT_REMOVE`) — même
  mécanique (statut retiré, motif, audit, notification) + `POST /admin/package-requests/{id}/restore`.
  Si le modèle de statut colis n'a pas d'équivalent, ajouter un statut `REMOVED_BY_ADMIN` (même approche que les annonces).
- **Mute messagerie** : colonne `messaging_muted_until TIMESTAMPTZ NULL` sur `users`
  (migration Flyway V(n+1)).
  - `POST /admin/users/{id}/mute-messaging` (`USER_MESSAGE_MUTE`) — body
    `{durationHours: 24|168|null}` (null = indéfini), motif obligatoire, audit_log.
  - `POST /admin/users/{id}/unmute-messaging` (`USER_MESSAGE_MUTE`).
  - `ConversationService` (messaging/) : refus d'envoi RFC 7807 403 `messaging-muted`
    si `messagingMutedUntil` est dans le futur ou indéfini. Vérification côté service,
    pas seulement contrôleur.
- Tests : matrice permissions, refus d'envoi muté, expiration du mute.

### Front
- `AnnouncementsTable` + vue colis : geste « Retirer » (motif + confirmation) /
  « Restaurer », gated `can('CONTENT_REMOVE')`. Badge statut `REMOVED_BY_ADMIN`.
- `UserDetailPanel` : geste « Couper la messagerie » (choix durée 24 h / 7 j /
  indéfini + motif) / « Rétablir », gated `can('USER_MESSAGE_MUTE')`, état visible.
- Store auth + `page-meta.d.ts` + sidebar mis à jour avec les nouvelles permissions.
- Tests unit + E2E.

---

## 5. Lot C — Users avancé : KYC + RGPD

### KYC (`USER_KYC`)
- Back :
  - `GET /admin/users/{userId}/kyc` — statut Stripe Identity détaillé + historique des
    sessions (données depuis `kyc_schema`, jamais d'URL directe de fichier — presigned
    uniquement si des documents sont exposés).
  - `POST /admin/users/{userId}/kyc/reset` — invalide la session Identity en cours,
    statut KYC → `PENDING`, audit_log `KYC_RESET_BY_ADMIN`, notification à l'utilisateur.
- Front : onglet « KYC » dans la fiche user (statut, historique, bouton Réinitialiser
  avec confirmation), gated `can('USER_KYC')`.

### RGPD (`USER_GDPR_DELETE`)
- Back :
  - `GET /admin/users/gdpr-requests` — file des users avec `deletionRequestedAt != null`
    et non encore anonymisés.
  - `POST /admin/users/{userId}/gdpr-execute` — anonymisation : PII écrasées
    (nom, email, téléphone, adresses), soft delete du compte, purge `kyc_schema`,
    conservation des données transactionnelles anonymisées (obligations comptables),
    audit_log `USER_GDPR_EXECUTED`. **Irréversible** — répond 409 si paiement escrow
    en cours.
- Front : page `users/rgpd` (permission `USER_GDPR_DELETE` dans `definePageMeta`) :
  file des demandes, âge de la demande, geste « Exécuter la suppression » avec **double
  confirmation** (saisie du nom du user).
- Tests : anonymisation vérifiée champ par champ, refus si escrow actif, matrice
  permissions, E2E file RGPD.

---

## 6. Lot D — Plateforme : broadcast + config + finances

### Broadcast (`NOTIFICATION_SEND`)
- Back : `POST /admin/notifications/broadcast`
  - Body : `{title, body, target: {type: 'ALL'|'SENDERS'|'TRAVELERS'|'CORRIDOR'|'USER', origin?, destination?, userId?}}`
  - Canaux : FCM push + notification in-app (`NotificationEntity`), via
    `NotificationDispatcher` existant. Pas de SMS.
  - Envoi asynchrone par batch (`@Async`, pages de 500 destinataires) ; réponse
    immédiate avec `recipientCount` estimé ; audit_log `BROADCAST_SENT`
    (titre, cible, compteur).
  - Table `admin_broadcasts` (migration Flyway V(n+1)) : titre, corps, cible, compteur,
    auteur, date. `GET /admin/notifications/broadcasts` — historique paginé.
- Front : page « Communications » (`NOTIFICATION_SEND`) : composer (titre, corps,
  ciblage avec préview du nombre de destinataires), confirmation, historique.
  Envoi individuel aussi accessible depuis la fiche user.

### Config plateforme (`CONFIG_MANAGE`)
- Back : table `platform_settings` (migration Flyway V(n+1)) — lignes clé/valeur
  typées : `commission_rate_percent`, `urgency_threshold_hours`,
  `reimbursement_cap_eur`, `sms_enabled`.
  - `GET /admin/settings` + `PUT /admin/settings` (validation de bornes ;
    commission 0–30 %, plafond ≤ 500 €).
  - `ConfigController` public lit la table via cache Caffeine (TTL court),
    invalidation à l'écriture. Valeurs par défaut = valeurs actuelles des properties
    (seedées par la migration).
  - Chaque modification → audit_log `PLATFORM_SETTING_CHANGED` (clé, ancienne valeur,
    nouvelle valeur).
- Front : page « Paramètres plateforme » (`CONFIG_MANAGE`) : formulaire + confirmation,
  affichage de la dernière modification (qui/quand).

### Finances étendues (`PAYMENT_VIEW`, lecture seule)
- Back : `GET /admin/finance/wallets`, `GET /admin/finance/mobile-money`,
  `GET /admin/finance/cash-commissions` — listes paginées + filtres, aucun geste
  d'écriture.
- Front : onglets supplémentaires dans la section transactions.

---

## 7. Règles transverses

- **Erreurs** : RFC 7807 `ProblemDetail` partout, jamais de String/Map brut.
- **Audit** : chaque geste d'écriture admin crée une entrée `audit_log` (table
  immuable, jamais UPDATE/DELETE).
- **Soft delete only** ; migrations uniquement en V(n+1) ; événements Spring pour
  toute communication cross-package (pas d'injection de service inter-feature).
- **Front** : chaque page a `definePageMeta({ permission })` ; chaque geste destructif
  a `auth.can(...)` + modale de confirmation ; sidebar filtrée par `can()`.
- **Tests** : couverture ≥ 90 % back et front maintenue à chaque lot ; suite E2E
  existante rejouée à chaque lot (non-régression des gestes actuels) ; nouveaux tests
  dans le même PR que le code.
- **Livraison** : ordre A → B → C → D ; chaque lot = 1 PR dony-back + 1 PR
  yadony-admin, mergées back d'abord, déployables indépendamment.

---

## 8. Critères d'acceptation globaux

1. SUPPORT ne peut exécuter aucun geste destructif (API et UI) sans override explicite.
2. Toute permission déclarée (back et front) est consommée par au moins un endpoint
   et un élément d'UI — plus aucune permission morte.
3. Tout endpoint `/admin/**` d'écriture exige `hasRole('ADMIN')` **et** une authority
   dédiée, et écrit dans audit_log.
4. Un utilisateur suspendu de publication ne peut publier ni trajet ni colis.
5. Un utilisateur muté ne peut envoyer aucun message tant que le mute est actif.
6. La modification d'un paramètre plateforme est effective sans redéploiement.
