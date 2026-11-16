import { describe, it, expect } from 'vitest'
import { inlineText, isInternalPath, parseHelpMarkdown, parseInline } from '@/features/help-center/lib/helpMarkdown'

describe('parseInline', () => {
  it('gras, liens internes et texte', () => {
    expect(parseInline('Ouvrez **Colis** puis [la fiche](/aide/colis).')).toEqual([
      { kind: 'text', text: 'Ouvrez ' },
      { kind: 'bold', text: 'Colis' },
      { kind: 'text', text: ' puis ' },
      { kind: 'link', text: 'la fiche', to: '/aide/colis' },
      { kind: 'text', text: '.' },
    ])
  })

  it('un lien externe ou suspect reste du texte', () => {
    expect(parseInline('[site](https://evil.com) et [x](//evil.com) et [y](javascript:alert)'))
      .toEqual([{ kind: 'text', text: 'site et x et y' }])
  })

  it('un lien sans texte prend son chemin ; le gras dans un lien est retiré', () => {
    expect(parseInline('[](/colis)')).toEqual([{ kind: 'link', text: '/colis', to: '/colis' }])
    expect(parseInline('[**Colis**](/colis)')).toEqual([{ kind: 'link', text: 'Colis', to: '/colis' }])
  })

  it('une étoile orpheline est retirée', () => {
    expect(parseInline('a **b c')).toEqual([{ kind: 'text', text: 'a b c' }])
  })

  it('le HTML reste du texte', () => {
    expect(inlineText(parseInline('<img src=x onerror=alert(1)>'))).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('parseHelpMarkdown', () => {
  it('lit titres, paragraphes, listes et encadrés', () => {
    const blocks = parseHelpMarkdown([
      '## À quoi ça sert',
      'Première ligne',
      'suite du paragraphe.',
      '',
      '### Étapes',
      '1. Ouvrez **Colis**.',
      '2. Cliquez.',
      '   (détail)',
      '- puce A',
      '* puce B',
      '> **Attention :** irréversible',
      '> suite',
      '> **Bon à savoir :** info',
    ].join('\r\n'))
    expect(blocks.map(b => b.kind)).toEqual(['heading', 'paragraph', 'heading', 'list', 'list', 'callout'])
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 })
    expect(blocks[2]).toMatchObject({ kind: 'heading', level: 3 })
    expect(inlineText((blocks[1] as { inlines: never }).inlines)).toBe('Première ligne suite du paragraphe.')
    const ordered = blocks[3] as { ordered: boolean; items: unknown[][] }
    expect(ordered.ordered).toBe(true)
    expect(ordered.items).toHaveLength(2)
    expect(inlineText(ordered.items[1] as never)).toBe('Cliquez. (détail)')
    expect(blocks[4]).toMatchObject({ kind: 'list', ordered: false })
    expect(blocks[5]).toMatchObject({ kind: 'callout', tone: 'warning' })
  })

  it('encadré informatif, liste puis paragraphe, source vide', () => {
    const blocks = parseHelpMarkdown('> **Bon à savoir :** x\nTexte\n- a\nTexte après')
    expect(blocks.map(b => b.kind)).toEqual(['callout', 'paragraph', 'list', 'paragraph'])
    expect(blocks[0]).toMatchObject({ tone: 'info' })
    expect(parseHelpMarkdown(null)).toEqual([])
    expect(parseHelpMarkdown(undefined)).toEqual([])
  })

  it('isInternalPath', () => {
    expect(isInternalPath('/colis?view=ACTIVE')).toBe(true)
    expect(isInternalPath('//x')).toBe(false)
    expect(isInternalPath('/a b')).toBe(false)
    expect(isInternalPath('http://x')).toBe(false)
  })
})
