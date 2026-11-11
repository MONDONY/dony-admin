import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ sendStatements: vi.fn() }))
vi.mock('@/features/dac7/services/dac7Service', () => ({ dac7Service: svc }))

import Dac7StatementsPanel from '@/features/dac7/components/Dac7StatementsPanel.vue'

const mountIt = () => mount(Dac7StatementsPanel, { props: { year: 2026 } })

describe('Dac7StatementsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.sendStatements.mockResolvedValue({ sent: 3, skipped: 1 })
  })

  it('explique ce qui part, à qui et une seule fois par année', () => {
    const w = mountIt()
    const t = w.get('[data-test="dac7-statements-panel"]').text()
    expect(t).toMatch(/voyageur déclaré/i)
    expect(t).toMatch(/une seule fois/i)
    expect(w.get('[data-test="dac7-statements-send"]').text()).toBe('Envoyer les récapitulatifs aux voyageurs')
  })

  it('rien ne part sans confirmation explicite (phrase à saisir)', async () => {
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    expect(svc.sendStatements).not.toHaveBeenCalled()
    expect(w.get('[role="dialog"]').text()).toContain('2026')
    expect(w.get('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    expect(w.get('[data-test="confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('annuler n’envoie rien', async () => {
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="cancel"]').trigger('click')
    expect(svc.sendStatements).not.toHaveBeenCalled()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('après confirmation : envoie pour l’année et montre {sent, skipped}', async () => {
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.sendStatements).toHaveBeenCalledWith(2026)
    const r = w.get('[data-test="dac7-statements-result"]').text()
    expect(r).toContain('3 envoyés')
    expect(r).toContain('1 ignoré')
  })

  it('résultat sans champs (ancien back) : zéro, jamais « undefined »', async () => {
    svc.sendStatements.mockResolvedValue({})
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    const r = w.get('[data-test="dac7-statements-result"]').text()
    expect(r).toContain('0 envoyé')
    expect(r).not.toContain('undefined')
  })

  it('erreur du serveur : message, pas de résultat', async () => {
    svc.sendStatements.mockRejectedValue({ statusCode: 500, data: { detail: 'Messagerie indisponible' } })
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-statements-error"]').text()).toContain('Messagerie indisponible')
    expect(w.find('[data-test="dac7-statements-result"]').exists()).toBe(false)
  })

  it('ancien back : non disponible', async () => {
    svc.sendStatements.mockRejectedValue({ statusCode: 404, data: {} })
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-unavailable"]').text()).toContain('Non disponible sur cette version du serveur')
    expect(w.find('[data-test="dac7-statements-error"]').exists()).toBe(false)
  })

  it('une nouvelle année efface le résultat de l’ancienne', async () => {
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    await w.setProps({ year: 2025 })
    expect(w.find('[data-test="dac7-statements-result"]').exists()).toBe(false)
  })

  it('prévient la page pendant l’envoi (verrou du sélecteur d’année)', async () => {
    let resolve: (_value: unknown) => void = () => {}
    svc.sendStatements.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.emitted('busy')?.at(-1)).toEqual([true])
    resolve({ sent: 1, skipped: 0 })
    await flushPromises()
    expect(w.emitted('busy')?.at(-1)).toEqual([false])
  })

  it('« Non disponible » disparaît à l’essai suivant', async () => {
    svc.sendStatements.mockRejectedValueOnce({ statusCode: 404, data: {} })
    const w = mountIt()
    const send = async () => {
      await w.get('[data-test="dac7-statements-send"]').trigger('click')
      await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
      await w.get('[data-test="confirm"]').trigger('click')
      await flushPromises()
    }
    await send()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
    await send()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(false)
    expect(w.find('[data-test="dac7-statements-result"]').exists()).toBe(true)
  })
})
