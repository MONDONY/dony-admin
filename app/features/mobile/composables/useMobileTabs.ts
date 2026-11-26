import { computed, type ComputedRef } from 'vue'
import { useAuthStore, type AdminPermission } from '@/stores/auth'
import { ALERTS_FEED_PERMISSIONS } from '@/features/mobile/lib/mobileAlerts'

export interface MobileTab {
  key: 'alertes' | 'ensemble' | 'support' | 'messages' | 'diffuser'
  to: string
  label: string
  /** L'onglet s'affiche si l'admin a au moins une de ces permissions (miroir de la page). */
  anyOf: readonly AdminPermission[]
}

/** Ordre de la barre d'onglets. L'admin est en français seulement : pas de clé i18n. */
const ALL_TABS: readonly MobileTab[] = [
  { key: 'alertes', to: '/m/alertes', label: 'Alertes', anyOf: ALERTS_FEED_PERMISSIONS },
  { key: 'ensemble', to: '/m/ensemble', label: 'Ensemble', anyOf: ['METRICS_VIEW'] },
  { key: 'support', to: '/m/support', label: 'Support', anyOf: ['SUPPORT_TICKET_VIEW'] },
  { key: 'messages', to: '/m/messages', label: 'Messages', anyOf: ['MODERATION_VIEW'] },
  { key: 'diffuser', to: '/m/diffuser', label: 'Diffuser', anyOf: ['NOTIFICATION_SEND'] },
]

/** Onglets que l'admin connecté a le droit de voir, dans l'ordre fixe de la barre. */
export function useMobileTabs(): ComputedRef<MobileTab[]> {
  const auth = useAuthStore()
  return computed(() => ALL_TABS.filter(t => t.anyOf.some(p => auth.can(p))))
}
