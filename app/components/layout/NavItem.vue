<script setup lang="ts">
defineProps<{
  to: string
  label: string
  badge?: number
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex items-center gap-3 px-4 py-2.5 rounded-btn text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
    active-class="bg-primary/10 text-primary"
  >
    <slot name="icon" />
    <span class="flex-1 text-sm font-medium">{{ label }}</span>
    <span
      v-if="badge && badge > 0"
      data-test="badge"
      class="text-xs font-semibold bg-primary text-white rounded-full px-2 py-0.5 min-w-[20px] text-center"
    >
      {{ badge }}
    </span>
  </NuxtLink>
</template>
