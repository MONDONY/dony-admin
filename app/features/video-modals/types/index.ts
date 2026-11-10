import type { WireGroup } from '@/features/broadcast/composables/audienceRule'

/**
 * Modals (vidéo et information) : contrat back / admin / app validé le 10/11/2026
 * (`maquettes/modal-video-contrat.md` et `maquettes/modal-info-contrat.md`), complété par
 * le moment, le ciblage et la fréquence (`maquettes/modal-ciblage-contrat.md`, étape 1) puis par les moments d'action
 * et les corridors (étape 2).
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

/** Écrans et boutons (« où »), étape 1. */
export const SCREEN_TRIGGERS = [
  'SEARCH_TAB', 'ACTIVITIES_TAB', 'TRACKING_TAB', 'MESSAGES_TAB', 'PROFILE_TAB',
  'APP_OPEN', 'PUBLISH_TRIP', 'SEND_PARCEL',
] as const
export type ScreenTrigger = typeof SCREEN_TRIGGERS[number]

/** Moments d'action de l'étape 2 : l'app les déclenche sur le coup, avec leur contexte. */
export const MOMENT_TRIGGERS = [
  'DELIVERY_CONFIRMED', 'PAYMENT_SUCCEEDED', 'TRIP_PUBLISHED', 'REQUEST_PUBLISHED', 'KYC_VERIFIED',
  'SEARCH_NO_TRIP_RESULTS', 'SEARCH_NO_PARCEL_RESULTS', 'SEARCH_FEW_RESULTS', 'FAVORITE_ADDED', 'FORM_ABANDONED', 'TRIP_VIEWED_REPEATEDLY',
  'PAYMENT_FAILED',
  'APP_UPDATED',
] as const
export type MomentTrigger = typeof MOMENT_TRIGGERS[number]

/** Toutes les valeurs de `VideoModalTrigger` connues du back. */
export const VIDEO_MODAL_TRIGGERS = [...SCREEN_TRIGGERS, ...MOMENT_TRIGGERS] as const
export type VideoModalTrigger = typeof VIDEO_MODAL_TRIGGERS[number]

export const isMomentTrigger = (t: string): t is MomentTrigger => (MOMENT_TRIGGERS as readonly string[]).includes(t)

/** Familles de moments, dans l'ordre d'affichage du formulaire. */
export const MOMENT_GROUPS = {
  ACTION: ['DELIVERY_CONFIRMED', 'PAYMENT_SUCCEEDED', 'TRIP_PUBLISHED', 'REQUEST_PUBLISHED', 'KYC_VERIFIED'],
  SEARCH: ['SEARCH_NO_TRIP_RESULTS', 'SEARCH_NO_PARCEL_RESULTS', 'SEARCH_FEW_RESULTS', 'FAVORITE_ADDED', 'FORM_ABANDONED', 'TRIP_VIEWED_REPEATEDLY'],
  PAYMENT: ['PAYMENT_FAILED'],
  ACCOUNT: ['APP_UPDATED'],
} as const satisfies Record<string, readonly MomentTrigger[]>

export const TRIGGER_LABELS: Record<VideoModalTrigger, string> = {
  SEARCH_TAB: 'Arrivée sur Rechercher',
  ACTIVITIES_TAB: 'Onglet Activités',
  TRACKING_TAB: 'Onglet Suivi',
  MESSAGES_TAB: 'Onglet Messages',
  PROFILE_TAB: 'Onglet Moi',
  APP_OPEN: 'Ouverture de l’app (tout écran)',
  PUBLISH_TRIP: 'Touche « Publier un trajet »',
  SEND_PARCEL: 'Touche « Envoyer un colis »',
  DELIVERY_CONFIRMED: 'Livraison confirmée',
  PAYMENT_SUCCEEDED: 'Paiement réussi',
  TRIP_PUBLISHED: 'Trajet publié',
  REQUEST_PUBLISHED: 'Demande publiée',
  KYC_VERIFIED: 'Identité vérifiée',
  SEARCH_NO_TRIP_RESULTS: 'Recherche de trajet sans résultat',
  SEARCH_NO_PARCEL_RESULTS: 'Recherche de colis sans résultat',
  SEARCH_FEW_RESULTS: 'Recherche avec peu de résultats',
  FAVORITE_ADDED: 'Trajet ou alerte en favori',
  FORM_ABANDONED: 'Formulaire abandonné',
  TRIP_VIEWED_REPEATEDLY: 'Même trajet consulté plusieurs fois',
  PAYMENT_FAILED: 'Paiement échoué ou annulé',
  APP_UPDATED: 'Première ouverture après une mise à jour',
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
  DELIVERY_CONFIRMED: 'Livraison confirmée',
  PAYMENT_SUCCEEDED: 'Paiement réussi',
  TRIP_PUBLISHED: 'Trajet publié',
  REQUEST_PUBLISHED: 'Demande publiée',
  KYC_VERIFIED: 'Identité vérifiée',
  SEARCH_NO_TRIP_RESULTS: 'Recherche trajet sans résultat',
  SEARCH_NO_PARCEL_RESULTS: 'Recherche colis sans résultat',
  SEARCH_FEW_RESULTS: 'Recherche, peu de résultats',
  FAVORITE_ADDED: 'Favori ajouté',
  FORM_ABANDONED: 'Formulaire abandonné',
  TRIP_VIEWED_REPEATEDLY: 'Trajet consulté N fois',
  PAYMENT_FAILED: 'Paiement échoué',
  APP_UPDATED: 'Après mise à jour',
}

/** Libellés des déclencheurs dans le formulaire (même vocabulaire que la maquette). */
export const TRIGGER_CHIP_LABELS: Record<VideoModalTrigger, string> = {
  APP_OPEN: 'Ouverture de l’app',
  SEARCH_TAB: 'Onglet Rechercher',
  ACTIVITIES_TAB: 'Onglet Activités',
  TRACKING_TAB: 'Onglet Suivi',
  MESSAGES_TAB: 'Onglet Messages',
  PROFILE_TAB: 'Onglet Moi',
  PUBLISH_TRIP: 'Bouton Publier un trajet',
  SEND_PARCEL: 'Bouton Envoyer un colis',
  DELIVERY_CONFIRMED: 'Livraison confirmée',
  PAYMENT_SUCCEEDED: 'Paiement réussi',
  TRIP_PUBLISHED: 'Trajet publié',
  REQUEST_PUBLISHED: 'Demande publiée',
  KYC_VERIFIED: 'Identité vérifiée',
  SEARCH_NO_TRIP_RESULTS: 'Recherche de trajet sans résultat',
  SEARCH_NO_PARCEL_RESULTS: 'Recherche de colis sans résultat',
  SEARCH_FEW_RESULTS: 'Recherche avec peu de résultats',
  FAVORITE_ADDED: 'Trajet ou alerte en favori',
  FORM_ABANDONED: 'Formulaire abandonné',
  TRIP_VIEWED_REPEATEDLY: 'Même trajet consulté plusieurs fois',
  PAYMENT_FAILED: 'Paiement échoué ou annulé',
  APP_UPDATED: 'Première ouverture après une mise à jour',
}

/**
 * Déclencheurs pour lesquels l'app transmet un corridor (départ, arrivée) : seuls ceux-là sont filtrés par la
 * section « Trajet ou colis précis ». Sans effet pour les autres.
 */
export const CORRIDOR_TRIGGERS: readonly VideoModalTrigger[] = [
  'SEARCH_NO_TRIP_RESULTS', 'SEARCH_NO_PARCEL_RESULTS', 'SEARCH_FEW_RESULTS', 'FAVORITE_ADDED', 'FORM_ABANDONED',
  'TRIP_VIEWED_REPEATEDLY', 'TRIP_PUBLISHED', 'REQUEST_PUBLISHED',
]

/** Déclencheurs qui ouvrent le modal tout de suite : pas de délai d'ouverture. */
export const NO_DELAY_TRIGGERS: readonly VideoModalTrigger[] = ['PUBLISH_TRIP', 'SEND_PARCEL']

/** Délai d'ouverture après l'arrivée sur l'écran, fixe pour la v1 (affiché en lecture seule). */
export const OPEN_DELAY_SECONDS = 2

/** Options des moments « peu de résultats » et « même trajet consulté » (étape 2). */
export const FEW_RESULTS_MIN = 1
export const FEW_RESULTS_MAX = 20
export const FEW_RESULTS_DEFAULT = 2
export const TRIP_VIEWED_MIN = 2
export const TRIP_VIEWED_MAX = 10
export const TRIP_VIEWED_DEFAULT = 3

export interface TriggerOptions {
  fewResultsMax: number
  tripViewedTimes: number
}

/** Corridors : 1 à 10 entrées de 80 caractères au plus ; un côté peut rester vide (null = n'importe lequel). */
export const CORRIDORS_MAX = 10
export const CORRIDOR_TEXT_MAX_LENGTH = 80

export interface ModalCorridor {
  from: string | null
  to: string | null
}

/** Situations constatées par le serveur : vraies tant que la condition tient (compte connecté seulement). */
export const SITUATION_KINDS = [
  'OFFER_ACCEPTED_UNPAID', 'OFFER_UNANSWERED', 'COUNTER_OFFER_PENDING', 'KYC_ABANDONED',
  'PROFILE_INCOMPLETE', 'FIRST_DELIVERY_NO_REFERRAL', 'RETURN_AFTER_ABSENCE', 'DAYS_SINCE_INSTALL_NO_ACTION',
] as const
export type SituationKind = typeof SITUATION_KINDS[number]

export type SituationUnit = 'HOURS' | 'DAYS' | null

export interface SituationSpec {
  /** Début du libellé, avant la valeur. */
  before: string
  /** Fin du libellé, après la valeur (unité comprise). */
  after: string
  unit: SituationUnit
  min: number
  max: number
  /** Valeur proposée quand on coche la situation. */
  defaultValue: number | null
  /** Groupe d'affichage dans la section « Quand ». */
  group: 'PAYMENT' | 'ACCOUNT'
  /** Libellé court pour la liste des campagnes. */
  short: string
}

export const SITUATIONS: Record<SituationKind, SituationSpec> = {
  OFFER_ACCEPTED_UNPAID: { before: 'Offre acceptée, non payée depuis', after: 'h', unit: 'HOURS', min: 1, max: 720, defaultValue: 6, group: 'PAYMENT', short: 'Offre non payée' },
  OFFER_UNANSWERED: { before: 'Offre reçue sans réponse depuis', after: 'h', unit: 'HOURS', min: 1, max: 720, defaultValue: 12, group: 'PAYMENT', short: 'Offre sans réponse' },
  COUNTER_OFFER_PENDING: { before: 'Contre-offre en attente depuis', after: 'h', unit: 'HOURS', min: 1, max: 720, defaultValue: 24, group: 'PAYMENT', short: 'Contre-offre en attente' },
  KYC_ABANDONED: { before: 'Identité commencée puis abandonnée', after: '', unit: null, min: 0, max: 0, defaultValue: null, group: 'ACCOUNT', short: 'Identité abandonnée' },
  PROFILE_INCOMPLETE: { before: 'Profil incomplet', after: '', unit: null, min: 0, max: 0, defaultValue: null, group: 'ACCOUNT', short: 'Profil incomplet' },
  FIRST_DELIVERY_NO_REFERRAL: { before: '1re livraison réussie sans parrainage', after: '', unit: null, min: 0, max: 0, defaultValue: null, group: 'ACCOUNT', short: '1re livraison sans parrainage' },
  RETURN_AFTER_ABSENCE: { before: 'Retour après', after: 'jours d’absence', unit: 'DAYS', min: 1, max: 365, defaultValue: 14, group: 'ACCOUNT', short: 'Retour après absence' },
  DAYS_SINCE_INSTALL_NO_ACTION: { before: '', after: 'jours après l’installation, sans action', unit: 'DAYS', min: 1, max: 365, defaultValue: 3, group: 'ACCOUNT', short: 'Après installation, sans action' },
}

/** Une situation de la campagne : `value` en heures ou en jours selon le type, null sans valeur. */
export interface ModalSituation {
  kind: SituationKind
  value: number | null
}

/** Fréquence d'affichage (étape 1 du ciblage). */
export const MODAL_FREQUENCIES = ['ONCE', 'UP_TO_N', 'EVERY_OPEN', 'EVERY_N_DAYS'] as const
export type ModalFrequency = typeof MODAL_FREQUENCIES[number]

export const FREQUENCY_SHORT_LABELS: Record<ModalFrequency, string> = {
  ONCE: 'Une seule fois',
  UP_TO_N: 'Jusqu’à N fois',
  EVERY_OPEN: 'À chaque ouverture',
  EVERY_N_DAYS: 'Tous les N jours',
}

export const FREQUENCY_DAYS_MIN = 1
export const FREQUENCY_DAYS_MAX = 365

export const MODAL_PLATFORMS = ['ANDROID', 'IOS'] as const
export type ModalPlatform = typeof MODAL_PLATFORMS[number]
export const PLATFORM_LABELS: Record<ModalPlatform, string> = { ANDROID: 'Android', IOS: 'iPhone' }

export const SAMPLE_MIN = 1
export const SAMPLE_MAX = 100

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
  /**
   * Fréquence, réponses et priorité. Absents d'un back plus ancien : `UP_TO_N` avec `maxDisplays`,
   * arrêt après une réponse, priorité 0.
   */
  frequency?: ModalFrequency
  /** Obligatoire pour `EVERY_N_DAYS` (1 à 365). */
  frequencyDays?: number | null
  stopAfterAnswer?: boolean
  allowDontShowAgain?: boolean
  priority?: number
  /** Ciblage : jamais envoyé aux visiteurs sans compte si conditions, situations, tirage ou `connectedOnly`. */
  connectedOnly?: boolean
  /** Arbre de règles de la Diffusion ; null ou absent = aucune condition. */
  conditions?: WireGroup | null
  minAppVersion?: string | null
  maxAppVersion?: string | null
  /** Vide = toutes les plateformes. */
  platforms?: ModalPlatform[]
  /** Tirage stable par personne, 1 à 100 (100 = tout le monde). */
  samplePercent?: number
  situations?: ModalSituation[]
  /**
   * Étape 2 : seuils des moments « peu de résultats » (1 à 20, défaut 2) et « même trajet consulté » (2 à 10, défaut 3).
   * Sans effet si le moment n'est pas coché. Absent d'un back plus ancien.
   */
  triggerOptions?: TriggerOptions
  /** Étape 2 : « trajet ou colis précis », 0 à 10 corridors ; liste vide = tous. Absent d'un back plus ancien. */
  corridors?: ModalCorridor[]
  /** Création d'un modal Information seulement : public de la version 1 (`EVERYONE`). */
  audience?: VideoModalAudience
}

/** Nombre d'utilisateurs distincts sur la version courante. */
export interface VideoModalStats {
  shown: number
  opened: number
  completed: number
  dismissed: number
  /** Personnes qui ont coché « Ne plus afficher » (absent d'un back plus ancien). */
  dontShowAgain?: number
}

/** Corps de `POST /admin/video-modals/audience-estimate`. */
export interface AudienceEstimateRequest {
  conditions: WireGroup | null
  connectedOnly: boolean
  platforms: ModalPlatform[]
  samplePercent: number
  minAppVersion: string | null
  maxAppVersion: string | null
}

/** Réponse : seulement des comptes, jamais de données personnelles. */
export interface AudienceEstimate {
  accounts: number
  afterSample: number
}

export interface AdminVideoModal extends Omit<VideoModalInput, 'type' | 'audience'> {
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
