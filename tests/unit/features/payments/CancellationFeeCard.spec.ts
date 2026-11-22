import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import { feeOf } from './cancellationFee.fixtures'

const svc = vi.hoisted(() => ({ getCancellationFee: vi.fn(), waiveCancellationFee: vi.fn(), retryCancellationFeePayout: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: svc }))
import CancellationFeeCard from '@/features/payments/components/CancellationFeeCard.vue'
import { feeGestures, formatFeeAmount, formatFeeRate, feeStatusLabel, feeReasonLabel, feeStatusTone } from '@/features/payments/lib/cancellationFee'

async function mountCard(fee = feeOf(), bidId: string | null = 'bid-1') {
  svc.getCancellationFee.mockResolvedValue(fee)
  const w = mount(CancellationFeeCard, { props: { bidId } })
  await flushPromises()
  return w
}
const text = (w: ReturnType<typeof mount>, sel: string) => w.find(`[data-test="${sel}"]`).text().replace(/\s+/g, ' ')

beforeEach(() => { Object.values(svc).forEach(f => f.mockReset()); seedAuth('ADMIN') })

describe('CancellationFeeCard : contenu', () => {
  it.each([
    ['DUE', 'Due'], ['RETAINED', 'Retenue'], ['PAYOUT_PENDING', 'Versement en attente'], ['PAID_OUT', 'Versé'], ['NOT_APPLICABLE', 'Sans objet'],
  ] as const)('statut %s : pastille « %s »', async (status, label) => {
    const w = await mountCard(feeOf({ status, waivable: false }))
    expect(text(w, 'fee-status')).toBe(label)
  })
  it('motif, taux et quatre montants dans la devise (XOF sans décimales)', async () => {
    const w = await mountCard()
    expect(text(w, 'fee-reason-label')).toBe('Annulation par l’expéditeur')
    expect(text(w, 'fee-rate')).toBe('20 %')
    expect(text(w, 'fee-gross')).toMatch(/^6\s?600 XOF$/)
    expect(text(w, 'fee-refund-fees')).toMatch(/^150 XOF$/)
    expect(text(w, 'fee-commission')).toMatch(/^780 XOF$/)
    expect(text(w, 'fee-net')).toMatch(/^5\s?670 XOF$/)
    expect(w.text()).toContain('Frais retenus à l’expéditeur')
    expect(w.text()).toContain('Frais du prestataire')
    expect(w.text()).toContain('Commission Yadony')
    expect(w.text()).toContain('Net versé au voyageur')
    expect(w.find('[data-test="fee-created"]').exists()).toBe(true)
    expect(w.find('[data-test="fee-updated"]').exists()).toBe(true)
  })
  it('EUR : deux décimales', async () => {
    const w = await mountCard(feeOf({ currency: 'EUR', grossFee: 12.5 }))
    expect(text(w, 'fee-gross')).toMatch(/^12,50 EUR$/)
  })
  it('dates illisibles : lignes absentes', async () => {
    const w = await mountCard(feeOf({ createdAt: 'nope', updatedAt: '' }))
    expect(w.find('[data-test="fee-created"]').exists()).toBe(false)
    expect(w.find('[data-test="fee-updated"]').exists()).toBe(false)
  })
  it('versement en attente : le motif est affiché', async () => {
    const w = await mountCard(feeOf({ status: 'PAYOUT_PENDING', waivable: false, payoutRetryable: true, payoutPendingReason: 'Numéro invalide' }))
    expect(text(w, 'fee-pending-reason')).toBe('Versement en attente : Numéro invalide')
  })
  it('versement en attente sans motif connu', async () => {
    const w = await mountCard(feeOf({ status: 'PAYOUT_PENDING', waivable: false, payoutRetryable: true, payoutPendingReason: null }))
    expect(text(w, 'fee-pending-reason')).toBe('Versement en attente.')
  })
  it('pas de retenue (404) : aucune carte', async () => {
    svc.getCancellationFee.mockResolvedValue(null)
    const w = mount(CancellationFeeCard, { props: { bidId: 'bid-1' } })
    await flushPromises()
    expect(w.find('[data-test="fee-card"]').exists()).toBe(false)
  })
  it('paiement sans colis : aucune lecture, aucune carte', async () => {
    const w = mount(CancellationFeeCard, { props: { bidId: null } })
    await flushPromises()
    expect(svc.getCancellationFee).not.toHaveBeenCalled()
    expect(w.find('[data-test="fee-card"]').exists()).toBe(false)
  })
  it('erreur de lecture : message discret dans la carte', async () => {
    svc.getCancellationFee.mockRejectedValue({ statusCode: 500, data: { detail: 'Panne temporaire' } })
    const w = mount(CancellationFeeCard, { props: { bidId: 'bid-1' } })
    await flushPromises()
    expect(w.find('[data-test="fee-load-error"]').text()).toContain('Panne temporaire')
    expect(w.find('[data-test="fee-action-waive"]').exists()).toBe(false)
  })
  it('changer de colis recharge', async () => {
    const w = await mountCard()
    svc.getCancellationFee.mockResolvedValue(feeOf({ id: 'fee-2', bidId: 'bid-2', grossFee: 1000 }))
    await w.setProps({ bidId: 'bid-2' })
    await flushPromises()
    expect(svc.getCancellationFee).toHaveBeenLastCalledWith('bid-2')
    expect(text(w, 'fee-gross')).toMatch(/^1\s?000 XOF$/)
  })
})

describe('CancellationFeeCard : boutons', () => {
  it('DUE : seul « Renoncer à la retenue »', async () => {
    const w = await mountCard()
    expect(w.find('[data-test="fee-action-waive"]').exists()).toBe(true)
    expect(w.find('[data-test="fee-action-retry-payout"]').exists()).toBe(false)
    expect(w.find('[data-test="fee-action-waive"]').attributes('disabled')).toBeUndefined()
  })
  it('PAYOUT_PENDING : seul « Relancer le versement »', async () => {
    const w = await mountCard(feeOf({ status: 'PAYOUT_PENDING', waivable: false, payoutRetryable: true }))
    expect(w.find('[data-test="fee-action-waive"]').exists()).toBe(false)
    expect(w.find('[data-test="fee-action-retry-payout"]').exists()).toBe(true)
  })
  it.each(['RETAINED', 'PAID_OUT', 'NOT_APPLICABLE'] as const)('%s : aucun geste', async (status) => {
    const w = await mountCard(feeOf({ status, waivable: false, payoutRetryable: false }))
    expect(w.find('[data-test="fee-action-waive"]').exists()).toBe(false)
    expect(w.find('[data-test="fee-action-retry-payout"]').exists()).toBe(false)
  })
  it('SUPPORT : boutons grisés avec la raison visible, jamais cachés ; le clic n’ouvre rien', async () => {
    seedAuth('SUPPORT')
    const w = await mountCard(feeOf({ waivable: true, payoutRetryable: true }))
    const waive = w.find('[data-test="fee-action-waive"]')
    const retry = w.find('[data-test="fee-action-retry-payout"]')
    expect(waive.attributes('disabled')).toBeDefined()
    expect(retry.attributes('disabled')).toBeDefined()
    expect(text(w, 'fee-action-waive-reason')).toBe('Permission manquante : réservé aux admins qui peuvent rembourser.')
    expect(text(w, 'fee-action-retry-payout-reason')).toBe('Permission manquante : réservé aux admins qui peuvent débloquer les paiements.')
    await waive.trigger('click')
    expect(w.find('[data-test="fee-dialog"]').exists()).toBe(false)
  })
  it('feeGestures : permissions indépendantes', () => {
    const fee = feeOf({ waivable: true, payoutRetryable: true })
    const g = feeGestures(fee, p => p === 'PAYMENT_RELEASE')
    expect(g.map(x => [x.id, x.enabled])).toEqual([['waive', false], ['retry-payout', true]])
  })
})

describe('CancellationFeeCard : geste', () => {
  async function openWaive() {
    const w = await mountCard()
    await w.find('[data-test="fee-action-waive"]').trigger('click')
    return w
  }
  it('le dialogue explique l’effet, bouton court, désactivé sans motif', async () => {
    const w = await openWaive()
    expect(text(w, 'fee-dialog-effect')).toBe('Le prochain remboursement de l’expéditeur sera intégral. Cette action ne rembourse pas toute seule : lancez ensuite le remboursement habituel.')
    expect(text(w, 'fee-submit')).toBe('Renoncer')
    expect(w.find('[data-test="fee-submit"]').attributes('disabled')).toBeDefined()
  })
  it('l’effet de la relance', async () => {
    const w = await mountCard(feeOf({ status: 'PAYOUT_PENDING', waivable: false, payoutRetryable: true }))
    await w.find('[data-test="fee-action-retry-payout"]').trigger('click')
    expect(text(w, 'fee-dialog-effect')).toBe('Les nouveaux essais automatiques reprennent et un essai est lancé tout de suite.')
    expect(text(w, 'fee-submit')).toBe('Relancer')
  })
  it('motif : 9 caractères refusés, 10 acceptés, compteur en direct, 501 refusés', async () => {
    const w = await openWaive()
    const area = w.find('[data-test="fee-reason"]')
    const submit = () => w.find('[data-test="fee-submit"]').attributes('disabled')
    await area.setValue('123456789')
    expect(text(w, 'fee-reason-count')).toBe('9 / 500')
    expect(submit()).toBeDefined()
    await area.setValue('1234567890')
    expect(text(w, 'fee-reason-count')).toBe('10 / 500')
    expect(submit()).toBeUndefined()
    await area.setValue('a'.repeat(501))
    expect(submit()).toBeDefined()
    expect(text(w, 'fee-reason-hint')).toContain('500')
    await area.setValue('a'.repeat(500))
    expect(submit()).toBeUndefined()
    await area.setValue('   ' + 'a'.repeat(7) + '   ')
    expect(text(w, 'fee-reason-count')).toBe('7 / 500')
    expect(submit()).toBeDefined()
  })
  it('succès : envoi, dialogue fermé, message de réussite, retenue à jour', async () => {
    const w = await openWaive()
    svc.waiveCancellationFee.mockResolvedValue(feeOf({ status: 'NOT_APPLICABLE', waivable: false }))
    svc.getCancellationFee.mockResolvedValue(feeOf({ status: 'NOT_APPLICABLE', waivable: false }))
    await w.find('[data-test="fee-reason"]').setValue('Retenue contestée par le client')
    await w.find('[data-test="fee-submit"]').trigger('click')
    await flushPromises()
    expect(svc.waiveCancellationFee).toHaveBeenCalledWith('bid-1', 'Retenue contestée par le client')
    expect(w.find('[data-test="fee-dialog"]').exists()).toBe(false)
    expect(text(w, 'fee-notice')).toContain('intégral')
    expect(text(w, 'fee-status')).toBe('Sans objet')
    expect(w.find('[data-test="fee-action-waive"]').exists()).toBe(false)
  })
  it('relance : envoi sur l’id de la retenue', async () => {
    const w = await mountCard(feeOf({ status: 'PAYOUT_PENDING', waivable: false, payoutRetryable: true }))
    await w.find('[data-test="fee-action-retry-payout"]').trigger('click')
    svc.retryCancellationFeePayout.mockResolvedValue(feeOf({ status: 'PAID_OUT', waivable: false }))
    svc.getCancellationFee.mockResolvedValue(feeOf({ status: 'PAID_OUT', waivable: false }))
    await w.find('[data-test="fee-reason"]').setValue('Numéro corrigé par le voyageur')
    await w.find('[data-test="fee-submit"]').trigger('click')
    await flushPromises()
    expect(svc.retryCancellationFeePayout).toHaveBeenCalledWith('fee-1', 'Numéro corrigé par le voyageur')
    expect(text(w, 'fee-status')).toBe('Versé')
  })
  it('409 : le détail du back est montré tel quel, dialogue ouvert, saisie conservée', async () => {
    const w = await openWaive()
    svc.waiveCancellationFee.mockRejectedValue({ statusCode: 409, data: { code: 'sender-refund-in-flight', detail: 'Un remboursement de l’expéditeur est déjà en cours.' } })
    await w.find('[data-test="fee-reason"]').setValue('Retenue contestée par le client')
    await w.find('[data-test="fee-submit"]').trigger('click')
    await flushPromises()
    expect(text(w, 'fee-error')).toBe('Un remboursement de l’expéditeur est déjà en cours.')
    expect(w.find('[data-test="fee-dialog"]').exists()).toBe(true)
    expect((w.find('[data-test="fee-reason"]').element as HTMLTextAreaElement).value).toBe('Retenue contestée par le client')
  })
  it('double envoi : un seul appel, bouton « En cours… » désactivé', async () => {
    const w = await openWaive()
    let done!: (_v: unknown) => void
    svc.waiveCancellationFee.mockReturnValue(new Promise(r => { done = r }))
    await w.find('[data-test="fee-reason"]').setValue('Retenue contestée par le client')
    await w.find('[data-test="fee-submit"]').trigger('click')
    await w.find('[data-test="fee-submit"]').trigger('click')
    expect(svc.waiveCancellationFee).toHaveBeenCalledTimes(1)
    expect(text(w, 'fee-submit')).toBe('En cours…')
    expect(w.find('[data-test="fee-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="fee-cancel"]').trigger('click')
    expect(w.find('[data-test="fee-dialog"]').exists()).toBe(true)
    done(feeOf({ status: 'NOT_APPLICABLE', waivable: false }))
    await flushPromises()
    expect(w.find('[data-test="fee-dialog"]').exists()).toBe(false)
  })
  it('Annuler ferme sans rien envoyer, et le dialogue repart vide', async () => {
    const w = await openWaive()
    await w.find('[data-test="fee-reason"]').setValue('brouillon de motif')
    await w.find('[data-test="fee-cancel"]').trigger('click')
    expect(w.find('[data-test="fee-dialog"]').exists()).toBe(false)
    expect(svc.waiveCancellationFee).not.toHaveBeenCalled()
    await w.find('[data-test="fee-action-waive"]').trigger('click')
    expect((w.find('[data-test="fee-reason"]').element as HTMLTextAreaElement).value).toBe('')
  })
  it('changer de colis ferme le dialogue', async () => {
    const w = await openWaive()
    await w.setProps({ bidId: 'bid-2' })
    await flushPromises()
    expect(w.find('[data-test="fee-dialog"]').exists()).toBe(false)
  })
})

describe('formatage', () => {
  it('libellés et teintes, valeurs inconnues tolérées', () => {
    expect(feeStatusLabel('PAID_OUT')).toBe('Versé')
    expect(feeStatusLabel('???')).toBe('???')
    expect(feeStatusTone('???')).toBe('neutral')
    expect(feeReasonLabel('SENDER_NO_SHOW')).toBe('Absence de l’expéditeur confirmée')
    expect(feeReasonLabel('SENDER_CANCEL_AFTER_HANDOVER')).toBe('Annulation après remise')
    expect(feeReasonLabel('X')).toBe('X')
  })
  it('taux et montants', () => {
    expect(formatFeeRate(0.2)).toBe('20 %')
    expect(formatFeeRate(0.125)).toMatch(/^12,5 %$/)
    expect(formatFeeAmount(0, 'XAF')).toBe('0 XAF')
  })
})
