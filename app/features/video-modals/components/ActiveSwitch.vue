<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

/**
 * Interrupteur : la valeur affichée suit `modelValue`, que le parent peut mettre à jour tout de suite
 * (mise à jour optimiste). `loading` montre qu'une demande est en vol, sans bloquer d'autres clics.
 */
defineProps<{ modelValue: boolean; disabled?: boolean; loading?: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button" role="switch" :aria-checked="modelValue" :aria-label="label" :aria-busy="loading || undefined" :disabled="disabled"
    data-test="vm-switch"
    :class="['relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50',
             modelValue ? 'bg-success' : 'bg-border']"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      :class="['inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white shadow transition-transform',
               modelValue ? 'translate-x-[19px]' : 'translate-x-[3px]']"
    >
      <Loader2 v-if="loading" data-test="vm-switch-loading" class="h-3 w-3 animate-spin text-text-muted" aria-hidden="true" />
    </span>
  </button>
</template>
