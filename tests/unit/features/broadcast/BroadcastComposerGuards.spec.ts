import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'
import type { BroadcastAudience } from '@/features/broadcast/types/index'

/**
 * Une notification push ne se rappelle pas. Deux protections, décidées séparément :
 * - estimation fraîche obligatoire avant tout envoi, quelle que soit la cible ;
 * - phrase de contrôle pour la cible la plus large uniquement (règle vide = tous les comptes).
 */
const aud = (n: number): BroadcastAudience => ({ recipientCount: n, pushReachableCount: 0 })
const FIELDS = [
  { key: 'created_request', family: 'ACTIVITY' as const, label: 'A créé une demande', operators: [{ key: 'EVER', label: 'au moins une fois', valueType: 'NONE' as const }], values: [] },
]

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(BroadcastComposer, {
    props: { audience: null, busy: false, previewing: false, fields: FIELDS, ...props },
  })
}
async function fillMessage(w: ReturnType<typeof mountComposer>) {
  await w.find('[data-test="broadcast-title"]').setValue('Maintenance prévue')
  await w.find('[data-test="broadcast-body"]').setValue('Le service sera coupé ce soir.')
}
const sendButton = (w: ReturnType<typeof mountComposer>) =>
  w.find('[data-test="broadcast-send"]').element as HTMLButtonElement

describe('BroadcastComposer : estimation fraîche obligatoire', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sans estimation, l’envoi reste bloqué même si le message est complet', async () => {
    const w = mountComposer()
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(true)
  })

  it('avec une estimation fraîche, l’envoi se débloque', async () => {
    const w = mountComposer({ audience: aud(42) })
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(false)
  })

  it('changer de ciblage après estimation rebloque l’envoi', async () => {
    const w = mountComposer({ audience: aud(42) })
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(false)
    await w.find('[data-test="shortcut-senders"]').trigger('click')
    expect(sendButton(w).disabled).toBe(true)
    expect(w.find('[data-test="broadcast-stale-estimate"]').exists()).toBe(true)
  })
})

describe('BroadcastComposer : phrase de contrôle sur la cible la plus large', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('tous les comptes : la confirmation exige une saisie de contrôle', async () => {
    const w = mountComposer({ audience: aud(1200) })
    await fillMessage(w)
    await w.find('[data-test="broadcast-send"]').trigger('click')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(true)
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('[data-test="confirmation-input"]').setValue('mauvaise saisie')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.emitted('send')).toBeUndefined()
  })

  it('la saisie correcte débloque et l’envoi part', async () => {
    const w = mountComposer({ audience: aud(1200) })
    await fillMessage(w)
    await w.find('[data-test="broadcast-send"]').trigger('click')
    await w.find('[data-test="confirmation-input"]').setValue('DIFFUSER A TOUS')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('send')).toBeTruthy()
  })

  it('une cible restreinte garde une confirmation simple', async () => {
    const w = mountComposer({ audience: aud(3) })
    await w.find('[data-test="shortcut-senders"]').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ audience: aud(3) })
    await fillMessage(w)
    await w.find('[data-test="broadcast-send"]').trigger('click')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('send')).toBeTruthy()
  })
})
