<script setup lang="ts">
import { computed } from 'vue'
import { needsAnswer, shortName } from '@/features/mobile/lib/mobileSupport'
import type { AdminSupportTicket } from '@/features/support/types/index'
import { formatRelativeFr } from '@/features/notifications/lib/format'
import { serverDateIso } from '@/lib/serverDate'

const props = defineProps<{ ticket: AdminSupportTicket }>()

const when = computed(() => formatRelativeFr(serverDateIso(props.ticket.lastMessageAt)))
const answer = computed(() => needsAnswer(props.ticket))
</script>

<template>
  <NuxtLink
    :to="`/m/support/${ticket.id}`" data-test="support-card"
    class="flex min-h-[56px] items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3"
    :class="ticket.status === 'RESOLVED' ? 'opacity-60' : ''"
  >
    <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="answer ? 'bg-danger' : 'bg-border'" :data-test="answer ? 'support-marker' : undefined" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="flex items-baseline justify-between gap-2">
        <span class="truncate text-sm font-semibold text-text">{{ shortName(ticket.userDisplayName) }}</span>
        <span data-test="support-when" class="shrink-0 whitespace-nowrap text-xs text-text-muted">{{ when }}</span>
      </span>
      <span class="block truncate text-sm text-text">{{ ticket.subject }}</span>
      <span v-if="ticket.lastMessagePreview" class="block truncate text-xs text-text-muted">{{ ticket.lastMessagePreview }}</span>
    </span>
  </NuxtLink>
</template>
