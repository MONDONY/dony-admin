/** Page /assistant : fournisseurs d'IA (avertissement sans actif, back absent, ordre refusé, suppression). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRoute', () => ({ meta: {}, query: {} }))
vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))

const svc = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), reorder: vi.fn(), test: vi.fn(), remove: vi.fn() }))
vi.mock('@/features/assistant/services/assistantProviderService', () => ({ assistantProviderService: svc }))

import Page from '@/pages/assistant/index.vue'

const provider = (slug: string, extra = {}) => ({
  id: slug, name: slug.toUpperCase(), slug, baseUrl: `https://api.${slug}.com/v1`, model: 'm', apiKeyLast4: '1234',
  supportsJsonMode: true, dailyRequestLimit: 1000, priority: 1, enabled: true,
  stats: { requestsToday: 1, successesToday: 1, lastStatus: null, lastError: null, cooldownUntil: null }, ...extra,
})
const httpError = (status: number, data?: Record<string, unknown>) => Object.assign(new Error(`${status}`), { statusCode: status, data })

const mounted: VueWrapper[] = []
async function mountPage() {
  const w = mount(Page)
  mounted.push(w)
  await flushPromises()
  return w
}

describe('/assistant', () => {
  beforeEach(() => { vi.clearAllMocks(); seedAuth('ADMIN') })
  afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()) })

  it('avertit quand aucun fournisseur n’est actif', async () => {
    svc.list.mockResolvedValue([provider('a', { enabled: false })])
    const w = await mountPage()
    expect(w.find('[data-test="assistant-no-active"]').exists()).toBe(true)
  })

  it('pas d’avertissement quand un fournisseur est actif', async () => {
    svc.list.mockResolvedValue([provider('a')])
    const w = await mountPage()
    expect(w.find('[data-test="assistant-no-active"]').exists()).toBe(false)
    expect(w.find('[data-test="provider-row-a"]').exists()).toBe(true)
  })

  it('back pas déployé', async () => {
    svc.list.mockRejectedValue(httpError(404))
    const w = await mountPage()
    expect(w.find('[data-test="assistant-unavailable"]').text()).toContain("L'assistant n'est pas encore disponible sur ce serveur.")
    expect(w.find('[data-test="assistant-add"]').exists()).toBe(false)
  })

  it('erreur de chargement affichée, sans avertissement « aucun actif »', async () => {
    svc.list.mockRejectedValue(httpError(500))
    const w = await mountPage()
    expect(w.find('[data-test="assistant-error"]').exists()).toBe(true)
    expect(w.find('[data-test="assistant-no-active"]').exists()).toBe(false)
  })

  it('ouvre la fenêtre d’ajout', async () => {
    svc.list.mockResolvedValue([])
    const w = await mountPage()
    expect(w.find('[data-test="provider-dialog"]').exists()).toBe(false)
    await w.find('[data-test="assistant-add"]').trigger('click')
    expect(w.find('[data-test="provider-dialog"]').exists()).toBe(true)
  })

  it('ouvre la fenêtre de modification', async () => {
    svc.list.mockResolvedValue([provider('a')])
    const w = await mountPage()
    await w.find('[data-test="provider-edit-a"]').trigger('click')
    expect(w.find('[data-test="provider-dialog"]').exists()).toBe(true)
  })

  it('ordre refusé par le serveur : l’ordre précédent revient et un message s’affiche', async () => {
    svc.list.mockResolvedValue([provider('a'), provider('b')])
    svc.reorder.mockRejectedValue(httpError(500))
    const w = await mountPage()
    await w.find('[data-test="provider-down-a"]').trigger('click')
    await flushPromises()
    const rows = w.findAll('tbody tr').map((r) => r.attributes('data-test'))
    expect(rows).toEqual(['provider-row-a', 'provider-row-b'])
    expect(w.find('[data-test="assistant-action-error"]').exists()).toBe(true)
  })

  it('ordre accepté : le nouvel ordre est affiché', async () => {
    svc.list.mockResolvedValue([provider('a'), provider('b')])
    svc.reorder.mockResolvedValue([provider('b'), provider('a')])
    const w = await mountPage()
    await w.find('[data-test="provider-down-a"]').trigger('click')
    await flushPromises()
    expect(svc.reorder).toHaveBeenCalledWith(['b', 'a'])
    expect(w.findAll('tbody tr').map((r) => r.attributes('data-test'))).toEqual(['provider-row-b', 'provider-row-a'])
  })

  it('suppression : passe par la confirmation, annulable', async () => {
    svc.list.mockResolvedValue([provider('a')])
    svc.remove.mockResolvedValue(undefined)
    const w = await mountPage()
    await w.find('[data-test="provider-delete-a"]').trigger('click')
    expect(w.text()).toContain('Supprimer le fournisseur')
    expect(svc.remove).not.toHaveBeenCalled()
    const cancel = w.findAll('button').find((b) => b.text() === 'Annuler')!
    await cancel.trigger('click')
    expect(svc.remove).not.toHaveBeenCalled()
    expect(w.text()).not.toContain('Supprimer le fournisseur')
  })

  it('suppression confirmée : le fournisseur est supprimé', async () => {
    svc.list.mockResolvedValueOnce([provider('a')]).mockResolvedValueOnce([])
    svc.remove.mockResolvedValue(undefined)
    const w = await mountPage()
    await w.find('[data-test="provider-delete-a"]').trigger('click')
    const confirm = w.findAll('button').filter((b) => b.text() === 'Supprimer').at(-1)!
    await confirm.trigger('click')
    await flushPromises()
    expect(svc.remove).toHaveBeenCalledWith('a')
    expect(w.find('[data-test="provider-row-a"]').exists()).toBe(false)
  })

  it('suppression refusée : le message d’action s’affiche', async () => {
    svc.list.mockResolvedValue([provider('a')])
    svc.remove.mockRejectedValue(httpError(500))
    const w = await mountPage()
    await w.find('[data-test="provider-delete-a"]').trigger('click')
    const confirm = w.findAll('button').filter((b) => b.text() === 'Supprimer').at(-1)!
    await confirm.trigger('click')
    await flushPromises()
    expect(w.find('[data-test="assistant-action-error"]').exists()).toBe(true)
  })
})
