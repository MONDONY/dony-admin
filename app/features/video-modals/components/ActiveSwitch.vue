<script setup lang="ts">
defineProps<{ modelValue: boolean; disabled?: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button" role="switch" :aria-checked="modelValue" :aria-label="label" :disabled="disabled"
    data-test="vm-switch"
    :class="['relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50',
             modelValue ? 'bg-success' : 'bg-border']"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      :class="['inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
               modelValue ? 'translate-x-[19px]' : 'translate-x-[3px]']"
    />
  </button>
</template>
