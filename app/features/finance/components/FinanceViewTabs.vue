<script setup lang="ts">
import { computed } from 'vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import type { FinanceViewDef } from '@/features/finance/lib/financeViews'

/**
 * Vues d'une liste finance avec leurs nombres (onglets soulignés). Une vue d'alerte est rouge
 * quand son compteur d'alerte est > 0 et garde son 0 visible ; sans `counts` (ancien back,
 * nombres pas encore reçus) : aucun nombre, jamais de « 0 » inventé.
 */
const props = defineProps<{
  views: FinanceViewDef[]
  counts: object | null
  modelValue: string
  ariaLabel: string
  testPrefix: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const tabs = computed<TabItem<string>[]>(() => {
  const c = props.counts as Record<string, number> | null
  return props.views.map(v => ({
    id: v.id,
    label: v.label,
    count: c ? c[v.countKey] : undefined,
    alert: !!v.alert && (c?.[v.alertKey ?? v.countKey] ?? 0) > 0,
    showZero: !!v.alert,
  }))
})
</script>

<template>
  <TabBar
    variant="underline" :test-prefix="testPrefix" :id-prefix="testPrefix" :aria-label="ariaLabel"
    :tabs="tabs" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
  />
</template>
