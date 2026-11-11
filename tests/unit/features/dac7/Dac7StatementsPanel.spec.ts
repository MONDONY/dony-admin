import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ sendStatements: vi.fn() }))
vi.mock('@/features/dac7/services/dac7Service', () => ({ dac7Service: svc }))

import Dac7StatementsPanel from '@/features/dac7/components/Dac7StatementsPanel.vue'
import { currentUtcYear } from '@/features/dac7/types/index'

// Le back n'accepte qu'une année terminée : on envoie pour la dernière année close.
const CLOSED = currentUtcYear() - 1
const mountIt = (year = CLOSED) => mount(Dac7StatementsPanel, { props: { year } })

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
    expect(w.get('[role="dialog"]').text()).toContain(String(CLOSED))
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
    expect(svc.sendStatements).toHaveBeenCalledWith(CLOSED)
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

  it('un autre choix d’année efface le résultat de la précédente', async () => {
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="dac7-statements-year"]').setValue(String(CLOSED - 1))
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

  it('le sélecteur ne propose que des années terminées', () => {
    const w = mountIt()
    const years = w.findAll('[data-test="dac7-statements-year"] option').map(o => Number(o.text()))
    expect(years.length).toBeGreaterThan(0)
    for (const y of years) expect(y).toBeLessThan(currentUtcYear())
    expect(years[0]).toBe(CLOSED)
  })

  it('année de la page en cours : explication, et l’envoi vise la dernière année terminée', async () => {
    const w = mountIt(currentUtcYear())
    expect(w.get('[data-test="dac7-statements-closed-hint"]').text()).toMatch(/n’est pas terminée/)
    expect((w.get('[data-test="dac7-statements-year"]').element as HTMLSelectElement).value).toBe(String(CLOSED))
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.sendStatements).toHaveBeenCalledWith(CLOSED)
  })

  it('année de la page terminée : pas d’avertissement', () => {
    expect(mountIt().find('[data-test="dac7-statements-closed-hint"]').exists()).toBe(false)
  })

  it('422 dac7-year-not-closed (garde du serveur) : phrase claire', async () => {
    svc.sendStatements.mockRejectedValue({ statusCode: 422, data: { code: 'dac7-year-not-closed', detail: 'brut' } })
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-statements-error"]').text()).toBe('Le récapitulatif d’une année ne peut être envoyé qu’après la fin de cette année.')
  })

  it('409 dac7-collection-disabled : phrase claire', async () => {
    svc.sendStatements.mockRejectedValue({ statusCode: 409, data: { code: 'dac7-collection-disabled' } })
    const w = mountIt()
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-statements-error"]').text()).toContain('La collecte est éteinte')
  })
})
