<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import PaymentAlertBadge from './PaymentAlertBadge.vue'
import { paymentStatusMeta } from './paymentStatus'
import { formatMoney, isPaymentHeld, paymentMethodLabel } from '@/features/payments/types/index'
import type { AdminPaymentListItem } from '@/features/payments/types/index'
import { paymentAge, paymentKindLabel, routeLabel, shortId } from '@/features/payments/lib/paymentLabels'
import { bidRoute, gate, userRoute } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

withDefaults(defineProps<{ payments: AdminPaymentListItem[]; loading: boolean; emptyLabel?: string }>(), { emptyLabel: 'Aucun paiement' })
const emit = defineEmits<{ select: [id: string] }>()

const auth = useAuthStore()
const can = (p: Parameters<typeof auth.can>[0]) => auth.can(p)

/** Fiche colis : le colis résolu par le back (négociation comprise), à défaut celui de la ligne. */
const bidLink = (p: AdminPaymentListItem) => gate(can, 'BID_VIEW', bidRoute(p.insight?.bidId ?? p.bidId))
/** Fiche de la personne ; sans nom à afficher, pas de lien (jamais un « — » cliquable). */
const userLink = (party: { id: string; name: string | null } | null | undefined) =>
  (party?.name ? gate(can, 'USER_VIEW', userRoute(party.id)) : null)

/** Entrée ou Espace sur la ligne elle-même (pas sur un de ses liens) : ouvre la fiche. */
function onRowKey(e: KeyboardEvent, id: string) {
  if (e.target !== e.currentTarget) return
  e.preventDefault()
  emit('select', id)
}
/** Nom accessible de la ligne focalisable : ce que l'on ouvre. */
function rowLabel(p: AdminPaymentListItem): string {
  return ['Ouvrir le paiement', routeLabel(p.insight), p.trackingNumber, formatMoney(p.amountCents, p.currency)].filter(Boolean).join(' · ')
}

/** N° de suivi, sinon le colis ou le fil de négociation raccourcis (identifiant complet en infobulle). */
function trackingLabel(p: AdminPaymentListItem): { text: string; title?: string } {
  if (p.trackingNumber) return { text: p.trackingNumber }
  const bidId = p.insight?.bidId ?? p.bidId
  if (bidId) return { text: `colis ${shortId(bidId)}`, title: bidId }
  const thread = p.insight?.negotiationThreadId
  if (thread) return { text: `fil ${shortId(thread)}`, title: thread }
  return { text: '—' }
}
/** L'étiquette d'alerte HELD double le badge « Versement retenu » quand la ligne porte la retenue. */
const showAlert = (p: AdminPaymentListItem) => !(p.alert === 'HELD' && isPaymentHeld(p))

const link = 'rounded-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table class="w-full min-w-[960px]">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">À faire</th>
          <th class="px-4 py-2 font-medium">Colis</th>
          <th class="px-4 py-2 font-medium">Expéditeur → Voyageur</th>
          <th class="px-4 py-2 font-medium text-right">Montant</th>
          <th class="px-4 py-2 font-medium">Méthode</th>
          <th class="px-4 py-2 font-medium">Depuis</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="p in payments" :key="p.id" :data-test="`payment-row-${p.id}`"
          tabindex="0" :aria-label="rowLabel(p)"
          :class="['cursor-pointer border-b border-border align-top transition-colors hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary', p.alert === 'HELD' ? 'bg-danger/5' : '']"
          @click="emit('select', p.id)" @keydown.enter="onRowKey($event, p.id)" @keydown.space="onRowKey($event, p.id)"
        >
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-1">
              <StatusBadge v-bind="paymentStatusMeta(p.status)" />
              <StatusBadge v-if="isPaymentHeld(p)" :data-test="`payment-held-${p.id}`" label="Versement retenu" tone="danger" />
              <PaymentAlertBadge v-if="showAlert(p)" :code="p.alert" short />
              <StatusBadge v-if="p.insight?.abandoned" :data-test="`payment-abandoned-${p.id}`" label="Checkout abandonné" tone="neutral" />
            </div>
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="flex flex-wrap items-center gap-1.5">
              <NuxtLink
                v-if="bidLink(p) && routeLabel(p.insight)" :to="bidLink(p)!" :data-test="`payment-route-${p.id}`"
                :class="[link, 'font-medium']" @click.stop
              >{{ routeLabel(p.insight) }}</NuxtLink>
              <span v-else :data-test="`payment-route-${p.id}`" class="font-medium">{{ routeLabel(p.insight) ?? '—' }}</span>
              <StatusBadge :label="paymentKindLabel(p.insight?.kind)" :tone="p.insight?.kind === 'NEGOTIATION' ? 'warning' : 'neutral'" />
            </div>
            <NuxtLink
              v-if="bidLink(p)" :to="bidLink(p)!" :data-test="`payment-tracking-${p.id}`" :title="trackingLabel(p).title"
              :class="[link, 'mt-0.5 inline-block font-mono text-xs']" @click.stop
            >{{ trackingLabel(p).text }}</NuxtLink>
            <p v-else :data-test="`payment-tracking-${p.id}`" :title="trackingLabel(p).title" class="mt-0.5 font-mono text-xs text-text-muted">{{ trackingLabel(p).text }}</p>
          </td>
          <td class="px-4 py-3 text-sm">
            <NuxtLink
              v-if="userLink(p.insight?.sender)" :to="userLink(p.insight?.sender)!" :data-test="`payment-sender-${p.id}`"
              :class="link" @click.stop
            >{{ p.insight?.sender?.name }}</NuxtLink>
            <span v-else :data-test="`payment-sender-${p.id}`">{{ p.insight?.sender?.name ?? '—' }}</span>
            <span class="text-text-muted" aria-hidden="true"> → </span>
            <NuxtLink
              v-if="userLink(p.insight?.traveler)" :to="userLink(p.insight?.traveler)!" :data-test="`payment-traveler-${p.id}`"
              :class="link" @click.stop
            >{{ p.insight?.traveler?.name }}</NuxtLink>
            <span v-else :data-test="`payment-traveler-${p.id}`">{{ p.insight?.traveler?.name ?? '—' }}</span>
          </td>
          <td class="px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap">
            <div class="font-semibold" :data-test="`payment-amount-${p.id}`">{{ formatMoney(p.amountCents, p.currency) }}</div>
            <div class="text-xs text-text-muted" :data-test="`payment-split-${p.id}`">
              <template v-if="p.insight">net voyageur {{ formatMoney(p.insight.netTravelerCents, p.currency) }} · </template>commission {{ formatMoney(p.commissionCents, p.currency) }}
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ paymentMethodLabel(p.method) }}</td>
          <td class="px-4 py-3 text-sm tabular-nums whitespace-nowrap" :data-test="`payment-age-${p.id}`">
            <template v-if="paymentAge(p.createdAt)">
              <div>{{ paymentAge(p.createdAt)!.relative }}</div>
              <div class="text-xs text-text-muted">{{ paymentAge(p.createdAt)!.day }}</div>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="payments.length === 0" :empty-label="emptyLabel" />
  </div>
</template>
