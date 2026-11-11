<script setup lang="ts">
import { computed } from 'vue'
import type { VideoModalStats, VideoModalType } from '@/features/video-modals/types/index'

const props = defineProps<{ stats: VideoModalStats | null; compact?: boolean; type?: VideoModalType }>()

/** Décision produit : les affichages des visiteurs sans compte ne sont pas comptés. */
const VISITORS_NOTE = 'Les visiteurs sans compte ne sont pas comptés.'
const nf = new Intl.NumberFormat('fr-FR')
const tiles = computed(() => {
  const s = props.stats
  // Information : pas de visionnage, « ouvert » = bouton principal touché.
  const info = props.type === 'INFO'
  return [
    { key: 'shown', value: s?.shown, label: 'affichés' },
    { key: 'opened', value: s?.opened, label: info ? 'bouton touché' : 'vidéo ouverte' },
    ...(info ? [] : [{ key: 'completed', value: s?.completed, label: 'vue en entier' }]),
    { key: 'dismissed', value: s?.dismissed, label: 'ignorés' },
    { key: 'dontShowAgain', value: s?.dontShowAgain, label: 'ne plus afficher' },
  ].map(t => ({ ...t, text: typeof t.value === 'number' ? nf.format(t.value) : '0' }))
})
</script>

<template>
  <div v-if="compact" class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted" data-test="vm-stats-compact" :title="VISITORS_NOTE">
    <span v-for="t in tiles" :key="t.key" class="whitespace-nowrap">
      <b class="font-semibold tabular-nums text-text">{{ t.text }}</b> {{ t.label }}
    </span>
  </div>
  <div v-else class="grid grid-cols-2 gap-2.5" :class="tiles.length >= 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'" data-test="vm-stats">
    <div v-for="t in tiles" :key="t.key" :data-test="`vm-stat-${t.key}`" class="rounded-card bg-surface-elevated p-3">
      <b class="block font-display text-[22px] font-semibold tabular-nums">{{ t.text }}</b>
      <span class="text-xs text-text-muted">{{ t.label }}</span>
    </div>
    <p data-test="vm-stats-visitors-note" class="col-span-full text-xs text-text-muted">{{ VISITORS_NOTE }}</p>
  </div>
</template>
