/** Page Modals vidéo : liste, activation, nouvelle version, suppression douce. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import { modal } from '../features/video-modals/fixtures'

vi.stubGlobal('definePageMeta', vi.fn())

const svc = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), publishVersion: vi.fn(), setActive: vi.fn(), remove: vi.fn(),
}))
vi.mock('@/features/video-modals/services/videoModalService', () => ({ videoModalService: svc }))

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/modals-video/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink } }, attachTo: document.body })
  mounted.push(w)
  await flushPromises()
  return w
}

describe('pages/modals-video', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    seedAuth('ADMIN')
    Object.values(svc).forEach(f => f.mockReset())
    svc.list.mockResolvedValue([modal()])
  })

  it('liste vide : message et lien de création', async () => {
    svc.list.mockResolvedValue([])
    const w = await mountPage()
    expect(w.find('[data-test="vm-empty"]').exists()).toBe(true)
    expect(w.get('[data-test="vm-new"]').attributes('href')).toBe('/modals-video/nouveau')
  })

  it('échec du chargement : erreur et Réessayer', async () => {
    svc.list.mockRejectedValueOnce({ data: { detail: 'Panne' } })
    const w = await mountPage()
    expect(w.get('[data-test="state-error"]').text()).toContain('Panne')
    await w.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.find(`[data-test="vm-row-${modal().id}"]`).exists()).toBe(true)
  })

  it('activation depuis la liste', async () => {
    svc.setActive.mockResolvedValue(modal({ active: true }))
    const w = await mountPage()
    await w.get('[data-test="vm-switch"]').trigger('click')
    await flushPromises()
    expect(svc.setActive).toHaveBeenCalledWith(modal().id, true)
    expect(w.get('[data-test="vm-switch"]').attributes('aria-checked')).toBe('true')
  })

  it('nouvelle version : choix du public puis publication', async () => {
    svc.publishVersion.mockResolvedValue(modal({ version: 2, audience: 'EVERYONE' }))
    const w = await mountPage()
    await w.get(`[data-test="vm-version-${modal().id}"]`).trigger('click')
    await w.get('[data-test="vm-audience-EVERYONE"] input').setValue(true)
    await w.get('[data-test="vm-version-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.publishVersion).toHaveBeenCalledWith(modal().id, { audience: 'EVERYONE' })
    expect(w.find('[data-test="vm-version-overlay"]').exists()).toBe(false)
    expect(w.text()).toContain('v2')
  })

  it('nouvelle version refusée : la fenêtre reste ouverte, erreur au-dessus de la liste', async () => {
    svc.publishVersion.mockRejectedValue({ data: { detail: 'Lien YouTube non reconnu' } })
    const w = await mountPage()
    await w.get(`[data-test="vm-version-${modal().id}"]`).trigger('click')
    await w.get('[data-test="vm-version-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="vm-version-overlay"]').exists()).toBe(true)
    expect(w.get('[data-test="vm-error"]').text()).toBe('Lien YouTube non reconnu')
    await w.get('[data-test="vm-version-cancel"]').trigger('click')
    expect(w.find('[data-test="vm-version-overlay"]').exists()).toBe(false)
  })

  it('suppression après confirmation', async () => {
    svc.remove.mockResolvedValue(undefined)
    const w = await mountPage()
    await w.get(`[data-test="vm-remove-${modal().id}"]`).trigger('click')
    expect(w.text()).toContain('ne sera plus affiché dans l’app')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.remove).toHaveBeenCalledWith(modal().id)
    expect(w.find('[data-test="vm-empty"]').exists()).toBe(true)
  })

  it('suppression annulée : rien n’est appelé', async () => {
    const w = await mountPage()
    await w.get(`[data-test="vm-remove-${modal().id}"]`).trigger('click')
    await w.get('[data-test="cancel"]').trigger('click')
    expect(svc.remove).not.toHaveBeenCalled()
  })
})
