import { computed, reactive, ref, watch } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { usePayments } from '@/features/payments/composables/usePayments'
import { usePaymentCounts } from '@/features/payments/composables/usePaymentCounts'
import { usePaymentSuggestions } from '@/features/payments/composables/usePaymentSuggestions'
import { useUrlFilters } from '@/composables/useUrlFilters'
import { defaultPaymentViewFor } from '@/features/payments/lib/paymentViews'
import {
  PAYMENT_URL_SPECS, paymentActiveChips, paymentStateFromQuery, paymentUrlValues,
  type PaymentChipKey, type PaymentChipLabels, type PaymentUrlKey,
} from '@/features/payments/lib/paymentPageFilters'
import { tripSearchText } from '@/features/payments/lib/paymentLabels'
import type { FilterSpecs } from '@/lib/urlFilters'
import type { PaymentSuggestParcel, PaymentSuggestPerson, PaymentSuggestTrip } from '@/features/payments/types/index'

export type PaymentPickKind = 'sender' | 'traveler' | 'trip' | 'parcel'
type PickPayload = PaymentSuggestPerson | PaymentSuggestTrip | PaymentSuggestParcel

/**
 * Section Paiements de la page Transactions : liste, nombres par vue, suggestions, filtres dans
 * l'URL et puces. La page ne fait qu'assembler ; le tiroir et l'onglet restent à la page.
 *
 * - URL lue à la création (avant le premier rendu) : `?held=true` devient l'alerte HELD,
 *   identifiants UUID vérifiés, montants des unités principales vers les centimes.
 * - Ancien back (nombres absents) : vues masquées, vue « Tous », alertes inconnues de lui
 *   retirées ; l'alerte HELD reste, le service l'envoie aussi en `held=true` qu'il comprend.
 */
export function usePaymentsSection(opts: { active?: () => boolean } = {}) {
  const route = useRoute()
  const router = useRouter()
  const list = usePayments()
  const { filters } = list
  const countsApi = usePaymentCounts(filters)
  const suggestApi = usePaymentSuggestions()

  // Avant de suivre l'URL : la copie de l'état reçu ne doit pas déclencher de réécriture.
  // Seule la section Paiements lit ces paramètres : `view` et `query` d'une autre section
  // (?tab=mobile-money&view=failed) ne sont pas ses filtres ; seul l'alias d'entrée `held` reste lu.
  const rawQuery = (route?.query ?? {}) as Record<string, unknown>
  const onPayments = rawQuery.tab === undefined || rawQuery.tab === 'payments'
  Object.assign(filters, paymentStateFromQuery(onPayments ? rawQuery : (rawQuery.held === undefined ? {} : { held: rawQuery.held })))
  const specs: FilterSpecs<PaymentUrlKey> = {
    ...PAYMENT_URL_SPECS,
    view: { ...PAYMENT_URL_SPECS.view, defaultFrom: q => (countsApi.unavailable.value ? 'ALL' : defaultPaymentViewFor(q)) },
  }
  // Les filtres ne s'écrivent dans l'URL que tant que la section est affichée : `view` et `query` y sont aussi ceux de Mobile money.
  const url = useUrlFilters(paymentUrlValues(filters), specs, { enabled: opts.active })

  const labels = reactive<PaymentChipLabels>({})
  const chips = computed(() => paymentActiveChips(filters, labels))
  /** Onglets de vue : seulement une fois les nombres répondus, et jamais face à un ancien back. */
  const viewsReady = computed(() => countsApi.settled.value && !countsApi.unavailable.value)
  /** Nombres pas encore répondus : la page réserve la hauteur de la barre des vues (pas de saut). */
  const viewsPending = computed(() => !countsApi.settled.value)
  /** Nombre du lien « N checkouts abandonnés masqués · les afficher » ; 0 = pas de lien. */
  const hiddenAbandoned = computed(() => (filters.hideAbandoned && !countsApi.unavailable.value ? countsApi.counts.value?.abandoned ?? 0 : 0))
  /** Bascule « Versements retenus » : l'alerte HELD (ou l'ancien filtre `held`). */
  const held = computed(() => filters.alert === 'HELD' || !!filters.held)
  /** Change à chaque choix de suggestion : le champ reprend la requête appliquée. */
  const searchResetKey = ref(0)
  let typed = ''
  let loaded = false

  /**
   * `?held=` n'a plus cours une fois converti : on le retire, les autres paramètres restent. Reçu
   * sur un autre onglet (?tab=wallet-refunds&held=true), la retenue reste dans l'état des Paiements
   * mais n'entre pas dans l'URL de cet onglet : elle y reviendra avec les Paiements.
   */
  async function stripLegacyHeld() {
    const query = (route?.query ?? {}) as Record<string, unknown>
    if (!('held' in query)) return
    const rest = { ...query }
    delete rest.held
    const inactive = opts.active !== undefined && !opts.active()
    await router.replace({ query: (inactive ? rest : url.apply(rest)) as LocationQueryRaw })
  }

  async function load() {
    loaded = true
    await stripLegacyHeld()
    await Promise.all([list.fetchPayments(), countsApi.sync()])
  }

  /** Page déjà ouverte : un lien `?held=true` arrivé ensuite (changement de query seul). */
  async function applyLegacyHeld() {
    const query = (route?.query ?? {}) as Record<string, unknown>
    if (!('held' in query)) return
    const next = paymentStateFromQuery(query)
    // L'URL d'abord (attendue) : sinon la réécriture des filtres repartirait d'une query qui porte encore `held`.
    await stripLegacyHeld()
    if (next.alert === undefined) return
    filters.view = next.view
    filters.alert = next.alert
    list.currentPage.value = 0
    await list.fetchPayments()
  }

  // Les nombres suivent la recherche et les filtres de périmètre, pas la vue, l'alerte ni le statut.
  watch(
    () => [filters.query, filters.method, filters.currency, filters.dateFrom, filters.dateTo, filters.held, filters.hideAbandoned,
      filters.partyId, filters.announcementId, filters.bidId, filters.amountMin, filters.amountMax],
    () => { if (loaded && !countsApi.unavailable.value) void countsApi.sync() },
  )
  // Ancien back : la liste reçue ignorait déjà vue et alerte, rien à recharger.
  watch(countsApi.unavailable, (missing) => {
    if (!missing) return
    filters.view = 'ALL'
    if (filters.alert && filters.alert !== 'HELD') filters.alert = null
  })

  function onType(text: string) {
    typed = text
    if (!suggestApi.unavailable.value) suggestApi.query(text)
  }
  async function onSearch(text: string) {
    suggestApi.clear()
    await list.setQuery(text)
  }
  /**
   * Suggestion choisie : une personne filtre ses paiements (puce à son nom), un trajet devient la
   * recherche « Paris Dakar », un n° de suivi renvoie le paiement à ouvrir.
   */
  async function onPick(kind: PaymentPickKind, payload: PickPayload): Promise<string | null> {
    suggestApi.clear()
    searchResetKey.value++
    if (kind === 'parcel') return (payload as PaymentSuggestParcel).paymentId
    if (kind === 'trip') {
      await list.setQuery(tripSearchText(payload as PaymentSuggestTrip))
      return null
    }
    const person = payload as PaymentSuggestPerson
    labels.party = person.name
    filters.query = ''
    await list.setParty(person.id)
    return null
  }
  /** Référence exacte : à ouvrir seulement si le texte tapé est encore celui des suggestions. */
  async function onOpenPayment(id: string): Promise<string | null> {
    if (suggestApi.exactFor(typed) === id) {
      suggestApi.clear()
      return id
    }
    await onSearch(typed.trim())
    return null
  }

  async function removeChip(key: string) {
    if (key === 'party') delete labels.party
    if (key === 'alert') filters.held = false
    await list.clearFilter(key as PaymentChipKey)
  }
  async function clearAll() {
    for (const k of Object.keys(labels) as (keyof PaymentChipLabels)[]) delete labels[k]
    await list.clearAll()
    if (countsApi.unavailable.value) filters.view = 'ALL'
  }
  async function showAbandoned() { await list.setHideAbandoned(false) }
  /** « Versements retenus » : l'alerte HELD, vue ramenée sur « À traiter » si elle les excluait. */
  async function setHeld(on: boolean) {
    filters.held = false
    if (on && filters.view !== 'ATTENTION' && filters.view !== 'ALL') filters.view = 'ATTENTION'
    await list.setAlert(on ? 'HELD' : null)
  }
  /** Après un geste (déblocage, remboursement…) : liste et nombres relus. */
  async function refresh() {
    await Promise.all([list.fetchPayments(), countsApi.unavailable.value ? null : countsApi.reload()])
  }

  return {
    ...list, countsApi, suggestApi, url, chips, viewsReady, viewsPending, hiddenAbandoned, held, searchResetKey,
    load, applyLegacyHeld, onType, onSearch, onPick, onOpenPayment, removeChip, clearAll, showAbandoned, setHeld, refresh,
  }
}
