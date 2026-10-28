<script setup lang="ts">
import { computed, ref } from 'vue'
import { ImageOff, RotateCw } from 'lucide-vue-next'
import PhotoViewer, { type PhotoViewerItem } from '@/components/ui/PhotoViewer.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  isMessageDeleted, isRightSide, isSystemMessage, participantsLabel, type QueueConversation,
} from '@/features/moderation/lib/moderationWorkbench'
import { groupMessagesByDay, messageTime } from '@/features/support/lib/supportWorkbench'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { AdminMessage } from '@/features/moderation/types/index'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'
import { safeHttpsUrl } from '@/lib/safeInput'
import { serverDateIso } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * Conversation au centre du poste, en lecture seule : un modérateur n'écrit pas dans un échange entre
 * deux personnes. Le fil est groupé par jour, le message signalé est encadré, un message supprimé reste
 * lisible pour l'équipe (barré, avec sa date) et se restaure. Les photos sont des URL présignées de
 * 15 minutes : seules les URL `https:` passent, une photo expirée propose de relire la conversation.
 */
const props = withDefaults(defineProps<{
  conversation: QueueConversation | null
  messages: AdminMessage[]
  loading: boolean
  error?: string | null
  /** Message désigné par le signalement ouvert, quand le contexte du signalement le dit. */
  flaggedId?: string | null
  /** Messages dont la restauration n'existe pas côté back (contenu non conservé). */
  restoreUnavailableIds?: string[]
  now?: number
}>(), { error: null, flaggedId: null, restoreUnavailableIds: () => [], now: undefined })
const emit = defineEmits<{ delete: [id: string]; restore: [id: string]; reload: []; retry: [] }>()

const auth = useAuthStore()
const canDelete = computed(() => auth.can('MESSAGE_DELETE'))
const days = computed(() => groupMessagesByDay(props.messages, props.now))
const reasons = computed(() => [...new Set((props.conversation?.reports ?? []).map((r) => reportReasonLabel(r.reason)))])
const opened = computed(() => {
  const at = props.conversation?.createdAt
  return at ? formatInstant(serverDateIso(at)) : null
})
const deletedOn = (m: AdminMessage) => (m.deletedAt ? formatInstant(serverDateIso(m.deletedAt)) : null)

// ---- Photos ----
const thumbOf = (m: AdminMessage) => (isMessageDeleted(m) ? null : safeHttpsUrl(m.thumbUrl ?? m.imageUrl))
const fullOf = (m: AdminMessage) => (isMessageDeleted(m) ? null : safeHttpsUrl(m.imageUrl ?? m.thumbUrl))
const hasImage = (m: AdminMessage) => !isMessageDeleted(m) && (m.type === 'IMAGE' || !!m.imageUrl || !!m.thumbUrl)
const gallery = computed(() => props.messages.filter((m) => hasImage(m) && fullOf(m) !== null))
const viewerIndex = ref<number | null>(null)
const viewerItems = computed<PhotoViewerItem[] | null>(() => viewerIndex.value === null ? null : gallery.value.map((m) => ({
  url: fullOf(m)!,
  caption: `${m.senderName ?? 'Inconnu'} · ${formatInstant(serverDateIso(m.createdAt))}`,
})))
const returnFocusTo = ref<HTMLElement | null>(null)
function openImage(m: AdminMessage, e: MouseEvent) {
  returnFocusTo.value = e.currentTarget instanceof HTMLElement ? e.currentTarget : null
  viewerIndex.value = gallery.value.findIndex((g) => g.id === m.id)
}
const failed = ref(new Set<string>())
function markFailed(id: string) { failed.value = new Set(failed.value).add(id) }
const showMissing = (m: AdminMessage) => hasImage(m) && (thumbOf(m) === null || failed.value.has(m.id))
function reload() {
  viewerIndex.value = null
  failed.value = new Set()
  emit('reload')
}
</script>

<template>
  <section
    aria-label="Conversation" data-test="moderation-thread"
    class="flex max-h-[calc(100vh-13rem)] min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface"
  >
    <template v-if="conversation">
      <header class="border-b border-border p-4">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge v-if="conversation.reports.length" label="Signalement ouvert" tone="danger" data-test="thread-reported" />
          <StatusBadge v-for="r in reasons" :key="r" :label="r" tone="neutral" />
          <StatusBadge v-if="conversation.closedAt" label="Conversation fermée" tone="neutral" />
          <span v-if="opened" class="ml-auto text-text-muted">conversation ouverte le {{ opened }}</span>
        </div>
        <h2 class="mt-2 font-display text-xl font-bold text-balance" data-test="thread-title">{{ participantsLabel(conversation) }}</h2>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto bg-bg/40 p-4" role="log" aria-live="off" aria-label="Messages de la conversation">
        <div v-for="d in days" :key="d.key" class="mb-3 flex flex-col gap-2" :data-test="`thread-day-${d.key}`">
          <span class="self-center rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-semibold text-text-muted">{{ d.label }}</span>
          <template v-for="m in d.messages" :key="m.id">
            <p v-if="isSystemMessage(m) && !isMessageDeleted(m)" :data-test="`message-${m.id}`" class="self-center text-center text-xs italic text-text-muted text-pretty">{{ m.content }}</p>
            <article
              v-else :data-test="`message-${m.id}`" :data-flagged="flaggedId === m.id || m.flagged ? 'true' : undefined"
              :class="['max-w-[84%] rounded-card border p-3',
                isRightSide(m, conversation) ? 'self-end' : 'self-start',
                isMessageDeleted(m) ? 'border-dashed border-border bg-surface-elevated/60' : 'border-border bg-surface',
                (flaggedId === m.id || m.flagged) ? 'border-2 border-danger bg-danger/5' : '']"
            >
              <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span :class="['font-semibold', isMessageDeleted(m) ? 'text-text-muted' : '']">{{ m.senderName ?? 'Inconnu' }}</span>
                <time class="tabular-nums text-text-muted">{{ messageTime(m.createdAt) }}</time>
                <StatusBadge v-if="flaggedId === m.id || m.flagged" :data-test="`msg-flagged-${m.id}`" label="Message signalé" tone="danger" />
              </div>

              <template v-if="isMessageDeleted(m)">
                <p :data-test="m.deletedByAdmin ? `msg-deleted-by-admin-${m.id}` : `msg-deleted-${m.id}`" class="text-xs font-medium text-warning tabular-nums">
                  {{ m.deletedByAdmin ? 'Supprimé par un admin' : 'Supprimé' }}<template v-if="deletedOn(m)"> le {{ deletedOn(m) }}</template>
                </p>
                <p v-if="m.content" class="mt-1 text-sm text-text-muted line-through whitespace-pre-wrap text-pretty">{{ m.content }}</p>
                <p v-else class="mt-1 text-sm italic text-text-muted">Message supprimé</p>
                <div v-if="m.deletedByAdmin && canDelete" class="mt-2">
                  <span
                    v-if="restoreUnavailableIds.includes(m.id)" :data-test="`msg-restore-unavailable-${m.id}`"
                    class="text-xs text-text-muted"
                  >Restauration indisponible pour ce message</span>
                  <button
                    v-else type="button" :data-test="`restore-msg-${m.id}`"
                    class="rounded-btn border border-border bg-surface px-3 py-1 text-xs font-medium transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
                    @click="emit('restore', m.id)"
                  >Annuler la suppression</button>
                </div>
              </template>
              <template v-else>
                <p v-if="m.content" class="text-sm whitespace-pre-wrap text-pretty">{{ m.content }}</p>
                <div v-if="hasImage(m)" :class="m.content ? 'mt-2' : ''">
                  <div
                    v-if="showMissing(m)" :data-test="`thread-image-${m.id}-missing`"
                    class="flex flex-wrap items-center gap-2 text-xs text-text-muted"
                  >
                    <ImageOff class="h-4 w-4" aria-hidden="true" />
                    <span>Cette photo n’est plus disponible.</span>
                    <button
                      type="button" :data-test="`thread-image-${m.id}-reload`"
                      class="inline-flex min-h-10 items-center gap-1 rounded-btn border border-border px-3 transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
                      @click="reload"
                    ><RotateCw class="h-3.5 w-3.5" aria-hidden="true" />Recharger</button>
                  </div>
                  <button
                    v-else type="button" :data-test="`thread-image-${m.id}`" :aria-label="`Agrandir la photo de ${m.senderName ?? 'Inconnu'}`"
                    class="block h-28 w-40 overflow-hidden rounded-xs bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.96] motion-safe:transition-[scale]"
                    @click="openImage(m, $event)"
                  >
                    <img
                      :src="thumbOf(m)!" alt="" loading="lazy"
                      class="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                      @error="markFailed(m.id)"
                    >
                  </button>
                </div>
                <div v-if="canDelete" class="mt-2 text-right">
                  <button
                    type="button" :data-test="`delete-msg-${m.id}`"
                    class="rounded-btn bg-danger/10 px-3 py-1 text-xs font-medium text-danger transition-[background-color,scale] hover:bg-danger/20 active:scale-[0.96]"
                    @click="emit('delete', m.id)"
                  >Supprimer</button>
                </div>
              </template>
            </article>
          </template>
        </div>
        <StateBlock
          :loading="loading" :error="error" :empty="!loading && !error && messages.length === 0"
          empty-label="Aucun message" @retry="emit('retry')"
        />
      </div>

      <footer class="border-t border-border px-4 py-2.5 text-xs text-text-muted text-pretty">
        Lecture seule : un modérateur n’écrit pas dans une conversation. Les messages supprimés restent lisibles ici.
      </footer>
    </template>
    <p v-else class="p-8 text-center text-sm text-text-muted" data-test="thread-empty">Choisissez une conversation dans la file.</p>

    <Teleport to="body">
      <PhotoViewer
        :items="viewerItems" :start-index="viewerIndex ?? 0" :return-focus-to="returnFocusTo"
        title="Photos de la conversation" alt="Photo de la conversation"
        @close="viewerIndex = null" @reload="reload"
      />
    </Teleport>
  </section>
</template>
