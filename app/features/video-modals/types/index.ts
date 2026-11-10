/**
 * Modals (vidéo et information) : contrat back / admin / app validé le 10/11/2026
 * (`maquettes/modal-video-contrat.md` et `maquettes/modal-info-contrat.md`).
 * Une campagne = un modal, avec ses déclencheurs et ses versions.
 */

export const VIDEO_MODAL_TYPES = ['VIDEO', 'INFO'] as const
export type VideoModalType = typeof VIDEO_MODAL_TYPES[number]

export const TYPE_LABELS: Record<VideoModalType, string> = {
  VIDEO: 'Vidéo',
  INFO: 'Information',
}

export const VIDEO_MODAL_ACTION_KINDS = ['SCREEN', 'URL', 'CLOSE'] as const
export type VideoModalActionKind = typeof VIDEO_MODAL_ACTION_KINDS[number]

export const ACTION_KIND_LABELS: Record<VideoModalActionKind, string> = {
  SCREEN: 'Ouvrir un écran de l’app',
  URL: 'Ouvrir un lien',
  CLOSE: 'Fermer',
}

/** Liste fermée des écrans, identique à l'enum du back et de l'app (jamais un chemin saisi à la main). */
export const INFO_SCREENS = [
  'SEARCH', 'ACTIVITIES', 'TRACKING', 'MESSAGES', 'PROFILE', 'PUBLISH_TRIP', 'SEND_PARCEL',
  'SETTINGS', 'MY_MONEY', 'REFERRAL', 'TRIP_ALERTS', 'HELP',
] as const
export type InfoScreen = typeof INFO_SCREENS[number]

export const INFO_SCREEN_LABELS: Record<InfoScreen, string> = {
  SEARCH: 'Rechercher',
  ACTIVITIES: 'Activités',
  TRACKING: 'Suivi',
  MESSAGES: 'Messages',
  PROFILE: 'Moi (profil)',
  PUBLISH_TRIP: 'Formulaire « Publier un trajet »',
  SEND_PARCEL: 'Formulaire « Envoyer un colis »',
  SETTINGS: 'Réglages',
  MY_MONEY: 'Mon argent',
  REFERRAL: 'Parrainage',
  TRIP_ALERTS: 'Alertes de trajet',
  HELP: 'Aide et tutoriels',
}

export interface VideoModalAction {
  kind: VideoModalActionKind
  screen: InfoScreen | null
  url: string | null
}

/** Longueur maximale du texte d'un modal Information. */
export const BODY_MAX_LENGTH = 500

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

/** Icônes du modal Information : celles des points forts, plus BELL et INFO. */
export const MODAL_ICONS = [...HIGHLIGHT_ICONS, 'BELL', 'INFO'] as const
export type ModalIcon = typeof MODAL_ICONS[number]

export const ICON_LABELS: Record<ModalIcon, string> = {
  PARCEL: 'Colis',
  SUITCASE: 'Valise',
  LOCK: 'Cadenas',
  SEARCH: 'Loupe',
  CHAT: 'Message',
  QR: 'QR code',
  STAR: 'Étoile',
  WALLET: 'Portefeuille',
  BELL: 'Cloche',
  INFO: 'Information',
}

export const MAX_HIGHLIGHTS = 3

/** Habillage du modal dans l'app (complément `modal-format-contrat.md`). */
export const MODAL_LAYOUTS = ['BOTTOM_SHEET', 'CENTERED', 'FULLSCREEN'] as const
export type ModalLayout = typeof MODAL_LAYOUTS[number]

export const LAYOUT_LABELS: Record<ModalLayout, { label: string; hint: string }> = {
  BOTTOM_SHEET: { label: 'Feuille du bas', hint: 'Monte depuis le bas de l’écran' },
  CENTERED: { label: 'Carte centrée', hint: 'Au milieu, fond assombri' },
  FULLSCREEN: { label: 'Plein écran', hint: 'Occupe tout l’écran' },
}

/** Hauteur maximale en % de la hauteur de l'écran ; `null` = automatique selon le contenu. */
export const SIZE_MIN = 30
export const SIZE_MAX = 100
export const SIZE_STEP = 5

/** Image du modal Information : aucune, bannière au-dessus du titre, ou affiche qui remplace titre et texte. */
export const IMAGE_MODES = ['NONE', 'TOP', 'POSTER'] as const
export type ImageMode = typeof IMAGE_MODES[number]

export const IMAGE_MODE_LABELS: Record<ImageMode, { label: string; hint: string }> = {
  NONE: { label: 'Aucune', hint: 'Icône, titre et texte seulement' },
  TOP: { label: 'Bannière en haut', hint: 'Au-dessus du titre et du texte' },
  POSTER: { label: 'Affiche seule', hint: 'L’image remplit le modal, sans titre ni texte' },
}

export const IMAGE_FITS = ['COVER', 'CONTAIN'] as const
export type ImageFit = typeof IMAGE_FITS[number]

export const IMAGE_FIT_LABELS: Record<ImageFit, { label: string; hint: string }> = {
  COVER: { label: 'Remplir', hint: 'Recadre l’image pour remplir la zone' },
  CONTAIN: { label: 'Entière', hint: 'Montre toute l’image, des marges peuvent apparaître' },
}

export const IMAGE_ALT_MAX_LENGTH = 200
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024
export const IMAGE_MAX_SIDE = 2400
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export interface VideoModalHighlight {
  icon: HighlightIcon
  textFr: string
  textEn: string
}

/** Corps de `POST` et `PUT /admin/video-modals`. */
export interface VideoModalInput {
  /** Fixé à la création, jamais modifiable ensuite. */
  type: VideoModalType
  name: string
  /** Absent (null) pour un modal Information. */
  youtubeUrl: string | null
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
  /** Modal Information seulement : texte, icône et actions des boutons. */
  bodyFr?: string
  bodyEn?: string
  icon?: ModalIcon
  primaryAction?: VideoModalAction | null
  secondaryAction?: VideoModalAction | null
  /** Format et taille (vidéo et information). Absents d'un back plus ancien : feuille du bas, taille automatique. */
  layout?: ModalLayout
  sizePercent?: number | null
  /** Modal Information seulement. `imageUrl` est géré par le serveur : jamais envoyé. */
  imageMode?: ImageMode
  imageFit?: ImageFit
  imageAltFr?: string
  imageAltEn?: string
}

/** Nombre d'utilisateurs distincts sur la version courante. */
export interface VideoModalStats {
  shown: number
  opened: number
  completed: number
  dismissed: number
}

export interface AdminVideoModal extends Omit<VideoModalInput, 'type'> {
  /** Absent d'un back plus ancien : c'est alors une campagne vidéo. */
  type?: VideoModalType
  id: string
  active: boolean
  version: number
  audience: VideoModalAudience
  versionPublishedAt: string | null
  youtubeVideoId: string | null
  /** Rempli par le serveur après l'envoi d'un fichier. */
  imageUrl?: string | null
  createdAt: string
  updatedAt: string
  stats: VideoModalStats | null
}

/** Corps de `POST /admin/video-modals/{id}/versions`. */
export interface NewVersionInput {
  audience: VideoModalAudience
  youtubeUrl?: string
}
