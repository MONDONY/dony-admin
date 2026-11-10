import type { WireGroup } from '@/features/broadcast/composables/audienceRule'
import type { AudienceField } from '@/features/broadcast/types/index'
import type { AdminVideoModal, VideoModalInput } from '@/features/video-modals/types/index'

export const validInput = (over: Partial<VideoModalInput> = {}): VideoModalInput => ({
  name: 'Vidéo d’accueil',
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
  durationSeconds: 204,
  titleFr: 'Bienvenue sur Yadony',
  titleEn: 'Welcome to Yadony',
  subtitleFr: 'Envoyez ou voyagez',
  subtitleEn: 'Send or travel',
  primaryLabelFr: 'Voir la vidéo (3 min)',
  primaryLabelEn: 'Watch the video (3 min)',
  secondaryLabelFr: 'Commencer',
  secondaryLabelEn: 'Get started',
  highlights: [{ icon: 'PARCEL', textFr: 'Envoyer un colis', textEn: 'Send a parcel' }],
  triggers: ['SEARCH_TAB'],
  maxDisplays: 3,
  startsAt: null,
  endsAt: null,
  ...over,
})

export const modal = (over: Partial<AdminVideoModal> = {}): AdminVideoModal => ({
  ...validInput(),
  id: '11111111-1111-4111-8111-111111111111',
  active: false,
  version: 1,
  audience: 'NEVER_ANSWERED',
  versionPublishedAt: '2026-11-10T10:00:00Z',
  youtubeVideoId: 'dQw4w9WgXcQ',
  createdAt: '2026-11-10T10:00:00Z',
  updatedAt: '2026-11-10T10:00:00Z',
  stats: { shown: 1240, opened: 612, completed: 388, dismissed: 540 },
  ...over,
})

export const infoInput = (over: Partial<VideoModalInput> = {}): VideoModalInput => ({
  type: 'INFO',
  name: 'Annonce nouveauté',
  youtubeUrl: null,
  durationSeconds: null,
  titleFr: 'Nouveauté',
  titleEn: 'News',
  subtitleFr: '',
  subtitleEn: '',
  bodyFr: 'Découvrez le suivi en direct.',
  bodyEn: 'Discover live tracking.',
  icon: 'BELL',
  primaryLabelFr: 'Voir le suivi',
  primaryLabelEn: 'See tracking',
  primaryAction: { kind: 'SCREEN', screen: 'TRACKING', url: null },
  secondaryLabelFr: '',
  secondaryLabelEn: '',
  secondaryAction: null,
  highlights: [],
  triggers: ['SEARCH_TAB'],
  maxDisplays: 3,
  startsAt: null,
  endsAt: null,
  ...over,
})

export const infoModal = (over: Partial<AdminVideoModal> = {}): AdminVideoModal => {
  const { type: _t, ...rest } = infoInput()
  return {
    ...rest,
    type: 'INFO',
    id: '22222222-2222-4222-8222-222222222222',
    active: true,
    version: 1,
    audience: 'NEVER_ANSWERED',
    versionPublishedAt: '2026-11-10T10:00:00Z',
    youtubeVideoId: null,
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    stats: { shown: 100, opened: 40, completed: 0, dismissed: 30 },
    ...over,
  }
}

/** Catalogue de champs de la Diffusion (réduit) pour le ciblage des modals. */
export const audienceFields: AudienceField[] = [
  { key: 'country', family: 'GEO', label: 'Pays de résidence', operators: [{ key: 'IS', label: 'est', valueType: 'ENUM' }, { key: 'IN', label: 'parmi', valueType: 'ENUM_MULTI' }], values: [{ key: 'CI', label: 'Côte d’Ivoire' }, { key: 'SN', label: 'Sénégal' }, { key: 'FR', label: 'France' }] },
  { key: 'bids_count', family: 'ACTIVITY', label: 'Colis envoyés', operators: [{ key: 'EQ', label: 'égal à', valueType: 'INT' }, { key: 'GTE', label: 'au moins', valueType: 'INT' }, { key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
  { key: 'is_pro', family: 'STATUS', label: 'Compte GP Pro', operators: [{ key: 'IS', label: 'est', valueType: 'BOOLEAN' }], values: [] },
  { key: 'promo', family: 'MONEY', label: 'Code promo', operators: [{ key: 'EQ', label: 'est', valueType: 'TEXT' }], values: [] },
  { key: 'corridor_interest', family: 'GEO', label: 'Corridor d’intérêt', operators: [{ key: 'MATCHES', label: 'correspond à', valueType: 'CORRIDOR' }], values: [] },
]

export const ciRule = (): WireGroup => ({
  op: 'AND',
  children: [
    { field: 'country', operator: 'IS', value: 'CI' },
    { field: 'bids_count', operator: 'EQ', value: 0 },
  ],
})
