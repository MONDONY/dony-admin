<script setup lang="ts">
import { computed } from 'vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import { ALL_TABS, SECTIONS, SUB_TABS, defaultTabOfSection, type TransactionSection, type TransactionTab } from '@/features/transactions/lib/sections'
import type { FinanceCounts } from '@/features/transactions/types'

/**
 * Quatre sections à pastilles rouges (sous-onglets pour Mobile money et Soldes). Sans nombres
 * (ancien back, ou pas encore reçus) : les sept onglets plats d'avant, rien d'inventé. Émet
 * toujours l'identifiant historique `?tab=`.
 */
const props = defineProps<{ section: TransactionSection; sub: TransactionTab; counts: FinanceCounts | null }>()
const emit = defineEmits<{ 'update:tab': [tab: TransactionTab] }>()

const BADGE: Record<TransactionSection, 'payments' | 'mobileMoney' | 'soldes' | 'chargebacks'> = {
  payments: 'payments', 'mobile-money': 'mobileMoney', wallets: 'soldes', chargebacks: 'chargebacks',
}
const sectionTabs = computed<TabItem<TransactionSection>[]>(() => SECTIONS.map(s => ({
  id: s.id, label: s.label, count: props.counts?.[BADGE[s.id]], alert: true,
})))
const subTabs = computed<TabItem<TransactionTab>[]>(() => SUB_TABS[props.section] ?? [])
const subLabel = computed(() => `Listes de la section ${SECTIONS.find(s => s.id === props.section)?.label ?? ''}`)
</script>

<template>
  <TabBar
    v-if="!counts" :tabs="ALL_TABS" :model-value="sub" aria-label="Sections des transactions"
    @update:model-value="emit('update:tab', $event)"
  />
  <div v-else class="space-y-2">
    <TabBar
      :tabs="sectionTabs" :model-value="section" test-prefix="section" aria-label="Sections des transactions"
      @update:model-value="emit('update:tab', defaultTabOfSection($event))"
    />
    <TabBar
      v-if="subTabs.length" variant="underline" :tabs="subTabs" :model-value="sub" test-prefix="sub" :aria-label="subLabel"
      @update:model-value="emit('update:tab', $event)"
    />
  </div>
</template>
