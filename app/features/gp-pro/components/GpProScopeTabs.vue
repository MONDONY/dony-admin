<script setup lang="ts">
import type { GpProScope } from '@/features/gp-pro/lib/gpProWorkbench'

/** Bascule entre les demandes et les titulaires à revoir, avec le nombre de chaque file. */
defineProps<{ scope: GpProScope; applications: number; review: number }>()
const emit = defineEmits<{ select: [scope: GpProScope] }>()

const chip = (on: boolean) => ['rounded-full px-3 py-1 text-sm transition-colors',
  on ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']
</script>

<template>
  <div class="flex flex-wrap gap-1" role="tablist" aria-label="File GP Pro">
    <button
      type="button" role="tab" data-test="gp-pro-tab-demandes" :aria-selected="scope === 'demandes'"
      :class="chip(scope === 'demandes')" @click="emit('select', 'demandes')"
    >Demandes <span class="tabular-nums opacity-80">{{ applications }}</span></button>
    <button
      type="button" role="tab" data-test="gp-pro-tab-revue" :aria-selected="scope === 'revue'"
      :class="chip(scope === 'revue')" @click="emit('select', 'revue')"
    >À revoir <span class="tabular-nums opacity-80">{{ review }}</span></button>
  </div>
</template>
