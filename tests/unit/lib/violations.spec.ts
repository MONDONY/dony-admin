import { describe, it, expect } from 'vitest'
import { violationsByField, httpStatus } from '@/lib/violations'

describe('violationsByField', () => {
  it('lit l’objet champ → message', () => {
    expect(violationsByField({ data: { violations: { apiKey: ' trop court ', x: 3 } } })).toEqual({ apiKey: 'trop court' })
  })
  it('ignore un tableau ou une absence', () => {
    expect(violationsByField({ data: { violations: ['a'] } })).toEqual({})
    expect(violationsByField(undefined)).toEqual({})
  })
  it('httpStatus lit statusCode, status ou response.status', () => {
    expect(httpStatus({ statusCode: 422 })).toBe(422)
    expect(httpStatus({ status: 404 })).toBe(404)
    expect(httpStatus({ response: { status: 500 } })).toBe(500)
    expect(httpStatus({})).toBeUndefined()
  })
})
