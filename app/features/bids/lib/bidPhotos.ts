import { safeHttpsUrl } from '@/lib/safeInput'
import type { AdminBidDetail, AdminBidPhoto, AdminBidTimeline, PhotoStage } from '../types'

export const PHOTO_STAGE_LABELS: Record<PhotoStage, string> = {
  CREATION: 'Photos du colis',
  DEPART: 'Remise du colis',
  TRANSIT: 'En transit',
  ARRIVEE: 'Livraison',
  REFUSAL: 'Refus du colis',
  DISPUTE: 'Preuves du litige',
}

const FIXED_STAGES: PhotoStage[] = ['CREATION', 'DEPART', 'TRANSIT', 'ARRIVEE']
const OPTIONAL_STAGES: PhotoStage[] = ['REFUSAL', 'DISPUTE']

/** Étapes fixes toujours présentes (même vides), refus et litige seulement s'ils ont des photos. */
export function groupPhotos(photos: AdminBidPhoto[]): { stage: PhotoStage; label: string; photos: AdminBidPhoto[] }[] {
  const of = (stage: PhotoStage) => photos.filter(p => p.stage === stage)
  return [
    ...FIXED_STAGES,
    ...OPTIONAL_STAGES.filter(s => of(s).length > 0),
  ].map(stage => ({ stage, label: PHOTO_STAGE_LABELS[stage], photos: of(stage) }))
}

/** Photos présignées `https:` seulement. */
export function safePhotos(photos: AdminBidPhoto[]): AdminBidPhoto[] {
  return photos.filter(p => safeHttpsUrl(p.url) !== null)
}

const SCAN_STAGES: Record<string, PhotoStage> = { DEPART: 'DEPART', TRANSIT: 'TRANSIT', ARRIVEE: 'ARRIVEE' }

/** Repli face à un ancien back : photos de création et photos des scans de la chronologie. */
export function fallbackPhotos(bid: AdminBidDetail, timeline: AdminBidTimeline | null): AdminBidPhoto[] {
  const created: AdminBidPhoto[] = (bid.photoUrls ?? []).map((url, i) => ({
    id: `creation-${i}`, stage: 'CREATION', label: PHOTO_STAGE_LABELS.CREATION, at: bid.createdAt, url,
  }))
  const scans: AdminBidPhoto[] = []
  ;(timeline?.entries ?? []).forEach((e, i) => {
    const stage = SCAN_STAGES[e.label]
    if (e.kind !== 'SCAN' || !e.photoUrl || !stage) return
    scans.push({ id: `scan-${i}`, stage, label: PHOTO_STAGE_LABELS[stage], at: e.at, url: e.photoUrl })
  })
  return [...created, ...scans]
}
