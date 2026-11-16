/**
 * Markdown restreint des fiches d'aide et des réponses de l'assistant, lu en blocs puis rendu par
 * HelpMarkdown sans `v-html` : rien de ce texte ne peut devenir du HTML. Seuls existent les titres
 * `##` / `###`, les paragraphes, les listes `- ` et `1. `, les encadrés `> `, le gras `**…**` et les
 * liens internes `[texte](/chemin)`. Un lien qui ne commence pas par un seul `/` reste du texte.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; to: string }

export type Block =
  | { kind: 'heading'; level: 2 | 3; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'callout'; tone: 'info' | 'warning'; inlines: Inline[] }

const LINK = /\[([^\]\n]*)\]\(([^)\s]*)\)/g
const HEADING = /^(#{2,3})\s+(.*)$/
const BULLET = /^[-*]\s+(.*)$/
const NUMBERED = /^\d{1,2}[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/

/** Chemin interne de la console : un seul `/` au début, ni schéma ni `//`. */
export function isInternalPath(to: string): boolean {
  return to.startsWith('/') && !to.startsWith('//') && !/[\s\\]/.test(to)
}

function pushText(out: Inline[], text: string) {
  const prev = out[out.length - 1]
  if (prev?.kind === 'text') prev.text += text
  else out.push({ kind: 'text', text })
}

/** Gras en paires `**…**` ; une étoile orpheline (réponse du modèle mal fermée) est retirée. */
function pushBold(out: Inline[], text: string) {
  const parts = text.split('**')
  if (parts.length % 2 === 0) {
    pushText(out, text.replaceAll('**', ''))
    return
  }
  parts.forEach((part, i) => {
    if (!part) return
    if (i % 2 === 1) out.push({ kind: 'bold', text: part })
    else pushText(out, part)
  })
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const at = m.index ?? 0
    if (at > last) pushBold(out, text.slice(last, at))
    const label = (m[1] ?? '').replaceAll('**', '')
    const to = m[2] ?? ''
    if (isInternalPath(to)) out.push({ kind: 'link', text: label || to, to })
    else pushBold(out, label)
    last = at + m[0].length
  }
  if (last < text.length) pushBold(out, text.slice(last))
  return out
}

export function parseHelpMarkdown(source: string | null | undefined): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let quote: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', inlines: parseInline(paragraph.join(' ')) })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(parseInline) })
    list = null
  }
  const flushQuote = () => {
    if (!quote.length) return
    const text = quote.join(' ').trim()
    const tone = /^\*\*Attention/i.test(text) ? 'warning' : 'info'
    blocks.push({ kind: 'callout', tone, inlines: parseInline(text) })
    quote = []
  }
  const flushAll = () => { flushParagraph(); flushList(); flushQuote() }

  for (const raw of (source ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) { flushAll(); continue }
    const quoteMatch = QUOTE.exec(line)
    if (quoteMatch) { flushParagraph(); flushList(); quote.push(quoteMatch[1] ?? ''); continue }
    flushQuote()
    const heading = HEADING.exec(line)
    if (heading) {
      flushAll()
      blocks.push({ kind: 'heading', level: heading[1] === '##' ? 2 : 3, inlines: parseInline(heading[2] ?? '') })
      continue
    }
    const numbered = NUMBERED.exec(line)
    const bullet = numbered ? null : BULLET.exec(line)
    const item = numbered ?? bullet
    if (item) {
      flushParagraph()
      const ordered = !!numbered
      if (list && list.ordered !== ordered) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push(item[1] ?? '')
      continue
    }
    // Ligne indentée sous une puce : elle la prolonge (sous-puces aplaties, une seule profondeur).
    if (list && /^\s/.test(raw)) { list.items[list.items.length - 1] += ` ${line}`; continue }
    flushList()
    paragraph.push(line)
  }
  flushAll()
  return blocks
}

/** Texte brut d'une liste d'éléments en ligne (titres de section, lecteurs d'écran). */
export function inlineText(inlines: Inline[]): string {
  return inlines.map(i => i.text).join('')
}
