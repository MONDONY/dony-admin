import {
  LayoutDashboard, Users, UserX, CreditCard, Package, AlertTriangle,
  Bell, MessageSquare, Ticket, ScrollText, Download, Flag, ShieldCheck, Megaphone, Settings,
  LifeBuoy, IdCard, Coins, Sparkles, BadgeCheck, Percent,
  UsersRound, Wallet, Activity, MessagesSquare, SlidersHorizontal,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { AdminPermission } from '@/stores/auth'

export interface NavEntry {
  to: string
  label: string
  permission: AdminPermission
  icon: Component
  /** Lettre de l'enchaînement « g puis lettre » (raccourci clavier). */
  shortcut?: string
}

export interface NavGroupConfig {
  id: string
  label: string
  /** Nom court sous l'icône du rail (64 px de large : 8 caractères au plus). */
  railLabel: string
  /** Icône du domaine dans le rail. */
  icon: Component
  entries: NavEntry[]
}

/** Seule entrée hors groupe : la page d'accueil reste toujours visible, en haut du menu. */
export const HOME_ENTRY: NavEntry = {
  to: '/', label: 'Vue d’ensemble', permission: 'METRICS_VIEW', icon: LayoutDashboard, shortcut: 'h',
}

/**
 * Regroupement par ce que l'admin vient faire, pas par module technique. Les groupes se
 * replient ; leur en-tête porte le total des pastilles quand ils sont repliés, pour qu'un
 * travail en attente ne se cache jamais derrière un groupe fermé.
 */
export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'accounts',
    label: 'Comptes',
    railLabel: 'Comptes',
    icon: UsersRound,
    entries: [
      { to: '/users', label: 'Utilisateurs', permission: 'USER_VIEW', icon: Users, shortcut: 'u' },
      { to: '/kyc', label: 'Vérifications d’identité', permission: 'USER_KYC', icon: IdCard, shortcut: 'k' },
      { to: '/gp-pro', label: 'GP Pro', permission: 'GP_PRO_REVIEW', icon: BadgeCheck },
      { to: '/users/rgpd', label: 'Demandes RGPD', permission: 'USER_GDPR_DELETE', icon: UserX },
    ],
  },
  {
    id: 'money',
    label: 'Argent',
    railLabel: 'Argent',
    icon: Wallet,
    entries: [
      { to: '/transactions', label: 'Transactions', permission: 'PAYMENT_VIEW', icon: CreditCard, shortcut: 't' },
      { to: '/promo', label: 'Codes promo', permission: 'PROMO_MANAGE', icon: Ticket },
      { to: '/topup-codes', label: 'Codes de recharge', permission: 'TOPUP_CODE_MANAGE', icon: Coins },
      { to: '/tarification', label: 'Tarification', permission: 'CONFIG_MANAGE', icon: Percent },
    ],
  },
  {
    id: 'activity',
    label: 'Activité',
    railLabel: 'Activité',
    icon: Activity,
    entries: [
      { to: '/colis', label: 'Colis', permission: 'BID_VIEW', icon: Package, shortcut: 'c' },
      { to: '/incidents', label: 'Incidents', permission: 'DISPUTE_VIEW', icon: AlertTriangle, shortcut: 'i' },
      { to: '/alertes', label: 'Alertes', permission: 'ALERT_VIEW', icon: Bell, shortcut: 'a' },
      { to: '/signalements', label: 'Signalements', permission: 'REPORT_VIEW', icon: Flag, shortcut: 'r' },
    ],
  },
  {
    id: 'community',
    label: 'Support & communauté',
    railLabel: 'Support',
    icon: MessagesSquare,
    entries: [
      { to: '/support', label: 'Support', permission: 'SUPPORT_TICKET_VIEW', icon: LifeBuoy, shortcut: 's' },
      { to: '/moderation', label: 'Modération', permission: 'MODERATION_VIEW', icon: MessageSquare, shortcut: 'm' },
      { to: '/assistant', label: 'Assistant IA', permission: 'ASSISTANT_MANAGE', icon: Sparkles },
      { to: '/communications', label: 'Communications', permission: 'NOTIFICATION_SEND', icon: Megaphone },
    ],
  },
  {
    id: 'system',
    label: 'Système',
    railLabel: 'Système',
    icon: SlidersHorizontal,
    entries: [
      { to: '/audit', label: 'Audit', permission: 'AUDIT_VIEW', icon: ScrollText },
      { to: '/exports', label: 'Exports', permission: 'EXPORT_RUN', icon: Download },
      { to: '/parametres', label: 'Paramètres', permission: 'CONFIG_MANAGE', icon: Settings },
      { to: '/administrateurs', label: 'Administrateurs', permission: 'ADMIN_MANAGE', icon: ShieldCheck },
    ],
  },
]

/** Toutes les entrées, accueil compris, dans l'ordre du menu. */
export const ALL_NAV_ENTRIES: NavEntry[] = [HOME_ENTRY, ...NAV_GROUPS.flatMap(g => g.entries)]

/** Une entrée est « sous » une route quand elle en est la racine : `/users/abc` reste dans Utilisateurs. */
const covers = (e: NavEntry, path: string) =>
  e.to === '/' ? path === '/' : path === e.to || path.startsWith(`${e.to}/`)

/**
 * Entrée du menu qui correspond à la page affichée. La plus spécifique gagne : sur
 * `/users/rgpd`, c'est « Demandes RGPD » et non « Utilisateurs » (`/users` en est aussi la racine).
 */
export function resolveActiveEntry(path: string | undefined): NavEntry | null {
  if (!path) return null
  let best: NavEntry | null = null
  for (const e of ALL_NAV_ENTRIES) {
    if (covers(e, path) && (!best || e.to.length > best.to.length)) best = e
  }
  return best
}

/** Groupe du menu qui contient la page affichée (null pour l'accueil et les pages hors menu). */
export function resolveActiveGroup(path: string | undefined): NavGroupConfig | null {
  const entry = resolveActiveEntry(path)
  return NAV_GROUPS.find(g => g.entries.includes(entry as NavEntry)) ?? null
}
