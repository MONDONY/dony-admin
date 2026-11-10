<script setup lang="ts">
import { computed } from 'vue'
import type { SituationDraft } from '@/features/video-modals/lib/form'
import { SITUATIONS, type SituationKind } from '@/features/video-modals/types/index'

/**
 * Une situation du serveur, en pastille orange à bord pointillé. Cochée, sa valeur (heures ou jours)
 * devient un champ en orange ; décochée, la valeur proposée reste lisible dans le libellé.
 */
const props = defineProps<{ kind: SituationKind; draft?: SituationDraft }>()
const emit = defineEmits<{
  toggle: []
  'set-value': [value: string]
}>()

const spec = computed(() => SITUATIONS[props.kind])
const on = computed(() => !!props.draft)
const id = computed(() => `vm-sit-${props.kind}`)
const unit = computed(() => (spec.value.unit === 'HOURS' ? 'heures' : 'jours'))
</script>

<template>
  <div
    :data-test="`vm-situation-${kind}`"
    :class="['inline-flex flex-wrap items-center gap-x-1.5 rounded-full border-2 border-dashed px-3.5 py-1.5 text-sm font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary',
             on ? 'border-accent bg-accent/15 text-accent' : 'border-border hover:bg-surface-elevated']"
  >
    <input :id="id" type="checkbox" class="sr-only" :checked="on" @change="emit('toggle')">
    <label v-if="spec.before" :for="id" class="cursor-pointer whitespace-nowrap">{{ spec.before }}</label>
    <template v-if="spec.unit">
      {{ ' ' }}
      <input
        v-if="on" type="number" min="1" :max="spec.max" step="1" :value="draft!.value ?? ''"
        :data-test="`vm-situation-value-${kind}`" :aria-label="`Valeur en ${unit}`"
        class="w-14 rounded-md border border-accent bg-bg px-1.5 py-0.5 text-center font-bold tabular-nums text-accent"
        @input="emit('set-value', ($event.target as HTMLInputElement).value)"
      >
      <label v-else :for="id" class="cursor-pointer tabular-nums">{{ spec.defaultValue }}</label>
      {{ ' ' }}
      <label :for="id" class="cursor-pointer whitespace-nowrap">{{ spec.after }}</label>
    </template>
  </div>
</template>
