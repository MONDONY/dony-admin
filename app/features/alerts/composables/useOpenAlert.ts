import { ref, type Ref } from 'vue'
import { alertsService } from '@/features/alerts/services/alertsService'
import type { AdminAlert } from '@/features/alerts/types/index'
import { uuidParam } from '@/lib/safeInput'
import { httpStatus } from '@/lib/violations'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Alerte affichée dans le panneau, y compris par lien profond `/alertes?open=<id>` : prise dans
 * la page chargée si elle y est, sinon lue par `GET /admin/alerts/{id}`. Un 404 (alerte absente,
 * ou ancien back sans cette route) donne « Alerte introuvable » sans casser la page. Seule la
 * dernière demande compte : une fermeture pendant la lecture n'est pas annulée par la réponse.
 */
export function useOpenAlert(list: Ref<AdminAlert[]>) {
  const selected = ref<AdminAlert | null>(null)
  const openError = ref<string | null>(null)
  let seq = 0

  function open(alert: AdminAlert) {
    seq++
    openError.value = null
    selected.value = alert
  }

  function close() {
    seq++
    selected.value = null
  }

  async function openById(raw: unknown): Promise<void> {
    const id = uuidParam(raw)
    if (!id || selected.value?.id === id) return
    const loaded = list.value.find(a => a.id === id)
    if (loaded) { open(loaded); return }
    const my = ++seq
    openError.value = null
    try {
      const alert = await alertsService.get(id)
      if (my === seq) selected.value = alert
    } catch (e) {
      if (my !== seq) return
      openError.value = httpStatus(e) === 404 ? 'Alerte introuvable' : extractProblemMessage(e, 'Impossible de charger l’alerte')
    }
  }

  return { selected, openError, open, close, openById }
}
