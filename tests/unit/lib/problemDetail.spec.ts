import { describe, it, expect } from 'vitest'
import { extractProblemMessage } from '@/lib/problemDetail'

describe('extractProblemMessage', () => {
  it('préfère le champ detail du ProblemDetail RFC 7807', () => {
    const err = { data: { detail: 'Impossible — cet utilisateur a des transactions en cours' } }
    expect(extractProblemMessage(err, 'secours')).toBe('Impossible — cet utilisateur a des transactions en cours')
  })

  it('ignore un detail vide ou blanc et retombe sur error.message', () => {
    const err = Object.assign(new Error('Network error'), { data: { detail: '   ' } })
    expect(extractProblemMessage(err, 'secours')).toBe('Network error')
  })

  it('retombe sur le message de secours quand ni detail ni message ne sont exploitables', () => {
    expect(extractProblemMessage({}, 'secours')).toBe('secours')
    expect(extractProblemMessage(undefined, 'secours')).toBe('secours')
  })
})
