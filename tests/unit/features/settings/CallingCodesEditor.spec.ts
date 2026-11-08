import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CallingCodesEditor from '@/features/settings/components/CallingCodesEditor.vue'
import { AFRICA_DEFAULT_CALLING_CODES } from '@/features/settings/lib/callingCodes'

function mountEditor(modelValue: string, disabled = false) {
  return mount(CallingCodesEditor, {
    props: { modelValue, settingKey: 'sms_blocked_country_codes', disabled },
  })
}
function lastEmitted(w: ReturnType<typeof mountEditor>) {
  const events = w.emitted('update:modelValue')
  return events?.[events.length - 1]?.[0]
}

describe('CallingCodesEditor', () => {
  it('affiche une puce par indicatif avec le nom du pays, et « +xxx » si inconnu', () => {
    const w = mountEditor('225,221,999')
    expect(w.find('[data-test="calling-code-chip-225"]').text()).toBe('+225 Côte d’Ivoire')
    expect(w.find('[data-test="calling-code-chip-221"]').text()).toBe('+221 Sénégal')
    expect(w.find('[data-test="calling-code-chip-999"]').text()).toBe('+999')
    expect(w.find('[data-test="calling-code-remove-225"]').attributes('aria-label')).toBe('Retirer +225 Côte d’Ivoire')
  })

  it('liste vide : dit qu’aucun pays n’est bloqué', () => {
    const w = mountEditor('')
    expect(w.find('[data-test="calling-codes-empty"]').text()).toContain('Aucun pays bloqué')
    expect(w.findAll('li')).toHaveLength(0)
  })

  it('retirer une puce émet la chaîne sans cet indicatif', async () => {
    const w = mountEditor('225,221,33')
    await w.find('[data-test="calling-code-remove-221"]').trigger('click')
    expect(lastEmitted(w)).toBe('225,33')
  })

  it('ajouter un indicatif (avec « + » toléré) émet la chaîne normalisée et vide le champ', async () => {
    const w = mountEditor('225')
    await w.find('[data-test="calling-code-input"]').setValue('+ 33')
    expect(w.find('[data-test="calling-code-preview"]').text()).toBe('France')
    await w.find('[data-test="calling-code-add"]').trigger('click')
    expect(lastEmitted(w)).toBe('225,33')
    expect((w.find('[data-test="calling-code-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('la touche Entrée ajoute aussi', async () => {
    const w = mountEditor('')
    const input = w.find('[data-test="calling-code-input"]')
    await input.setValue('221')
    await input.trigger('keydown', { key: 'Enter' })
    expect(lastEmitted(w)).toBe('221')
  })

  it('refuse lettres, plus de 4 chiffres et doublon, sans rien émettre', async () => {
    const w = mountEditor('225')
    const input = w.find('[data-test="calling-code-input"]')
    const addBtn = () => w.find('[data-test="calling-code-add"]').element as HTMLButtonElement

    for (const bad of ['22a', '12345', '225']) {
      await input.setValue(bad)
      expect(addBtn().disabled, bad).toBe(true)
      expect(w.find('[data-test="calling-code-input-error"]').exists(), bad).toBe(true)
      await input.trigger('keydown', { key: 'Enter' })
    }
    expect(w.find('[data-test="calling-code-input-error"]').text()).toContain('déjà dans la liste')
    expect(w.emitted('update:modelValue')).toBeUndefined()

    await input.setValue('')
    expect(addBtn().disabled).toBe(true)
    expect(w.find('[data-test="calling-code-input-error"]').exists()).toBe(false)
  })

  it('remet la liste Afrique par défaut ; le bouton disparaît quand elle est déjà en place', async () => {
    const w = mountEditor('33')
    await w.find('[data-test="calling-code-reset-africa"]').trigger('click')
    expect(lastEmitted(w)).toBe(AFRICA_DEFAULT_CALLING_CODES)

    const already = mountEditor(AFRICA_DEFAULT_CALLING_CODES)
    expect(already.find('[data-test="calling-code-reset-africa"]').exists()).toBe(false)
  })

  it('désactivé (appel en cours) : ni ajout, ni retrait, ni remise à défaut', async () => {
    const w = mountEditor('225', true)
    await w.find('[data-test="calling-code-input"]').setValue('221')
    await w.find('[data-test="calling-code-input"]').trigger('keydown', { key: 'Enter' })
    await w.find('[data-test="calling-code-remove-225"]').trigger('click')
    await w.find('[data-test="calling-code-reset-africa"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect((w.find('[data-test="calling-code-add"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})
