<script setup lang="ts">
import { computed } from 'vue'
import type { AdminNotification } from '@/features/notifications/types/index'
import { formatRelativeFr } from '@/features/notifications/lib/format'
import { notificationIcon } from '@/features/notifications/lib/notificationMeta'
import { feedItemRoute } from '@/features/mobile/lib/mobileAlerts'

const props = withDefaults(defineProps<{ item: AdminNotification; read?: boolean; linked?: boolean }>(), { read: false, linked: true })

const icon = computed(() => notificationIcon(props.item.type))
const when = computed(() => formatRelativeFr(props.item.createdAt))
const to = computed(() => feedItemRoute(props.item))
const box = 'flex min-h-[56px] items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3'
</script>

<template>
  <NuxtLink v-if="linked" :to="to" data-test="mobile-feed-item" :class="[box, read ? 'opacity-60' : '']">
    <component :is="icon" class="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-semibold text-text">{{ item.title }}</span>
      <span v-if="item.summary" class="mt-0.5 block text-xs text-text-muted">{{ item.summary }}</span>
      <span v-if="when" class="mt-0.5 block text-xs text-text-muted">{{ when }}</span>
    </span>
  </NuxtLink>
  <div v-else data-test="mobile-feed-item" :class="[box, read ? 'opacity-60' : '']">
    <component :is="icon" class="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-semibold text-text">{{ item.title }}</span>
      <span v-if="item.summary" class="mt-0.5 block text-xs text-text-muted">{{ item.summary }}</span>
      <span v-if="when" class="mt-0.5 block text-xs text-text-muted">{{ when }}</span>
    </span>
  </div>
</template>
