<script setup lang="ts">
import { computed } from 'vue'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import { alertSeverityMeta } from '@/features/alerts/components/alertSeverity'
import type { AdminAlert } from '@/features/alerts/types/index'
import { formatRelativeFr } from '@/features/notifications/lib/format'
import { serverDateIso } from '@/lib/serverDate'

const props = defineProps<{ alert: AdminAlert }>()

const title = computed(() => alertGuide(props.alert.type).title)
const meta = computed(() => alertSeverityMeta(props.alert.severity))
const when = computed(() => formatRelativeFr(serverDateIso(props.alert.createdAt)))
const dot = computed(() => ({ danger: 'bg-danger', warning: 'bg-warning', info: 'bg-primary' }[meta.value.tone]))
</script>

<template>
  <NuxtLink
    :to="`/m/alertes/${alert.id}`"
    data-test="mobile-alert-card"
    :data-severity="alert.severity"
    class="flex min-h-[56px] items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3"
    :class="alert.resolved ? 'opacity-60' : ''"
  >
    <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="dot" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-semibold text-text">{{ title }}</span>
      <span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
        <span>{{ meta.label }}</span>
        <span v-if="when">{{ when }}</span>
        <span v-if="alert.claimedAt" data-test="claimed-flag" class="font-semibold text-primary">Pris en charge</span>
      </span>
    </span>
  </NuxtLink>
</template>
