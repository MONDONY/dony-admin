import { extractYoutubeId } from '@/features/video-modals/lib/youtube'
import { httpsUrlError } from '@/features/video-modals/lib/url'
import {
  BODY_MAX_LENGTH, FREQUENCY_DAYS_MAX, FREQUENCY_DAYS_MIN, HIGHLIGHT_ICONS, IMAGE_ALT_MAX_LENGTH, IMAGE_FITS, IMAGE_MODES, INFO_SCREENS, MAX_HIGHLIGHTS,
  MODAL_FREQUENCIES, MODAL_ICONS, MODAL_LAYOUTS, MODAL_PLATFORMS, SAMPLE_MAX, SAMPLE_MIN, SITUATIONS, SIZE_MAX, SIZE_MIN, VIDEO_MODAL_TRIGGERS,
  type VideoModalAction, type VideoModalInput,
} from '@/features/video-modals/types/index'

export type VideoModalField =
  | 'name' | 'youtubeUrl' | 'durationSeconds' | 'titleFr' | 'primaryLabelFr' | 'secondaryLabelFr'
  | 'highlights' | 'triggers' | 'maxDisplays' | 'period'
  | 'bodyFr' | 'bodyEn' | 'icon' | 'primaryAction' | 'primaryUrl' | 'secondaryAction' | 'secondaryUrl'
  | 'primaryLabelEn' | 'secondaryLabelEn'
  | 'layout' | 'sizePercent' | 'imageMode' | 'imageFit' | 'imageAltFr' | 'imageAltEn'
  | 'frequency' | 'frequencyDays' | 'priority' | 'conditions' | 'minAppVersion' | 'maxAppVersion' | 'platforms' | 'samplePercent' | 'situations'

export type VideoModalErrors = Partial<Record<VideoModalField, string>>

export const MAX_DISPLAYS_MIN = 1
export const MAX_DISPLAYS_MAX = 10
/** Au-delà, un libellé de bouton risque de ne plus tenir sur une ligne dans l'app (360 dp). */
export const BUTTON_LABEL_SOFT_LIMIT = 26

export interface ValidationOptions {
  /** Une image est déjà envoyée, ou choisie pour être envoyée juste après la création. */
  hasImage?: boolean
  /** Les conditions du constructeur de règles sont toutes complètes (faux : refus, le back dirait 422). */
  conditionsComplete?: boolean
}

const blank = (s: string | null | undefined) => !s || s.trim().length === 0

/**
 * Mêmes règles que le back (422 sinon) : lien YouTube reconnu, au moins un déclencheur,
 * 0 à 3 points forts, titre FR obligatoire, `maxDisplays` de 1 à 10, fin après le début.
 * En plus, côté admin seulement : nom de la campagne, libellés FR des deux boutons et texte FR
 * de chaque point fort, sans lesquels l'app afficherait un bouton ou une ligne vide.
 */
export function validateVideoModal(input: VideoModalInput, opts: ValidationOptions = {}): VideoModalErrors {
  if (input.type === 'INFO') return validateInfoModal(input, opts)
  const errors: VideoModalErrors = {}
  validateFormat(input, errors)

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

  validateSchedule(input, errors, opts)
  return errors
}

/** Format et taille : valeurs connues, taille entière de 30 à 100 (ou automatique). */
function validateFormat(input: VideoModalInput, errors: VideoModalErrors) {
  if (input.layout !== undefined && !(MODAL_LAYOUTS as readonly string[]).includes(input.layout)) {
    errors.layout = 'Choisissez un format de la liste.'
  }
  const size = input.sizePercent
  if (size !== undefined && size !== null && (!Number.isInteger(size) || size < SIZE_MIN || size > SIZE_MAX)) {
    errors.sizePercent = `Taille entre ${SIZE_MIN} et ${SIZE_MAX} % de la hauteur de l’écran.`
  }
}

function validateImage(input: VideoModalInput, errors: VideoModalErrors, opts: ValidationOptions) {
  if (input.imageMode !== undefined && !(IMAGE_MODES as readonly string[]).includes(input.imageMode)) {
    errors.imageMode = 'Choisissez un mode d’image de la liste.'
  } else if (input.imageMode && input.imageMode !== 'NONE' && !opts.hasImage) {
    errors.imageMode = 'Envoyez une image, ou choisissez « Aucune ».'
  }
  if (input.imageFit !== undefined && !(IMAGE_FITS as readonly string[]).includes(input.imageFit)) {
    errors.imageFit = 'Choisissez un cadrage de la liste.'
  }
  if ((input.imageAltFr ?? '').trim().length > IMAGE_ALT_MAX_LENGTH) errors.imageAltFr = `${IMAGE_ALT_MAX_LENGTH} caractères au plus.`
  if ((input.imageAltEn ?? '').trim().length > IMAGE_ALT_MAX_LENGTH) errors.imageAltEn = `${IMAGE_ALT_MAX_LENGTH} caractères au plus.`
}

const VERSION_RE = /^\d+\.\d+\.\d+$/

/** Compare deux versions `x.y.z` composante par composante. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! < pb[i]! ? -1 : 1
  }
  return 0
}

/**
 * Moment, fréquence, ciblage, priorité et période : mêmes règles que le back (422 sinon). Au moins
 * un déclencheur ou une situation ; `frequencyDays` de 1 à 365 pour « tous les N jours » ; versions
 * `x.y.z` (min avant max) ; tirage de 1 à 100 ; valeur de chaque situation dans ses bornes.
 */
function validateSchedule(input: VideoModalInput, errors: VideoModalErrors, opts: ValidationOptions) {
  const knownTriggers = input.triggers.filter(t => (VIDEO_MODAL_TRIGGERS as readonly string[]).includes(t))
  if (knownTriggers.length === 0 && (input.situations ?? []).length === 0) {
    errors.triggers = 'Choisissez au moins un endroit (écran ou bouton) ou une situation.'
  }

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

  validateFrequency(input, errors)
  validateTargeting(input, errors, opts)
}

function validateFrequency(input: VideoModalInput, errors: VideoModalErrors) {
  if (input.frequency !== undefined && !(MODAL_FREQUENCIES as readonly string[]).includes(input.frequency)) {
    errors.frequency = 'Choisissez une fréquence de la liste.'
  }
  if (input.frequency === 'EVERY_N_DAYS') {
    const d = input.frequencyDays
    if (typeof d !== 'number' || !Number.isInteger(d) || d < FREQUENCY_DAYS_MIN || d > FREQUENCY_DAYS_MAX) {
      errors.frequencyDays = `Nombre de jours entier, de ${FREQUENCY_DAYS_MIN} à ${FREQUENCY_DAYS_MAX}.`
    }
  }
  if (input.priority !== undefined && !Number.isInteger(input.priority)) errors.priority = 'Priorité : nombre entier.'
}

function validateTargeting(input: VideoModalInput, errors: VideoModalErrors, opts: ValidationOptions) {
  if (opts.conditionsComplete === false) {
    errors.conditions = 'Complétez ou retirez les conditions incomplètes.'
  }

  const min = input.minAppVersion?.trim() || null
  const max = input.maxAppVersion?.trim() || null
  if (min && !VERSION_RE.test(min)) errors.minAppVersion = 'Version au format 1.2.3.'
  if (max && !VERSION_RE.test(max)) errors.maxAppVersion = 'Version au format 1.2.3.'
  if (min && max && !errors.minAppVersion && !errors.maxAppVersion && compareVersions(min, max) > 0) {
    errors.maxAppVersion = 'La version maximale doit être au moins égale à la minimale.'
  }

  if ((input.platforms ?? []).some(p => !(MODAL_PLATFORMS as readonly string[]).includes(p))) {
    errors.platforms = 'Système inconnu.'
  }

  const sample = input.samplePercent
  if (sample !== undefined && (!Number.isInteger(sample) || sample < SAMPLE_MIN || sample > SAMPLE_MAX)) {
    errors.samplePercent = `Pourcentage entier, de ${SAMPLE_MIN} à ${SAMPLE_MAX}.`
  }

  const situations = input.situations ?? []
  for (const [i, sit] of situations.entries()) {
    const spec = SITUATIONS[sit.kind]
    if (!spec) {
      errors.situations = 'Situation inconnue.'
      break
    }
    if (situations.findIndex(x => x.kind === sit.kind) !== i) {
      errors.situations = 'Chaque situation ne peut être choisie qu’une fois.'
      break
    }
    if (spec.unit) {
      const v = sit.value
      if (typeof v !== 'number' || !Number.isInteger(v) || v < spec.min || v > spec.max) {
        errors.situations = `${spec.before || 'Valeur'} : ${spec.unit === 'HOURS' ? 'nombre d’heures' : 'nombre de jours'} entier de ${spec.min} à ${spec.max}.`
        break
      }
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
function validateInfoModal(input: VideoModalInput, opts: ValidationOptions): VideoModalErrors {
  const errors: VideoModalErrors = {}
  validateFormat(input, errors)
  validateImage(input, errors, opts)
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

  validateSchedule(input, errors, opts)
  return errors
}

export function hasErrors(errors: VideoModalErrors): boolean {
  return Object.keys(errors).length > 0
}
