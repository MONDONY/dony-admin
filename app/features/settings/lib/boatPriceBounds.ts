/**
 * Bornes du prix au m³ d'un trajet bateau, en euros (lot 4 bateau). Cinq réglages DECIMAL qui
 * doivent rester ordonnés : prix minimal ≤ début de la zone conseillée ≤ prix indicatif ≤ fin de
 * la zone conseillée ≤ prix maximal. Le back refuse sinon (422 `platform-setting-invalid`) et
 * reste l'autorité : ce contrôle évite l'aller-retour et dit dans quel ordre modifier.
 */
export const BOAT_PRICE_KEYS = [
  'boat_price_per_m3_hard_min_eur',
  'boat_price_per_m3_advised_min_eur',
  'boat_price_per_m3_reference_eur',
  'boat_price_per_m3_advised_max_eur',
  'boat_price_per_m3_hard_max_eur',
] as const

export const BOAT_PRICE_HARD_MIN_KEY = 'boat_price_per_m3_hard_min_eur'
export const BOAT_PRICE_HARD_MAX_KEY = 'boat_price_per_m3_hard_max_eur'

const MIN_EUR = 1
const MAX_EUR = 100000
/** Position du prix indicatif, centre de l'ordre : sert à dire si une borne est intérieure ou extérieure. */
const CENTER = 2

/** Nom de chaque borne dans une phrase (« … ne peut pas dépasser le prix indicatif »). */
const BOUND_NAMES: Record<string, string> = {
  boat_price_per_m3_hard_min_eur: 'le prix minimal',
  boat_price_per_m3_advised_min_eur: 'le début de la zone conseillée',
  boat_price_per_m3_reference_eur: 'le prix indicatif',
  boat_price_per_m3_advised_max_eur: 'la fin de la zone conseillée',
  boat_price_per_m3_hard_max_eur: 'le prix maximal',
}

export function isBoatPriceKey(key: string | null | undefined): boolean {
  return !!key && (BOAT_PRICE_KEYS as readonly string[]).includes(key)
}

export function boatPriceHint(): string {
  return 'Entre 1 et 100 000 €/m³, au centime'
}

/** « 239,5 €/m³ » : format français, sans décimales inutiles. */
export function formatEurPerM3(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €/m³`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Message d'erreur de la saisie `raw` pour la borne `key`, ou `null` si elle est valable. La
 * contrainte croisée se vérifie contre les valeurs EN PLACE des quatre autres bornes (`current`, par clé),
 * puisque chaque réglage s'enregistre seul : une valeur absente ou illisible est ignorée.
 */
export function boatPriceError(key: string, raw: string, current: Readonly<Record<string, string>>): string | null {
  const str = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(str)) return 'Saisissez un prix en euros, par exemple 240 ou 239.50.'
  if (/\.\d{3,}$/.test(str)) return 'Au plus 2 décimales : le prix se règle au centime.'
  const n = Number(str)
  if (n < MIN_EUR || n > MAX_EUR) return 'Entre 1 et 100 000 €/m³.'

  const idx = (BOAT_PRICE_KEYS as readonly string[]).indexOf(key)
  // Bornes déjà en place qui empêchent cette valeur, avec leur position dans l'ordre.
  const conflicts: { pos: number; value: number }[] = []
  BOAT_PRICE_KEYS.forEach((other, pos) => {
    if (pos === idx) return
    const served = current[other]
    const v = Number(served)
    if (served === undefined || served.trim() === '' || Number.isNaN(v)) return
    if ((pos < idx && v > n) || (pos > idx && v < n)) conflicts.push({ pos, value: v })
  })
  if (conflicts.length === 0) return null

  const below = conflicts[0]!.pos < idx
  // La plus proche est celle qu'on heurte ; la plus éloignée est la première à déplacer.
  const byDistance = [...conflicts].sort((a, b) => Math.abs(a.pos - idx) - Math.abs(b.pos - idx))
  const nearest = byDistance[0]!
  const nearestName = BOUND_NAMES[BOAT_PRICE_KEYS[nearest.pos]!]!
  const first = byDistance[byDistance.length - 1]!
  const order = [...byDistance].reverse().map((c) => BOUND_NAMES[BOAT_PRICE_KEYS[c.pos]!]!).join(', puis ')
  const widening = Math.abs(first.pos - CENTER) > Math.abs(idx - CENTER)

  const clash = below
    ? `${capitalize(BOUND_NAMES[key]!)} ne peut pas descendre sous ${nearestName} (${formatEurPerM3(nearest.value)}).`
    : `${capitalize(BOUND_NAMES[key]!)} ne peut pas dépasser ${nearestName} (${formatEurPerM3(nearest.value)}).`
  const advice = widening
    ? 'pour élargir la fourchette, on commence par les bornes extérieures.'
    : 'pour resserrer la fourchette, on commence par les bornes intérieures.'
  return `${clash} Modifiez d’abord ${order} : ${advice}`
}

/**
 * Rappel ajouté à la confirmation quand une borne dure se resserre : les nouveaux trajets hors
 * bornes seront refusés. `null` si la borne s'élargit, ne change pas, ou n'est pas une borne dure.
 */
export function hardBoundTighteningNotice(key: string, raw: string, currentRaw: string | undefined): string | null {
  const next = Number(raw)
  const before = Number(currentRaw)
  if (currentRaw === undefined || Number.isNaN(before) || Number.isNaN(next)) return null
  const tail = 'Les trajets déjà publiés ne sont pas touchés tant que leur prix ne change pas.'
  if (key === BOAT_PRICE_HARD_MIN_KEY && next > before) {
    return `Les nouveaux trajets bateau au m³ sous ${formatEurPerM3(next)} seront refusés. ${tail}`
  }
  if (key === BOAT_PRICE_HARD_MAX_KEY && next < before) {
    return `Les nouveaux trajets bateau au m³ au-dessus de ${formatEurPerM3(next)} seront refusés. ${tail}`
  }
  return null
}

/** Conseil ajouté au refus serveur de l'ordre des bornes (422 `platform-setting-invalid`). */
export const BOAT_PRICE_ORDER_ADVICE =
  'Pour élargir la fourchette, modifiez d’abord les bornes extérieures ; pour la resserrer, d’abord les '
  + 'bornes intérieures. Les autres valeurs ont pu changer entre-temps : rechargez la page en cas de doute.'
