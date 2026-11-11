import { describe, it, expect } from 'vitest'
import { extractProblemMessage, extractProblemMessageAsync, readProblemBody } from '@/lib/problemDetail'

describe('extractProblemMessage', () => {
  it('préfère le champ detail du ProblemDetail RFC 7807', () => {
    const err = { data: { detail: 'Impossible — cet utilisateur a des transactions en cours' } }
    expect(extractProblemMessage(err, 'secours')).toBe('Impossible — cet utilisateur a des transactions en cours')
  })

  it('ignore un detail vide ou blanc et retombe sur error.message', () => {
    const err = Object.assign(new Error('Network error'), { data: { detail: '   ' } })
    expect(extractProblemMessage(err, 'secours')).toBe('Network error')
  })

  it('un message technique d’ofetch cède la place au texte de repli en français', () => {
    const err = Object.assign(new Error('[POST] "https://x/admin/dac7/exports": 500 Internal Server Error'), { data: {} })
    expect(extractProblemMessage(err, 'Le fichier n’a pas pu être généré')).toBe('Le fichier n’a pas pu être généré')
  })

  it('retombe sur le message de secours quand ni detail ni message ne sont exploitables', () => {
    expect(extractProblemMessage({}, 'secours')).toBe('secours')
    expect(extractProblemMessage(undefined, 'secours')).toBe('secours')
  })
})

/**
 * Une requête en `responseType: 'blob'` (exports CSV) reçoit aussi son corps d'erreur en
 * Blob : `data.detail` n'existe pas tant que le Blob n'est pas lu comme du JSON.
 */
describe('extractProblemMessageAsync', () => {
  const blob = (body: string, type = 'application/problem+json') => new Blob([body], { type })

  it('lit le detail d’un ProblemDetail reçu en Blob', async () => {
    const err = Object.assign(new Error('400 Bad Request'), { data: blob(JSON.stringify({ detail: 'Période trop longue' })) })
    expect(await extractProblemMessageAsync(err, 'secours')).toBe('Période trop longue')
  })

  it('retombe sur error.message si le Blob n’est pas du JSON', async () => {
    const err = Object.assign(new Error('502 Bad Gateway'), { data: blob('<html>', 'text/html') })
    expect(await extractProblemMessageAsync(err, 'secours')).toBe('502 Bad Gateway')
  })

  it('retombe sur error.message si le JSON n’a pas de detail', async () => {
    const err = Object.assign(new Error('500'), { data: blob('{"title":"x"}') })
    expect(await extractProblemMessageAsync(err, 'secours')).toBe('500')
  })

  it('se comporte comme la version synchrone hors Blob', async () => {
    expect(await extractProblemMessageAsync({ data: { detail: 'lisible' } }, 'secours')).toBe('lisible')
    expect(await extractProblemMessageAsync(undefined, 'secours')).toBe('secours')
  })
})

describe('readProblemBody', () => {
  it('lit le corps JSON d’une erreur reçue en Blob', async () => {
    const err = { data: new Blob([JSON.stringify({ code: 'dac7-export-blocked', blockers: ['NO_SELLERS'] })]) }
    expect(await readProblemBody(err)).toEqual({ code: 'dac7-export-blocked', blockers: ['NO_SELLERS'] })
  })
  it('rend l’objet déjà analysé tel quel', async () => {
    expect(await readProblemBody({ data: { code: 'x' } })).toEqual({ code: 'x' })
  })
  it('corps illisible, absent ou non objet : null', async () => {
    expect(await readProblemBody({ data: new Blob(['pas du json']) })).toBeNull()
    expect(await readProblemBody({ data: new Blob(['"texte"']) })).toBeNull()
    expect(await readProblemBody({})).toBeNull()
    expect(await readProblemBody(undefined)).toBeNull()
  })
})
