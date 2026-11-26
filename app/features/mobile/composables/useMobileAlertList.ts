import { computed, ref, type Ref } from 'vue'
import { useAlerts } from '@/features/alerts/composables/useAlerts'
import { ALERT_CHIPS, parseItemParam, sortAlerts } from '@/features/mobile/lib/mobileAlerts'
import { useNotificationsStore } from '@/stores/notifications'
import type { ResolvedFilter } from '@/features/alerts/types/index'

/** Liste mobile : alertes triées par gravité, puces de statut, fil des autres nouveautés (lecture seule). */
export function useMobileAlertList(rawItem: Ref<unknown>) {
  const list = useAlerts()
  const notifications = useNotificationsStore()
  const chip = ref<ResolvedFilter>('OPEN')

  const sorted = computed(() => sortAlerts(list.alerts.value))
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

  async function load() {
    await Promise.all([list.fetchAlerts(), notifications.openPanel()])
  }

  async function selectChip(key: ResolvedFilter) {
    chip.value = key
    await list.setResolvedFilter(key)
  }

  return {
    chips: ALERT_CHIPS, chip, sorted, isLoading: list.isLoading, error: list.error,
    feed, feedSettled, isUnread: notifications.isUnread, item, itemInvalid, itemNotification, load, selectChip,
  }
}
