<script setup lang="ts">
import { Flag } from 'lucide-vue-next'
import type { ReportContextMessage } from '@/features/signalements/types/index'

/**
 * Le message signalé dans sa conversation : deux messages avant, deux après. La personne visée à
 * droite, le message signalé encadré et nommé, un message déjà supprimé barré et dit tel quel.
 */
defineProps<{ messages: ReportContextMessage[] }>()

function time(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <ol class="flex flex-col gap-2" data-test="context-messages" aria-label="Messages autour du message signalé">
    <li
      v-for="m in messages" :key="m.id" :data-test="`context-message-${m.id}`"
      :data-flagged="m.flagged ? 'true' : undefined"
      :class="['flex flex-col', m.fromSubject ? 'items-end' : 'items-start']"
    >
      <div
        :class="['max-w-[85%] rounded-card px-3 py-2 text-sm',
          m.flagged ? 'border-2 border-danger bg-danger/10' : m.fromSubject ? 'bg-primary/10' : 'bg-surface-elevated']"
      >
        <p v-if="m.flagged" class="mb-1 flex items-center gap-1 text-xs font-medium text-danger">
          <Flag class="size-3" aria-hidden="true" />Message signalé
        </p>
        <p class="mb-0.5 text-xs text-text-muted">
          <span>{{ m.senderName ?? 'Compte inconnu' }}</span>
          <span v-if="time(m.sentAt)" class="tabular-nums"> · {{ time(m.sentAt) }}</span>
          <span v-if="m.deleted" class="ml-1 rounded bg-border/40 px-1" data-test="context-message-deleted">supprimé</span>
        </p>
        <p :class="['whitespace-pre-wrap text-pretty break-words', m.deleted ? 'text-text-muted line-through' : '']">{{ m.body }}</p>
      </div>
    </li>
  </ol>
</template>
