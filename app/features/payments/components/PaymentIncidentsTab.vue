<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { isPaymentHeld } from '@/features/payments/types/index'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { paymentLinks } from '@/features/payments/lib/paymentLinks'
import { chargebackStatusMeta } from '@/features/payments/lib/paymentLabels'
import { disputeStatusLabel } from '@/features/bids/lib/bidLabels'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import { alertSeverityMeta } from '@/features/alerts/components/alertSeverity'
import type { AlertSeverity } from '@/features/alerts/types/index'
import { parseServerDate } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * Onglet Incidents : un bloc par incident dont le back donne la donnée, dans l'ordre d'urgence
 * (retenue, litige bancaire, litige du colis, absence, alertes ouvertes), chaque information qui
 * vit ailleurs en lien vers l'élément précis, derrière la permission de sa destination. Sans le
 * droit ou sans identifiant, le texte reste et le lien n'existe pas. Puis les raccourcis : support
 * des deux parties, conversation, incidents du colis. Ancien back : l'encart de retenue et le
 * litige bancaire d'avant, rien d'autre.
 */
const props = defineProps<{ payment: AdminPaymentDetail }>()
const auth = useAuthStore()
const links = computed(() => paymentLinks(props.payment, p => auth.can(p)))

const held = computed(() => isPaymentHeld(props.payment))
const holdWho = computed(() => {
  if (props.payment.beneficiaryHoldReason === 'BANNED') return 'Le voyageur a été banni.'
  if (props.payment.beneficiaryHoldReason === 'KYC_REVOKED') return 'L’identité du voyageur a été révoquée.'
  return 'Le voyageur est bloqué.'
})
/** Lien de l'encart : l'onglet de la fiche qui explique la cause, à défaut la fiche du voyageur. */
const holdLink = computed(() => {
  if (links.value.holdCause) {
    const tab = props.payment.beneficiaryHoldReason === 'BANNED' ? 'Gestion' : 'Identité'
    return { to: links.value.holdCause, label: `Voir pourquoi : fiche du voyageur, onglet ${tab}` }
  }
  return links.value.traveler ? { to: links.value.traveler, label: 'Voir la fiche du voyageur' } : null
})
const day = (at: string | null | undefined) => {
  const ms = parseServerDate(at)
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString('fr-FR')
}
const heldSince = computed(() => day(props.payment.payoutHeldAt))

const chargeback = computed(() => props.payment.chargeback ?? null)
const showChargeback = computed(() => props.payment.disputed || chargeback.value !== null)
const disputeStatus = computed(() => props.payment.links?.disputeStatus ?? null)
const showDispute = computed(() => Boolean(props.payment.links?.disputeId || disputeStatus.value))
const showNoShow = computed(() => Boolean(props.payment.links?.cancellationId))
/** Une ligne par alerte ouverte, avec son lien quand la page Alertes est accessible. */
const alerts = computed(() => (props.payment.openAlerts ?? []).map(a => ({
  ...a,
  title: alertGuide(a.type).title,
  severity: alertSeverityMeta(a.severity as AlertSeverity) ?? { label: a.severity, tone: 'neutral' as const },
  to: links.value.alerts.find(l => l.id === a.id)?.to ?? null,
})))

const anyIncident = computed(() => held.value || showChargeback.value || showDispute.value || showNoShow.value || alerts.value.length > 0)
const shortcuts = computed(() => [
  { key: 'sender-support', label: 'Support de l’expéditeur', to: links.value.senderSupport },
  { key: 'traveler-support', label: 'Support du voyageur', to: links.value.travelerSupport },
  { key: 'conversation', label: 'Conversation en modération', to: links.value.conversation },
  { key: 'bid-incidents', label: 'Incidents du colis', to: links.value.bidIncidents },
].filter(s => s.to !== null))

const card = 'rounded-card border p-4 text-sm'
const linkClass = 'inline-flex min-h-10 items-center rounded-btn px-2 -mx-2 text-sm font-medium text-primary underline-offset-2 transition-[background-color,transform] hover:bg-primary/10 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100'
</script>

<template>
  <div class="flex flex-col gap-3">
    <section v-if="held" data-incident="hold" data-test="payment-hold-notice" :class="[card, 'border-danger/30 bg-danger/5']">
      <h3 class="font-semibold text-danger">Versement retenu</h3>
      <p class="mt-1 text-pretty">
        {{ holdWho }}
        <span v-if="heldSince" data-test="payment-hold-since">Retenu depuis le <span class="tabular-nums">{{ heldSince }}</span>.</span>
      </p>
      <p class="mt-1 text-text-muted text-pretty">
        L’argent reste chez Yadony et ne repartira pas tout seul. Remboursez l’expéditeur, ou payez le voyageur par une dérogation motivée.
      </p>
      <NuxtLink v-if="holdLink" :to="holdLink.to" data-test="payment-hold-traveler-link" :class="[linkClass, 'mt-2']">{{ holdLink.label }}</NuxtLink>
    </section>

    <section v-if="showChargeback" data-incident="chargeback" data-test="payment-disputed" :class="[card, 'border-danger/30 bg-danger/5']">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="font-semibold text-balance">Litige bancaire</h3>
        <StatusBadge v-if="chargeback" data-test="payment-chargeback-status" v-bind="chargebackStatusMeta(chargeback.status)" />
      </div>
      <p v-if="!chargeback || chargeback.status === 'OPEN'" class="mt-1 text-pretty">
        Le porteur de la carte conteste ce paiement auprès de sa banque.
      </p>
      <dl v-if="chargeback" class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div v-if="chargeback.reason"><dt class="text-text-muted">Motif</dt><dd class="break-words">{{ chargeback.reason }}</dd></div>
        <div v-if="day(chargeback.openedAt)"><dt class="text-text-muted">Ouvert le</dt><dd class="tabular-nums">{{ day(chargeback.openedAt) }}</dd></div>
        <div v-if="chargeback.outcome" class="sm:col-span-2"><dt class="text-text-muted">Issue</dt><dd class="break-words">{{ chargeback.outcome }}</dd></div>
      </dl>
      <NuxtLink v-if="links.chargeback" :to="links.chargeback" data-test="payment-chargeback-link" :class="[linkClass, 'mt-2']">Ouvrir dans Litiges bancaires</NuxtLink>
    </section>

    <section v-if="showDispute" data-incident="dispute" data-test="payment-dispute" :class="[card, 'border-border bg-surface']">
      <h3 class="font-semibold text-balance">Litige ouvert sur le colis</h3>
      <p v-if="disputeStatus" class="mt-1">Statut du litige : {{ disputeStatusLabel(disputeStatus) }}</p>
      <NuxtLink v-if="links.dispute" :to="links.dispute" data-test="payment-dispute-link" :class="[linkClass, 'mt-2']">Ouvrir le litige</NuxtLink>
    </section>

    <section v-if="showNoShow" data-incident="noshow" data-test="payment-noshow" :class="[card, 'border-border bg-surface']">
      <h3 class="font-semibold text-balance">Absence signalée sur le colis</h3>
      <NuxtLink v-if="links.noShow" :to="links.noShow" data-test="payment-noshow-link" :class="[linkClass, 'mt-2']">Ouvrir l’absence</NuxtLink>
    </section>

    <section v-if="alerts.length" data-incident="alerts" data-test="payment-open-alerts" :class="[card, 'border-border bg-surface']">
      <h3 class="font-semibold text-balance">Alertes ouvertes <span class="tabular-nums text-text-muted">({{ alerts.length }})</span></h3>
      <ul class="mt-1 divide-y divide-border">
        <li v-for="a in alerts" :key="a.id" :data-test="`payment-open-alert-${a.id}`" class="flex flex-wrap items-center justify-between gap-2 py-1">
          <span class="flex min-w-0 flex-wrap items-center gap-2">
            <StatusBadge v-bind="a.severity" />
            <span class="break-words">{{ a.title }}</span>
          </span>
          <NuxtLink v-if="a.to" :to="a.to" :data-test="`payment-open-alert-link-${a.id}`" :class="linkClass">Ouvrir l’alerte</NuxtLink>
        </li>
      </ul>
    </section>

    <p v-if="!anyIncident" data-test="payment-no-incident" class="rounded-card bg-surface-elevated px-4 py-3 text-sm text-text-muted">Aucun incident sur ce paiement.</p>

    <nav v-if="shortcuts.length" data-test="payment-incident-shortcuts" aria-label="Raccourcis" class="flex flex-wrap gap-x-4">
      <NuxtLink v-for="s in shortcuts" :key="s.key" :to="s.to!" :data-test="`payment-${s.key}-link`" :class="linkClass">{{ s.label }}</NuxtLink>
    </nav>
  </div>
</template>
