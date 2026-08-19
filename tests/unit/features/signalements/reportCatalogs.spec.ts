import { describe, it, expect } from 'vitest'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { actionsFor } from '@/features/signalements/reportActions'
import type { AdminPermission } from '@/stores/auth'

describe('reportReasonLabel', () => {
  it('maps a known catalogue value to its French label', () => {
    expect(reportReasonLabel('SCAM_ATTEMPT')).toBe('Tentative d’arnaque')
  })

  it('falls back to the raw value for an unknown reason', () => {
    expect(reportReasonLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
  })
})

describe('actionsFor', () => {
  const allPermissions = new Set<AdminPermission>(['USER_SUSPEND', 'CONTENT_REMOVE'])
  const noPermissions = new Set<AdminPermission>()

  it('USER target with full permissions offers DISMISS, WARN, SUSPEND_TARGET', () => {
    expect(actionsFor('USER', allPermissions)).toEqual(['DISMISS', 'WARN', 'SUSPEND_TARGET'])
  })

  it('USER target without USER_SUSPEND hides SUSPEND_TARGET', () => {
    expect(actionsFor('USER', noPermissions)).toEqual(['DISMISS', 'WARN'])
  })

  it('ANNOUNCEMENT target with full permissions offers DISMISS, REMOVE_CONTENT', () => {
    expect(actionsFor('ANNOUNCEMENT', allPermissions)).toEqual(['DISMISS', 'REMOVE_CONTENT'])
  })

  it('ANNOUNCEMENT target without CONTENT_REMOVE (SUPPORT) only offers DISMISS', () => {
    expect(actionsFor('ANNOUNCEMENT', noPermissions)).toEqual(['DISMISS'])
  })

  it('BID/MESSAGE/RATING/APP targets only offer DISMISS — no delegated action exists yet', () => {
    expect(actionsFor('BID', allPermissions)).toEqual(['DISMISS'])
    expect(actionsFor('MESSAGE', allPermissions)).toEqual(['DISMISS'])
    expect(actionsFor('RATING', allPermissions)).toEqual(['DISMISS'])
    expect(actionsFor('APP', allPermissions)).toEqual(['DISMISS'])
  })
})
