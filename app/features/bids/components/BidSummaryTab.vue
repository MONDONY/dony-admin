<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import type { AdminBidDetail } from '@/features/bids/types/index'
import {
  announcementStatusMeta, formatDateTime, formatDay, formatKg, formatTime, placeLabel, transportModeLabel,
} from '@/features/bids/lib/bidLabels'

export interface BidIdentifierRow { key: string; label: string; value: string }

/** Onglet Résumé : trajet, colis (les photos sont dans « Suivi ») et identifiants copiables. */
const props = defineProps<{
  bid: AdminBidDetail
  identifiers: BidIdentifierRow[]
  copied: string | null
}>()
const emit = defineEmits<{
  'show-announcement': [announcementId: string]
  'show-trip-bids': [announcementId: string]
  copy: [key: string, value: string]
}>()

/** Ancien back (sans les champs de la fiche détaillée) : « non disponible » au lieu de vide. */
const legacy = computed(() => props.bid.trip === undefined && props.bid.money === undefined && props.bid.links === undefined)
const trip = computed(() => props.bid.trip ?? null)

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
const annStatus = computed(() => announcementStatusMeta(trip.value?.status))
</script>

<template>
  <div>
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
            class="inline-flex min-h-10 items-center rounded-btn bg-primary/10 px-3 text-sm font-medium text-primary transition-[background-color,transform] hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
            @click="emit('show-announcement', trip.announcementId)"
          >Voir l’annonce</button>
          <button
            v-if="trip.otherBidsCount > 0" type="button" data-test="trip-other-bids"
            class="inline-flex min-h-10 items-center rounded-btn bg-surface-elevated px-3 text-sm transition-[background-color,transform] hover:bg-border/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
            @click="emit('show-trip-bids', trip.announcementId)"
          >{{ trip.otherBidsCount === 1 ? '1 autre colis sur ce trajet' : `${trip.otherBidsCount} autres colis sur ce trajet` }}</button>
          <span v-else class="self-center text-xs text-text-muted" data-test="trip-no-other-bids">Seul colis sur ce trajet</span>
        </div>
      </template>
    </section>

    <!-- Colis -->
    <section class="mb-6" data-test="section-parcel" aria-labelledby="bid-parcel-title">
      <h3 id="bid-parcel-title" class="mb-2 text-sm font-semibold">Colis</h3>
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt class="text-text-muted">Poids</dt><dd class="tabular-nums" data-test="parcel-weight">{{ formatKg(bid.weightKg) ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Contenu</dt><dd>{{ bid.contentCategory ?? '—' }}</dd></div>
        <div v-if="bid.description" class="sm:col-span-2"><dt class="text-text-muted">Description</dt><dd class="text-pretty break-words" data-test="parcel-description">{{ bid.description }}</dd></div>
        <div v-if="bid.confirmationCodePresent !== undefined && bid.confirmationCodePresent !== null" data-test="parcel-code">
          <dt class="text-text-muted">Code de remise</dt>
          <dd>{{ bid.confirmationCodePresent ? 'Généré (visible seulement par l’expéditeur)' : 'Pas encore généré' }}</dd>
        </div>
        <div v-if="bid.milestones?.handoverLocation" class="sm:col-span-2"><dt class="text-text-muted">Lieu de remise</dt><dd class="text-pretty">{{ bid.milestones.handoverLocation }}</dd></div>
        <div v-if="bid.milestones?.deliveredAt"><dt class="text-text-muted">Livré le</dt><dd class="tabular-nums">{{ formatDateTime(bid.milestones.deliveredAt) }}</dd></div>
        <div v-if="bid.milestones?.returnedAt"><dt class="text-text-muted">Rendu le</dt><dd class="tabular-nums">{{ formatDateTime(bid.milestones.returnedAt) }}</dd></div>
      </dl>
    </section>

    <!-- Identifiants -->
    <section data-test="section-ids" aria-labelledby="bid-ids-title">
      <h3 id="bid-ids-title" class="mb-2 text-sm font-semibold">Identifiants</h3>
      <dl class="space-y-1.5 text-sm">
        <div v-for="r in identifiers" :key="r.key" class="flex flex-wrap items-center gap-x-2" :data-test="`id-${r.key}`">
          <dt class="w-36 shrink-0 text-text-muted">{{ r.label }}</dt>
          <dd class="min-w-0 flex-1 font-mono text-xs break-all">{{ r.value }}</dd>
          <button
            type="button" :data-test="`copy-${r.key}`"
            class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
            @click="emit('copy', r.key, r.value)"
          >{{ copied === r.key ? 'Copié' : 'Copier' }}</button>
        </div>
      </dl>
    </section>
  </div>
</template>
