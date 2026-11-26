import { computed, type ComputedRef } from 'vue'
import { useAuthStore, type AdminPermission } from '@/stores/auth'

export interface MobileTab {
  key: 'alertes' | 'ensemble' | 'support' | 'messages' | 'diffuser'
  to: string
  label: string
  permission: AdminPermission
}

/** Ordre de la barre d'onglets. L'admin est en français seulement : pas de clé i18n. */
const ALL_TABS: readonly MobileTab[] = [
  { key: 'alertes', to: '/m/alertes', label: 'Alertes', permission: 'ALERT_VIEW' },
  { key: 'ensemble', to: '/m/ensemble', label: 'Ensemble', permission: 'METRICS_VIEW' },
  { key: 'support', to: '/m/support', label: 'Support', permission: 'SUPPORT_TICKET_VIEW' },
  { key: 'messages', to: '/m/messages', label: 'Messages', permission: 'MODERATION_VIEW' },
  { key: 'diffuser', to: '/m/diffuser', label: 'Diffuser', permission: 'NOTIFICATION_SEND' },
]

/** Onglets que l'admin connecté a le droit de voir, dans l'ordre fixe de la barre. */
export function useMobileTabs(): ComputedRef<MobileTab[]> {
  const auth = useAuthStore()
  return computed(() => ALL_TABS.filter(t => auth.can(t.permission)))
}
