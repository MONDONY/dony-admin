import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { matchPages, SEARCH_PAGES } from '@/features/search/lib/searchPages'
import { maskPhone, normalizeSearch } from '@/features/search/lib/normalize'
import type { AdminPermission } from '@/stores/auth'

const all = () => true
const only = (...perms: AdminPermission[]) => (p: AdminPermission) => perms.includes(p)

describe('matchPages', () => {
  it('saisie vide : les premières pages permises', () => {
    expect(matchPages('', all)).toHaveLength(6)
    expect(matchPages('', only('USER_VIEW')).map(p => p.key)).toEqual(['users'])
  })

  it('ignore les accents et la casse, préfère le début du libellé', () => {
    expect(matchPages('verif', all)[0].key).toBe('kyc')
    expect(matchPages('REMBOURSEMENT', all)[0].key).toBe('wallet-refunds')
    expect(matchPages('litiges', all).map(p => p.key)).toEqual(expect.arrayContaining(['chargebacks', 'disputes']))
  })

  it('trouve par mot-clé ou rubrique, et respecte les permissions', () => {
    expect(matchPages('kyc', all).map(p => p.key)).toContain('kyc')
    expect(matchPages('transactions', all).length).toBeGreaterThan(1)
    expect(matchPages('kyc', only('USER_VIEW'))).toEqual([])
    expect(matchPages('zzzz', all)).toEqual([])
  })

  it('trouve l’Assistant IA, seulement avec ASSISTANT_MANAGE', () => {
    expect(matchPages('assistant', all).map(p => p.key)).toContain('assistant')
    expect(matchPages('groq', all).map(p => p.key)).toContain('assistant')
    expect(matchPages('assistant', only('USER_VIEW')).map(p => p.key)).not.toContain('assistant')
    expect(matchPages('assistant', only('ASSISTANT_MANAGE')).map(p => p.key)).toEqual(['assistant'])
  })

  it('chaque entrée du menu latéral a sa page de recherche, avec la même permission', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'app/components/layout/AppSidebar.vue'), 'utf8')
    const entries = [...sidebar.matchAll(/<NavItem v-if="can\('(\w+)'\)"\s+to="([^"]+)"/g)].map(m => ({ permission: m[1], path: m[2] }))
    expect(entries.length).toBeGreaterThan(15)
    for (const e of entries) {
      const found = SEARCH_PAGES.some((p) => {
        const path = typeof p.to === 'string' ? p.to : (p.to as { path?: string }).path
        return path === e.path && p.permission === e.permission
      })
      expect(found, `${e.path} (${e.permission}) absent de la recherche ⌘K`).toBe(true)
    }
  })

  it('chaque page a une route et une permission', () => {
    for (const p of SEARCH_PAGES) {
      expect(p.to).toBeTruthy()
      expect(p.permission).toBeTruthy()
    }
  })
})

describe('normalize', () => {
  it('normalizeSearch retire accents et espaces', () => {
    expect(normalizeSearch('  Vérifications ')).toBe('verifications')
  })
  it('maskPhone garde les 4 derniers chiffres', () => {
    expect(maskPhone('+33 6 12 34 56 78')).toBe('•• •• 5678')
    expect(maskPhone('12')).toBeNull()
    expect(maskPhone(null)).toBeNull()
  })
})
