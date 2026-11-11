import { ref } from 'vue'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import type { Dac7StatementsResult } from '@/features/dac7/types/index'

/** Envoi des récapitulatifs : un geste de l'admin, jamais automatique, une fois par voyageur et par année. */
export function useDac7Statements() {
  const busy = ref(false)
  const result = ref<Dac7StatementsResult | null>(null)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  function reset() { result.value = null; error.value = null }

  async function send(year: number) {
    reset()
    busy.value = true
    try {
      result.value = (await dac7Service.sendStatements(year)) ?? {}
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Les récapitulatifs n’ont pas pu être envoyés')
    } finally {
      busy.value = false
    }
  }

  return { busy, result, error, unavailable, reset, send }
}
