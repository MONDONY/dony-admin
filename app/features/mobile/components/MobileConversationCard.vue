<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import { conversationSeverity, messageCountLabel, pairLabel, reportCountLabel, threadRoute } from '@/features/mobile/lib/mobileMessages'
import type { AdminConversation } from '@/features/moderation/types/index'
import { formatRelativeFr } from '@/features/notifications/lib/format'
import { serverDateIso } from '@/lib/serverDate'

const props = defineProps<{ conversation: AdminConversation }>()

const NuxtLink = resolveComponent('NuxtLink')
const to = computed(() => threadRoute(props.conversation))
const severity = computed(() => conversationSeverity(props.conversation))
const dot = computed(() => ({ danger: 'bg-danger', warning: 'bg-warning', neutral: 'bg-border' }[severity.value]))
const names = computed(() => pairLabel(props.conversation.participantA, props.conversation.participantB))
const tag = computed(() => reportCountLabel(props.conversation))
const when = computed(() => (props.conversation.lastMessageAt ? formatRelativeFr(serverDateIso(props.conversation.lastMessageAt)) : ''))
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'" v-bind="to ? { to } : {}" data-test="conversation-card" :data-severity="severity"
    class="flex min-h-[56px] items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3"
  >
    <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="dot" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-semibold text-text">{{ names }}</span>
      <span v-if="conversation.lastMessagePreview" data-test="conversation-preview" class="block truncate text-sm text-text-muted">« {{ conversation.lastMessagePreview }} »</span>
      <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
        <span v-if="tag" data-test="conversation-tag" class="whitespace-nowrap rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-danger">{{ tag }}</span>
        <span class="whitespace-nowrap">{{ messageCountLabel(conversation.messageCount) }}</span>
        <span v-if="when" data-test="conversation-when" class="whitespace-nowrap">{{ when }}</span>
      </span>
    </span>
  </component>
</template>
