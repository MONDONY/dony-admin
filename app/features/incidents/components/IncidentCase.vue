<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportTimeline from '@/features/signalements/components/ReportTimeline.vue'
import { formatAmount } from '@/features/finance/types/index'
import {
  amountLabel, bidStatusLabel, decisionSummary, disputeLinkLabel, disputePending, formatDateTime, noShowSentence, noShowStatusMeta,
  partyLabel, partyRoleLabel, paymentStatusLabel, remainingMeta, scopeMeta, shortId, tripLabel,
} from './noShowLabels'
import {
  disputeResolutionLabel, disputeSentence, incidentAge, incidentStatusMeta, type Incident,
} from '@/features/incidents/lib/incidentWorkbench'
import type { TimelineItem } from '@/features/signalements/reportContext'
import type { AdminDisputeDetail } from '@/features/incidents/types/index'
import { useAuthStore } from '@/stores/auth'
import { bidRoute, gate, paymentsOfBidRoute, toHref, userRoute } from '@/lib/adminLinks'
import { serverDateIso } from '@/lib/serverDate'

/**
 * Dossier d'un incident, au centre du poste : ce qui s'est passé, les parties, le colis et son
 * paiement, la chronologie. Un litige complète la ligne de la file par sa fiche détaillée.
 */
const props = withDefaults(defineProps<{
  incident: Incident | null
  /** Fiche détaillée du litige affiché ; null tant qu'elle charge. */
  detail?: AdminDisputeDetail | null
  detailLoading?: boolean
  detailError?: string | null
  now?: number
}>(), { detail: null, detailLoading: false, detailError: null, now: undefined })
const emit = defineEmits<{ openIncident: [key: string] }>()

const auth = useAuthStore()
const dispute = computed(() => props.incident?.dispute ?? null)
const row = computed(() => props.incident?.noshow ?? null)
/** La fiche n'est celle du litige affiché que si les identifiants coïncident (changement de sélection en cours). */
const fiche = computed(() => (props.detail && props.detail.id === dispute.value?.id ? props.detail : null))
const age = computed(() => (props.incident ? incidentAge(props.incident, props.now) : null))
const AGE_TONE = { neutral: 'text-text-muted', warning: 'text-warning', danger: 'text-danger' } as const

const hrefOf = (route: ReturnType<typeof bidRoute>) => (route ? toHref(route) : null)
const bidHref = computed(() => (props.incident ? hrefOf(gate(auth.can, 'BID_VIEW', bidRoute(props.incident.bidId))) : null))
const paymentsHref = computed(() => (props.incident ? hrefOf(gate(auth.can, 'PAYMENT_VIEW', paymentsOfBidRoute(props.incident.bidId))) : null))
const userHref = (id: string | null | undefined) => hrefOf(gate(auth.can, 'USER_VIEW', userRoute(id)))

const sentence = computed(() => (dispute.value ? disputeSentence(dispute.value) : row.value ? noShowSentence(row.value) : ''))
const created = computed(() => formatDateTime(props.incident?.createdAt ? serverDateIso(props.incident.createdAt) : null))

const parties = computed(() => {
  if (dispute.value) {
    return [
      { key: 'sender', role: 'Expéditeur', name: dispute.value.senderName ?? 'Nom inconnu', href: userHref(fiche.value?.senderId) },
      { key: 'traveler', role: 'Voyageur', name: dispute.value.travelerName ?? 'Nom inconnu', href: userHref(fiche.value?.travelerId) },
    ]
  }
  const r = row.value
  if (!r) return []
  return ([['declarant', 'Déclare l’absence', r.declarant], ['accused', 'Déclaré absent', r.accused]] as const)
    .filter(([, , p]) => !!p)
    .map(([key, title, p]) => ({ key, role: `${title} · ${partyRoleLabel(p!.role)}`, name: partyLabel(p!), href: userHref(p!.userId) }))
})

const facts = computed<{ key: string; label: string; value: string | null; urgent?: boolean }[]>(() => {
  const r = row.value
  if (r) {
    const left = remainingMeta(r, props.now ?? Date.now())
    const deadline = formatDateTime(r.contestationDeadline)
    const answer = left ? `${left.label}${deadline ? ` (jusqu’au ${deadline})` : ''}` : deadline
    return [
      { key: 'created', label: 'Déclarée le', value: formatDateTime(r.createdAt) },
      { key: 'answer', label: 'Réponse attendue', value: answer, urgent: left?.urgent ?? false },
      { key: 'trip', label: 'Trajet', value: tripLabel(r.trip) },
      { key: 'handover', label: 'Remise prévue', value: formatDateTime(r.handoverAt) },
      { key: 'amount', label: 'Montant et paiement', value: amountLabel(r) },
      // Remise en espèces : le back place l'état de la commission dans paymentStatus, déjà dit par le montant.
      { key: 'payment', label: 'État du paiement', value: r.commissionStatus && r.paymentStatus === r.commissionStatus ? null : paymentStatusLabel(r.paymentStatus) },
      { key: 'bid', label: 'Statut du colis', value: bidStatusLabel(r.bidStatus) },
    ].filter((f) => !!f.value)
  }
  const d = fiche.value
  if (!d) return []
  return [
    { key: 'currency', label: 'Devise du colis', value: d.bidCurrency ?? '—' },
    { key: 'frozen', label: 'Remboursement gelé', value: d.refundFrozen ? 'Oui' : 'Non' },
    { key: 'resolution', label: 'Résolution', value: disputeResolutionLabel(d.resolution) },
    {
      key: 'guarantee', label: 'Fonds de garantie versé',
      value: d.guaranteeAmountCents != null ? formatAmount(d.guaranteeAmountCents, d.guaranteeCurrency ?? d.bidCurrency ?? '') : null,
    },
  ].filter((f) => !!f.value)
})

const splitStatusLabel: Record<string, string> = {
  CLAIMED: 'Décidé, rien encore exécuté chez Stripe',
  SENDER_REFUNDED: 'Expéditeur remboursé, versement voyageur à reprendre',
  COMPLETED: 'Exécuté',
}

const timeline = computed<TimelineItem[]>(() => {
  const i = props.incident
  if (!i) return []
  const items: TimelineItem[] = []
  if (i.dispute) {
    items.push({ key: 'opened', label: 'Litige ouvert', at: serverDateIso(i.createdAt), by: null, note: null })
    const d = fiche.value
    if (d?.resolvedAt) items.push({ key: 'resolved', label: disputeResolutionLabel(d.resolution) ?? 'Litige résolu', at: d.resolvedAt, by: null, note: d.resolutionNote })
  } else if (i.noshow) {
    const r = i.noshow
    items.push({ key: 'declared', label: 'Absence déclarée', at: serverDateIso(r.createdAt), by: null, note: null })
    if (r.adminDecision) items.push({ key: 'decided', label: noShowStatusMeta(r.status, r.adminDecision).label, at: r.decidedAt, by: null, note: r.decisionReason })
  }
  return items
})
</script>

<template>
  <section aria-label="Dossier" data-test="incident-case" class="flex flex-col gap-4">
    <p
      v-if="!incident" data-test="incident-case-empty"
      class="rounded-card border border-border bg-surface px-4 py-6 text-sm text-text-muted text-pretty"
    >Sélectionne un incident dans la file pour voir son dossier.</p>

    <template v-else>
      <!-- En-tête -->
      <div class="rounded-card border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge v-if="row?.scope" v-bind="scopeMeta(row.scope)" />
          <StatusBadge v-bind="incidentStatusMeta(incident)" />
          <span v-if="age" data-test="incident-age" :class="['text-xs font-medium tabular-nums', AGE_TONE[age.tone]]">{{ age.label }}</span>
          <StatusBadge v-if="dispute?.refundFrozen" label="Remboursement gelé" tone="warning" />
          <span v-if="created" class="ml-auto text-xs text-text-muted tabular-nums">{{ incident.kind === 'DISPUTE' ? 'Ouvert' : 'Déclaré' }} le {{ created }}</span>
        </div>
        <h2 class="mt-3 font-display text-xl font-bold text-balance" data-test="incident-title">{{ incident.title }}</h2>
        <p class="mt-1 text-sm text-text-muted text-pretty" data-test="incident-sentence">{{ sentence }}</p>
        <p
          v-if="row?.legacy" data-test="noshow-legacy-note"
          class="mt-3 rounded-xs bg-surface-elevated px-3 py-2 text-xs text-text-muted text-pretty"
        >Serveur pas encore à jour : informations réduites, seule l’absence de l’expéditeur au départ peut être confirmée.</p>
        <p
          v-if="detailError" data-test="incident-detail-error" role="alert"
          class="mt-3 rounded-xs border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
        >{{ detailError }}</p>
        <p v-else-if="dispute && detailLoading" data-test="incident-detail-loading" class="mt-3 text-xs text-text-muted">Chargement du dossier…</p>
      </div>

      <!-- Parties -->
      <div v-if="parties.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-test="incident-parties">
        <div v-for="p in parties" :key="p.key" class="rounded-card border border-border bg-surface p-4" :data-test="`incident-party-${p.key}`">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">{{ p.role }}</p>
          <p class="mt-1 truncate text-base font-semibold">{{ p.name }}</p>
          <NuxtLink v-if="p.href" :to="p.href" :data-test="`incident-party-link-${p.key}`" class="mt-1 inline-block text-sm text-primary hover:underline">Voir la fiche</NuxtLink>
        </div>
      </div>

      <!-- Colis et paiement -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Colis et paiement</h3>
        <dl v-if="facts.length" class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div v-for="f in facts" :key="f.key" :data-test="`incident-fact-${f.key}`">
            <dt class="text-xs text-text-muted">{{ f.label }}</dt>
            <dd :class="['tabular-nums', f.urgent ? 'font-medium text-danger' : 'font-medium']">{{ f.value }}</dd>
          </div>
        </dl>
        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
          <NuxtLink v-if="bidHref" :to="bidHref" data-test="incident-bid-link" class="text-primary hover:underline">Ouvrir le colis {{ shortId(incident.bidId) }}</NuxtLink>
          <span v-else data-test="incident-bid-text" class="text-text-muted">Colis {{ shortId(incident.bidId) }}</span>
          <NuxtLink v-if="paymentsHref" :to="paymentsHref" data-test="incident-payment-link" class="text-primary hover:underline">Voir le paiement de ce colis</NuxtLink>
          <button
            v-if="row?.dispute" type="button" data-test="incident-dispute-link"
            class="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/25"
            @click="emit('openIncident', `dispute:${row.dispute.id}`)"
          >{{ disputeLinkLabel(row.dispute) }} : l’ouvrir</button>
          <span
            v-else-if="row && disputePending(row)" data-test="incident-dispute-pending"
            class="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
          >Un litige va être ouvert</span>
        </div>
      </div>

      <!-- Partage du séquestre -->
      <section v-if="fiche?.split" class="rounded-card border border-border bg-surface p-5 text-sm" data-test="split-result">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Partage du séquestre</h3>
        <p class="tabular-nums">Expéditeur : {{ fiche.split.senderRefundAmount }} {{ fiche.split.currency }} · Voyageur : {{ fiche.split.travelerPayoutAmount }} {{ fiche.split.currency }}</p>
        <p class="mt-1" data-test="split-status">{{ splitStatusLabel[fiche.split.status] ?? fiche.split.status }}</p>
        <p v-if="fiche.split.lastError && fiche.split.status !== 'COMPLETED'" class="mt-1 text-xs text-danger" data-test="split-error">
          {{ fiche.split.lastError }} ({{ fiche.split.attempts }} tentative(s))
        </p>
      </section>

      <!-- Décision déjà prise (absence) -->
      <div
        v-if="row && decisionSummary(row)" data-test="noshow-decision"
        class="rounded-card border border-border bg-surface px-5 py-3 text-sm"
      >
        <p class="font-medium">Décision : {{ decisionSummary(row) }}</p>
        <p v-if="row.decisionReason" class="mt-1 text-text-muted text-pretty">
          <span class="text-xs">Motif interne, non transmis aux parties :</span>
          <span data-test="noshow-decision-reason" class="block text-text">{{ row.decisionReason }}</span>
        </p>
      </div>

      <!-- Historique -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Historique</h3>
        <ReportTimeline :items="timeline" />
      </div>
    </template>
  </section>
</template>
