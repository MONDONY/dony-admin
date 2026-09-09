import type { MobileMoneyOperationStatus } from '@/features/finance/types/index'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

/**
 * Les statuts sont ceux d'une OPÉRATION pawaPay (`pawapay_operations.status`), pas d'un
 * paiement : le backend rend cette table depuis le rail pawaPay. Les libellés parlent donc
 * d'un mouvement d'argent chez l'opérateur, pas de l'état du colis.
 */
const MAP: Record<MobileMoneyOperationStatus, { label: string; tone: Tone }> = {
  CREATED: { label: 'Créée', tone: 'neutral' },
  ACCEPTED: { label: 'Acceptée', tone: 'info' },
  PROCESSING: { label: 'En cours', tone: 'warning' },
  ENQUEUED: { label: 'En file', tone: 'warning' },
  IN_RECONCILIATION: { label: 'En rapprochement', tone: 'warning' },
  COMPLETED: { label: 'Terminée', tone: 'success' },
  FAILED: { label: 'Échouée', tone: 'danger' },
  SUBMIT_REJECTED: { label: 'Refusée à la soumission', tone: 'danger' },
}

export function mobileMoneyStatusMeta(s: MobileMoneyOperationStatus): { label: string; tone: Tone } {
  // Un statut inconnu (nouveau côté pawaPay) s'affiche brut plutôt que de rendre une cellule
  // vide : mieux vaut une étiquette illisible qu'une information disparue.
  return MAP[s] ?? { label: s, tone: 'neutral' }
}

/** Sens métier de l'opération, côté yadony. */
export function mobileMoneyKindLabel(kind: string): string {
  return { DEPOSIT: 'Encaissement', PAYOUT: 'Versement', REFUND: 'Remboursement' }[kind] ?? kind
}

/**
 * `ORANGE_CIV`, `WAVE_SEN`, `MTN_MOMO_CIV`… : pawaPay nomme l'opérateur ET le pays. On lit
 * l'opérateur, le pays étant déjà une colonne à part.
 */
export function mobileMoneyProviderLabel(provider: string): string {
  const base = provider.replace(/_(CIV|SEN|CMR|BEN|BFA|COD|COG|GAB|KEN|ZMB|SLE|TZA|UGA|RWA|MWI|NGA|GHA)$/, '')
  return { ORANGE: 'Orange Money', WAVE: 'Wave', MTN_MOMO: 'MTN MoMo', MOOV: 'Moov Money', FREE: 'Free Money' }[base] ?? provider
}
