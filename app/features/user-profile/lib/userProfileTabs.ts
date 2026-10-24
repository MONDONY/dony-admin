import type { TabItem } from '@/components/ui/TabBar.vue'
import type { AdminPermission } from '@/stores/auth'
import type { CanFn } from '@/lib/adminLinks'

/** Signature de `auth.can`, définie une seule fois par le registre des liens. */
export type { CanFn }

export type ProfileTab = 'overview' | 'parcels' | 'money' | 'incidents' | 'identity' | 'support' | 'manage'

const MANAGE_PERMISSIONS: AdminPermission[] = [
  'USER_COMMISSION', 'USER_PRO_GRANT', 'GP_PRO_REVIEW', 'ADMIN_MANAGE', 'USER_DELETE',
]

/** Onglets de la fiche selon les droits de l'admin ; le serveur reste l'autorité. */
export function visibleTabs(can: CanFn): TabItem<ProfileTab>[] {
  const tabs: TabItem<ProfileTab>[] = [{ id: 'overview', label: 'Vue d’ensemble' }]
  if (can('BID_VIEW')) tabs.push({ id: 'parcels', label: 'Colis, trajets et demandes' })
  if (can('PAYMENT_VIEW')) tabs.push({ id: 'money', label: 'Argent' })
  if (can('DISPUTE_VIEW') || can('REPORT_VIEW')) tabs.push({ id: 'incidents', label: 'Incidents et signalements' })
  if (can('USER_KYC')) tabs.push({ id: 'identity', label: 'Identité (KYC)' })
  if (can('SUPPORT_TICKET_VIEW') || can('AUDIT_VIEW')) tabs.push({ id: 'support', label: 'Support et journal' })
  if (MANAGE_PERMISSIONS.some(p => can(p))) tabs.push({ id: 'manage', label: 'Gestion' })
  return tabs
}
