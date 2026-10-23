<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Download, ExternalLink, ImageOff, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-vue-next'

export interface PhotoViewerItem { url: string; caption?: string; subcaption?: string }

/**
 * Visionneuse plein écran d'une série d'images. Les URLs présignées ne sont jamais recopiées.
 *
 * - `urls` (forme historique : captures de signalement, photos d'une demande d'envoi) : toutes
 *   les images côte à côte ; `urls` à null = fermée.
 * - `items` (prioritaire sur `urls`) : une photo à la fois, précédent/suivant, zoom de 50 % à
 *   400 %, bande de vignettes, légende, ouverture dans un onglet, téléchargement. `items` vide ou
 *   null (avec `urls` à null) = fermée. Une photo qui ne charge plus (URL expirée) propose
 *   « Recharger » (`reload`, avec l'index affiché) au lieu d'une image cassée.
 *
 * Échap ferme la visionneuse seulement : l'événement est arrêté avant d'atteindre le tiroir.
 */
const props = withDefaults(defineProps<{
  urls?: string[] | null
  title?: string
  alt?: string
  items?: PhotoViewerItem[] | null
  startIndex?: number
}>(), {
  urls: null,
  title: 'Captures jointes',
  alt: 'Capture d’écran jointe',
  items: null,
  startIndex: 0,
})
const emit = defineEmits<{ close: []; reload: [index: number] }>()

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200, 250, 300, 400]
const DEFAULT_ZOOM = 100

const richOpen = computed(() => props.items != null && props.items.length > 0)
const legacyOpen = computed(() => props.items == null && props.urls !== null)

const index = ref(0)
const zoom = ref(DEFAULT_ZOOM)
const failed = ref(new Set<number>())
const natural = ref<{ w: number; h: number } | null>(null)
const stageSize = ref<{ w: number; h: number } | null>(null)

const dialogEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
let trigger: HTMLElement | null = null

const count = computed(() => props.items?.length ?? 0)
const current = computed(() => props.items?.[index.value] ?? null)
const currentFailed = computed(() => failed.value.has(index.value))
const zoomLabel = computed(() => `${zoom.value}\u00a0%`)
const canPrev = computed(() => index.value > 0)
const canNext = computed(() => index.value < count.value - 1)
const canZoomOut = computed(() => zoom.value > ZOOM_LEVELS[0]!)
const canZoomIn = computed(() => zoom.value < ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!)

/** Taille affichée : 100 % = photo ajustée à l'écran ; sans mesure (pas encore chargée), en pourcentage. */
const imageStyle = computed<Record<string, string>>(() => {
  const n = natural.value; const s = stageSize.value
  if (n && s && n.w > 0 && n.h > 0 && s.w > 0 && s.h > 0) {
    const fit = Math.min(s.w / n.w, s.h / n.h) * (zoom.value / 100)
    return { width: `${Math.round(n.w * fit)}px`, height: `${Math.round(n.h * fit)}px` } as Record<string, string>
  }
  return (zoom.value === DEFAULT_ZOOM ? { maxWidth: '100%', maxHeight: '100%' } : { width: `${zoom.value}%` }) as Record<string, string>
})

function clampIndex(i: number) { return Math.min(Math.max(0, Math.trunc(i) || 0), Math.max(0, count.value - 1)) }

function show(i: number) {
  const next = clampIndex(i)
  if (next === index.value) return
  index.value = next
  zoom.value = DEFAULT_ZOOM
  natural.value = null
}
const go = (step: number) => show(index.value + step)

/** Zoom en gardant le centre de la vue au même endroit de la photo. */
function setZoom(value: number) {
  const z = Math.min(Math.max(value, ZOOM_LEVELS[0]!), ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!)
  if (z === zoom.value) return
  const el = stageEl.value
  const cx = el && el.scrollWidth ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0.5
  const cy = el && el.scrollHeight ? (el.scrollTop + el.clientHeight / 2) / el.scrollHeight : 0.5
  zoom.value = z
  void nextTick(() => {
    if (!el) return
    el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2
    el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2
  })
}
function zoomStep(dir: 1 | -1) {
  const next = dir > 0 ? ZOOM_LEVELS.find(l => l > zoom.value) : [...ZOOM_LEVELS].reverse().find(l => l < zoom.value)
  if (next !== undefined) setZoom(next)
}

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey) return
  e.preventDefault()
  zoomStep(e.deltaY < 0 ? 1 : -1)
}

function measureStage() {
  const el = stageEl.value
  stageSize.value = el ? { w: el.clientWidth, h: el.clientHeight } : null
}
function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  natural.value = { w: img.naturalWidth, h: img.naturalHeight }
  measureStage()
}
function markFailed(i: number) {
  if (failed.value.has(i)) return
  failed.value = new Set(failed.value).add(i)
}

function focusables(): HTMLElement[] {
  return [...(dialogEl.value?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])]
}
function trapTab(e: KeyboardEvent) {
  const list = focusables()
  if (list.length === 0) return
  const first = list[0]!; const last = list[list.length - 1]!
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === dialogEl.value)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
}

function onKey(e: KeyboardEvent) {
  if (!richOpen.value) return
  if (e.key === 'Tab') { trapTab(e); return }
  if (e.key !== 'Escape' && (e.ctrlKey || e.metaKey || e.altKey)) return
  switch (e.key) {
    case 'Escape': emit('close'); break
    case 'ArrowLeft': go(-1); break
    case 'ArrowRight': go(1); break
    case '+': case '=': zoomStep(1); break
    case '-': case '_': zoomStep(-1); break
    case '0': setZoom(DEFAULT_ZOOM); break
    default: return
  }
  e.preventDefault()
  e.stopPropagation()
}

function restoreFocus() {
  const el = trigger
  trigger = null
  if (el && el.isConnected) el.focus()
}

watch(richOpen, (open) => {
  if (typeof window === 'undefined') return
  if (open) {
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', measureStage)
    void nextTick(() => dialogEl.value?.focus())
  } else {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', measureStage)
    restoreFocus()
  }
}, { immediate: true })

// Nouvelle série ou nouvel index de départ : on repart de la photo demandée, sans zoom ni erreur.
watch([() => props.items, () => props.startIndex], () => {
  failed.value = new Set()
  natural.value = null
  zoom.value = DEFAULT_ZOOM
  index.value = clampIndex(props.startIndex)
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', measureStage)
  if (richOpen.value) restoreFocus()
})

const btn = 'inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-btn border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-safe:transition-[background-color,scale,opacity]'
</script>

<template>
  <div
    v-if="legacyOpen"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6" data-test="photo-viewer"
    role="dialog" aria-modal="true" :aria-label="title"
    @click.self="emit('close')" @keydown.esc="emit('close')"
  >
    <div class="max-h-full max-w-4xl overflow-auto rounded-card bg-surface p-4 shadow-xl">
      <div class="mb-3 flex items-center justify-between gap-4">
        <h2 class="font-display text-lg font-semibold text-balance">{{ title }}</h2>
        <button
          type="button" data-test="photo-viewer-close"
          class="rounded-btn px-3 py-1.5 text-sm border border-border hover:bg-surface-elevated transition-colors active:scale-[0.96]"
          @click="emit('close')"
        >Fermer</button>
      </div>
      <div class="flex flex-wrap gap-4">
        <img
          v-for="(url, i) in urls" :key="i" :src="url" :alt="alt"
          class="max-h-[70vh] max-w-full rounded object-contain outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        >
      </div>
    </div>
  </div>

  <div
    v-else-if="richOpen && current"
    ref="dialogEl" tabindex="-1"
    class="fixed inset-0 z-[60] flex flex-col bg-black/90 text-white outline-none" data-test="photo-viewer"
    role="dialog" aria-modal="true" :aria-label="title"
    @click.self="emit('close')"
  >
    <div class="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <div class="min-w-0 flex-1">
        <p v-if="current.caption" class="truncate text-[15px] font-semibold" data-test="photo-caption">{{ current.caption }}</p>
        <p v-if="current.subcaption" class="mt-0.5 truncate text-sm text-white/70" data-test="photo-subcaption">{{ current.subcaption }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" :class="btn" aria-label="Zoom arrière" data-test="photo-zoom-out" :disabled="!canZoomOut" @click="zoomStep(-1)">
          <ZoomOut class="h-4 w-4" aria-hidden="true" />
        </button>
        <span class="w-14 text-center text-sm tabular-nums" aria-live="polite" data-test="photo-zoom-level">{{ zoomLabel }}</span>
        <button type="button" :class="btn" aria-label="Zoom avant" data-test="photo-zoom-in" :disabled="!canZoomIn" @click="zoomStep(1)">
          <ZoomIn class="h-4 w-4" aria-hidden="true" />
        </button>
        <a :href="current.url" target="_blank" rel="noopener noreferrer" :class="btn" data-test="photo-open-tab">
          <ExternalLink class="h-4 w-4" aria-hidden="true" /><span>Ouvrir dans un onglet</span>
        </a>
        <a :href="current.url" download target="_blank" rel="noopener noreferrer" :class="btn" data-test="photo-download">
          <Download class="h-4 w-4" aria-hidden="true" /><span>Télécharger</span>
        </a>
        <button type="button" :class="btn" data-test="photo-viewer-close" @click="emit('close')">
          <X class="h-4 w-4" aria-hidden="true" /><span>Fermer</span>
        </button>
      </div>
    </div>

    <div class="relative min-h-0 flex-1">
      <div ref="stageEl" class="flex h-full w-full overflow-auto px-16 py-2" data-test="photo-stage" @wheel="onWheel">
        <img
          v-if="!currentFailed"
          :key="current.url" :src="current.url" :alt="current.caption || alt" data-test="photo-main"
          class="m-auto max-w-none select-none rounded-xs object-contain outline outline-1 -outline-offset-1 outline-white/10"
          :style="imageStyle" :data-zoom="zoom" draggable="false"
          @load="onImageLoad" @error="markFailed(index)"
        >
        <div v-else role="alert" class="m-auto flex max-w-sm flex-col items-center gap-3 text-center" data-test="photo-error">
          <ImageOff class="h-8 w-8 text-white/70" aria-hidden="true" />
          <p class="text-sm text-pretty">Cette photo n’est plus disponible.</p>
          <button type="button" :class="btn" data-test="photo-reload" @click="emit('reload', index)">
            <RotateCw class="h-4 w-4" aria-hidden="true" /><span>Recharger</span>
          </button>
        </div>
      </div>
      <button
        type="button" :class="[btn, 'absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full px-0']"
        aria-label="Photo précédente" data-test="photo-prev" :disabled="!canPrev" @click="go(-1)"
      ><ChevronLeft class="h-5 w-5" aria-hidden="true" /></button>
      <button
        type="button" :class="[btn, 'absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full px-0']"
        aria-label="Photo suivante" data-test="photo-next" :disabled="!canNext" @click="go(1)"
      ><ChevronRight class="h-5 w-5" aria-hidden="true" /></button>
    </div>

    <div class="px-4 pb-4 pt-2 sm:px-5">
      <div v-if="count > 1" class="flex gap-2 overflow-x-auto p-1">
        <button
          v-for="(item, i) in items" :key="`${i}-${item.url}`" type="button"
          class="relative flex h-14 w-[72px] flex-none items-center justify-center overflow-hidden rounded-xs bg-white/10 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white motion-safe:transition-opacity"
          :class="i === index ? 'outline outline-2 outline-white' : 'opacity-60 hover:opacity-100'"
          :aria-label="`Photo ${i + 1} sur ${count}`" :aria-current="i === index ? 'true' : undefined"
          :data-test="`photo-thumb-${i}`" @click="show(i)"
        >
          <ImageOff v-if="failed.has(i)" class="h-4 w-4 text-white/70" aria-hidden="true" />
          <img v-else :src="item.url" alt="" loading="lazy" class="h-full w-full object-cover" @error="markFailed(i)">
        </button>
      </div>
      <p class="mt-2 text-xs text-white/70">
        ← → pour changer de photo · + / − pour zoomer · Échap pour fermer ·
        <span class="tabular-nums" data-test="photo-position">{{ index + 1 }} sur {{ count }}</span>
      </p>
    </div>
  </div>
</template>
