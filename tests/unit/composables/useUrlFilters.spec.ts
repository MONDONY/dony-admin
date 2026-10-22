import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive } from 'vue'

const replace = vi.fn()
let query: Record<string, unknown> = {}
vi.stubGlobal('useRoute', () => ({ query }))
vi.stubGlobal('useRouter', () => ({ replace }))

import { useUrlFilters } from '@/composables/useUrlFilters'

const specs = {
  status: { default: 'TOUS', allowed: ['TOUS', 'ESCROW'] },
  query: { default: '' },
} as const

describe('useUrlFilters', () => {
  beforeEach(() => { replace.mockClear(); query = {} })

  it('restore copie l’URL dans les filtres et dit s’il y avait quelque chose', () => {
    query = { status: 'ESCROW', query: 'abc' }
    const filters = reactive({ status: 'TOUS', query: '' })
    const { restore } = useUrlFilters(filters, specs)
    expect(restore()).toBe(true)
    expect(filters).toEqual({ status: 'ESCROW', query: 'abc' })
  })

  it('restore ne touche à rien (et renvoie false) sans paramètre exploitable', () => {
    query = { status: 'PIRATE' }
    const filters = reactive({ status: 'TOUS', query: '' })
    expect(useUrlFilters(filters, specs).restore()).toBe(false)
    expect(filters.status).toBe('TOUS')
  })

  it('réécrit la query à chaque changement de filtre, sans empiler l’historique', async () => {
    query = { tab: 'wallets' }
    const filters = reactive({ status: 'TOUS', query: '' })
    useUrlFilters(filters, specs)
    filters.status = 'ESCROW'
    await nextTick()
    expect(replace).toHaveBeenCalledWith({ query: { tab: 'wallets', status: 'ESCROW' } })
  })

  it('n’appelle pas replace quand la query est déjà à jour', async () => {
    query = { status: 'ESCROW' }
    const filters = reactive({ status: 'TOUS', query: '' })
    const { restore } = useUrlFilters(filters, specs)
    restore()
    await nextTick()
    expect(replace).not.toHaveBeenCalled()
  })

  it('retire le paramètre quand le filtre revient à son défaut', async () => {
    query = { status: 'ESCROW' }
    const filters = reactive({ status: 'ESCROW', query: '' })
    useUrlFilters(filters, specs)
    filters.status = 'TOUS'
    await nextTick()
    expect(replace).toHaveBeenCalledWith({ query: {} })
  })
})
