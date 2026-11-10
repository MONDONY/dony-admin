import type { AdminVideoModal } from '@/features/video-modals/types/index'

/**
 * Fréquence d'une campagne en quelques mots, pour la liste. Une campagne d'avant le ciblage (sans
 * `frequency`) est « jusqu'à N fois », comme avant ; « jusqu'à 1 fois » se dit « une seule fois ».
 */
export function frequencyLabel(m: Pick<AdminVideoModal, 'frequency' | 'maxDisplays' | 'frequencyDays'>): string {
  const f = m.frequency ?? 'UP_TO_N'
  if (f === 'ONCE' || (f === 'UP_TO_N' && m.maxDisplays === 1)) return 'Une seule fois'
  if (f === 'UP_TO_N') return `Jusqu’à ${m.maxDisplays ?? 3} fois`
  if (f === 'EVERY_OPEN') return 'À chaque ouverture'
  if (f === 'EVERY_N_DAYS') return m.frequencyDays === 1 ? 'Chaque jour' : `Tous les ${m.frequencyDays ?? '…'} jours`
  return String(f)
}
