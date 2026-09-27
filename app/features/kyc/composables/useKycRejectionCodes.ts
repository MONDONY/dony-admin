import { ref } from 'vue'
import { kycService } from '@/features/kyc/services/kycService'
import { KYC_DECISION_CODES, kycDecisionCode } from '@/features/kyc/types/index'
import type { KycDecisionCode } from '@/features/kyc/types/index'

type Source = 'server' | 'local'

/** Slugs du back vers le catalogue affiché : libellé français connu, sinon le code brut. */
export function toDecisionCodes(values: readonly unknown[]): KycDecisionCode[] {
  return values.filter((v): v is string => typeof v === 'string').map(kycDecisionCode)
}

// Le catalogue change au rythme des déploiements back : un appel par session d'onglet suffit,
// partagé par toutes les fiches ouvertes.
let pending: Promise<{ codes: KycDecisionCode[]; source: Source }> | null = null

/** Pour les tests : oublie le catalogue chargé. */
export function resetKycRejectionCodesCache() { pending = null }

async function fetchCatalogue(): Promise<{ codes: KycDecisionCode[]; source: Source }> {
  try {
    const codes = toDecisionCodes(await kycService.listRejectionCodes())
    if (codes.length) return { codes, source: 'server' }
  } catch {
    // Ancien back (404/405) ou panne : la liste locale, miroir du back, permet de décider quand
    // même ; un code refusé reviendra en 400 avec `allowedCodes`.
  }
  return { codes: [...KYC_DECISION_CODES], source: 'local' }
}

/**
 * Catalogue des codes de refus et de révocation, servi par GET /admin/kyc/rejection-codes,
 * avec repli sur la liste locale.
 */
export function useKycRejectionCodes() {
  const codes = ref<KycDecisionCode[]>([...KYC_DECISION_CODES])
  const source = ref<Source>('local')

  async function load() {
    pending ??= fetchCatalogue()
    const res = await pending
    codes.value = res.codes
    source.value = res.source
  }

  return { codes, source, load }
}
