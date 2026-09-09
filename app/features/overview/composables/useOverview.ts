import { ref, computed } from 'vue'
import { overviewService } from '@/features/overview/services/overviewService'
import { formatAmount } from '@/features/finance/types/index'
import type { AdminOverview } from '@/features/overview/types/index'

export interface KpiData { id: string; label: string; value: string; subLabel?: string }
export interface QueueCard { id: string; label: string; count: number; tone: 'danger' | 'warning' | 'info' | 'neutral'; href: string }
/** Une ligne par devise, montants déjà formatés dans cette devise : jamais de total mêlant EUR et F CFA. */
export interface VolumeRow { currency: string; escrowHeld: string; released: string; refunded: string; commission: string }

export function useOverview() {
  const data = ref<AdminOverview | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchOverview() {
    isLoading.value = true
    error.value = null
    try { data.value = await overviewService.fetch() }
    catch (e) { error.value = (e as Error).message }
    finally { isLoading.value = false }
  }

  const kpis = computed<KpiData[]>(() => {
    const d = data.value
    if (!d) return []
    return [
      { id: 'users-total', label: 'Utilisateurs', value: String(d.users.total), subLabel: `${d.users.active} actifs` },
      { id: 'users-new', label: 'Nouveaux (30j)', value: String(d.users.newLast30d), subLabel: `${d.users.newLast7d} sur 7j` },
      { id: 'users-pro', label: 'Comptes PRO', value: String(d.users.pro) },
      { id: 'trips-active', label: 'Annonces actives', value: String(d.announcements.active), subLabel: `${d.announcements.inProgress} en cours` },
      { id: 'bids-pending', label: 'Bids en attente', value: String(d.bids.pending), subLabel: `${d.bids.total} au total` },
      { id: 'bids-completed', label: 'Livraisons', value: String(d.bids.completed) },
    ]
  })

  // Recette du 2026-09-09 : les cartes « Escrow détenu », « Libéré » et « Commission » affichaient
  // en euros une somme de toutes les devises. Une ligne par devise désormais ; un backend pas
  // encore mis à jour n'envoie pas gmvByCurrency, la section reste alors vide plutôt que fausse.
  const volumes = computed<VolumeRow[]>(() =>
    (data.value?.gmvByCurrency ?? []).map(v => ({
      currency: v.currency,
      escrowHeld: formatAmount(v.escrowHeldCents, v.currency),
      released: formatAmount(v.releasedCents, v.currency),
      refunded: formatAmount(v.refundedCents, v.currency),
      commission: formatAmount(v.commissionCents, v.currency),
    })))

  const queues = computed<QueueCard[]>(() => {
    const q = data.value?.queues
    if (!q) return []
    return [
      { id: 'disputes', label: 'Litiges ouverts', count: q.openDisputes, tone: 'danger', href: '/incidents' },
      { id: 'noshows', label: 'No-shows à arbitrer', count: q.pendingNoShows, tone: 'warning', href: '/incidents' },
      { id: 'alerts', label: 'Alertes non résolues', count: q.unresolvedAlerts, tone: 'danger', href: '/alertes' },
      { id: 'kyc', label: 'KYC en attente', count: q.pendingKyc, tone: 'info', href: '/users' },
      { id: 'escrowJ48', label: 'Escrow J+48', count: q.escrowJ48, tone: 'warning', href: '/transactions' },
    ]
  })

  return { data, isLoading, error, kpis, volumes, queues, fetchOverview }
}
