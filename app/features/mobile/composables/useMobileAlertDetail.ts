import { computed, ref, type Ref } from 'vue'
import { alertFacts, alertGuide } from '@/features/alerts/lib/alertCatalog'
import type { AdminAlert } from '@/features/alerts/types/index'
import { mobileAlertsService } from '@/features/mobile/services/mobileAlertsService'
import { useAuthStore } from '@/stores/auth'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { httpStatus } from '@/lib/violations'
import { extractProblemMessage } from '@/lib/problemDetail'
import { uuidParam } from '@/lib/safeInput'
import { messageTime } from '@/features/support/lib/supportWorkbench'

export const ALREADY_CLAIMED_MESSAGE = 'Déjà pris en charge par un autre administrateur'
export const NOT_YOURS_MESSAGE = 'Cette prise en charge n’est pas la vôtre'

/**
 * Alerte ouverte sur mobile : lecture seule plus la prise en charge. Ce module n'appelle ni
 * résolution, ni report, ni réouverture, ni suppression (elles se font sur ordinateur).
 * `claimedByName` (e-mail d'un admin) reste en mémoire de la page : jamais stocké.
 */
export function useMobileAlertDetail(rawId: Ref<unknown>) {
  const auth = useAuthStore()
  const alert = ref<AdminAlert | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  /** Route de prise en charge absente (back jumeau pas déployé) : le bouton disparaît. */
  const claimAvailable = ref(true)
  const claimBusy = ref(false)
  const claimError = ref<string | null>(null)
  let seq = 0

  const id = computed(() => uuidParam(rawId.value))
  const guide = computed(() => (alert.value ? alertGuide(alert.value.type) : null))
  const facts = computed(() => (alert.value ? alertFacts(alert.value) : []))
  /** « Pris en charge par X à HH:mm » (heure de Paris), sans l'heure si elle est illisible. */
  const claimedBy = computed(() => {
    const a = alert.value
    if (!a?.claimedAt) return null
    const at = messageTime(a.claimedAt)
    return `Pris en charge par ${a.claimedByName || 'un administrateur'}${at ? ` à ${at}` : ''}`
  })
  /** Le preneur : par son identifiant quand le back le donne, sinon (ancien back) par son e-mail. */
  const isMine = computed(() => {
    const a = alert.value
    if (!a) return false
    if (typeof a.claimedById === 'string' && a.claimedById) return a.claimedById === auth.user?.id
    const mine = auth.user?.email?.toLowerCase()
    const by = a.claimedByName?.toLowerCase()
    return !!mine && !!by && mine === by
  })
  const canClaim = computed(() =>
    !!alert.value && claimAvailable.value && !alert.value.resolved && !alert.value.claimedAt && auth.can('ALERT_RESOLVE'))
  /** Le back exige ALERT_RESOLVE, puis le preneur ou ADMIN_MANAGE. */
  const canRelease = computed(() =>
    !!alert.value && claimAvailable.value && !!alert.value.claimedAt && auth.can('ALERT_RESOLVE') && (isMine.value || auth.can('ADMIN_MANAGE')))

  async function load() {
    const current = id.value
    const my = ++seq
    error.value = null
    notFound.value = false
    if (!current) {
      alert.value = null
      notFound.value = true
      return
    }
    isLoading.value = true
    try {
      const result = await mobileAlertsService.get(current)
      if (my === seq) alert.value = result
    } catch (e) {
      if (my !== seq) return
      alert.value = null
      if (httpStatus(e) === 404) notFound.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger l’alerte')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction
  async function run(action: (alertId: string) => Promise<AdminAlert>, conflict: { status: number; code: string; message: string }) {
    const current = id.value
    if (!current || claimBusy.value) return
    claimBusy.value = true
    claimError.value = null
    try {
      alert.value = await action(current)
    } catch (e) {
      if (isEndpointMissing(e)) {
        claimAvailable.value = false
      } else if (httpStatus(e) === conflict.status && problemCode(e) === conflict.code) {
        claimError.value = conflict.message
        await load()
      } else {
        claimError.value = extractProblemMessage(e, 'Action impossible pour le moment')
      }
    } finally {
      claimBusy.value = false
    }
  }

  const claim = () => run(mobileAlertsService.claim, { status: 409, code: 'alert-already-claimed', message: ALREADY_CLAIMED_MESSAGE })
  const release = () => run(mobileAlertsService.release, { status: 403, code: 'alert-claim-not-yours', message: NOT_YOURS_MESSAGE })

  return { alert, guide, facts, isLoading, error, notFound, claimAvailable, claimBusy, claimError, claimedBy, canClaim, canRelease, load, claim, release }
}
