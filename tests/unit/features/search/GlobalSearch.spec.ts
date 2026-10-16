import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const pushMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: pushMock }))
const runUsers = vi.fn()
vi.mock('@/features/search/services/globalSearchService', () => ({
  SEARCH_SOURCES: [{ group: 'users', label: 'Utilisateurs', permission: 'USER_VIEW', run: (q: string) => runUsers(q) }],
}))
import GlobalSearch from '@/features/search/components/GlobalSearch.vue'

function mountSearch() {
  return mount(GlobalSearch, { attachTo: document.body, global: { stubs: { Teleport: true } } })
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    seedAuth('ADMIN')
    pushMock.mockReset().mockResolvedValue(undefined)
    runUsers.mockReset().mockResolvedValue([{ key: 'users:u1', group: 'users', title: 'Awa Diop', subtitle: '•• •• 5678', to: { path: '/users', query: { open: 'u1' } } }])
  })
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

  it('Ctrl+K ouvre la palette, Échap la ferme', async () => {
    const w = mountSearch()
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await flushPromises()
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(true)
    await w.find('[data-test="global-search-input"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    await flushPromises()
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    await flushPromises()
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(false)
    w.unmount()
  })

  it('« / » dans un champ de saisie n’ouvre rien', async () => {
    const w = mountSearch()
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    await flushPromises()
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(false)
    w.unmount()
  })

  it('pages filtrées puis données ; Entrée ouvre l’élément actif', async () => {
    const w = mountSearch()
    await w.find('[data-test="global-search-trigger"]').trigger('click')
    const input = w.find('[data-test="global-search-input"]')
    await input.setValue('util')
    expect(w.find('[data-test="global-search-item-page:users"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(runUsers).toHaveBeenCalledWith('util')
    expect(w.find('[data-test="global-search-item-users:u1"]').text()).toContain('Awa Diop')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(w.find('[data-test="global-search-item-users:u1"]').attributes('aria-selected')).toBe('true')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(pushMock).toHaveBeenCalledWith({ path: '/users', query: { open: 'u1' } })
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(false)
    w.unmount()
  })

  it('aucun résultat : message ; clic sur une page navigue', async () => {
    runUsers.mockResolvedValue([])
    const w = mountSearch()
    await w.find('[data-test="global-search-trigger"]').trigger('click')
    await w.find('[data-test="global-search-input"]').setValue('zzzz')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(w.find('[data-test="global-search-empty"]').text()).toContain('zzzz')
    await w.find('[data-test="global-search-input"]').setValue('')
    await w.find('[data-test="global-search-item-page:overview"]').trigger('mousemove')
    await w.find('[data-test="global-search-item-page:overview"]').trigger('click')
    await flushPromises()
    expect(pushMock).toHaveBeenCalledWith('/')
    w.unmount()
  })

  it('clic sur le fond ferme la palette', async () => {
    const w = mountSearch()
    await w.find('[data-test="global-search-trigger"]').trigger('click')
    await w.find('[data-test="global-search-overlay"]').trigger('mousedown')
    expect(w.find('[data-test="global-search-overlay"]').exists()).toBe(false)
    w.unmount()
  })
})
