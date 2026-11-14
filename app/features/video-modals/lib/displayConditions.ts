import {
  CORRIDOR_TRIGGERS, NO_DELAY_TRIGGERS, OPEN_DELAY_SECONDS, PLATFORM_LABELS,
  isMomentTrigger, type VideoModalInput,
} from '@/features/video-modals/types/index'
import type { VideoModalErrors } from '@/features/video-modals/lib/validation'

/** Verdict d'une condition : remplie, à vérifier (restreint ou dépend d'autre chose), bloque l'affichage. */
export type Verdict = 'ok' | 'check' | 'block'

export interface ConditionRow {
  id: string
  group: 'Statut et période' | 'Version et public' | 'Déclencheur' | 'Répétition' | 'Contenu'
  label: string
  detail: string
  verdict: Verdict
}

export interface DisplayConditions {
  rows: ConditionRow[]
  /** Règles fixes de l'app, communes à toutes les campagnes (propres au type pour la première). */
  common: string[]
  /** Vrai si au moins une ligne bloque l'affichage. */
  blocked: boolean
}

export interface DisplayConditionsContext {
  active: boolean
  now?: Date
  errors?: VideoModalErrors
}

/** Première version de l'app qui connaît les moments, formats, images et fréquences récentes. */
export const RECENT_APP_VERSION = '1.0.6'

const fmt = (d: Date) => d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function statusAndPeriod(input: VideoModalInput, ctx: DisplayConditionsContext, now: Date): ConditionRow[] {
  const group = 'Statut et période' as const
  const rows: ConditionRow[] = [{
    id: 'status', group, label: 'Campagne active',
    detail: ctx.active ? 'Active : elle peut être servie.' : 'Désactivée : elle n’est jamais servie.',
    verdict: ctx.active ? 'ok' : 'block',
  }]
  const start = parse(input.startsAt)
  const end = parse(input.endsAt)
  let detail = 'Sans date de début ni de fin : toujours dans la période.'
  let verdict: Verdict = 'ok'
  if (start && start.getTime() > now.getTime()) {
    detail = `Pas encore commencée : début le ${fmt(start)}. Rien n’est servi avant.`
    verdict = 'block'
  } else if (end && end.getTime() <= now.getTime()) {
    detail = `Terminée depuis le ${fmt(end)} : plus servie.`
    verdict = 'block'
  } else if (start && end) detail = `Servie du ${fmt(start)} au ${fmt(end)}.`
  else if (end) detail = `Servie jusqu’au ${fmt(end)}, sans date de début.`
  else if (start) detail = `Servie à partir du ${fmt(start)}, sans date de fin.`
  rows.push({ id: 'period', group, label: 'Période', detail, verdict })
  return rows
}

function usesRecentFeatures(input: VideoModalInput): string[] {
  const used: string[] = []
  if (input.triggers.some(isMomentTrigger)) used.push('un moment d’action')
  if ((input.layout ?? 'BOTTOM_SHEET') !== 'BOTTOM_SHEET' || (input.sizePercent ?? null) !== null) used.push('un format ou une taille')
  if ((input.imageMode ?? 'NONE') !== 'NONE') used.push('une image')
  const f = input.frequency ?? 'UP_TO_N'
  if (f === 'EVERY_OPEN' || f === 'EVERY_N_DAYS' || f === 'EVERY_TIME') used.push('une fréquence récente')
  return used
}

function versionAndAudience(input: VideoModalInput): ConditionRow[] {
  const group = 'Version et public' as const
  const rows: ConditionRow[] = []
  const recent = usesRecentFeatures(input)
  let detail = `Aucune fonction récente utilisée : pas de condition de version liée à ${RECENT_APP_VERSION}.`
  if (recent.length > 0) {
    detail = `Utilise ${recent.join(', ')} : disponible seulement dans l’app ${RECENT_APP_VERSION} et plus. Les apps 1.0.5 et avant ne l’affichent jamais.`
  }
  if (input.frequency === 'EVERY_TIME') {
    detail += ' La fréquence « À chaque fois » est servie en « à chaque ouverture » aux apps qui ne la connaissent pas encore.'
  }
  rows.push({ id: 'app-version', group, label: 'Version de l’app', detail, verdict: recent.length > 0 ? 'check' : 'ok' })

  const min = input.minAppVersion?.trim()
  const max = input.maxAppVersion?.trim()
  if (min || max) {
    const range = min && max ? `de la ${min} à la ${max}` : min ? `à partir de la ${min}` : `jusqu’à la ${max}`
    rows.push({ id: 'version-range', group, label: 'Ciblage de version', detail: `Seulement les apps ${range}.`, verdict: 'check' })
  }
  const platforms = input.platforms ?? []
  if (platforms.length > 0) {
    rows.push({ id: 'platforms', group, label: 'Système', detail: `Seulement ${platforms.map(p => PLATFORM_LABELS[p] ?? p).join(' et ')}.`, verdict: 'check' })
  }
  if (input.connectedOnly) {
    rows.push({ id: 'connected', group, label: 'Compte connecté', detail: 'Les visiteurs sans compte ne voient pas cette campagne.', verdict: 'check' })
  }
  if (input.conditions && input.conditions.children.length > 0) {
    rows.push({ id: 'rules', group, label: 'Règles d’audience', detail: 'Seulement les comptes qui remplissent les règles du ciblage.', verdict: 'check' })
  }
  const sample = input.samplePercent
  if (typeof sample === 'number' && sample < 100) {
    rows.push({ id: 'sample', group, label: 'Tirage au sort', detail: `Seulement ${sample} % des comptes concernés, tirés au sort.`, verdict: 'check' })
  }
  return rows
}

function trigger(input: VideoModalInput): ConditionRow[] {
  const group = 'Déclencheur' as const
  const triggers = input.triggers
  const situations = input.situations ?? []
  const rows: ConditionRow[] = []
  if (triggers.length === 0 && situations.length === 0) {
    rows.push({ id: 'trigger', group, label: 'Déclencheur', detail: 'Aucun déclencheur ni situation : rien ne l’ouvre jamais.', verdict: 'block' })
  } else {
    rows.push({
      id: 'trigger', group, label: 'Déclencheur',
      detail: triggers.length > 0
        ? `Ouvert seulement quand l’un des ${triggers.length} déclencheurs choisis se produit.`
        : 'Ouvert seulement quand une des situations choisies est vraie (vérifiée par le serveur).',
      verdict: 'ok',
    })
  }
  if (input.frequency === 'EVERY_TIME' && triggers.some(t => !isMomentTrigger(t))) {
    rows.push({
      id: 'every-time', group, label: 'Fréquence « À chaque fois »',
      detail: 'Réservée aux moments d’action : retire les déclencheurs d’écran ou de bouton, sinon l’enregistrement est refusé.', verdict: 'block',
    })
  }
  const corridors = (input.corridors ?? []).filter(c => c.from || c.to)
  if (corridors.length > 0 && triggers.some(t => CORRIDOR_TRIGGERS.includes(t))) {
    const list = corridors.map(c => `${c.from || 'n’importe où'} vers ${c.to || 'n’importe où'}`).join(', ')
    rows.push({ id: 'corridors', group, label: 'Trajet ou colis précis', detail: `Seulement pour : ${list}.`, verdict: 'check' })
  }
  if (triggers.includes('SEARCH_FEW_RESULTS')) {
    rows.push({ id: 'few-results', group, label: 'Peu de résultats', detail: `Seulement si la recherche donne ${input.triggerOptions?.fewResultsMax ?? '…'} résultats ou moins.`, verdict: 'check' })
  }
  if (triggers.includes('TRIP_VIEWED_REPEATEDLY')) {
    rows.push({ id: 'trip-viewed', group, label: 'Même trajet consulté', detail: `Seulement après ${input.triggerOptions?.tripViewedTimes ?? '…'} consultations du même trajet.`, verdict: 'check' })
  }
  return rows
}

function repetition(input: VideoModalInput): ConditionRow[] {
  const group = 'Répétition' as const
  const f = input.frequency ?? 'UP_TO_N'
  const rows: ConditionRow[] = []
  let freq = ''
  let verdict: Verdict = 'check'
  if (f === 'ONCE' || (f === 'UP_TO_N' && input.maxDisplays === 1)) freq = 'Une seule fois par version, puis plus jamais.'
  else if (f === 'UP_TO_N') freq = `Au plus ${input.maxDisplays} affichages par version : le plafond atteint, plus rien.`
  else if (f === 'EVERY_OPEN') freq = 'Au plus une fois par ouverture de l’app.'
  else if (f === 'EVERY_N_DAYS') freq = `Au plus une fois tous les ${input.frequencyDays ?? '…'} jours.`
  else {
    freq = 'Sans plafond : à chaque occurrence de l’action, tant que la campagne est active.'
    verdict = 'ok'
  }
  rows.push({ id: 'frequency', group, label: 'Fréquence', detail: freq, verdict })
  rows.push({
    id: 'stop-after-answer', group, label: 'Après un bouton touché',
    detail: input.stopAfterAnswer ? 'Plus affiché pour cette version dès qu’un bouton est touché.' : 'Continue d’être affiché même après un bouton touché.',
    verdict: input.stopAfterAnswer ? 'check' : 'ok',
  })
  rows.push({
    id: 'dont-show', group, label: 'Case « Ne plus afficher »',
    detail: input.allowDontShowAgain ? 'Cochée par la personne : plus jamais affiché, quelle que soit la fréquence.' : 'Pas de case : la personne ne peut pas le couper elle-même.',
    verdict: input.allowDontShowAgain ? 'check' : 'ok',
  })
  rows.push({ id: 'daily', group, label: 'Plafond quotidien', detail: 'Au maximum 1 modal par jour et par personne, tous types confondus.', verdict: 'check' })
  const screenTriggers = input.triggers.filter(t => !isMomentTrigger(t) && !NO_DELAY_TRIGGERS.includes(t))
  if (screenTriggers.length > 0) {
    rows.push({ id: 'delay', group, label: 'Délai d’ouverture', detail: `Ouvert ${OPEN_DELAY_SECONDS} secondes après l’arrivée sur l’écran ; si la personne est partie, rien.`, verdict: 'check' })
  }
  return rows
}

function content(input: VideoModalInput, errors: VideoModalErrors): ConditionRow[] {
  const group = 'Contenu' as const
  if (input.type === 'INFO') {
    const bad = errors.primaryAction || errors.primaryUrl || errors.secondaryAction || errors.secondaryUrl || errors.imageMode
    return [{
      id: 'content', group, label: 'Boutons et image de l’information',
      detail: bad ? `À corriger : ${bad}` : 'Boutons, actions et image valides.',
      verdict: bad ? 'block' : 'ok',
    }]
  }
  return [{
    id: 'content', group, label: 'Lien YouTube de la vidéo',
    detail: errors.youtubeUrl ? `À corriger : ${errors.youtubeUrl}` : 'Lien YouTube valide.',
    verdict: errors.youtubeUrl ? 'block' : 'ok',
  }]
}

/** Règles automatiques de l'app : les mêmes pour toutes les campagnes, sauf la case « un seul par lancement ». */
function commonRules(input: VideoModalInput): string[] {
  const info = input.type === 'INFO'
  const kind = info ? 'information' : 'vidéo'
  const other = info ? 'vidéo' : 'information'
  const everyTime = input.frequency === 'EVERY_TIME'
  return [
    'Jamais deux modals en même temps.',
    `Un seul modal par lancement dans chaque case indépendante. Cette ${info ? 'information' : 'vidéo'} a sa propre case (${kind}, déclencheur d’écran ou d’action) : une ${other} ne la bloque pas.${everyTime ? ' Exception : la fréquence « À chaque fois » n’est pas limitée à un par lancement.' : ''}`,
    'Un modal d’action est abandonné s’il n’a pas pu s’ouvrir au bout de 2 minutes.',
    'Pas d’ouverture si la personne saisit du texte, si une autre page recouvre l’écran ou si l’app est en arrière-plan.',
    'Les campagnes sont rechargées au retour au premier plan après 15 minutes.',
  ]
}

export function buildDisplayConditions(input: VideoModalInput, ctx: DisplayConditionsContext): DisplayConditions {
  const rows = [
    ...statusAndPeriod(input, ctx, ctx.now ?? new Date()),
    ...versionAndAudience(input),
    ...trigger(input),
    ...content(input, ctx.errors ?? {}),
    ...repetition(input),
  ]
  return { rows, common: commonRules(input), blocked: rows.some(r => r.verdict === 'block') }
}
