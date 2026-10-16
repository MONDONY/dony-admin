import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
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

  describe('limite par jour', () => {
    async function submitWithLimit(limit: string) {
      createMock.mockResolvedValue(existing)
      const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
      await fill(w, { name: 'Groq', 'base-url': 'https://a.com', model: 'm', 'api-key': 'gsk_secret_1', limit })
      await w.find('[data-test="provider-submit"]').trigger('click')
      await flushPromises()
      return w
    }

    it('1000 est envoyé tel quel', async () => {
      await submitWithLimit('1000')
      expect(createMock.mock.calls[0]![0].dailyRequestLimit).toBe(1000)
    })

    it('espaces seuls = sans limite', async () => {
      await submitWithLimit('   ')
      expect(createMock.mock.calls[0]![0].dailyRequestLimit).toBeNull()
    })

    it.each(['1e', '-', '0', '-5', '1.5', 'abc', '1 000'])('« %s » : erreur sous le champ, aucun envoi', async (raw) => {
      const w = await submitWithLimit(raw)
      expect(createMock).not.toHaveBeenCalled()
      expect(w.find('[data-test="provider-field-error-dailyRequestLimit"]').text()).toBe('Saisissez un nombre entier positif, ou laissez vide.')
      expect(w.find('[data-test="provider-limit"]').attributes('aria-invalid')).toBe('true')
    })

    it('en modification, une saisie illisible ne supprime jamais la limite existante', async () => {
      const w = mount(ProviderFormDialog, { props: { open: true, provider: existing } })
      await fill(w, { limit: '1e' })
      await w.find('[data-test="provider-submit"]').trigger('click')
      await flushPromises()
      expect(updateMock).not.toHaveBeenCalled()
    })

    it('l’erreur disparaît dès la saisie corrigée, puis le nouvel envoi passe', async () => {
      const w = await submitWithLimit('0')
      expect(w.find('[data-test="provider-field-error-dailyRequestLimit"]').exists()).toBe(true)
      await fill(w, { limit: '5' })
      expect(w.find('[data-test="provider-field-error-dailyRequestLimit"]').exists()).toBe(false)
      expect(w.find('[data-test="provider-limit"]').attributes('aria-invalid')).toBeUndefined()
      await w.find('[data-test="provider-submit"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="provider-field-error-dailyRequestLimit"]').exists()).toBe(false)
      expect(createMock.mock.calls[0]![0].dailyRequestLimit).toBe(5)
    })

    it('affiche le 422 dailyRequestLimit sous le champ', async () => {
      createMock.mockRejectedValue(httpError(422, { violations: { dailyRequestLimit: 'Trop élevée.' } }))
      const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
      await fill(w, { name: 'Groq', 'base-url': 'https://a.com', model: 'm', 'api-key': 'gsk_secret_1', limit: '99' })
      await w.find('[data-test="provider-submit"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="provider-field-error-dailyRequestLimit"]').text()).toBe('Trop élevée.')
    })
  })

  describe('fermeture par le fond', () => {
    it('mousedown et click sur le fond : ferme', async () => {
      const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
      await w.trigger('mousedown')
      await w.trigger('click')
      expect(w.emitted('close')).toHaveLength(1)
    })

    it('sélection de texte commencée dans un champ et relâchée sur le fond : ne ferme pas', async () => {
      const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
      await w.find('[data-test="provider-name"]').trigger('mousedown')
      await w.trigger('click')
      expect(w.emitted('close')).toBeUndefined()
    })

    it('click sans mousedown préalable sur le fond : ne ferme pas', async () => {
      const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
      await w.trigger('click')
      expect(w.emitted('close')).toBeUndefined()
    })

    it('click dans la fenêtre : ne ferme pas', async () => {
      const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
      await w.trigger('mousedown')
      await w.find('[data-test="provider-dialog"]').trigger('click')
      expect(w.emitted('close')).toBeUndefined()
    })
  })

  it('le premier champ a le focus à l’ouverture', async () => {
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null }, attachTo: document.body })
    await nextTick()
    expect(document.activeElement).toBe(w.find('[data-test="provider-template"]').element)
    w.unmount()
    const e = mount(ProviderFormDialog, { props: { open: true, provider: existing }, attachTo: document.body })
    await nextTick()
    expect(document.activeElement).toBe(e.find('[data-test="provider-name"]').element)
    e.unmount()
  })

  it('le focus est donné aussi à la réouverture', async () => {
    const w = mount(ProviderFormDialog, { props: { open: false, provider: null }, attachTo: document.body })
    await w.setProps({ open: true })
    await nextTick()
    expect(document.activeElement).toBe(w.find('[data-test="provider-template"]').element)
    w.unmount()
  })

  it('champ en erreur : aria-invalid et aria-describedby vers le message', async () => {
    updateMock.mockRejectedValue(httpError(422, { violations: { apiKey: 'Saisissez à nouveau la clé.', name: 'Nom pris.' } }))
    const w = mount(ProviderFormDialog, { props: { open: true, provider: existing } })
    expect(w.find('[data-test="provider-api-key"]').attributes('aria-invalid')).toBeUndefined()
    expect(w.find('[data-test="provider-api-key"]').attributes('aria-describedby')).toBeUndefined()
    await w.find('[data-test="provider-submit"]').trigger('click')
    await flushPromises()
    const key = w.find('[data-test="provider-api-key"]')
    expect(key.attributes('aria-invalid')).toBe('true')
    const msg = w.find('[data-test="provider-field-error-apiKey"]')
    expect(msg.attributes('id')).toBeTruthy()
    expect(key.attributes('aria-describedby')).toBe(msg.attributes('id'))
    const name = w.find('[data-test="provider-name"]')
    expect(name.attributes('aria-invalid')).toBe('true')
    expect(name.attributes('aria-describedby')).toBe(w.find('[data-test="provider-field-error-name"]').attributes('id'))
  })

  it('les champs baseUrl et model en erreur portent aussi aria-invalid', async () => {
    updateMock.mockRejectedValue(httpError(422, { violations: { baseUrl: 'Adresse invalide.', model: 'Modèle inconnu.' } }))
    const w = mount(ProviderFormDialog, { props: { open: true, provider: existing } })
    await w.find('[data-test="provider-submit"]').trigger('click')
    await flushPromises()
    for (const [field, err] of [['base-url', 'baseUrl'], ['model', 'model']] as const) {
      const input = w.find(`[data-test="provider-${field}"]`)
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(input.attributes('aria-describedby')).toBe(w.find(`[data-test="provider-field-error-${err}"]`).attributes('id'))
    }
  })

  it('le mode JSON est repris du modèle choisi', async () => {
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    const json = () => (w.find('[data-test="provider-json"]').element as HTMLInputElement).checked
    expect(json()).toBe(true)
    await w.find('[data-test="provider-template"]').setValue('OpenRouter')
    expect(json()).toBe(false)
    await w.find('[data-test="provider-template"]').setValue('Groq')
    expect(json()).toBe(true)
  })

  it('un nom déjà tapé n’est pas écrasé par le modèle', async () => {
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await fill(w, { name: 'Mon Groq' })
    await w.find('[data-test="provider-template"]').setValue('Groq')
    expect((w.find('[data-test="provider-name"]').element as HTMLInputElement).value).toBe('Mon Groq')
    const v = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await v.find('[data-test="provider-template"]').setValue('Groq')
    expect((v.find('[data-test="provider-name"]').element as HTMLInputElement).value).toBe('Groq')
  })

  it('réouverture : champs remis à zéro, clé vide, erreurs effacées', async () => {
    updateMock.mockRejectedValue(httpError(422, { violations: { apiKey: 'Erreur.' } }))
    const w = mount(ProviderFormDialog, { props: { open: true, provider: existing } })
    await fill(w, { name: 'Autre nom', 'api-key': 'gsk_nouvelle' })
    await w.find('[data-test="provider-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="provider-field-error-apiKey"]').exists()).toBe(true)
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="provider-name"]').element as HTMLInputElement).value).toBe('Groq')
    expect((w.find('[data-test="provider-api-key"]').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="provider-field-error-apiKey"]').exists()).toBe(false)
  })

  it('fermeture bloquée pendant l’envoi (Annuler, Échap, fond)', async () => {
    let resolve: (_v: AdminProvider) => void = () => {}
    createMock.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await fill(w, { name: 'Groq', 'base-url': 'https://a.com', model: 'm', 'api-key': 'gsk_secret_1' })
    await w.find('[data-test="provider-submit"]').trigger('click')
    expect(w.find('[data-test="provider-cancel"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="provider-cancel"]').trigger('click')
    await w.find('[data-test="provider-dialog"]').trigger('keydown', { key: 'Escape' })
    await w.trigger('mousedown')
    await w.trigger('click')
    expect(w.emitted('close')).toBeUndefined()
    resolve(existing)
    await flushPromises()
    await w.find('[data-test="provider-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('une autre touche qu’Échap ne ferme pas', async () => {
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    await w.find('[data-test="provider-dialog"]').trigger('keydown', { key: 'a' })
    expect(w.emitted('close')).toBeUndefined()
  })

  it('le champ clé échappe aux gestionnaires de mots de passe', () => {
    const key = mount(ProviderFormDialog, { props: { open: true, provider: null } }).find('[data-test="provider-api-key"]')
    expect(key.attributes('type')).toBe('password')
    expect(key.attributes('autocomplete')).toBe('new-password')
    expect(key.attributes('data-1p-ignore')).toBeDefined()
    expect(key.attributes('data-lpignore')).toBe('true')
    expect(key.attributes('data-bwignore')).toBeDefined()
    expect(key.attributes('data-form-type')).toBe('other')
  })

  it('la clé saisie est effacée de la mémoire à la fermeture et après l’enregistrement', async () => {
    createMock.mockResolvedValue(existing)
    const w = mount(ProviderFormDialog, { props: { open: true, provider: null } })
    const keyValue = () => (w.find('[data-test="provider-api-key"]').element as HTMLInputElement).value
    await fill(w, { 'api-key': 'gsk_secret_1' })
    await w.find('[data-test="provider-cancel"]').trigger('click')
    expect(keyValue()).toBe('')
    await fill(w, { name: 'Groq', 'base-url': 'https://a.com', model: 'm', 'api-key': 'gsk_secret_2' })
    await w.find('[data-test="provider-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('saved')).toHaveLength(1)
    expect(keyValue()).toBe('')
  })
})
