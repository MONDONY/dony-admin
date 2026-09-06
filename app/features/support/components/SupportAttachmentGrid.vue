<script setup lang="ts">
import type { AdminSupportAttachment } from '@/features/support/types/index'

defineProps<{ attachments: AdminSupportAttachment[] }>()
const emit = defineEmits<{ open: [url: string] }>()
</script>

<template>
  <div v-if="attachments.length" class="flex flex-wrap gap-2">
    <img
      v-for="att in attachments"
      :key="att.id"
      :src="att.url"
      :alt="`Pièce jointe ${att.contentType}`"
      loading="lazy"
      class="h-20 w-20 cursor-pointer rounded-md border border-border object-cover"
      @click="emit('open', att.url)"
    />
  </div>
</template>
