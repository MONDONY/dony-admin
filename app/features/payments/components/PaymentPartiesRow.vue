<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminPaymentDetail, PaymentParty } from '@/features/payments/types/index'
import { gate, userRoute } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Les deux parties du paiement : l'expéditeur qui paie, le voyageur qui reçoit. Chaque nom mène à
 * la fiche de la personne (`USER_VIEW`) ; sans le droit ou sans identifiant, il reste du texte.
 * Ancien back sans contexte : le voyageur est repris de `travelerId`.
 */
const props = defineProps<{ payment: AdminPaymentDetail }>()
const auth = useAuthStore()

const sender = computed<PaymentParty | null>(() => props.payment.insight?.sender ?? null)
const traveler = computed<PaymentParty | null>(() =>
  props.payment.insight?.traveler ?? (props.payment.travelerId ? { id: props.payment.travelerId, name: null } : null))
const link = (party: PaymentParty | null) => gate(p => auth.can(p), 'USER_VIEW', userRoute(party?.id))
const hold = computed(() => props.payment.beneficiaryHoldReason ?? null)

const cards = computed(() => [
  { role: 'sender', title: 'Expéditeur · paie', party: sender.value, to: link(sender.value) },
  { role: 'traveler', title: 'Voyageur · reçoit', party: traveler.value, to: link(traveler.value) },
])
const nameOf = (party: PaymentParty | null) => (party ? party.name ?? 'Compte sans nom' : 'Non renseigné')
</script>

<template>
  <section data-test="payment-parties" aria-labelledby="payment-parties-title">
    <h3 id="payment-parties-title" class="sr-only">Personnes</h3>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div v-for="c in cards" :key="c.role" class="rounded-card bg-surface-elevated p-3" :data-test="`party-${c.role}`">
        <p class="text-xs font-medium text-text-muted">{{ c.title }}</p>
        <div class="mt-0.5 flex flex-wrap items-center gap-2">
          <NuxtLink
            v-if="c.to" :to="c.to" :data-test="`payment-${c.role}-link`"
            class="rounded-sm font-medium text-primary break-words underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >{{ nameOf(c.party) }}</NuxtLink>
          <span v-else :class="['font-medium break-words', c.party ? '' : 'text-text-muted']">{{ nameOf(c.party) }}</span>
          <template v-if="c.role === 'traveler'">
            <StatusBadge v-if="hold === 'BANNED'" data-test="party-traveler-banned" label="Banni" tone="danger" />
            <StatusBadge v-else-if="hold === 'KYC_REVOKED'" data-test="party-traveler-kyc-revoked" label="Identité révoquée" tone="danger" />
          </template>
        </div>
        <p v-if="c.role === 'traveler' && hold" class="mt-0.5 text-xs text-text-muted">Versements gelés</p>
      </div>
    </div>
  </section>
</template>
