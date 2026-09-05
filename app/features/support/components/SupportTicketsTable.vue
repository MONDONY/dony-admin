<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminSupportTicket } from '@/features/support/types/index'
import { STATUS_LABELS, formatDate, statusTone } from '@/features/support/utils/format'

defineProps<{ tickets: AdminSupportTicket[]; loading: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Catégorie</th>
          <th class="px-4 py-2 font-medium">Sujet</th>
          <th class="px-4 py-2 font-medium">Utilisateur</th>
          <th class="px-4 py-2 font-medium">Assigné à</th>
          <th class="px-4 py-2 font-medium">Dernière activité</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in tickets"
          :key="t.id"
          class="cursor-pointer border-t border-border hover:bg-surface-elevated"
          @click="emit('select', t.id)"
        >
          <td class="px-4 py-3">
            <StatusBadge :label="STATUS_LABELS[t.status]" :tone="statusTone(t.status)" />
          </td>
          <td class="px-4 py-3 text-sm">{{ t.category }}</td>
          <td class="max-w-[280px] truncate px-4 py-3 text-sm font-medium">{{ t.subject }}</td>
          <td class="px-4 py-3 text-sm">{{ t.userDisplayName }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ t.assignedAdminEmail ?? '—' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ formatDate(t.lastMessageAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="tickets.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun ticket</p>
  </div>
</template>
