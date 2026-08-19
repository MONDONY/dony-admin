import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'

function mountComposer(props: Partial<InstanceType<typeof BroadcastComposer>['$props']> = {}) {
  return mount(BroadcastComposer, {
    props: { recipientCount: null, busy: false, previewing: false, ...props },
  })
}

describe('BroadcastComposer', () => {
  it('désactive l’envoi tant que le titre ou le corps est vide', async () => {
    const w = mountComposer()
    expect((w.find('[data-test="broadcast-send"]').element as HTMLButtonElement).disabled).toBe(true)

    await w.find('[data-test="broadcast-title"]').setValue('Maintenance prévue')
    expect((w.find('[data-test="broadcast-send"]').element as HTMLButtonElement).disabled).toBe(true)

    await w.find('[data-test="broadcast-body"]').setValue('Le service sera coupé ce soir.')
    expect((w.find('[data-test="broadcast-send"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('révèle origine/destination pour la cible CORRIDOR et les cache pour les autres', async () => {
    const w = mountComposer()
    expect(w.find('[data-test="broadcast-origin"]').exists()).toBe(false)
    expect(w.find('[data-test="broadcast-destination"]').exists()).toBe(false)

    await w.find('[data-test="broadcast-target"]').setValue('CORRIDOR')
    expect(w.find('[data-test="broadcast-origin"]').exists()).toBe(true)
    expect(w.find('[data-test="broadcast-destination"]').exists()).toBe(true)
    expect(w.find('[data-test="broadcast-user-id"]').exists()).toBe(false)

    await w.find('[data-test="broadcast-target"]').setValue('ALL')
    expect(w.find('[data-test="broadcast-origin"]').exists()).toBe(false)
    expect(w.find('[data-test="broadcast-destination"]').exists()).toBe(false)
  })

  it('révèle le champ identifiant utilisateur pour la cible USER', async () => {
    const w = mountComposer()
    await w.find('[data-test="broadcast-target"]').setValue('USER')
    expect(w.find('[data-test="broadcast-user-id"]').exists()).toBe(true)
    expect(w.find('[data-test="broadcast-origin"]').exists()).toBe(false)
  })

  it('« Estimer les destinataires » émet preview avec le ciblage exact composé', async () => {
    const w = mountComposer()
    await w.find('[data-test="broadcast-target"]').setValue('CORRIDOR')
    await w.find('[data-test="broadcast-origin"]').setValue('Paris')
    await w.find('[data-test="broadcast-destination"]').setValue('Dakar')
    await w.find('[data-test="broadcast-preview"]').trigger('click')

    expect(w.emitted('preview')![0]).toEqual([{ type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' }])
  })

  it('« Estimer les destinataires » avec la cible USER compose userId', async () => {
    const w = mountComposer()
    await w.find('[data-test="broadcast-target"]').setValue('USER')
    await w.find('[data-test="broadcast-user-id"]').setValue('u-42')
    await w.find('[data-test="broadcast-preview"]').trigger('click')

    expect(w.emitted('preview')![0]).toEqual([{ type: 'USER', userId: 'u-42' }])
  })

  it('affiche le nombre de destinataires estimé quand il est fourni', () => {
    const w = mountComposer({ recipientCount: 1234 })
    expect(w.find('[data-test="broadcast-recipient-count"]').text()).toContain('1234')
  })

  it('n’affiche rien quand le nombre de destinataires est inconnu', () => {
    const w = mountComposer({ recipientCount: null })
    expect(w.find('[data-test="broadcast-recipient-count"]').exists()).toBe(false)
  })

  it('l’envoi passe par une modale de confirmation qui rappelle le nombre de destinataires', async () => {
    const w = mountComposer({ recipientCount: 87 })
    await w.find('[data-test="broadcast-title"]').setValue('Titre')
    await w.find('[data-test="broadcast-body"]').setValue('Corps')
    await w.find('[data-test="broadcast-send"]').trigger('click')

    expect(w.find('[data-test="confirm"]').exists()).toBe(true)
    expect(w.text()).toContain('87')

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('send')![0]).toEqual(['Titre', 'Corps', { type: 'ALL' }])
  })

  it('annuler la confirmation n’émet pas send', async () => {
    const w = mountComposer({ recipientCount: 87 })
    await w.find('[data-test="broadcast-title"]').setValue('Titre')
    await w.find('[data-test="broadcast-body"]').setValue('Corps')
    await w.find('[data-test="broadcast-send"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')

    expect(w.emitted('send')).toBeUndefined()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('désactive les commandes pendant l’envoi (busy)', () => {
    const w = mountComposer({ busy: true })
    expect((w.find('[data-test="broadcast-title"]').element as HTMLInputElement).disabled).toBe(true)
    expect((w.find('[data-test="broadcast-body"]').element as HTMLTextAreaElement).disabled).toBe(true)
    expect((w.find('[data-test="broadcast-target"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((w.find('[data-test="broadcast-preview"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="broadcast-send"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  // L'estimation porte sur UN ciblage precis. Changer de ciblage apres avoir estime
  // rendrait le compteur mensonger — et c'est justement ce compteur qui sert de garde
  // avant un envoi irrattrapable.
  it('perime l’estimation quand le ciblage change', async () => {
    const w = mount(BroadcastComposer, {
      props: { busy: false, previewing: false, recipientCount: 128 },
    })
    expect(w.find('[data-test="broadcast-recipient-count"]').exists()).toBe(true)

    await w.find('[data-test="broadcast-target"]').setValue('SENDERS')

    expect(w.find('[data-test="broadcast-recipient-count"]').exists()).toBe(false)
    expect(w.find('[data-test="broadcast-stale-estimate"]').exists()).toBe(true)
  })

  it('la confirmation ne cite pas un compteur perime', async () => {
    const w = mount(BroadcastComposer, {
      props: { busy: false, previewing: false, recipientCount: 128 },
    })
    await w.find('[data-test="broadcast-title"]').setValue('Titre')
    await w.find('[data-test="broadcast-body"]').setValue('Corps du message')
    await w.find('[data-test="broadcast-target"]').setValue('TRAVELERS')
    await w.find('[data-test="broadcast-send"]').trigger('click')

    expect(w.html()).not.toContain('128')
  })

})
