import { isParcelStepTrigger } from '@/features/video-modals/types/index'

/** Exemples de l'aperçu à la place des variables : une seule table, valable pour tout rôle. */
const EXAMPLES: Record<string, string> = { '{expéditeur}': 'Mamadou', '{voyageur}': 'Awa', '{destinataire}': 'Fatou', '{ville_arrivee}': 'Abidjan' }

/** Remplace les variables permises par leurs exemples ; toute autre accolade reste telle quelle. */
export function withParcelExamples(text: string): string {
  return text.replace(/\{[^{}]*\}/g, v => EXAMPLES[v] ?? v)
}

/**
 * Miroir de `ParcelActionContext.canRun` de l'app : le QR et « Envoyer le code » sont réservés à l'expéditeur, le second
 * seulement quand le code existe (donc pas à l'étape « accepté »). Détail, suivi et écrans hors colis : toujours.
 */
export function parcelScreenShown(screen: string, role: string, opts: { codeExists?: boolean } = {}): boolean {
  if (screen === 'PARCEL_QR') return role === 'SENDER'
  if (screen === 'PARCEL_SEND_CODE') return role === 'SENDER' && (opts.codeExists ?? true)
  return true
}

/** Le code de retrait existe à l'une des étapes choisies (toutes sauf « accepté »). */
export const codeExistsFor = (triggers: readonly string[]): boolean => {
  const steps = triggers.filter(isParcelStepTrigger)
  return steps.length === 0 || steps.some(t => t !== 'PARCEL_ACCEPTED')
}
