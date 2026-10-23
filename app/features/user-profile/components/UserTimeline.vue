<script setup lang="ts">
import { linkForTimeline } from '@/features/user-profile/lib/objectLinks'
import type { TimelineEntry } from '@/features/user-profile/types/index'

defineProps<{ entries: TimelineEntry[] }>()

const DOT: Record<string, string> = {
  PARCEL: 'bg-primary', PAYMENT: 'bg-success', DISPUTE: 'bg-danger', REPORT: 'bg-warning',
}
const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' })
const when = (iso: string) => dateFmt.format(new Date(iso))
</script>

<template>
  <section data-test="timeline-card" class="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
    <h2 class="text-base font-semibold">Dernière activité</h2>
    <p v-if="entries.length === 0" data-test="timeline-empty" class="text-sm text-text-muted">Aucune activité récente</p>
    <ol v-else class="flex flex-col gap-3">
      <li v-for="(e, idx) in entries" :key="idx" data-test="timeline-entry" class="flex gap-3">
        <span data-test="timeline-dot" :class="['mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', DOT[e.kind] ?? 'bg-border']" aria-hidden="true" />
        <div class="flex min-w-0 flex-col gap-0.5">
          <span data-test="timeline-title" class="text-sm font-medium">{{ e.title }}</span>
          <span class="break-words text-sm text-text-muted">{{ e.detail }}</span>
          <span class="text-xs tabular-nums text-text-muted">
            {{ when(e.at) }}
            <template v-if="linkForTimeline(e)"> · <NuxtLink :to="linkForTimeline(e)!" class="text-primary hover:underline">Ouvrir</NuxtLink></template>
          </span>
        </div>
      </li>
    </ol>
  </section>
</template>
