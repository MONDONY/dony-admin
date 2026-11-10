<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import type { ModalLayout } from '@/features/video-modals/types/index'

/**
 * Habillage du modal dans le téléphone de l'aperçu : feuille du bas, carte centrée ou plein
 * écran, avec la hauteur maximale en % de l'écran. Centrée et plein écran montrent la croix de
 * fermeture, comme l'app. Sans taille, la feuille garde son rendu d'avant (`fillAuto` : toute la
 * hauteur disponible, pour la vidéo).
 */
const props = withDefaults(defineProps<{
  layout?: ModalLayout
  sizePercent?: number | null
  fillAuto?: boolean
  closeLabel?: string
}>(), { layout: 'BOTTOM_SHEET', sizePercent: null, fillAuto: false, closeLabel: 'Fermer' })

const size = computed(() => (props.layout === 'FULLSCREEN' ? 100 : props.sizePercent))
const hasCross = computed(() => props.layout !== 'BOTTOM_SHEET')

const frameClass = computed(() => {
  if (props.layout === 'FULLSCREEN') return 'inset-0 pt-9'
  if (props.layout === 'CENTERED') return 'inset-x-3.5 top-1/2 -translate-y-1/2 rounded-[26px]'
  return 'inset-x-2.5 bottom-3.5 rounded-[26px]'
})

const frameStyle = computed(() => {
  if (props.layout === 'FULLSCREEN') return undefined
  if (props.layout === 'CENTERED') return { maxHeight: `${size.value ?? 82}%` }
  if (size.value) return { maxHeight: `calc(${size.value}% - 14px)` }
  return props.fillAuto ? { top: '58px' } : { maxHeight: 'calc(100% - 120px)' }
})
</script>

<template>
  <div
    data-test="vm-shell" :data-layout="layout"
    :class="['absolute flex flex-col bg-white px-4 pb-3.5', frameClass]" :style="frameStyle"
  >
    <span
      v-if="hasCross" data-test="vm-preview-close" role="img" :aria-label="closeLabel"
      class="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F3F8] text-[#0B1535]"
    ><X class="h-4 w-4" aria-hidden="true" /></span>
    <slot />
  </div>
</template>
