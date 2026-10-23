# Réorganisation de la page Transactions de l'admin — document de conception

Date : 23/10/2026. Statut : maquette validée par le propriétaire le 23/10. Maquette : https://claude.ai/artifact/KMizmg9VkAW8hyUh1Jj8DF (4 planches : liste, recherche, fiche, autres sections). Source : `dony/tmp/tx-maquette/project/`. Même démarche que la page Colis (spec `2026-10-23-colis-reorganisation-design.md`), dont ce document reprend les conventions.

État des lieux vérifié sur `origin/main` : admin `1301ce4` (#85), backend `5582347c` (#648). Aucun checkout local périmé n'a servi.

## État des lieux

**Page** `app/pages/transactions/index.vue` (447 lignes) : une barre de 7 onglets à plat (Paiements, Litiges bancaires, Mobile money, Commissions mobile money, Portefeuilles, Remboursements wallet, Commissions cash), groupés visuellement par trois libellés. Liens entrants par `?tab=`, `?open=<paiement>`, `?held=true`, plus les filtres de l'onglet Paiements dans l'URL (`useUrlFilters` : `status`, `method`, `currency`, `dateFrom`, `dateTo`, `hideAbandoned`).

**Onglet Paiements** : filtres en 5 lignes de pastilles, une recherche (`q` : identifiant, `pi_`/`ch_`/`mm_`, n° de suivi `DON-`, nom ou pseudo d'une partie), cartes de totaux par devise, tableau, export CSV (`EXPORT_RUN`), tiroir `PaymentDetailPanel.vue` (304 lignes, une seule colonne : personnes, montants, références, bandeau de retenue, resynchronisation Stripe, boutons, chronologie). La retenue du versement, le cas le plus urgent, vient après les références, les boutons tout en bas.

**Les six autres onglets** sont des listes paginées 20 par 20, sans recherche ni filtre, avec des identifiants bruts :

| Onglet | Colonne brute | Ce qui manque |
| --- | --- | --- |
| Portefeuilles | `userId` (UUID) | nom du titulaire, lien |
| Commissions cash | `bidId` (UUID) | trajet, n° de suivi, voyageur, lien |
| Litiges bancaires | `bidId` (UUID) | trajet, personnes, lien vers colis et paiement (le `paymentId` est en base, absent du DTO) |
| Mobile money | `paymentId` (UUID) | colis, personne, lien ; les opérations `WALLET_TOPUP` et `WALLET_REFUND` n'ont pas de paiement |
| Remboursements wallet | `userName` déjà rendu | vues déjà présentes (`all`, `pending`, `processing`, `failed`, `done`) |
| Commissions mobile money | tableau de bord par période | rien à changer d'organisation |

**Back** : `AdminPaymentController` (`GET /admin/payments`, `/summary`, `/export`, `/{id}`, `/{id}/timeline`, gestes `force-release`, `refund`, `mobile-money/retry-payout`, `retry-refund`, `resync-stripe`), `AdminPaymentInsights` (recherche en SQL natif, totaux, contexte), `AdminFinanceController` (`/admin/wallets`, `/cash-commissions`, `/mobile-money-payments`, `/mobile-money-commissions`), `AdminChargebackController`, `AdminWalletRefundController`. La recherche est faite sur `payments` sans repli d'accents.

**Trois nombres existent déjà pour « séquestre de plus de 48 h »** et doivent rester égaux : la carte `escrowJ48` de la vue d'ensemble (`AdminMetricsService.countEscrowJ48` : `ESCROW` et `created_at` de plus de 48 h), l'alerte horaire `ESCROW_J48_TIMEOUT` (`EscrowScheduler`, même critère), et la nouvelle vue « À traiter ».

**Le numéro des opérations mobile money est chiffré en base** (`msisdn` via `EncryptedStringConverter`). Seul `msisdn_masked` (les derniers chiffres) est interrogeable en SQL : la recherche par numéro ne porte donc que sur ces derniers chiffres, pas sur 8 chiffres comme sur la page Colis.

## Pourquoi

Le propriétaire ne voit pas où l'argent demande une action, retrouve mal une transaction (pas de recherche par trajet, montant ou fin de numéro), lit des UUID dans quatre onglets, et surtout **quitte la page dès qu'il lui faut une information qui vit ailleurs** (le colis, le trajet, le litige, la conversation, la fiche de la personne, les alertes, le journal) sans pouvoir y arriver d'un clic au bon endroit.

## Objectifs

1. Voir ce qui demande une action : vues à nombre, étiquette d'alerte par ligne, pastilles par section.
2. Retrouver une transaction par n° de suivi, nom, trajet, montant, référence Stripe ou pawaPay, fin de numéro mobile money.
3. Un tiroir rangé par onglets, le problème en premier.
4. **Chaque information qui n'est pas dans Transactions est un lien qui atterrit sur la bonne information** (voir « Carte des liens »), et l'inverse : depuis les autres pages, un lien arrive dans Transactions déjà filtré ou déjà ouvert sur le bon onglet.
5. Les six autres onglets montrent des noms, des trajets et des liens au lieu d'UUID, avec recherche et vues.
6. Rien ne casse : liens entrants existants, gestes, ancien backend.

## Hors périmètre

- Pas de nouvelle action d'argent ni de changement de règle (force-release, remboursement, relances, dérogation, resynchronisation restent identiques, regroupés dans un menu).
- Pas de changement du calcul de l'alerte J+48 (voir « Appels de conception » n° 4).
- Pas de page `/transactions/<id>` : le tiroir reste un tiroir à URL partageable.
- Pas de refonte de l'onglet Commissions mobile money ni du tableau de bord par période.
- Pas de nouvelle permission, pas de migration.
- Pas de modification de l'app mobile ni des fiches de l'assistant.

## Anti-objectifs

- Un lien qui mène à une page vide, au mauvais onglet, ou à un 403 : un lien dont la permission manque **n'existe pas** (texte simple).
- Une alerte « À traiter » dont le nombre ne correspond pas à la liste où l'on atterrit (carte de la vue d'ensemble, pastille du menu, vue).
- Un numéro de téléphone complet affiché ou cherchable.
- Des montants de devises différentes additionnés.
- Un lien entrant existant (`?tab=`, `?open=`, `?held=true`) qui cesse de marcher.
- L'admin fusionné avant son backend (PR jumelles) : l'ancienne page doit tenir tant que le backend n'est pas déployé.

## Contraintes du projet

- PR jumelles : backend d'abord, admin ensuite, repli sur l'ancien contrat (`isEndpointMissing`, champ absent = ancien backend, `null` = non autorisé). Jackson `NON_NULL`.
- Droits : `PAYMENT_VIEW` pour toute la page ; `PAYMENT_RELEASE`/`PAYMENT_REFUND` pour les gestes ; `EXPORT_RUN` pour l'export ; chaque lien sortant derrière la permission de sa destination (`BID_VIEW`, `DISPUTE_VIEW`, `MODERATION_VIEW`, `USER_VIEW`, `ALERT_VIEW`, `AUDIT_VIEW`, `SUPPORT_TICKET_VIEW`, `USER_KYC`).
- Montants : centimes dans `*Cents`, `formatMoney`, une carte de totaux par devise.
- Tests backend sur H2 (Flyway désactivé) et PostgreSQL : le SQL natif doit tourner sur les deux. Couverture ≥ 90 % ; la logique vit dans `features/` et `lib/`, pas dans `app/pages/**`.
- Le tiroir utilise `useEscapeClose` avec son paramètre `root` (correctif livré avec la page Colis), pour que Échap le ferme.

## Ce qui est décidé (par le propriétaire, sur la maquette)

1. **Quatre sections** en haut, avec pastilles d'alerte : Paiements · Mobile money · Soldes · Litiges bancaires. Les sept identifiants `?tab=` actuels restent valides : `payments`, `chargebacks`, `mobile-money`, `mm-commissions`, `wallets`, `wallet-refunds`, `cash-commissions`. Sous-onglets : Mobile money = Opérations | Commissions ; Soldes = Portefeuilles | Remboursements wallet | Commissions cash.
2. **Vues rapides de l'onglet Paiements**, avec nombre : À traiter · En séquestre · Versés (3 j) · Remboursés · Échoués / annulés · Tous. Checkouts abandonnés masqués par défaut, lien « les afficher ».
3. **Totaux par devise** sous la barre de recherche, calculés sur le périmètre de la vue.
4. **Ligne de liste** : étiquette « à faire » + statut, colis (trajet, type, n° de suivi), Expéditeur → Voyageur, montant et ventilation net/commission, méthode, ancienneté.
5. **Recherche à suggestions** (planche 2), filtres retirables, URL partageable.
6. **Tiroir à 5 onglets** : Résumé · Argent · Chronologie · Incidents · Références. Bandeau « ce qui bloque » en haut, parcours de l'argent en une ligne, menu « Actions ».
7. **Autres sections** : noms et liens, recherche, vues « Échecs » / « Ouverts » (planche 4).

## Carte des liens (le cœur de la demande)

### Principe

- **Un seul registre** : `app/lib/adminLinks.ts` construit toute URL interne de l'admin (`bid`, `bidSection`, `trip`, `tripBids`, `user`, `userTab`, `dispute`, `noShow`, `conversation`, `payment`, `paymentSection`, `transactionsView`, `alert`, `audit`, `supportOf`, `packageRequest`). Il remplace les chaînes écrites à la main dans `bidLinks.ts`, `alertCatalog.ts`, `objectLinks.ts`, `globalSearchService.ts`, `UserAccountBanners.vue`, `UserDetailPanel.vue`, `useOverview.ts`, `PaymentDetailPanel.vue`. Chaque constructeur est testé : une seule vérité sur la forme des URL.
- **Un lien = une destination précise** : la page, le tiroir ouvert, l'onglet du tiroir, le filtre appliqué, la ligne mise en évidence. Jamais « la page en général ».
- **Permission = existence** : chaque entrée du registre déclare sa permission ; sans elle le lien n'est pas rendu (texte simple), comme `bidLinks` aujourd'hui.
- **Identifiant manquant = pas de lien** (ancien backend, négociation sans colis) ; jamais un lien vers un identifiant vide.
- **Dans le tiroir et dans les lignes** : tout nom de personne, tout n° de suivi, tout trajet, tout identifiant de litige est un lien (soulignement au survol, ouverture dans le même onglet ; Ctrl/Cmd-clic dans un nouvel onglet puisque ce sont de vrais `<a href>`).

### Sortants : depuis Transactions vers le reste de l'admin

| Information vue dans Transactions | Où on atterrit | URL exacte | Permission | Donnée nécessaire |
| --- | --- | --- | --- | --- |
| Nom de l'expéditeur ou du voyageur | Fiche utilisateur, vue d'ensemble | `/users/<id>` | `USER_VIEW` | `insight.sender.id`, `traveler.id` (existe) |
| Argent retenu d'un voyageur banni | Fiche utilisateur, onglet Argent | `/users/<id>?tab=money` | `USER_VIEW` + `PAYMENT_VIEW` | `travelerId` (existe) |
| Cause de la retenue (banni, KYC révoqué) | Fiche, onglet Gestion ou Identité | `/users/<id>?tab=manage` (banni) · `?tab=identity` (KYC révoqué) | `USER_VIEW` (+ `USER_KYC`) | `beneficiaryHoldReason` (existe) |
| Titulaire d'un portefeuille | Fiche, onglet Argent (mouvements du portefeuille) | `/users/<id>?tab=money` | `USER_VIEW` | `userId` (existe) + `userName` (nouveau) |
| Demandeur d'un remboursement wallet | Fiche, onglet Argent | `/users/<id>?tab=money` | `USER_VIEW` | `userId`, `userName` (existent) |
| Personne d'une opération mobile money (dépôt, versement, recharge, remboursement) | Fiche utilisateur | `/users/<id>?tab=money` | `USER_VIEW` | `personId`, `personName`, `role` (nouveaux) |
| Support de l'expéditeur / du voyageur | Support filtré sur la personne | `/support?userId=<id>` | `SUPPORT_TICKET_VIEW` | ids (existent) |
| N° de suivi / trajet du paiement | Colis, tiroir ouvert | `/colis?open=<bidId>` | `BID_VIEW` | `insight.bidId` (existe) |
| Photos de remise et de livraison (preuve avant de débloquer) | Colis, onglet Suivi | `/colis?open=<bidId>&section=tracking` | `BID_VIEW` | `bidId` |
| Argent du colis (ventilation côté colis) | Colis, onglet Argent | `/colis?open=<bidId>&section=money` | `BID_VIEW` | `bidId` |
| Incidents du colis | Colis, onglet Incidents | `/colis?open=<bidId>&section=incidents` | `BID_VIEW` | `bidId` |
| Échanges des deux parties | Colis, onglet Échanges | `/colis?open=<bidId>&section=chat` | `BID_VIEW` + `MODERATION_VIEW` | `bidId` |
| Trajet (annonce) du paiement | Colis, onglet Annonces, annonce mise en évidence | `/colis?tab=announcements&announcement=<announcementId>` | `BID_VIEW` | `announcementId` (nouveau) |
| Autres colis du même trajet | Colis, liste filtrée sur le trajet | `/colis?announcementId=<announcementId>` | `BID_VIEW` | `announcementId` (nouveau) |
| Négociation (paiement sans colis encore créé) | Colis, onglet Demandes | `/colis?tab=demandes&open=<packageRequestId>` | `BID_VIEW` | `packageRequestId` (nouveau, à résoudre depuis le fil) ; à défaut le fil reste affiché en texte copiable |
| « Litige ouvert sur le colis » | Incidents, litige ouvert | `/incidents?open=<disputeId>` | `DISPUTE_VIEW` | `disputeId`, `disputeStatus` (nouveaux, repris de `AdminBidDetailAssembler`) |
| Colis en no-show | Incidents, onglet Absences | `/incidents?tab=noshows&open=<cancellationId>` | `DISPUTE_VIEW` | `cancellationId` (nouveau) |
| Conversation de modération | Modération, conversation ouverte | `/moderation?open=<conversationId>` | `MODERATION_VIEW` | `conversationId` (nouveau, identifiant Firestore) |
| Litige bancaire du paiement | Litiges bancaires, ligne ouverte | `/transactions?tab=chargebacks&open=<chargebackId>` | `PAYMENT_VIEW` | `chargebackId` (nouveau) |
| Alertes ouvertes du paiement | Alertes, alerte ouverte | `/alertes?open=<alertId>` | `ALERT_VIEW` | `openAlerts` (nouveau) ; la page Alertes doit accepter `?open=` |
| « Voir tout le journal » du paiement | Audit filtré sur ce paiement | `/audit?entityType=Payment&entityId=<id>` | `AUDIT_VIEW` | filtre `entityId` (nouveau, back et page) |
| Stripe (PaymentIntent) | Dashboard Stripe | `insight.stripeDashboardUrl` | — | existe (lien externe, `rel="noopener noreferrer"`) |
| Colis d'une commission cash | Colis, onglet Argent | `/colis?open=<bidId>&section=money` | `BID_VIEW` | `bidId` (existe) + trajet, n° de suivi, voyageur (nouveaux) |
| Colis d'un litige bancaire | Colis ; paiement | `/colis?open=<bidId>` · `/transactions?open=<paymentId>` | `BID_VIEW` · `PAYMENT_VIEW` | `paymentId` (nouveau dans le DTO, déjà en base) |
| Supplément (opération `BID_SUPPLEMENT`) | Colis, onglet Argent | `/colis?open=<bidId>&section=money` | `BID_VIEW` | `bidId` (nouveau, résolu depuis `bidSupplementId`) |
| Recharge de portefeuille (opération `WALLET_TOPUP`) | Fiche, onglet Argent | `/users/<userId>?tab=money` | `USER_VIEW` | `userId` (existe en base, nouveau dans le DTO) |
| Remboursement wallet (opération `WALLET_REFUND`) | Onglet Remboursements wallet, demande ouverte | `/transactions?tab=wallet-refunds&open=<requestId>` | `PAYMENT_VIEW` | `walletRefundRequestId` (nouveau, si résolvable ; sinon fiche de la personne) |
| Demande parente d'un remboursement wallet | Même onglet, demande parente | `/transactions?tab=wallet-refunds&open=<parentRequestId>` | `PAYMENT_VIEW` | `parentRequestId` (existe) |

### Entrants : depuis le reste de l'admin vers Transactions

| Depuis | Information | Où on atterrit | URL exacte | Statut |
| --- | --- | --- | --- | --- |
| Colis, tiroir, onglet Argent | « Ouvrir le paiement » | Tiroir paiement ouvert | `/transactions?open=<paymentId>` | existe, inchangé |
| Colis, tiroir (retenue du voyageur) | « Voir la retenue » | Tiroir paiement, onglet Incidents | `/transactions?open=<paymentId>&section=incidents` | nouveau |
| Colis, annonce | « Paiements de ce trajet » | Liste filtrée sur le trajet | `/transactions?announcementId=<announcementId>` | nouveau (filtre + pastille retirable « Trajet : Paris → Dakar ») |
| Fiche utilisateur, onglet Argent | Une ligne de paiement | Tiroir paiement ouvert | `/transactions?open=<paymentId>` | existe (`paymentLink`), passe par le registre |
| Fiche utilisateur | « Tous ses paiements » | Liste filtrée sur la personne | `/transactions?view=all&partyId=<userId>` | nouveau (pastille « Personne : Awa Diallo ») |
| Fiche utilisateur, bandeau « argent retenu » | Versements retenus | Liste « À traiter » filtrée | `/transactions?held=true` (alias de `?view=attention&alert=HELD`) | existe, conservé |
| Fiche utilisateur, onglet Argent | Portefeuille | Onglet Portefeuilles sur la personne | `/transactions?tab=wallets&partyId=<userId>` | nouveau |
| Vue d'ensemble | Carte « Versements retenus » | Liste filtrée | `/transactions?held=true` | existe, conservé |
| Vue d'ensemble | Carte « Escrow J+48 » | Liste dont le nombre égale celui de la carte | `/transactions?view=attention&alert=ESCROW_J48` | **corrige un lien qui mène aujourd'hui à la liste complète** |
| Vue d'ensemble / menu | Pastille « Remboursements wallet » | Vue « À traiter » de l'onglet | `/transactions?tab=wallet-refunds` (vue par défaut `pending` si des tickets attendent) | existe, vue ajustée |
| Alertes | « Ouvrir le paiement » | Tiroir paiement ouvert | `/transactions?open=<paymentId>` | existe, passe par le registre |
| Alertes | Alertes INV-11, `MM_PAYOUT_ORPHAN_*` | Mobile money, vue Échecs | `/transactions?tab=mobile-money&view=failed` | nouveau (aujourd'hui : liste complète) |
| Alertes | INV-14 | Remboursements wallet | `/transactions?tab=wallet-refunds` | existe |
| Recherche globale ⌘K | Un paiement | Tiroir paiement ouvert | `/transactions?open=<id>` | existe |
| Recherche globale ⌘K | Les pages Transactions | Section et sous-onglet exacts | `searchPages.ts` (sept entrées) | existe, ajouter « Versements échoués » |
| Incidents (litige) | Paiement lié | Tiroir paiement ouvert | `/transactions?open=<paymentId>` | à ajouter si l'identifiant du paiement est disponible dans le litige |
| Notifications d'alerte | `WALLET_REFUND_REQUESTED` | Onglet Remboursements wallet | `/transactions?tab=wallet-refunds` | existe |

### Ce qu'il faut ajouter aux pages de destination

| Page | Ajout | Raison |
| --- | --- | --- |
| `/alertes` | `?open=<alertId>` ouvre l'alerte dans son panneau | aujourd'hui la page ne lit aucun paramètre d'URL |
| `/audit` | `?entityType=…&entityId=…` pré-remplit et applique les filtres ; le back gagne le filtre `entityId` | « voir tout le journal de ce paiement » |
| `/transactions` | `?view=`, `?alert=`, `?partyId=`, `?announcementId=`, `?bidId=`, `?query=`, `?section=` (onglet du tiroir), `?tab=…&open=<id>` pour litige bancaire et demande de remboursement wallet | les liens entrants ci-dessus |
| `/incidents`, `/moderation`, `/colis`, `/users/<id>`, `/support` | rien : acceptent déjà `?open=`, `?tab=`, `?section=`, `?userId=` | vérifié dans le code |

### Règles de vérification des liens

- Test unitaire par constructeur du registre : forme exacte de l'URL, identifiant absent ou mal formé = `null`, permission absente = `null`.
- Test par composant : chaque lien du tiroir et de chaque tableau porte le bon `href` ; sans la permission, pas de `<a>` mais du texte.
- E2E « aller-retour » : de la fiche paiement au colis (onglet Suivi), à la fiche du voyageur (onglet Argent), au litige, à l'alerte ; du colis à son paiement retenu (onglet Incidents) ; de la fiche utilisateur à la liste filtrée sur elle ; de la carte « Escrow J+48 » à une liste dont le nombre est identique.

## Appels de conception (de moi, à contrôler)

1. **Recherche côté serveur** : extension de `q` de `GET /admin/payments`. Mots séparés par des espaces, tous requis, repli d'accents `TRANSLATE`+`REPLACE` identique au Java (`AdminSearchTerms.fold`, déjà utilisé pour Colis). Cherché dans : identifiants de paiement, de colis, de négociation, d'annonce ; références `pi_`/`ch_`/`mm_` et identifiants pawaPay ; n° de suivi (`YD-`/`DON-`, partiel) ; nom, prénom, pseudo de l'expéditeur et du voyageur ; villes de départ et d'arrivée ; montant exact (centimes, tolérant `120`, `120,00`, `120.50`). Saisie non vide sans jeton exploitable ne renvoie rien (`NO_MATCH_TOKEN`, comme Colis).
2. **Suggestions** : `GET /admin/payments/suggest?q=` (5 par groupe : expéditeurs, voyageurs, trajets, n° de suivi), dès 2 lettres ; une référence exacte (`pi_…`, identifiant pawaPay, UUID) ouvre directement la fiche. Mêmes permissions que la liste (`PAYMENT_VIEW`).
3. **Vues et nombres** : `GET /admin/payments/counts` (nombre par vue selon la recherche et les filtres actifs), `GET /admin/finance/counts` (pastilles des quatre sections). Paramètres de liste : `view` (`ATTENTION`, `ESCROW`, `RELEASED_RECENT`, `REFUNDED`, `FAILED`, `ALL`), `alert`, `partyId`, `announcementId`, `bidId`, `amountMin`, `amountMax`. Les anciens `status`, `method`, `currency`, `held`, `hideAbandoned`, dates restent.
4. **« À traiter » et son alerte unique** (valeurs de mon choix, constantes dans le code, à confirmer en recette) :
   - `HELD` : `ESCROW` et versement retenu (`payout_held_at` non nul), c'est la définition du filtre `held` existant.
   - `CHARGEBACK_OPEN` : un litige bancaire `OPEN` existe pour le paiement.
   - `MM_FAILED` : une opération mobile money du paiement est en échec (`FAILED`, `SUBMIT_REJECTED`) **sans** opération plus récente du même type qui ait réussi.
   - `ESCROW_J48` : `ESCROW` créé il y a plus de 48 h. **Identique à la carte de la vue d'ensemble et à l'alerte `ESCROW_J48_TIMEOUT`**, pour que les trois nombres soient égaux. Réserve à connaître : un colis encore en transit après 48 h est normalement en séquestre et sera signalé. Affiner ce critère (par exemple « colis livré depuis plus de 48 h ») est une décision du propriétaire qui change la carte, l'alerte et la vue ensemble : elle est notée dans les questions ouvertes, pas faite ici.
   - Urgence : `HELD`, puis `CHARGEBACK_OPEN`, puis `MM_FAILED`, puis `ESCROW_J48` ; à égalité le plus ancien d'abord. Une seule étiquette par paiement, la plus urgente.
   - Calcul écrit **une fois** en SQL (`AdminPaymentSql.ALERT_RANK`) et partagé par la liste, les nombres, le tri et l'étiquette de ligne ; jamais une seconde implémentation en Java ou dans le front.
   - Vues : *En séquestre* = `ESCROW` ; *Versés (3 j)* = `RELEASED` avec libération il y a moins de 72 h ; *Remboursés* = `REFUNDED` ; *Échoués / annulés* = `FAILED`, `CANCELLED` ; *Tous* = tout sauf les checkouts abandonnés (`PENDING` depuis plus de 24 h) ; « À traiter » traverse les autres vues, les nombres ne s'additionnent pas, et l'écran le dit.
5. **Corrections par rapport à la maquette validée** : l'étiquette « Livré depuis 3 j · pas encore versé » devient « En séquestre depuis plus de 48 h » (appel n° 4), et la fin de numéro mobile money cherche les **derniers chiffres visibles** (numéro chiffré en base), pas 8 chiffres. La maquette sera corrigée.
6. **Fiche paiement** : `GET /admin/payments/{id}` gagne, à la fin, des blocs optionnels : `alert`, `trackingNumber`, `links` (`announcementId`, `disputeId`, `disputeStatus`, `cancellationId`, `conversationId`, `chargebackId`, `packageRequestId`), `openAlerts` (`id`, `type`, `severity`), `chargeback` (`id`, `status`, `reason`, `openedAt`, `outcome`). Chaque lien n'est rempli que si la permission de sa destination est détenue (`links.disputeId` seulement avec `DISPUTE_VIEW`, `conversationId` avec `MODERATION_VIEW`, `openAlerts` avec `ALERT_VIEW`). `GET /admin/payments` gagne sur chaque ligne `alert`, `trackingNumber`, `announcementId` ; les champs `insight` existants restent.
7. **Autres listes** :
   - Mobile money : filtres `view` (`FAILED`, `OPEN`, `DONE`, `ALL`), `kind`, `provider`, `q` ; ligne enrichie de `personId`, `personName`, `role`, `purpose`, `bidId`, `trackingNumber`, `corridor`, `retryable`. Le numéro reste masqué.
   - Portefeuilles : ajout de `userName`, filtres `q`, `currency`, `balanceSign`.
   - Commissions cash : ajout de `trackingNumber`, `corridor`, `travelerId`, `travelerName`, filtre `status` (`PENDING`, `REQUIRES_3DS`, `CHARGED`, `FAILED`, `REFUNDED`, `REFUND_FAILED`) ; vue « À traiter » = `FAILED`, `REQUIRES_3DS`, `REFUND_FAILED`.
   - Litiges bancaires : ajout de `paymentId`, `trackingNumber`, `corridor`, `senderName`, `travelerName`, filtre `status` ; échéance de réponse affichée si le back la connaît (`resolvedAt` / `outcome` sinon).
   - Remboursements wallet : inchangé côté données ; `?open=<requestId>` ouvre la demande ; vue par défaut `pending` si des tickets attendent, `all` sinon.
8. **Audit** : `GET /admin/audit` gagne le filtre `entityId`.
9. **Pastilles de section** : `GET /admin/finance/counts` renvoie `payments.attention`, `mobileMoney.failed`, `soldes.walletRefundsPending + cashCommissions.attention`, `chargebacks.open` ; il remplace les pastilles dérivées de `heldPayouts` et `walletRefunds` dans `navBadges.ts` sans les retirer tant que le back n'est pas déployé.
10. **Export CSV** : le périmètre exporté suit la vue et les filtres actifs (déjà vrai pour les filtres existants ; `view`, `alert`, `partyId`, `announcementId` s'y ajoutent). Colonnes inchangées, plus le n° de suivi.
11. **Index** : aucun ajout dans ce lot (H2 ne peut pas mesurer) ; à mesurer sur staging avant tout index.
12. **Repli ancien backend** : `counts`, `suggest`, filtres absents (404/405 sans `code`, ou champ absent) = comportement actuel : onglets plats visibles, vues cachées, recherche simple, liens construits avec ce qui existe.
13. **Appel de lieu** : `AdminPaymentController` dépasse 1 000 lignes ; la recherche, les vues et les nombres vivent dans de nouvelles classes (`AdminPaymentSql`, `AdminPaymentQuery`, `AdminPaymentSearch`) comme `AdminBidSql` pour Colis, pas dans le contrôleur.

## Laissé au constructeur

Découpage des composants et composables, noms des fichiers, détail du SQL, libellés exacts des étiquettes, structure des tests e2e, forme du menu « Actions ».

## Questions ouvertes pour le propriétaire (non bloquantes)

1. **Critère J+48** : garder « séquestre créé il y a plus de 48 h » (cohérent avec la carte et l'alerte, mais signale aussi des colis en transit normal) ou passer à « colis livré depuis plus de 48 h et pas versé » (plus juste, mais change la carte et l'alerte).
2. **Recherche par fin de numéro** : limitée aux derniers chiffres visibles (numéro chiffré en base). Acceptable ?
3. **Dérogation et audit** : inchangés. Le lien « tout le journal » exige `AUDIT_VIEW` ; les admins sans cette permission voient seulement la chronologie du tiroir.

## Vérification

Backend : tests d'intégration sur base réelle (H2) par critère de recherche (accents, casse, partiel, plusieurs mots, montant, trajet, compte supprimé), par vue et par critère d'alerte, tri d'urgence, nombres identiques aux listes **et à la carte `escrowJ48`**, permissions (champ `links` absent sans permission), champs enrichis des cinq autres listes, filtre `entityId` de l'audit, non-régression des gestes et de la chronologie ; un test sur PostgreSQL réel pour le repli d'accents. Admin : unitaires par constructeur du registre de liens, par composant et composable ; e2e de recherche, de vue « À traiter », du tiroir à onglets, de chaque aller-retour de lien listé plus haut, du repli ancien backend, de l'ouverture par lien entrant existant (`?open=`, `?tab=`, `?held=true`). Recette staging par le propriétaire.
