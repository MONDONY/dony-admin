<script setup lang="ts">
import type { AdminCancellation } from '@/features/incidents/types/index'
import { useAuthStore } from '@/stores/auth'

defineProps<{ cancellations: AdminCancellation[]; loading: boolean }>()
const emit = defineEmits<{ confirm: [bidId: string] }>()
const auth = useAuthStore()

function fmt(d: string | null) { return d ? new Date(d).toLocaleString('fr-FR') : '—' }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr><th class="px-4 py-2 font-medium">Bid</th><th class="px-4 py-2 font-medium">Déclaré par</th><th class="px-4 py-2 font-medium">État</th><th class="px-4 py-2 font-medium">Échéance</th><th class="px-4 py-2 font-medium"></th></tr>
      </thead>
      <tbody>
        <tr v-for="c in cancellations" :key="c.id" :data-test="`noshow-row-${c.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ c.bidId }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ c.cancelledBy }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ c.noShowStatus }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(c.contestationDeadline) }}</td>
          <td class="px-4 py-3 text-right">
            <button
              v-if="auth.can('DISPUTE_RESOLVE')"
              type="button"
              :data-test="`confirm-noshow-${c.bidId}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-warning/20 text-warning hover:bg-warning/30"
              @click="emit('confirm', c.bidId)"
            >Confirmer no-show</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="cancellations.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun no-show à arbitrer</p>
  </div>
</template>
