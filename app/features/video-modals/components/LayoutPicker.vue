<script setup lang="ts">
import { computed } from 'vue'
import { LAYOUT_LABELS, MODAL_LAYOUTS, SIZE_MAX, SIZE_MIN, SIZE_STEP, type ModalLayout } from '@/features/video-modals/types/index'

/**
 * Format du modal en trois cartes visuelles, et taille (30 à 100 % de la hauteur de l'écran,
 * ou automatique). La taille est sans effet en plein écran : le curseur est alors désactivé.
 */
const props = defineProps<{ layout: ModalLayout; sizePercent: number | null; error?: string; sizeError?: string }>()
const emit = defineEmits<{
  'update:layout': [value: ModalLayout]
  'update:sizePercent': [value: number | null]
}>()

const fullscreen = computed(() => props.layout === 'FULLSCREEN')
const auto = computed(() => props.sizePercent === null)
const shownSize = computed(() => (fullscreen.value ? SIZE_MAX : props.sizePercent ?? SIZE_MAX))

function onAuto(checked: boolean) {
  emit('update:sizePercent', checked ? null : 60)
}
function onRange(e: Event) {
  emit('update:sizePercent', Number((e.target as HTMLInputElement).value))
}

/** Silhouette de chaque format dans un mini écran (couleurs unies). */
const SHAPES: Record<ModalLayout, string> = {
  BOTTOM_SHEET: 'inset-x-1.5 bottom-1.5 h-9 rounded-lg',
  CENTERED: 'inset-x-2 top-1/2 h-9 -translate-y-1/2 rounded-lg',
  FULLSCREEN: 'inset-0 rounded-sm',
}
</script>

<template>
  <fieldset data-test="vm-format">
    <legend class="mb-2 block text-xs font-semibold text-text-muted">Format du modal</legend>
    <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Format du modal">
      <button
        v-for="l in MODAL_LAYOUTS" :key="l" type="button" role="radio" :aria-checked="layout === l"
        :data-test="`vm-layout-${l}`"
        :class="['flex flex-col items-center gap-2 rounded-btn border px-3 py-3 text-center text-sm transition-colors',
                 layout === l ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-elevated']"
        @click="emit('update:layout', l)"
      >
        <span class="relative block h-[72px] w-11 overflow-hidden rounded-md border border-border bg-[#F1F3F8]" aria-hidden="true">
          <span :class="['absolute bg-[#0B5FFF]', SHAPES[l]]" />
        </span>
        <span class="font-semibold">{{ LAYOUT_LABELS[l].label }}</span>
        <span class="text-xs text-text-muted text-pretty">{{ LAYOUT_LABELS[l].hint }}</span>
      </button>
    </div>
    <p v-if="error" class="mt-1 text-xs text-danger">{{ error }}</p>

    <div class="mt-3 rounded-btn border border-border px-4 py-3" :class="fullscreen ? 'opacity-60' : ''">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-semibold text-text-muted">Taille (hauteur maximale de l’écran)</span>
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox" class="accent-primary" data-test="vm-size-auto"
            :checked="auto && !fullscreen" :disabled="fullscreen" @change="onAuto(($event.target as HTMLInputElement).checked)"
          >
          Automatique
        </label>
      </div>
      <div class="mt-2 flex items-center gap-3">
        <input
          type="range" data-test="vm-size-range" class="w-full accent-primary" aria-label="Taille du modal en pourcentage"
          :min="SIZE_MIN" :max="SIZE_MAX" :step="SIZE_STEP" :value="shownSize" :disabled="fullscreen || auto" @input="onRange"
        >
        <output data-test="vm-size-value" class="w-14 text-right text-sm font-semibold tabular-nums">
          {{ fullscreen ? '100 %' : auto ? 'Auto' : `${sizePercent} %` }}
        </output>
      </div>
      <p class="mt-1 text-xs text-text-muted text-pretty">
        <template v-if="fullscreen">Le plein écran occupe toujours toute la hauteur : la taille ne s’applique pas.</template>
        <template v-else>Automatique : la hauteur suit le contenu. Sinon, le contenu défile au-delà de la taille choisie et les boutons restent fixes en bas.</template>
      </p>
      <p v-if="sizeError" class="mt-1 text-xs text-danger">{{ sizeError }}</p>
    </div>
  </fieldset>
</template>
