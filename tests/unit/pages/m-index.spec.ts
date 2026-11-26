import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('definePageMeta', vi.fn())

import MIndex from '@/pages/m/index.vue'
import { seedAuth } from '../../helpers/auth'

describe('/m index', () => {
  beforeEach(() => navigateToMock.mockClear())

  it('goes to the first permitted tab', () => {
    seedAuth('ADMIN', { ALERT_VIEW: false })
    mount(MIndex)
    expect(navigateToMock).toHaveBeenCalledWith('/m/ensemble', { replace: true })
  })

  it('goes to /denied when no tab is allowed', () => {
    seedAuth('ADMIN', {
      ALERT_VIEW: false, METRICS_VIEW: false, SUPPORT_TICKET_VIEW: false,
      MODERATION_VIEW: false, NOTIFICATION_SEND: false,
    })
    mount(MIndex)
    expect(navigateToMock).toHaveBeenCalledWith('/denied', { replace: true })
  })
})
