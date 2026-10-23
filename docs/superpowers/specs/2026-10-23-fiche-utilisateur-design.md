# Fiche utilisateur : une page qui rassemble tout sur un compte

Date : 2026-10-23. Dépôts concernés : `yadony-back` (API admin) puis `dony-admin` (Nuxt).
Maquette validée par le propriétaire (aperçu privé, données fictives) : https://claude.ai/artifact/TqG8DKnXSphj6XKbPxi3Qz

## Intention et pourquoi

Quand un administrateur ouvre un utilisateur, il doit pouvoir comprendre la situation de ce compte d'un seul regard : ce qui est en cours, ce qui vient d'être livré, l'argent, les incidents, les signalements, le support. Aujourd'hui l'information est éclatée entre plusieurs écrans de l'admin (Colis, Transactions, Incidents, Signalements, Support, Audit) et le drawer de l'utilisateur n'en montre qu'une partie ; l'admin doit chercher le même utilisateur écran par écran et recoller les morceaux.

Moments d'usage cités : réclamation ou litige, doute sur un compte, problème d'argent, support au quotidien. Le besoin récurrent : voir **les trajets et colis en cours et ceux livrés depuis 3 jours**.

Réussite : un admin ouvre un compte, sait en moins d'une minute ce qui se passe (en cours, bloqué, en litige), et peut agir sans changer d'écran.

## Objectifs

1. Un clic sur un utilisateur dans la liste ouvre **une page complète** (route dédiée, partageable par lien) qui **remplace le drawer**.
2. En haut : identité, statuts (compte, KYC, GP Pro, rôles), bande d'alertes (« À surveiller ») et six chiffres clés.
3. Une **vue d'ensemble** avec : le tableau « en cours et livrés depuis 3 jours » (colis et trajets mélangés) et une frise de la dernière activité.
4. Des onglets de détail : Colis, trajets et demandes ; Argent ; Incidents et signalements ; Identité (KYC) ; Support et journal ; Gestion.
5. Chaque ligne d'une liste renvoie vers l'écran habituel de l'objet (colis, paiement, litige, signalement, ticket).
6. **Toutes les actions du drawer actuel sont conservées**, déplacées (voir « Où va chaque action »).
7. Les droits par rôle sont respectés partout (voir « Rôles »), côté interface **et** côté serveur.

## Hors périmètre

- Nouvelles actions de modération ou nouveaux écrans d'objets (colis, paiement, litige gardent leurs écrans).
- Modifier le contenu de l'application mobile ou les fiches de l'assistant IA (aucune route ni parcours utilisateur de l'app ne change).
- Export, impression ou envoi par e-mail de la fiche.
- Nouvelle table ou migration pour la fiche en elle-même (elle lit l'existant) : si une migration devient nécessaire, ce n'est pas pour stocker de la donnée de la fiche.

## Anti-objectifs (ce qui rendrait la livraison ratée même si elle « marche »)

- Une page lente : si l'ouverture d'un compte prend plusieurs secondes parce qu'elle charge tout d'un coup. Les onglets de détail se chargent à l'ouverture de l'onglet ; seule la vue d'ensemble (bandeau, chiffres, en cours, frise) se charge d'emblée.
- Afficher un échec comme une liste vide (déjà une règle de l'admin : `StateBlock` avec « Réessayer »).
- Mélanger des devises dans un total (toujours un montant par devise, jamais de somme EUR + F CFA).
- Donner à `SUPPORT` un moyen d'agir sur un compte que le serveur lui refuse, ou l'inverse : un bouton visible que le serveur refuse.
- Perdre une action du drawer actuel.

## Contraintes

- **Deux dépôts, deux PR jumelles.** Le backend d'abord, l'admin ensuite (règle du projet). L'admin cite la PR backend et ne se fusionne qu'après elle. L'admin doit tolérer un backend qui n'a pas encore les nouveaux endpoints (message clair « mise à jour du serveur en attente » plutôt qu'une page cassée, et le drawer actuel reste utilisable tant que l'ancien backend tourne : voir « Livraison »).
- Branche dédiée par dépôt, jamais de commit sur `main`, pas de ligne `Co-Authored-By`.
- Tests : couverture ≥ 90 % sur les deux projets, tests existants corrigés, tests ajoutés pour tout nouveau code.
- Backend : suppression douce, `audit_log` immuable, erreurs RFC 7807 via `GlobalExceptionHandler`, `@PreAuthorize` sur tous les endpoints, vérifier la propriété/permission avant tout accès. Pas d'injection de service entre packages : événements Spring ou lecture via les services/ports existants du package concerné.
- Données de KYC : jamais d'URL directe de fichier KYC (URLs présignées uniquement), comme aujourd'hui.
- Devises : chaque montant dans sa devise, formaté comme ailleurs dans l'admin.
- L'admin garde ses règles d'interface : pas de dégradé, pas de tiret cadratin dans les textes d'interface, pas de `setState` côté app Flutter (non concerné ici), composants existants réutilisés (`TabBar`, `StateBlock`, `StatusBadge`, `ConfirmActionDialog`).

## Décisions prises avec le propriétaire

Page et navigation
- **Page complète directement** au clic sur une ligne de la liste ; le drawer est remplacé (pas de double niveau).
- Organisation : **résumé en haut + onglets**.
- **Chaque ligne consulte et renvoie** vers l'écran concerné ; la page elle-même ne duplique pas les écrans d'objets.

Où va chaque action
| Action actuelle du drawer | Où sur la page |
|---|---|
| Envoyer une notification, écrire à l'utilisateur | Menu « Actions du compte », groupe Communiquer |
| Suspendre, bannir, réactiver, lever le bannissement | Même menu, groupe Compte (le libellé suit l'état du compte) |
| Suspendre / rétablir la publication, couper / rétablir la messagerie | Même menu, groupe Activité |
| Commission personnalisée, accès PRO (offrir, révoquer), GP Pro, mode recette | Onglet **Gestion** |
| Suppression du compte (avec analyse d'impact) | Onglet Gestion, carte « Zone de danger » isolée |
| Décision et réinitialisation KYC | Onglet **Identité (KYC)** |
| Correction de solde du portefeuille | Onglet **Argent**, bouton sur la carte portefeuille |
| Annuler une suppression demandée, voir les versements retenus | Bandeaux en haut de page |

Note : « couper la messagerie » est placée dans le menu (geste de modération courant) alors qu'elle était dans l'onglet Gestion du drawer ; c'est un choix du concepteur validé en maquette.

## Rôles

Règle donnée par le propriétaire :

- **SUPER_ADMIN** et **ADMIN** : peuvent tout faire sur cette page. Les deux seules choses réservées au SUPER_ADMIN restent réservées (`ADMIN_MANAGE` : gestion des administrateurs ; mode recette).
- **SUPPORT** : **lecture sur la fiche, plus la messagerie support**. Il voit tout ce que ses permissions de lecture permettent (voir « Choix du concepteur », point 1) et peut **écrire à l'utilisateur / gérer les tickets support** (`SUPPORT_TICKET_MANAGE`). Sur la fiche, il ne peut **plus suspendre, bannir ni couper la messagerie**. Il n'avait déjà aucun droit sur l'argent, la commission, le PRO, GP Pro, la suppression de compte ni la décision KYC. Il **garde la réinitialisation d'une vérification KYC** (geste de dépannage qui ne valide ni ne refuse une identité) et, hors fiche, son travail de modération actuel (résoudre alertes et signalements, supprimer un message, modérer un avis).

Application : **côté serveur d'abord** (le rôle perd réellement ces droits dans le backend, partout dans l'admin, pas seulement sur cette page), puis l'interface masque les gestes interdits en lisant les mêmes permissions (`can(...)`), jamais sur le nom du rôle. Les surcharges de permissions par administrateur existantes continuent de s'appliquer.

Permissions retirées à SUPPORT (décision du propriétaire) : exactement `USER_SUSPEND`, `USER_BAN` et `USER_MESSAGE_MUTE`. Rien d'autre ne change dans son rôle : `USER_KYC` (lecture et réinitialisation), `ALERT_RESOLVE`, `REPORT_RESOLVE`, `MESSAGE_DELETE`, `RATING_MODERATE`, `SUPPORT_TICKET_VIEW` et `SUPPORT_TICKET_MANAGE` restent. Ce retrait vaut pour **toute** l'admin, pas seulement la fiche (par exemple un support ne pourra plus suspendre depuis un signalement). À mettre à jour ensemble : `AdminRole`/`AdminPermission` backend, miroir front dans `app/stores/auth.ts`, test de couverture des permissions (miroir exact de l'enum backend), et les écrans qui supposaient ces droits pour SUPPORT.

Conséquence à annoncer : les agents SUPPORT actuels perdent ces gestes dès le déploiement du backend en production. Le déploiement en production reste décidé par le propriétaire.

## Ce que la page montre

En-tête : nom, téléphone, e-mail, ville, date d'inscription, identifiant copiable, dernière connexion, statuts (Actif/Suspendu/Banni/Suppression demandée, KYC, GP Pro, rôles voyageur/expéditeur, PRO), taux de commission appliqué.

Bande « À surveiller » (visible seulement s'il y a quelque chose) : litiges ouverts, argent retenu (par devise), signalements en attente, suppression demandée.

Six chiffres : colis en cours ; trajets actifs ; argent retenu (par devise) ; litiges (ouverts / total) ; signalements (reçus / envoyés) ; note moyenne et nombre d'avis.

Vue d'ensemble : tableau « **en cours et livrés depuis 3 jours** » (colis et trajets, type, référence, trajet, rôle de la personne, statut, dernière mise à jour, montant, lien) ; frise de la dernière activité (colis, paiements, versements, litiges, signalements, tickets), récent d'abord.

Onglets de détail (données paginées, chargées à l'ouverture) :
- **Colis, trajets et demandes** : tous ses colis (comme voyageur et comme expéditeur), ses trajets, ses demandes d'envoi.
- **Argent** : portefeuille (disponible, retenu, commissions payées, remboursements), paiements, mouvements du portefeuille ; bouton de correction de solde.
- **Incidents et signalements** : litiges, absences (no-shows) et annulations, signalements reçus et envoyés, avis reçus.
- **Identité (KYC)** : statut, prestataire, historique des vérifications ; actions KYC.
- **Support et journal** : tickets support de l'utilisateur ; journal des actions administrateur sur ce compte.
- **Gestion** : commission, accès PRO, GP Pro, mode recette, zone de danger.

« En cours » = colis non terminal (hors livré, annulé, refusé, expiré) et trajets actifs ; « livré depuis 3 jours » = colis livrés dans les 72 dernières heures. Le seuil de 3 jours est une constante nommée et testée, pas un chiffre éparpillé.

## État du backend (constat du 2026-10-23, `yadony-back` à `a6ea032`)

Les endpoints admin existants **ne filtrent par utilisateur** que pour les tickets support (`userId`) et le portefeuille (`/admin/users/{userId}/wallet`). Les listes de colis, annonces, paiements, litiges, absences/annulations, signalements, avis, demandes d'envoi n'ont **pas** de filtre « cet utilisateur » (seulement une recherche texte pour certains). Le détail d'un utilisateur (`GET /admin/users/{id}`) porte déjà des compteurs.

D'où : une PR backend est nécessaire avant l'admin. Choix du concepteur (le constructeur peut retenir l'option la moins chère) : un endpoint de synthèse `GET /admin/users/{id}/overview` (bandeau, chiffres, « en cours et livrés depuis 3 jours », frise) plus des listes paginées par onglet sous `/admin/users/{id}/...`, **ou** l'ajout d'un filtre `userId` aux listes existantes. Dans les deux cas : `@PreAuthorize` par permission de lecture adaptée à chaque donnée (un rôle sans `PAYMENT_VIEW` ne reçoit pas les paiements ; l'interface masque l'onglet correspondant), pas de N+1, pagination.

## Livraison et ordre

1. PR backend : endpoints de lecture + retrait des droits d'écriture à `SUPPORT` + tests. Fusion, déploiement staging sur demande.
2. PR admin : route de la page, composants, remplacement du drawer, masquage des gestes selon `can()`, tests. Cite la PR backend, fusion après elle.
3. Tant que le backend n'a pas les nouveaux endpoints (staging ou production en retard), l'admin affiche un message clair dans les sections concernées et **conserve l'accès aux actions** (par exemple en gardant le drawer actuel comme repli, retiré dans une PR suivante) afin de ne jamais bloquer le support ni la modération.
4. Retrait des droits de `SUPPORT` : se déploie avec le backend ; à annoncer aux agents avant la production.

## Choix du concepteur (à relire par le propriétaire)

Ces points n'ont pas été tranchés par le propriétaire ; ce sont des choix raisonnables, modifiables sans bloquer le reste.

1. **Un onglet suit la permission de lecture de sa donnée.** Colis et trajets : `BID_VIEW` ; Argent : `PAYMENT_VIEW` ; Incidents : `DISPUTE_VIEW` et `REPORT_VIEW` ; Identité : `USER_KYC` ; Support : `SUPPORT_TICKET_VIEW` ; journal des actions administrateur : `AUDIT_VIEW`. SUPPORT possède déjà toutes ces permissions sauf `AUDIT_VIEW` : il ne voit donc **pas** le journal des actions administrateur (sa carte est masquée). Aucune permission de lecture n'est ajoutée à un rôle.
2. **La synthèse (`overview`) renvoie des sections partielles.** Chaque bloc (en cours, argent retenu, litiges, signalements, frise) n'est calculé et renvoyé que si l'appelant a la permission de lecture correspondante ; un bloc interdit est absent, et l'interface masque ce chiffre ou cette carte (jamais un zéro trompeur). L'endpoint est protégé par `USER_VIEW`, le contenu est filtré par permission.
3. **Repli vers l'ancien drawer** : l'interface appelle la synthèse ; sur un 404 (backend plus ancien) elle bascule sur le drawer actuel. Le drawer est retiré dans une PR suivante, une fois la synthèse déployée en production. Le code du repli est testé comme le reste.
4. **« Trajet actif »** : publié et non terminal (`ACTIVE`, `FULL`, `IN_PROGRESS`). Un trajet terminé depuis moins de 3 jours apparaît dans le tableau « en cours et livrés », comme un colis livré. Les demandes d'envoi ouvertes ne comptent pas dans « en cours » (elles ont leur section dans l'onglet Colis). Le constructeur confirme les statuts exacts dans le code.
5. **« Argent retenu »** = les versements retenus au voyageur (même définition que la carte « Versements retenus » de la vue d'ensemble et que le filtre `held` des transactions), par devise. L'argent en séquestre non retenu est montré à part, comme « en séquestre », dans l'onglet Argent et jamais additionné avec le retenu.
6. **Journal des actions administrateur** : lecture de `audit_log` filtrée sur la cible utilisateur. Si la cible n'est pas interrogeable efficacement, une migration d'index est autorisée (V(n+1), en vérifiant les collisions de numéro avec les PR ouvertes) ; la table reste immuable.

## Laissé au constructeur

- Forme exacte des endpoints (synthèse + listes ou filtres) et noms des champs, dans le style des contrôleurs admin existants.
- Découpage en composants, nom de la route (par exemple `/users/[id]`), organisation des fichiers dans `app/features/users`.
- Mécanisme de repli quand le backend est plus ancien que l'admin.
- Détails d'affichage qui n'altèrent pas la maquette (espacements, états de chargement, textes vides).
- Éléments de la frise : lesquels mélanger et jusqu'où remonter, tant que les 3 derniers jours sont toujours complets.

## Décisions finales du propriétaire (2026-10-23)

- Retrait de droits à SUPPORT : seulement les gestes de la fiche utilisateur (`USER_SUSPEND`, `USER_BAN`, `USER_MESSAGE_MUTE`). Le reste de son travail de modération est conservé.
- SUPPORT garde la réinitialisation KYC (aucune nouvelle permission à créer).
