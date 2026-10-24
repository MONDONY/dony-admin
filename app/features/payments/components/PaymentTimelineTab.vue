<script setup lang="ts">
import { computed } from 'vue'
import PaymentTimeline from './PaymentTimeline.vue'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { paymentLinks } from '@/features/payments/lib/paymentLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Onglet Chronologie : dates du paiement et journal d'audit, puis « Voir tout le journal » (page
 * Audit filtrée sur ce paiement, AUDIT_VIEW ; sans le droit, la chronologie du tiroir seulement).
 */
const props = defineProps<{ payment: AdminPaymentDetail }>()
const auth = useAuthStore()
const audit = computed(() => paymentLinks(props.payment, p => auth.can(p)).audit)
</script>

<template>
  <div class="flex flex-col gap-3">
    <PaymentTimeline :payment-id="payment.id" />
    <NuxtLink
      v-if="audit" :to="audit" data-test="payment-audit-link"
      class="inline-flex min-h-10 items-center self-start rounded-btn px-2 text-sm font-medium text-primary underline-offset-2 transition-[background-color,transform] hover:bg-primary/10 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
    >Voir tout le journal</NuxtLink>
  </div>
</template>
