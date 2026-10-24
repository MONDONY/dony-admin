import type { RouteLocationRaw } from 'vue-router'
import { useApi } from '@/composables/useApi'
import type { AdminPermission } from '@/stores/auth'
import { formatAmount, formatMajorAmount, WALLET_REFUND_STATUS_LABELS } from '@/features/finance/types/index'
import type { AdminWalletRefundRequestPage } from '@/features/finance/types/index'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { maskPhone } from '../lib/normalize'
import { unchecked, transactionsViewRoute } from '@/lib/adminLinks'

export type SearchGroup =
  | 'users' | 'bids' | 'announcements' | 'requests' | 'payments' | 'walletRefunds' | 'reports' | 'support'

export interface SearchItem {
  key: string
  group: SearchGroup
  title: string
  subtitle?: string | null
  to: RouteLocationRaw
}

export interface SearchSource {
  group: SearchGroup
  label: string
  permission: AdminPermission
  // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
  run: (query: string) => Promise<SearchItem[]>
}

const SIZE = 5

interface Page<T> { content: T[] }
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')
const fullName = (first?: string | null, last?: string | null) => `${first ?? ''} ${last ?? ''}`.trim()

/**
 * Une source par liste admin existante, chacune sous sa permission : la palette n'appelle
 * que ce que l'admin connecté a le droit de voir, et chaque recherche garde sa logique back
 * (résolution téléphone/e-mail par Firebase, n° DON-, identifiants).
 */
export const SEARCH_SOURCES: readonly SearchSource[] = [
  {
    group: 'users', label: 'Utilisateurs', permission: 'USER_VIEW',
    async run(q) {
      const res = await useApi()<Page<{ id: string; firstName: string | null; lastName: string | null; phoneNumber?: string | null; city?: string | null; status?: string }>>(
        '/admin/users', { query: { query: q, page: 0, size: SIZE } })
      return res.content.map(u => ({
        key: `users:${u.id}`, group: 'users',
        title: fullName(u.firstName, u.lastName) || 'Utilisateur sans nom',
        subtitle: join(maskPhone(u.phoneNumber), u.city, u.status && u.status !== 'ACTIVE' ? u.status.toLowerCase() : null),
        to: unchecked.userLegacyRoute(u.id)!,
      }))
    },
  },
  {
    group: 'bids', label: 'Colis', permission: 'BID_VIEW',
    async run(q) {
      const res = await useApi()<Page<{ id: string; trackingNumber?: string | null; senderName: string | null; corridor: string; status: string }>>(
        '/admin/bids', { query: { query: q, page: 0, size: SIZE } })
      return res.content.map(b => ({
        key: `bids:${b.id}`, group: 'bids',
        title: b.trackingNumber || `Colis ${b.id.slice(0, 8)}`,
        subtitle: join(b.senderName, b.corridor, b.status.toLowerCase()),
        to: unchecked.bidRoute(b.id)!,
      }))
    },
  },
  {
    group: 'announcements', label: 'Trajets', permission: 'BID_VIEW',
    async run(q) {
      const res = await useApi()<Page<{ id: string; corridor: string; travelerName: string | null; departureDate: string }>>(
        '/admin/announcements', { query: { query: q, page: 0, size: SIZE } })
      return res.content.map(a => ({
        key: `announcements:${a.id}`, group: 'announcements',
        title: a.corridor || 'Trajet',
        subtitle: join(a.travelerName, a.departureDate ? new Date(a.departureDate).toLocaleDateString('fr-FR') : null),
        to: unchecked.tripRoute(a.id)!,
      }))
    },
  },
  {
    group: 'requests', label: 'Demandes d’envoi', permission: 'BID_VIEW',
    async run(q) {
      const res = await useApi()<Page<{ id: string; senderName: string | null; departureCity: string; arrivalCity: string; status: string }>>(
        '/admin/package-requests', { query: { query: q, page: 0, size: SIZE } })
      return res.content.map(r => ({
        key: `requests:${r.id}`, group: 'requests',
        title: `${r.departureCity} → ${r.arrivalCity}`,
        subtitle: join(r.senderName, r.status.toLowerCase()),
        to: unchecked.packageRequestRoute(r.id)!,
      }))
    },
  },
  {
    group: 'payments', label: 'Paiements', permission: 'PAYMENT_VIEW',
    async run(q) {
      const res = await useApi()<Page<{ id: string; amountCents: number; currency: string; status: string; insight?: { sender?: { name: string | null } | null } | null }>>(
        '/admin/payments', { query: { q, page: 0, size: SIZE } })
      return res.content.map(p => ({
        key: `payments:${p.id}`, group: 'payments',
        title: formatAmount(p.amountCents, p.currency),
        subtitle: join(p.insight?.sender?.name, p.status.toLowerCase()),
        to: unchecked.paymentRoute(p.id)!,
      }))
    },
  },
  {
    group: 'walletRefunds', label: 'Remboursements wallet', permission: 'PAYMENT_VIEW',
    async run(q) {
      const res = await useApi()<AdminWalletRefundRequestPage>(
        '/admin/wallet-refund-requests', { query: { query: q, page: 0, size: SIZE } })
      return res.content.map(r => ({
        key: `walletRefunds:${r.id}`, group: 'walletRefunds',
        title: formatMajorAmount(r.amount, r.currency),
        subtitle: join(r.userName, WALLET_REFUND_STATUS_LABELS[r.status] ?? r.status),
        to: transactionsViewRoute({ tab: 'wallet-refunds' }),
      }))
    },
  },
  {
    group: 'reports', label: 'Signalements', permission: 'REPORT_VIEW',
    async run(q) {
      const res = await useApi()<Page<{ id: string; reason: string; reporterName: string | null; description: string | null }>>(
        '/admin/reports', { query: { q, page: 0, size: SIZE } })
      return res.content.map(r => ({
        key: `reports:${r.id}`, group: 'reports',
        title: reportReasonLabel(r.reason),
        subtitle: join(r.reporterName, r.description ? r.description.slice(0, 60) : null),
        to: unchecked.reportRoute(r.id)!,
      }))
    },
  },
  {
    group: 'support', label: 'Support', permission: 'SUPPORT_TICKET_VIEW',
    async run(q) {
      const res = await useApi()<Page<{ id: string; subject: string; userDisplayName: string | null; status: string }>>(
        '/admin/support/tickets', { query: { query: q, page: 0, size: SIZE } })
      return res.content.map(t => ({
        key: `support:${t.id}`, group: 'support',
        title: t.subject,
        subtitle: join(t.userDisplayName, t.status.toLowerCase()),
        to: unchecked.supportTicketRoute(t.id)!,
      }))
    },
  },
]
