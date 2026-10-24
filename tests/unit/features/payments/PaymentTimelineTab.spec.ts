/** Onglet Chronologie : la chronologie, l'auteur lié à sa fiche, et « Voir tout le journal » (audit). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import PaymentTimelineTab from '@/features/payments/components/PaymentTimelineTab.vue'
import PaymentTimeline from '@/features/payments/components/PaymentTimeline.vue'
import { seedAuth } from '~/tests/helpers/auth'
import { IDS, NuxtLink, fullPayment } from '~/tests/helpers/paymentDetail'

const global = { stubs: { NuxtLink } }
const ENTRIES = [
  { at: '2026-10-19T14:02:00', action: 'PAYMENT_CREATED', source: 'PAYMENT', actorId: null, actorKind: null, actorLabel: null, payload: {} },
  { at: '2026-10-19T15:00:00', action: 'REFUND_REQUESTED', source: 'AUDIT', actorId: IDS.SENDER, actorKind: 'USER', actorLabel: 'Awa Diallo', payload: {} },
  { at: '2026-10-20T09:00:00', action: 'ESCROW_FORCE_RELEASED', source: 'AUDIT', actorId: 'a1', actorKind: 'ADMIN', actorLabel: 'ops@yadony.com', payload: { reason: 'livré' } },
]

describe('PaymentTimelineTab', () => {
  beforeEach(() => { seedAuth('ADMIN'); apiMock.mockReset().mockResolvedValue(ENTRIES) })

  it('chronologie chargée et lien « Voir tout le journal » filtré sur ce paiement (AUDIT_VIEW)', async () => {
    const w = mount(PaymentTimelineTab, { props: { payment: fullPayment() }, global })
    await flushPromises()
    expect(w.find('[data-test="payment-timeline"]').exists()).toBe(true)
    const link = w.find('[data-test="payment-audit-link"]')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe(`/audit?entityType=PAYMENT&entityId=${IDS.PAY}`)
    expect(link.text()).toBe('Voir tout le journal')
    expect(link.classes()).toContain('min-h-10')
  })

  it('sans AUDIT_VIEW : pas de lien vers le journal', async () => {
    seedAuth('ADMIN', { AUDIT_VIEW: false })
    const w = mount(PaymentTimelineTab, { props: { payment: fullPayment() }, global })
    await flushPromises()
    expect(w.find('[data-test="payment-audit-link"]').exists()).toBe(false)
  })
})

describe('PaymentTimeline : auteur lié', () => {
  beforeEach(() => { seedAuth('ADMIN'); apiMock.mockReset().mockResolvedValue(ENTRIES) })

  it('un compte utilisateur devient un lien vers sa fiche (USER_VIEW), un admin reste du texte', async () => {
    const w = mount(PaymentTimeline, { props: { paymentId: IDS.PAY }, global })
    await flushPromises()
    const user = w.find('[data-test="timeline-REFUND_REQUESTED"] a')
    expect(user.attributes('href')).toBe(`/users/${IDS.SENDER}`)
    expect(user.text()).toBe('Awa Diallo')
    const admin = w.find('[data-test="timeline-ESCROW_FORCE_RELEASED"]')
    expect(admin.find('a').exists()).toBe(false)
    expect(admin.text()).toContain('admin ops@yadony.com')
  })

  it('sans USER_VIEW : l’auteur reste lisible, aucun <a>', async () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mount(PaymentTimeline, { props: { paymentId: IDS.PAY }, global })
    await flushPromises()
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('[data-test="timeline-REFUND_REQUESTED"]').text()).toContain('par Awa Diallo')
  })

  it('auteur utilisateur sans identifiant exploitable : texte', async () => {
    apiMock.mockResolvedValue([{ ...ENTRIES[1], actorId: null }])
    const w = mount(PaymentTimeline, { props: { paymentId: IDS.PAY }, global })
    await flushPromises()
    expect(w.find('a').exists()).toBe(false)
    expect(w.text()).toContain('par Awa Diallo')
  })
})
