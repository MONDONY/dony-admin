import { computed, ref, type Ref } from 'vue'
import { mobileAlertsService } from '@/features/mobile/services/mobileAlertsService'
import { ALERT_CHIPS, parseItemParam, sortAlerts } from '@/features/mobile/lib/mobileAlerts'
import { useNotificationsStore } from '@/stores/notifications'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminAlert, ResolvedFilter } from '@/features/alerts/types/index'

/** Une page large, comme le poste ordinateur : le mobile n'a pas de pagination. */
export const MOBILE_ALERTS_PAGE_SIZE = 100

/** Liste mobile : alertes triées par gravité, puces de statut, fil des autres nouveautés (lecture seule). */
export function useMobileAlertList(rawItem: Ref<unknown>) {
  const notifications = useNotificationsStore()
  const chip = ref<ResolvedFilter>('OPEN')
  const alerts = ref<AdminAlert[]>([])
  // Vrai dès le départ (rendu serveur, avant le montage) : jamais « Aucune … » avant la première réponse.
  const isLoading = ref(true)
  const error = ref<string | null>(null)
  let seq = 0

  const sorted = computed(() => sortAlerts(alerts.value))
  const item = computed(() => parseItemParam(rawItem.value))
  /** `?item=` présent mais illisible : on le dit au lieu de l'ignorer. */
  const itemInvalid = computed(() => rawItem.value !== undefined && rawItem.value !== null && rawItem.value !== '' && !item.value)
  /** L'identifiant du fil est opaque : comparé entier, jamais découpé. */
  const itemNotification = computed(() => {
    const wanted = item.value
    return wanted ? notifications.items.find(n => n.id === wanted) ?? null : null
  })
  /** Fil chargé, en échec ou absent du back : avant, une nouveauté introuvable n'est pas encore « partie ». */
  const feedSettled = computed(() => notifications.unavailable || notifications.feedStatus === 'ready' || notifications.feedStatus === 'error')
  /** Les alertes du fil sont déjà dans la liste du dessus : « Autres nouveautés » ne les répète pas. */
  const feed = computed(() => notifications.items.filter(n => n.type !== 'ADMIN_ALERT'))

  /** Lecture seule ; une réponse arrivée après un changement de puce est ignorée. */
  async function fetchAlerts() {
    const my = ++seq
    isLoading.value = true
    error.value = null
    try {
      const page = await mobileAlertsService.list(chip.value, 0, MOBILE_ALERTS_PAGE_SIZE)
      if (my === seq) alerts.value = page.content
    } catch (e) {
      if (my === seq) error.value = extractProblemMessage(e, 'Impossible de charger les alertes')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  async function load() {
    await Promise.all([fetchAlerts(), notifications.openPanel()])
  }

  async function selectChip(key: ResolvedFilter) {
    chip.value = key
    await fetchAlerts()
  }

  return {
    chips: ALERT_CHIPS, chip, sorted, isLoading, error,
    feed, feedSettled, isUnread: notifications.isUnread, item, itemInvalid, itemNotification, load, selectChip,
  }
}
