<script setup lang="ts">
import { AvatarImage } from 'radix-vue'
import { type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  class?: HTMLAttributes['class']
  src: string
  alt?: string
}

const props = defineProps<Props>()
</script>

<template>
  <AvatarImage v-bind="props" :class="cn('aspect-square h-full w-full', props.class)" />
</template>
