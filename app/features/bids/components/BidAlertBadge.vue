<script setup lang="ts">
import { computed } from 'vue'
import { alertMeta } from '@/features/bids/lib/bidViews'

const props = defineProps<{ code?: string | null }>()
const meta = computed(() => alertMeta(props.code))
</script>

<template>
  <span
    v-if="meta" data-test="bid-alert"
    :class="['inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', meta.tone === 'danger' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning']"
  >{{ meta.shortLabel }}</span>
</template>
