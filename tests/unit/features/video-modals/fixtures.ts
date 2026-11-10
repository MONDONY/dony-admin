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
