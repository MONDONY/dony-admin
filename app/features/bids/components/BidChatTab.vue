<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ImageOff, RotateCw } from 'lucide-vue-next'
import PhotoViewer, { type PhotoViewerItem } from '@/components/ui/PhotoViewer.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useBidChat } from '@/features/bids/composables/useBidChat'
import type { AdminMessage } from '@/features/moderation/types/index'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'
import { safeHttpsUrl } from '@/lib/safeInput'
import { serverDateIso } from '@/lib/serverDate'

/**
 * Onglet Échanges : la conversation du colis, en lecture seule. Supprimer ou restaurer un
 * message reste dans la modération (lien en tête). Les photos sont des URL présignées de 15
 * minutes : seules les URL `https:` passent, et une photo expirée propose de relire la conversation.
 */
const props = defineProps<{ conversationId: string }>()
const emit = defineEmits<{
  /** Nombre de messages, une fois la conversation chargée (pastille de l'onglet). */
  loaded: [count: number]
}>()

const { messages, isLoading, error, load, reload } = useBidChat(() => props.conversationId)

async function run(fn: () => Promise<void>) {
  const id = props.conversationId
  await fn()
  if (id === props.conversationId && !error.value) emit('loaded', messages.value.length)
}
// Une autre conversation remonte le composant (`:key` dans le tiroir) : messages, visionneuse et échecs repartent de zéro.
onMounted(() => { void run(load) })

const isDeleted = (m: AdminMessage) => m.deleted || !!m.deletedAt
const when = (m: AdminMessage) => formatInstant(serverDateIso(m.createdAt))
const thumbOf = (m: AdminMessage) => isDeleted(m) ? null : safeHttpsUrl(m.thumbUrl ?? m.imageUrl)
const fullOf = (m: AdminMessage) => isDeleted(m) ? null : safeHttpsUrl(m.imageUrl ?? m.thumbUrl)
const hasImage = (m: AdminMessage) => !isDeleted(m) && (m.type === 'IMAGE' || !!m.imageUrl || !!m.thumbUrl)

/** Photos affichables, dans l'ordre de la conversation : la visionneuse va de l'une à l'autre. */
const gallery = computed(() => messages.value.filter(m => hasImage(m) && fullOf(m) !== null))
const viewerIndex = ref<number | null>(null)
const viewerItems = computed<PhotoViewerItem[] | null>(() => viewerIndex.value === null ? null : gallery.value.map(m => ({
  url: fullOf(m)!,
  caption: `${m.senderName ?? 'Inconnu'} · ${when(m)}`,
})))
const returnFocusTo = ref<HTMLElement | null>(null)
function openImage(m: AdminMessage, e: MouseEvent) {
  returnFocusTo.value = e.currentTarget instanceof HTMLElement ? e.currentTarget : null
  viewerIndex.value = gallery.value.findIndex(g => g.id === m.id)
}

const failed = ref(new Set<string>())
function markFailed(id: string) { failed.value = new Set(failed.value).add(id) }
const showMissing = (m: AdminMessage) => hasImage(m) && (thumbOf(m) === null || failed.value.has(m.id))

/** Photo expirée : la visionneuse se ferme, la conversation est relue, puis on revient à la même photo. */
async function onReload(i: number) {
  viewerIndex.value = null
  failed.value = new Set()
  await run(reload)
  if (!error.value && gallery.value.length > 0) viewerIndex.value = Math.min(i, gallery.value.length - 1)
}
async function reloadFromThumb() {
  failed.value = new Set()
  await run(reload)
}
</script>

<template>
  <div class="flex flex-col gap-3" data-test="bid-chat-tab">
    <div class="flex justify-end">
      <NuxtLink
        :to="`/moderation?open=${encodeURIComponent(conversationId)}`" data-test="chat-open-moderation"
        class="inline-flex min-h-10 items-center rounded-btn border border-border px-4 text-sm transition-[background-color,transform] hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
      >Ouvrir dans la modération</NuxtLink>
    </div>

    <p
      v-if="isLoading && messages.length > 0" data-test="chat-reloading" role="status"
      class="text-xs text-text-muted"
    >Actualisation de la conversation…</p>
    <div v-if="messages.length > 0" class="flex flex-col gap-2" role="log" aria-live="off" aria-label="Messages de la conversation">
      <article
        v-for="m in messages" :key="m.id" :data-test="`chat-message-${m.id}`"
        :class="['rounded-card border p-3', isDeleted(m) ? 'border-dashed border-border bg-surface-elevated' : 'border-border bg-surface']"
      >
        <div class="mb-1 flex items-center justify-between gap-2">
          <span :class="['text-sm font-medium', isDeleted(m) ? 'text-text-muted' : '']">{{ m.senderName ?? 'Inconnu' }}</span>
          <time class="text-xs text-text-muted tabular-nums">{{ when(m) }}</time>
        </div>
        <p v-if="isDeleted(m)" class="text-sm italic text-text-muted">Message supprimé</p>
        <template v-else>
          <p v-if="m.content" class="text-sm whitespace-pre-wrap text-pretty">{{ m.content }}</p>
          <div v-if="hasImage(m)" :class="m.content ? 'mt-2' : ''">
            <div
              v-if="showMissing(m)" :data-test="`chat-image-${m.id}-missing`"
              class="flex flex-wrap items-center gap-2 text-xs text-text-muted"
            >
              <ImageOff class="h-4 w-4" aria-hidden="true" />
              <span>Cette photo n’est plus disponible.</span>
              <button
                type="button" :data-test="`chat-image-${m.id}-reload`"
                class="inline-flex min-h-10 items-center gap-1 rounded-btn border border-border px-3 transition-[background-color,transform] hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
                @click="reloadFromThumb"
              ><RotateCw class="h-3.5 w-3.5" aria-hidden="true" />Recharger</button>
            </div>
            <button
              v-else type="button" :data-test="`chat-image-${m.id}`" :aria-label="`Agrandir la photo de ${m.senderName ?? 'Inconnu'}`"
              class="block h-24 w-32 overflow-hidden rounded-xs bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.96] motion-safe:transition-[scale]"
              @click="openImage(m, $event)"
            >
              <img
                :src="thumbOf(m)!" alt="" loading="lazy"
                class="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                @error="markFailed(m.id)"
              >
            </button>
          </div>
        </template>
      </article>
    </div>
    <StateBlock
      :loading="isLoading && messages.length === 0" :error="error" :empty="!isLoading && !error && messages.length === 0"
      empty-label="Aucun message." @retry="run(reload)"
    />

    <Teleport to="body">
      <PhotoViewer
        :items="viewerItems" :start-index="viewerIndex ?? 0" :return-focus-to="returnFocusTo"
        title="Photos de la conversation" alt="Photo de la conversation"
        @close="viewerIndex = null" @reload="onReload"
      />
    </Teleport>
  </div>
</template>
