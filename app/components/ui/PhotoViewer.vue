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
  /** Élément qui reprend le focus à la fermeture (Safari et Firefox macOS ne donnent pas le focus au bouton cliqué). */
  returnFocusTo?: HTMLElement | null
}>(), {
  urls: null,
  title: 'Captures jointes',
  alt: 'Capture d’écran jointe',
  items: null,
  startIndex: 0,
  returnFocusTo: null,
})
const emit = defineEmits<{ close: []; reload: [index: number] }>()

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200, 250, 300, 400]
const DEFAULT_ZOOM = 100

const richOpen = computed(() => props.items != null && props.items.length > 0)
const legacyOpen = computed(() => props.items == null && props.urls !== null)

const index = ref(0)
const zoom = ref(DEFAULT_ZOOM)
const failed = ref(new Set<string>())
const natural = ref<{ w: number; h: number } | null>(null)
const stageSize = ref<{ w: number; h: number } | null>(null)

const dialogEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
let trigger: HTMLElement | null = null

const count = computed(() => props.items?.length ?? 0)
const current = computed(() => props.items?.[index.value] ?? null)
const currentFailed = computed(() => current.value !== null && failed.value.has(current.value.url))
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
  keepFocusInDialog()
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
  keepFocusInDialog()
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

/**
 * Ctrl+molette (et pincement du trackpad, qui arrive en Ctrl+molette par petits `deltaY`) :
 * les deltas s'additionnent, un palier tous les `WHEEL_STEP` pixels, pour un zoom progressif.
 */
const WHEEL_STEP = 100
const LINE_HEIGHT = 33
let wheelAcc = 0
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey) return
  e.preventDefault()
  const delta = e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT : e.deltaY
  if (delta === 0) return
  if (Math.sign(delta) !== Math.sign(wheelAcc)) wheelAcc = 0
  wheelAcc += delta
  while (Math.abs(wheelAcc) >= WHEEL_STEP) {
    zoomStep(wheelAcc < 0 ? 1 : -1)
    wheelAcc -= Math.sign(wheelAcc) * WHEEL_STEP
  }
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
function markFailed(url: string) {
  if (failed.value.has(url)) return
  failed.value = new Set(failed.value).add(url)
}

/** Nom de fichier tiré de la légende (« Remise du colis · 01/06/2026 12:00 » → remise-du-colis-01-06-2026-12-00). */
function fileName(item: PhotoViewerItem, i: number, type: string): string {
  const base = (item.caption ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `photo-${i + 1}`
  const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' } as Record<string, string>)[type] ?? 'jpg'
  return `${base}.${ext}`
}

/**
 * `download` est ignoré pour une URL d'une autre origine (R2 présignée) : on télécharge le
 * fichier puis on l'enregistre depuis une URL objet. Échec (CORS, réseau) : ouverture dans un
 * nouvel onglet. Un clic avec modificateur reste au navigateur.
 */
async function onDownload(e: MouseEvent) {
  const item = current.value
  if (!item || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  const i = index.value
  try {
    const res = await fetch(item.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = fileName(item, i, blob.type)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  } catch {
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }
}

function focusables(): HTMLElement[] {
  return [...(dialogEl.value?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])]
}
/** Tab reste dans le dialogue, y compris quand le focus est tombé hors de lui (sur <body>). */
function trapTab(e: KeyboardEvent) {
  const list = focusables()
  if (list.length === 0) return
  const first = list[0]!; const last = list[list.length - 1]!
  const active = document.activeElement
  const outside = !active || active === dialogEl.value || !dialogEl.value?.contains(active)
  if (e.shiftKey && (outside || active === first)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && (outside || active === last)) { e.preventDefault(); first.focus() }
}

/** Un bouton focalisé qui se désactive (dernière photo, zoom maximal) rend le focus au dialogue. */
function keepFocusInDialog() {
  void nextTick(() => {
    const dialog = dialogEl.value
    if (!dialog) return
    const active = document.activeElement as HTMLButtonElement | null
    if (!active || active === document.body || !dialog.contains(active) || active.disabled) dialog.focus()
  })
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
    const active = document.activeElement
    trigger = props.returnFocusTo ?? (active instanceof HTMLElement && active !== document.body ? active : null)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', measureStage)
    void nextTick(() => dialogEl.value?.focus())
  } else {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', measureStage)
    restoreFocus()
  }
}, { immediate: true })

function resetView() { natural.value = null; zoom.value = DEFAULT_ZOOM; wheelAcc = 0 }

// Liste d'URL réellement changée (pas seulement un nouveau tableau) : on garde la photo affichée
// si elle y est encore, sinon on va à `startIndex`. Les erreurs sont rattachées à l'URL.
const urlKey = computed(() => (props.items ?? []).map(i => i.url).join('\n'))
watch(urlKey, (_key, oldKey) => {
  const shown = oldKey ? oldKey.split('\n')[index.value] : undefined
  const at = shown === undefined ? -1 : (props.items ?? []).findIndex(i => i.url === shown)
  if (at >= 0) { index.value = at; return }
  failed.value = new Set()
  resetView()
  index.value = clampIndex(props.startIndex)
})
watch(() => props.startIndex, () => { resetView(); index.value = clampIndex(props.startIndex) })
index.value = clampIndex(props.startIndex)

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
        <a :href="current.url" download target="_blank" rel="noopener noreferrer" :class="btn" data-test="photo-download" @click="onDownload">
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
          @load="onImageLoad" @error="markFailed(current.url)"
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
          <ImageOff v-if="failed.has(item.url)" class="h-4 w-4 text-white/70" aria-hidden="true" />
          <img v-else :src="item.url" alt="" loading="lazy" class="h-full w-full object-cover" @error="markFailed(item.url)">
        </button>
      </div>
      <p class="mt-2 text-xs text-white/70">
        ← → pour changer de photo · + / − pour zoomer · Échap pour fermer ·
        <span class="tabular-nums" data-test="photo-position">{{ index + 1 }} sur {{ count }}</span>
      </p>
    </div>
  </div>
</template>
