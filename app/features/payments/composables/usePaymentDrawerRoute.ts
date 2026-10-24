import { ref, watch, type Ref } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import type { PaymentSection } from '@/lib/adminLinks'
import { sameQuery } from '@/lib/urlFilters'
import { uuidParam } from '@/lib/safeInput'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

const SECTIONS: readonly PaymentSection[] = ['incidents', 'money', 'timeline', 'references']

/** Onglet du tiroir lu dans `?section=` : connu seulement ; Résumé (l'onglet par défaut) = null. */
export function paymentDrawerSection(value: unknown): PaymentSection | null {
  return typeof value === 'string' && (SECTIONS as readonly string[]).includes(value) ? value as PaymentSection : null
}

/** Ce dont le composable a besoin de `usePaymentDetail`. */
export interface PaymentDrawerDetail {
  payment: Ref<AdminPaymentDetail | null>
  // eslint-disable-next-line no-unused-vars
  open: (id: string) => Promise<void>
  close: () => void
}

/**
 * Le tiroir paiement de la page Transactions vit dans l'URL : `?open=<paiement>` et
 * `?section=<onglet>` (Résumé = pas de paramètre), écrits avec `router.replace` à l'ouverture et à
 * chaque changement d'onglet, retirés à la fermeture. Un `?open=` reçu (chargement de la page, ou
 * query seule qui change page ouverte, y compris le même lien recliqué après une fermeture) ouvre
 * la fiche. Avec un autre `?tab=`, `open` désigne une ligne de cet onglet, pas un paiement.
 *
 * `apply` : réécriture des filtres de la page sur la query (`useUrlFilters().apply`).
 */
export function usePaymentDrawerRoute(
  detail: PaymentDrawerDetail,
  // eslint-disable-next-line no-unused-vars
  opts: { apply?: (query: Record<string, unknown>) => Record<string, unknown> } = {},
) {
  const route = useRoute()
  const router = useRouter()
  /** Paiement que le tiroir montre (ou charge) : posé avant l'appel, pour ne pas le relire deux fois. */
  const openId = ref<string | null>(null)
  const section = ref<PaymentSection | null>(null)

  const currentQuery = () => ({ ...((route?.query ?? {}) as Record<string, unknown>) })

  /** Paiement désigné par l'URL : UUID seulement, et seulement sur l'onglet Paiements. */
  function paymentInUrl(): string | null {
    const query = currentQuery()
    if (query.tab !== undefined && query.tab !== 'payments') return null
    return uuidParam(query.open)
  }

  function write() {
    const query = currentQuery()
    delete query.open
    delete query.section
    if (openId.value) {
      query.open = openId.value
      if (section.value) query.section = section.value
    }
    const next = opts.apply ? opts.apply(query) : query
    if (sameQuery(route?.query as Record<string, unknown> | undefined, next)) return
    void router?.replace?.({ query: next as LocationQueryRaw })
  }

  /** Ouvre la fiche : un autre paiement repart sur Résumé, sauf si l'appelant donne l'onglet. */
  async function openPayment(id: string, wanted: PaymentSection | null = null) {
    openId.value = id
    section.value = wanted
    write()
    await detail.open(id)
  }
  /** Fermeture sans toucher à l'URL : elle ne porte déjà plus la fiche. */
  function reset() {
    openId.value = null
    section.value = null
    detail.close()
  }
  function closePayment() {
    reset()
    write()
  }
  /** Onglet choisi dans le tiroir (identifiant d'onglet, `summary` compris). */
  function setSection(tab: string) {
    section.value = paymentDrawerSection(tab)
    if (openId.value) write()
  }

  /** Au montage de la page : la fiche portée par l'URL, sur son onglet, sans réécrire l'URL. */
  async function restore() {
    const id = paymentInUrl()
    if (!id) return
    openId.value = id
    section.value = paymentDrawerSection(currentQuery().section)
    await detail.open(id)
  }

  /**
   * Query d'un changement d'onglet de la page. `open` n'y reste que pour la fiche paiement
   * ouverte : quitter Paiements la retire, et l'`open` d'un autre onglet (litige bancaire,
   * remboursement wallet) ne devient pas un paiement en revenant sur Paiements.
   */
  function tabQuery(tab: string): LocationQueryRaw {
    const query = currentQuery()
    delete query.open
    delete query.section
    if (tab !== 'payments') {
      query.tab = tab
      return query as LocationQueryRaw
    }
    delete query.tab
    if (openId.value) {
      query.open = openId.value
      if (section.value) query.section = section.value
    }
    return query as LocationQueryRaw
  }

  // Page déjà ouverte : seule la query change (recherche globale, notification, lien recliqué).
  watch(() => [route?.query?.open, route?.query?.tab, route?.query?.section], () => {
    const query = currentQuery()
    const onPayments = query.tab === undefined || query.tab === 'payments'
    // La fiche affichée (son identifiant tel qu'écrit à l'ouverture) : seul l'onglet a pu changer.
    if (openId.value && onPayments && query.open === openId.value) {
      section.value = paymentDrawerSection(query.section)
      return
    }
    const id = paymentInUrl()
    if (!id) {
      if (openId.value) reset()
      return
    }
    void openPayment(id, paymentDrawerSection(currentQuery().section))
  })

  return { openId, section, openPayment, closePayment, setSection, restore, tabQuery }
}
