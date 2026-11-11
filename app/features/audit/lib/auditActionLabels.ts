/**
 * Libellés français des actions d'audit qui n'ont pas de sens évident à la lecture du code.
 * Le code reste affiché : le libellé n'est qu'une aide. Une action absente d'ici n'en a pas.
 */
const LABELS: Record<string, string> = {
  DAC7_EXPORT_GENERATED: 'Fichier DAC7 généré',
  DAC7_STATEMENTS_SENT: 'Récapitulatifs DAC7 envoyés aux voyageurs',
  DAC7_TEAM_DECISION: 'Décision de l’équipe sur un voyageur DAC7',
}

export function auditActionLabel(action: string | null | undefined): string | null {
  if (!action) return null
  const known = LABELS[action]
  if (known) return known
  // Autre action du domaine DAC7 (ex. CSV de contrôle) : on la rattache au domaine sans deviner son sens.
  return action.startsWith('DAC7_') ? `DAC7 : ${action}` : null
}
