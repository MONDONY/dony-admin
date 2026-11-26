import { describe, it, expect, beforeEach } from 'vitest'
import { useMobileTabs } from '@/features/mobile/composables/useMobileTabs'
import { seedAuth } from '../../../helpers/auth'

describe('useMobileTabs', () => {
  beforeEach(() => {
    seedAuth('SUPER_ADMIN')
  })

  it('tabs_keepOrder_alertes_ensemble_support_messages_diffuser', () => {
    expect(useMobileTabs().value.map(t => t.key))
      .toEqual(['alertes', 'ensemble', 'support', 'messages', 'diffuser'])
  })

  it('exposes paths, French labels and permissions', () => {
    expect(useMobileTabs().value.map(t => [t.to, t.label, t.permission])).toEqual([
      ['/m/alertes', 'Alertes', 'ALERT_VIEW'],
      ['/m/ensemble', 'Ensemble', 'METRICS_VIEW'],
      ['/m/support', 'Support', 'SUPPORT_TICKET_VIEW'],
      ['/m/messages', 'Messages', 'MODERATION_VIEW'],
      ['/m/diffuser', 'Diffuser', 'NOTIFICATION_SEND'],
    ])
  })

  it('tabs_hideEveryTabWithoutItsPermission', () => {
    seedAuth('ADMIN', {
      ALERT_VIEW: false, METRICS_VIEW: false, SUPPORT_TICKET_VIEW: false,
      MODERATION_VIEW: false, NOTIFICATION_SEND: false,
    })
    expect(useMobileTabs().value).toEqual([])
  })

  it('keeps only the permitted tabs, in order', () => {
    seedAuth('ADMIN', { METRICS_VIEW: false, MODERATION_VIEW: false })
    expect(useMobileTabs().value.map(t => t.key)).toEqual(['alertes', 'support', 'diffuser'])
  })
})
