import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KycQueueTable from '@/features/kyc/components/KycQueueTable.vue'
import KycQueueFilters from '@/features/kyc/components/KycQueueFilters.vue'
import KycReviewDetails from '@/features/kyc/components/KycReviewDetails.vue'

const ROW = {
  userId: 'u1', userName: 'Awa Diop', userPhone: '+221 77 *** ** 12', provider: 'DIDIT', kycStatus: 'IN_REVIEW',
  recordStatus: 'PENDING', rejectionCode: null, rejectionReason: null, decisionKind: null, decidedAt: null,
  decidedByAdminEmail: null, submittedAt: '2026-09-25T10:00:00Z', waitingHours: 50,
}

describe('KycQueueTable', () => {
  it('affiche la ligne, l’attente en rouge au-delà de 48 h et émet la sélection', async () => {
    const w = mount(KycQueueTable, { props: { items: [ROW, { ...ROW, userId: 'u2', waitingHours: 3 }], loading: false } })
    const row = w.find('[data-test="kyc-row-u1"]')
    expect(row.text()).toContain('Awa Diop')
    expect(row.text()).toContain('+221 77 *** ** 12')
    expect(row.text()).toContain('Didit')
    expect(row.text()).toContain('En attente de décision')
    const late = w.find('[data-test="kyc-waiting-u1"]')
    expect(late.text()).toBe('2 j 2 h')
    expect(late.classes()).toContain('text-danger')
    expect(late.attributes('data-overdue')).toBe('true')
    expect(w.find('[data-test="kyc-waiting-u2"]').classes()).not.toContain('text-danger')
    await row.trigger('click')
    await w.find('[data-test="kyc-row-u2"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')).toEqual([['u1'], ['u2']])
  })

  it('badge de décision admin et code de refus lisible', () => {
    const w = mount(KycQueueTable, {
      props: { items: [{ ...ROW, kycStatus: 'REJECTED', rejectionCode: 'document_expired', decisionKind: 'REJECTED' }], loading: false },
    })
    expect(w.find('[data-test="kyc-decision-badge-u1"]').text()).toBe('Refusée par un admin')
    expect(w.find('[data-test="kyc-row-u1"]').text()).toContain('Document expiré')
  })

  it('nom absent : repli lisible ; états chargement et vide', () => {
    const w = mount(KycQueueTable, { props: { items: [{ ...ROW, userName: null, userPhone: null }], loading: false } })
    expect(w.find('[data-test="kyc-row-u1"]').text()).toContain('Nom non renseigné')
    expect(mount(KycQueueTable, { props: { items: [], loading: true } }).text()).toContain('Chargement')
    expect(mount(KycQueueTable, { props: { items: [], loading: false } }).text()).toContain('Aucune vérification')
  })
})

describe('KycQueueFilters', () => {
  const filters = { status: 'IN_REVIEW', provider: null, query: '', from: null, to: null }

  it('onglets de statut, fournisseur, recherche et période', async () => {
    const w = mount(KycQueueFilters, { props: { filters } })
    expect(w.find('[data-test="kyc-tab-IN_REVIEW"]').attributes('aria-selected')).toBe('true')
    await w.find('[data-test="kyc-tab-REJECTED"]').trigger('click')
    await w.find('[data-test="kyc-provider"]').setValue('DIDIT')
    await w.find('[data-test="kyc-provider"]').setValue('')
    const search = w.find('[data-test="kyc-search"]')
    await search.setValue('awa')
    await search.trigger('keyup', { key: 'Enter' })
    await w.find('[data-test="kyc-date-from"]').setValue('2026-09-01')
    await w.find('[data-test="kyc-date-to"]').setValue('2026-09-27')
    expect(w.emitted('update:status')![0]).toEqual(['REJECTED'])
    expect(w.emitted('update:provider')).toEqual([['DIDIT'], [null]])
    expect(w.emitted('update:query')![0]).toEqual(['awa'])
    expect(w.emitted('update:dateRange')!.at(-1)).toEqual(['2026-09-01', '2026-09-27'])
  })

  it('suit la période venue du parent et relaie l’effacement de la recherche', async () => {
    const w = mount(KycQueueFilters, { props: { filters } })
    await w.setProps({ filters: { ...filters, from: '2026-09-02', to: null } })
    expect((w.find('[data-test="kyc-date-from"]').element as HTMLInputElement).value).toBe('2026-09-02')
    await w.find('[data-test="kyc-search"]').trigger('search')
    expect(w.emitted('update:query')![0]).toEqual([''])
  })

  it('efface la période', async () => {
    const w = mount(KycQueueFilters, { props: { filters: { ...filters, from: '2026-09-01' } } })
    await w.find('[data-test="kyc-dates-clear"]').trigger('click')
    expect(w.emitted('update:dateRange')![0]).toEqual([null, null])
  })
})

describe('KycReviewDetails', () => {
  const KYC = {
    userId: 'u1', kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED', stripeUnavailable: false,
    decisionKind: 'APPROVED', decidedAt: '2026-09-26T09:30:00Z', decidedByAdminEmail: 'admin.1@yadony.com',
    decisionReason: 'Pièces contrôlées chez Didit', providerSessionUrl: 'https://business.didit.me/session/1',
    history: [
      { action: 'SESSION_STARTED', at: '2026-09-25T10:00:00Z', actorKind: 'USER', actorEmail: null, detail: null },
      { action: 'ADMIN_APPROVED', at: '2026-09-26T09:30:00Z', actorKind: 'ADMIN', actorEmail: 'admin.1@yadony.com', detail: 'Pièces contrôlées' },
    ],
  }

  it('décision admin (qui, quand, pourquoi), lien fournisseur sécurisé et historique', () => {
    const w = mount(KycReviewDetails, { props: { kyc: KYC as never } })
    expect(w.find('[data-test="kyc-decision"]').text()).toContain('Validée par un admin')
    expect(w.find('[data-test="kyc-decision-by"]').text()).toContain('admin.1@yadony.com')
    expect(w.find('[data-test="kyc-decision-reason"]').text()).toContain('Pièces contrôlées chez Didit')
    const link = w.find('[data-test="kyc-provider-link"]')
    expect(link.text()).toBe('Voir la session chez le fournisseur')
    expect(link.attributes('href')).toBe('https://business.didit.me/session/1')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(w.findAll('[data-test^="kyc-history-item-"]')).toHaveLength(2)
    expect(w.find('[data-test="kyc-history-item-1"]').text()).toContain('Administrateur')
    expect(w.find('[data-test="kyc-history-item-1"]').text()).toContain('admin.1@yadony.com')
    expect(w.text()).not.toContain('—')
  })

  it('sans décision ni lien ni historique (ancien back) : mentions discrètes', () => {
    const w = mount(KycReviewDetails, { props: { kyc: { userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeUnavailable: false } as never } })
    expect(w.find('[data-test="kyc-no-decision"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-provider-link"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-history"]').exists()).toBe(false)
  })

  it('historique vide', () => {
    const w = mount(KycReviewDetails, { props: { kyc: { userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeUnavailable: false, history: [] } as never } })
    expect(w.find('[data-test="kyc-history-empty"]').exists()).toBe(true)
  })
})
