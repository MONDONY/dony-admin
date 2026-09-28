<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminMessage } from '@/features/moderation/types/index'
import { useAuthStore } from '@/stores/auth'
withDefaults(defineProps<{
  messages: AdminMessage[]
  loading: boolean
  /** Messages dont la restauration n'existe pas côté back (contenu non conservé). */
  restoreUnavailableIds?: string[]
}>(), { restoreUnavailableIds: () => [] })
const emit = defineEmits<{ delete: [id: string]; restore: [id: string] }>()
const auth = useAuthStore()
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
function deletedByAdminLabel(m: AdminMessage) {
  return m.deletedAt ? `Supprimé par un admin le ${fmt(m.deletedAt)}` : 'Supprimé par un admin'
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="m in messages" :key="m.id" :data-test="`message-${m.id}`"
      :class="['rounded-card border p-3', m.deleted ? 'border-dashed border-border bg-surface-elevated/60' : 'border-border bg-surface']"
    >
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <span :class="['text-sm font-medium', m.deleted ? 'text-text-muted' : '']">{{ m.senderName ?? 'Inconnu' }}</span>
          <StatusBadge v-if="m.flagged" :data-test="`msg-flagged-${m.id}`" label="Signalé" tone="danger" />
        </div>
        <span class="text-xs text-text-muted tabular-nums">{{ fmt(m.createdAt) }}</span>
      </div>
      <template v-if="m.deleted && m.deletedByAdmin">
        <p :data-test="`msg-deleted-by-admin-${m.id}`" class="text-xs font-medium text-text-muted tabular-nums">{{ deletedByAdminLabel(m) }}</p>
        <p v-if="m.content" class="mt-1 text-sm text-text-muted opacity-70 whitespace-pre-wrap">{{ m.content }}</p>
        <div v-if="auth.can('MESSAGE_DELETE')" class="mt-2 text-right">
          <span
            v-if="restoreUnavailableIds.includes(m.id)" :data-test="`msg-restore-unavailable-${m.id}`"
            class="text-xs text-text-muted"
          >Restauration indisponible pour ce message</span>
          <button
            v-else type="button" :data-test="`restore-msg-${m.id}`"
            class="rounded-btn px-3 py-1 text-xs bg-primary/15 text-primary transition-[background-color,scale] hover:bg-primary/25 active:scale-[0.96]"
            @click="emit('restore', m.id)"
          >Restaurer</button>
        </div>
      </template>
      <p v-else-if="m.deleted" class="text-sm italic text-text-muted line-through">Message supprimé</p>
      <p v-else class="text-sm text-text whitespace-pre-wrap">{{ m.content }}</p>
      <div v-if="!m.deleted && auth.can('MESSAGE_DELETE')" class="mt-2 text-right">
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
