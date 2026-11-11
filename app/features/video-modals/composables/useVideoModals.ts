import { ref } from 'vue'
import { videoModalService } from '@/features/video-modals/services/videoModalService'
import { validateImageFile } from '@/features/video-modals/lib/image'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminVideoModal, NewVersionInput, VideoModalInput } from '@/features/video-modals/types/index'

/** Une réponse vide (204) ou inattendue ne remplace jamais une campagne déjà affichée. */
function isModal(v: unknown): v is AdminVideoModal {
  return !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string'
}

/**
 * Liste et fiche des campagnes de modals. Chaque action renvoie son succès (ou la campagne)
 * et pose `error` avec le `detail` RFC 7807 du back en cas d'échec : la page reste en place,
 * la saisie n'est pas perdue.
 */
export function useVideoModals() {
  const items = ref<AdminVideoModal[]>([])
  const current = ref<AdminVideoModal | null>(null)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)
  /** Campagnes dont l'activation est en vol (une entrée par clic non résolu). */
  const pendingActive = ref<string[]>([])
  /** Dernier état connu du serveur par campagne, pour revenir en arrière sur erreur. */
  const confirmedActive = new Map<string, boolean>()
  /** Les demandes d'une même campagne partent l'une après l'autre : le dernier clic gagne. */
  const activeQueue = new Map<string, Promise<unknown>>()

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
      error.value = extractProblemMessage(e, 'Impossible de charger les modals')
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
      error.value = extractProblemMessage(e, 'Impossible de charger ce modal')
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

  /**
   * Envoie ou remplace l'image d'une campagne existante. Le fichier est vérifié ici avant tout
   * envoi (poids, contenu réel, dimensions) ; le back refuse aussi en 422.
   */
  async function uploadImage(id: string, file: File): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      const problem = await validateImageFile(file)
      if (problem) {
        error.value = problem
        return false
      }
      const res = await videoModalService.uploadImage(id, file)
      if (isModal(res)) apply(res)
      else await refresh(id)
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, 'Envoi de l’image impossible')
      return false
    } finally {
      busy.value = false
    }
  }

  /** Retire l'image ; sans corps de réponse, la fiche locale passe en « Aucune image ». */
  async function removeImage(id: string): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      const res = await videoModalService.removeImage(id)
      if (isModal(res)) apply(res)
      else patchLocal(id, { imageUrl: null, imageMode: 'NONE' })
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, 'Suppression de l’image impossible')
      return false
    } finally {
      busy.value = false
    }
  }

  /**
   * Création avec image : le back exige une image avant d'accepter un mode d'image, et l'envoi
   * a besoin d'un `id`. On crée donc d'abord sans image, on envoie le fichier, on enregistre le
   * mode choisi, et on n'active qu'à la fin (jamais de modal actif sans son image). Si l'envoi
   * échoue, la campagne existe, inactive : `imageError` dit pourquoi, l'admin réessaie sur la fiche.
   */
  async function createWithImage(
    input: VideoModalInput, activate: boolean, file: File | null,
  ): Promise<{ modal: AdminVideoModal | null; imageError: string | null }> {
    if (!file) return { modal: await save(null, input, activate), imageError: null }
    const created = await save(null, { ...input, imageMode: 'NONE' }, false)
    if (!created) return { modal: null, imageError: null }
    if (!(await uploadImage(created.id, file))) {
      return { modal: current.value ?? created, imageError: error.value ?? 'Envoi de l’image impossible' }
    }
    const withMode = await save(created.id, input)
    if (!withMode) return { modal: current.value ?? created, imageError: error.value ?? 'Enregistrement du mode d’image impossible' }
    if (activate) await setActive(created.id, true)
    return { modal: current.value ?? withMode, imageError: null }
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

  /**
   * Active ou désactive : l'interrupteur bouge tout de suite (mise à jour optimiste). Les clics rapprochés
   * s'enchaînent dans l'ordre, aucun n'est perdu ; sur erreur, retour au dernier état confirmé par le serveur.
   */
  function setActive(id: string, active: boolean): Promise<boolean> {
    error.value = null
    if (!confirmedActive.has(id)) {
      const known = items.value.find(m => m.id === id) ?? (current.value?.id === id ? current.value : null)
      confirmedActive.set(id, known ? known.active : !active)
    }
    patchLocal(id, { active })
    pendingActive.value.push(id)
    const run = async (): Promise<boolean> => {
      try {
        const res = await videoModalService.setActive(id, active)
        confirmedActive.set(id, active)
        // Un clic plus récent attend : sa valeur reste affichée, la réponse de celui-ci ne la réécrit pas.
        if (pendingActive.value.filter(p => p === id).length <= 1) {
          if (isModal(res)) apply(res)
          else patchLocal(id, { active })
        }
        return true
      } catch (e) {
        error.value = extractProblemMessage(e, active ? 'Activation impossible' : 'Désactivation impossible')
        patchLocal(id, { active: confirmedActive.get(id) ?? !active })
        return false
      } finally {
        const k = pendingActive.value.indexOf(id)
        if (k >= 0) pendingActive.value.splice(k, 1)
      }
    }
    const result = (activeQueue.get(id) ?? Promise.resolve()).then(run)
    activeQueue.set(id, result)
    return result
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

  return { items, current, loading, busy, pendingActive, error, fetchAll, fetchOne, save, uploadImage, removeImage, createWithImage, publishVersion, setActive, remove }
}
