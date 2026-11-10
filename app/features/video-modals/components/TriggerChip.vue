<script setup lang="ts">
import { TRIGGER_CHIP_LABELS, type VideoModalTrigger } from '@/features/video-modals/types/index'

/** Une pastille de moment (bleue) : écran, bouton ou moment d'action. Cochée, elle passe en bleu plein. */
defineProps<{ trigger: VideoModalTrigger; checked: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <label
    :data-test="`vm-trigger-${trigger}`"
    :class="['inline-flex cursor-pointer items-center rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary',
             checked ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-surface-elevated']"
  >
    <input type="checkbox" class="sr-only" :checked="checked" @change="emit('toggle')">
    {{ TRIGGER_CHIP_LABELS[trigger] }}
  </label>
</template>
