<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminRating } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'
defineProps<{ ratings: AdminRating[]; loading: boolean }>()
const emit = defineEmits<{ exclude: [id: string]; remove: [id: string] }>()
const auth = useAuthStore()
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
function stars(n: number) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)) }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Note</th>
          <th class="px-4 py-2 font-medium">Commentaire</th>
          <th class="px-4 py-2 font-medium">Auteur → Évalué</th>
          <th class="px-4 py-2 font-medium">Créé</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in ratings" :key="r.id" :data-test="`rating-row-${r.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm">
            <span class="text-warning tabular-nums" :title="`${r.score}/5`">{{ stars(r.score) }}</span>
            <span v-if="r.flagged" :data-test="`flagged-${r.id}`" class="ml-2 align-middle">
              <StatusBadge label="Signalé" tone="danger" />
            </span>
          </td>
          <td class="px-4 py-3 text-sm">
            <span :class="r.excluded ? 'line-through text-text-muted' : ''">{{ r.comment ?? '—' }}</span>
            <div v-if="r.excluded" class="text-xs text-danger">Exclu{{ r.excludedReason ? ` — ${r.excludedReason}` : '' }}</div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ r.raterName ?? '—' }} → {{ r.ratedName ?? '—' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(r.createdAt) }}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
              v-if="!r.excluded && auth.can('RATING_MODERATE')" type="button" :data-test="`exclude-${r.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-warning/15 text-warning hover:bg-warning/25"
              @click="emit('exclude', r.id)"
            >Exclure</button>
            <button
              v-if="auth.can('RATING_MODERATE')"
              type="button" :data-test="`remove-${r.id}`"
              class="ml-2 rounded-btn px-3 py-1.5 text-sm bg-danger/15 text-danger hover:bg-danger/25"
              @click="emit('remove', r.id)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="ratings.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun avis</p>
  </div>
</template>
