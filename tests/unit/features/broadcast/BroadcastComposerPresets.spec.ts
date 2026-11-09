import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
vi.mock('@/features/broadcast/services/broadcastService')
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'
import { serializeRule } from '@/features/broadcast/composables/audienceRule'
import type { AudienceField, AudiencePreset, BroadcastTarget } from '@/features/broadcast/types/index'

const FIELDS: AudienceField[] = [
  {
    key: 'kyc', family: 'STATUS', label: 'Identité',
    operators: [{ key: 'IN', label: 'parmi', valueType: 'ENUM_MULTI' }],
    values: [{ key: 'NOT_STARTED', label: 'Pas commencée' }, { key: 'VERIFIED', label: 'Vérifiée' }],
  },
  {
    key: 'language', family: 'STATUS', label: 'Langue',
    operators: [{ key: 'IN', label: 'parmi', valueType: 'ENUM_MULTI' }],
    values: [{ key: 'fr', label: 'Français' }, { key: 'en', label: 'Anglais' }],
  },
]

const PRESETS: AudiencePreset[] = [
  {
    key: 'identite_abandonnee', label: 'Identité abandonnée', description: 'Ont quitté la vérification.',
    rule: { op: 'AND', children: [{ field: 'kyc', operator: 'IN', value: ['NOT_STARTED'] }] },
    messages: {
      fr: { title: 'Ta vérification n’est pas terminée', body: 'Reprends là où tu en étais.' },
      en: { title: 'Your check isn’t finished', body: 'Pick up where you left off.' },
    },
  },
  {
    key: 'verifies', label: 'Vérifiés', description: 'Identité vérifiée.',
    rule: { op: 'AND', children: [{ field: 'kyc', operator: 'IN', value: ['VERIFIED'] }] },
    messages: { fr: { title: 'Publie ton trajet', body: 'Tu peux publier.' }, en: { title: 'Publish your trip', body: 'You can publish.' } },
  },
]

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(BroadcastComposer, {
    props: { audience: null, busy: false, previewing: false, fields: FIELDS, segments: [], presets: PRESETS, ...props },
  })
}
const find = (w: ReturnType<typeof mountComposer>, id: string) => w.find(`[data-test="${id}"]`)
const value = (w: ReturnType<typeof mountComposer>, id: string) => (find(w, id).element as HTMLInputElement).value

/** Règle du dernier aperçu demandé, sans les identifiants locaux. */
function lastPreviewRule(w: ReturnType<typeof mountComposer>) {
  const calls = w.emitted('preview') as BroadcastTarget[][] | undefined
  const target = calls?.at(-1)?.[0]
  return target?.rule ? serializeRule(target.rule) : null
}

describe('BroadcastComposer : audiences prêtes', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('masque tout le bloc tant que le back ne fournit aucune audience prête', () => {
    const w = mountComposer({ presets: [] })
    expect(find(w, 'presets').exists()).toBe(false)
    expect(find(w, 'rule-group').exists()).toBe(true)
  })

  it('liste les audiences prêtes et propose le français et l’anglais', () => {
    const w = mountComposer()
    const options = Array.from((find(w, 'preset-select').element as HTMLSelectElement).options).map((o) => o.text)
    expect(options).toEqual(['Choisir une audience prête…', 'Identité abandonnée', 'Vérifiés'])
    expect(find(w, 'preset-lang-fr').attributes('aria-pressed')).toBe('true')
    expect(find(w, 'preset-lang-en').attributes('aria-pressed')).toBe('false')
  })

  it('choisir une audience charge sa règle limitée à la langue et remplit le modèle français', async () => {
    const w = mountComposer()
    await find(w, 'preset-select').setValue('identite_abandonnee')
    await vi.advanceTimersByTimeAsync(450)
    expect(value(w, 'broadcast-title')).toBe('Ta vérification n’est pas terminée')
    expect(value(w, 'broadcast-body')).toBe('Reprends là où tu en étais.')
    expect(find(w, 'preset-description').text()).toBe('Ont quitté la vérification.')
    expect(lastPreviewRule(w)).toEqual({
      op: 'AND',
      children: [
        { field: 'kyc', operator: 'IN', value: ['NOT_STARTED'] },
        { field: 'language', operator: 'IN', value: ['fr'] },
      ],
    })
  })

  it('passer à l’anglais change le texte et la langue de l’audience', async () => {
    const w = mountComposer()
    await find(w, 'preset-select').setValue('identite_abandonnee')
    await find(w, 'preset-lang-en').trigger('click')
    await vi.advanceTimersByTimeAsync(450)
    expect(value(w, 'broadcast-title')).toBe('Your check isn’t finished')
    expect(lastPreviewRule(w)?.children).toContainEqual({ field: 'language', operator: 'IN', value: ['en'] })
    expect(find(w, 'preset-lang-en').attributes('aria-pressed')).toBe('true')
  })

  it('décocher la limite de langue retire la condition « Langue » de la règle', async () => {
    const w = mountComposer()
    await find(w, 'preset-select').setValue('verifies')
    await find(w, 'preset-limit-language').setValue(false)
    await vi.advanceTimersByTimeAsync(450)
    expect(lastPreviewRule(w)).toEqual({ op: 'AND', children: [{ field: 'kyc', operator: 'IN', value: ['VERIFIED'] }] })
  })

  it('ne remplace jamais un texte déjà saisi : le bouton le remplace à la demande', async () => {
    const w = mountComposer()
    await find(w, 'broadcast-title').setValue('Mon titre')
    await find(w, 'broadcast-body').setValue('Mon texte')
    await find(w, 'preset-select').setValue('verifies')
    expect(value(w, 'broadcast-title')).toBe('Mon titre')
    expect(value(w, 'broadcast-body')).toBe('Mon texte')
    expect(find(w, 'preset-message-kept').exists()).toBe(true)

    await find(w, 'preset-use-message').trigger('click')
    expect(value(w, 'broadcast-title')).toBe('Publie ton trajet')
    expect(value(w, 'broadcast-body')).toBe('Tu peux publier.')
    expect(find(w, 'preset-message-kept').exists()).toBe(false)
  })

  it('un texte modifié après le modèle n’est pas écrasé par un changement de langue', async () => {
    const w = mountComposer()
    await find(w, 'preset-select').setValue('verifies')
    await find(w, 'broadcast-body').setValue('Texte retouché')
    await find(w, 'preset-lang-en').trigger('click')
    expect(value(w, 'broadcast-body')).toBe('Texte retouché')
  })

  it('choisir une audience depuis un autre mode revient au constructeur', async () => {
    const w = mountComposer()
    await find(w, 'broadcast-target').setValue('USER')
    expect(find(w, 'rule-group').exists()).toBe(false)
    await find(w, 'preset-select').setValue('verifies')
    expect((find(w, 'broadcast-target').element as HTMLSelectElement).value).toBe('RULES')
    expect(find(w, 'rule-group').exists()).toBe(true)
  })

  it('oublie le choix quand l’audience disparaît de la liste', async () => {
    const w = mountComposer()
    await find(w, 'preset-select').setValue('verifies')
    expect(find(w, 'preset-description').exists()).toBe(true)
    await w.setProps({ presets: [PRESETS[0]!] })
    expect((find(w, 'preset-select').element as HTMLSelectElement).value).toBe('')
    expect(find(w, 'preset-description').exists()).toBe(false)
  })

  it('désactive les commandes pendant un envoi', () => {
    const w = mountComposer({ busy: true })
    expect((find(w, 'preset-select').element as HTMLSelectElement).disabled).toBe(true)
    expect((find(w, 'preset-lang-fr').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('le bouton du modèle est inactif si la langue choisie n’a pas de modèle', async () => {
    const w = mountComposer({ presets: [{ ...PRESETS[1]!, messages: { fr: PRESETS[1]!.messages.fr! } }] })
    await find(w, 'preset-select').setValue('verifies')
    await find(w, 'preset-lang-en').trigger('click')
    expect((find(w, 'preset-use-message').element as HTMLButtonElement).disabled).toBe(true)
  })
})
