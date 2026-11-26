import { describe, it, expect, beforeEach } from 'vitest'
import { useMobileTabs } from '@/features/mobile/composables/useMobileTabs'
import { ALERTS_FEED_PERMISSIONS } from '@/features/mobile/lib/mobileAlerts'
import { seedAuth } from '../../../helpers/auth'

describe('useMobileTabs', () => {
  beforeEach(() => {
    seedAuth('SUPER_ADMIN')
  })

  it('tabs_keepOrder_alertes_ensemble_support_messages_diffuser', () => {
    expect(useMobileTabs().value.map(t => t.key))
      .toEqual(['alertes', 'ensemble', 'support', 'messages', 'diffuser'])
  })

  it('exposes paths, French labels and permissions (any one of the list opens the tab)', () => {
    expect(useMobileTabs().value.map(t => [t.to, t.label, t.anyOf])).toEqual([
      ['/m/alertes', 'Alertes', ALERTS_FEED_PERMISSIONS],
      ['/m/ensemble', 'Ensemble', ['METRICS_VIEW']],
      ['/m/support', 'Support', ['SUPPORT_TICKET_VIEW']],
      ['/m/messages', 'Messages', ['MODERATION_VIEW']],
      ['/m/diffuser', 'Diffuser', ['NOTIFICATION_SEND']],
    ])
    // Le fil porte tous les types : chaque droit qui donne une nouveauté (et son push) ouvre l'onglet.
    expect([...ALERTS_FEED_PERMISSIONS]).toEqual([
      'ALERT_VIEW', 'DISPUTE_VIEW', 'USER_KYC', 'PAYMENT_VIEW', 'REPORT_VIEW', 'USER_GDPR_DELETE', 'SUPPORT_TICKET_VIEW',
    ])
  })

  it.each(['DISPUTE_VIEW', 'USER_KYC', 'PAYMENT_VIEW', 'REPORT_VIEW', 'USER_GDPR_DELETE', 'SUPPORT_TICKET_VIEW'])(
    'alertes tab shown without ALERT_VIEW when the admin has %s (a push of that type must not land on /denied)', (perm) => {
      const none = Object.fromEntries(ALERTS_FEED_PERMISSIONS.map(p => [p, false]))
      seedAuth('ADMIN', { ...none, [perm]: true })
      expect(useMobileTabs().value.map(t => t.key)).toContain('alertes')
    },
  )

  it('tabs_hideEveryTabWithoutItsPermission', () => {
    seedAuth('ADMIN', {
      ...Object.fromEntries(ALERTS_FEED_PERMISSIONS.map(p => [p, false])),
      METRICS_VIEW: false, MODERATION_VIEW: false, NOTIFICATION_SEND: false,
    })
    expect(useMobileTabs().value).toEqual([])
  })

  it('keeps only the permitted tabs, in order', () => {
    seedAuth('ADMIN', { METRICS_VIEW: false, MODERATION_VIEW: false })
    expect(useMobileTabs().value.map(t => t.key)).toEqual(['alertes', 'support', 'diffuser'])
  })
})
