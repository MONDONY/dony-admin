<script setup lang="ts">
import { computed } from 'vue'
import ModalShell from '@/features/video-modals/components/ModalShell.vue'
import PhoneFrame from '@/features/video-modals/components/PhoneFrame.vue'
import { localized } from '@/features/video-modals/lib/form'
import { MODAL_ICON_STYLES } from '@/features/video-modals/lib/icons'
import type { ImageFit, ImageMode, ModalIcon, ModalLayout, VideoModalActionKind } from '@/features/video-modals/types/index'

/**
 * Aperçu du modal Information tel que l'app le montre : feuille du bas avec halo et icône, titre,
 * sous-titre, texte, puis un ou deux boutons empilés en pleine largeur. Un libellé vide devient
 * « OK » seulement pour l'action Fermer (même repli que le back).
 */
const props = defineProps<{
  lang: 'fr' | 'en'
  icon: ModalIcon
  titleFr: string
  titleEn: string
  subtitleFr: string
  subtitleEn: string
  bodyFr: string
  bodyEn: string
  primaryLabelFr: string
  primaryLabelEn: string
  primaryKind: VideoModalActionKind
  secondaryEnabled: boolean
  secondaryLabelFr: string
  secondaryLabelEn: string
  secondaryKind: VideoModalActionKind
  layout?: ModalLayout
  sizePercent?: number | null
  imageMode?: ImageMode
  imageFit?: ImageFit
  /** Image envoyée, ou fichier choisi avant la création. */
  imageUrl?: string | null
  imageAltFr?: string
  imageAltEn?: string
}>()

const t = (fr: string, en: string) => localized(fr, en, props.lang)
const style = computed(() => MODAL_ICON_STYLES[props.icon] ?? MODAL_ICON_STYLES.INFO)
const title = computed(() => t(props.titleFr, props.titleEn).trim() || (props.lang === 'en' ? 'Modal title' : 'Titre du modal'))
const subtitle = computed(() => t(props.subtitleFr, props.subtitleEn).trim())
const body = computed(() => t(props.bodyFr, props.bodyEn).trim() || (props.lang === 'en' ? 'Modal text.' : 'Texte du modal.'))
function label(fr: string, en: string, kind: VideoModalActionKind) {
  return t(fr, en).trim() || (kind === 'CLOSE' ? 'OK' : '')
}
const primary = computed(() => label(props.primaryLabelFr, props.primaryLabelEn, props.primaryKind))
const secondary = computed(() => label(props.secondaryLabelFr, props.secondaryLabelEn, props.secondaryKind))
const mode = computed(() => props.imageMode ?? 'NONE')
const imageClass = computed(() => (props.imageFit === 'CONTAIN' ? 'object-contain' : 'object-cover'))
// Texte alternatif : repli sur le titre, comme l'app.
const alt = computed(() => t(props.imageAltFr ?? '', props.imageAltEn ?? '').trim() || title.value)
const placeholder = 'Image'
</script>

<template>
  <PhoneFrame :lang="lang">
    <ModalShell :layout="layout" :size-percent="sizePercent" :close-label="lang === 'en' ? 'Close' : 'Fermer'">
      <!-- Affiche : l'image occupe tout le modal au-dessus des boutons, ni titre ni texte -->
      <div
        v-if="mode === 'POSTER'" data-test="vm-preview-poster"
        class="relative -mx-4 min-h-[200px] flex-1 overflow-hidden bg-[#F6F7FA]"
        :class="layout === 'FULLSCREEN' ? '' : 'rounded-t-[26px]'"
      >
        <img v-if="imageUrl" :src="imageUrl" :alt="alt" data-test="vm-preview-image" :class="['absolute inset-0 h-full w-full', imageClass]">
        <span v-else class="absolute inset-0 flex items-center justify-center text-sm text-[#5E6788]">{{ placeholder }}</span>
      </div>
      <template v-else>
        <!-- Bannière : au-dessus du titre et du texte, remplace le halo -->
        <div
          v-if="mode === 'TOP'" data-test="vm-preview-banner"
          class="relative -mx-4 h-[132px] shrink-0 overflow-hidden bg-[#F6F7FA]"
          :class="layout === 'FULLSCREEN' ? '' : 'rounded-t-[26px]'"
        >
          <img v-if="imageUrl" :src="imageUrl" :alt="alt" data-test="vm-preview-image" :class="['absolute inset-0 h-full w-full', imageClass]">
          <span v-else class="absolute inset-0 flex items-center justify-center text-sm text-[#5E6788]">{{ placeholder }}</span>
        </div>
        <div
          v-else data-test="vm-preview-halo" class="mx-auto flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full"
          :class="layout === 'FULLSCREEN' ? 'mt-3' : '-mt-[30px]'"
          :style="{ background: style.bg }"
        >
          <component :is="style.icon" class="h-10 w-10" :style="{ color: style.fg }" aria-hidden="true" />
        </div>
        <h3 data-test="vm-preview-title" class="mx-1 mb-1.5 mt-3 text-center text-[21px] font-bold leading-tight tracking-tight [text-wrap:balance]">{{ title }}</h3>
        <p v-if="subtitle" data-test="vm-preview-subtitle" class="mb-2 text-center text-[13.5px] text-[#5E6788] [text-wrap:pretty]">{{ subtitle }}</p>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <p data-test="vm-preview-body" class="whitespace-pre-line pb-2 text-center text-[14px] leading-snug text-[#0B1535] [text-wrap:pretty]">{{ body }}</p>
        </div>
      </template>
      <div class="mt-auto flex shrink-0 flex-col gap-2 pt-2">
        <div data-test="vm-preview-primary" class="flex h-[46px] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-[#0B5FFF] px-4 text-[15px] font-extrabold text-white">{{ primary }}</div>
        <div v-if="secondaryEnabled" data-test="vm-preview-secondary" class="flex h-[46px] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border-[1.5px] border-[#E3E7F0] bg-white px-4 text-[15px] font-extrabold">{{ secondary }}</div>
      </div>
    </ModalShell>
  </PhoneFrame>
</template>
