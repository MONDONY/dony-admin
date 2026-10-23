<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ImageOff } from 'lucide-vue-next'
import PhotoViewer, { type PhotoViewerItem } from '@/components/ui/PhotoViewer.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useBidPhotos } from '@/features/bids/composables/useBidPhotos'
import { fallbackPhotos, groupPhotos, safePhotos } from '@/features/bids/lib/bidPhotos'
import type { AdminBidDetail, AdminBidPhoto, AdminBidTimeline, PhotoStage } from '@/features/bids/types/index'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'
import { serverDateIso } from '@/lib/serverDate'

/**
 * Photos du colis par étape (création, remise, transit, livraison, puis refus et litige s'il y
 * en a). Face à un ancien back sans `GET /admin/bids/{id}/photos`, on se rabat sur
 * `bid.photoUrls` et les photos des scans de la chronologie. Seules les URL `https:` passent.
 */
const props = defineProps<{ bid: AdminBidDetail; timeline: AdminBidTimeline | null }>()
const emit = defineEmits<{
  /** Vrai seulement quand la galerie montre réellement les photos (chargées, sans erreur, endpoint présent). */
  'update:displayed': [value: boolean]
  /** Ancien back : la fiche est à relire pour renouveler les URL présignées de repli. */
  'reload-bid': []
}>()

const { photos, isLoading, error, unavailable, load, reload } = useBidPhotos(() => props.bid.id)
onMounted(() => { void load() })
const started = ref(false)
watch(isLoading, (v) => { if (v) started.value = true })
const displayed = computed(() => started.value && !isLoading.value && !error.value && !unavailable.value)
watch(displayed, v => emit('update:displayed', v), { immediate: true })
watch(() => props.bid.id, () => { viewerIndex.value = null; void load() })

const source = computed(() => safePhotos(unavailable.value ? fallbackPhotos(props.bid, props.timeline) : photos.value))
const groups = computed(() => groupPhotos(source.value))
const showSkeleton = computed(() => isLoading.value && photos.value.length === 0 && !unavailable.value)

/** Toutes les photos, dans l'ordre des étapes : la visionneuse va de l'une à l'autre d'un bout à l'autre. */
const flat = computed(() => groups.value.flatMap(g => g.photos.map(photo => ({ photo, label: g.label }))))
const offsets = computed(() => {
  const out = {} as Record<PhotoStage, number>
  let n = 0
  for (const g of groups.value) { out[g.stage] = n; n += g.photos.length }
  return out
})

const dateOf = (at: string) => formatInstant(serverDateIso(at))
/** Date et lieu de la première photo de l'étape (appelée seulement sur une étape non vide). */
function meta(list: AdminBidPhoto[]): string {
  const first = list[0]!
  return [dateOf(first.at), first.gpsLabel].filter(Boolean).join(' · ')
}

const viewerIndex = ref<number | null>(null)
const viewerItems = computed<PhotoViewerItem[] | null>(() => viewerIndex.value === null ? null : flat.value.map(({ photo, label }) => ({
  url: photo.url,
  caption: `${label} · ${dateOf(photo.at)}`,
  subcaption: photo.gpsLabel ?? undefined,
})))

/** Vignette cliquée : elle reprend le focus à la fermeture (Safari ne le lui donne pas au clic). */
const returnFocusTo = ref<HTMLElement | null>(null)
function openAt(stage: PhotoStage, i: number, e: MouseEvent) {
  returnFocusTo.value = e.currentTarget instanceof HTMLElement ? e.currentTarget : null
  viewerIndex.value = offsets.value[stage] + i
}

/**
 * URL expirée : nouvelles URL présignées, puis retour à la même photo. Échec du rechargement :
 * la visionneuse reste fermée (pas d'anciennes URL expirées), la galerie montre l'erreur. Colis
 * changé entre-temps : rien à rouvrir.
 */
async function onViewerReload(i: number) {
  const id = props.bid.id
  viewerIndex.value = null
  // Ancien back : les URL viennent de la fiche et de la chronologie, pas de l'endpoint des photos.
  if (unavailable.value) { emit('reload-bid'); return }
  await reload()
  if (props.bid.id !== id || error.value) return
  const n = flat.value.length
  viewerIndex.value = n > 0 ? Math.min(i, n - 1) : null
}

const failedUrls = ref(new Set<string>())
function markFailed(url: string) { failedUrls.value = new Set(failedUrls.value).add(url) }

const countLabel = (n: number) => n > 1 ? `${n} photos` : `${n} photo`
</script>

<template>
  <div class="flex flex-col gap-3" data-test="bid-photos">
    <div v-if="showSkeleton" class="flex flex-col gap-3" data-test="photos-loading" role="status" aria-label="Chargement des photos">
      <div v-for="n in 2" :key="n" class="rounded-card border border-border bg-surface p-4">
        <div class="h-4 w-40 rounded-xs bg-surface-elevated motion-safe:animate-pulse" />
        <div class="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          <div v-for="m in 3" :key="m" class="aspect-[4/3] rounded-xs bg-surface-elevated motion-safe:animate-pulse" />
        </div>
      </div>
    </div>

    <StateBlock v-else-if="error" :error="error" @retry="load()" />

    <template v-else>
      <section
        v-for="g in groups" :key="g.stage"
        class="rounded-card border border-border bg-surface p-4" :data-test="`photos-stage-${g.stage}`"
        :aria-label="g.label"
      >
        <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 class="text-sm font-semibold text-balance">{{ g.label }}</h3>
          <span v-if="g.photos.length" class="text-xs text-text-muted tabular-nums">{{ countLabel(g.photos.length) }}</span>
          <span v-if="g.photos.length" class="text-xs text-text-muted tabular-nums">{{ meta(g.photos) }}</span>
        </div>

        <div v-if="g.photos.length" class="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          <button
            v-for="(p, i) in g.photos" :key="p.id" type="button"
            class="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xs bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.96] motion-safe:transition-[scale]"
            :data-test="`photo-${g.stage}-${i}`" @click="openAt(g.stage, i, $event)"
          >
            <span v-if="failedUrls.has(p.url)" class="flex flex-col items-center gap-1 px-2 text-center text-xs text-text-muted">
              <ImageOff class="h-4 w-4" aria-hidden="true" />
              <span>Photo indisponible</span>
              <span class="sr-only">{{ `Photo : ${g.label} ${i + 1}` }}</span>
            </span>
            <img
              v-else :src="p.url" :alt="`Photo : ${g.label} ${i + 1}`" loading="lazy"
              class="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              @error="markFailed(p.url)"
            >
            <span class="absolute bottom-1.5 right-1.5 rounded-xs bg-black/70 px-1.5 py-px text-[10px] font-semibold text-white tabular-nums" aria-hidden="true">
              {{ i + 1 }}/{{ g.photos.length }}
            </span>
          </button>
        </div>
        <p
          v-else class="mt-3 rounded-xs border-[1.5px] border-dashed border-border p-3.5 text-center text-sm text-text-muted"
          :data-test="`photos-empty-${g.stage}`"
        >Aucune photo pour cette étape</p>
      </section>
    </template>

    <Teleport to="body">
      <PhotoViewer
        :items="viewerItems" :start-index="viewerIndex ?? 0" :return-focus-to="returnFocusTo" title="Photos du colis" alt="Photo du colis"
        @close="viewerIndex = null" @reload="onViewerReload"
      />
    </Teleport>
  </div>
</template>
