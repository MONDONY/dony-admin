import type { AdminAlert } from '@/features/alerts/types/index'

/**
 * Fiches des alertes opérationnelles : ce que veut dire chaque code technique levé par le
 * back (`admin_alerts.type`) et ce que l'admin doit faire. Les types suffixés d'un
 * identifiant (`PAYOUT_HELD_<paymentId>`) sont reconnus par leur préfixe.
 */
export interface AlertGuide {
  /** Titre en clair, affiché à la place du code. */
  title: string
  category: string
  /** Ce qui s'est passé et pourquoi c'est important. */
  explanation: string
  /** Étapes à suivre, dans l'ordre. */
  actions: string[]
}

export interface AlertLink {
  label: string
  to: { path: string; query: Record<string, string> }
}

export interface AlertFact {
  key: string
  label: string
  value: string
}

const MONEY = 'Cohérence de l’argent'
const PAYOUT = 'Versement voyageur'
const MOBILE_MONEY = 'Mobile money'
const ESCROW = 'Séquestre'
const PARCEL = 'Colis'
const WALLET = 'Portefeuille'

const CLOSE_MONEY_ALERT =
  'Une fois corrigé, rouvrez cette alerte : « Lignes en faute actuellement » doit être vide. Résolvez-la alors avec une note décrivant la correction.'
const STRIPE_RECON = 'Rapprochement Stripe'

/** Étapes communes aux alertes de séquestre carte, corrigées depuis la section « Corriger ». */
const RESYNC_STEP = 'Cliquez sur « Resynchroniser avec Stripe » ci-dessous : Yadony relit le paiement chez Stripe et se met à jour (passage en séquestre, encaissement de la carte).'
const RELEASE_STEP = 'Si le colis est livré et que le paiement est en séquestre : « Forcer le versement au voyageur ».'
const EXPIRED_STEP = 'Si la resynchronisation répond « Autorisation carte expirée » : il n’y a plus rien à encaisser. Remboursez l’expéditeur ou recontactez-le pour qu’il paie à nouveau.'

const ASK_TECH = 'Si la cause n’est pas évidente, transmettez l’alerte (capture + identifiants) à l’équipe technique : ne corrigez pas la base à la main.'

/** Une fiche par règle de cohérence (MoneyInvariants côté back). */
const MONEY_INVARIANTS: Record<string, Omit<AlertGuide, 'category'>> = {
  'INV-01': {
    title: 'Solde de portefeuille différent de ses mouvements',
    explanation: 'Le solde d’un portefeuille ne correspond plus à la somme de ses mouvements : de l’argent est apparu ou a disparu sans écriture. Risque de perte ou de remboursement indu.',
    actions: [
      'Dans les lignes en faute, repérez l’utilisateur (user_id) et l’écart (drift = solde − total des mouvements).',
      'Ouvrez sa fiche puis Transactions › Portefeuilles pour comparer le solde et l’historique.',
      'Cherchez dans l’Audit l’opération qui a modifié le solde sans mouvement.',
      'Corrigez par un ajustement admin motivé (crédit ou débit du montant de l’écart) ou escaladez à l’équipe technique.',
    ],
  },
  'INV-02': {
    title: 'Historique de portefeuille incohérent',
    explanation: 'Un mouvement du portefeuille n’enchaîne pas sur le précédent (ancien solde + mouvement ≠ nouveau solde). Signe d’une écriture concurrente ou manuelle.',
    actions: [
      'Repérez la transaction et l’utilisateur concernés dans les lignes en faute.',
      'Vérifiez si l’alerte « Solde de portefeuille différent de ses mouvements » (INV-01) est aussi ouverte pour cet utilisateur.',
      ASK_TECH,
    ],
  },
  'INV-03': {
    title: 'Solde négatif ou mouvement mal signé',
    explanation: 'Un portefeuille est passé sous zéro, un mouvement a un signe incohérent avec son type, ou un ajustement admin n’a ni auteur ni motif.',
    actions: [
      'Lisez la colonne « anomaly » de chaque ligne en faute.',
      'SOLDE_NEGATIF / BALANCE_AFTER_NEGATIF : l’utilisateur a dépensé plus que son solde. Bloquez ses remboursements et régularisez par un ajustement admin.',
      'AJUSTEMENT_ADMIN_SANS_AUTEUR : retrouvez dans l’Audit l’admin qui a fait l’ajustement et faites compléter le motif.',
      'SIGNE_INCOHERENT_AVEC_TYPE : bug d’écriture, à transmettre à l’équipe technique.',
    ],
  },
  'INV-04': {
    title: 'Argent bloqué sur un colis annulé',
    explanation: 'L’expéditeur a payé, le colis n’aura pas lieu (annulé, refusé, expiré, no-show), mais l’argent est toujours en séquestre depuis plus d’une heure : il n’a été ni remboursé ni versé.',
    actions: [
      'Ouvrez le paiement (payment_id) et le colis (bid_id) depuis les lignes en faute.',
      'Si un litige est en cours (disputed = true), attendez sa décision.',
      'Sinon, remboursez l’expéditeur depuis la fiche paiement (bouton « Rembourser »).',
    ],
  },
  'INV-05': {
    title: 'Voyageur payé alors que le colis n’est pas livré',
    explanation: 'De l’argent a été versé au voyageur alors que le colis n’est pas marqué livré. C’est une perte possible pour Yadony ou l’expéditeur.',
    actions: [
      'Ouvrez le paiement et le colis depuis les lignes en faute.',
      'Si force_release_admin = true, un admin a forcé le versement : vérifiez son motif dans l’Audit. S’il est justifié, l’anomalie est attendue.',
      'Si gravite = CRITIQUE_BID_ECHOUE ou CRITIQUE_SANS_BID : le voyageur a été payé pour un colis qui n’a pas eu lieu. Contactez-le et récupérez les fonds (annulation du transfert Stripe / pawaPay).',
      'Si le colis a bien été livré, mettez son statut à jour (livraison non confirmée dans l’app).',
    ],
  },
  'INV-06': {
    title: 'Colis livré mais voyageur pas encore payé',
    explanation: 'Le colis est livré depuis plus de 2 h mais l’argent est toujours en séquestre : le voyageur attend son paiement.',
    actions: [
      'Ouvrez le paiement depuis les lignes en faute.',
      'Si le versement est retenu (payout_held_at renseigné) ou en litige (disputed = true), traitez d’abord la retenue ou le litige.',
      'Sinon, utilisez « Débloquer (force-release) » ou « Relancer le versement » sur la fiche paiement.',
    ],
  },
  'INV-07': {
    title: 'Montant, remboursement ou litige incohérent',
    explanation: 'Un paiement a un montant hors bornes, un remboursement non confirmé ou un litige bancaire mal reporté.',
    actions: [
      'Lisez la colonne « anomaly » de chaque ligne en faute et ouvrez le paiement.',
      'REFUND_STRIPE_NON_CONFIRME : vérifiez dans le dashboard Stripe que le remboursement est bien passé.',
      'CHARGEBACK_OUVERT_NON_MARQUE : voyez Transactions › Litiges bancaires.',
      'REMBOURSE_APRES_VERSEMENT / LITIGE_SUR_FONDS_VERSES : l’argent est sorti deux fois, contactez le voyageur pour récupérer les fonds.',
      'Autres codes (REFUND_HORS_BORNES, COMMISSION_SUPERIEURE_AU_MONTANT, RELEASED_SANS_DATE) : à transmettre à l’équipe technique.',
    ],
  },
  'INV-08': {
    title: 'Séquestre carte à risque',
    explanation: 'Un paiement carte n’est pas dans l’état attendu : autorisation bientôt expirée (Stripe l’annule à 7 jours), colis accepté sans débit, ou colis en cours sans fonds.',
    actions: [
      'Lisez la colonne « anomaly » et ouvrez le paiement.',
      'AUTORISATION_CARTE_PROCHE_EXPIRATION : agissez avant 7 jours (capture ou annulation), sinon l’argent est perdu.',
      'BID_ACCEPTE_NON_CAPTURE : vérifiez le PaymentIntent dans Stripe et prévenez l’équipe technique.',
      'BID_ENGAGE_SANS_FONDS : le colis est en cours sans paiement valide. Contactez l’expéditeur ou annulez le colis.',
    ],
  },
  'INV-09': {
    title: 'Transaction en double',
    explanation: 'Une même transaction (Stripe, pawaPay, recharge ou commission) est enregistrée plusieurs fois : un utilisateur a peut-être été débité ou crédité deux fois.',
    actions: [
      'Repérez la référence en double (ref) et son type (kind) dans les lignes en faute.',
      'Vérifiez dans Stripe ou pawaPay si l’argent a réellement bougé deux fois.',
      'Si oui, remboursez ou débitez le doublon par un ajustement admin motivé.',
      ASK_TECH,
    ],
  },
  'INV-10': {
    title: 'Commission incohérente',
    explanation: 'La commission Yadony d’un colis ne correspond pas à son statut ou au grand livre du portefeuille.',
    actions: [
      'Lisez la colonne « anomaly » et ouvrez le colis (bid_id).',
      'REMBOURSEMENT_ECHOUE / CHARGEE_SUR_BID_ANNULE : remboursez la commission (Transactions › Commissions).',
      'CASH_ACCEPTE_SANS_COMMISSION : la commission d’un colis payé en espèces n’a pas été prélevée, relancez-la ou contactez le voyageur.',
      'Autres codes : à transmettre à l’équipe technique.',
    ],
  },
  'INV-11': {
    title: 'Opération mobile money bloquée',
    explanation: 'Une opération pawaPay (dépôt, versement ou remboursement) est en attente depuis plus d’une heure : un client attend son argent.',
    actions: [
      'Repérez l’opération (id, kind, payment_id) dans les lignes en faute.',
      'Vérifiez son statut dans le dashboard pawaPay.',
      'Si elle est terminée chez pawaPay, la réconciliation automatique devrait la rattraper. Sinon, prévenez l’équipe technique.',
    ],
  },
  'INV-12': {
    title: 'Paiement mobile money incohérent',
    explanation: 'Un paiement mobile money ne correspond pas à ses opérations pawaPay : argent encaissé non appliqué, versé et remboursé, ou montant différent.',
    actions: [
      'Lisez la colonne « anomaly » et ouvrez le paiement.',
      'VERSE_ET_REMBOURSE / VERSEMENT_SUPERIEUR_AU_DEPOT : l’argent est sorti deux fois. Urgent, récupérez les fonds.',
      'DEPOT_ENCAISSE_NON_APPLIQUE_NI_RESTITUE : le client a payé mais rien ne s’est passé. Remboursez-le.',
      'FONDS_SANS_DEPOT_COMPLETE : le paiement est marqué payé sans dépôt réel, vérifiez dans pawaPay.',
      ASK_TECH,
    ],
  },
  'INV-13': {
    title: 'Recharge mobile money non créditée',
    explanation: 'Une recharge de portefeuille réussie chez pawaPay n’a pas été créditée (ou l’a été avec un mauvais montant) : le client a payé sans rien recevoir.',
    actions: [
      'Repérez l’utilisateur et le montant dans les lignes en faute.',
      'Vérifiez la recharge dans le dashboard pawaPay.',
      'Créditez le portefeuille par un ajustement admin motivé (référence de l’opération en motif), puis prévenez l’équipe technique.',
    ],
  },
  'INV-14': {
    title: 'Demande de remboursement wallet bloquée',
    explanation: 'Une demande de remboursement du portefeuille attend depuis trop longtemps (plus de 72 h en attente ou 24 h en cours) ou a des lignes incohérentes.',
    actions: [
      'Ouvrez Transactions › Remboursements wallet.',
      'Traitez la demande concernée (request_id) : validez-la ou relancez les lignes en échec.',
      'Prévenez l’utilisateur si le remboursement est retardé.',
    ],
  },
  'INV-15': {
    title: 'Recharge remboursée au-delà de son montant',
    explanation: 'Les remboursements d’une recharge dépassent le montant rechargé : l’utilisateur récupère plus que ce qu’il a payé.',
    actions: [
      'Bloquez les remboursements de l’utilisateur concerné.',
      'Comparez topup_amount et refund_items_total dans les lignes en faute.',
      ASK_TECH,
    ],
  },
  'INV-16': {
    title: 'Notification Stripe non traitée',
    explanation: 'Stripe nous a envoyé un évènement (paiement, remboursement, litige, compte voyageur…) que le serveur n’a pas réussi à traiter. L’état d’un paiement dans Yadony peut être faux.',
    actions: [
      'Regardez event_type (quel évènement) et status : DEAD_LETTER = abandonné après plusieurs essais, RECEIVED = en retard.',
      'Vérifiez dans le dashboard Stripe › Développeurs › Évènements ce que contenait l’évènement.',
      'Demandez à l’équipe technique de le rejouer, puis vérifiez que le paiement concerné est à jour.',
    ],
  },
  'INV-17': {
    title: 'Devise incohérente',
    explanation: 'Un paiement, une opération mobile money ou une commission n’est pas dans la même devise que son colis : les montants sont faux.',
    actions: [
      'Repérez l’élément (kind, ref_id) et les deux devises dans les lignes en faute.',
      ASK_TECH,
    ],
  },
}

interface PrefixGuide extends AlertGuide { prefix: string }

/** Fiches par préfixe (le plus long qui correspond l'emporte). */
const PREFIX_GUIDES: PrefixGuide[] = [
  {
    prefix: 'ESCROW_J48_TIMEOUT',
    title: 'Paiement en séquestre depuis plus de 48 h',
    category: ESCROW,
    explanation: 'L’argent de l’expéditeur est bloqué chez Yadony depuis plus de 48 h sans avoir été versé au voyageur. C’est normal si le colis est encore en route, anormal s’il est livré, annulé ou abandonné.',
    actions: [
      RESYNC_STEP,
      RELEASE_STEP,
      EXPIRED_STEP,
      'Colis annulé, refusé ou no-show : remboursez l’expéditeur depuis la fiche paiement (« Voir le paiement »).',
      'Colis encore en route : rien à faire, résolvez l’alerte avec la note « colis en cours ».',
    ],
  },
  {
    prefix: 'RECON_STRIPE_',
    title: 'Écart de rapprochement Stripe',
    category: STRIPE_RECON,
    explanation: 'Le contrôle quotidien a trouvé un paiement carte dont l’état chez Yadony ne correspond pas à Stripe. AUTORISE_NON_ENREGISTRE : la carte est autorisée chez Stripe mais le paiement est resté « en attente » chez Yadony (notification Stripe manquée). SEQUESTRE_NON_CAPTURE : le paiement est en séquestre mais la carte n’a jamais été encaissée ; l’autorisation expire environ 7 jours après le paiement, et le voyageur ne pourra pas être payé.',
    actions: [
      RESYNC_STEP + ' L’alerte se résout seule si l’écart a disparu.',
      RELEASE_STEP,
      EXPIRED_STEP,
      'Autre écart (montant différent, paiement inconnu de Stripe) : transmettez l’alerte à l’équipe technique.',
    ],
  },
  {
    prefix: 'ESCROW_CAPTURE_FAILED_',
    title: 'Encaissement du séquestre impossible',
    category: ESCROW,
    explanation: 'Au moment de payer le voyageur, Yadony n’a pas pu encaisser la carte de l’expéditeur (autorisation expirée, montant différent ou Stripe indisponible). Aucun versement n’est parti : le paiement reste en séquestre.',
    actions: [
      RESYNC_STEP + ' Si Stripe était seulement indisponible, cela suffit : l’alerte se résout seule une fois la carte encaissée.',
      RELEASE_STEP,
      EXPIRED_STEP,
      'Montant différent (« Le montant ou la devise autorisés… ») : transmettez l’alerte à l’équipe technique.',
    ],
  },
  {
    prefix: 'RETURN_DEADLINE_EXPIRED',
    title: 'Colis non rendu après annulation',
    category: PARCEL,
    explanation: 'Le colis a été annulé après avoir été remis au voyageur, qui avait 3 jours pour le rendre à l’expéditeur. L’échéance est dépassée et le retour n’a pas été confirmé.',
    actions: [
      'Ouvrez le colis et contactez le voyageur et l’expéditeur (Support).',
      'Si le colis a été rendu, faites confirmer le retour dans l’app.',
      'Si le voyageur ne répond pas, suspendez ses publications depuis sa fiche utilisateur.',
      'Si le colis est perdu, ouvrez un incident.',
    ],
  },
  {
    prefix: 'DELIVERY_PAYMENT_NOT_IN_ESCROW_',
    title: 'Colis livré sans séquestre',
    category: ESCROW,
    explanation: 'Le colis est livré mais son paiement n’est jamais passé en séquestre (resté « en attente ») : le voyageur ne sera pas payé automatiquement, et l’autorisation carte expire 7 jours après le paiement.',
    actions: [
      'Ouvrez le paiement et le colis.',
      'Dans le dashboard Stripe, vérifiez l’état du PaymentIntent : l’expéditeur a-t-il bien été autorisé ou débité ? Agissez avant J+7.',
      'Fonds autorisés ou débités : capturez-les si besoin puis payez le voyageur (« Débloquer (force-release) » avec une dérogation motivée), ou faites-le faire par l’équipe technique.',
      'Aucun fonds : contactez l’expéditeur pour régulariser le paiement, ou remboursez ce qui a été encaissé.',
    ],
  },
  {
    prefix: 'PARTIAL_REFUND_HOLD_',
    title: 'Versement bloqué : paiement déjà partiellement remboursé',
    category: PAYOUT,
    explanation: 'Le colis est livré mais une partie du paiement a déjà été remboursée à l’expéditeur. Le versement automatique est bloqué : il faut décider combien verser au voyageur.',
    actions: [
      'Ouvrez le paiement : comparez le montant et le montant remboursé.',
      'Décidez du montant dû au voyageur (en général : montant − remboursé − commission).',
      'Payez-le via « Débloquer (force-release) » avec une dérogation motivée, ou remboursez le solde à l’expéditeur.',
    ],
  },
  {
    prefix: 'PAYOUT_HELD_',
    title: 'Versement retenu : voyageur gelé',
    category: PAYOUT,
    explanation: 'Le colis est livré mais le voyageur est gelé (sanction, fraude suspectée, litige…). Son argent reste chez Yadony et ne partira pas tout seul.',
    actions: [
      'Ouvrez la fiche du voyageur et lisez le motif du gel.',
      'Si le gel est levé ou injustifié : « Relancer le versement » sur la fiche paiement.',
      'Si le gel est confirmé : remboursez l’expéditeur ou payez par dérogation motivée.',
    ],
  },
  {
    prefix: 'PAYOUT_HOLD_LIFTED',
    title: 'Retenue de versement levée',
    category: PAYOUT,
    explanation: 'La retenue sur les versements d’un voyageur a été levée : ses paiements en attente peuvent repartir.',
    actions: [
      'Vérifiez dans Transactions (filtre « retenus ») que ses versements sont bien repartis.',
      'Relancez manuellement ceux qui seraient restés bloqués.',
    ],
  },
  {
    prefix: 'PAYOUT_STRIPE_UNUSABLE_',
    title: 'Compte bancaire du voyageur inutilisable',
    category: PAYOUT,
    explanation: 'Le colis est livré mais le compte Stripe du voyageur est désactivé ou rejeté : Stripe refusera tout virement. L’argent reste en séquestre.',
    actions: [
      'Ouvrez la fiche du voyageur.',
      'Demandez-lui de compléter ou corriger ses informations bancaires dans l’app.',
      'Une fois le compte actif, utilisez « Relancer le versement » sur la fiche paiement.',
    ],
  },
  {
    prefix: 'COMMISSION_3DS_UNCONFIRMED_',
    title: 'Commission payée mais acceptation non finalisée',
    category: 'Commission',
    explanation: 'L’expéditeur a validé le paiement de la commission (3D Secure) mais l’app n’a jamais confirmé l’acceptation du colis : il a été débité pour un colis qui n’avance pas.',
    actions: [
      'Ouvrez le colis et contactez l’expéditeur.',
      'Si le colis doit avoir lieu, faites finaliser l’acceptation dans l’app.',
      'Sinon, remboursez la commission dans Stripe (PaymentIntent indiqué ci-dessous).',
    ],
  },
  {
    prefix: 'PAWAPAY_REFUND_PAYOUT_',
    title: 'Remboursement bloqué : voyageur déjà payé',
    category: MOBILE_MONEY,
    explanation: 'Un remboursement a été demandé alors qu’un versement mobile money au voyageur existe déjà. Rembourser ferait sortir l’argent deux fois : il a été bloqué.',
    actions: [
      'Ouvrez le paiement et vérifiez l’opération de versement dans pawaPay.',
      'Si le versement a réussi, ne remboursez pas : voyez avec le voyageur.',
      'Si le versement a échoué, prévenez l’équipe technique avant de relancer le remboursement.',
    ],
  },
  {
    prefix: 'PAWAPAY_REFUND_NO_DEP_',
    title: 'Remboursement impossible : paiement introuvable',
    category: MOBILE_MONEY,
    explanation: 'Un remboursement mobile money a été demandé mais aucun dépôt réussi n’existe pour ce paiement : le système ne sait pas à qui rendre l’argent.',
    actions: [
      'Ouvrez le paiement et cherchez le dépôt de l’expéditeur dans le dashboard pawaPay.',
      'S’il a vraiment payé, remboursez-le manuellement depuis pawaPay et notez la référence.',
    ],
  },
  {
    prefix: 'PAWAPAY_REFUND_REJECTED_',
    title: 'Remboursement mobile money refusé',
    category: MOBILE_MONEY,
    explanation: 'pawaPay a refusé le remboursement de l’expéditeur (code d’échec ci-dessous) : il n’a pas récupéré son argent.',
    actions: [
      'Lisez le code d’échec (numéro invalide, opérateur indisponible…).',
      'Corrigez la cause puis « Relancer le remboursement » sur la fiche paiement.',
      'Sinon, remboursez manuellement depuis pawaPay.',
    ],
  },
  {
    prefix: 'MM_EXP_NO_PAYMENT_',
    title: 'Colis en attente de paiement sans paiement mobile money',
    category: MOBILE_MONEY,
    explanation: 'Un colis attend un paiement mobile money mais aucun paiement n’a été créé : il restera bloqué.',
    actions: ['Ouvrez le colis et vérifiez avec l’expéditeur s’il a payé.', ASK_TECH],
  },
  {
    prefix: 'MM_EXP_DEPOSIT_DONE_',
    title: 'Client débité mais paiement non enregistré',
    category: MOBILE_MONEY,
    explanation: 'pawaPay confirme que l’expéditeur a payé, mais le paiement Yadony est resté « en attente » et la réparation automatique a échoué.',
    actions: [
      'Ouvrez le colis et vérifiez le dépôt dans pawaPay.',
      'Demandez à l’équipe technique d’appliquer le paiement, ou remboursez l’expéditeur si le colis n’aura pas lieu.',
    ],
  },
  {
    prefix: 'NEGO_DEPOSIT_DONE_',
    title: 'Dépôt de négociation non appliqué',
    category: MOBILE_MONEY,
    explanation: 'pawaPay confirme un dépôt sur une négociation, mais la réparation automatique a échoué : le client a payé sans que la négociation avance.',
    actions: ['Vérifiez le dépôt dans pawaPay.', 'Demandez à l’équipe technique d’appliquer le dépôt, ou remboursez le client.'],
  },
  {
    prefix: 'MM_PAYOUT_ORPHAN_',
    title: 'Versement mobile money repris',
    category: MOBILE_MONEY,
    explanation: 'Un versement mobile money déjà en cours a été retrouvé et repris au lieu d’en créer un second. À surveiller pour s’assurer qu’il aboutit.',
    actions: [
      'Ouvrez Transactions › Mobile money et vérifiez que l’opération se termine.',
      'Si elle reste bloquée plus d’une heure, voyez avec l’équipe technique.',
    ],
  },
  {
    prefix: 'PAWAPAY_UNKNOWN_OP_',
    title: 'Opération introuvable chez pawaPay',
    category: MOBILE_MONEY,
    explanation: 'Une opération mobile money enregistrée chez Yadony est introuvable chez pawaPay depuis plus d’une heure : elle n’est peut-être jamais partie.',
    actions: [
      'Cherchez l’opération dans le dashboard pawaPay.',
      'Si elle n’existe pas, relancez le versement ou le remboursement depuis la fiche paiement.',
      ASK_TECH,
    ],
  },
  {
    prefix: 'PAWAPAY_BALANCE_LOW_',
    title: 'Solde pawaPay bas',
    category: MOBILE_MONEY,
    explanation: 'Le solde du compte pawaPay dans cette devise est sous le seuil : les prochains versements et remboursements mobile money vont échouer.',
    actions: ['Approvisionnez le compte pawaPay dans la devise indiquée.', 'Vérifiez ensuite les versements en échec et relancez-les.'],
  },
  {
    prefix: 'wallet-alloc-',
    title: 'Historique de portefeuille illisible',
    category: WALLET,
    explanation: 'Le rejeu des mouvements du portefeuille ne retombe pas sur son solde : le remboursement en libre-service a été bloqué pour cet utilisateur.',
    actions: ['Ouvrez la fiche de l’utilisateur.', 'Vérifiez si une alerte de cohérence (INV-01) est ouverte pour lui.', ASK_TECH],
  },
]

const DEFAULT_GUIDE: Omit<AlertGuide, 'title'> = {
  category: 'Autre',
  explanation: 'Alerte technique sans fiche détaillée. Lisez le détail et les données ci-dessous.',
  actions: [
    'Ouvrez les éléments liés (paiement, colis, utilisateur) pour comprendre la situation.',
    ASK_TECH,
  ],
}

export const MONEY_INVARIANT_PREFIX = 'MONEY_INVARIANT_'

export function isMoneyInvariant(type: string): boolean {
  return type.startsWith(MONEY_INVARIANT_PREFIX)
}

/** Code lisible quand aucune fiche n'existe : `PAWAPAY_FOO_<uuid>` → « Pawapay foo ». */
function humanize(type: string): string {
  const base = type.replace(/[_-]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '')
  const words = base.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Alerte'
}

export function alertGuide(type: string): AlertGuide {
  if (isMoneyInvariant(type)) {
    const code = type.slice(MONEY_INVARIANT_PREFIX.length)
    const inv = MONEY_INVARIANTS[code]
    if (inv) return { ...inv, category: `${MONEY} · ${code}`, actions: [...inv.actions, CLOSE_MONEY_ALERT] }
    return { ...DEFAULT_GUIDE, title: `Règle de cohérence ${code}`, category: MONEY }
  }
  const match = PREFIX_GUIDES
    .filter(g => type.startsWith(g.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  if (match) return { title: match.title, category: match.category, explanation: match.explanation, actions: match.actions }
  return { ...DEFAULT_GUIDE, title: humanize(type) }
}

const LABELS: Record<string, string> = {
  paymentId: 'Paiement',
  bidId: 'Colis',
  travelerId: 'Voyageur',
  senderId: 'Expéditeur',
  userId: 'Utilisateur',
  threadId: 'Négociation',
  operationId: 'Opération pawaPay',
  paymentIntentId: 'PaymentIntent Stripe',
  amount: 'Montant',
  refundedAmount: 'Déjà remboursé',
  currency: 'Devise',
  balance: 'Solde',
  threshold: 'Seuil',
  payoutStatus: 'Statut du versement',
  failureCode: 'Code d’échec',
  kind: 'Type d’opération',
  source: 'Origine',
  reason: 'Motif',
  stripeAccountStatus: 'Statut du compte Stripe',
  returnDeadline: 'Échéance de retour',
  invariant: 'Règle',
  regle: 'Ce que vérifie la règle',
  gravite: 'Gravité de la règle',
  lignesEnFaute: 'Lignes en faute (à la levée)',
  passagePrecedent: 'Lignes au contrôle précédent',
  error: 'Erreur',
  prestataire: 'Prestataire',
  reference: 'Référence',
  ecart: 'Écart constaté',
  detail: 'Détail',
}

/** Clés rendues ailleurs que dans la liste des données. */
const HIDDEN_FACTS = new Set(['exemples'])

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Données de l'alerte (payload), avec un libellé en clair pour les clés connues. */
export function alertFacts(alert: AdminAlert): AlertFact[] {
  return Object.entries(alert.payload ?? {})
    .filter(([key]) => !HIDDEN_FACTS.has(key))
    .map(([key, value]) => ({ key, label: LABELS[key] ?? key, value: display(value) }))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lien vers la fiche de l'entité désignée par une clé (payload camelCase ou colonne SQL snake_case). */
export function entityLink(key: string, value: unknown): AlertLink | null {
  if (typeof value !== 'string' || !UUID.test(value)) return null
  switch (key) {
    case 'paymentId':
    case 'payment_id':
      return { label: 'Ouvrir le paiement', to: { path: '/transactions', query: { open: value } } }
    case 'bidId':
    case 'bid_id':
      return { label: 'Ouvrir le colis', to: { path: '/colis', query: { open: value } } }
    case 'travelerId':
      return { label: 'Fiche du voyageur', to: { path: '/users', query: { query: value, open: value } } }
    case 'senderId':
      return { label: 'Fiche de l’expéditeur', to: { path: '/users', query: { query: value, open: value } } }
    case 'userId':
    case 'user_id':
    case 'tx_user_id':
      return { label: 'Fiche de l’utilisateur', to: { path: '/users', query: { query: value, open: value } } }
    default:
      return null
  }
}

/** Raccourcis vers les fiches liées à l'alerte, sans doublon. */
export function alertLinks(alert: AdminAlert): AlertLink[] {
  const links: AlertLink[] = []
  const seen = new Set<string>()
  for (const [key, value] of Object.entries(alert.payload ?? {})) {
    const link = entityLink(key, value)
    if (!link) continue
    const id = `${link.to.path}:${String(value)}`
    if (seen.has(id)) continue
    seen.add(id)
    links.push(link)
  }
  if (alert.type.startsWith('INV-14', MONEY_INVARIANT_PREFIX.length)) {
    links.push({ label: 'Remboursements wallet', to: { path: '/transactions', query: { tab: 'wallet-refunds' } } })
  }
  if (alert.type.startsWith('INV-11', MONEY_INVARIANT_PREFIX.length) || alert.type.startsWith('MM_PAYOUT_ORPHAN_')) {
    links.push({ label: 'Opérations mobile money', to: { path: '/transactions', query: { tab: 'mobile-money' } } })
  }
  return links
}

/** Une ligne de résumé pour le tableau : la phrase du back, sinon reconstruite depuis le payload. */
export function alertSummary(alert: AdminAlert): string {
  if (alert.detail) return alert.detail
  const p = alert.payload ?? {}
  if (isMoneyInvariant(alert.type) && p.lignesEnFaute !== undefined) {
    return `${display(p.lignesEnFaute)} ligne(s) en faute au moment de l’alerte`
  }
  if (p.amount !== undefined) return `Montant : ${display(p.amount)}${p.currency ? ` ${display(p.currency)}` : ''}`
  if (p.returnDeadline !== undefined) return `Échéance de retour : ${display(p.returnDeadline)}`
  return alertGuide(alert.type).explanation
}

/** Lignes en faute recopiées dans l'alerte au moment de sa levée (MONEY_INVARIANT_*). */
export function alertSampleRows(alert: AdminAlert): Record<string, unknown>[] {
  const rows = alert.payload?.exemples
  return Array.isArray(rows) ? rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : []
}
