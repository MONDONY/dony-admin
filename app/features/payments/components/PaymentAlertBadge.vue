<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { paymentAlertMeta } from '@/features/payments/lib/paymentViews'

// `short` : étiquette de ligne de tableau ; sinon libellé complet (tiroir). Code inconnu : rien.
const props = defineProps<{ code?: string | null; short?: boolean }>()
const meta = computed(() => paymentAlertMeta(props.code))
</script>

<template>
  <StatusBadge v-if="meta" data-test="payment-alert" :label="short ? meta.shortLabel : meta.label" :tone="meta.tone" />
</template>
