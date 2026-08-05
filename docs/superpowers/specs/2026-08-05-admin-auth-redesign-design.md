# Refonte de l'authentification administrateur

Date : 2026-08-05

## Contexte

L'administration utilise deja Firebase Authentication pour verifier les identifiants, puis le backend Spring pour charger le compte administrateur et ses permissions. Le frontend transforme actuellement un identifiant court en adresse technique `@admin.dony.invalid`, persiste le token dans `localStorage` et ne force le changement de mot de passe qu'au moment du login.

La cible conserve Firebase comme fournisseur d'identite, mais remplace les identifiants techniques par de vraies adresses email et renforce l'autorite du backend sur les roles, les statuts et le changement obligatoire du mot de passe.

Cette conception concerne deux depots :

- `dony-admin` pour la connexion, la session et le panel de gestion ;
- `dony-back` pour le bootstrap, les comptes Firebase, les invariants, les permissions et les API.

## Objectifs

- Utiliser l'adresse email comme identifiant de connexion de tous les administrateurs.
- Provisionner une seule fois le compte racine `aboubakar.diakite@yadony.com`.
- Garantir que ce compte est l'unique `SUPER_ADMIN`.
- Permettre au `SUPER_ADMIN` de creer des comptes `ADMIN` ou `SUPPORT` depuis le panel.
- Generer automatiquement un mot de passe temporaire robuste, visible une seule fois.
- Obliger chaque compte cree ou reinitialise a changer ce mot de passe avant tout autre usage du panel.
- Permettre aux administrateurs de changer ensuite leur propre mot de passe.
- Conserver les permissions granulaires et leur controle cote backend.

## Hors perimetre

- Recuperation de mot de passe par email en libre-service.
- Authentification multifacteur.
- Creation d'un second `SUPER_ADMIN` ou transfert du role racine.
- Remplacement de Firebase par un systeme de sessions maison.
- Envoi automatique du mot de passe temporaire par email.

## Invariants de securite

1. Un seul compte peut porter le role `SUPER_ADMIN`.
2. L'identite racine est liee a `aboubakar.diakite@yadony.com` et son email est immuable depuis les API du panel.
3. Aucune API authentifiee ne peut creer, promouvoir, retrograder, desactiver ou supprimer le `SUPER_ADMIN`.
4. Les API de creation et de modification n'acceptent que `ADMIN` et `SUPPORT` comme roles gerables.
5. Un compte `DISABLED` ne recoit jamais de principal administrateur.
6. Un administrateur avec `mustChangePassword=true` ne peut utiliser que son profil et l'API de changement de mot de passe.
7. Les mots de passe ne sont jamais stockes en clair, journalises ou inclus dans des evenements d'audit.
8. Le mot de passe temporaire n'est retourne qu'en reponse directe a une creation ou une reinitialisation reussie.
9. Le frontend ne constitue pas une frontiere de securite : toutes les regles sont appliquees par le backend.

## Architecture retenue

Firebase Authentication reste responsable des emails, mots de passe et ID tokens. PostgreSQL reste la source de verite pour le profil administrateur, son statut, son role, `mustChangePassword` et ses exceptions de permissions.

Le frontend se connecte directement avec l'email fourni. Apres authentification Firebase, il envoie l'ID token a `GET /admin/me`. Le backend verifie le token, resout le compte administrateur actif et retourne son profil. Une identite Firebase sans ligne administrateur active est refusee.

Le profil est recharge par `/admin/me` a chaque demarrage de l'application et apres toute operation qui modifie la session. Le token reste en memoire et Firebase gere sa persistance et son rafraichissement ; il n'est plus copie dans `localStorage`.

## Bootstrap du super-admin

Le bootstrap existant devient une operation de creation uniquement :

- l'email racine provient d'une configuration de deploiement et doit correspondre a l'identite racine attendue ;
- le mot de passe initial provient d'un secret de deploiement, jamais du depot ;
- un secret de bootstrap distinct protege l'appel ponctuel ;
- l'operation cree le compte Firebase puis la ligne PostgreSQL `SUPER_ADMIN` ;
- si l'ecriture PostgreSQL echoue, le compte Firebase nouvellement cree est supprime ;
- si un `SUPER_ADMIN` existe deja, l'endpoint retourne `409` et ne modifie rien ;
- l'ancien comportement de reinitialisation d'urgence par le bootstrap est supprime ;
- apres le provisionnement, le secret de bootstrap est retire et l'endpoint repond `404`.

Le mot de passe initial communique pendant le cadrage n'apparaitra ni dans la specification executable, ni dans le code, ni dans Git. Il devra etre fourni par le gestionnaire de secrets de l'environnement et remplace apres le premier acces.

Une contrainte d'unicite en base complete les gardes applicatives pour empecher plusieurs lignes `SUPER_ADMIN`. Le service verifie egalement que l'email racine ne peut pas etre utilise pour un compte d'un autre role.

## Connexion et session

1. L'utilisateur saisit son email et son mot de passe.
2. Firebase authentifie ces identifiants sans transformation d'adresse.
3. Le frontend recupere un ID token et appelle `GET /admin/me`.
4. Le backend verifie le token Firebase et charge les autorisations administrateur.
5. Un compte absent ou desactive est refuse et la session Firebase locale est fermee.
6. Si `mustChangePassword=true`, le frontend redirige vers `/change-password`.
7. Sinon, l'utilisateur accede au tableau de bord selon ses permissions.

Le middleware global attend la resolution initiale de Firebase avant de decider une redirection. Les routes `/login` et `/denied` restent publiques. `/change-password` exige une session authentifiee avec un profil administrateur.

Un `401` vide l'etat local et ferme la session Firebase. Un `403` conserve la session et affiche un refus d'acces, sauf le code `PASSWORD_CHANGE_REQUIRED`, qui redirige vers le changement de mot de passe.

## Changement obligatoire du mot de passe

Le backend applique `mustChangePassword`, pas seulement le frontend. Quand le drapeau est actif, le filtre administrateur refuse toutes les routes admin sauf :

- `GET /admin/me` ;
- `POST /admin/me/change-password`.

Le formulaire exige un nouveau mot de passe et sa confirmation. La politique minimale est de 12 caracteres ; le frontend la signale et le backend l'applique avant toute mise a jour Firebase. Le backend met a jour le mot de passe via Firebase Admin, passe `mustChangePassword` a `false`, vide le cache d'autorisations et journalise l'action sans contenu sensible.

Apres succes, le frontend force un nouveau token Firebase, recharge `/admin/me`, remplace le profil en memoire et ouvre le tableau de bord. Le meme ecran reste accessible depuis le profil pour un changement volontaire ulterieur.

## Gestion des administrateurs

Une page `Administrateurs` est ajoutee au panel et n'est visible que pour le `SUPER_ADMIN`. Le backend exige `ADMIN_MANAGE` sur toutes ses API.

La page affiche :

- l'adresse email ;
- le role ;
- le statut ;
- l'indicateur de changement de mot de passe requis ;
- les actions autorisees.

Le formulaire de creation demande uniquement l'email et le role `ADMIN` ou `SUPPORT`. Le backend :

1. normalise et valide l'email ;
2. verifie son unicite dans Firebase et PostgreSQL ;
3. genere le mot de passe temporaire avec `SecureRandom` ;
4. cree l'utilisateur Firebase ;
5. cree le profil PostgreSQL avec `mustChangePassword=true` ;
6. attribue les claims necessaires si le systeme en utilise ;
7. retourne les identifiants temporaires une seule fois ;
8. supprime l'utilisateur Firebase si une etape persistante ulterieure echoue.

Le resultat est affiche dans une boite de dialogue non recuperable apres fermeture, avec une action de copie. Le mot de passe n'est conserve ni dans Pinia ni dans `localStorage`.

Le `SUPER_ADMIN` peut ensuite :

- passer un compte entre `ADMIN` et `SUPPORT` ;
- desactiver ou reactiver un compte ;
- reinitialiser son mot de passe avec une nouvelle valeur temporaire ;
- consulter les comptes et leurs statuts.

Chaque reinitialisation active `mustChangePassword`, revoque les sessions Firebase existantes et retourne le nouveau mot de passe une seule fois. La suppression definitive n'est pas necessaire pour cette premiere version ; la desactivation conserve l'audit et evite les recreations ambigues.

## Donnees et contrats API

Le modele administrateur expose explicitement `email` a la place de `login`. Une migration PostgreSQL ajoute ou renomme la colonne appropriee, impose une unicite insensible a la casse et preserve les identifiants internes UUID.

Les DTO principaux deviennent :

- profil : `id`, `email`, `role`, `status`, `mustChangePassword`, `permissionOverrides` ;
- creation : `email`, `role` ;
- identifiants temporaires : `email`, `temporaryPassword` ;
- modification : `role` et/ou `status`, sans valeur `SUPER_ADMIN` acceptee.

Les endpoints existants sont conserves autant que possible :

- `GET /admin/me` ;
- `POST /admin/me/change-password` ;
- `GET /admin/admins` ;
- `POST /admin/admins` ;
- `PATCH /admin/admins/{id}` ;
- `POST /admin/admins/{id}/reset-password`.

Le contrat de creation n'expose plus `generate`, un login libre ou un mot de passe choisi manuellement. La generation temporaire est toujours appliquee par le serveur.

## Erreurs metier

Les reponses suivent le format RFC 7807 avec des codes stables :

- `ADMIN_EMAIL_INVALID` ;
- `ADMIN_EMAIL_ALREADY_EXISTS` ;
- `ADMIN_ROLE_FORBIDDEN` ;
- `ADMIN_SUPER_ADMIN_IMMUTABLE` ;
- `ADMIN_NOT_FOUND` ;
- `ADMIN_DISABLED` ;
- `PASSWORD_CHANGE_REQUIRED` ;
- `FIREBASE_CREATE_FAILED` ;
- `FIREBASE_UPDATE_FAILED`.

Le frontend traduit ces codes en messages precis. Une erreur inattendue reste generique et n'affiche aucun detail Firebase ou interne.

## Migration et deploiement

Le deploiement suit cet ordre :

1. deployer la migration et les gardes backend ;
2. configurer les secrets de bootstrap dans l'environnement cible ;
3. executer une fois le bootstrap du compte racine ;
4. verifier la connexion et changer le mot de passe initial ;
5. retirer le secret de bootstrap et redemarrer le backend ;
6. deployer le frontend email et le panel administrateurs ;
7. desactiver les anciens comptes administrateurs techniques qui ne correspondent pas au nouveau modele.

L'etape 7 doit etre inventoriee avant execution pour ne pas supprimer de donnees ni de traces d'audit. Les comptes sont desactives, pas effaces.

## Strategie de tests

### Backend

- bootstrap autorise une creation unique et refuse les executions suivantes ;
- seul l'email racine peut etre `SUPER_ADMIN` ;
- creation `ADMIN` et `SUPPORT` avec mot de passe genere ;
- rejet de `SUPER_ADMIN` dans les API du panel ;
- rollback Firebase si PostgreSQL echoue ;
- refus de modifier ou desactiver le compte racine ;
- enforcement de `mustChangePassword` sur les routes admin ;
- changement de mot de passe, eviction du cache et audit ;
- desactivation et reinitialisation revoquent les sessions attendues ;
- permissions `ADMIN_MANAGE` appliquees a chaque endpoint de gestion.

### Frontend

- connexion avec email sans transformation ;
- restauration de session via Firebase puis `/admin/me` ;
- redirection obligatoire vers `/change-password` ;
- gestion differenciee des reponses `401`, `403` et `PASSWORD_CHANGE_REQUIRED` ;
- page Administrateurs visible uniquement pour le `SUPER_ADMIN` ;
- formulaire limite a `ADMIN` et `SUPPORT` ;
- affichage et copie ponctuels du mot de passe temporaire ;
- absence du mot de passe temporaire dans les stockages persistants ;
- liste, changement de role, desactivation, reactivation et reinitialisation.

### Integration et CI

- parcours E2E du bootstrap dans un environnement isole ;
- premiere connexion et changement obligatoire du mot de passe ;
- creation d'un `ADMIN` puis d'un `SUPPORT` ;
- verification qu'ils ne peuvent pas acceder a la gestion des administrateurs ;
- verification des permissions backend pour chaque role ;
- ajout d'une commande de typecheck explicite a la CI, en plus du lint, des tests unitaires et des tests E2E.

## Criteres d'acceptation

- Le compte racine peut se connecter avec son adresse email reelle.
- Aucun autre compte ne peut obtenir ou conserver le role `SUPER_ADMIN`.
- Le `SUPER_ADMIN` cree un `ADMIN` ou un `SUPPORT` depuis le panel sans choisir de mot de passe.
- Le mot de passe temporaire n'est visible qu'une fois et n'est jamais persiste en clair.
- Le compte cree ne peut rien faire avant d'avoir change ce mot de passe.
- Un compte desactive ne peut plus utiliser les API administrateur.
- Les changements de role et de statut sont effectifs cote backend, independamment du frontend.
- Le bootstrap est inactif apres le provisionnement initial.
- La CI couvre le typecheck et les principaux parcours d'authentification.
