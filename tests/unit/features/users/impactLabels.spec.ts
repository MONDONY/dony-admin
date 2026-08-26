import { describe, it, expect } from 'vitest'
import { impactLabel, DELETION_REASONS } from '@/features/users/impactLabels'

const ALL_CODES = [
  'ACTIVE_ESCROW', 'WALLET_POSITIVE_BALANCE', 'WALLET_REFUND_PENDING',
  'PARCEL_IN_TRANSIT', 'PENDING_BID', 'UPCOMING_ANNOUNCEMENT',
  'OPEN_DISPUTE', 'ACTIVE_CONVERSATION',
  'REPORT_TARGETING', 'REPORT_AUTHORED', 'RATINGS_GIVEN',
]

describe('impactLabel', () => {
  it('traduit chacun des codes émis par le back', () => {
    for (const code of ALL_CODES) {
      expect(impactLabel(code).title).not.toBe(code)
      expect(impactLabel(code).detail).not.toBe('')
    }
  })

  // Un contributeur peut être ajouté côté back avant que le front connaisse son code :
  // afficher le code brut vaut mieux qu'une ligne vide ou un plantage.
  it('retombe sur le code brut pour un constat inconnu', () => {
    expect(impactLabel('SOMETHING_NEW').title).toBe('SOMETHING_NEW')
  })
})

describe('DELETION_REASONS', () => {
  it('couvre les six motifs acceptés par le back', () => {
    expect(DELETION_REASONS.map(r => r.value)).toEqual([
      'FRAUD', 'ABUSE', 'TEST_ACCOUNT', 'DUPLICATE', 'USER_REQUEST_OFFLINE', 'OTHER',
    ])
  })
})
