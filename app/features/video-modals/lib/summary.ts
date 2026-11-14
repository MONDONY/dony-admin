import type { WireCondition, WireGroup } from '@/features/broadcast/composables/audienceRule'
import type { AudienceField } from '@/features/broadcast/types/index'
import {
  CORRIDOR_TRIGGERS, FEW_RESULTS_DEFAULT, NO_DELAY_TRIGGERS, OPEN_DELAY_SECONDS, PLATFORM_LABELS, TRIP_VIEWED_DEFAULT,
  type ModalCorridor, type ModalPlatform, type SituationKind, type VideoModalInput, type VideoModalTrigger,
} from '@/features/video-modals/types/index'

/** Un morceau de la phrase : `strong` met en avant ce que l'admin a réglé (or sur fond marine). */
export interface SummaryPart {
  text: string
  strong?: boolean
}

export type SummaryInput = Pick<
  VideoModalInput,
  'triggers' | 'situations' | 'connectedOnly' | 'conditions' | 'minAppVersion' | 'maxAppVersion' | 'platforms'
  | 'samplePercent' | 'triggerOptions' | 'corridors' | 'frequency' | 'frequencyDays' | 'maxDisplays' | 'stopAfterAnswer' | 'allowDontShowAgain' | 'startsAt' | 'endsAt'
>

const TRIGGER_PHRASES: Record<VideoModalTrigger, string> = {
  APP_OPEN: 'l’ouverture de l’app',
  SEARCH_TAB: 'l’arrivée sur l’onglet Rechercher',
  ACTIVITIES_TAB: 'l’arrivée sur l’onglet Activités',
  TRACKING_TAB: 'l’arrivée sur l’onglet Suivi',
  MESSAGES_TAB: 'l’arrivée sur l’onglet Messages',
  PROFILE_TAB: 'l’arrivée sur l’onglet Moi',
  PUBLISH_TRIP: 'le toucher du bouton « Publier un trajet »',
  SEND_PARCEL: 'le toucher du bouton « Envoyer un colis »',
  DELIVERY_CONFIRMED: 'une livraison confirmée',
  PAYMENT_SUCCEEDED: 'un paiement réussi',
  TRIP_PUBLISHED: 'la publication d’un trajet',
  REQUEST_PUBLISHED: 'la publication d’une demande d’envoi',
  KYC_VERIFIED: 'la vérification de l’identité',
  SEARCH_NO_TRIP_RESULTS: 'une recherche de trajet sans résultat',
  SEARCH_NO_PARCEL_RESULTS: 'une recherche de colis sans résultat',
  SEARCH_FEW_RESULTS: 'une recherche avec peu de résultats',
  FAVORITE_ADDED: 'l’ajout d’un trajet ou d’une alerte aux favoris',
  FORM_ABANDONED: 'un formulaire de trajet ou de demande quitté sans publier',
  TRIP_VIEWED_REPEATEDLY: 'la consultation répétée du même trajet',
  PAYMENT_FAILED: 'un paiement échoué ou annulé',
  APP_UPDATED: 'la première ouverture après une mise à jour de l’app',
}

/** Phrase d'un déclencheur ; les deux moments à seuil précisent leur valeur. */
function triggerPhrase(t: VideoModalTrigger, input: SummaryInput): string {
  if (t === 'SEARCH_FEW_RESULTS') {
    const n = input.triggerOptions?.fewResultsMax
    // Seuil invalide (non entier, nul ou négatif) : on retombe sur la valeur par défaut, comme l'app.
    const max = isNum(n) && Number.isInteger(n) && n >= 1 ? n : FEW_RESULTS_DEFAULT
    return max === 1 ? 'une recherche qui ne renvoie qu’un seul résultat' : `une recherche qui renvoie de 1 à ${max} résultats`
  }
  if (t === 'TRIP_VIEWED_REPEATEDLY') {
    const n = input.triggerOptions?.tripViewedTimes
    const times = isNum(n) ? n : TRIP_VIEWED_DEFAULT
    return `la consultation du même trajet ${times === 1 ? 'une' : times} fois`
  }
  return TRIGGER_PHRASES[t]
}

/* eslint-disable no-unused-vars -- nom de paramètre d'un type de fonction */
type SituationPhrase = (value: number | null) => string
/* eslint-enable no-unused-vars */

const SITUATION_PHRASES: Record<SituationKind, SituationPhrase> = {
  OFFER_ACCEPTED_UNPAID: v => `une offre acceptée n’est pas payée depuis ${v ?? '…'} h`,
  OFFER_UNANSWERED: v => `une offre reçue reste sans réponse depuis ${v ?? '…'} h`,
  COUNTER_OFFER_PENDING: v => `une contre-offre est en attente depuis ${v ?? '…'} h`,
  KYC_ABANDONED: () => 'la vérification d’identité est commencée puis abandonnée',
  PROFILE_INCOMPLETE: () => 'le profil est incomplet',
  FIRST_DELIVERY_NO_REFERRAL: () => 'la première livraison est réussie sans parrainage',
  RETURN_AFTER_ABSENCE: v => `la personne revient après ${v ?? '…'} ${v === 1 ? 'jour' : 'jours'} d’absence`,
  DAYS_SINCE_INSTALL_NO_ACTION: v => (v === 1
    ? '1 jour s’est écoulé depuis l’installation, sans action'
    : `${v ?? '…'} jours se sont écoulés depuis l’installation, sans action`),
}

/** « que » ou « qu’ » selon l'initiale de ce qui suit (voyelle ou h muet : « qu’une », « qu’il »). */
const queElided = (next: string) => (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(next) ? 'qu’' : 'que ')

const deElide = (place: string) => (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(place) ? `d’${place}` : `de ${place}`)

const plain = (text: string): SummaryPart => ({ text })
const strong = (text: string): SummaryPart => ({ text, strong: true })

/** « a », « a ou b », « a, b ou c ». */
function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ou ${items[items.length - 1]}`
}

const isNum = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR')
}

/** Valeur d'une condition en toutes lettres, selon le type de valeur de l'opérateur du catalogue. */
function valueText(field: AudienceField | undefined, c: WireCondition): string {
  const type = field?.operators.find(o => o.key === c.operator)?.valueType
  const label = (key: unknown) => field?.values.find(v => v.key === key)?.label ?? String(key)
  const v = c.value
  if (v === null || v === undefined || type === 'NONE') return ''
  switch (type) {
    case 'BOOLEAN': return v ? 'oui' : 'non'
    case 'ENUM': return label(v)
    case 'ENUM_MULTI': return Array.isArray(v) ? joinOr(v.map(label)) : ''
    case 'TEXT': return `« ${String(v)} »`
    case 'CORRIDOR': {
      const o = v as { origin?: string | null; destination?: string | null }
      const from = o.origin?.trim()
      const to = o.destination?.trim()
      if (from && to) return `${deElide(from)} vers ${to}`
      return from ? `au départ ${deElide(from)}` : to ? `à l’arrivée à ${to}` : ''
    }
    default: return String(v)
  }
}

/** Une condition en clair : « Pays de résidence est Côte d'Ivoire ». */
export function describeCondition(c: WireCondition, fields: AudienceField[]): string {
  const field = fields.find(f => f.key === c.field)
  const operator = field?.operators.find(o => o.key === c.operator)
  return [field?.label ?? c.field, operator?.label ?? c.operator, valueText(field, c)].filter(Boolean).join(' ')
}

/** L'arbre de règles en clair : conditions en gras, « et » / « ou » entre elles, parenthèses pour un sous-groupe. */
export function describeConditions(group: WireGroup, fields: AudienceField[]): SummaryPart[] {
  const link = group.op === 'OR' ? ' ou ' : ' et '
  const parts: SummaryPart[] = []
  group.children.forEach((child, i) => {
    if (i > 0) parts.push(plain(link))
    if ('children' in child) {
      const inner = describeConditions(child, fields)
      parts.push(plain('('), ...inner, plain(')'))
    } else {
      parts.push(strong(describeCondition(child, fields)))
    }
  })
  return parts
}

function momentParts(input: SummaryInput): SummaryPart[] {
  const situations = input.situations ?? []
  // Sans déclencheur, le serveur sert les situations à l'ouverture de l'app (contrat).
  const triggers: VideoModalTrigger[] = input.triggers.length > 0 ? input.triggers : situations.length > 0 ? ['APP_OPEN'] : []
  const delayed = triggers.filter(t => !NO_DELAY_TRIGGERS.includes(t) && TRIGGER_PHRASES[t])
  const immediate = triggers.filter(t => NO_DELAY_TRIGGERS.includes(t) && TRIGGER_PHRASES[t])
  const phrase = (t: VideoModalTrigger) => triggerPhrase(t, input)
  const parts: SummaryPart[] = [plain('Ce modal s’ouvrira ')]
  if (delayed.length === 0 && immediate.length === 0) {
    parts.push(strong('à un moment à choisir'))
  } else {
    if (delayed.length > 0) {
      parts.push(strong(`${OPEN_DELAY_SECONDS} secondes après ${joinOr(delayed.map(phrase))}`))
    }
    if (delayed.length > 0 && immediate.length > 0) parts.push(plain(', ou '))
    if (immediate.length > 0) parts.push(strong(`dès ${joinOr(immediate.map(phrase))}`), plain(', sans délai'))
  }
  if (situations.length > 0) {
    situations.forEach((s, i) => {
      const sentence = SITUATION_PHRASES[s.kind]
      const text = sentence ? sentence(isNum(s.value) ? s.value : null) : String(s.kind)
      // « tant qu’une offre… », « tant que le profil… », puis « et qu’… » / « et que… » : élision devant une voyelle.
      parts.push(plain(`${i === 0 ? ', tant ' : ' et '}${queElided(text)}`), strong(text))
    })
  }
  return parts
}

/** « de Paris vers Abidjan », « au départ de Paris », « à l’arrivée à Abidjan ». */
function corridorPhrase(c: ModalCorridor): string {
  const from = c.from?.trim()
  const to = c.to?.trim()
  if (from && to) return `${deElide(from)} vers ${to}`
  if (from) return `au départ ${deElide(from)}`
  if (to) return `à l’arrivée à ${to}`
  return ''
}

/** « Trajet ou colis précis » : décrit seulement quand un moment concerné est coché (sinon sans effet). */
function corridorParts(input: SummaryInput): SummaryPart[] {
  const corridors = (input.corridors ?? []).map(corridorPhrase).filter(Boolean)
  if (corridors.length === 0 || !input.triggers.some(t => CORRIDOR_TRIGGERS.includes(t))) return []
  return [plain(', seulement pour un trajet ou un colis '), strong(joinOr(corridors))]
}

function audienceParts(input: SummaryInput, fields: AudienceField[]): SummaryPart[] {
  const parts: SummaryPart[] = []
  const hasConditions = !!input.conditions && input.conditions.children.length > 0
  const platforms = (input.platforms ?? []) as ModalPlatform[]
  const onePlatform = platforms.length === 1 ? platforms[0]! : null
  const min = input.minAppVersion?.trim()
  const max = input.maxAppVersion?.trim()
  const sample = isNum(input.samplePercent) && input.samplePercent < 100 ? input.samplePercent : null
  const situations = (input.situations ?? []).length > 0

  if (input.connectedOnly) parts.push(plain(', uniquement pour les personnes '), strong('connectées'))
  if (hasConditions) parts.push(plain(', qui répondent à '), ...describeConditions(input.conditions!, fields))
  if (onePlatform) parts.push(plain(', sur '), strong(PLATFORM_LABELS[onePlatform] ?? onePlatform))
  if (min && max) parts.push(plain(', avec l’application '), strong(`de ${min} à ${max}`))
  else if (min) parts.push(plain(', avec l’application '), strong(`${min} ou plus`))
  else if (max) parts.push(plain(', avec l’application '), strong(`${max} ou moins`))
  if (sample !== null) parts.push(plain(', pour '), strong(`${sample} %`), plain(' des personnes concernées'))
  if (parts.length === 0 && !situations) parts.push(plain(', pour '), strong('tout le monde'), plain(', visiteurs sans compte compris'))
  return parts
}

function frequencyParts(input: SummaryInput): SummaryPart[] {
  const freq = input.frequency ?? 'UP_TO_N'
  const parts: SummaryPart[] = [plain('Il s’affichera ')]
  if (freq === 'ONCE' || (freq === 'UP_TO_N' && input.maxDisplays === 1)) parts.push(strong('une seule fois'))
  else if (freq === 'UP_TO_N') parts.push(strong(`jusqu’à ${isNum(input.maxDisplays) ? input.maxDisplays : '…'} fois`))
  else if (freq === 'EVERY_OPEN') parts.push(strong('à chaque ouverture de l’app'))
  else if (freq === 'EVERY_TIME') parts.push(strong('à chaque fois que l’action se produit'))
  else {
    const n = input.frequencyDays
    parts.push(strong(n === 1 ? 'au plus une fois par jour' : `au plus une fois tous les ${isNum(n) ? n : '…'} jours`))
  }
  if (freq !== 'ONCE') {
    parts.push(plain(input.stopAfterAnswer === false ? ', même après un bouton touché' : ', et ne revient plus après un bouton touché'))
  }
  const start = fmtDate(input.startsAt)
  const end = fmtDate(input.endsAt)
  if (start && end) parts.push(plain(', du '), strong(start), plain(' au '), strong(end))
  else if (end) parts.push(plain(', jusqu’au '), strong(end))
  else if (start) parts.push(plain(', à partir du '), strong(start))
  if (input.allowDontShowAgain) parts.push(plain(', avec une case « Ne plus afficher »'))
  return parts
}

/** La phrase « En clair » : quand, pour qui, à quelle fréquence, générée à partir des réglages. */
export function buildSummary(input: SummaryInput, fields: AudienceField[]): SummaryPart[] {
  return [
    ...momentParts(input),
    ...corridorParts(input),
    ...audienceParts(input, fields),
    plain('. '),
    ...frequencyParts(input),
    plain('.'),
  ]
}

/** Texte brut de la phrase (accessibilité et tests). */
export const summaryText = (parts: SummaryPart[]) => parts.map(p => p.text).join('')
