import {
  INFO_SCREEN_LABELS, PARCEL_ROLE_LABELS, TRIGGER_LABELS,
  type AdminVideoModal, type InfoScreen, type ParcelRole, type VideoModalTrigger,
} from '@/features/video-modals/types/index'

/**
 * Libellés tolérants à un back plus récent : une valeur inconnue s'affiche telle quelle, sans lever d'erreur.
 */
export const triggerLabel = (t: string): string => TRIGGER_LABELS[t as VideoModalTrigger] ?? t
export const parcelRoleLabel = (r: string): string => PARCEL_ROLE_LABELS[r as ParcelRole] ?? r
export const screenLabel = (s: string): string => INFO_SCREEN_LABELS[s as InfoScreen] ?? s

/**
 * Fréquence d'une campagne en quelques mots, pour la liste. Une campagne d'avant le ciblage (sans
 * `frequency`) est « jusqu'à N fois », comme avant ; « jusqu'à 1 fois » se dit « une seule fois ».
 */
export function frequencyLabel(m: Pick<AdminVideoModal, 'frequency' | 'maxDisplays' | 'frequencyDays'>): string {
  const f = m.frequency ?? 'UP_TO_N'
  if (f === 'ONCE' || (f === 'UP_TO_N' && m.maxDisplays === 1)) return 'Une seule fois'
  if (f === 'UP_TO_N') return `Jusqu’à ${m.maxDisplays ?? 3} fois`
  if (f === 'EVERY_OPEN') return 'À chaque ouverture'
  if (f === 'EVERY_TIME') return 'À chaque fois'
  if (f === 'ONCE_PER_PARCEL') return 'Une fois par colis'
  if (f === 'EVERY_N_DAYS') return m.frequencyDays === 1 ? 'Chaque jour' : `Tous les ${m.frequencyDays ?? '…'} jours`
  return String(f)
}
