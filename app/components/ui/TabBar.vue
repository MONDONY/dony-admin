<script setup lang="ts" generic="T extends string">
import { computed, ref } from 'vue'

export interface TabItem<Id extends string = string> {
  id: Id
  label: string
  /** Onglets consécutifs de même groupe : ils partagent une étiquette et un séparateur. */
  group?: string
  /** Pastille (ex. file d'attente) ; masquée à zéro. */
  count?: number
  /** Pastille d'alerte (rouge) plutôt que neutre. */
  alert?: boolean
  /** Affiche la pastille même à zéro. */
  showZero?: boolean
}

const props = withDefaults(defineProps<{
  tabs: TabItem<T>[]
  modelValue: T
  ariaLabel?: string
  /** `pill` : puces pleines ; `underline` : onglets soulignés. */
  variant?: 'pill' | 'underline'
  /** Préfixe des `data-test` : `${testPrefix}-${id}`. */
  testPrefix?: string
  /** Si fourni, chaque bouton reçoit `id="${idPrefix}-${id}"` (pour `aria-labelledby` des panneaux). */
  idPrefix?: string
}>(), { ariaLabel: 'Sections', variant: 'pill', testPrefix: 'tab', idPrefix: undefined })
const emit = defineEmits<{ 'update:modelValue': [id: T] }>()

const root = ref<HTMLElement | null>(null)

/** Découpe en blocs consécutifs de même groupe ; sans groupe, un seul bloc sans étiquette. */
const blocks = computed(() => {
  const out: { group?: string; tabs: TabItem<T>[] }[] = []
  for (const t of props.tabs) {
    const last = out[out.length - 1]
    if (last && last.group === t.group) last.tabs.push(t)
    else out.push({ group: t.group, tabs: [t] })
  }
  return out
})

function select(id: T) {
  if (id !== props.modelValue) emit('update:modelValue', id)
}

/** ← → Début Fin déplacent le focus et la sélection, comme une barre d'onglets native. */
function onKey(e: KeyboardEvent, index: number) {
  const last = props.tabs.length - 1
  const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
    : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
        : e.key === 'End' ? last
          : -1
  if (next < 0) return
  e.preventDefault()
  const target = props.tabs[next]
  if (!target) return
  select(target.id)
  const buttons = root.value?.querySelectorAll<HTMLButtonElement>('button[data-tab-id]')
  buttons?.[next]?.focus()
}

const indexOf = (id: string) => props.tabs.findIndex(t => t.id === id)
const cls = (active: boolean) => props.variant === 'underline'
  ? ['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
    active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text']
  : ['rounded-full px-3 py-1.5 text-sm transition-colors',
    active ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']
</script>

<template>
  <div
    ref="root" role="group" :aria-label="ariaLabel"
    :class="['flex flex-wrap items-end', variant === 'underline' ? 'gap-1 border-b border-border' : 'gap-x-4 gap-y-2']"
  >
    <div v-for="(b, bi) in blocks" :key="bi" class="flex flex-col gap-1" :data-test="b.group ? `tab-group-${b.group}` : undefined">
      <span v-if="b.group" class="px-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{ b.group }}</span>
      <div class="flex gap-1">
        <button
          v-for="t in b.tabs" :key="t.id" type="button"
          :id="idPrefix ? `${idPrefix}-${t.id}` : undefined" :data-test="`${testPrefix}-${t.id}`" :data-tab-id="t.id" :aria-pressed="modelValue === t.id"
          :class="cls(modelValue === t.id)"
          @click="select(t.id)" @keydown="onKey($event, indexOf(t.id))"
        >
          {{ t.label }}
          <span
            v-if="t.count != null && (t.count > 0 || t.showZero)" data-test="tab-count"
            :class="['ml-1.5 rounded-full px-1.5 text-xs tabular-nums', t.alert ? 'bg-danger/10 text-danger' : 'bg-black/10']"
          >{{ t.count > 99 ? '99+' : t.count }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
