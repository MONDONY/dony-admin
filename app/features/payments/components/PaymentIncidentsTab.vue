<script setup lang="ts">
import { computed } from 'vue'
import { isPaymentHeld } from '@/features/payments/types/index'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

/**
 * Onglet Incidents : l'encart « Versement retenu » de l'ancien panneau, tel quel (même texte, même
 * lien vers la fiche du voyageur), et le litige bancaire signalé par le paiement. Le détail
 * (litige, dérogations accordées) vient avec la tâche suivante.
 */
const props = defineProps<{ payment: AdminPaymentDetail }>()

const held = computed(() => isPaymentHeld(props.payment))
const holdWho = computed(() => {
  if (props.payment.beneficiaryHoldReason === 'BANNED') return 'Le voyageur a été banni.'
  if (props.payment.beneficiaryHoldReason === 'KYC_REVOKED') return 'L’identité du voyageur a été révoquée.'
  return 'Le voyageur est bloqué.'
})
const heldSince = computed(() => props.payment.payoutHeldAt
  ? new Date(props.payment.payoutHeldAt).toLocaleDateString('fr-FR')
  : null)
</script>

<template>
  <div class="flex flex-col gap-4">
    <section
      v-if="held" data-test="payment-hold-notice"
      class="rounded-card border border-danger/30 bg-danger/5 p-4 text-sm"
    >
      <p class="font-semibold text-danger">Versement retenu</p>
      <p class="mt-1 text-pretty">
        {{ holdWho }}
        <span v-if="heldSince" data-test="payment-hold-since">Retenu depuis le <span class="tabular-nums">{{ heldSince }}</span>.</span>
      </p>
      <p class="mt-1 text-text-muted text-pretty">
        L’argent reste chez Yadony et ne repartira pas tout seul. Remboursez l’expéditeur, ou payez le voyageur par une dérogation motivée.
      </p>
      <NuxtLink
        v-if="payment.travelerId" data-test="payment-hold-traveler-link"
        :to="`/users?query=${payment.travelerId}&open=${payment.travelerId}`"
        class="mt-2 inline-flex min-h-10 items-center font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >Voir la fiche du voyageur</NuxtLink>
    </section>
    <p v-if="payment.disputed" data-test="payment-disputed" class="rounded-card border border-danger/30 bg-danger/5 p-4 text-sm text-pretty">
      Litige bancaire : le porteur de la carte conteste ce paiement auprès de sa banque.
    </p>
    <p v-if="!held && !payment.disputed" data-test="payment-no-incident" class="text-sm text-text-muted">Aucun incident sur ce paiement.</p>
  </div>
</template>
