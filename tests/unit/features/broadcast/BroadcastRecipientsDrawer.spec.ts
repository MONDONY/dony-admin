import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('@/features/broadcast/services/broadcastService')
import BroadcastRecipientsDrawer from '@/features/broadcast/components/BroadcastRecipientsDrawer.vue'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import type { BroadcastTarget } from '@/features/broadcast/types/index'

const svc = broadcastService as unknown as Record<string, ReturnType<typeof vi.fn>>
const target: BroadcastTarget = { type: 'RULE', segmentId: 's1' }
const row = (id: string, push: boolean) => ({ id, displayName: `Aïssa ${id}`, country: 'SN', language: 'fr', pushReachable: push, signedUpAt: '2026-10-01T10:00:00' })
const page = (n: number, total = 120) => ({ content: [row('u1', true), row('u2', false)], totalElements: total, totalPages: 3, number: n, size: 50 })

async function open(props: Record<string, unknown> = {}) {
  const w = mount(BroadcastRecipientsDrawer, { props: { open: true, target, ...props } })
  await flushPromises()
  return w
}

describe('BroadcastRecipientsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.recipients = vi.fn().mockResolvedValue(page(0))
    svc.downloadRecipientsCsv = vi.fn().mockResolvedValue(undefined)
  })

  it('charge la première page par 50 et affiche les lignes', async () => {
    const w = await open()
    expect(svc.recipients).toHaveBeenCalledWith(target, 0, 50)
    expect(w.text()).toContain('Aïssa u1')
    expect(w.text()).toContain('120')
    expect(w.findAll('[data-test="recipient-row"]')).toHaveLength(2)
    expect(w.find('[data-test="recipient-row"]').text()).toContain('Oui')
  })

  it('ne charge rien tant qu’il est fermé, puis charge à l’ouverture', async () => {
    const w = mount(BroadcastRecipientsDrawer, { props: { open: false, target } })
    await flushPromises()
    expect(svc.recipients).not.toHaveBeenCalled()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await w.setProps({ open: true })
    await flushPromises()
    expect(svc.recipients).toHaveBeenCalledTimes(1)
  })

  it('la pagination demande la page suivante', async () => {
    const w = await open()
    await w.find('[data-test="next"]').trigger('click')
    await flushPromises()
    expect(svc.recipients).toHaveBeenLastCalledWith(target, 1, 50)
  })

  it('drawer_exportAppelleLeCsv', async () => {
    const w = await open()
    await w.find('[data-test="export-csv"]').trigger('click')
    await flushPromises()
    expect(svc.downloadRecipientsCsv).toHaveBeenCalledWith(target)
  })

  it('un export refusé (trop gros) affiche le message du back', async () => {
    svc.downloadRecipientsCsv.mockRejectedValue({ data: { detail: 'Export trop volumineux' } })
    const w = await open()
    await w.find('[data-test="export-csv"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="recipients-error"]').text()).toContain('Export trop volumineux')
  })

  it('une erreur de chargement est affichée', async () => {
    svc.recipients.mockRejectedValue({ data: { detail: 'Boom' } })
    const w = await open()
    expect(w.find('[data-test="recipients-error"]').text()).toContain('Boom')
  })

  it('liste vide', async () => {
    svc.recipients.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 })
    const w = await open()
    expect(w.find('[data-test="recipients-empty"]').exists()).toBe(true)
  })

  it('se ferme par le bouton et par Échap', async () => {
    const w = await open()
    await w.find('[data-test="close-drawer"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(2)
  })

  it('ignore une page lente arrivée après une page plus récente', async () => {
    let resolveSlow!: ReturnType<typeof vi.fn>
    svc.recipients
      .mockResolvedValueOnce(page(0))
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))
      .mockResolvedValueOnce({ content: [row('u9', true)], totalElements: 120, totalPages: 3, number: 2, size: 50 })
    const w = await open()
    await w.find('[data-test="next"]').trigger('click') // page 1, lente
    await w.find('[data-test="next"]').trigger('click') // page 2, rapide
    await flushPromises()
    expect(w.text()).toContain('Aïssa u9')
    resolveSlow(page(1))
    await flushPromises()
    expect(w.text()).toContain('Aïssa u9')
    expect(w.text()).not.toContain('Aïssa u1')
  })

  it('met le focus dans le tiroir à l’ouverture', async () => {
    const w = mount(BroadcastRecipientsDrawer, { attachTo: document.body, props: { open: false, target } })
    await w.setProps({ open: true })
    await flushPromises()
    expect(document.activeElement).toBe(w.find('[data-test="close-drawer"]').element)
    w.unmount()
  })
})
