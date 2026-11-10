/**
 * Modals vidéo : contrat back / admin / app validé le 10/11/2026
 * (`maquettes/modal-video-contrat.md`). Une campagne = un modal, avec ses déclencheurs et ses versions.
 */

export const VIDEO_MODAL_TRIGGERS = [
  'SEARCH_TAB', 'ACTIVITIES_TAB', 'TRACKING_TAB', 'MESSAGES_TAB', 'PROFILE_TAB',
  'APP_OPEN', 'PUBLISH_TRIP', 'SEND_PARCEL',
] as const
export type VideoModalTrigger = typeof VIDEO_MODAL_TRIGGERS[number]

export const TRIGGER_LABELS: Record<VideoModalTrigger, string> = {
  SEARCH_TAB: 'Arrivée sur Rechercher',
  ACTIVITIES_TAB: 'Onglet Activités',
  TRACKING_TAB: 'Onglet Suivi',
  MESSAGES_TAB: 'Onglet Messages',
  PROFILE_TAB: 'Onglet Moi',
  APP_OPEN: 'Ouverture de l’app (tout écran)',
  PUBLISH_TRIP: 'Touche « Publier un trajet »',
  SEND_PARCEL: 'Touche « Envoyer un colis »',
}

/** Libellés courts pour la liste des campagnes. */
export const TRIGGER_SHORT_LABELS: Record<VideoModalTrigger, string> = {
  SEARCH_TAB: 'Rechercher',
  ACTIVITIES_TAB: 'Activités',
  TRACKING_TAB: 'Suivi',
  MESSAGES_TAB: 'Messages',
  PROFILE_TAB: 'Moi',
  APP_OPEN: 'Ouverture',
  PUBLISH_TRIP: 'Publier un trajet',
  SEND_PARCEL: 'Envoyer un colis',
}

export const VIDEO_MODAL_AUDIENCES = ['NEVER_ANSWERED', 'EVERYONE', 'NOT_WATCHED_PREVIOUS'] as const
export type VideoModalAudience = typeof VIDEO_MODAL_AUDIENCES[number]

export const AUDIENCE_LABELS: Record<VideoModalAudience, { label: string; hint: string }> = {
  NEVER_ANSWERED: { label: 'Ceux qui n’ont jamais répondu', hint: 'Nouveaux et anciens qui ne l’ont pas encore vue' },
  EVERYONE: { label: 'Tout le monde, même ceux qui ont déjà répondu', hint: 'Pour une nouvelle vidéo importante' },
  NOT_WATCHED_PREVIOUS: { label: 'Ceux qui n’ont pas regardé la vidéo précédente', hint: 'Deuxième chance pour ceux qui avaient ignoré' },
}

export const HIGHLIGHT_ICONS = ['PARCEL', 'SUITCASE', 'LOCK', 'SEARCH', 'CHAT', 'QR', 'STAR', 'WALLET'] as const
export type HighlightIcon = typeof HIGHLIGHT_ICONS[number]

export const ICON_LABELS: Record<HighlightIcon, string> = {
  PARCEL: 'Colis',
  SUITCASE: 'Valise',
  LOCK: 'Cadenas',
  SEARCH: 'Loupe',
  CHAT: 'Message',
  QR: 'QR code',
  STAR: 'Étoile',
  WALLET: 'Portefeuille',
}

export const MAX_HIGHLIGHTS = 3

export interface VideoModalHighlight {
  icon: HighlightIcon
  textFr: string
  textEn: string
}

/** Corps de `POST` et `PUT /admin/video-modals`. */
export interface VideoModalInput {
  name: string
  youtubeUrl: string
  durationSeconds: number | null
  titleFr: string
  titleEn: string
  subtitleFr: string
  subtitleEn: string
  primaryLabelFr: string
  primaryLabelEn: string
  secondaryLabelFr: string
  secondaryLabelEn: string
  highlights: VideoModalHighlight[]
  triggers: VideoModalTrigger[]
  maxDisplays: number
  startsAt: string | null
  endsAt: string | null
}

/** Nombre d'utilisateurs distincts sur la version courante. */
export interface VideoModalStats {
  shown: number
  opened: number
  completed: number
  dismissed: number
}

export interface AdminVideoModal extends VideoModalInput {
  id: string
  active: boolean
  version: number
  audience: VideoModalAudience
  versionPublishedAt: string | null
  youtubeVideoId: string | null
  createdAt: string
  updatedAt: string
  stats: VideoModalStats | null
}

/** Corps de `POST /admin/video-modals/{id}/versions`. */
export interface NewVersionInput {
  audience: VideoModalAudience
  youtubeUrl?: string
}
