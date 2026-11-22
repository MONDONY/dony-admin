/** Volumes (m³), dimensions (cm) et capacité d'un trajet, génériques par mode : kilos, ou m³ pour un trajet bateau au volume. */

function num(n: number, digits = 2): string {
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: digits })
}

/** Volume en m³ ; null sans valeur. */
export function formatM3(v: number | null | undefined): string | null {
  if (v == null) return null
  return `${num(v, 3)} m³`
}

/** « 40 × 30 × 20 cm » ; null tant qu'une des trois dimensions manque. */
export function formatDimensionsCm(
  l: number | null | undefined, w: number | null | undefined, h: number | null | undefined,
): string | null {
  if (l == null || w == null || h == null) return null
  return `${num(l, 1)} × ${num(w, 1)} × ${num(h, 1)} cm`
}

export interface TripCapacityFields {
  totalKg?: number | null
  availableKg?: number | null
  volumeCapacityM3?: number | null
  availableVolumeM3?: number | null
}

/** Capacité d'un trajet : les kilos s'il y en a, sinon les m³ ; null sans aucune donnée (jamais « null kg »). */
export function capacityText(t: TripCapacityFields): string | null {
  const kg = (v: number | null | undefined) => (v == null ? null : `${num(v)} kg`)
  const m3 = (v: number | null | undefined) => formatM3(v)
  const [left, total] = t.availableKg != null || t.totalKg != null
    ? [kg(t.availableKg), kg(t.totalKg)]
    : [m3(t.availableVolumeM3), m3(t.volumeCapacityM3)]
  if (left && total) return `${left} restants sur ${total}`
  return left ? `${left} restants` : total
}

/** Capacité courte (disponible seul) pour une cellule de tableau : « 12 kg », « 12,5 m³ » ou null. */
export function availableCapacityShort(t: TripCapacityFields): string | null {
  if (t.availableKg != null) return `${num(t.availableKg)} kg`
  return formatM3(t.availableVolumeM3)
}

export interface TripPriceFields { pricePerKg?: number | null; pricePerM3?: number | null }

/** Unité du prix d'un trajet : « kg » ou « m³ » ; null sans prix. */
export function priceUnit(t: TripPriceFields): 'kg' | 'm³' | null {
  if (t.pricePerKg != null) return 'kg'
  if (t.pricePerM3 != null) return 'm³'
  return null
}

/** Prix unitaire du trajet (au kilo ou au m³), null sans prix. */
export function pricePerUnit(t: TripPriceFields): number | null {
  return t.pricePerKg ?? t.pricePerM3 ?? null
}
