import { describe, it, expect, beforeEach } from 'vitest'
import { useBreadcrumbLabel } from '@/composables/useBreadcrumbLabel'

describe('useBreadcrumbLabel', () => {
  beforeEach(() => useBreadcrumbLabel().clear())

  it('partage un seul libellé entre la page et le layout', () => {
    useBreadcrumbLabel().set('Awa Diallo')
    expect(useBreadcrumbLabel().label.value).toBe('Awa Diallo')
  })
  it('rogne les espaces, et un libellé vide efface', () => {
    const c = useBreadcrumbLabel()
    c.set('  Awa  ')
    expect(c.label.value).toBe('Awa')
    c.set('   ')
    expect(c.label.value).toBeNull()
    c.set(undefined)
    expect(c.label.value).toBeNull()
  })
  it('clear remet à zéro', () => {
    const c = useBreadcrumbLabel()
    c.set('x'); c.clear()
    expect(c.label.value).toBeNull()
  })
})
