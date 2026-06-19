<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminConversation } from '@/features/moderation/types/index'
defineProps<{ conversations: AdminConversation[]; loading: boolean }>()
const emit = defineEmits<{ open: [id: string] }>()
function fmt(d: string | null) { return d ? new Date(d).toLocaleString('fr-FR') : '—' }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Participants</th>
          <th class="px-4 py-2 font-medium">Messages</th>
          <th class="px-4 py-2 font-medium">Dernier message</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in conversations" :key="c.id" :data-test="`conv-row-${c.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ c.participantA ?? '—' }} ↔ {{ c.participantB ?? '—' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ c.messageCount }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(c.lastMessageAt) }}</td>
          <td class="px-4 py-3">
            <StatusBadge v-if="c.flagged" :data-test="`conv-flagged-${c.id}`" label="Signalée" tone="danger" />
            <span v-else class="text-xs text-text-muted">—</span>
          </td>
          <td class="px-4 py-3 text-right">
            <button
              type="button" :data-test="`open-${c.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-primary/15 text-primary hover:bg-primary/25"
              @click="emit('open', c.id)"
            >Voir</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="conversations.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune conversation</p>
  </div>
</template>
