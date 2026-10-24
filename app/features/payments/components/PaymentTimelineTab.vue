<script setup lang="ts">
import PaymentTimeline from './PaymentTimeline.vue'

/** Onglet Chronologie : la chronologie de l'ancien panneau (paiement + journal d'audit). */
defineProps<{ paymentId: string }>()
</script>

<template>
  <PaymentTimeline :payment-id="paymentId" />
</template>
