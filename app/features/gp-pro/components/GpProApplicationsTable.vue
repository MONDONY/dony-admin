<script setup lang="ts">
import { fmtDate, frequencyLabel, sourceLabel } from '@/features/gp-pro/types/index'
import type { AdminGpProApplicationRow } from '@/features/gp-pro/types/index'

defineProps<{ items: AdminGpProApplicationRow[]; loading: boolean }>()
const emit = defineEmits<{ select: [applicationId: string] }>()

// Les justificatifs sont facultatifs : leur absence s'affiche en gris, jamais comme un manque.
function docsLabel(n: number | undefined) {
  if (!n) return 'Aucun'
  return `${n} joint${n > 1 ? 's' : ''}`
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Demandeur</th>
          <th class="px-4 py-2 font-medium">Fréquence</th>
          <th class="px-4 py-2 font-medium">Origine</th>
          <th class="px-4 py-2 font-medium">Justificatifs</th>
          <th class="px-4 py-2 font-medium">Reçue le</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in items" :key="r.applicationId" :data-test="`gp-pro-row-${r.applicationId}`"
          tabindex="0" role="button" :aria-label="`Ouvrir la demande de ${r.displayName ?? r.userId}`"
          class="border-b border-border cursor-pointer transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none"
          @click="emit('select', r.applicationId)" @keydown.enter="emit('select', r.applicationId)"
        >
          <td class="px-4 py-3 text-sm font-medium">{{ r.displayName ?? 'Nom non renseigné' }}</td>
          <td class="px-4 py-3 text-sm">{{ frequencyLabel(r.travelFrequency) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ sourceLabel(r.source) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums" :data-test="`gp-pro-docs-${r.applicationId}`">{{ docsLabel(r.documentCount) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmtDate(r.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="items.length === 0" data-test="gp-pro-empty" class="p-6 text-center text-sm text-text-muted">Aucune demande à examiner</p>
  </div>
</template>
