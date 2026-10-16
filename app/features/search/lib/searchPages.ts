import type { RouteLocationRaw } from 'vue-router'
import type { AdminPermission } from '@/stores/auth'
import { normalizeSearch } from './normalize'

export interface SearchPage {
  key: string
  label: string
  /** Rubrique parente, affichée en gris (« Transactions › Remboursements wallet »). */
  parent?: string
  /** Autres mots qui doivent trouver la page. */
  keywords?: string
  to: RouteLocationRaw
  permission: AdminPermission
}

/** Miroir du menu latéral, plus les onglets internes utiles. */
export const SEARCH_PAGES: readonly SearchPage[] = [
  { key: 'overview', label: 'Vue d’ensemble', keywords: 'accueil tableau de bord metriques dashboard', to: '/', permission: 'METRICS_VIEW' },
  { key: 'users', label: 'Utilisateurs', keywords: 'comptes membres clients', to: '/users', permission: 'USER_VIEW' },
  { key: 'kyc', label: 'Vérifications d’identité', keywords: 'kyc didit identite', to: '/kyc', permission: 'USER_KYC' },
  { key: 'rgpd', label: 'Demandes RGPD', keywords: 'suppression compte gdpr', to: '/users/rgpd', permission: 'USER_GDPR_DELETE' },
  { key: 'payments', label: 'Paiements', parent: 'Transactions', keywords: 'transactions escrow stripe', to: '/transactions', permission: 'PAYMENT_VIEW' },
  { key: 'chargebacks', label: 'Litiges bancaires', parent: 'Transactions', keywords: 'chargeback contestation', to: { path: '/transactions', query: { tab: 'chargebacks' } }, permission: 'PAYMENT_VIEW' },
  { key: 'wallets', label: 'Portefeuilles', parent: 'Transactions', keywords: 'wallet solde', to: { path: '/transactions', query: { tab: 'wallets' } }, permission: 'PAYMENT_VIEW' },
  { key: 'mobile-money', label: 'Mobile money', parent: 'Transactions', keywords: 'pawapay orange wave', to: { path: '/transactions', query: { tab: 'mobile-money' } }, permission: 'PAYMENT_VIEW' },
  { key: 'mm-commissions', label: 'Commissions mobile money', parent: 'Transactions', to: { path: '/transactions', query: { tab: 'mm-commissions' } }, permission: 'PAYMENT_VIEW' },
  { key: 'cash-commissions', label: 'Commissions cash', parent: 'Transactions', keywords: 'especes', to: { path: '/transactions', query: { tab: 'cash-commissions' } }, permission: 'PAYMENT_VIEW' },
  { key: 'wallet-refunds', label: 'Remboursements wallet', parent: 'Transactions', keywords: 'remboursement suppression compte solde', to: { path: '/transactions', query: { tab: 'wallet-refunds' } }, permission: 'PAYMENT_VIEW' },
  { key: 'bids', label: 'Colis', keywords: 'bids envois suivi', to: '/colis', permission: 'BID_VIEW' },
  { key: 'announcements', label: 'Annonces de trajet', parent: 'Colis', keywords: 'trajets voyages voyageurs', to: { path: '/colis', query: { tab: 'announcements' } }, permission: 'BID_VIEW' },
  { key: 'requests', label: 'Demandes d’envoi', parent: 'Colis', keywords: 'package requests negociation', to: { path: '/colis', query: { tab: 'demandes' } }, permission: 'BID_VIEW' },
  { key: 'disputes', label: 'Litiges', parent: 'Incidents', keywords: 'incidents disputes', to: { path: '/incidents', query: { tab: 'disputes' } }, permission: 'DISPUTE_VIEW' },
  { key: 'noshows', label: 'Absences au rendez-vous', parent: 'Incidents', keywords: 'no-show noshow', to: { path: '/incidents', query: { tab: 'noshows' } }, permission: 'DISPUTE_VIEW' },
  { key: 'alerts', label: 'Alertes', keywords: 'alertes systeme', to: '/alertes', permission: 'ALERT_VIEW' },
  { key: 'moderation', label: 'Modération', keywords: 'conversations messages', to: '/moderation', permission: 'MODERATION_VIEW' },
  { key: 'support', label: 'Support', keywords: 'tickets aide', to: '/support', permission: 'SUPPORT_TICKET_VIEW' },
  { key: 'promo', label: 'Codes promo', keywords: 'reduction coupon', to: '/promo', permission: 'PROMO_MANAGE' },
  { key: 'topup-codes', label: 'Codes de recharge', keywords: 'recharge solde', to: '/topup-codes', permission: 'TOPUP_CODE_MANAGE' },
  { key: 'assistant', label: 'Assistant IA', keywords: 'ia llm fournisseurs groq gemini mistral openrouter cles', to: '/assistant', permission: 'ASSISTANT_MANAGE' },
  { key: 'audit', label: 'Audit', keywords: 'journal historique', to: '/audit', permission: 'AUDIT_VIEW' },
  { key: 'exports', label: 'Exports', keywords: 'csv telecharger', to: '/exports', permission: 'EXPORT_RUN' },
  { key: 'reports', label: 'Signalements', keywords: 'scarabee bugs reports', to: '/signalements', permission: 'REPORT_VIEW' },
  { key: 'communications', label: 'Communications', keywords: 'notifications push broadcast envoi', to: '/communications', permission: 'NOTIFICATION_SEND' },
  { key: 'settings', label: 'Paramètres', keywords: 'configuration reglages', to: '/parametres', permission: 'CONFIG_MANAGE' },
  { key: 'admins', label: 'Administrateurs', keywords: 'equipe roles permissions', to: '/administrateurs', permission: 'ADMIN_MANAGE' },
]

/** Pages permises dont le libellé, la rubrique ou les mots-clés contiennent la saisie. */
// eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
export function matchPages(query: string, can: (permission: AdminPermission) => boolean, limit = 6): SearchPage[] {
  const allowed = SEARCH_PAGES.filter(p => can(p.permission))
  const q = normalizeSearch(query)
  if (!q) return allowed.slice(0, limit)
  const scored = allowed
    .map((p) => {
      const label = normalizeSearch(p.label)
      const rest = normalizeSearch(`${p.parent ?? ''} ${p.keywords ?? ''}`)
      const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : rest.includes(q) ? 2 : -1
      return { p, score }
    })
    .filter(s => s.score >= 0)
    .sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map(s => s.p)
}
