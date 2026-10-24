<script setup lang="ts">
import { computed } from 'vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import { PAYMENT_VIEWS, PAYMENT_COUNTS_OVERLAP_HINT } from '@/features/payments/lib/paymentViews'
import type { PaymentView, PaymentViewCounts } from '@/features/payments/types/index'

const props = defineProps<{ modelValue: PaymentView; counts: PaymentViewCounts | null }>()
const emit = defineEmits<{ 'update:modelValue': [PaymentView] }>()

// Sans `counts` (ancien backend) : aucun nombre, jamais de « 0 » inventé.
const tabs = computed<TabItem<PaymentView>[]>(() => PAYMENT_VIEWS.map(v => ({
  id: v.id,
  label: v.label,
  count: props.counts ? props.counts[v.countKey] as number : undefined,
  // « À traiter » : rouge quand il reste du travail, et le 0 reste visible.
  alert: v.id === 'ATTENTION' && (props.counts?.attention ?? 0) > 0,
  showZero: v.id === 'ATTENTION',
})))
</script>

<template>
  <div>
    <TabBar
      variant="underline" test-prefix="payment-view" id-prefix="payment-view" aria-label="Vues des paiements"
      :tabs="tabs" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="counts" data-test="payment-view-help" class="mt-2 text-xs text-text-muted">{{ PAYMENT_COUNTS_OVERLAP_HINT }}</p>
  </div>
</template>
