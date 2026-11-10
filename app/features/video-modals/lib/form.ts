import type { AdminVideoModal, ImageFit, ImageMode, ModalIcon, ModalLayout, VideoModalAction, VideoModalInput, VideoModalTrigger, VideoModalType } from '@/features/video-modals/types/index'

/** État du formulaire : comme le corps d'API, mais les dates au format d'un `<input type="datetime-local">`. */
export interface VideoModalFormState extends Omit<VideoModalInput, 'startsAt' | 'endsAt' | 'durationSeconds' | 'youtubeUrl' | 'bodyFr' | 'bodyEn' | 'icon' | 'primaryAction' | 'secondaryAction' | 'layout' | 'sizePercent' | 'imageMode' | 'imageFit' | 'imageAltFr' | 'imageAltEn'> {
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
  }
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
      maxDisplays: Number(s.maxDisplays),
      startsAt: localInputToIso(s.startsAt),
      endsAt: localInputToIso(s.endsAt),
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
    maxDisplays: Number(s.maxDisplays),
    startsAt: localInputToIso(s.startsAt),
    endsAt: localInputToIso(s.endsAt),
  }
}

/** Texte dans la langue d'aperçu, avec le même repli que le back : FR quand l'EN est vide. */
export function localized(fr: string, en: string, lang: 'fr' | 'en'): string {
  return lang === 'en' && en.trim() ? en : fr
}
