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

## 4. Lot B — Retrait de contenu + mute messagerie

> **Révisé le 2026-08-18 après reconnaissance de code.** La première rédaction de
> cette section reposait sur trois hypothèses fausses, corrigées ici :
> les messages ne transitent pas par le backend Spring (écriture client directe
> dans Firestore) ; aucune vue admin des demandes de colis n'existe ;
> `AnnouncementsTable` est en lecture seule. Périmètre arbitré avec l'utilisateur :
> **trajets uniquement** pour le retrait, **mute appliqué par règle Firestore**.

### 4.1 Retrait / restauration d'une annonce de trajet

**Back**
- Nouvelle valeur `REMOVED_BY_ADMIN` dans `AnnouncementStatus`
  (`matching/AnnouncementStatus.java` — actuellement `DRAFT, ACTIVE, FULL,
  IN_PROGRESS, COMPLETED, CANCELLED`). Aucun `switch` exhaustif n'existe sur cet
  enum ; les comparaisons `==`/`!=` existantes doivent néanmoins être auditées.
  La recherche publique filtre sur `hasStatus(ACTIVE)`
  (`matching/AnnouncementService.java:166`), donc une annonce retirée disparaît
  des résultats sans autre changement.
- `POST /admin/announcements/{id}/remove` (`CONTENT_REMOVE`) — motif obligatoire,
  `audit_log` `ANNOUNCEMENT_REMOVED_BY_ADMIN`, notification au propriétaire via
  `NotificationDispatcher.notifyUser(...)`. Refus **409** si des bids acceptés sont
  en cours (le retrait ne doit pas casser une livraison engagée).
- `POST /admin/announcements/{id}/restore` (`CONTENT_REMOVE`) — retour à `ACTIVE`,
  `audit_log` `ANNOUNCEMENT_RESTORED_BY_ADMIN`. Refus 409 si le statut courant
  n'est pas `REMOVED_BY_ADMIN`.

**Front**
- `AnnouncementsTable` (aujourd'hui purement lecture, sans colonne d'actions)
  reçoit une colonne d'actions et un panneau de détail, sur le modèle de
  `UserDetailPanel` : gestes « Retirer » (motif + confirmation) et « Restaurer »,
  gatés `can('CONTENT_REMOVE')`.
- `annTone` étendu avec `REMOVED_BY_ADMIN` (ton `danger`), badge via le
  `StatusBadge` existant.

**Hors périmètre de ce lot :** le retrait des **demandes de colis**. Aucun écran
admin ne les liste (`/colis` n'affiche que bids et annonces) ; leur retrait exige
d'abord de créer cette vue, ce qui fera l'objet d'un lot dédié.

### 4.2 Mute messagerie

**Contrainte d'architecture découverte.** Les clients écrivent leurs messages
**directement dans Firestore** (`dony-functions/firestore.rules`, `allow create`
sur `conversations/{convId}/messages`). Le backend Spring n'est appelé qu'*après*
l'écriture, par la Cloud Function `onNewMessage` qui invoque
`/internal/messaging/notify`. Une garde posée côté Spring ne supprimerait donc que
la **notification** : le message serait quand même écrit et visible. Le seul point
d'application réel est la **règle Firestore**.

**Source de vérité et propagation**
- PostgreSQL reste la source de vérité pour l'administration : colonne
  `messaging_muted_until TIMESTAMPTZ NULL` sur `users` (migration Flyway `V219`,
  la dernière étant `V218__bid_status_negotiation_closed.sql`).
- Le back propage l'état dans Firestore via l'Admin SDK (`messaging/FirestoreService`,
  qui écrit déjà dans Firestore), dans une collection **`moderation/{firebaseUid}`**.
  ⚠️ **L'identifiant est l'UID Firebase, pas l'UUID PostgreSQL.** Une règle de sécurité
  ne voit que `request.auth.uid`, c'est-à-dire l'UID Firebase ; `UserEntity` porte les
  deux (`id` UUID généré et `firebaseUid`). Clé-er sur l'UUID rendrait le mute
  totalement inopérant tout en paraissant fonctionner. Le reste du code traduit déjà
  systématiquement UUID → firebaseUid avant d'écrire dans Firestore
  (`ConversationService`).
  Cette collection ne doit avoir **aucune règle `allow write`** : seuls le serveur
  et les fonctions (Admin SDK, qui ignore les règles) peuvent l'écrire — un client
  ne peut donc pas se dé-muter.
  ⚠️ Ne pas réutiliser `userMeta/{uid}` : cette collection est **écrivable par le
  client** (`allow read, write: if request.auth.uid == uid`), y placer une sanction
  la rendrait contournable.

**Endpoints**
- `POST /admin/users/{id}/mute-messaging` (`USER_MESSAGE_MUTE`) — body
  `{durationHours: 24 | 168 | null, reason: string}` (`null` = indéfini, stocké
  comme une échéance très lointaine pour garder une règle Firestore simple).
  Motif obligatoire, `audit_log` `USER_MESSAGING_MUTED`, écriture Firestore,
  notification à l'utilisateur.
- `POST /admin/users/{id}/unmute-messaging` (`USER_MESSAGE_MUTE`) — remet la
  colonne à `NULL`, **supprime** le document Firestore, `audit_log`
  `USER_MESSAGING_UNMUTED`.

**Règle Firestore**
```
function isMuted(uid) {
  return exists(/databases/$(database)/documents/moderation/$(uid))
      && get(/databases/$(database)/documents/moderation/$(uid))
           .data.messagingMutedUntil > request.time;
}
```
appliquée dans `allow create` des messages, en plus des validations existantes.
Le déploiement des règles Firebase est **séparé** de celui du backend : il doit
partir *avant* ou *avec* l'activation de la fonctionnalité côté admin.

**Défense en profondeur.** `MessagingNotifyController.notify()` (le seul point
backend du flux) supprime aussi la notification si l'expéditeur est muté — sans
quoi un contournement des règles resterait signalé au destinataire.

**Front**
- `UserDetailPanel` : sélecteur de durée (24 h / 7 j / indéfini) placé dans le
  panneau — **pas** dans la modale — puis geste « Couper la messagerie »
  (motif + confirmation) et « Rétablir la messagerie », gatés
  `can('USER_MESSAGE_MUTE')`, avec l'état et l'échéance affichés.
  Aucun composant de choix multiple n'existe dans une modale de confirmation ;
  on suit le motif déjà en place pour l'éditeur de commission (contrôle dans le
  panneau, confirmation ensuite) plutôt que de modifier le contrat d'emit partagé
  de `ConfirmActionDialog`.

### 4.3 Permissions

Ajout de `CONTENT_REMOVE` et `USER_MESSAGE_MUTE` (les deux autres permissions
prévues, `NOTIFICATION_SEND` et `CONFIG_MANAGE`, arrivent au Lot D).
Le miroir back/front porte donc de **24 à 26** valeurs — le javadoc de
`AdminPermission.java` annonce « 25 » alors que l'enum en compte 24 : corriger ce
commentaire au passage, des deux côtés.

**Tests :** matrice de permissions, refus de retrait si bids acceptés, expiration
du mute, et test des règles Firestore (émulateur) pour prouver qu'un client muté
ne peut pas écrire.

## 5. Lot C — Users avancé : KYC + RGPD

> **Section réécrite après reconnaissance du code réel** (rapport :
> `recon-lot-c.md`). La version initiale décrivait un existant qui n'est plus
> vrai depuis la migration `V46__kyc_cleanup.sql`. Les écarts sont signalés par
> ⚠️ ci-dessous. Les permissions `USER_KYC` et `USER_GDPR_DELETE` sont **déjà
> déclarées** back (`AdminPermission.java`) et front (`auth.ts`), déjà attribuées
> au rôle `ADMIN`, mais **jamais consommées** — pur scaffolding à câbler.

### KYC (`USER_KYC`)

⚠️ **`kyc_schema` ne contient plus aucune donnée sensible ni document.** Les
colonnes `id_document_encrypted` et `selfie_url` ont été supprimées par `V46`
(« never written, Stripe is source of truth »). La table
`kyc_schema.kyc_verifications` ne porte plus que le statut et un pointeur de
session Stripe. Une consultation KYC admin doit donc interroger **l'API Stripe
Identity**, pas du stockage local — il n'y a ni document ni URL présignée à
exposer.

⚠️ **Il n'existe aucun historique de sessions.** `uq_kyc_user_id` impose une
seule ligne par utilisateur ; chaque nouvelle session écrase le
`stripe_verification_session_id` précédent. La vue admin montre donc **la
session courante**, pas un historique.

- Back :
  - `GET /admin/users/{userId}/kyc` — statut local (les **deux** statuts, voir
    ci-dessous) enrichi par un appel live à Stripe Identity sur la session
    courante (statut Stripe, motif de rejet, dates). Dégradation propre : si
    l'appel Stripe échoue, renvoyer l'état local avec un indicateur
    `stripeUnavailable`, jamais une erreur 500.
  - `POST /admin/users/{userId}/kyc/reset` — annule la session Identity en cours
    côté Stripe, puis **UPDATE en place** de la ligne KYC (statut, effacement du
    `stripe_verification_session_id`, du motif et du code de rejet), audit_log
    `KYC_RESET_BY_ADMIN`, notification à l'utilisateur.

⚠️ **Deux pièges de cohérence, tous deux vérifiés dans le code :**
1. **Deux enums de statut désynchronisés** : `KycVerificationStatus`
   (`PENDING/VERIFIED/REJECTED`, sur `kyc_schema`) et `KycStatus`
   (`NOT_STARTED/PENDING/VERIFIED/REJECTED`, sur `public.users`). Un reset doit
   remettre **les deux** en cohérence, sinon les sources de vérité divergent en
   silence.
2. **Jamais de soft-delete + recréation** pour le reset : `uq_kyc_user_id` est
   une contrainte UNIQUE classique, pas un index partiel — la ligne soft-deletée
   reste physiquement présente et une insertion violerait la contrainte. Le motif
   employé par `AccountFinalizationService` n'est donc **pas** réutilisable ici.

⚠️ **Incompatibilité d'identifiant** : `AdminUserController` est entièrement
keyé sur `UUID userId`, alors que `KycService.createSession/abandonSession/
getStatus` est keyé sur `String firebaseUid`. Les méthodes existantes ne sont pas
réutilisables telles quelles — ajouter des méthodes de service admin dédiées,
UUID-based via `KycRepository.findByUserId(UUID)` qui existe déjà.

- Front : onglet « KYC » dans la fiche user (statut, détail de la session
  courante, bouton Réinitialiser avec confirmation), gated `can('USER_KYC')`.

### RGPD (`USER_GDPR_DELETE`)

`AccountFinalizationService.finalize(user, reason)` est **le point d'entrée
unique et déjà fonctionnel** de l'anonymisation : il écrase prénom/nom/date de
naissance/ville/token FCM, bannit et soft-delete le compte, soft-delete la ligne
KYC, purge le préfixe de stockage, supprime le compte Firebase (ce qui emporte
téléphone et email) et écrit un audit immuable. Le Lot C le réutilise plutôt
que de réimplémenter une anonymisation parallèle.

⚠️ **Ne pas passer par `AuthService.deleteImmediately`** : cette méthode exige un
`auth_time` Firebase de moins de 5 minutes **de l'utilisateur lui-même**, donc un
déclenchement admin échouerait systématiquement en 401. Appeler directement
`AccountFinalizationService.finalize()` avec une nouvelle valeur de
`FinalizationReason` (`ADMIN_INITIATED`) — l'enum n'a aujourd'hui que
`SOFT_GRACE_EXPIRED` et `HARD_IMMEDIATE`.

**Défauts d'anonymisation préexistants, corrigés dans ce lot** (trouvés en
reconnaissance ; règle « signaler puis corriger ») :
- `proSiret` — identifiant d'entreprise réel, chiffré mais **jamais anonymisé**.
  C'est un défaut RGPD au sens strict : la donnée reste ré-identifiante.
- `kycStatus` n'est pas remis à `NOT_STARTED`.
- `deletionRequestedAt` n'est jamais effacé par `finalize()` (contrairement à
  `reactivateAccount`).
- La ligne `kyc_schema` est seulement soft-deletée : le
  `stripe_verification_session_id`, pointeur vers les pièces d'identité détenues
  par Stripe, **survit à la suppression du compte**. Il doit être effacé.

- Back :
  - `GET /admin/users/gdpr-requests` — file des utilisateurs avec
    `deletionRequestedAt != null` non encore anonymisés, avec l'âge de la demande.
  - `POST /admin/users/{userId}/gdpr-execute` — exécute l'anonymisation via
    `finalize(user, ADMIN_INITIATED)`, audit_log `USER_GDPR_EXECUTED`.
    **Irréversible.**

⚠️ **Code de refus : 422, pas 409.** Les gardes existantes
(`hasActiveEscrowForUser` → `active-transactions`, solde wallet non vide →
`wallet-balance-not-empty`) répondent déjà **422** dans `UserService.requestDeletion`
et `AuthService.deleteImmediately`. Le geste admin réutilise ces mêmes gardes et
donc les mêmes codes : introduire un 409 ici créerait deux conventions pour un
refus identique, et l'application mobile mappe déjà ces slugs.

- Front : page `users/rgpd` (`definePageMeta({ permission: 'USER_GDPR_DELETE' })`) :
  file des demandes, âge de la demande, geste « Exécuter la suppression » avec
  **double confirmation par saisie du nom de l'utilisateur**. ⚠️ Aucun composant
  de ce type n'existe — `ConfirmActionDialog` ne fait qu'une confirmation simple
  avec motif. Il faut donc l'étendre (prop optionnelle de saisie de contrôle)
  plutôt que créer un composant concurrent.

### Dette du Lot B reprise ici
- `restoreByAdmin` force `ACTIVE` sans mémoriser le statut d'origine : restaurer
  une annonce `COMPLETED`/`CANCELLED` la rend réservable avec une date passée.
- `CashCommissionService.acceptCashBid` ne garde que `REMOVED_BY_ADMIN` au lieu
  de tout `OUT_OF_MARKET`.

- Tests : anonymisation vérifiée champ par champ (y compris les champs
  nouvellement couverts), refus si escrow actif ou wallet non vide, cohérence des
  deux statuts KYC après reset, matrice de permissions, E2E file RGPD.

---

## 6. Lot D — Plateforme : broadcast + config + finances

> **Section réécrite après reconnaissance du code réel** (rapport :
> `recon-lot-d.md`). La version initiale supposait des mécanismes que le code
> contredit. Les écarts sont signalés par ⚠️.
>
> Contrairement aux lots précédents, **aucune des trois permissions de ce lot
> n'existe encore** : `NOTIFICATION_SEND` et `CONFIG_MANAGE` sont à créer ;
> `PAYMENT_VIEW` existe déjà et est consommée.

### Broadcast (`NOTIFICATION_SEND`)

⚠️ **Le ciblage par rôle est cassé par construction — ne pas l'implémenter.**
Depuis la migration `V193`, tout utilisateur porte simultanément les deux rôles
`SENDER` et `TRAVELER` (`AuthService:89,399`). Un ciblage `SENDERS` ou
`TRAVELERS` filtré par rôle enverrait donc à **100 % des utilisateurs** dans les
deux cas, silencieusement — un broadcast « aux voyageurs » atteindrait tous les
expéditeurs sans que rien ne le signale.

Le ciblage est donc **comportemental**, fondé sur ce que l'utilisateur a
réellement fait :

| Cible | Définition réelle |
|---|---|
| `ALL` | tous les comptes actifs |
| `SENDERS` | a créé au moins un bid |
| `TRAVELERS` | a publié au moins une annonce |
| `CORRIDOR` | a publié une annonce ou un bid sur le corridor (origine → destination) |
| `USER` | un utilisateur désigné |

- Back : `POST /admin/notifications/broadcast`
  - Body : `{title, body, target: {type, origin?, destination?, userId?}}`
  - Canaux : push FCM + notification in-app, via `NotificationDispatcher`
    existant. **Pas de SMS.**
  - Envoi asynchrone par pages de destinataires ; réponse immédiate avec le
    nombre de destinataires ; audit_log `BROADCAST_SENT` (titre, cible, compteur).
  - Table `admin_broadcasts` (migration V(n+1)) : titre, corps, cible, compteur,
    auteur, date. `GET /admin/notifications/broadcasts` — historique paginé.

⚠️ **Deux fragilités d'infrastructure à ne pas aggraver** : l'envoi FCM se fait
en boucle unitaire (jamais en multicast), et `@EnableAsync` est déclaré sans
`ThreadPoolTaskExecutor` borné — chaque appel asynchrone crée donc un thread non
borné. Un broadcast massif sur cette base saturerait le serveur. Le lot doit
donc **borner explicitement** son exécution (pagination + exécuteur dédié borné),
sans prétendre corriger l'infrastructure de notification dans son ensemble.

- Front : page « Communications » (`NOTIFICATION_SEND`) : rédaction (titre, corps,
  ciblage avec aperçu du nombre de destinataires), confirmation, historique.

### Config plateforme (`CONFIG_MANAGE`)

⚠️ **Le `ConfigController` public existe déjà** et est consommé **en production**
par l'application mobile : `/config/commission-rate`, `/config/urgency-threshold`,
`/config/reimbursement-cap`, `/config/sms-enabled`, exposés en `permitAll`. Ce
lot ne le crée pas — il **change sa source** (table au lieu de properties) en
**préservant à l'octet près son contrat de réponse actuel**. Toute modification
de forme casserait l'app mobile déployée.

- Back : table `platform_settings` (migration V(n+1)), lignes clé/valeur typées,
  seedées avec les valeurs actuelles des properties pour qu'aucun comportement ne
  change au déploiement.
  - `GET /admin/settings` + `PUT /admin/settings`, validation de bornes
    (commission 0–30 %, plafond ≤ 500 €).
  - Lecture par le contrôleur public via cache Caffeine à TTL court, invalidé à
    l'écriture. Le motif de cache existant (`CacheConfig`, cache `adminAuthz`)
    sert de modèle.
  - Chaque modification → audit_log `PLATFORM_SETTING_CHANGED` (clé, ancienne
    valeur, nouvelle valeur).

⚠️ **`urgency_threshold` est exprimé en JOURS dans le code**, pas en heures
comme l'indiquait la version initiale. La clé est donc `urgency_threshold_days`.
Se tromper d'unité multiplierait le seuil par 24.

⚠️ **`sms_enabled` ne pilote pas que les notifications : il conditionne aussi
l'authentification par OTP.** Le passer à `false` empêcherait **tout le monde de
se connecter**. Il reste éditable — c'est le sens de la demande — mais son geste
exige la **double confirmation par saisie** (composant livré au Lot C) et un
avertissement explicite nommant cette conséquence. Les trois autres clés se
modifient par simple confirmation.

- Front : page « Paramètres plateforme » (`CONFIG_MANAGE`) : formulaire,
  confirmation, et affichage de la dernière modification (qui, quand).

### Finances étendues (`PAYMENT_VIEW`, lecture seule)

- Back : `GET /admin/finance/wallets`, `/admin/finance/mobile-money`,
  `/admin/finance/cash-commissions` — listes paginées et filtrables, **aucune
  écriture**.

⚠️ **La commission cash n'a pas d'entité dédiée** : ce sont des colonnes portées
par `BidEntity`. La vue se construit donc par requête sur les bids, pas sur une
table de commissions qui n'existe pas.

⚠️ **`mobile_money_payments.phone_number` est stocké en clair** — c'est une
donnée personnelle. La vue admin ne doit pas l'exposer intégralement sans
nécessité ; masquage partiel par défaut. Le chiffrement de cette colonne est un
chantier distinct, hors périmètre de ce lot, mais signalé.

- Front : onglets supplémentaires dans la section transactions, sur le motif
  d'onglets déjà en place dans `transactions/index.vue`.

### Clôture de la feature
Ce lot est le dernier. À son terme, le critère d'acceptation n°2 doit être
vérifiable : **plus aucune permission déclarée n'est morte** — chacune est
consommée par au moins un endpoint et un élément d'interface.

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
