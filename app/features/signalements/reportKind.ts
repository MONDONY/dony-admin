import type { AdminReport, ReportKind } from '@/features/signalements/types/index'

/**
 * Type de retour choisi par le testeur dans la feuille du scarabée. Le back garde le motif
 * `SCREEN_BUG` (contrat figé) : le type n'existe que dans le préfixe de la description
 * (`[BUG]` / `[AVIS]` / `[SUGGESTION]`, posé par l'app mobile).
 */
export const REPORT_KINDS: { value: ReportKind; label: string }[] = [
  { value: 'BUG', label: 'Bug' },
  { value: 'AVIS', label: 'Avis' },
  { value: 'SUGGESTION', label: 'Suggestion' },
]

const PREFIX = /^\s*\[(BUG|AVIS|SUGGESTION)\]\s*/i

/** Type d'un rapport du scarabée ; null pour tout autre signalement ou sans préfixe. */
export function reportKind(r: Pick<AdminReport, 'reason' | 'description'>): ReportKind | null {
  if (r.reason !== 'SCREEN_BUG') return null
  const m = r.description?.match(PREFIX)
  return m ? (m[1]!.toUpperCase() as ReportKind) : null
}

export function reportKindLabel(kind: ReportKind): string {
  return REPORT_KINDS.find((k) => k.value === kind)!.label
}

/** Description sans le préfixe, déjà dit par le badge. */
export function reportDescriptionText(r: Pick<AdminReport, 'reason' | 'description'>): string | null {
  if (!r.description) return null
  return reportKind(r) ? r.description.replace(PREFIX, '') : r.description
}

/** Texte envoyé au back en `q` (LIKE insensible à la casse sur la description). */
export function reportKindQuery(kind: ReportKind): string {
  return `[${kind}]`
}
