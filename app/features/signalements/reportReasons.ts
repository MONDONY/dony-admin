/**
 * Miroir de `com.yadony.api.signalements.ReportReason`. Le back valide le motif contre le
 * type de cible ; ce catalogue sert uniquement à l'affichage (le libellé, pas la valeur,
 * peut diverger sans risque).
 */
export const REPORT_REASON_LABELS: Record<string, string> = {
  HARASSMENT: 'Harcèlement ou comportement abusif',
  FAKE_PROFILE: 'Faux profil',
  SCAM_ATTEMPT: 'Tentative d’arnaque',
  PROHIBITED_ITEM: 'Objet interdit au transport',
  FALSE_INFORMATION: 'Informations fausses ou trompeuses',
  INAPPROPRIATE_CONTENT: 'Contenu inapproprié',
  SPAM: 'Spam',
  PAYMENT_ISSUE: 'Problème de paiement',
  APP_BUG: 'Bug de l’application',
  OTHER: 'Autre',
}

export function reportReasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason] ?? reason
}
