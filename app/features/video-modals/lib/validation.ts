import { extractYoutubeId } from '@/features/video-modals/lib/youtube'
import { HIGHLIGHT_ICONS, MAX_HIGHLIGHTS, VIDEO_MODAL_TRIGGERS, type VideoModalInput } from '@/features/video-modals/types/index'

export type VideoModalField =
  | 'name' | 'youtubeUrl' | 'durationSeconds' | 'titleFr' | 'primaryLabelFr' | 'secondaryLabelFr'
  | 'highlights' | 'triggers' | 'maxDisplays' | 'period'

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

export function hasErrors(errors: VideoModalErrors): boolean {
  return Object.keys(errors).length > 0
}
