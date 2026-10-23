<script setup lang="ts">
import { useEscapeClose } from '@/composables/useEscapeClose'
import { computed, ref, watch } from 'vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import BidTrackingTab from './BidTrackingTab.vue'
import BidMoneyTab from './BidMoneyTab.vue'
import BidIncidentsTab from './BidIncidentsTab.vue'
import BidDrawerHeader from './BidDrawerHeader.vue'
import BidAlertBanner from './BidAlertBanner.vue'
import BidStepper from './BidStepper.vue'
import BidPartiesRow from './BidPartiesRow.vue'
import BidActionsMenu from './BidActionsMenu.vue'
import BidSummaryTab, { type BidIdentifierRow } from './BidSummaryTab.vue'
import StartSupportConversationDialog from '@/features/support/components/StartSupportConversationDialog.vue'
import BidCancelDialog from './BidCancelDialog.vue'
import BidDisputeDialog from './BidDisputeDialog.vue'
import { useBidAdminActions } from '@/features/bids/composables/useBidAdminActions'
import { cancelMoneyEffect, disputeMoneyEffect, parcelWithTraveler } from '@/features/bids/lib/bidActions'
import type { AdminBidCancelReason, AdminDisputeReason, DisputeParty } from '@/features/bids/lib/bidActions'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'
import { placeLabel } from '@/features/bids/lib/bidLabels'
import { useAuthStore } from '@/stores/auth'

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
          <div :id="`bid-panel-${active}`" role="region" :aria-labelledby="`bid-tab-${active}`" class="pt-5" :data-test="`bid-panel-${active}`">
            <BidSummaryTab
              v-if="active === 'summary'" :bid="bid" :identifiers="identifiers" :copied="copied"
              @show-announcement="emit('show-announcement', $event)" @show-trip-bids="emit('show-trip-bids', $event)" @copy="copy"
            />

            <BidTrackingTab
              v-else-if="active === 'tracking'" :bid="bid" :timeline="timeline" :loading="timelineLoading" :error="timelineError"
              @reload-bid="emit('resynced')"
            />
            <BidMoneyTab v-else-if="active === 'money'" :bid="bid" @resynced="emit('resynced')" />
            <BidIncidentsTab v-else-if="active === 'incidents'" :bid="bid" />

            <!-- Échanges : contenu branché en Task 9 -->
            <p v-else class="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted text-pretty" data-test="bid-tab-placeholder-chat">
              Contenu à venir. En attendant, le menu « Actions » mène à la conversation.
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
