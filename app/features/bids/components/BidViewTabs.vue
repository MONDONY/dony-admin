<script setup lang="ts">
import { computed } from 'vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import { BID_VIEWS } from '@/features/bids/lib/bidViews'
import type { AdminBidCounts, BidView } from '@/features/bids/types/index'

const props = defineProps<{ modelValue: BidView; counts: AdminBidCounts | null }>()
const emit = defineEmits<{ 'update:modelValue': [BidView] }>()

const tabs = computed<TabItem<BidView>[]>(() => BID_VIEWS.map(v => ({
  id: v.id,
  label: v.label,
  count: props.counts ? props.counts[v.countKey] as number : undefined,
  // « À traiter » : rouge quand il reste du travail, et le 0 reste visible.
  alert: v.id === 'TODO' && (props.counts?.todo ?? 0) > 0,
  showZero: v.id === 'TODO',
})))
</script>

<template>
  <div>
    <TabBar
      variant="underline" test-prefix="bid-view" id-prefix="bid-view" aria-label="Vues des colis"
      :tabs="tabs" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="counts" data-test="bid-view-help" class="mt-2 text-xs text-text-muted">
      Les nombres d’« À traiter » se recoupent avec les autres vues.
    </p>
  </div>
</template>
