<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminMessage } from '@/features/moderation/types/index'
defineProps<{ messages: AdminMessage[]; loading: boolean }>()
const emit = defineEmits<{ delete: [id: string] }>()
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="m in messages" :key="m.id" :data-test="`message-${m.id}`"
      class="rounded-card border border-border bg-surface p-3"
    >
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">{{ m.senderName ?? '—' }}</span>
          <StatusBadge v-if="m.flagged" :data-test="`msg-flagged-${m.id}`" label="Signalé" tone="danger" />
        </div>
        <span class="text-xs text-text-muted tabular-nums">{{ fmt(m.createdAt) }}</span>
      </div>
      <p v-if="m.deleted" class="text-sm italic text-text-muted line-through">Message supprimé</p>
      <p v-else class="text-sm text-text whitespace-pre-wrap">{{ m.content }}</p>
      <div v-if="!m.deleted" class="mt-2 text-right">
        <button
          type="button" :data-test="`delete-msg-${m.id}`"
          class="rounded-btn px-3 py-1 text-xs bg-danger/15 text-danger hover:bg-danger/25"
          @click="emit('delete', m.id)"
        >Supprimer</button>
      </div>
    </div>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="messages.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun message</p>
  </div>
</template>
