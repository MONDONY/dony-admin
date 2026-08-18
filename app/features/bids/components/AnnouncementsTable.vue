<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminAnnouncementListItem, AnnouncementStatus } from '@/features/bids/types/index'

defineProps<{ announcements: AdminAnnouncementListItem[]; loading: boolean }>()

const annTone: Record<AnnouncementStatus, 'success' | 'info' | 'neutral' | 'danger'> = {
  ACTIVE: 'success',
  FULL: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
  REMOVED_BY_ADMIN: 'danger',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR')
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Trajet</th>
          <th class="px-4 py-2 font-medium">Voyageur</th>
          <th class="px-4 py-2 font-medium">Départ</th>
          <th class="px-4 py-2 font-medium">Capacité</th>
          <th class="px-4 py-2 font-medium">Prix/kg</th>
          <th class="px-4 py-2 font-medium">Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="a in announcements"
          :key="a.id"
          :data-test="`ann-row-${a.id}`"
          class="border-b border-border"
        >
          <td class="px-4 py-3 text-sm font-medium">{{ a.corridor }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ a.travelerName ?? '—' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(a.departureDate) }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ a.availableKg }} kg</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ a.pricePerKg }} €</td>
          <td class="px-4 py-3"><StatusBadge :label="a.status" :tone="annTone[a.status]" /></td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="announcements.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune annonce</p>
  </div>
</template>
