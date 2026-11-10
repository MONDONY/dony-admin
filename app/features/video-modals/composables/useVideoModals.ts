import { ref } from 'vue'
import { videoModalService } from '@/features/video-modals/services/videoModalService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminVideoModal, NewVersionInput, VideoModalInput } from '@/features/video-modals/types/index'

/** Une réponse vide (204) ou inattendue ne remplace jamais une campagne déjà affichée. */
function isModal(v: unknown): v is AdminVideoModal {
  return !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string'
}

/**
 * Liste et fiche des campagnes de modals vidéo. Chaque action renvoie son succès (ou la campagne)
 * et pose `error` avec le `detail` RFC 7807 du back en cas d'échec : la page reste en place,
 * la saisie n'est pas perdue.
 */
export function useVideoModals() {
  const items = ref<AdminVideoModal[]>([])
  const current = ref<AdminVideoModal | null>(null)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  function apply(modal: AdminVideoModal) {
    const i = items.value.findIndex(m => m.id === modal.id)
    if (i >= 0) items.value.splice(i, 1, modal)
    if (current.value?.id === modal.id) current.value = modal
  }

  function patchLocal(id: string, patch: Partial<AdminVideoModal>) {
    const i = items.value.findIndex(m => m.id === id)
    if (i >= 0) items.value.splice(i, 1, { ...items.value[i]!, ...patch })
    if (current.value?.id === id) current.value = { ...current.value, ...patch }
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const list = await videoModalService.list()
      items.value = Array.isArray(list) ? list : []
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les modals vidéo')
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string) {
    loading.value = true
    error.value = null
    try {
      current.value = await videoModalService.get(id)
    } catch (e) {
      current.value = null
      error.value = extractProblemMessage(e, 'Impossible de charger ce modal vidéo')
    } finally {
      loading.value = false
    }
  }

  /**
   * Crée (id null) ou modifie sans nouvelle version. À la création, `activate` enchaîne l'activation :
   * le back crée toujours la campagne inactive.
   */
  async function save(id: string | null, input: VideoModalInput, activate = false): Promise<AdminVideoModal | null> {
    busy.value = true
    error.value = null
    try {
      let saved = id ? await videoModalService.update(id, input) : await videoModalService.create(input)
      if (!id && activate && isModal(saved)) {
        try {
          const activated = await videoModalService.setActive(saved.id, true)
          saved = isModal(activated) ? activated : { ...saved, active: true }
        } catch (e) {
          error.value = extractProblemMessage(e, 'Modal créé, mais son activation a échoué')
        }
      }
      if (isModal(saved)) {
        if (!id) items.value.unshift(saved)
        apply(saved)
        current.value = saved
        return saved
      }
      return null
    } catch (e) {
      error.value = extractProblemMessage(e, id ? 'Enregistrement impossible' : 'Création impossible')
      return null
    } finally {
      busy.value = false
    }
  }

  async function publishVersion(id: string, input: NewVersionInput): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      const res = await videoModalService.publishVersion(id, input)
      if (isModal(res)) apply(res)
      else await refresh(id)
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, 'Publication de la nouvelle version impossible')
      return false
    } finally {
      busy.value = false
    }
  }

  async function setActive(id: string, active: boolean): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      const res = await videoModalService.setActive(id, active)
      if (isModal(res)) apply(res)
      else patchLocal(id, { active })
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, active ? 'Activation impossible' : 'Désactivation impossible')
      return false
    } finally {
      busy.value = false
    }
  }

  async function remove(id: string): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      await videoModalService.remove(id)
      items.value = items.value.filter(m => m.id !== id)
      if (current.value?.id === id) current.value = null
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, 'Suppression impossible')
      return false
    } finally {
      busy.value = false
    }
  }

  /** Recharge la fiche ou la liste après une réponse sans corps. */
  async function refresh(id: string) {
    try {
      const fresh = await videoModalService.get(id)
      if (isModal(fresh)) apply(fresh)
    } catch { /* la liste reste celle d'avant : l'action a pourtant réussi */ }
  }

  return { items, current, loading, busy, error, fetchAll, fetchOne, save, publishVersion, setActive, remove }
}
