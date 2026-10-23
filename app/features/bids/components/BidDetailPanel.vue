<script setup lang="ts">
import { useEscapeClose } from '@/composables/useEscapeClose'
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import BidTimeline from './BidTimeline.vue'
import BidDrawerHeader from './BidDrawerHeader.vue'
import BidAlertBanner from './BidAlertBanner.vue'
import BidStepper from './BidStepper.vue'
import BidPartiesRow from './BidPartiesRow.vue'
import BidActionsMenu from './BidActionsMenu.vue'
import BidSummaryTab, { type BidIdentifierRow } from './BidSummaryTab.vue'
import StripeResyncPanel from '@/features/payments/components/StripeResyncPanel.vue'
import StartSupportConversationDialog from '@/features/support/components/StartSupportConversationDialog.vue'
import BidCancelDialog from './BidCancelDialog.vue'
import BidDisputeDialog from './BidDisputeDialog.vue'
import { useBidAdminActions } from '@/features/bids/composables/useBidAdminActions'
import { cancelMoneyEffect, disputeMoneyEffect, parcelWithTraveler } from '@/features/bids/lib/bidActions'
import type { AdminBidCancelReason, AdminDisputeReason, DisputeParty } from '@/features/bids/lib/bidActions'
import { paymentStatusMeta } from '@/features/payments/components/paymentStatus'
import { formatMajorAmount } from '@/features/finance/types/index'
import { formatMoney } from '@/features/payments/types/index'
import type { PaymentStatus } from '@/features/payments/types/index'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'
import { bidPaymentMethodLabel, formatDateTime, placeLabel } from '@/features/bids/lib/bidLabels'
import { useAuthStore } from '@/stores/auth'
import { safeHttpsUrl } from '@/lib/safeInput'

export type BidDrawerTab = 'summary' | 'tracking' | 'money' | 'chat' | 'incidents'

const props = defineProps<{
  bid: AdminBidDetail
  timeline: AdminBidTimeline | null
  open: boolean
  timelineLoading?: boolean
  timelineError?: string | null
  /** Onglet affiché ; inconnu ou masqué : Résumé. */
  section?: BidDrawerTab | string
}>()
const emit = defineEmits<{
  close: []
  /** Onglet Annonces, filtré sur l'annonce du colis. */
  'show-announcement': [announcementId: string]
  /** Onglet Colis, filtré sur les colis du même trajet. */
  'show-trip-bids': [announcementId: string]
  /** Resynchronisation Stripe faite : la fiche est à relire. */
  resynced: []
  /** Colis annulé ou litige ouvert : la fiche est à relire. */
  changed: []
  /** Onglet choisi par l'admin. */
  'update:section': [section: BidDrawerTab]
}>()
useEscapeClose(() => emit('close'), () => props.open)
const auth = useAuthStore()

/** Ancien back (sans les champs de la fiche détaillée) : sections en « non disponible ». */
const legacy = computed(() => props.bid.trip === undefined && props.bid.money === undefined && props.bid.links === undefined)
const trip = computed(() => props.bid.trip ?? null)
const money = computed(() => props.bid.money ?? null)
const links = computed(() => props.bid.links ?? null)

const title = computed(() => {
  const t = trip.value
  if (t && (t.departureCity || t.arrivalCity)) return `${t.departureCity ?? '?'} → ${t.arrivalCity ?? '?'}`
  return props.bid.corridor || 'Colis'
})
const countries = computed(() => {
  const t = trip.value
  if (!t || (!t.departureCountryCode && !t.arrivalCountryCode)) return null
  return `${placeLabel(null, t.departureCountryCode)} → ${placeLabel(null, t.arrivalCountryCode)}`
})

// ---- Onglets ----
const tabs = computed<TabItem<BidDrawerTab>[]>(() => {
  const out: TabItem<BidDrawerTab>[] = [
    { id: 'summary', label: 'Résumé' },
    { id: 'tracking', label: 'Suivi' },
    { id: 'money', label: 'Argent' },
  ]
  if (auth.can('MODERATION_VIEW') && links.value?.conversationId) out.push({ id: 'chat', label: 'Échanges' })
  // `null` : pas le droit DISPUTE_VIEW ; `undefined` : ancien back. Dans les deux cas, pas d'onglet.
  const inc = props.bid.incidents
  if (inc != null && auth.can('DISPUTE_VIEW')) {
    const count = inc.disputes.filter(d => d.status === 'OPEN').length + inc.cancellations.length
    out.push({ id: 'incidents', label: 'Incidents', count, alert: true })
  }
  return out
})
const requested = ref<string>(props.section ?? 'summary')
watch(() => props.section, (s) => { requested.value = s ?? 'summary' })
const active = computed<BidDrawerTab>(() => tabs.value.find(t => t.id === requested.value)?.id ?? 'summary')
function selectTab(id: BidDrawerTab) {
  requested.value = id
  emit('update:section', id)
}

/** Photos présignées : seules les URL `https:` deviennent un lien ou une image. */
const photos = computed<string[] | null>(() => props.bid.photoUrls
  ? props.bid.photoUrls.map(safeHttpsUrl).filter((u): u is string => u !== null)
  : null)

// ---- Argent ----
const isCash = computed(() => props.bid.paymentMethod === 'CASH')
const canSeePayments = computed(() => auth.can('PAYMENT_VIEW'))
const payStatus = computed(() => {
  const s = money.value?.status
  if (!s) return null
  return paymentStatusMeta(s as PaymentStatus) ?? { label: s, tone: 'neutral' as const }
})
const moneyEmpty = computed(() => {
  if (!canSeePayments.value) return 'Montants du paiement réservés aux admins qui consultent les transactions.'
  if (isCash.value) return 'Paiement en espèces à la remise : aucun paiement en ligne pour ce colis.'
  return 'Aucun paiement en ligne enregistré pour ce colis.'
})
const commissionRate = computed(() => (props.bid.commissionRate != null
  ? `${(props.bid.commissionRate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
  : null))
const canResync = computed(() => canSeePayments.value && money.value?.rail === 'STRIPE')

const supportRecipient = ref<{ id: string; name: string } | null>(null)

// ---- Annuler le colis / Ouvrir un litige (super-admin) ----
const actions = useBidAdminActions()
const dialog = ref<'cancel' | 'dispute' | null>(null)

function openDialog(kind: 'cancel' | 'dispute') {
  actions.reset()
  dialog.value = kind
}
function closeDialog() {
  if (!actions.busy.value) dialog.value = null
}
async function confirmCancel(reason: AdminBidCancelReason, note: string) {
  if (await actions.cancel(props.bid.id, reason, note)) { dialog.value = null; emit('changed') }
}
async function confirmDispute(party: DisputeParty, reason: AdminDisputeReason, description: string) {
  if (await actions.openDispute(props.bid.id, party, reason, description)) { dialog.value = null; emit('changed') }
}

const copied = ref<string | null>(null)
watch(() => props.bid.id, () => {
  copied.value = null; supportRecipient.value = null; dialog.value = null; actions.reset()
  const reset = props.section ?? 'summary'
  if (requested.value !== reset) { requested.value = reset; emit('update:section', active.value) }
})
async function copy(key: string, value: string) {
  try { await navigator.clipboard.writeText(value); copied.value = key } catch { copied.value = null }
}
const identifiers = computed(() => {
  const rows: BidIdentifierRow[] = [{ key: 'bid', label: 'Colis', value: props.bid.id }]
  if (props.bid.trackingNumber) rows.push({ key: 'tracking', label: 'N° de suivi', value: props.bid.trackingNumber })
  if (props.bid.announcementId) rows.push({ key: 'announcement', label: 'Annonce', value: props.bid.announcementId })
  if (money.value?.paymentId) rows.push({ key: 'payment', label: 'Paiement', value: money.value.paymentId })
  if (links.value?.negotiationThreadId) rows.push({ key: 'thread', label: 'Fil de négociation', value: links.value.negotiationThreadId })
  if (links.value?.conversationId) rows.push({ key: 'conversation', label: 'Conversation', value: links.value.conversationId })
  return rows
})
const allIdentifiers = computed(() => identifiers.value.map(r => `${r.label} : ${r.value}`).join('\n'))
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside
      class="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-surface"
      role="dialog" aria-modal="true" aria-labelledby="bid-detail-title" data-test="bid-detail"
    >
      <BidDrawerHeader :bid="bid" :title="title" :countries="countries" :copied="copied" @copy="copy('tracking', $event)" @close="emit('close')">
        <template #actions>
          <BidActionsMenu
            :bid="bid" :copied="copied" :identifiers-text="allIdentifiers" :busy="actions.busy.value"
            :cancel-unavailable="actions.cancelUnavailable.value" :dispute-unavailable="actions.disputeUnavailable.value"
            :success="actions.success.value" :error="actions.error.value" :dialog-open="dialog !== null"
            @copy="copy" @open-dialog="openDialog"
          />
        </template>
      </BidDrawerHeader>

      <div class="flex flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        <p
          v-if="legacy" data-test="bid-legacy"
          class="rounded-card border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-pretty"
        >Le serveur n’envoie pas encore le détail du trajet, des personnes et du paiement : ces informations arriveront avec sa prochaine mise à jour.</p>
        <BidAlertBanner :bid="bid" />
        <BidStepper :bid="bid" />
        <BidPartiesRow :bid="bid" @contact="supportRecipient = $event" />

        <div>
          <TabBar
            variant="underline" test-prefix="bid-tab" id-prefix="bid-tab" aria-label="Sections de la fiche colis"
            :tabs="tabs" :model-value="active" @update:model-value="selectTab"
          />
          <div :id="`bid-panel-${active}`" role="tabpanel" :aria-labelledby="`bid-tab-${active}`" class="pt-5" :data-test="`bid-panel-${active}`">
            <BidSummaryTab
              v-if="active === 'summary'" :bid="bid" :identifiers="identifiers" :copied="copied"
              @show-announcement="emit('show-announcement', $event)" @show-trip-bids="emit('show-trip-bids', $event)" @copy="copy"
            />

            <!-- Suivi (provisoire, remplacé par la galerie par étape en Task 8) -->
            <template v-else-if="active === 'tracking'">
              <section class="mb-6" data-test="section-timeline" aria-labelledby="bid-timeline-title">
                <h3 id="bid-timeline-title" class="mb-2 text-sm font-semibold">Chronologie</h3>
                <BidTimeline :timeline="timeline" :loading="timelineLoading" :error="timelineError" />
              </section>
              <section v-if="photos" class="mb-6" data-test="section-photos" aria-labelledby="bid-photos-title">
                <h3 id="bid-photos-title" class="mb-2 text-sm font-semibold">Photos du colis</h3>
                <ul v-if="photos.length" class="flex flex-wrap gap-2" data-test="parcel-photos">
                  <li v-for="(url, i) in photos" :key="url">
                    <a :href="url" target="_blank" rel="noopener noreferrer" class="block rounded-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      <img
                        :src="url" :alt="`Photo du colis ${i + 1}`"
                        class="h-20 w-20 rounded-xs object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                      >
                    </a>
                  </li>
                </ul>
                <p v-else class="text-xs text-text-muted" data-test="parcel-no-photos">Aucune photo du colis.</p>
              </section>
            </template>

            <!-- Argent (provisoire, enrichi en Task 8) -->
            <template v-else-if="active === 'money'">
              <section class="mb-6" data-test="section-money" aria-labelledby="bid-money-title">
                <h3 id="bid-money-title" class="mb-2 text-sm font-semibold">Argent</h3>
                <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <template v-if="money">
                    <div><dt class="text-text-muted">Payé par l’expéditeur</dt><dd class="tabular-nums" data-test="money-amount">{{ formatMoney(money.amountCents, money.currency ?? undefined) }}</dd></div>
                    <div><dt class="text-text-muted">Commission Yadony</dt><dd class="tabular-nums" data-test="money-commission">{{ formatMoney(money.commissionCents, money.currency ?? undefined) }}</dd></div>
                  </template>
                  <div><dt class="text-text-muted">Net voyageur</dt><dd class="tabular-nums font-medium" data-test="bid-detail-net">{{ formatMajorAmount(bid.netEur, bid.currency) }}</dd></div>
                  <div><dt class="text-text-muted">Devise</dt><dd data-test="bid-detail-currency">{{ bid.currency ?? money?.currency ?? '—' }}</dd></div>
                  <div><dt class="text-text-muted">Méthode</dt><dd data-test="money-method">{{ bidPaymentMethodLabel(bid.paymentMethod) }}</dd></div>
                  <div v-if="!money && commissionRate"><dt class="text-text-muted">Taux de commission</dt><dd class="tabular-nums">{{ commissionRate }}</dd></div>
                  <template v-if="money">
                    <div><dt class="text-text-muted">Statut du paiement</dt><dd><StatusBadge v-if="payStatus" v-bind="payStatus" data-test="money-status" /><span v-else>—</span></dd></div>
                    <div v-if="money.rail === 'STRIPE'" data-test="money-captured">
                      <dt class="text-text-muted">Encaissé</dt>
                      <dd class="tabular-nums">{{ money.capturedAt && formatDateTime(money.capturedAt) ? `Oui, le ${formatDateTime(money.capturedAt)}` : 'Non' }}</dd>
                    </div>
                    <div data-test="money-released">
                      <dt class="text-text-muted">Versé au voyageur</dt>
                      <dd class="tabular-nums">{{ money.escrowReleasedAt ? `Le ${formatDateTime(money.escrowReleasedAt)}` : 'Pas encore' }}</dd>
                    </div>
                    <div v-if="money.refundedCents > 0"><dt class="text-text-muted">Remboursé</dt><dd class="tabular-nums">{{ formatMoney(money.refundedCents, money.currency ?? undefined) }}</dd></div>
                    <div v-if="money.payoutHeldAt" class="sm:col-span-2"><dt class="text-danger">Versement retenu</dt><dd class="tabular-nums">Depuis le {{ formatDateTime(money.payoutHeldAt) }}</dd></div>
                    <div v-if="money.disputed" class="sm:col-span-2"><dt class="text-danger">Litige bancaire</dt><dd>Ouvert chez la banque de l’expéditeur</dd></div>
                  </template>
                </dl>
                <p v-if="!money" class="mt-2 text-sm text-text-muted text-pretty" data-test="money-empty">
                  {{ legacy ? 'Détail du paiement non disponible pour l’instant.' : moneyEmpty }}
                </p>
              </section>
              <div v-if="canResync && money" class="mb-6" data-test="action-resync">
                <StripeResyncPanel :payment-id="money.paymentId" :currency="money.currency" @done="emit('resynced')" />
              </div>
            </template>

            <!-- Échanges et Incidents : contenu branché en Task 9 -->
            <p v-else class="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted text-pretty" :data-test="`bid-tab-placeholder-${active}`">
              Contenu à venir. En attendant, le menu « Actions » mène {{ active === 'chat' ? 'à la conversation' : 'au litige ou à l’absence signalée' }}.
            </p>
          </div>
        </div>

        <div class="mt-auto pt-2">
          <button
            type="button" data-test="bid-close"
            class="inline-flex min-h-10 items-center rounded-btn border border-border px-4 text-sm transition-[background-color,transform] hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
            @click="emit('close')"
          >Fermer</button>
        </div>
      </div>

      <BidCancelDialog
        :open="dialog === 'cancel'" :money-effect="cancelMoneyEffect(bid)" :with-traveler="parcelWithTraveler(bid)"
        :busy="actions.busy.value" :error="actions.error.value"
        @confirm="confirmCancel" @cancel="closeDialog"
      />
      <BidDisputeDialog
        :open="dialog === 'dispute'" :money-effect="disputeMoneyEffect(bid)"
        :sender-name="bid.sender?.name ?? bid.senderName" :traveler-name="bid.traveler?.name ?? bid.travelerName"
        :busy="actions.busy.value" :error="actions.error.value"
        @confirm="confirmDispute" @cancel="closeDialog"
      />
      <StartSupportConversationDialog
        :open="supportRecipient !== null" :recipient="supportRecipient"
        @close="supportRecipient = null" @sent="supportRecipient = null"
      />
    </aside>
  </div>
</template>
