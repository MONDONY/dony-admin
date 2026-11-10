import { useApi } from '@/composables/useApi'
import type { AdminVideoModal, AudienceEstimate, AudienceEstimateRequest, NewVersionInput, VideoModalInput } from '@/features/video-modals/types/index'

const BASE = '/admin/video-modals'

export const videoModalService = {
  list(): Promise<AdminVideoModal[]> {
    return useApi()<AdminVideoModal[]>(BASE)
  },
  get(id: string): Promise<AdminVideoModal> {
    return useApi()<AdminVideoModal>(`${BASE}/${id}`)
  },
  /** Crée la campagne : inactive, version 1, public « jamais répondu » (sauf `audience` donné pour une information). */
  create(input: VideoModalInput): Promise<AdminVideoModal> {
    return useApi()<AdminVideoModal>(BASE, { method: 'POST', body: input })
  },
  /** Corrige contenus et réglages SANS changer de version : personne ne revoit le modal pour autant. */
  update(id: string, input: VideoModalInput): Promise<AdminVideoModal> {
    return useApi()<AdminVideoModal>(`${BASE}/${id}`, { method: 'PUT', body: input })
  },
  /** Version + 1 : le modal est remontré au public choisi. Le lien n'est envoyé que s'il change. */
  publishVersion(id: string, input: NewVersionInput): Promise<AdminVideoModal> {
    const body: Record<string, unknown> = { audience: input.audience }
    const url = input.youtubeUrl?.trim()
    if (url) body.youtubeUrl = url
    return useApi()<AdminVideoModal>(`${BASE}/${id}/versions`, { method: 'POST', body })
  },
  /** Envoie (ou remplace) l'image : multipart, champ `file`. */
  uploadImage(id: string, file: File): Promise<AdminVideoModal> {
    const body = new FormData()
    body.append('file', file)
    return useApi()<AdminVideoModal>(`${BASE}/${id}/image`, { method: 'POST', body })
  },
  /** Retire l'image ; le back repasse le mode à « Aucune » si elle était requise. */
  removeImage(id: string): Promise<AdminVideoModal> {
    return useApi()<AdminVideoModal>(`${BASE}/${id}/image`, { method: 'DELETE' })
  },
  /** Nombre de comptes concernés par le ciblage (jamais de données personnelles) et part retenue par le tirage. */
  estimateAudience(body: AudienceEstimateRequest): Promise<AudienceEstimate> {
    return useApi()<AudienceEstimate>(`${BASE}/audience-estimate`, { method: 'POST', body })
  },
  setActive(id: string, active: boolean): Promise<AdminVideoModal> {
    return useApi()<AdminVideoModal>(`${BASE}/${id}/active`, { method: 'PATCH', body: { active } })
  },
  /** Suppression douce côté back. */
  remove(id: string): Promise<void> {
    return useApi()<void>(`${BASE}/${id}`, { method: 'DELETE' })
  },
}
