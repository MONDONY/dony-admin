import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'

/**
 * Catalogue de motifs optionnel. Il sert la séparation entre ce qui est **annoncé à
 * l'utilisateur sanctionné** (le motif catalogué) et ce qui reste **interne** (la note
 * libre) : un même champ pour les deux faisait fuiter l'identité du signalant.
 *
 * La propriété est optionnelle — les autres écrans qui utilisent ce dialogue ne changent pas.
 */
const OPTIONS = [
  { value: 'SUSPECTED_FRAUD', label: 'Soupçon de fraude' },
  { value: 'DUPLICATE', label: 'Annonce en double' },
]

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(ConfirmActionDialog, {
    props: {
      open: true, title: 'Retirer', message: 'Confirmer ?', confirmLabel: 'Retirer', ...props,
    },
  })
}

describe('ConfirmActionDialog — catalogue de motifs', () => {
  it('sans catalogue, le dialogue est inchangé', () => {
    const w = mountDialog()
    expect(w.find('[data-test="reason-choice"]').exists()).toBe(false)
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('avec un catalogue, la confirmation reste bloquée tant qu’aucun motif n’est choisi', async () => {
    const w = mountDialog({ reasonOptions: OPTIONS })
    expect(w.find('[data-test="reason-choice"]').exists()).toBe(true)
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)

    await w.find('[data-test="reason-choice"]').setValue('DUPLICATE')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('confirme en émettant la note interne ET le motif catalogué, séparément', async () => {
    const w = mountDialog({ reasonOptions: OPTIONS, requireReason: false })
    await w.find('[data-test="reason-choice"]').setValue('SUSPECTED_FRAUD')
    await w.find('[data-test="reason"]').setValue('signalé par Awa, ticket #4821')
    await w.find('[data-test="confirm"]').trigger('click')

    expect(w.emitted('confirm')![0]).toEqual(['signalé par Awa, ticket #4821', 'SUSPECTED_FRAUD'])
  })

  it('la note interne reste facultative : on peut confirmer avec le seul motif', async () => {
    const w = mountDialog({ reasonOptions: OPTIONS })
    await w.find('[data-test="reason-choice"]').setValue('DUPLICATE')
    await w.find('[data-test="confirm"]').trigger('click')

    expect(w.emitted('confirm')![0]).toEqual(['', 'DUPLICATE'])
  })

  it('le champ libre est présenté comme interne, pour lever toute ambiguïté', () => {
    const w = mountDialog({ reasonOptions: OPTIONS })
    const note = w.find('[data-test="reason"]').element as HTMLTextAreaElement
    expect(note.placeholder.toLowerCase()).toContain('interne')
  })
})
