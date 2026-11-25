import type { ParcelRole } from '@/features/video-modals/types/index'

/**
 * Exemples utilisés par l'aperçu à la place des variables des modals d'étape. Une table par rôle regardé,
 * pour pouvoir faire diverger les exemples d'un rôle à l'autre (aujourd'hui les mêmes quatre noms).
 */
const EXAMPLES: Record<ParcelRole, Record<string, string>> = {
  SENDER: { '{expéditeur}': 'Mamadou', '{voyageur}': 'Awa', '{destinataire}': 'Fatou', '{ville_arrivee}': 'Abidjan' },
  TRAVELER: { '{expéditeur}': 'Mamadou', '{voyageur}': 'Awa', '{destinataire}': 'Fatou', '{ville_arrivee}': 'Abidjan' },
  RECIPIENT: { '{expéditeur}': 'Mamadou', '{voyageur}': 'Awa', '{destinataire}': 'Fatou', '{ville_arrivee}': 'Abidjan' },
}

/** Remplace les variables permises par leurs exemples ; toute autre accolade reste telle quelle. */
export function withParcelExamples(text: string, role: ParcelRole): string {
  const map = EXAMPLES[role]
  return text.replace(/\{[^{}]*\}/g, v => map[v] ?? v)
}
