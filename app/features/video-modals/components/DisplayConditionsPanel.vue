<script setup lang="ts">
import { computed } from 'vue'
import { buildDisplayConditions, type Verdict } from '@/features/video-modals/lib/displayConditions'
import type { VideoModalErrors } from '@/features/video-modals/lib/validation'
import type { VideoModalInput } from '@/features/video-modals/types/index'

/**
 * « Conditions d'affichage » : lecture seule, mise à jour en direct. Liste, pour cette campagne, tout ce qui peut
 * l'empêcher de s'afficher, avec une pastille par ligne, puis les règles automatiques de l'app.
 */
const props = defineProps<{
  input: VideoModalInput
  active: boolean
  errors: VideoModalErrors
  now?: Date
}>()

const result = computed(() => buildDisplayConditions(props.input, { active: props.active, errors: props.errors, now: props.now }))
const groups = computed(() => {
  const map = new Map<string, typeof result.value.rows>()
  for (const r of result.value.rows) map.set(r.group, [...(map.get(r.group) ?? []), r])
  return [...map.entries()]
})
const isInfo = computed(() => props.input.type === 'INFO')

const VERDICT: Record<Verdict, { text: string, cls: string }> = {
  ok: { text: 'Remplie', cls: 'bg-success/15 text-success' },
  check: { text: 'À vérifier', cls: 'bg-warning/15 text-warning' },
  block: { text: 'Bloque l’affichage', cls: 'bg-danger/15 text-danger' },
}
</script>

<template>
  <section data-test="vm-display-conditions" class="rounded-card border border-border px-5 py-4 text-sm">
    <h3 class="text-base font-semibold">Conditions d’affichage</h3>
    <p class="mt-1 text-xs text-text-muted text-pretty">
      Tout ce qui peut empêcher {{ isInfo ? 'cette information' : 'cette vidéo' }} de s’afficher, selon les réglages ci-dessus.
    </p>
    <p v-if="result.blocked" data-test="vm-dc-blocked" role="status" class="mt-3 rounded-btn bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
      Au moins une condition bloque l’affichage : la campagne ne sera pas vue tant qu’elle n’est pas levée.
    </p>
    <div v-for="[group, rows] in groups" :key="group" class="mt-4">
      <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{{ group }}</h4>
      <ul class="divide-y divide-border">
        <li v-for="r in rows" :key="r.id" :data-test="`vm-dc-${r.id}`" :data-verdict="r.verdict" class="flex flex-wrap items-start justify-between gap-2 py-2">
          <span class="min-w-0 flex-1">
            <b class="block font-semibold">{{ r.label }}</b>
            <span class="text-xs text-text-muted text-pretty">{{ r.detail }}</span>
          </span>
          <span :class="['whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', VERDICT[r.verdict].cls]" data-test="vm-dc-badge">{{ VERDICT[r.verdict].text }}</span>
        </li>
      </ul>
    </div>
    <div data-test="vm-dc-common" class="mt-4 border-t border-border pt-3">
      <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Règles communes</h4>
      <ul class="list-disc space-y-1 pl-5 text-xs text-text-muted text-pretty">
        <li v-for="(c, i) in result.common" :key="i">{{ c }}</li>
      </ul>
    </div>
  </section>
</template>
