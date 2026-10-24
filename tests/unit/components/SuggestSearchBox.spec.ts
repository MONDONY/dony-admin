import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SuggestSearchBox from '@/components/ui/SuggestSearchBox.vue'

const groups = [
  { key: 'sender', label: 'Expéditeurs', items: [{ key: '0', title: 'Jean Dupont', count: 3 }] },
  { key: 'traveler', label: 'Voyageurs', items: [{ key: '0', title: 'Awa Diop', count: 2 }, { key: '1', title: 'Awa Sy' }] },
  { key: 'parcel', label: 'N° de suivi', items: [{ key: '0', title: 'YD-42', sub: 'Séquestre', mono: true }] },
]

function mountBox(props = {}) {
  return mount(SuggestSearchBox, {
    props: { modelQuery: '', groups: [], placeholder: 'Chercher…', ariaLabel: 'Rechercher', testPrefix: 'pay', disabled: false, ...props },
    attachTo: document.body,
  })
}
const input = (w: ReturnType<typeof mountBox>) => w.find('[data-test="pay-search"]')

describe('SuggestSearchBox', () => {
  it('émet « type » à chaque frappe et expose le rôle combobox', async () => {
    const w = mountBox()
    expect(input(w).attributes('role')).toBe('combobox')
    expect(input(w).attributes('aria-label')).toBe('Rechercher')
    expect(input(w).attributes('placeholder')).toBe('Chercher…')
    await input(w).setValue('Je')
    expect(w.emitted('type')![0]).toEqual(['Je'])
  })

  it('liste fermée sous 2 caractères, même avec des groupes', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('a')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
    expect(input(w).attributes('aria-expanded')).toBe('false')
    await input(w).setValue('aw')
    expect(w.find('[role="listbox"]').exists()).toBe(true)
    expect(input(w).attributes('aria-expanded')).toBe('true')
  })

  it('liste groupée : libellés, titres, sous-titres, nombres, police mono', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('aw')
    expect(w.findAll('[role="option"]')).toHaveLength(4)
    for (const g of ['Expéditeurs', 'Voyageurs', 'N° de suivi']) expect(w.find('[role="listbox"]').text()).toContain(g)
    expect(w.find('[data-test="pay-suggestion-sender-0"]').text()).toContain('Jean Dupont')
    expect(w.find('[data-test="pay-suggestion-sender-0"]').text()).toContain('3')
    expect(w.find('[data-test="pay-suggestion-traveler-1"]').text()).not.toMatch(/\d/)
    expect(w.find('[data-test="pay-suggestion-parcel-0"]').text()).toContain('Séquestre')
    expect(w.find('[data-test="pay-suggestion-parcel-0"] .font-mono').exists()).toBe(true)
  })

  it('groupe sans élément ignoré ; disabled ne montre pas la liste', async () => {
    const w = mountBox({ groups: [{ key: 'a', label: 'Vide', items: [] }, ...groups] })
    await input(w).setValue('aw')
    expect(w.find('[role="listbox"]').text()).not.toContain('Vide')
    await w.setProps({ disabled: true })
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('↓ ↓ Entrée émet pick(groupe, élément) et ferme la liste', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('aw')
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    expect(input(w).attributes('aria-activedescendant')).toBe(w.findAll('[role="option"]')[1]!.attributes('id'))
    expect(w.findAll('[role="option"]')[1]!.attributes('aria-selected')).toBe('true')
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')![0]).toEqual(['traveler', '0'])
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('les flèches bouclent dans les deux sens', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('aw')
    await input(w).trigger('keydown', { key: 'ArrowUp' })
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')![0]).toEqual(['parcel', '0'])
    await input(w).setValue('aw2')
    for (let i = 0; i < 5; i++) await input(w).trigger('keydown', { key: 'ArrowDown' })
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')![1]).toEqual(['sender', '0'])
  })

  it('Entrée sans option active soumet la requête nettoyée', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('  YD-42 ')
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:query')![0]).toEqual(['YD-42'])
    expect(w.emitted('pick')).toBeUndefined()
  })

  it('le bouton « Chercher » soumet', async () => {
    const w = mountBox()
    await input(w).setValue('Awa')
    await w.find('[data-test="pay-search-submit"]').trigger('click')
    expect(w.emitted('update:query')![0]).toEqual(['Awa'])
  })

  it('Échap ferme la liste sans vider le champ', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('aw')
    const ev = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    input(w).element.dispatchEvent(ev)
    await w.vm.$nextTick()
    expect(ev.defaultPrevented).toBe(true)
    expect(w.find('[role="listbox"]').exists()).toBe(false)
    expect((input(w).element as HTMLInputElement).value).toBe('aw')
  })

  it('clic sur une option : pick ; mousedown.prevent garde le focus', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('aw')
    const opt = w.find('[data-test="pay-suggestion-traveler-1"]')
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    opt.element.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    await opt.trigger('click')
    expect(w.emitted('pick')![0]).toEqual(['traveler', '1'])
  })

  it('clic extérieur ferme la liste', async () => {
    const w = mountBox({ groups })
    await input(w).setValue('aw')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('resetKey remet le champ sur modelQuery', async () => {
    const w = mountBox({ modelQuery: 'abc', resetKey: 0 })
    await input(w).setValue('zzz')
    await w.setProps({ resetKey: 1 })
    expect((input(w).element as HTMLInputElement).value).toBe('abc')
  })
})
