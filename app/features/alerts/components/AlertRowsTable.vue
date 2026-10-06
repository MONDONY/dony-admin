<script setup lang="ts">
import { computed } from 'vue'
import type { entityLink } from '@/features/alerts/lib/alertCatalog'

const props = defineProps<{
  rows: Record<string, unknown>[]
  linkFor: typeof entityLink
}>()

const columns = computed(() => {
  const keys: string[] = []
  for (const row of props.rows) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k)
  return keys
})

function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border" data-test="alert-rows">
    <table class="w-full text-xs">
      <thead class="bg-surface-elevated text-left text-text-muted">
        <tr><th v-for="c in columns" :key="c" class="px-2 py-1.5 font-medium whitespace-nowrap">{{ c }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i" class="border-t border-border">
          <td v-for="c in columns" :key="c" class="px-2 py-1.5 align-top font-mono whitespace-nowrap">
            <NuxtLink
              v-if="linkFor(c, row[c])" :to="linkFor(c, row[c])!.to" :title="linkFor(c, row[c])!.label"
              class="text-primary hover:underline"
            >{{ cell(row[c]).slice(0, 8) }}…</NuxtLink>
            <span v-else :title="cell(row[c])">{{ cell(row[c]).length > 40 ? cell(row[c]).slice(0, 40) + '…' : cell(row[c]) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
