<script setup lang="ts">
import { ref } from 'vue'
import BidPhotoGallery from './BidPhotoGallery.vue'
import BidTimeline from './BidTimeline.vue'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'

/**
 * Onglet Suivi : photos par étape en haut, chronologie complète dessous. Quand la galerie montre
 * réellement les photos, la chronologie n'a qu'une pastille « Photo » (une seule visionneuse par
 * photo) ; pendant le chargement, en erreur ou face à un ancien back, elle garde ses miniatures.
 */
defineProps<{ bid: AdminBidDetail; timeline: AdminBidTimeline | null; loading?: boolean; error?: string | null }>()
const emit = defineEmits<{ 'reload-bid': [] }>()

const displayed = ref(false)
</script>

<template>
  <div class="flex flex-col gap-6" data-test="bid-tracking-tab">
    <BidPhotoGallery :bid="bid" :timeline="timeline" @update:displayed="displayed = $event" @reload-bid="emit('reload-bid')" />
    <section data-test="section-timeline" aria-labelledby="bid-timeline-title">
      <h3 id="bid-timeline-title" class="mb-2 text-sm font-semibold">Chronologie</h3>
      <BidTimeline :timeline="timeline" :loading="loading" :error="error" :gallery-active="displayed" />
    </section>
  </div>
</template>
