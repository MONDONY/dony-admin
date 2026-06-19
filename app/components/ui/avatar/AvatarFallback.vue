<script setup lang="ts">
import { AvatarFallback } from 'radix-vue'
import { type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  class?: HTMLAttributes['class']
  delayMs?: number
}

const props = defineProps<Props>()
</script>

<template>
  <AvatarFallback
    v-bind="props"
    :class="cn('flex h-full w-full items-center justify-center rounded-full bg-surface text-sm font-medium', props.class)"
  >
    <slot />
  </AvatarFallback>
</template>
