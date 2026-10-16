import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const createMock = vi.fn()
const updateMock = vi.fn()
vi.mock('@/features/assistant/services/assistantProviderService', () => ({
  assistantProviderService: { create: (...a: unknown[]) => createMock(...a), update: (...a: unknown[]) => updateMock(...a) },
}))

import ProviderFormDialog from '@/features/assistant/components/ProviderFormDialog.vue'
import type { AdminProvider } from '@/features/assistant/types'

const existing: AdminProvider = {
  id: 'p1', name: 'Groq', slug: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama', apiKeyLast4: '1234',
  supportsJsonMode: true, dailyRequestLimit: 1000, priority: 1, enabled: true,
  stats: { requestsToday: 0, successesToday: 0, lastStatus: null, lastError: null, cooldownUntil: null },
}
const httpError = (status: number, data?: Record<string, unknown>) => Object.assign(new Error(`${status}`), { statusCode: status, data })

async function fill(w: ReturnType<typeof mount>, values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) await w.find(`[data-test="provider-${k}"]`).setValue(v)
}

describe('ProviderFormDialog', () => {
  beforeEach(() => { seedAuth('ADMIN'); createMock.mockReset(); updateMock.mockReset() })

  it('le modèle pré-remplit adresse, modèle et mode JSON', async () => {
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await w.find('[data-test="provider-template"]').setValue('Mistral')
    expect((w.find('[data-test="provider-base-url"]').element as HTMLInputElement).value).toBe('https://api.mistral.ai/v1')
    expect((w.find('[data-test="provider-model"]').element as HTMLInputElement).value).toBe('mistral-small-latest')
  })

  it('Ajouter reste désactivé tant que la clé manque', async () => {
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await fill(w, { name: 'Groq', 'base-url': 'https://api.groq.com/openai/v1', model: 'llama' })
    expect(w.find('[data-test="provider-submit"]').attributes('disabled')).toBeDefined()
    await fill(w, { 'api-key': 'gsk_secret_1' })
    expect(w.find('[data-test="provider-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('crée puis émet saved, une seule requête au double clic', async () => {
    let resolve: (_v: AdminProvider) => void = () => {}
    createMock.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await fill(w, { name: 'Groq', 'base-url': 'https://api.groq.com/openai/v1', model: 'llama', 'api-key': 'gsk_secret_1', limit: '1000' })
    await w.find('[data-test="provider-submit"]').trigger('click')
    await w.find('[data-test="provider-submit"]').trigger('click')
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0]![0]).toMatchObject({ name: 'Groq', apiKey: 'gsk_secret_1', dailyRequestLimit: 1000 })
    resolve(existing)
    await flushPromises()
    expect(w.emitted('saved')?.[0]).toEqual([existing])
  })

  it('limite vide = sans limite', async () => {
    createMock.mockResolvedValue(existing)
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await fill(w, { name: 'Groq', 'base-url': 'https://a.com', model: 'm', 'api-key': 'gsk_secret_1', limit: '' })
    await w.find('[data-test="provider-submit"]').trigger('click')
    expect(createMock.mock.calls[0]![0].dailyRequestLimit).toBeNull()
  })

  it('en modification, la clé est facultative et l’aide l’explique', async () => {
    updateMock.mockResolvedValue(existing)
    const w = mount(ProviderFormDialog, { props: { open: true, provider: existing } })
    expect(w.text()).toContain('Laisser vide pour garder la clé actuelle')
    expect(w.text()).toContain('••••1234')
    await w.find('[data-test="provider-submit"]').trigger('click')
    await flushPromises()
    expect(updateMock).toHaveBeenCalledWith('p1', expect.objectContaining({ apiKey: '' }))
  })

  it('affiche le 422 sous le champ clé quand l’adresse change sans clé', async () => {
    updateMock.mockRejectedValue(httpError(422, { violations: { apiKey: "Saisissez à nouveau la clé quand l'adresse change." } }))
    const w = mount(ProviderFormDialog, { props: { open: true, provider: existing } })
    await fill(w, { 'base-url': 'https://autre.com/v1' })
    await w.find('[data-test="provider-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="provider-field-error-apiKey"]').text()).toContain('Saisissez à nouveau la clé')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('erreur générale', async () => {
    createMock.mockRejectedValue(httpError(500, { detail: 'Panne' }))
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await fill(w, { name: 'Groq', 'base-url': 'https://a.com', model: 'm', 'api-key': 'gsk_secret_1' })
    await w.find('[data-test="provider-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="provider-error"]').text()).toBe('Panne')
  })

  it('Annuler et Échap émettent close', async () => {
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await w.find('[data-test="provider-cancel"]').trigger('click')
    await w.find('[data-test="provider-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(2)
  })
})
