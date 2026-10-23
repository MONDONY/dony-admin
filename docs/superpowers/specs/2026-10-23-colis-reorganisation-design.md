# Réorganisation de la page Colis de l'admin — document de conception

Date : 23/10/2026. Statut : validé par le propriétaire le 23/10 sur la maquette, **puis corrigé le même jour** (voir « Correction d'état des lieux »). Maquette : https://claude.ai/artifact/XjPUyVwDKSRcKDe9q9Zx3b (4 écrans : liste, recherche, tiroir, photos par étape). Version lisible du document : https://claude.ai/artifact/QkBDCSjEAAoSJtKEqwtBAL. Source de la maquette : `dony/tmp/colis-maquette/project/`.

## Correction d'état des lieux

La première version de ce document décrivait la page à partir de deux checkouts locaux périmés. Sur `main` réel (backend `a1508f17`, admin `779df15`) :

- Le tiroir `BidDetailPanel.vue` n'est pas une liste de 6 champs. Il compte déjà 7 sections empilées en un seul défilement (Trajet, Personnes, Colis, Argent, Chronologie, Actions, Identifiants), avec les photos du colis, la chronologie complète (scans, audit, paiement), les liens vers paiement, litige, no-show et conversation, et les gestes « Annuler le colis », « Ouvrir un litige », resynchronisation Stripe, écrire aux personnes. **Le problème est l'organisation (tout sur une seule colonne), pas le manque de contenu.**
- Les photos de scan et du colis sont déjà signées par le backend (`AdminBidDetailAssembler`, 15 min). Ce qui manque : une visionneuse (zoom, navigation, téléchargement), le regroupement des photos par étape, les photos purgées qui donnent un lien mort, la photo de refus (non exposée) et les preuves de litige (images de la conversation).
- Les téléphones sont **masqués** dans la fiche colis (quatre derniers chiffres). Cette règle reste.
- La page a trois onglets (Colis, Annonces, Demandes d'envoi) et des liens entrants (`/colis?open=`, `?tab=announcements&announcement=`, `?tab=demandes&open=`, `?announcementId=`) utilisés par la recherche globale, les paiements, les incidents et la fiche utilisateur : ils doivent continuer de marcher.
- La liste backend (`findAdminFiltered`) n'exclut pas les fils de négociation, ne cherche que le n° de suivi et n'a aucun tri secondaire.

## Pourquoi

Le propriétaire retrouve mal un colis (recherche limitée au n° de suivi), voit mal ce qui demande une action (12 pastilles de statut sans nombre ni urgence), et le tiroir est long et mal rangé. Il veut aussi voir les photos du colis à chaque étape et bien les voir.

## Objectifs

1. Retrouver un colis par n° de suivi (même partiel), expéditeur, voyageur, destinataire (nom, et téléphone du destinataire), trajet (villes), identifiant de colis, d'annonce, de paiement ou de litige.
2. Voir ce qui demande une action : onglet « À traiter », étiquette d'alerte sur chaque ligne.
3. Un tiroir rangé par onglets au lieu d'un long défilement, sans rien perdre de ce qu'il fait aujourd'hui.
4. Les photos du colis par étape, dans une visionneuse (zoom, navigation, téléchargement).
5. Rien de ce qui existe ne disparaît ni ne casse : onglets Annonces et Demandes, gestes, liens entrants, repli sur ancien backend.

## Hors périmètre

- Pas de page complète `/colis/<id>` : le tiroir reste un tiroir, avec URL partageable.
- Pas de nouvelle action métier. Les gestes existants (annuler, ouvrir un litige, resynchroniser Stripe, écrire) sont regroupés dans un menu « Actions », pas modifiés.
- Pas d'export CSV des colis (aucun n'existe).
- Pas de refonte des onglets Annonces et Demandes.
- Pas de modification des fiches de l'assistant ni de l'app mobile.
- Pas de nouvelle permission ni de nouvelle extension de base de données.

## Anti-objectifs

- Une photo purgée ou expirée qui s'affiche comme image cassée.
- Une recherche lente ou qui renvoie des comptes supprimés comme suggestions (le colis d'un compte supprimé reste dans la liste).
- Un téléphone démasqué.
- Un lien entrant `/colis?...` qui ne marche plus.
- L'admin fusionné avant son backend (règle des PR jumelles) : l'ancienne page doit continuer de fonctionner tant que le backend n'est pas déployé.

## Contraintes du projet

- PR jumelles : backend d'abord, admin ensuite ; l'admin tolère l'ancien contrat (champ absent = ancien backend, `null` = non autorisé ; 404/405 sans `code` = endpoint absent, via `isEndpointMissing`).
- Jackson `NON_NULL` : le backend omet les champs null ; le front teste `== null` et normalise une fois dans le service.
- Montants : conventions existantes (`netEur` en unités principales dans la devise du bid, `amountCents` en centièmes). Jamais de somme entre devises.
- Droits : `BID_VIEW` pour la liste, les comptes, les suggestions et les photos. Paiement = `PAYMENT_VIEW`, litige = `DISPUTE_VIEW`, échanges et preuves de litige (images de conversation) = `MODERATION_VIEW`, téléphone du destinataire dans la recherche et dans la fiche = `USER_VIEW`. Sans la permission : section absente.
- Couverture ≥ 90 % des deux côtés ; la logique de page (`app/pages/**`) est exclue de la couverture admin : tout ce qui compte vit dans `features/` et `lib/`.
- Tests backend sur H2 (Flyway désactivé) : le SQL natif doit tourner sur PostgreSQL ET H2.
- Les montants, dates et libellés suivent `bidLabels.ts` : jours calendaires en UTC (`formatDay`), instants du serveur via `parseServerDate`, affichage de l'heure en Europe/Paris pour la frise.

## Ce qui est décidé (par le propriétaire)

1. **Barre d'onglets du haut conservée** : Colis · Annonces · Demandes (existante). Les vues rapides ci-dessous vivent dans l'onglet Colis.
2. **Vues rapides avec nombre** (onglets soulignés sous la barre) : À traiter · En cours · Livrés depuis 3 jours · Terminés · Annulés/refusés · Tous.
3. **« À traiter »** = paiement en attente depuis plus de 24 h, litige ouvert, no-show, retard de livraison ; pastilles de décomposition qui filtrent au clic ; tri par urgence. Définitions dans « Appels de conception » n° 3.
4. **Filtres secondaires** : statut précis, période, mode de paiement, contenu, « litige ouvert », « en retard », focus d'un trajet (existant `announcementId`), réinitialiser. Tous dans l'URL.
5. **Tableau** : Suivi (+ date de création) · Colis (contenu, poids) · Trajet (+ date de départ) · Personnes (expéditeur et voyageur cliquables vers `/users/<id>`, destinataire) · Net voyageur (+ mode de paiement) · Statut (+ étiquette d'alerte) · Mis à jour.
6. **Recherche** : un champ, suggestions dès 2 lettres groupées par rôle, un choix devient un filtre retirable, portée optionnelle (Tout, N° de suivi, Expéditeur, Voyageur, Destinataire, Trajet), un n° de suivi exact ouvre directement le tiroir. Insensible aux accents et à la casse.
7. **Tiroir** : en-tête collant (n° de suivi + copier, statut, trajet, menu « Actions »), bandeau d'alerte, frise d'étapes, trois cartes personnes, cinq onglets : Résumé · Suivi · Argent · Échanges · Incidents.
8. **Photos par étape** : dans « Suivi », vignettes par étape (création, remise, transit, livraison, refus, preuves de litige) et visionneuse plein écran : zoom + / − et molette, ← → entre photos, bande de vignettes, légende (étape, date, lieu), ouvrir dans un onglet, télécharger, Échap. Étape sans photo : encart « Aucune photo pour cette étape ».

## Appels de conception (de moi, à contrôler)

1. **Recherche côté serveur**, extension du paramètre `query` de `GET /admin/bids` : mots séparés par des espaces, tous requis (« Paris Dakar »), chacun cherché dans n° de suivi, nom/prénom/identifiant de l'expéditeur et du voyageur, nom du destinataire, téléphone du destinataire (seulement avec `USER_VIEW`, chiffres uniquement), villes de départ et d'arrivée, et égalité exacte sur identifiants colis, annonce, paiement. Paramètre `scope` (ALL, TRACKING, SENDER, TRAVELER, RECIPIENT, TRIP) pour restreindre. Accents ignorés par `translate()` (pas d'extension), identique côté Java et SQL. Les téléphones de l'expéditeur et du voyageur vivent chez Firebase, pas en base : ils ne sont pas cherchables.
2. **Nouveaux points d'accès** : `GET /admin/bids/counts` (nombre par vue, selon la recherche et les filtres actifs), `GET /admin/bids/suggest?q=` (5 suggestions par groupe), `GET /admin/bids/{id}/photos`.
3. **Définitions de « À traiter » et des vues** (valeurs par défaut de mon choix, constantes dans le code, à confirmer en recette) :
   - *Paiement en attente* : statut `AWAITING_PAYMENT` et dernière modification il y a plus de 24 h.
   - *Litige ouvert* : un litige au statut `OPEN` existe sur le colis, quel que soit le statut du colis.
   - *No-show* : statut `NO_SHOW`.
   - *Retard* : statut `ACCEPTED`, `HANDED_OVER` ou `IN_TRANSIT`, sans `deliveredAt`, et date d'arrivée de l'annonce (`arrivalDate`, à défaut `departureDate`) antérieure à hier.
   - *Urgence* : litige, puis no-show, puis impayé, puis retard ; à égalité, le plus ancien d'abord. Une seule étiquette par colis : la plus urgente.
   - *En cours* = `AWAITING_PAYMENT`, `PENDING`, `PAYMENT_ESCROWED`, `ACCEPTED`, `HANDED_OVER`, `IN_TRANSIT`, `ARRIVED` ; *Livrés depuis 3 jours* = `COMPLETED` avec `deliveredAt` de moins de 72 h ; *Terminés* = `COMPLETED` ; *Annulés/refusés* = `REJECTED`, `CANCELLED`, `EXPIRED`, `PARCEL_REFUSED`, `NO_SHOW` ; *Tous* = tout sauf les fils de négociation. « À traiter » traverse les autres vues : les nombres ne s'additionnent pas, et l'écran le dit.
   - Le calcul d'alerte est écrit **une seule fois**, en SQL, et sert la vue, le nombre, le tri et l'étiquette de chaque ligne (jamais une seconde implémentation en Java).
4. **Négociations** : `NEGOTIATING` et `NEGOTIATION_CLOSED` sortent de la liste par défaut (comme dans la fiche utilisateur) ; le filtre de statut précis peut encore les montrer.
5. **Fiche enrichie** : ajout à la fin de `AdminBidDetailResponse` d'un bloc `incidents` (litiges et annulations du colis : identifiant, type, statut, dates, résolution), présent seulement avec `DISPUTE_VIEW`. Les liens existants sont conservés.
6. **Photos** : `GET /admin/bids/{id}/photos` renvoie une liste d'étapes. Sources : photos du colis (`bid_photos`), scans de suivi (sans les photos purgées), photo de refus (`refusalPhotoUrl`), et, avec `MODERATION_VIEW` et seulement si un litige existe, les images non purgées de la conversation du colis. URL signées 15 min, jamais enregistrées ni journalisées. La chronologie existante cesse aussi d'exposer les photos purgées. La visionneuse recharge la liste une fois si une adresse a expiré.
7. **Échanges** : l'onglet reprend l'endpoint existant des messages de conversation (`MODERATION_VIEW`) ; aucune nouvelle route.
8. **Raccourci `/`** : non repris. La palette globale ⌘K / `/` cherche déjà les colis et profite de la recherche étendue. La barre de recherche de la page n'a pas de raccourci propre.
9. **Index** : aucun ajout. Le volume est faible et la suite de tests (H2, sans Flyway) ne peut pas mesurer un index ; à mesurer sur staging avant d'en ajouter. Le SQL de recherche est écrit pour qu'un index trigramme sur expression puisse s'y brancher plus tard sans changer le contrat.
10. **Repli ancien backend** : si `counts`, `suggest` ou `photos` répondent 404/405 sans `code`, l'écran retombe sur le comportement actuel (recherche simple par suivi, vues cachées, photos du détail).

## Laissé au constructeur

Découpage des composants, noms des composables, détail du SQL, bibliothèque de zoom (ou maison), libellés exacts des étiquettes d'alerte, structure des tests e2e.

## Vérification

Backend : tests d'intégration sur base réelle (H2) par critère de recherche (accents, casse, partiel, plusieurs mots, portée, compte supprimé), par vue et par critère d'alerte, tri d'urgence, nombres cohérents avec les listes, permissions (section absente), photos (purgées, refus, litige), non-régression du détail et de la chronologie. Admin : unitaires par composant et composable, e2e (recherche et filtre retirable, vue « À traiter », tiroir à onglets, ouverture par lien entrant, visionneuse au clavier, repli ancien backend). Recette staging par le propriétaire.
