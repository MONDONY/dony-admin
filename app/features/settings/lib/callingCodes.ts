/**
 * Indicatifs téléphoniques internationaux d'un réglage de type `CALLING_CODES` (ex.
 * `sms_blocked_country_codes`) : le back stocke une chaîne `"225,221,…"`, ce module la lit, la
 * valide et la réécrit. Le back reste l'autorité (il normalise et refuse en 422) : ces contrôles
 * évitent l'aller-retour pour une valeur déjà invalide et gardent le même format sur le fil.
 */

/** Bornes alignées sur le back : chiffres seulement, 1 à 4 par indicatif, 60 indicatifs au plus. */
export const CALLING_CODE_PATTERN = /^\d{1,4}$/
export const MAX_CALLING_CODES = 60

/**
 * Liste « Afrique » posée le 09/11/2026 : les SMS vers ces pays étaient facturés mais n'arrivaient
 * pas (Twilio les marquait « Delivered »). Même valeur que le défaut du back.
 */
export const AFRICA_DEFAULT_CALLING_CODES =
  '212,213,216,221,222,223,224,225,226,227,228,229,235,236,237,241,242,243'

/** Nom du pays en français. Un indicatif partagé (1, 7, 262) porte les deux noms. */
const COUNTRY_NAMES: Record<string, string> = {
  // Afrique du Nord
  20: 'Égypte',
  212: 'Maroc',
  213: 'Algérie',
  216: 'Tunisie',
  218: 'Libye',
  // Afrique de l'Ouest
  220: 'Gambie',
  221: 'Sénégal',
  222: 'Mauritanie',
  223: 'Mali',
  224: 'Guinée',
  225: 'Côte d’Ivoire',
  226: 'Burkina Faso',
  227: 'Niger',
  228: 'Togo',
  229: 'Bénin',
  231: 'Liberia',
  232: 'Sierra Leone',
  233: 'Ghana',
  234: 'Nigeria',
  238: 'Cap-Vert',
  245: 'Guinée-Bissau',
  // Afrique centrale
  235: 'Tchad',
  236: 'Centrafrique',
  237: 'Cameroun',
  240: 'Guinée équatoriale',
  241: 'Gabon',
  242: 'Congo',
  243: 'RD Congo',
  244: 'Angola',
  // Afrique de l'Est et australe, océan Indien
  27: 'Afrique du Sud',
  230: 'Maurice',
  250: 'Rwanda',
  251: 'Éthiopie',
  253: 'Djibouti',
  254: 'Kenya',
  255: 'Tanzanie',
  256: 'Ouganda',
  257: 'Burundi',
  258: 'Mozambique',
  261: 'Madagascar',
  262: 'La Réunion / Mayotte',
  269: 'Comores',
  // Europe et Amérique du Nord (pays de départ de la diaspora)
  1: 'États-Unis / Canada',
  31: 'Pays-Bas',
  32: 'Belgique',
  33: 'France',
  34: 'Espagne',
  39: 'Italie',
  41: 'Suisse',
  44: 'Royaume-Uni',
  49: 'Allemagne',
  351: 'Portugal',
  352: 'Luxembourg',
  // Autres
  7: 'Russie / Kazakhstan',
  90: 'Turquie',
  971: 'Émirats arabes unis',
}

/** Nom du pays, ou `null` si l'indicatif n'est pas dans la table. */
export function countryName(code: string): string | null {
  return COUNTRY_NAMES[code] ?? null
}

/** « +225 Côte d’Ivoire », ou « +999 » seul pour un indicatif inconnu de la table. */
export function callingCodeLabel(code: string): string {
  const name = countryName(code)
  return name ? `+${code} ${name}` : `+${code}`
}

/** Saisie d'un indicatif : on tolère « +225 » et les espaces, comme le back. */
export function cleanCallingCode(raw: string): string {
  return raw.replace(/[+\s]/g, '')
}

/**
 * Chaîne du back → liste d'indicatifs, dans l'ordre, sans doublon ni élément vide. Une valeur
 * absente ou vide donne une liste vide (aucun pays bloqué). Un élément invalide est conservé
 * tel quel pour que `callingCodesError` le signale au lieu de le faire disparaître en silence.
 */
export function parseCallingCodes(value: string | null | undefined): string[] {
  if (!value) return []
  const out: string[] = []
  for (const part of value.split(',')) {
    const code = cleanCallingCode(part)
    if (code !== '' && !out.includes(code)) out.push(code)
  }
  return out
}

/** Liste → chaîne envoyée au back (`"225,221"`). */
export function serializeCallingCodes(codes: readonly string[]): string {
  return codes.join(',')
}

/** Normalise une chaîne (retire `+`, espaces, doublons) sans changer l'ordre. */
export function normalizeCallingCodes(value: string | null | undefined): string {
  return serializeCallingCodes(parseCallingCodes(value))
}

/** Erreur sur un indicatif que l'on veut ajouter à `existing`, ou `null` s'il est valide. */
export function newCallingCodeError(raw: string, existing: readonly string[]): string | null {
  const code = cleanCallingCode(raw)
  if (code === '') return null
  if (!CALLING_CODE_PATTERN.test(code)) return 'Un indicatif compte 1 à 4 chiffres, sans lettre.'
  if (existing.includes(code)) return `${callingCodeLabel(code)} est déjà dans la liste.`
  if (existing.length >= MAX_CALLING_CODES) return `${MAX_CALLING_CODES} indicatifs au plus.`
  return null
}

/** Erreur sur la liste entière (valeur à enregistrer), ou `null` si le back l'acceptera. */
export function callingCodesError(value: string | null | undefined): string | null {
  const codes = parseCallingCodes(value)
  const invalid = codes.find((c) => !CALLING_CODE_PATTERN.test(c))
  if (invalid !== undefined) return `Indicatif invalide : « ${invalid} » (1 à 4 chiffres).`
  if (codes.length > MAX_CALLING_CODES) return `${MAX_CALLING_CODES} indicatifs au plus.`
  return null
}

/** Ce qui change entre la valeur en place et la nouvelle : indicatifs retirés et ajoutés. */
export function diffCallingCodes(
  before: string | null | undefined,
  after: string | null | undefined,
): { removed: string[]; added: string[] } {
  const a = parseCallingCodes(before)
  const b = parseCallingCodes(after)
  return {
    removed: a.filter((c) => !b.includes(c)),
    added: b.filter((c) => !a.includes(c)),
  }
}
