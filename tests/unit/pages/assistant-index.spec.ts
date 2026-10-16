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
import ProviderFormDialog from '@/features/assistant/components/ProviderFormDialog.vue'

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

  it('ajout enregistré : la nouvelle ligne apparaît et la fenêtre se ferme', async () => {
    svc.list.mockResolvedValue([provider('a')])
    const w = await mountPage()
    await w.find('[data-test="assistant-add"]').trigger('click')
    w.findComponent(ProviderFormDialog).vm.$emit('saved', provider('nouveau'))
    await flushPromises()
    expect(w.find('[data-test="provider-row-nouveau"]').exists()).toBe(true)
    expect(w.find('[data-test="provider-row-a"]').exists()).toBe(true)
    expect(w.find('[data-test="provider-dialog"]').exists()).toBe(false)
  })

  it('modification enregistrée : la ligne existante est mise à jour', async () => {
    svc.list.mockResolvedValue([provider('a'), provider('b')])
    const w = await mountPage()
    await w.find('[data-test="provider-edit-a"]').trigger('click')
    w.findComponent(ProviderFormDialog).vm.$emit('saved', provider('a', { name: 'Renommé' }))
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.find('[data-test="provider-row-a"]').text()).toContain('Renommé')
    expect(w.find('[data-test="provider-dialog"]').exists()).toBe(false)
  })

  it('interrupteur : met le fournisseur en pause', async () => {
    svc.list.mockResolvedValue([provider('a')])
    svc.update.mockResolvedValue(provider('a', { enabled: false }))
    const w = await mountPage()
    await w.find('[data-test="provider-toggle-a"]').trigger('click')
    await flushPromises()
    expect(svc.update).toHaveBeenCalledWith('a', expect.objectContaining({ enabled: false }))
    expect(w.find('[data-test="provider-row-a"]').text()).toContain('En pause')
  })

  it('Tester : affiche le résultat dans la ligne', async () => {
    svc.list.mockResolvedValue([provider('a')])
    svc.test.mockResolvedValue({ ok: true, status: 200, latencyMs: 820, sample: 'ok', error: null })
    const w = await mountPage()
    await w.find('[data-test="provider-test-a"]').trigger('click')
    await flushPromises()
    expect(svc.test).toHaveBeenCalledWith('a')
    expect(w.find('[data-test="provider-test-result-a"]').text()).toContain('OK en 820 ms')
  })

  it('double clic sur Supprimer : une seule requête', async () => {
    svc.list.mockResolvedValue([provider('a')])
    let resolve: () => void = () => {}
    svc.remove.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const w = await mountPage()
    await w.find('[data-test="provider-delete-a"]').trigger('click')
    const confirm = w.findAll('button').filter((b) => b.text() === 'Supprimer').at(-1)!
    await confirm.trigger('click')
    await confirm.trigger('click')
    expect(svc.remove).toHaveBeenCalledTimes(1)
    resolve()
    await flushPromises()
  })

  it('modification enregistrée : le résultat de test périmé de la ligne disparaît', async () => {
    svc.list.mockResolvedValue([provider('a'), provider('b')])
    svc.test.mockResolvedValue({ ok: true, status: 200, latencyMs: 820, sample: 'ok', error: null })
    const w = await mountPage()
    await w.find('[data-test="provider-test-a"]').trigger('click')
    await w.find('[data-test="provider-test-b"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="provider-edit-a"]').trigger('click')
    w.findComponent(ProviderFormDialog).vm.$emit('saved', provider('a', { baseUrl: 'https://autre.com/v1' }))
    await flushPromises()
    expect(w.find('[data-test="provider-test-result-a"]').exists()).toBe(false)
    expect(w.find('[data-test="provider-test-result-b"]').exists()).toBe(true)
  })

  it('ajout enregistré : les résultats de test existants sont conservés', async () => {
    svc.list.mockResolvedValue([provider('a')])
    svc.test.mockResolvedValue({ ok: true, status: 200, latencyMs: 820, sample: 'ok', error: null })
    const w = await mountPage()
    await w.find('[data-test="provider-test-a"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="assistant-add"]').trigger('click')
    w.findComponent(ProviderFormDialog).vm.$emit('saved', provider('nouveau'))
    await flushPromises()
    expect(w.find('[data-test="provider-test-result-a"]').exists()).toBe(true)
  })

  it('erreur de chargement : pas de texte « Aucun fournisseur » sous l’erreur', async () => {
    svc.list.mockRejectedValue(httpError(500))
    const w = await mountPage()
    expect(w.find('[data-test="assistant-error"]').exists()).toBe(true)
    expect(w.find('[data-test="providers-empty"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Aucun fournisseur')
  })

  it('suppression : la table ne repasse pas par « Chargement… »', async () => {
    svc.list.mockResolvedValueOnce([provider('a'), provider('b')])
    let resolveList: (_v: unknown[]) => void = () => {}
    svc.list.mockReturnValueOnce(new Promise((r) => { resolveList = r }))
    svc.remove.mockResolvedValue(undefined)
    const w = await mountPage()
    await w.find('[data-test="provider-delete-a"]').trigger('click')
    await w.findAll('button').filter((b) => b.text() === 'Supprimer').at(-1)!.trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Chargement')
    // La confirmation se ferme sans attendre le rechargement, encore en attente.
    expect(w.text()).not.toContain('Supprimer le fournisseur')
    expect(w.find('[data-test="provider-row-a"]').exists()).toBe(false)
    expect(w.find('[data-test="provider-row-b"]').exists()).toBe(true)
    resolveList([provider('b')])
    await flushPromises()
  })
})
