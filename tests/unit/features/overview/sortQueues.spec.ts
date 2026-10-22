import { describe, it, expect } from 'vitest'
import { pendingTotal, sortQueues } from '@/features/overview/lib/sortQueues'
import type { QueueCard } from '@/features/overview/composables/useOverview'

const q = (id: string, count: number, tone: QueueCard['tone']): QueueCard => ({ id, label: id, count, tone, href: `/${id}` })

describe('sortQueues', () => {
  it('met le travail en attente d’abord : les plus graves, puis les plus remplies', () => {
    const out = sortQueues([q('info', 9, 'info'), q('warn', 1, 'warning'), q('danger-few', 1, 'danger'), q('danger-many', 5, 'danger')])
    expect(out.map(c => c.id)).toEqual(['danger-many', 'danger-few', 'warn', 'info'])
  })

  it('range les files vides à la fin, dans leur ordre d’origine', () => {
    const out = sortQueues([q('a', 0, 'danger'), q('b', 2, 'neutral'), q('c', 0, 'warning')])
    expect(out.map(c => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const input = [q('a', 0, 'danger'), q('b', 2, 'neutral')]
    sortQueues(input)
    expect(input.map(c => c.id)).toEqual(['a', 'b'])
  })
})

describe('pendingTotal', () => {
  it('additionne les files et ignore les comptes négatifs', () => {
    expect(pendingTotal([q('a', 2, 'danger'), q('b', 3, 'info'), q('c', -4, 'neutral')])).toBe(5)
    expect(pendingTotal([])).toBe(0)
  })
})
