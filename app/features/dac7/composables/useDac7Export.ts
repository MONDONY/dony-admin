import { ref } from 'vue'
import { downloadBlob } from '@/lib/downloadBlob'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessageAsync, readProblemBody } from '@/lib/problemDetail'
import { gestureError } from '@/features/dac7/lib/errors'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import { dac7CodeMessage } from '@/features/dac7/types/index'
import type { Dac7ExportMode, Dac7ExportOptions } from '@/features/dac7/types/index'

/** Ce que l'écran garde du dernier fichier généré : jamais son contenu, seulement ses métadonnées. */
export interface Dac7ExportSummary {
  filename: string
  /** Vrai quand le serveur n'a pas donné de nom : le fichier porte un nom de repli, sans extension. */
  filenameFallback: boolean
  year: number
  mode: Dac7ExportMode
  excluded: number | null
  /** Identifiant du fichier généré (`X-Dac7-Run-Id`) ; null si le serveur ne l'a pas donné. */
  runId: string | null
  /** Marqué comme déposé sur Télé-TD (voyageurs écartés des prochains exports partiels). */
  deposited: boolean
  /** Remboursements à réconcilier + anomalies à vérifier avant de déposer ; null si inconnu. */
  warnings: number | null
  encrypted: boolean | null
}

/**
 * Code métier d'un corps d'erreur : `code`, ou `type` quand il n'est pas le `about:blank` par
 * défaut de Spring. Sans l'un ni l'autre, l'erreur n'est pas une réponse métier du back.
 */
function businessCode(e: unknown, body: Record<string, unknown> | null): string | null {
  if (typeof body?.code === 'string' && body.code.trim()) return body.code
  if (typeof body?.type === 'string' && body.type.trim() && body.type !== 'about:blank') return body.type
  return problemCode(e)
}

/**
 * Export du fichier DAC7 et CSV de contrôle. Le fichier part directement au téléchargement du
 * navigateur : l'application ne l'envoie nulle part, le dépôt à la DGFiP reste un geste humain.
 *
 * Le corps d'une erreur arrive en Blob (`responseType: 'blob'`) : on le lit AVANT de conclure à
 * un ancien back, car un 404 ou 405 qui porte un code métier est une vraie réponse du serveur.
 */
export function useDac7Export() {
  const busy = ref(false)
  const csvBusy = ref(false)
  const result = ref<Dac7ExportSummary | null>(null)
  const blockers = ref<string[] | null>(null)
  /** Mode demandé quand l'export a été refusé : le texte du refus en dépend. */
  const blockedMode = ref<Dac7ExportMode | null>(null)
  /** Voyageurs en cause d'un refus (identifiants seulement : l'écran résout les noms). */
  const travelerIds = ref<string[]>([])
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const depositBusy = ref(false)
  const depositError = ref<string | null>(null)

  /** Efface les échecs de l'essai précédent (le résultat du dernier fichier reste, voir `clearResult`). */
  function resetFailures() {
    blockers.value = null
    blockedMode.value = null
    travelerIds.value = []
    depositError.value = null
    error.value = null
    unavailable.value = false
  }
  function clearResult() { result.value = null }

  /** Marque le dernier fichier comme déposé. Rend true au succès (idempotent côté serveur). */
  async function markDeposited(): Promise<boolean> {
    const runId = result.value?.runId
    if (!runId) return false
    depositError.value = null
    depositBusy.value = true
    try {
      await dac7Service.markDeposited(runId)
      if (result.value?.runId === runId) result.value = { ...result.value, deposited: true }
      return true
    } catch (e) {
      depositError.value = gestureError(e, 'Le fichier n’a pas pu être marqué comme déposé', 'deposit')
      return false
    } finally {
      depositBusy.value = false
    }
  }

  async function failure(e: unknown, fallback: string, mode: Dac7ExportMode | null) {
    const body = await readProblemBody(e)
    const code = businessCode(e, body)
    if (!code && isEndpointMissing(e)) { unavailable.value = true; return }
    if (mode && code === 'dac7-export-blocked') {
      const list = body?.blockers
      blockers.value = Array.isArray(list) ? list.filter((b): b is string => typeof b === 'string') : []
      blockedMode.value = mode
      const ids = body?.travelerIds
      travelerIds.value = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : []
      return
    }
    error.value = dac7CodeMessage(code) ?? await extractProblemMessageAsync(e, fallback)
  }

  async function run(year: number, mode: Dac7ExportMode, options: Dac7ExportOptions = {}) {
    resetFailures()
    busy.value = true
    try {
      const file = await dac7Service.exportFile(year, mode, options)
      downloadBlob(file.blob, file.filename)
      result.value = {
        filename: file.filename, filenameFallback: file.filenameFallback, year, mode,
        excluded: file.excluded, warnings: file.warnings, encrypted: file.encrypted,
        runId: file.runId, deposited: false,
      }
    } catch (e) {
      await failure(e, 'Le fichier n’a pas pu être généré', mode)
    } finally {
      busy.value = false
    }
  }

  async function runControl(year: number) {
    resetFailures()
    csvBusy.value = true
    try {
      const file = await dac7Service.controlCsv(year)
      downloadBlob(file.blob, file.filename)
    } catch (e) {
      await failure(e, 'Le CSV de contrôle n’a pas pu être généré', null)
    } finally {
      csvBusy.value = false
    }
  }

  return { busy, csvBusy, result, blockers, blockedMode, travelerIds, error, unavailable, resetFailures, clearResult, run, runControl, depositBusy, depositError, markDeposited }
}
