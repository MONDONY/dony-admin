import type { AdminVideoModal, VideoModalInput, VideoModalTrigger } from '@/features/video-modals/types/index'

/** État du formulaire : comme le corps d'API, mais les dates au format d'un `<input type="datetime-local">`. */
export interface VideoModalFormState extends Omit<VideoModalInput, 'startsAt' | 'endsAt' | 'durationSeconds'> {
  durationSeconds: number | string | null
  startsAt: string
  endsAt: string
}

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

export function defaultFormState(triggers: VideoModalTrigger[] = ['SEARCH_TAB']): VideoModalFormState {
  return {
    name: '',
    youtubeUrl: '',
    durationSeconds: null,
    titleFr: '',
    titleEn: '',
    subtitleFr: '',
    subtitleEn: '',
    primaryLabelFr: 'Voir la vidéo',
    primaryLabelEn: 'Watch the video',
    secondaryLabelFr: 'Commencer',
    secondaryLabelEn: 'Get started',
    highlights: [],
    triggers: [...triggers],
    maxDisplays: 3,
    startsAt: '',
    endsAt: '',
  }
}

export function formStateFromModal(m: AdminVideoModal): VideoModalFormState {
  return {
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
  }
}

function toDuration(v: number | string | null): number | null {
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? NaN : n
}

/** Corps envoyé au back : textes rognés, dates en ISO, nombres en nombres. */
export function inputFromFormState(s: VideoModalFormState): VideoModalInput {
  return {
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
