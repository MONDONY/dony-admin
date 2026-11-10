import { extractYoutubeId } from '@/features/video-modals/lib/youtube'
import { httpsUrlError } from '@/features/video-modals/lib/url'
import {
  BODY_MAX_LENGTH, HIGHLIGHT_ICONS, INFO_SCREENS, MAX_HIGHLIGHTS, MODAL_ICONS, VIDEO_MODAL_TRIGGERS,
  type VideoModalAction, type VideoModalInput,
} from '@/features/video-modals/types/index'

export type VideoModalField =
  | 'name' | 'youtubeUrl' | 'durationSeconds' | 'titleFr' | 'primaryLabelFr' | 'secondaryLabelFr'
  | 'highlights' | 'triggers' | 'maxDisplays' | 'period'
  | 'bodyFr' | 'bodyEn' | 'icon' | 'primaryAction' | 'primaryUrl' | 'secondaryAction' | 'secondaryUrl'
  | 'primaryLabelEn' | 'secondaryLabelEn'

export type VideoModalErrors = Partial<Record<VideoModalField, string>>

export const MAX_DISPLAYS_MIN = 1
export const MAX_DISPLAYS_MAX = 10
/** Au-delà, un libellé de bouton risque de ne plus tenir sur une ligne dans l'app (360 dp). */
export const BUTTON_LABEL_SOFT_LIMIT = 26

const blank = (s: string | null | undefined) => !s || s.trim().length === 0

/**
 * Mêmes règles que le back (422 sinon) : lien YouTube reconnu, au moins un déclencheur,
 * 0 à 3 points forts, titre FR obligatoire, `maxDisplays` de 1 à 10, fin après le début.
 * En plus, côté admin seulement : nom de la campagne, libellés FR des deux boutons et texte FR
 * de chaque point fort, sans lesquels l'app afficherait un bouton ou une ligne vide.
 */
export function validateVideoModal(input: VideoModalInput): VideoModalErrors {
  if (input.type === 'INFO') return validateInfoModal(input)
  const errors: VideoModalErrors = {}

  if (blank(input.name)) errors.name = 'Donnez un nom à la campagne.'
  if (!extractYoutubeId(input.youtubeUrl)) {
    errors.youtubeUrl = blank(input.youtubeUrl)
      ? 'Collez le lien de la vidéo YouTube.'
      : 'Lien non reconnu : youtu.be/…, youtube.com/watch?v=…, /shorts/… ou /embed/…'
  }
  if (input.durationSeconds !== null && (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 0)) {
    errors.durationSeconds = 'Durée en secondes, nombre entier positif.'
  }
  if (blank(input.titleFr)) errors.titleFr = 'Le titre en français est obligatoire.'
  if (blank(input.primaryLabelFr)) errors.primaryLabelFr = 'Libellé du bouton principal obligatoire.'
  if (blank(input.secondaryLabelFr)) errors.secondaryLabelFr = 'Libellé du bouton secondaire obligatoire.'

  if (input.highlights.length > MAX_HIGHLIGHTS) {
    errors.highlights = `Trois points forts au plus.`
  } else if (input.highlights.some(h => !(HIGHLIGHT_ICONS as readonly string[]).includes(h.icon))) {
    errors.highlights = 'Choisissez une icône pour chaque point fort.'
  } else if (input.highlights.some(h => blank(h.textFr))) {
    errors.highlights = 'Chaque point fort a besoin d’un texte en français.'
  }

  const knownTriggers = input.triggers.filter(t => (VIDEO_MODAL_TRIGGERS as readonly string[]).includes(t))
  if (knownTriggers.length === 0) errors.triggers = 'Choisissez au moins un endroit où afficher le modal.'

  if (!Number.isInteger(input.maxDisplays) || input.maxDisplays < MAX_DISPLAYS_MIN || input.maxDisplays > MAX_DISPLAYS_MAX) {
    errors.maxDisplays = `Entre ${MAX_DISPLAYS_MIN} et ${MAX_DISPLAYS_MAX} affichages.`
  }

  if (input.startsAt && input.endsAt) {
    const start = Date.parse(input.startsAt)
    const end = Date.parse(input.endsAt)
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      errors.period = 'La fin doit être après le début.'
    }
  }

  return errors
}

function validateSchedule(input: VideoModalInput, errors: VideoModalErrors) {
  const knownTriggers = input.triggers.filter(t => (VIDEO_MODAL_TRIGGERS as readonly string[]).includes(t))
  if (knownTriggers.length === 0) errors.triggers = 'Choisissez au moins un endroit où afficher le modal.'

  if (!Number.isInteger(input.maxDisplays) || input.maxDisplays < MAX_DISPLAYS_MIN || input.maxDisplays > MAX_DISPLAYS_MAX) {
    errors.maxDisplays = `Entre ${MAX_DISPLAYS_MIN} et ${MAX_DISPLAYS_MAX} affichages.`
  }

  if (input.startsAt && input.endsAt) {
    const start = Date.parse(input.startsAt)
    const end = Date.parse(input.endsAt)
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      errors.period = 'La fin doit être après le début.'
    }
  }
}

/** Erreur d'une action de bouton Information, ou null. `screen` et `url` sont les clés d'erreur dédiées. */
function actionError(action: VideoModalAction | null | undefined, labelFr: string): { action?: string; url?: string; label?: string } {
  if (!action) return { action: 'Choisissez ce que fait le bouton.' }
  if (action.kind === 'SCREEN') {
    if (!action.screen || !(INFO_SCREENS as readonly string[]).includes(action.screen)) return { action: 'Choisissez un écran de l’app.' }
    if (blank(labelFr)) return { label: 'Libellé obligatoire pour ouvrir un écran.' }
  } else if (action.kind === 'URL') {
    const urlErr = httpsUrlError(action.url)
    if (urlErr) return { url: urlErr }
    if (blank(labelFr)) return { label: 'Libellé obligatoire pour ouvrir un lien.' }
  } else if (action.kind !== 'CLOSE') {
    return { action: 'Choisissez ce que fait le bouton.' }
  }
  return {}
}

/**
 * Modal Information : nom, titre FR, texte FR de 1 à 500 caractères, bouton principal avec une
 * action valide, bouton secondaire facultatif. Le libellé FR est obligatoire pour un écran ou un
 * lien (« OK » par défaut pour Fermer), 26 caractères au plus. Lien https uniquement.
 */
function validateInfoModal(input: VideoModalInput): VideoModalErrors {
  const errors: VideoModalErrors = {}
  if (blank(input.name)) errors.name = 'Donnez un nom à la campagne.'
  if (blank(input.titleFr)) errors.titleFr = 'Le titre en français est obligatoire.'
  if (blank(input.bodyFr)) errors.bodyFr = 'Le texte en français est obligatoire.'
  else if (input.bodyFr!.trim().length > BODY_MAX_LENGTH) errors.bodyFr = `Texte trop long (${BODY_MAX_LENGTH} caractères au plus).`
  if ((input.bodyEn ?? '').trim().length > BODY_MAX_LENGTH) errors.bodyEn = `Texte trop long (${BODY_MAX_LENGTH} caractères au plus).`
  if (input.icon && !(MODAL_ICONS as readonly string[]).includes(input.icon)) errors.icon = 'Choisissez une icône de la liste.'

  const p = actionError(input.primaryAction, input.primaryLabelFr)
  if (p.action) errors.primaryAction = p.action
  if (p.url) errors.primaryUrl = p.url
  if (p.label) errors.primaryLabelFr = p.label
  if (input.primaryLabelFr.trim().length > BUTTON_LABEL_SOFT_LIMIT) errors.primaryLabelFr = `${BUTTON_LABEL_SOFT_LIMIT} caractères au plus, pour tenir sur une ligne.`
  if (input.primaryLabelEn.trim().length > BUTTON_LABEL_SOFT_LIMIT) errors.primaryLabelEn = `${BUTTON_LABEL_SOFT_LIMIT} caractères au plus, pour tenir sur une ligne.`

  if (input.secondaryAction) {
    const sec = actionError(input.secondaryAction, input.secondaryLabelFr)
    if (sec.action) errors.secondaryAction = sec.action
    if (sec.url) errors.secondaryUrl = sec.url
    if (sec.label) errors.secondaryLabelFr = sec.label
    if (input.secondaryLabelFr.trim().length > BUTTON_LABEL_SOFT_LIMIT) errors.secondaryLabelFr = `${BUTTON_LABEL_SOFT_LIMIT} caractères au plus, pour tenir sur une ligne.`
    if (input.secondaryLabelEn.trim().length > BUTTON_LABEL_SOFT_LIMIT) errors.secondaryLabelEn = `${BUTTON_LABEL_SOFT_LIMIT} caractères au plus, pour tenir sur une ligne.`
  }

  validateSchedule(input, errors)
  return errors
}

export function hasErrors(errors: VideoModalErrors): boolean {
  return Object.keys(errors).length > 0
}
