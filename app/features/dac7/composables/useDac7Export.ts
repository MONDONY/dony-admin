import { ref } from 'vue'
import { downloadBlob } from '@/lib/downloadBlob'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessageAsync, readProblemBody } from '@/lib/problemDetail'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import { dac7CodeMessage } from '@/features/dac7/types/index'
import type { Dac7ExportMode } from '@/features/dac7/types/index'

/** Ce que l'écran garde du dernier fichier généré : jamais son contenu, seulement ses métadonnées. */
export interface Dac7ExportSummary {
  filename: string
  mode: Dac7ExportMode
  excluded: number | null
  encrypted: boolean | null
}

/**
 * Export du fichier DAC7 et CSV de contrôle. Le fichier part directement au téléchargement du
 * navigateur : l'application ne l'envoie nulle part, le dépôt à la DGFiP reste un geste humain.
 */
export function useDac7Export() {
  const busy = ref(false)
  const csvBusy = ref(false)
  const result = ref<Dac7ExportSummary | null>(null)
  const blockers = ref<string[] | null>(null)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  function reset() {
    result.value = null
    blockers.value = null
    error.value = null
  }

  async function failure(e: unknown, fallback: string) {
    if (isEndpointMissing(e)) { unavailable.value = true; return }
    const body = await readProblemBody(e)
    if (problemCode(e ?? undefined) === 'dac7-export-blocked' || body?.code === 'dac7-export-blocked') {
      const list = body?.blockers
      blockers.value = Array.isArray(list) ? list.filter((b): b is string => typeof b === 'string') : []
      return
    }
    error.value = dac7CodeMessage(typeof body?.code === 'string' ? body.code : null) ?? await extractProblemMessageAsync(e, fallback)
  }

  async function run(year: number, mode: Dac7ExportMode) {
    reset()
    busy.value = true
    try {
      const file = await dac7Service.exportFile(year, mode)
      downloadBlob(file.blob, file.filename)
      result.value = { filename: file.filename, mode, excluded: file.excluded, encrypted: file.encrypted }
      unavailable.value = false
    } catch (e) {
      await failure(e, 'Le fichier n’a pas pu être généré')
    } finally {
      busy.value = false
    }
  }

  async function runControl(year: number) {
    reset()
    csvBusy.value = true
    try {
      const file = await dac7Service.controlCsv(year)
      downloadBlob(file.blob, file.filename)
      unavailable.value = false
    } catch (e) {
      await failure(e, 'Le CSV de contrôle n’a pas pu être généré')
    } finally {
      csvBusy.value = false
    }
  }

  return { busy, csvBusy, result, blockers, error, unavailable, reset, run, runControl }
}
