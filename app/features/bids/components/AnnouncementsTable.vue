<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import type { AdminAnnouncementListItem, AnnouncementStatus } from '@/features/bids/types/index'
import { useAuthStore } from '@/stores/auth'
import { REMOVAL_REASONS } from '@/features/bids/removalReasons'

defineProps<{ announcements: AdminAnnouncementListItem[]; loading: boolean; error?: string | null; busy?: boolean }>()
const emit = defineEmits<{ remove: [id: string, publicReason: string, internalNote: string]; restore: [id: string] }>()
const auth = useAuthStore()

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

// Retrait est la seule action de cette table qui passe par une confirmation
// (motif obligatoire) — Restaurer émet directement. `pending` porte donc
// l'id de l'annonce en attente de retrait (null = dialogue fermé), sur le
// même patron d'état que UserDetailPanel (pending / dialogConfig calculé /
// une fonction qui route vers l'emit à la confirmation).
const pending = ref<string | null>(null)

type DialogConfig = { title: string; message: string; confirmLabel: string; requireReason: boolean }
const dialogConfig = computed<DialogConfig>(() => ({
  title: 'Retirer cette annonce',
  message: 'L\'annonce sera masquée aux voyageurs et expéditeurs. Elle pourra être restaurée ensuite.',
  confirmLabel: 'Retirer',
  requireReason: false,
}))

function confirmRemove(internalNote: string, publicReason?: string) {
  // `publicReason` est toujours fourni ici : le dialogue reçoit un catalogue et bloque la
  // confirmation tant qu'aucun motif n'est choisi.
  if (pending.value && publicReason) emit('remove', pending.value, publicReason, internalNote)
  pending.value = null
}
</script>

<template>
  <p v-if="error" data-test="ann-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>
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
          <th v-if="auth.can('CONTENT_REMOVE')" class="px-4 py-2 font-medium" data-test="col-actions" />
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
          <td v-if="auth.can('CONTENT_REMOVE')" class="px-4 py-3 text-right">
            <button
              v-if="a.status !== 'REMOVED_BY_ADMIN'" type="button" :data-test="`remove-${a.id}`"
              :disabled="busy"
              class="rounded-btn px-3 py-1.5 text-sm bg-danger/15 text-danger hover:bg-danger/25 disabled:opacity-40"
              @click="pending = a.id"
            >Retirer</button>
            <button
              v-else type="button" :data-test="`restore-${a.id}`"
              :disabled="busy"
              class="rounded-btn px-3 py-1.5 text-sm bg-success/15 text-success hover:bg-success/25 disabled:opacity-40"
              @click="emit('restore', a.id)"
            >Restaurer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="announcements.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune annonce</p>

    <ConfirmActionDialog
      :open="pending !== null"
      :title="dialogConfig.title"
      :message="dialogConfig.message"
      :confirm-label="dialogConfig.confirmLabel"
      :require-reason="dialogConfig.requireReason"
      :reason-options="REMOVAL_REASONS"
      @confirm="confirmRemove"
      @cancel="pending = null"
    />
  </div>
</template>
