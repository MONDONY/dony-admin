import type { AdminDeletionReasonCode } from '@/features/users/types/index'

/**
 * Traduction des codes de constat émis par le back.
 *
 * Les libellés vivent ici et non côté serveur : ajouter un contributeur ne doit pas obliger
 * à redéployer le back pour un texte. `detail` dit la conséquence, pas le constat — c'est ce
 * dont l'administrateur a besoin pour décider.
 */
const LABELS: Record<string, { title: string; detail: string }> = {
  ACTIVE_ESCROW: {
    title: 'Paiement en séquestre',
    detail: 'De l\'argent est bloqué chez Stripe et n\'a pas encore été versé. Libérez ou remboursez le paiement avant de supprimer.',
  },
  WALLET_POSITIVE_BALANCE: {
    title: 'Portefeuille créditeur',
    detail: 'Le compte détient encore de l\'argent. Déclenchez le remboursement avant de supprimer.',
  },
  WALLET_REFUND_PENDING: {
    title: 'Remboursement en attente',
    detail: 'Une demande de remboursement du portefeuille n\'est pas soldée.',
  },
  PARCEL_IN_TRANSIT: {
    title: 'Colis en cours de transport',
    detail: 'Une remise est attendue physiquement. Les personnes concernées doivent être prévenues.',
  },
  PENDING_BID: {
    title: 'Offre en attente de réponse',
    detail: 'Une décision est attendue de part ou d\'autre. Ces offres seront annulées.',
  },
  UPCOMING_ANNOUNCEMENT: {
    title: 'Annonce de trajet à venir',
    detail: 'Ces annonces seront annulées et retirées de la recherche.',
  },
  OPEN_DISPUTE: {
    title: 'Litige ouvert',
    detail: 'L\'autre partie se retrouvera sans interlocuteur. Tranchez le litige de préférence avant.',
  },
  ACTIVE_CONVERSATION: {
    title: 'Conversation active',
    detail: 'Les fils de discussion encore ouverts deviendront inaccessibles.',
  },
  REPORT_TARGETING: {
    title: 'Signalement visant ce compte',
    detail: 'Une modération est en cours à son sujet. Clôturez-la pour ne pas perdre le motif.',
  },
  REPORT_AUTHORED: {
    title: 'Signalement écrit par ce compte',
    detail: 'Les comptes visés resteront sans instruction si le signalement n\'est pas traité.',
  },
  RATINGS_GIVEN: {
    title: 'Notes données à d\'autres comptes',
    detail: 'Elles resteront affichées et continueront de peser sur leur moyenne, au nom d\'un compte anonyme.',
  },
}

export function impactLabel(code: string): { title: string; detail: string } {
  return LABELS[code] ?? { title: code, detail: 'Constat non reconnu par cette version du panel.' }
}

/** Motifs acceptés par le back — l'ordre suit celui de la validation serveur. */
export const DELETION_REASONS: readonly { value: AdminDeletionReasonCode; label: string }[] = [
  { value: 'FRAUD', label: 'Fraude' },
  { value: 'ABUSE', label: 'Abus ou harcèlement' },
  { value: 'TEST_ACCOUNT', label: 'Compte de test' },
  { value: 'DUPLICATE', label: 'Doublon' },
  { value: 'USER_REQUEST_OFFLINE', label: 'Demande de l\'utilisateur hors RGPD' },
  { value: 'OTHER', label: 'Autre' },
]
