import type { TimelineEntry } from '@/features/user-profile/types/index'
import { unchecked, toHref, type AdminRoute } from '@/lib/adminLinks'

const href = (route: AdminRoute | null): string | null => (route ? toHref(route) : null)

/** Lien vers l'écran existant d'un élément « en cours » ; null si le type est inconnu. */
export function linkForItem(item: { kind: string; id: string }): string | null {
  if (item.kind === 'PARCEL') return href(unchecked.bidRoute(item.id))
  if (item.kind === 'TRIP') return href(unchecked.tripRoute(item.id))
  return null
}

const TIMELINE_ROUTE: Record<string, typeof unchecked.bidRoute> = {
  PARCEL: id => unchecked.bidRoute(id),
  PAYMENT: id => unchecked.paymentRoute(id),
  DISPUTE: id => unchecked.disputeRoute(id),
  REPORT: id => unchecked.reportRoute(id),
}

/** Lien d'une entrée de frise ; null si `refId` est absent ou le `refType` inconnu. */
export function linkForTimeline(e: TimelineEntry): string | null {
  if (!e.refId || !e.refType) return null
  const build = TIMELINE_ROUTE[e.refType]
  return build ? href(build(e.refId)) : null
}
