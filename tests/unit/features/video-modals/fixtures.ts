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
