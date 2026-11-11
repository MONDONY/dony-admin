import { useApi } from '@/composables/useApi'
import { filenameFromContentDisposition } from '@/lib/contentDisposition'
import type {
  Dac7AnomalyRow, Dac7DiligenceEntry, Dac7ExportMode, Dac7ExportOptions, Dac7FileResult, Dac7Filter, Dac7Overview,
  Dac7RefundRow, Dac7Seller, Dac7StatementsResult,
} from '@/features/dac7/types/index'

const BASE = '/admin/dac7'

/** Un tableau est attendu ; une page Spring ou un corps vide ne doivent pas faire planter l'écran. */
function asList<T>(body: T[] | { content?: T[] } | null | undefined): T[] {
  if (Array.isArray(body)) return body
  return Array.isArray(body?.content) ? body.content : []
}

function headerInt(h: Headers, name: string): number | null {
  const v = h.get(name)
  if (v === null || !/^\d+$/.test(v.trim())) return null
  return Number.parseInt(v, 10)
}

function headerBool(h: Headers, name: string): boolean | null {
  const v = h.get(name)?.trim().toLowerCase()
  return v === 'true' ? true : v === 'false' ? false : null
}

/** Déclaration DAC7 : préparation, relances, export du fichier et récapitulatifs (permission DAC7_REPORT). */
export const dac7Service = {
  overview(year: number): Promise<Dac7Overview> {
    return useApi()<Dac7Overview>(`${BASE}/overview`, { query: { year } })
  },
  async sellers(year: number, filter: Dac7Filter): Promise<Dac7Seller[]> {
    return asList(await useApi()<Dac7Seller[]>(`${BASE}/sellers`, { query: { year, filter } }))
  },
  async diligence(userId: string): Promise<Dac7DiligenceEntry[]> {
    return asList(await useApi()<Dac7DiligenceEntry[]>(`${BASE}/sellers/${encodeURIComponent(userId)}/diligence`))
  },
  remind(userId: string): Promise<void> {
    return useApi()<void>(`${BASE}/sellers/${encodeURIComponent(userId)}/remind`, { method: 'POST' })
  },
  decision(userId: string, note: string): Promise<void> {
    return useApi()<void>(`${BASE}/sellers/${encodeURIComponent(userId)}/decision`, { method: 'POST', body: { note: note.trim() } })
  },
  async refunds(year: number): Promise<Dac7RefundRow[]> {
    return asList(await useApi()<Dac7RefundRow[]>(`${BASE}/refunds`, { query: { year } }))
  },
  async anomalies(year: number): Promise<Dac7AnomalyRow[]> {
    return asList(await useApi()<Dac7AnomalyRow[]>(`${BASE}/anomalies`, { query: { year } }))
  },
  /**
   * Génère le fichier. Un refus (409 `dac7-export-blocked`) arrive en erreur, dont le corps JSON
   * (Blob) porte `blockers` : l'appelant le lit avec `readProblemBody`.
   */
  async exportFile(year: number, mode: Dac7ExportMode, options: Dac7ExportOptions = {}): Promise<Dac7FileResult> {
    // Les options ne partent que renseignées : le serveur applique sinon ses valeurs par défaut.
    const body: Record<string, unknown> = { year, mode }
    if (options.sequence && options.sequence > 0) body.sequence = options.sequence
    if (options.includeAlreadyExported) body.includeAlreadyExported = true
    const res = await useApi().raw<Blob>(`${BASE}/exports`, { method: 'POST', body, responseType: 'blob' })
    const named = filenameFromContentDisposition(res.headers.get('content-disposition'))
    return {
      blob: res._data as Blob,
      filename: named ?? `dac7-${year}-${mode === 'FULL' ? 'complet' : 'partiel'}`,
      filenameFallback: named === null,
      excluded: headerInt(res.headers, 'x-dac7-excluded'),
      warnings: headerInt(res.headers, 'x-dac7-warnings'),
      encrypted: headerBool(res.headers, 'x-dac7-encrypted'),
    }
  },
  async controlCsv(year: number): Promise<{ blob: Blob; filename: string }> {
    const res = await useApi().raw<Blob>(`${BASE}/exports/control.csv`, { query: { year }, responseType: 'blob' })
    return {
      blob: res._data as Blob,
      filename: filenameFromContentDisposition(res.headers.get('content-disposition')) ?? `dac7-controle-${year}.csv`,
    }
  },
  sendStatements(year: number): Promise<Dac7StatementsResult> {
    return useApi()<Dac7StatementsResult>(`${BASE}/statements/send`, { method: 'POST', body: { year } })
  },
}
