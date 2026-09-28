import {
  AlertTriangle, Banknote, Bell, Clock, Flag, IdCard, LifeBuoy, MessageSquare, Siren, UserX, Wallet,
} from 'lucide-vue-next'
import type { Component } from 'vue'

const ICONS: Record<string, Component> = {
  REPORT_CREATED: Flag,
  SUPPORT_TICKET_CREATED: LifeBuoy,
  SUPPORT_MESSAGE_RECEIVED: MessageSquare,
  DISPUTE_OPENED: AlertTriangle,
  NOSHOW_PENDING: Clock,
  KYC_IN_REVIEW: IdCard,
  PAYOUT_HELD: Banknote,
  WALLET_REFUND_REQUESTED: Wallet,
  GDPR_REQUESTED: UserX,
  ADMIN_ALERT: Siren,
}

/** Icône du type ; un type que ce front ne connaît pas encore garde la cloche générique. */
export function notificationIcon(type: string): Component {
  return ICONS[type] ?? Bell
}

const SEVERITY: Record<string, string> = {
  INFO: 'bg-primary/10 text-primary',
  WARNING: 'bg-warning/15 text-warning',
  CRITICAL: 'bg-danger/15 text-danger',
}

export function severityClasses(severity: string): string {
  return SEVERITY[severity] ?? SEVERITY.INFO!
}
