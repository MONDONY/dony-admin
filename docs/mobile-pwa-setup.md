# App admin mobile (`/siragbe/m/`) : mise en service

Section mobile de la console, installable sur l'écran d'accueil (PWA), avec notifications push.
La session de l'admin (console de bureau ET app mobile) se ferme après une durée d'inactivité
réglable, 30 minutes par défaut (section 6). Ce document liste ce que le propriétaire doit régler
dans Firebase, Google Cloud et GitHub, pour la recette puis pour la production. Aucune valeur
secrète ici : la clé VAPID publique et le numéro de projet sont des valeurs publiques, livrées au
navigateur.

Seule la clé VAPID est indispensable : sans elle, l'app mobile fonctionne mais le bouton « Activer
les notifications » n'apparaît pas (push considéré comme indisponible). Le numéro de projet
(sender id), s'il manque, est repris de l'appId ; le renseigner reste plus sûr.

## 1. Firebase : clé VAPID et numéro de projet (à faire dans CHAQUE projet)

Un projet Firebase pour la recette, un pour la production : chaque projet a sa propre paire de clés.

1. Console Firebase > projet > **Paramètres du projet** > onglet **Cloud Messaging**.
2. Section **Configuration Web** > **Certificats push Web** > **Générer une paire de clés**.
3. Copier la **clé publique** affichée (longue chaîne qui commence souvent par `B`). C'est la
   valeur de `NUXT_PUBLIC_FIREBASE_VAPID_KEY`. La clé privée reste chez Firebase, ne jamais la copier.
4. Même onglet (ou **Paramètres du projet** > **Général**) : **ID de l'expéditeur** = **numéro du
   projet** (suite de chiffres). C'est la valeur de `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.
   Sans elle, l'app la reprend dans l'appId (`1:<numéro>:web:...`) ; la renseigner reste plus sûr.

## 2. GitHub : variables par environnement

Le workflow `Deploy VPS` écrit le `.env` du conteneur à partir des **variables** (pas des secrets)
de l'environnement visé (`staging` ou `production`).

Dépôt > **Settings** > **Environments** > `staging` puis `production` > **Environment variables** >
**Add variable** :

| Nom | Valeur |
|-----|--------|
| `NUXT_PUBLIC_FIREBASE_VAPID_KEY` | clé publique VAPID du projet Firebase de cet environnement |
| `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | numéro du projet Firebase de cet environnement |
| `NUXT_PUBLIC_IDLE_LOCK_MINUTES` | facultative : durée d'inactivité avant la fermeture de session, en minutes (section 6) |

Les valeurs sont lues au démarrage du conteneur : relancer un déploiement (ou attendre le prochain)
pour qu'elles prennent effet. La production ne se déploie qu'à la main, par le propriétaire.

## 3. Google Cloud : restrictions de la clé d'API du navigateur

Google Cloud console > projet > **API et services** > **Identifiants** > clé « Browser key »
(celle de `NUXT_PUBLIC_FIREBASE_API_KEY`).

- **Restrictions relatives aux API** : en plus des API déjà autorisées pour la connexion
  (Identity Toolkit API, Token Service API), autoriser :
  - **Firebase Installations API** ;
  - **FCM Registration API**.

  Sans elles, l'activation échoue (« Notifications non configurées sur ce serveur »).
- **Restrictions relatives aux applications** > **Sites Web (référents HTTP)** : l'hôte de l'admin
  de recette et celui de production doivent figurer, par exemple
  `https://<hôte de l'admin de recette>/*` et `https://<hôte de l'admin de production>/*`.

## 4. Installer l'app sur iPhone

Prérequis : **iOS 16.4 ou plus récent** (les notifications web n'existent pas avant), Safari.

1. Dans Safari, ouvrir une page de l'app mobile **en étant connecté**, par exemple
   `https://<hôte de l'admin>/siragbe/m/` (le manifest n'est déclaré que sur les pages `/m`).
2. Bouton **Partager** > **Sur l'écran d'accueil** > **Ajouter**.
3. Ouvrir l'app **depuis l'icône** de l'écran d'accueil (pas depuis Safari).
4. Se connecter (mot de passe puis code), toucher **Activer les notifications**, puis **Autoriser**.
5. En haut de l'écran : « Notifications activées ». Pour couper : **Réglages** > **Désactiver les
   notifications**.

Sur Android (Chrome) : menu **⋮** > **Installer l'application** (ou **Ajouter à l'écran
d'accueil**) depuis une page `/m`, puis même parcours.

## 5. Recette

À faire en recette, sur un iPhone installé et un Android installé.

- [ ] Installation depuis une page `/m` connectée : l'icône apparaît, l'app s'ouvre sans barre Safari.
- [ ] « Activer les notifications » : demande d'autorisation, puis « Notifications activées ».
- [ ] Push reçu app fermée ; le toucher ouvre le bon écran (alerte, ticket).
- [ ] Deux alertes du même type à la suite : les deux sonnent (la seconde ne remplace pas la
      première en silence).
- [ ] 30 minutes (ou la durée réglée) sans toucher l'app : page de verrouillage, « Votre session a
      été fermée après 30 minutes d'inactivité. » ; reconnexion (mot de passe puis code) : retour à
      la même page.
- [ ] App fermée (ou tuée) plus de 30 minutes puis rouverte : page de verrouillage, aucun contenu
      visible avant la reconnexion.
- [ ] Toucher une notification après plus de 30 minutes : page de verrouillage, puis l'écran de
      la notification après reconnexion.
- [ ] Ouvrir un lien `/m/...` sans être connecté : page de verrouillage (« Connectez-vous pour
      continuer. »), jamais la page de connexion du bureau ; après connexion, la page demandée.
- [ ] Réglages > Désactiver les notifications : plus aucun push sur cet appareil.
- [ ] Déconnexion explicite : plus aucun push sur cet appareil.
- [ ] Console de bureau, 29 minutes sans rien toucher : bandeau « Votre session va se fermer pour
      inactivité » ; « Rester connecté » le ferme et le délai repart.
- [ ] Console de bureau, 30 minutes sans rien toucher : page de connexion, « Session fermée après
      30 minutes d'inactivité. Connectez-vous pour continuer. » ; après la connexion, retour à la
      page quittée (filtres compris).
- [ ] Android : app installée utilisée, puis tuée (balayée) ; plus de 30 minutes après, ouvrir
      Chrome sur `https://<hôte de l'admin>/siragbe/` : page de connexion, aucun contenu visible.
- [ ] Avec `NUXT_PUBLIC_IDLE_LOCK_MINUTES` réglée (par exemple 10) : bandeau et fermeture à la
      nouvelle durée, texte des pages de connexion et de verrouillage à cette durée.

## 6. Expiration de session pour inactivité (bureau et mobile)

Sans entrée de l'utilisateur pendant la durée réglée, la session est fermée : déconnexion
Firebase (les notifications push continuent d'arriver), puis reconnexion obligatoire (mot de
passe, puis code). Pourquoi aussi sur le bureau : sur Android, l'app installée partage son stockage
avec Chrome ; si elle était tuée avant la fin de son minuteur, n'importe qui ouvrant Chrome sur
`/siragbe/` retrouvait la console sans mot de passe, messages compris.

- **Durée** : variable `NUXT_PUBLIC_IDLE_LOCK_MINUTES` (en minutes), facultative. Vide, absente ou
  invalide : 30 minutes. Bornée de 5 minutes à 720 minutes (12 heures) : une valeur plus petite
  vaut 5, une plus grande vaut 720. L'expiration ne peut pas être désactivée. Effet au prochain
  déploiement (valeur lue au démarrage du conteneur).
- **Console de bureau** : un bandeau « Votre session va se fermer pour inactivité » apparaît 60
  secondes avant (même avec la durée minimale de 5 minutes) ; « Rester connecté », ou toute
  autre action, le ferme. À l'échéance : page de connexion avec « Session fermée après N minutes
  d'inactivité. Connectez-vous pour continuer. », puis retour à la page quittée.
- **App mobile (`/m`)** : page de verrouillage, comme avant, sans bandeau.
- **Au démarrage** (app relancée, onglet rouvert, Chrome ouvert sur la console) : sur toutes les
  pages, une dernière activité plus ancienne que la durée réglée ferme la session avant
  l'affichage de toute page. Une dernière activité enregistrée dans le futur (horloge reculée de
  plus de 5 minutes) compte comme périmée.

### Ce qui compte comme activité

Uniquement les entrées de l'utilisateur dans une page de l'admin : clic ou toucher, touche du
clavier (saisie comprise), collage, molette, défilement (y compris dans une liste ou un panneau
qui défile seul). **Un envoi de fichier ou un export en cours n'est pas détecté** : un long export
lancé puis laissé sans toucher à rien peut voir la session se fermer avant la fin. Les pages
`/change-password` et `/mfa-setup` n'ont pas de minuteur et le temps passé dessus ne compte pas
comme activité : y rester plus longtemps que la durée réglée, puis ouvrir la console, demande de
se reconnecter.

### Comportement connu

- **L'activité est partagée entre les onglets d'un même navigateur.** Une action dans un onglet
  (bureau ou `/m`) garde ouverts tous les onglets de l'admin de ce navigateur ; un bandeau
  affiché dans un onglet se ferme si l'on agit dans un autre. À l'inverse, à l'échéance, la
  session Firebase étant partagée par origine (même hôte), tous les onglets sont déconnectés. Sur
  iPhone, l'app installée garde son propre stockage, distinct de Safari.
- **Premier chargement après la mise en service de cette version** : une session dont la dernière
  activité enregistrée (par exemple la dernière connexion) date de plus de 30 minutes est fermée
  une fois ; se reconnecter suffit. Sans aucune activité enregistrée, la session passe et la
  console commence à mesurer l'inactivité.
- Un onglet de bureau caché (autre onglet au premier plan, fenêtre réduite) se ferme à l'échéance ;
  l'app mobile en arrière-plan, elle, vérifie au retour au premier plan.
- Si le stockage du navigateur est illisible (navigation privée stricte), aucune expiration au
  démarrage : la session est restaurée, les minuteurs des pages restent actifs. Stockage plein :
  l'activité est gardée en mémoire, sans boucle de reconnexion.
