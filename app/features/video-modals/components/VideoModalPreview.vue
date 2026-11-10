<script setup lang="ts">
import { computed } from 'vue'
import { Lock, Luggage, MessageCircle, Package, Play, QrCode, Search, Sparkles, Star, Wallet } from 'lucide-vue-next'
import type { Component } from 'vue'
import PhoneFrame from '@/features/video-modals/components/PhoneFrame.vue'
import { extractYoutubeId, formatDuration, youtubeThumbnailUrl } from '@/features/video-modals/lib/youtube'
import { localized } from '@/features/video-modals/lib/form'
import type { HighlightIcon, VideoModalHighlight } from '@/features/video-modals/types/index'

/**
 * Aperçu du modal tel que l'app le montre (maquette `modal-video-accueil.html`, section 1) :
 * feuille sur fond assombri, miniature YouTube, 0 à 3 points forts, deux boutons empilés en
 * pleine largeur dans le bas fixe. Couleurs de l'app, unies, quel que soit le thème de l'admin.
 */
const props = defineProps<{
  lang: 'fr' | 'en'
  youtubeUrl: string
  durationSeconds: number | string | null
  titleFr: string
  titleEn: string
  subtitleFr: string
  subtitleEn: string
  primaryLabelFr: string
  primaryLabelEn: string
  secondaryLabelFr: string
  secondaryLabelEn: string
  highlights: VideoModalHighlight[]
}>()

const ICONS: Record<HighlightIcon, { icon: Component; fg: string; bg: string }> = {
  PARCEL: { icon: Package, fg: '#D96A3A', bg: '#FBE7DC' },
  SUITCASE: { icon: Luggage, fg: '#0B5FFF', bg: '#EAF1FF' },
  LOCK: { icon: Lock, fg: '#16A34A', bg: '#DCFCE7' },
  SEARCH: { icon: Search, fg: '#0B5FFF', bg: '#EAF1FF' },
  CHAT: { icon: MessageCircle, fg: '#0B5FFF', bg: '#EAF1FF' },
  QR: { icon: QrCode, fg: '#041D54', bg: '#E6EAF3' },
  STAR: { icon: Star, fg: '#B7791F', bg: '#FFF4D6' },
  WALLET: { icon: Wallet, fg: '#16A34A', bg: '#DCFCE7' },
}

const videoId = computed(() => extractYoutubeId(props.youtubeUrl))
const thumbnail = computed(() => (videoId.value ? youtubeThumbnailUrl(videoId.value) : null))
const duration = computed(() => {
  const n = typeof props.durationSeconds === 'string' ? Number(props.durationSeconds) : props.durationSeconds
  return formatDuration(n)
})

const t = (fr: string, en: string) => localized(fr, en, props.lang)
const placeholderTitle = computed(() => (props.lang === 'en' ? 'Modal title' : 'Titre du modal'))
const title = computed(() => t(props.titleFr, props.titleEn).trim() || placeholderTitle.value)
const subtitle = computed(() => t(props.subtitleFr, props.subtitleEn).trim())
const primary = computed(() => t(props.primaryLabelFr, props.primaryLabelEn).trim())
const secondary = computed(() => t(props.secondaryLabelFr, props.secondaryLabelEn).trim())
const listLabel = computed(() => (props.lang === 'en' ? 'With Yadony, you can' : 'Avec Yadony, vous pouvez'))
const items = computed(() =>
  props.highlights
    .map(h => ({ ...ICONS[h.icon] ?? ICONS.PARCEL, text: t(h.textFr, h.textEn).trim() }))
    .filter(h => h.text.length > 0),
)
</script>

<template>
  <PhoneFrame :lang="lang">
      <div class="absolute inset-x-2.5 bottom-3.5 top-[58px] flex flex-col rounded-[26px] bg-white px-4 pb-3.5">
        <div class="mx-auto -mt-[30px] flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full bg-[#EAF1FF]">
          <Sparkles class="h-10 w-10 text-[#0B5FFF]" aria-hidden="true" />
        </div>
        <h3 data-test="vm-preview-title" class="mx-1 mb-1.5 mt-3 text-center text-[21px] font-bold leading-tight tracking-tight [text-wrap:balance]">{{ title }}</h3>
        <p v-if="subtitle" data-test="vm-preview-subtitle" class="mb-3 text-center text-[13.5px] text-[#5E6788] [text-wrap:pretty]">{{ subtitle }}</p>

        <div class="relative mb-2.5 mt-0.5 flex h-24 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#041D54]" data-test="vm-preview-thumb">
          <img
            v-if="thumbnail" :src="thumbnail" alt="" data-test="vm-preview-thumb-img"
            class="absolute inset-0 h-full w-full object-cover" referrerpolicy="no-referrer"
          >
          <span v-else class="absolute left-2.5 top-2 text-xs font-bold text-white">{{ lang === 'en' ? 'Video' : 'Vidéo' }}</span>
          <span class="relative flex h-11 w-11 items-center justify-center rounded-full bg-white">
            <Play class="h-[18px] w-[18px] fill-[#041D54] text-[#041D54]" aria-hidden="true" />
          </span>
          <span v-if="duration" data-test="vm-preview-duration" class="absolute bottom-2 right-2 rounded-lg bg-black/60 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">{{ duration }}</span>
        </div>

        <div class="min-h-0 overflow-hidden">
          <p v-if="items.length" class="mb-2 text-center text-[13px] font-extrabold">{{ listLabel }}</p>
          <div
            v-for="(h, i) in items" :key="i" :data-test="`vm-preview-item-${i}`"
            class="mb-[7px] flex items-center gap-[11px] rounded-[14px] bg-[#F6F7FA] px-3 py-[11px] text-[13.5px] leading-snug"
          >
            <span class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]" :style="{ background: h.bg }">
              <component :is="h.icon" class="h-[18px] w-[18px]" :style="{ color: h.fg }" aria-hidden="true" />
            </span>
            <span class="min-w-0">{{ h.text }}</span>
          </div>
        </div>

        <div class="mt-auto flex shrink-0 flex-col gap-2 pt-2">
          <div data-test="vm-preview-primary" class="flex h-[46px] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-[#0B5FFF] px-4 text-[15px] font-extrabold text-white">{{ primary }}</div>
          <div data-test="vm-preview-secondary" class="flex h-[46px] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border-[1.5px] border-[#E3E7F0] bg-white px-4 text-[15px] font-extrabold">{{ secondary }}</div>
        </div>
      </div>
  </PhoneFrame>
</template>
