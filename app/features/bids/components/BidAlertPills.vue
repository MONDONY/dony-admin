<script setup lang="ts">
import { computed } from 'vue'
import { BID_ALERTS } from '@/features/bids/lib/bidViews'
import type { AdminBidCounts, BidAlertCode } from '@/features/bids/types/index'

const props = defineProps<{ modelValue: BidAlertCode | null; alerts: AdminBidCounts['alerts'] | null }>()
const emit = defineEmits<{ 'update:modelValue': [BidAlertCode | null] }>()

const COUNT_KEY: Record<BidAlertCode, keyof AdminBidCounts['alerts']> = {
  DISPUTE_OPEN: 'disputeOpen', NO_SHOW: 'noShow', PAYMENT_PENDING: 'paymentPending', LATE: 'late',
}
const pills = computed(() => (Object.keys(BID_ALERTS) as BidAlertCode[]).map(code => ({
  code, label: BID_ALERTS[code].label, tone: BID_ALERTS[code].tone, count: props.alerts?.[COUNT_KEY[code]] ?? 0,
})))

function toggle(code: BidAlertCode) {
  emit('update:modelValue', props.modelValue === code ? null : code)
}
</script>

<template>
  <div v-if="alerts" class="flex flex-wrap items-center gap-2" role="group" aria-label="Alertes">
    <button
      v-for="p in pills" :key="p.code" type="button" :data-test="`alert-pill-${p.code}`" :aria-pressed="modelValue === p.code"
      :class="['inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition-[background-color,color,transform] active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
        modelValue === p.code
          ? (p.tone === 'danger' ? 'border-danger bg-danger/15 text-danger' : 'border-warning bg-warning/15 text-warning')
          : 'border-border bg-surface text-text-muted hover:text-text hover:bg-surface-elevated']"
      @click="toggle(p.code)"
    >
      <span>{{ p.label }}</span>
      <span :class="['rounded-full px-1.5 text-xs tabular-nums', p.count > 0 ? (p.tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning') : 'bg-black/10']">{{ p.count }}</span>
    </button>
  </div>
</template>
