import type { TimelineEntry } from '@/features/user-profile/types/index'

/** Lien vers l'écran existant d'un élément « en cours » ; null si le type est inconnu. */
export function linkForItem(item: { kind: string; id: string }): string | null {
  if (item.kind === 'PARCEL') return `/colis?open=${item.id}`
  if (item.kind === 'TRIP') return `/colis?tab=announcements&announcement=${item.id}`
  return null
}

const TIMELINE_BASE: Record<string, string> = {
  PARCEL: '/colis',
  PAYMENT: '/transactions',
  DISPUTE: '/incidents',
  REPORT: '/signalements',
}

/** Lien d'une entrée de frise ; null si `refId` est absent ou le `refType` inconnu. */
export function linkForTimeline(e: TimelineEntry): string | null {
  if (!e.refId || !e.refType) return null
  const base = TIMELINE_BASE[e.refType]
  return base ? `${base}?open=${e.refId}` : null
}
