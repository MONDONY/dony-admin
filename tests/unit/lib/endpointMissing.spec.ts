import { describe, it, expect } from 'vitest'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { isWalletEndpointMissing } from '@/features/wallet/types/index'

describe('isEndpointMissing', () => {
  it('404 sans code métier : endpoint absent (ancien back)', () => {
    expect(isEndpointMissing({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })).toBe(true)
  })
  it('405 sans code : endpoint absent', () => {
    expect(isEndpointMissing({ status: 405 })).toBe(true)
  })
  it('lit aussi le statut de la réponse', () => {
    expect(isEndpointMissing({ response: { status: 404 } })).toBe(true)
  })
  it('404 porteur d’un code métier : vraie erreur', () => {
    expect(isEndpointMissing({ statusCode: 404, data: { code: 'package-request-not-found' } })).toBe(false)
  })
  it('autres statuts et erreurs réseau : non', () => {
    expect(isEndpointMissing({ statusCode: 500 })).toBe(false)
    expect(isEndpointMissing(new Error('réseau'))).toBe(false)
    expect(isEndpointMissing(undefined)).toBe(false)
  })
  it('le helper du portefeuille (lot 2) reste le même comportement', () => {
    expect(isWalletEndpointMissing).toBe(isEndpointMissing)
  })
})

describe('problemCode', () => {
  it('rend le slug `code` du ProblemDetail', () => {
    expect(problemCode({ data: { code: 'package-request-already-removed' } })).toBe('package-request-already-removed')
  })
  it('null sans code textuel', () => {
    expect(problemCode({ data: { code: 12 } })).toBeNull()
    expect(problemCode({ data: {} })).toBeNull()
    expect(problemCode(undefined)).toBeNull()
  })
})
