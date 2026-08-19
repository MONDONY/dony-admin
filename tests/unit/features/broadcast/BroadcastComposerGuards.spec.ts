import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'

/**
 * Une notification push ne se rappelle pas. La diffusion est le geste le plus large de
 * l'outil, et c'était le moins protégé : l'envoi ne dépendait pas de l'estimation, et une
 * cible « tous les comptes actifs » se validait en un clic — alors que désactiver les SMS,
 * geste réversible, exige de taper une phrase de contrôle.
 *
 * Deux protections, décidées séparément :
 * - **estimation fraîche obligatoire** avant tout envoi, quelle que soit la cible : c'est
 *   elle qui oblige à VOIR le nombre avant de s'engager ;
 * - **phrase de contrôle** pour la cible la plus large uniquement, pour ne pas banaliser
 *   une friction qui finirait tapée sans être lue.
 */
function mountComposer(props: Partial<InstanceType<typeof BroadcastComposer>['$props']> = {}) {
  return mount(BroadcastComposer, {
    props: { recipientCount: null, busy: false, previewing: false, ...props },
  })
}

async function fillMessage(w: ReturnType<typeof mountComposer>) {
  await w.find('[data-test="broadcast-title"]').setValue('Maintenance prévue')
  await w.find('[data-test="broadcast-body"]').setValue('Le service sera coupé ce soir.')
}

const sendButton = (w: ReturnType<typeof mountComposer>) =>
  w.find('[data-test="broadcast-send"]').element as HTMLButtonElement

describe('BroadcastComposer — estimation fraîche obligatoire', () => {
  it('sans estimation, l’envoi reste bloqué même si le message est complet', async () => {
    const w = mountComposer()
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(true)
  })

  it('avec une estimation fraîche, l’envoi se débloque', async () => {
    const w = mountComposer({ recipientCount: 42 })
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(false)
  })

  it('changer de ciblage après estimation rebloque l’envoi', async () => {
    const w = mountComposer({ recipientCount: 42 })
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(false)

    await w.find('[data-test="broadcast-target"]').setValue('SENDERS')
    expect(sendButton(w).disabled).toBe(true)
    expect(w.find('[data-test="broadcast-stale-estimate"]').exists()).toBe(true)
  })
})

describe('BroadcastComposer — phrase de contrôle sur la cible la plus large', () => {
  it('cible « tous les comptes » : la confirmation exige une saisie de contrôle', async () => {
    const w = mountComposer({ recipientCount: 1200 })
    await fillMessage(w)
    await w.find('[data-test="broadcast-send"]').trigger('click')

    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(true)
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)

    await w.find('[data-test="confirmation-input"]').setValue('mauvaise saisie')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.emitted('send')).toBeUndefined()
  })

  it('la saisie correcte débloque et l’envoi part', async () => {
    const w = mountComposer({ recipientCount: 1200 })
    await fillMessage(w)
    await w.find('[data-test="broadcast-send"]').trigger('click')

    await w.find('[data-test="confirmation-input"]').setValue('DIFFUSER A TOUS')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(false)

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('send')).toBeTruthy()
  })

  // La friction est réservée à la cible la plus large : l'imposer partout la banaliserait,
  // et une confirmation qu'on tape sans lire ne protège plus de rien.
  it('une cible restreinte garde une confirmation simple', async () => {
    const w = mountComposer({ recipientCount: 3 })
    await fillMessage(w)
    await w.find('[data-test="broadcast-target"]').setValue('USER')
    await w.find('[data-test="broadcast-user-id"]').setValue('u-1')
    await w.find('[data-test="broadcast-preview"]').trigger('click')
    await w.setProps({ recipientCount: 1 })

    await w.find('[data-test="broadcast-send"]').trigger('click')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('send')).toBeTruthy()
  })
})
