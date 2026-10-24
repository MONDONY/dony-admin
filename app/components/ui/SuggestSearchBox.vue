<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

export interface SuggestItem { key: string; title: string; sub?: string; count?: number; mono?: boolean }
export interface SuggestGroup { key: string; label: string; items: SuggestItem[] }

/**
 * Recherche à suggestions groupées, indépendante du métier (combobox ARIA : listbox, ↑/↓ en boucle,
 * Entrée, Échap, clic extérieur). Le parent fournit les groupes et reçoit `pick(groupe, élément)`.
 */
const props = defineProps<{
  modelQuery: string
  groups: SuggestGroup[]
  placeholder: string
  ariaLabel: string
  /** Préfixe des `data-test` : `${testPrefix}-search`, `-search-submit`, `-suggestion-<groupe>-<rang>`. */
  testPrefix: string
  disabled?: boolean
  /** Unité du nombre affiché à droite d'une option : [singulier, pluriel] (« 1 paiement », « 3 paiements »). */
  countUnit?: [string, string]
  /** Changer cette valeur remet le texte du champ sur `modelQuery` (après un choix, même si la requête n'a pas changé). */
  resetKey?: number
}>()
const emit = defineEmits<{
  'update:query': [string]
  type: [string]
  pick: [groupKey: string, itemKey: string]
}>()

/** Nombre de caractères avant d'ouvrir la liste. */
const MIN_CHARS = 2

const q = ref(props.modelQuery ?? '')
watch(() => [props.modelQuery, props.resetKey], () => { q.value = props.modelQuery ?? '' })

const open = ref(false)
const listId = `suggest-${useId()}`
const root = ref<HTMLElement | null>(null)

// Clic extérieur : ferme la liste (les options gardent le focus du champ via mousedown.prevent).
function onDocDown(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))
const active = ref(-1)

interface Flat { groupKey: string; itemKey: string; index: number; id: string; item: SuggestItem }
const shownGroups = computed(() => props.groups.filter(g => g.items.length > 0))
const flat = computed<Flat[]>(() => shownGroups.value.flatMap(g => g.items.map((item, index) => ({
  groupKey: g.key, itemKey: item.key, index, id: `${listId}-${g.key}-${index}`, item,
}))))
const showList = computed(() => open.value && !props.disabled && q.value.trim().length >= MIN_CHARS && flat.value.length > 0)
const activeId = computed(() => (showList.value && active.value >= 0 ? flat.value[active.value]?.id : undefined))

watch(flat, () => { active.value = -1 })

function onInput() {
  open.value = true
  active.value = -1
  emit('type', q.value)
}
function submit() {
  open.value = false
  emit('update:query', q.value.trim())
}
function pick(f: Flat) {
  open.value = false
  active.value = -1
  emit('pick', f.groupKey, f.itemKey)
}
function onKey(e: KeyboardEvent) {
  const n = flat.value.length
  if (e.key === 'ArrowDown' && showList.value) {
    e.preventDefault()
    active.value = active.value >= n - 1 ? 0 : active.value + 1
  } else if (e.key === 'ArrowUp' && showList.value) {
    e.preventDefault()
    active.value = active.value <= 0 ? n - 1 : active.value - 1
  } else if (e.key === 'Escape') {
    // Liste ouverte : Échap ne doit pas aussi vider le champ `type="search"`.
    if (showList.value) e.preventDefault()
    open.value = false
    active.value = -1
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const f = showList.value ? flat.value[active.value] : undefined
    if (f) pick(f)
    else submit()
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="q" type="search" :data-test="`${testPrefix}-search`" role="combobox" autocomplete="off"
        :aria-label="ariaLabel" aria-autocomplete="list" aria-haspopup="listbox"
        :aria-expanded="showList" :aria-controls="showList ? listId : undefined" :aria-activedescendant="activeId"
        :placeholder="placeholder"
        class="min-h-10 min-w-[240px] flex-1 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @input="onInput" @keydown="onKey" @focus="open = true" @blur="open = false"
      >
      <button
        type="button" :data-test="`${testPrefix}-search-submit`"
        class="inline-flex min-h-10 items-center rounded-btn bg-primary px-4 text-sm font-medium text-white transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        @click="submit"
      >Chercher</button>
    </div>

    <div
      v-if="showList" :id="listId" role="listbox" aria-label="Suggestions"
      class="absolute left-0 right-0 z-20 mt-1 max-h-96 overflow-auto rounded-card border border-border bg-surface py-1 shadow-lg"
    >
      <div v-for="g in shownGroups" :key="g.key" role="group" :aria-label="g.label">
        <p class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{ g.label }}</p>
        <div
          v-for="f in flat.filter(x => x.groupKey === g.key)" :id="f.id" :key="f.id" role="option" :aria-selected="activeId === f.id"
          :data-test="`${testPrefix}-suggestion-${f.groupKey}-${f.index}`"
          :class="['flex min-h-10 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm', activeId === f.id ? 'bg-surface-elevated' : 'hover:bg-surface-elevated']"
          @mousedown.prevent @click="pick(f)"
        >
          <span class="min-w-0 truncate" :class="f.item.mono ? 'font-mono' : ''">{{ f.item.title }}<span v-if="f.item.sub" class="ml-2 font-sans text-xs text-text-muted">{{ f.item.sub }}</span></span>
          <span v-if="f.item.count != null" class="shrink-0 text-xs tabular-nums text-text-muted">{{ f.item.count }}{{ countUnit ? ` ${f.item.count > 1 ? countUnit[1] : countUnit[0]}` : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
