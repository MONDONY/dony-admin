import type { WireGroup } from '@/features/broadcast/composables/audienceRule'
import {
  SITUATIONS, type AdminVideoModal, type ImageFit, type ImageMode, type ModalFrequency, type ModalIcon, type ModalLayout, type ModalPlatform,
  type ModalSituation, type SituationKind, type VideoModalAction, type VideoModalInput, type VideoModalTrigger, type VideoModalType,
} from '@/features/video-modals/types/index'

/** Situation en cours de saisie : la valeur peut être vide ou du texte tant qu'elle n'est pas validée. */
export interface SituationDraft {
  kind: SituationKind
  value: number | string | null
}

/** État du formulaire : comme le corps d'API, mais les dates au format d'un `<input type="datetime-local">`. */
export interface VideoModalFormState extends Omit<VideoModalInput, 'startsAt' | 'endsAt' | 'durationSeconds' | 'youtubeUrl' | 'bodyFr' | 'bodyEn' | 'icon' | 'primaryAction' | 'secondaryAction' | 'layout' | 'sizePercent' | 'imageMode' | 'imageFit' | 'imageAltFr' | 'imageAltEn' | 'frequency' | 'frequencyDays' | 'stopAfterAnswer' | 'allowDontShowAgain' | 'priority' | 'connectedOnly' | 'conditions' | 'minAppVersion' | 'maxAppVersion' | 'platforms' | 'samplePercent' | 'situations' | 'audience'> {
  youtubeUrl: string
  durationSeconds: number | string | null
  startsAt: string
  endsAt: string
  /** Modal Information. */
  bodyFr: string
  bodyEn: string
  icon: ModalIcon
  primaryAction: VideoModalAction
  /** Le bouton secondaire est facultatif : décoché, aucune action n'est envoyée. */
  secondaryEnabled: boolean
  secondaryAction: VideoModalAction
  /** Format et taille ; `sizePercent` null = automatique. */
  layout: ModalLayout
  sizePercent: number | null
  /** Image (Information seulement). */
  imageMode: ImageMode
  imageFit: ImageFit
  imageAltFr: string
  imageAltEn: string
  /** Fréquence : `maxDisplays` sert à « jusqu'à N fois », `frequencyDays` à « tous les N jours ». */
  frequency: ModalFrequency
  frequencyDays: number | string | null
  stopAfterAnswer: boolean
  allowDontShowAgain: boolean
  priority: number | string
  /** Ciblage. `conditions` est l'arbre de règles de la Diffusion tel que le back l'échange (null = aucune). */
  connectedOnly: boolean
  conditions: WireGroup | null
  minAppVersion: string
  maxAppVersion: string
  platforms: ModalPlatform[]
  samplePercent: number | string
  situations: SituationDraft[]
}

export const closeAction = (): VideoModalAction => ({ kind: 'CLOSE', screen: null, url: null })

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO (UTC) vers `AAAA-MM-JJTHH:mm` à l'heure locale du navigateur ; vide si absent ou illisible. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** `AAAA-MM-JJTHH:mm` (heure locale) vers ISO UTC ; null si vide ou illisible. */
export function localInputToIso(local: string | null | undefined): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function defaultFormState(triggers: VideoModalTrigger[] = ['SEARCH_TAB'], type: VideoModalType = 'VIDEO'): VideoModalFormState {
  const info = type === 'INFO'
  return {
    type,
    name: '',
    youtubeUrl: '',
    durationSeconds: null,
    titleFr: '',
    titleEn: '',
    subtitleFr: '',
    subtitleEn: '',
    primaryLabelFr: info ? 'OK' : 'Voir la vidéo',
    primaryLabelEn: info ? 'OK' : 'Watch the video',
    secondaryLabelFr: info ? '' : 'Commencer',
    secondaryLabelEn: info ? '' : 'Get started',
    highlights: [],
    bodyFr: '',
    bodyEn: '',
    icon: 'INFO',
    primaryAction: closeAction(),
    secondaryEnabled: false,
    secondaryAction: closeAction(),
    triggers: [...triggers],
    maxDisplays: 3,
    startsAt: '',
    endsAt: '',
    layout: 'BOTTOM_SHEET',
    sizePercent: null,
    imageMode: 'NONE',
    imageFit: 'COVER',
    imageAltFr: '',
    imageAltEn: '',
    // Vidéo : une seule fois par version, s'arrête après une réponse. Information : même départ, au choix ensuite.
    frequency: 'ONCE',
    frequencyDays: 7,
    stopAfterAnswer: true,
    allowDontShowAgain: false,
    priority: 0,
    connectedOnly: false,
    conditions: null,
    minAppVersion: '',
    maxAppVersion: '',
    platforms: [],
    samplePercent: 100,
    situations: [],
  }
}

/** Arbre de règles sans condition (null, absent ou groupe vide) = aucune condition. */
export function normalizeConditions(c: unknown): WireGroup | null {
  const children = (c as { children?: unknown } | null | undefined)?.children
  return Array.isArray(children) && children.length > 0 ? (c as WireGroup) : null
}

function actionFrom(a: VideoModalAction | null | undefined): VideoModalAction {
  return a ? { kind: a.kind, screen: a.screen ?? null, url: a.url ?? null } : closeAction()
}

export function formStateFromModal(m: AdminVideoModal): VideoModalFormState {
  return {
    type: m.type ?? 'VIDEO',
    bodyFr: m.bodyFr ?? '',
    bodyEn: m.bodyEn ?? '',
    icon: m.icon ?? 'INFO',
    primaryAction: actionFrom(m.primaryAction),
    secondaryEnabled: !!m.secondaryAction,
    secondaryAction: actionFrom(m.secondaryAction),
    name: m.name ?? '',
    youtubeUrl: m.youtubeUrl ?? '',
    durationSeconds: m.durationSeconds ?? null,
    titleFr: m.titleFr ?? '',
    titleEn: m.titleEn ?? '',
    subtitleFr: m.subtitleFr ?? '',
    subtitleEn: m.subtitleEn ?? '',
    primaryLabelFr: m.primaryLabelFr ?? '',
    primaryLabelEn: m.primaryLabelEn ?? '',
    secondaryLabelFr: m.secondaryLabelFr ?? '',
    secondaryLabelEn: m.secondaryLabelEn ?? '',
    highlights: (m.highlights ?? []).map(h => ({ icon: h.icon, textFr: h.textFr ?? '', textEn: h.textEn ?? '' })),
    triggers: [...(m.triggers ?? [])],
    maxDisplays: m.maxDisplays ?? 3,
    startsAt: isoToLocalInput(m.startsAt),
    endsAt: isoToLocalInput(m.endsAt),
    // Campagne d'avant le format : feuille du bas, taille automatique, sans image.
    layout: m.layout ?? 'BOTTOM_SHEET',
    sizePercent: m.sizePercent ?? null,
    imageMode: m.imageMode ?? 'NONE',
    imageFit: m.imageFit ?? 'COVER',
    imageAltFr: m.imageAltFr ?? '',
    imageAltEn: m.imageAltEn ?? '',
    // Campagne d'avant le ciblage : jusqu'à `maxDisplays` fois, arrêt après une réponse, tout le monde.
    frequency: m.frequency ?? 'UP_TO_N',
    frequencyDays: m.frequencyDays ?? 7,
    stopAfterAnswer: m.stopAfterAnswer ?? true,
    allowDontShowAgain: m.allowDontShowAgain ?? false,
    priority: m.priority ?? 0,
    connectedOnly: m.connectedOnly ?? false,
    conditions: normalizeConditions(m.conditions),
    minAppVersion: m.minAppVersion ?? '',
    maxAppVersion: m.maxAppVersion ?? '',
    platforms: [...(m.platforms ?? [])],
    samplePercent: m.samplePercent ?? 100,
    situations: (m.situations ?? []).map(x => ({ kind: x.kind, value: x.value ?? null })),
  }
}

function toDuration(v: number | string | null): number | null {
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? NaN : n
}

function actionBody(a: VideoModalAction): VideoModalAction {
  return {
    kind: a.kind,
    screen: a.kind === 'SCREEN' ? a.screen : null,
    url: a.kind === 'URL' ? (a.url ?? '').trim() : null,
  }
}

/** Nombre d'un champ de saisie : `empty` quand il est vide, NaN quand il est illisible (la validation refuse). */
function toNumber(v: number | string | null | undefined, empty: number | null): number {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return empty as number
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? NaN : n
}

function situationBody(d: SituationDraft): ModalSituation {
  const spec = SITUATIONS[d.kind]
  return { kind: d.kind, value: spec && spec.unit ? toNumber(d.value, null) : null }
}

/** Fréquence, réponses, priorité, ciblage : mêmes champs pour une vidéo et une information. */
function targetingBody(s: VideoModalFormState): Partial<VideoModalInput> {
  return {
    frequency: s.frequency,
    frequencyDays: s.frequency === 'EVERY_N_DAYS' ? toNumber(s.frequencyDays, NaN) : null,
    stopAfterAnswer: s.stopAfterAnswer,
    allowDontShowAgain: s.allowDontShowAgain,
    priority: toNumber(s.priority, 0),
    connectedOnly: s.connectedOnly,
    conditions: s.conditions,
    minAppVersion: s.minAppVersion.trim() || null,
    maxAppVersion: s.maxAppVersion.trim() || null,
    platforms: [...s.platforms],
    samplePercent: toNumber(s.samplePercent, NaN),
    situations: s.situations.map(situationBody),
  }
}

/** « Une seule fois » = jusqu'à 1 fois : le plafond envoyé suit la fréquence choisie. */
const maxDisplaysBody = (s: VideoModalFormState) => (s.frequency === 'ONCE' ? 1 : Number(s.maxDisplays))

/** Plein écran : toujours 100 %, la taille n'est pas envoyée. */
function sizeBody(s: VideoModalFormState): number | null {
  if (s.layout === 'FULLSCREEN' || s.sizePercent === null || (s.sizePercent as unknown) === '') return null
  return Number(s.sizePercent)
}

/**
 * Corps envoyé au back : textes rognés, dates en ISO, nombres en nombres.
 * Un modal Information n'envoie ni lien YouTube, ni durée, ni points forts ; une vidéo n'envoie
 * aucun des champs propres à l'Information.
 */
export function inputFromFormState(s: VideoModalFormState): VideoModalInput {
  if (s.type === 'INFO') {
    return {
      type: 'INFO',
      name: s.name.trim(),
      youtubeUrl: null,
      durationSeconds: null,
      titleFr: s.titleFr.trim(),
      titleEn: s.titleEn.trim(),
      subtitleFr: s.subtitleFr.trim(),
      subtitleEn: s.subtitleEn.trim(),
      bodyFr: s.bodyFr.trim(),
      bodyEn: s.bodyEn.trim(),
      icon: s.icon,
      primaryLabelFr: s.primaryLabelFr.trim(),
      primaryLabelEn: s.primaryLabelEn.trim(),
      primaryAction: actionBody(s.primaryAction),
      secondaryLabelFr: s.secondaryEnabled ? s.secondaryLabelFr.trim() : '',
      secondaryLabelEn: s.secondaryEnabled ? s.secondaryLabelEn.trim() : '',
      secondaryAction: s.secondaryEnabled ? actionBody(s.secondaryAction) : null,
      layout: s.layout,
      sizePercent: sizeBody(s),
      imageMode: s.imageMode,
      imageFit: s.imageFit,
      imageAltFr: s.imageAltFr.trim(),
      imageAltEn: s.imageAltEn.trim(),
      highlights: [],
      triggers: [...s.triggers],
      maxDisplays: maxDisplaysBody(s),
      startsAt: localInputToIso(s.startsAt),
      endsAt: localInputToIso(s.endsAt),
      ...targetingBody(s),
    }
  }
  return {
    type: 'VIDEO',
    name: s.name.trim(),
    youtubeUrl: s.youtubeUrl.trim(),
    durationSeconds: toDuration(s.durationSeconds),
    titleFr: s.titleFr.trim(),
    titleEn: s.titleEn.trim(),
    subtitleFr: s.subtitleFr.trim(),
    subtitleEn: s.subtitleEn.trim(),
    primaryLabelFr: s.primaryLabelFr.trim(),
    primaryLabelEn: s.primaryLabelEn.trim(),
    secondaryLabelFr: s.secondaryLabelFr.trim(),
    secondaryLabelEn: s.secondaryLabelEn.trim(),
    highlights: s.highlights.map(h => ({ icon: h.icon, textFr: h.textFr.trim(), textEn: h.textEn.trim() })),
    layout: s.layout,
    sizePercent: sizeBody(s),
    triggers: [...s.triggers],
    maxDisplays: maxDisplaysBody(s),
    startsAt: localInputToIso(s.startsAt),
    endsAt: localInputToIso(s.endsAt),
    ...targetingBody(s),
  }
}

/** Texte dans la langue d'aperçu, avec le même repli que le back : FR quand l'EN est vide. */
export function localized(fr: string, en: string, lang: 'fr' | 'en'): string {
  return lang === 'en' && en.trim() ? en : fr
}
