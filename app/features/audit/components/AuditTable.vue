<script setup lang="ts">
import { ref } from 'vue'
import type { AdminAuditEntry } from '@/features/audit/types/index'
defineProps<{ entries: AdminAuditEntry[]; loading: boolean }>()
const expanded = ref<Set<string>>(new Set())
function toggle(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
function pretty(p: Record<string, unknown> | null) { return JSON.stringify(p, null, 2) }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Action</th>
          <th class="px-4 py-2 font-medium">Entité</th>
          <th class="px-4 py-2 font-medium">Acteur</th>
          <th class="px-4 py-2 font-medium">IP</th>
          <th class="px-4 py-2 font-medium">Date</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="e in entries" :key="e.id">
          <tr :data-test="`audit-row-${e.id}`" class="border-b border-border">
            <td class="px-4 py-3 text-sm font-medium tabular-nums">{{ e.action }}</td>
            <td class="px-4 py-3 text-sm text-text-muted">{{ e.entityType }}<span v-if="e.entityId" class="text-text-muted/70"> · {{ e.entityId }}</span></td>
            <td class="px-4 py-3 text-sm text-text-muted">{{ e.actorName ?? e.actorId ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ e.ipAddress ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(e.createdAt) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="e.payload" type="button" :data-test="`toggle-${e.id}`"
                class="rounded-btn px-3 py-1.5 text-sm bg-surface-elevated text-text-muted hover:text-text"
                @click="toggle(e.id)"
              >{{ expanded.has(e.id) ? 'Masquer' : 'Détails' }}</button>
            </td>
          </tr>
          <tr v-if="e.payload && expanded.has(e.id)" :key="`${e.id}-payload`" class="border-b border-border bg-bg">
            <td colspan="6" class="px-4 py-3">
              <pre :data-test="`payload-${e.id}`" class="text-xs text-text-muted overflow-x-auto whitespace-pre-wrap">{{ pretty(e.payload) }}</pre>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="entries.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune entrée</p>
  </div>
</template>
