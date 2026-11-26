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
  const itemNotification = computed(() => {
    const wanted = item.value
    return wanted ? notifications.items.find(n => n.id === wanted.id && n.type === wanted.type) ?? null : null
  })

  async function load() {
    await Promise.all([list.fetchAlerts(), notifications.openPanel()])
  }

  async function selectChip(key: ResolvedFilter) {
    chip.value = key
    await list.setResolvedFilter(key)
  }

  return {
    chips: ALERT_CHIPS, chip, sorted, isLoading: list.isLoading, error: list.error,
    feed: computed(() => notifications.items), feedStatus: computed(() => notifications.feedStatus),
    isUnread: notifications.isUnread, item, itemInvalid, itemNotification, load, selectChip,
  }
}
