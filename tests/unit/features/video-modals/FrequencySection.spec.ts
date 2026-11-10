import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import FrequencySection from '@/features/video-modals/components/FrequencySection.vue'
import type { ModalFrequency } from '@/features/video-modals/types/index'

function mountSection(isInfo: boolean, over: Record<string, unknown> = {}, errors: Record<string, string> = {}) {
  const state = reactive({
    frequency: 'ONCE' as ModalFrequency, maxDisplays: 3 as number | string, frequencyDays: 7 as number | string | null, stopAfterAnswer: true, allowDontShowAgain: false,
    priority: 0 as number | string, startsAt: '', endsAt: '', ...over,
  })
  const w = mount(FrequencySection, {
    props: {
      isInfo, errors,
      frequency: state.frequency, 'onUpdate:frequency': (v: ModalFrequency) => { state.frequency = v },
      maxDisplays: state.maxDisplays, 'onUpdate:maxDisplays': (v: number | string) => { state.maxDisplays = v },
      frequencyDays: state.frequencyDays, 'onUpdate:frequencyDays': (v: number | string | null) => { state.frequencyDays = v },
      stopAfterAnswer: state.stopAfterAnswer, 'onUpdate:stopAfterAnswer': (v: boolean) => { state.stopAfterAnswer = v },
      allowDontShowAgain: state.allowDontShowAgain, 'onUpdate:allowDontShowAgain': (v: boolean) => { state.allowDontShowAgain = v },
      priority: state.priority, 'onUpdate:priority': (v: number | string) => { state.priority = v },
      startsAt: state.startsAt, 'onUpdate:startsAt': (v: string) => { state.startsAt = v },
      endsAt: state.endsAt, 'onUpdate:endsAt': (v: string) => { state.endsAt = v },
    },
  })
  return { w, state }
}

describe('FrequencySection', () => {
  it('information : les quatre fréquences ; vidéo : « une fois » et « jusqu’à N fois »', () => {
    const info = mountSection(true).w
    for (const f of ['ONCE', 'UP_TO_N', 'EVERY_OPEN', 'EVERY_N_DAYS']) expect(info.find(`[data-test="vm-frequency-${f}"]`).exists(), f).toBe(true)
    const video = mountSection(false).w
    expect(video.find('[data-test="vm-frequency-ONCE"]').exists()).toBe(true)
    expect(video.find('[data-test="vm-frequency-UP_TO_N"]').exists()).toBe(true)
    expect(video.find('[data-test="vm-frequency-EVERY_OPEN"]').exists()).toBe(false)
    expect(video.find('[data-test="vm-frequency-EVERY_N_DAYS"]').exists()).toBe(false)
  })

  it('une vidéo déjà réglée sur une fréquence « information » la garde visible', () => {
    const { w } = mountSection(false, { frequency: 'EVERY_OPEN' })
    expect(w.find('[data-test="vm-frequency-EVERY_OPEN"]').exists()).toBe(true)
    expect(w.find('[data-test="vm-frequency-EVERY_N_DAYS"]').exists()).toBe(false)
  })

  it('choisir une option change la fréquence', async () => {
    const { w, state } = mountSection(true)
    await w.get('[data-test="vm-frequency-EVERY_OPEN"] input[type="radio"]').setValue(true)
    expect(state.frequency).toBe('EVERY_OPEN')
    await w.setProps({ frequency: 'EVERY_OPEN' })
    expect(w.get('[data-test="vm-frequency-ONCE"]').classes()).toContain('border-border')
    expect(w.get('[data-test="vm-frequency-EVERY_OPEN"]').classes()).toContain('border-primary')
  })

  it('taper ou cibler le N d’une option la sélectionne', async () => {
    const { w, state } = mountSection(true)
    await w.get('[data-test="vm-max"]').setValue('5')
    expect(state.frequency).toBe('UP_TO_N')
    expect(state.maxDisplays).toBe(5)
    state.frequency = 'ONCE'
    await w.get('[data-test="vm-frequency-days"]').setValue('14')
    expect(state.frequency).toBe('EVERY_N_DAYS')
    expect(state.frequencyDays).toBe(14)
    state.frequency = 'ONCE'
    await w.get('[data-test="vm-max"]').trigger('focus')
    expect(state.frequency).toBe('UP_TO_N')
    await w.get('[data-test="vm-frequency-days"]').trigger('focus')
    expect(state.frequency).toBe('EVERY_N_DAYS')
  })

  it('interrupteurs : arrêt après un bouton touché, case « Ne plus afficher » (avec sa note)', async () => {
    const { w, state } = mountSection(true)
    expect(w.find('[data-test="vm-dont-show-note"]').exists()).toBe(false)
    await w.get('[data-test="vm-stop-after-answer"]').trigger('click')
    expect(state.stopAfterAnswer).toBe(false)
    await w.get('[data-test="vm-dont-show-again"]').trigger('click')
    expect(state.allowDontShowAgain).toBe(true)
    await w.setProps({ allowDontShowAgain: true })
    expect(w.get('[data-test="vm-dont-show-note"]').text()).toContain('réponse définitive')
  })

  it('priorité, période, plafond global affiché', async () => {
    const { w, state } = mountSection(true)
    await w.get('[data-test="vm-priority"]').setValue('5')
    expect(state.priority).toBe(5)
    await w.get('[data-test="vm-starts"]').setValue('2026-11-10T10:00')
    await w.get('[data-test="vm-ends"]').setValue('2026-11-30T10:00')
    expect(state.startsAt).toBe('2026-11-10T10:00')
    expect(state.endsAt).toBe('2026-11-30T10:00')
    expect(w.text()).toContain('1 modal par jour')
    expect(w.text()).toContain('Plus le chiffre est haut')
    expect(w.text()).toContain('dates de début et de fin sont conseillées')
    expect(mountSection(false).w.text()).not.toContain('conseillées')
  })

  it('erreurs affichées', () => {
    const { w } = mountSection(true, {}, {
      frequency: 'F', frequencyDays: 'Nombre de jours', maxDisplays: 'Entre 1 et 10', priority: 'Priorité : nombre entier.', period: 'La fin doit être après le début.',
    })
    const t = w.text()
    for (const m of ['F', 'Nombre de jours', 'Entre 1 et 10', 'Priorité : nombre entier.', 'La fin doit être après le début.']) expect(t).toContain(m)
    expect(w.find('[data-test="vm-max-error"]').exists()).toBe(true)
    expect(w.find('[data-test="vm-frequency-days-error"]').exists()).toBe(true)
    expect(w.find('[data-test="vm-priority-error"]').exists()).toBe(true)
  })

  it('libellés de la fréquence courts et sur une ligne', () => {
    const { w } = mountSection(true)
    expect(w.get('[data-test="vm-stop-after-answer"]').attributes('aria-label')).toBe('Ne plus afficher après un bouton touché')
    expect(w.get('[data-test="vm-dont-show-again"]').attributes('aria-label')).toBe('Case « Ne plus afficher »')
  })
})
