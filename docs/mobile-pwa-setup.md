# App admin mobile (`/siragbe/m/`) : mise en service

Section mobile de la console, installable sur l'écran d'accueil (PWA), avec notifications push et
verrou après 30 minutes d'inactivité. Ce document liste ce que le propriétaire doit régler dans
Firebase, Google Cloud et GitHub, pour la recette puis pour la production. Aucune valeur secrète
ici : la clé VAPID publique et le numéro de projet sont des valeurs publiques, livrées au navigateur.

Sans les deux variables ci-dessous, l'app mobile fonctionne mais le bouton « Activer les
notifications » n'apparaît pas (push considéré comme indisponible).

## 1. Firebase : clé VAPID et numéro de projet (à faire dans CHAQUE projet)

Un projet Firebase pour la recette, un pour la production : chaque projet a sa propre paire de clés.

1. Console Firebase > projet > **Paramètres du projet** > onglet **Cloud Messaging**.
2. Section **Configuration Web** > **Certificats push Web** > **Générer une paire de clés**.
3. Copier la **clé publique** affichée (longue chaîne qui commence souvent par `B`). C'est la
   valeur de `NUXT_PUBLIC_FIREBASE_VAPID_KEY`. La clé privée reste chez Firebase, ne jamais la copier.
4. Même onglet (ou **Paramètres du projet** > **Général**) : **ID de l'expéditeur** = **numéro du
   projet** (suite de chiffres). C'est la valeur de `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.
   Sans elle, l'app la reprend dans l'appId (`1:<numéro>:web:...`) ; la renseigner reste plus sûr.

## 2. GitHub : deux variables par environnement

Le workflow `Deploy VPS` écrit le `.env` du conteneur à partir des **variables** (pas des secrets)
de l'environnement visé (`staging` ou `production`).

Dépôt > **Settings** > **Environments** > `staging` puis `production` > **Environment variables** >
**Add variable** :

| Nom | Valeur |
|-----|--------|
| `NUXT_PUBLIC_FIREBASE_VAPID_KEY` | clé publique VAPID du projet Firebase de cet environnement |
| `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | numéro du projet Firebase de cet environnement |

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
- [ ] 30 minutes sans toucher l'app : page de verrouillage, « Votre session a été fermée après
      30 minutes d'inactivité. » ; reconnexion (mot de passe puis code) : retour à la même page.
- [ ] App fermée (ou tuée) plus de 30 minutes puis rouverte : page de verrouillage, aucun contenu
      visible avant la reconnexion.
- [ ] Toucher une notification après plus de 30 minutes : page de verrouillage, puis l'écran de
      la notification après reconnexion.
- [ ] Ouvrir un lien `/m/...` sans être connecté : page de verrouillage (« Connectez-vous pour
      continuer. »), jamais la page de connexion du bureau ; après connexion, la page demandée.
- [ ] Réglages > Désactiver les notifications : plus aucun push sur cet appareil.
- [ ] Déconnexion explicite : plus aucun push sur cet appareil.
- [ ] Console de bureau : pas d'expiration après 30 minutes, connexion inchangée.

## Comportement connu

- **Un onglet `/m` resté inactif déconnecte aussi la console de bureau du même navigateur.** La
  session Firebase est partagée par origine (même hôte) : le verrou de l'app mobile ferme la
  session de tous les onglets de ce navigateur. Sur iPhone, l'app installée garde son propre
  stockage, distinct de Safari.
- Ouvrir `/m` depuis la console de bureau plus de 30 minutes après la dernière activité dans
  l'app mobile (ou la dernière connexion) demande de se reconnecter : l'inactivité mesurée est
  celle de l'app mobile, pas celle de la console.
- Au démarrage, l'expiration des 30 minutes ne s'applique qu'aux pages `/m`. Si le stockage du
  navigateur est illisible (navigation privée stricte), la session est restaurée comme avant ;
  le minuteur d'inactivité de l'app reste actif.
