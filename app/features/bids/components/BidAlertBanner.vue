<script setup lang="ts">
import { computed } from 'vue'
import type { AdminBidDetail, BidAlertCode } from '@/features/bids/types/index'
import { alertMeta } from '@/features/bids/lib/bidViews'
import { disputeStatusLabel } from '@/features/bids/lib/bidLabels'
import { bidLinks } from '@/features/bids/lib/bidLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Bandeau d'alerte : affiche `bid.alert` calculé par le back (une seule définition, en SQL),
 * jamais recalculé ici. Pas d'alerte (ou ancien back) : rien.
 */
const props = defineProps<{ bid: AdminBidDetail }>()
const auth = useAuthStore()

const TITLES: Record<BidAlertCode, string> = {
  DISPUTE_OPEN: 'Litige ouvert',
  NO_SHOW: 'Absence signalée',
  PAYMENT_PENDING: 'Paiement en attente',
  LATE: 'Livraison en retard',
}
const HINTS: Partial<Record<BidAlertCode, string>> = {
  PAYMENT_PENDING: 'L’expéditeur n’a pas encore payé ce colis.',
  LATE: 'La date d’arrivée prévue du trajet est dépassée sans livraison.',
}

const code = computed(() => (alertMeta(props.bid.alert) ? props.bid.alert as BidAlertCode : null))
const tone = computed(() => alertMeta(code.value)?.tone ?? 'warning')
const links = computed(() => props.bid.links ?? null)

const detail = computed(() => {
  if (code.value === 'DISPUTE_OPEN' && links.value?.disputeStatus) return `Statut du litige : ${disputeStatusLabel(links.value.disputeStatus)}`
  return code.value ? HINTS[code.value] ?? null : null
})
const link = computed(() => {
  const routes = bidLinks(props.bid, auth.can)
  if (code.value === 'DISPUTE_OPEN' && routes.dispute) return { to: routes.dispute, label: 'Voir l’incident' }
  if (code.value === 'NO_SHOW' && routes.noShow) return { to: routes.noShow, label: 'Voir l’absence signalée' }
  return null
})
</script>

<template>
  <div
    v-if="code" data-test="bid-alert-banner" :data-code="code"
    :class="['flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border px-4 py-3',
             tone === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5']"
  >
    <strong :class="['text-sm font-semibold', tone === 'danger' ? 'text-danger' : 'text-warning']">{{ TITLES[code] }}</strong>
    <span v-if="detail" class="text-sm text-text-muted text-pretty" data-test="bid-alert-detail">{{ detail }}</span>
    <NuxtLink
      v-if="link" :to="link.to" data-test="bid-alert-link"
      class="ml-auto inline-flex min-h-10 items-center rounded-btn px-2 text-sm font-medium text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
    >{{ link.label }}</NuxtLink>
  </div>
</template>
