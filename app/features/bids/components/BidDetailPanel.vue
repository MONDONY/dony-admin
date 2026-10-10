<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BidTimeline from './BidTimeline.vue'
import BidPartyCard from './BidPartyCard.vue'
import StripeResyncPanel from '@/features/payments/components/StripeResyncPanel.vue'
import StartSupportConversationDialog from '@/features/support/components/StartSupportConversationDialog.vue'
import { bidStatusMeta, bidStatusPhrase } from './bidStatus'
import { paymentStatusMeta } from '@/features/payments/components/paymentStatus'
import { formatMajorAmount } from '@/features/finance/types/index'
import { formatMoney } from '@/features/payments/types/index'
import type { PaymentStatus } from '@/features/payments/types/index'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'
import {
  announcementStatusMeta, bidPaymentMethodLabel, disputeStatusLabel, formatDateTime, formatDay, formatKg,
  formatTime, placeLabel, transportModeLabel,
} from '@/features/bids/lib/bidLabels'
import { useAuthStore } from '@/stores/auth'
import { safeHttpsUrl } from '@/lib/safeInput'

const props = defineProps<{
  bid: AdminBidDetail
  timeline: AdminBidTimeline | null
  open: boolean
  timelineLoading?: boolean
  timelineError?: string | null
}>()
const emit = defineEmits<{
  close: []
  /** Onglet Annonces, filtré sur l'annonce du colis. */
  'show-announcement': [announcementId: string]
  /** Onglet Colis, filtré sur les colis du même trajet. */
  'show-trip-bids': [announcementId: string]
  /** Resynchronisation Stripe faite : la fiche est à relire. */
  resynced: []
}>()
const auth = useAuthStore()

/** Ancien back (sans les champs de la fiche détaillée) : sections en « non disponible ». */
const legacy = computed(() => props.bid.trip === undefined && props.bid.money === undefined && props.bid.links === undefined)
const trip = computed(() => props.bid.trip ?? null)
const money = computed(() => props.bid.money ?? null)
const links = computed(() => props.bid.links ?? null)
const status = computed(() => bidStatusMeta(props.bid.status))
const phrase = computed(() => bidStatusPhrase(props.bid.status))

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

function when(day: string | null | undefined, time: string | null | undefined): string | null {
  const d = formatDay(day)
  if (!d) return null
  const t = formatTime(time)
  return t ? `${d} à ${t}` : d
}
const departure = computed(() => {
  const t = trip.value
  if (!t) return null
  return when(t.departureDate, t.departureTime) ?? formatDateTime(t.departureAt)
})
const arrival = computed(() => (trip.value ? when(trip.value.arrivalDate, trip.value.arrivalTime) : null))
const capacity = computed(() => {
  const t = trip.value
  if (!t) return null
  const total = formatKg(t.totalKg)
  const left = formatKg(t.availableKg)
  if (left && total) return `${left} restants sur ${total}`
  return left ? `${left} restants` : total
})
/** Photos présignées : seules les URL `https:` deviennent un lien ou une image. */
const photos = computed<string[] | null>(() => props.bid.photoUrls
  ? props.bid.photoUrls.map(safeHttpsUrl).filter((u): u is string => u !== null)
  : null)
const annStatus = computed(() => announcementStatusMeta(trip.value?.status))

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

// ---- Actions ----
const canResync = computed(() => canSeePayments.value && money.value?.rail === 'STRIPE')
const canSeeDispute = computed(() => !!links.value?.disputeId && auth.can('DISPUTE_VIEW'))
const canSeeNoShow = computed(() => props.bid.status === 'NO_SHOW' && !!links.value?.cancellationId && auth.can('DISPUTE_VIEW'))
const canSeeConversation = computed(() => !!links.value?.conversationId && auth.can('MODERATION_VIEW'))

const supportRecipient = ref<{ id: string; name: string } | null>(null)

const copied = ref<string | null>(null)
watch(() => props.bid.id, () => { copied.value = null; supportRecipient.value = null })
async function copy(key: string, value: string) {
  try { await navigator.clipboard.writeText(value); copied.value = key } catch { copied.value = null }
}
const identifiers = computed(() => {
  const rows: { key: string; label: string; value: string }[] = [{ key: 'bid', label: 'Colis', value: props.bid.id }]
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
      class="h-full w-full max-w-2xl overflow-y-auto bg-surface border-l border-border px-4 py-5 sm:px-6"
      role="dialog" aria-modal="true" aria-labelledby="bid-detail-title" data-test="bid-detail"
    >
      <!-- En-tête -->
      <header class="mb-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div v-if="bid.trackingNumber" class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-sm font-semibold tracking-wide" data-test="bid-tracking">{{ bid.trackingNumber }}</span>
              <button
                type="button" data-test="bid-copy-tracking"
                class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96]"
                @click="copy('tracking', bid.trackingNumber)"
              >{{ copied === 'tracking' ? 'Copié' : 'Copier' }}</button>
            </div>
            <p v-else class="text-sm text-text-muted" data-test="bid-tracking">N° de suivi pas encore attribué</p>
            <h2 id="bid-detail-title" class="font-display text-xl font-bold text-balance">{{ title }}</h2>
            <p v-if="countries" class="text-sm text-text-muted" data-test="bid-countries">{{ countries }}</p>
          </div>
          <StatusBadge v-bind="status" data-test="bid-status" />
        </div>
        <p v-if="phrase" class="mt-3 rounded-card bg-surface-elevated px-4 py-3 text-sm text-pretty" data-test="bid-phrase">{{ phrase }}</p>
        <p v-if="bid.refusalReason" class="mt-2 text-sm text-text-muted text-pretty" data-test="bid-refusal">Motif du refus : {{ bid.refusalReason }}</p>
        <p
          v-if="legacy" data-test="bid-legacy"
          class="mt-3 rounded-card border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-pretty"
        >Le serveur n’envoie pas encore le détail du trajet, des personnes et du paiement : ces informations arriveront avec sa prochaine mise à jour.</p>
      </header>

      <!-- Trajet -->
      <section class="mb-6" data-test="section-trip" aria-labelledby="bid-trip-title">
        <h3 id="bid-trip-title" class="mb-2 text-sm font-semibold">Trajet</h3>
        <p v-if="!trip" class="text-sm text-text-muted" data-test="trip-unavailable">
          {{ legacy ? 'Non disponible pour l’instant.' : 'L’annonce de ce colis n’existe plus.' }}
        </p>
        <template v-else>
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt class="text-text-muted">Départ</dt><dd>{{ placeLabel(trip.departureCity, trip.departureCountryCode) }}</dd></div>
            <div><dt class="text-text-muted">Arrivée</dt><dd>{{ placeLabel(trip.arrivalCity, trip.arrivalCountryCode) }}</dd></div>
            <div><dt class="text-text-muted">Date et heure de départ</dt><dd class="tabular-nums" data-test="trip-departure">{{ departure ?? 'Non renseignée' }}</dd></div>
            <div><dt class="text-text-muted">Arrivée prévue</dt><dd class="tabular-nums" data-test="trip-arrival">{{ arrival ?? 'Non renseignée' }}</dd></div>
            <div v-if="trip.pickupAddressLabel"><dt class="text-text-muted">Lieu de départ</dt><dd class="text-pretty">{{ trip.pickupAddressLabel }}</dd></div>
            <div v-if="trip.deliveryAddressLabel"><dt class="text-text-muted">Lieu d’arrivée</dt><dd class="text-pretty">{{ trip.deliveryAddressLabel }}</dd></div>
            <div><dt class="text-text-muted">Annonce</dt><dd><StatusBadge v-bind="annStatus" data-test="trip-status" /></dd></div>
            <div><dt class="text-text-muted">Capacité</dt><dd class="tabular-nums" data-test="trip-capacity">{{ capacity ?? '—' }}</dd></div>
            <div v-if="transportModeLabel(trip.transportMode)"><dt class="text-text-muted">Transport</dt><dd>{{ transportModeLabel(trip.transportMode) }}</dd></div>
            <div v-if="trip.pricePerKg != null"><dt class="text-text-muted">Prix au kilo</dt><dd class="tabular-nums">{{ formatMajorAmount(trip.pricePerKg, bid.currency) }}</dd></div>
            <div v-if="trip.handoverDeadline"><dt class="text-text-muted">Remise au plus tard</dt><dd class="tabular-nums">{{ formatDateTime(trip.handoverDeadline) }}</dd></div>
            <div v-if="trip.tripLegIndex"><dt class="text-text-muted">Voyage à étapes</dt><dd class="tabular-nums">Étape {{ trip.tripLegIndex }}</dd></div>
          </dl>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button" data-test="trip-open-announcement"
              class="inline-flex min-h-10 items-center rounded-btn bg-primary/10 px-3 text-sm font-medium text-primary transition-[background-color,transform] hover:bg-primary/20 active:scale-[0.96]"
              @click="emit('show-announcement', trip.announcementId)"
            >Voir l’annonce</button>
            <button
              v-if="trip.otherBidsCount > 0" type="button" data-test="trip-other-bids"
              class="inline-flex min-h-10 items-center rounded-btn bg-surface-elevated px-3 text-sm transition-[background-color,transform] hover:bg-border/40 active:scale-[0.96]"
              @click="emit('show-trip-bids', trip.announcementId)"
            >{{ trip.otherBidsCount === 1 ? '1 autre colis sur ce trajet' : `${trip.otherBidsCount} autres colis sur ce trajet` }}</button>
            <span v-else class="self-center text-xs text-text-muted" data-test="trip-no-other-bids">Seul colis sur ce trajet</span>
          </div>
        </template>
      </section>

      <!-- Personnes -->
      <section class="mb-6" data-test="section-people" aria-labelledby="bid-people-title">
        <h3 id="bid-people-title" class="mb-2 text-sm font-semibold">Personnes</h3>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <BidPartyCard role="sender" title="Expéditeur" :party="bid.sender" :fallback-name="bid.senderName" @contact="supportRecipient = $event" />
          <BidPartyCard role="traveler" title="Voyageur" :party="bid.traveler" :fallback-name="bid.travelerName" @contact="supportRecipient = $event" />
          <div class="rounded-card bg-surface-elevated p-3 sm:col-span-2" data-test="party-recipient">
            <p class="text-xs font-medium text-text-muted">Destinataire</p>
            <p class="mt-0.5 font-medium">{{ bid.recipient?.name ?? bid.recipientName ?? 'Non renseigné' }}</p>
            <p v-if="bid.recipient?.phoneMasked" class="text-xs tabular-nums text-text-muted" data-test="recipient-phone">{{ bid.recipient.phoneMasked }}</p>
          </div>
        </div>
      </section>

      <!-- Colis -->
      <section class="mb-6" data-test="section-parcel" aria-labelledby="bid-parcel-title">
        <h3 id="bid-parcel-title" class="mb-2 text-sm font-semibold">Colis</h3>
        <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt class="text-text-muted">Poids</dt><dd class="tabular-nums" data-test="parcel-weight">{{ formatKg(bid.weightKg) ?? '—' }}</dd></div>
          <div><dt class="text-text-muted">Contenu</dt><dd>{{ bid.contentCategory ?? '—' }}</dd></div>
          <div v-if="bid.description" class="sm:col-span-2"><dt class="text-text-muted">Description</dt><dd class="text-pretty break-words" data-test="parcel-description">{{ bid.description }}</dd></div>
          <div><dt class="text-text-muted">Valeur déclarée</dt><dd class="text-text-muted" data-test="parcel-declared">Non enregistrée par la plateforme</dd></div>
          <div v-if="bid.confirmationCodePresent !== undefined && bid.confirmationCodePresent !== null" data-test="parcel-code">
            <dt class="text-text-muted">Code de remise</dt>
            <dd>{{ bid.confirmationCodePresent ? 'Généré (visible seulement par l’expéditeur)' : 'Pas encore généré' }}</dd>
          </div>
          <div v-if="bid.milestones?.handoverLocation" class="sm:col-span-2"><dt class="text-text-muted">Lieu de remise</dt><dd class="text-pretty">{{ bid.milestones.handoverLocation }}</dd></div>
          <div v-if="bid.milestones?.deliveredAt"><dt class="text-text-muted">Livré le</dt><dd class="tabular-nums">{{ formatDateTime(bid.milestones.deliveredAt) }}</dd></div>
          <div v-if="bid.milestones?.returnedAt"><dt class="text-text-muted">Rendu le</dt><dd class="tabular-nums">{{ formatDateTime(bid.milestones.returnedAt) }}</dd></div>
        </dl>
        <ul v-if="photos && photos.length" class="mt-3 flex flex-wrap gap-2" data-test="parcel-photos">
          <li v-for="(url, i) in photos" :key="url">
            <a :href="url" target="_blank" rel="noopener noreferrer" class="block">
              <img
                :src="url" :alt="`Photo du colis ${i + 1}`"
                class="h-20 w-20 rounded-xs object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              >
            </a>
          </li>
        </ul>
        <p v-else-if="photos" class="mt-2 text-xs text-text-muted" data-test="parcel-no-photos">Aucune photo du colis.</p>
      </section>

      <!-- Argent -->
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

      <!-- Chronologie -->
      <section class="mb-6" data-test="section-timeline" aria-labelledby="bid-timeline-title">
        <h3 id="bid-timeline-title" class="mb-2 text-sm font-semibold">Chronologie</h3>
        <BidTimeline :timeline="timeline" :loading="timelineLoading" :error="timelineError" />
      </section>

      <!-- Actions -->
      <section class="mb-6" data-test="section-actions" aria-labelledby="bid-actions-title">
        <h3 id="bid-actions-title" class="mb-2 text-sm font-semibold">Actions</h3>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-if="money && canSeePayments" :to="{ path: '/transactions', query: { open: money.paymentId } }"
            data-test="action-payment"
            class="inline-flex min-h-10 items-center rounded-btn bg-primary px-4 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.96]"
          >Voir le paiement</NuxtLink>
          <NuxtLink
            v-if="canSeeDispute && links" :to="{ path: '/incidents', query: { open: links.disputeId as string } }"
            data-test="action-dispute"
            class="inline-flex min-h-10 items-center rounded-btn bg-danger/10 px-4 text-sm font-medium text-danger transition-[background-color,transform] hover:bg-danger/20 active:scale-[0.96]"
          >Voir le litige{{ links.disputeStatus ? ` (${disputeStatusLabel(links.disputeStatus)})` : '' }}</NuxtLink>
          <NuxtLink
            v-if="canSeeNoShow && links" :to="{ path: '/incidents', query: { tab: 'noshows', open: links.cancellationId as string } }"
            data-test="action-noshow"
            class="inline-flex min-h-10 items-center rounded-btn bg-warning/15 px-4 text-sm font-medium text-warning transition-[background-color,transform] hover:bg-warning/25 active:scale-[0.96]"
          >Voir l’absence signalée</NuxtLink>
          <NuxtLink
            v-if="canSeeConversation && links" :to="{ path: '/moderation', query: { open: links.conversationId as string } }"
            data-test="action-conversation"
            class="inline-flex min-h-10 items-center rounded-btn bg-surface-elevated px-4 text-sm transition-[background-color,transform] hover:bg-border/40 active:scale-[0.96]"
          >Voir la conversation</NuxtLink>
          <button
            type="button" data-test="action-copy-ids"
            class="inline-flex min-h-10 items-center rounded-btn bg-surface-elevated px-4 text-sm transition-[background-color,transform] hover:bg-border/40 active:scale-[0.96]"
            @click="copy('all', allIdentifiers)"
          >{{ copied === 'all' ? 'Identifiants copiés' : 'Copier les identifiants' }}</button>
        </div>

        <div v-if="canResync && money" class="mt-4" data-test="action-resync">
          <StripeResyncPanel :payment-id="money.paymentId" :currency="money.currency" @done="emit('resynced')" />
        </div>

        <ul class="mt-4 space-y-1.5 text-xs text-text-muted text-pretty" data-test="actions-unavailable">
          <li v-if="!links?.disputeId" data-test="unavailable-dispute">
            Ouvrir un litige : impossible depuis le back-office, l’expéditeur ou le voyageur l’ouvre depuis l’application. Il apparaîtra ici et dans Incidents.
          </li>
          <li data-test="unavailable-cancel">
            Annuler le colis : le back-office n’a pas ce geste. L’annulation se fait dans l’application ; écrivez à l’expéditeur ou au voyageur via le support si besoin.
          </li>
          <li v-if="!auth.can('SUPPORT_TICKET_MANAGE')" data-test="unavailable-support">
            Écrire aux personnes : réservé aux admins qui gèrent le support.
          </li>
        </ul>
      </section>

      <!-- Identifiants -->
      <section class="mb-6" data-test="section-ids" aria-labelledby="bid-ids-title">
        <h3 id="bid-ids-title" class="mb-2 text-sm font-semibold">Identifiants</h3>
        <dl class="space-y-1.5 text-sm">
          <div v-for="r in identifiers" :key="r.key" class="flex flex-wrap items-center gap-x-2" :data-test="`id-${r.key}`">
            <dt class="w-36 shrink-0 text-text-muted">{{ r.label }}</dt>
            <dd class="min-w-0 flex-1 font-mono text-xs break-all">{{ r.value }}</dd>
            <button
              type="button" :data-test="`copy-${r.key}`"
              class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96]"
              @click="copy(r.key, r.value)"
            >{{ copied === r.key ? 'Copié' : 'Copier' }}</button>
          </div>
        </dl>
      </section>

      <button
        type="button" data-test="bid-close"
        class="inline-flex min-h-10 items-center rounded-btn border border-border px-4 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.96]"
        @click="emit('close')"
      >Fermer</button>

      <StartSupportConversationDialog
        :open="supportRecipient !== null" :recipient="supportRecipient"
        @close="supportRecipient = null" @sent="supportRecipient = null"
      />
    </aside>
  </div>
</template>
