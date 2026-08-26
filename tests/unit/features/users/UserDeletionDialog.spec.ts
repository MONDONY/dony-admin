import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDeletionDialog from '@/features/users/components/UserDeletionDialog.vue'

const user = { id: 'u-42', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr' }

const clean = { blocked: false, findings: [] }

const blocked = {
  blocked: true,
  findings: [{ severity: 'BLOCKING', code: 'ACTIVE_ESCROW', count: 1, parties: [] }],
}

const warned = {
  blocked: false,
  findings: [{
    severity: 'WARNING', code: 'PARCEL_IN_TRANSIT', count: 1,
    parties: [{ userId: 'u-99', displayName: 'Awa D.', relatedEntityId: 'b-1' }],
  }],
}

function mountDialog(impact: unknown, extra: Record<string, unknown> = {}) {
  return mount(UserDeletionDialog, {
    props: { open: true, user, impact, isLoading: false, busy: false, error: null, ...extra },
  })
}

describe('UserDeletionDialog', () => {
  // Pas un bouton grisé qu'on peut espérer forcer : rien du tout, pour que l'obstacle
  // se lise comme un obstacle et non comme une confirmation à insister.
  it("n'affiche aucune zone de confirmation quand un constat bloque", () => {
    const w = mountDialog(blocked)
    expect(w.find('[data-test="deletion-confirm-zone"]').exists()).toBe(false)
    expect(w.find('[data-test="finding-ACTIVE_ESCROW"]').exists()).toBe(true)
  })

  it('affiche la zone de confirmation quand le rapport est propre', () => {
    expect(mountDialog(clean).find('[data-test="deletion-confirm-zone"]').exists()).toBe(true)
  })

  it('nomme les contreparties et pointe leur fiche dans un nouvel onglet', () => {
    const link = mountDialog(warned).find('[data-test="party-u-99"]')
    expect(link.text()).toContain('Awa D.')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('garde la confirmation désactivée tant que la phrase de contrôle est incomplète', async () => {
    const w = mountDialog(clean)
    await w.find('[data-test="deletion-reason-code"]').setValue('FRAUD')
    await w.find('[data-test="deletion-reason"]').setValue('faux documents')
    expect(w.find('[data-test="deletion-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('émet les deux motifs une fois tous les champs remplis', async () => {
    const w = mountDialog(clean)
    await w.find('[data-test="deletion-reason-code"]').setValue('FRAUD')
    await w.find('[data-test="deletion-reason"]').setValue('faux documents')
    await w.find('[data-test="deletion-confirmation-input"]').setValue('Jean Dupont')
    await w.find('[data-test="deletion-confirm"]').trigger('click')

    expect(w.emitted('confirm')).toEqual([['FRAUD', 'faux documents']])
  })

  it("affiche le message d'erreur renvoyé par le back", () => {
    const w = mountDialog(clean, { error: 'Suppression impossible' })
    expect(w.find('[data-test="deletion-error"]').text()).toContain('Suppression impossible')
  })

  it("émet cancel sur le bouton d'annulation", async () => {
    const w = mountDialog(clean)
    await w.find('[data-test="deletion-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
