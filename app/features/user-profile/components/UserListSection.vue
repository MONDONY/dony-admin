<script setup lang="ts">
import { onMounted, useId } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useUserSection } from '@/features/user-profile/composables/useUserSection'
import type { SectionColumn } from '@/features/user-profile/lib/sectionColumns'
import type { UserSection } from '@/features/user-profile/types/index'

const props = defineProps<{
  title: string
  hint?: string
  columns: SectionColumn[]
  section: UserSection
  userId: string
  extra?: Record<string, string>
  // eslint-disable-next-line no-unused-vars
  linkFor?: (row: any) => string | null
  emptyLabel: string
}>()

const list = useUserSection<Record<string, unknown>>(props.userId, props.section, props.extra)
const titleId = `section-${useId()}`

const cell = (c: SectionColumn, row: Record<string, unknown>): string => {
  if (c.format) return c.format(row)
  const v = row[c.key]
  return v == null || v === '' ? '—' : String(v)
}
const rowName = (row: Record<string, unknown>): string => {
  const parts = props.columns.slice(0, 2).map(c => cell(c, row)).filter(t => t !== '—')
  return parts.length ? parts.join(' ') : props.title
}

onMounted(list.load)
</script>

<template>
  <section :data-test="`section-${section}${extra?.direction ? `-${extra.direction.toLowerCase()}` : ''}`" :aria-labelledby="titleId" class="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h2 :id="titleId" class="text-base font-semibold">{{ title }}</h2>
      <slot name="action" />
    </header>
    <p v-if="hint" data-test="section-hint" class="text-sm text-text-muted">{{ hint }}</p>

    <StateBlock
      :loading="list.isLoading.value"
      :error="list.error.value"
      :empty="list.loaded.value && !list.error.value && list.rows.value.length === 0"
      :empty-label="emptyLabel"
      @retry="list.reload"
    />

    <div v-if="list.rows.value.length > 0" class="overflow-x-auto">
      <table :aria-labelledby="titleId" class="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr class="text-xs text-text-muted">
            <th v-for="c in columns" :key="c.key" scope="col" class="py-2 pr-3 font-semibold">{{ c.label }}</th>
            <th v-if="linkFor" scope="col" class="py-2 font-semibold"><span class="sr-only">Ouvrir</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in list.rows.value" :key="String(row.id ?? i)" data-test="section-row" class="border-t border-border">
            <td v-for="c in columns" :key="c.key" class="py-2 pr-3 align-top">
              <StatusBadge v-if="c.tone && c.tone(row)" :label="cell(c, row)" :tone="c.tone(row)!" />
              <template v-else>{{ cell(c, row) }}</template>
            </td>
            <td v-if="linkFor" class="py-2">
              <NuxtLink v-if="linkFor(row)" :to="linkFor(row)!" :aria-label="`Ouvrir ${rowName(row)}`" class="text-primary hover:underline">Ouvrir</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationControls v-if="list.totalPages.value > 1" :page="list.page.value" :total-pages="list.totalPages.value" @change="list.goToPage" />
  </section>
</template>
