<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { bidStatusMeta } from './bidStatus'
import { BID_SEARCH_SCOPES } from '@/features/bids/lib/bidPageFilters'
import type { AdminBidSuggest, BidSearchScope, BidStatus } from '@/features/bids/types/index'

export type BidSuggestionKind = 'sender' | 'traveler' | 'recipient' | 'trip' | 'parcel'
type Payload = AdminBidSuggest['senders'][number] | AdminBidSuggest['recipients'][number] | AdminBidSuggest['trips'][number] | AdminBidSuggest['parcels'][number]

const props = defineProps<{
  modelQuery: string
  modelScope: BidSearchScope
  suggestions: AdminBidSuggest | null
  suggestionsDisabled: boolean
}>()
const emit = defineEmits<{
  'update:query': [string]
  'update:scope': [BidSearchScope]
  type: [string]
  pick: [BidSuggestionKind, Payload]
}>()

const SCOPES = BID_SEARCH_SCOPES

const q = ref(props.modelQuery ?? '')
watch(() => props.modelQuery, v => { q.value = v ?? '' })

const open = ref(false)
const listId = `bid-suggestions-${useId()}`
const root = ref<HTMLElement | null>(null)

// Clic extérieur : ferme la liste (les options gardent le focus du champ via mousedown.prevent).
function onDocDown(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))
const active = ref(-1)

interface Item { kind: BidSuggestionKind; index: number; title: string; sub: string | null; count: number | null; payload: Payload }
interface Group { kind: BidSuggestionKind; label: string; items: Item[] }

const groups = computed<Group[]>(() => {
  const s = props.suggestions
  if (!s) return []
  const out: Group[] = [
    { kind: 'sender', label: 'Expéditeurs', items: s.senders.map((p, index) => ({ kind: 'sender', index, title: p.name, sub: null, count: p.count, payload: p })) },
    { kind: 'traveler', label: 'Voyageurs', items: s.travelers.map((p, index) => ({ kind: 'traveler', index, title: p.name, sub: null, count: p.count, payload: p })) },
    { kind: 'recipient', label: 'Destinataires', items: s.recipients.map((p, index) => ({ kind: 'recipient', index, title: p.name, sub: null, count: p.count, payload: p })) },
    { kind: 'trip', label: 'Trajets', items: s.trips.map((p, index) => ({ kind: 'trip', index, title: p.label, sub: null, count: p.count, payload: p })) },
    { kind: 'parcel', label: 'N° de suivi', items: s.parcels.map((p, index) => ({
      kind: 'parcel', index, title: p.trackingNumber ?? 'Sans numéro',
      sub: [bidStatusMeta(p.status as BidStatus).label, p.content].filter(Boolean).join(' · '), count: null, payload: p,
    })) },
  ]
  return out.filter(g => g.items.length > 0)
})
const flat = computed(() => groups.value.flatMap(g => g.items))
const showList = computed(() => open.value && !props.suggestionsDisabled && flat.value.length > 0)
const optionId = (it: Item) => `bid-suggestion-${it.kind}-${it.index}`
const activeId = computed(() => (showList.value && active.value >= 0 && flat.value[active.value] ? optionId(flat.value[active.value]!) : undefined))

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
function pick(it: Item) {
  open.value = false
  active.value = -1
  emit('pick', it.kind, it.payload)
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
    const it = showList.value ? flat.value[active.value] : undefined
    if (it) pick(it)
    else submit()
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <div class="flex flex-wrap items-center gap-2">
      <select
        data-test="search-scope" aria-label="Portée de la recherche" :value="modelScope"
        class="min-h-10 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @change="emit('update:scope', ($event.target as HTMLSelectElement).value as BidSearchScope)"
      >
        <option v-for="s in SCOPES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <input
        v-model="q" type="search" data-test="search" role="combobox" autocomplete="off"
        aria-label="Rechercher un colis" aria-autocomplete="list" aria-haspopup="listbox"
        :aria-expanded="showList" :aria-controls="showList ? listId : undefined" :aria-activedescendant="activeId"
        placeholder="N° de suivi, personne, trajet…"
        class="min-h-10 min-w-[240px] flex-1 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @input="onInput" @keydown="onKey" @focus="open = !!q" @blur="open = false"
      >
      <button
        type="button" data-test="search-submit"
        class="inline-flex min-h-10 items-center rounded-btn bg-primary px-4 text-sm font-medium text-white transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        @click="submit"
      >Chercher</button>
    </div>

    <div
      v-if="showList" :id="listId" role="listbox" aria-label="Suggestions"
      class="absolute left-0 right-0 z-20 mt-1 max-h-96 overflow-auto rounded-card border border-border bg-surface py-1 shadow-lg"
    >
      <div v-for="g in groups" :key="g.kind" role="group" :aria-label="g.label">
        <p class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{ g.label }}</p>
        <div
          v-for="it in g.items" :id="optionId(it)" :key="optionId(it)" role="option" :aria-selected="activeId === optionId(it)"
          :data-test="`suggestion-${it.kind}-${it.index}`"
          :class="['flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm', activeId === optionId(it) ? 'bg-surface-elevated' : 'hover:bg-surface-elevated']"
          @mousedown.prevent @click="pick(it)"
        >
          <span class="min-w-0 truncate" :class="it.kind === 'parcel' ? 'font-mono' : ''">{{ it.title }}<span v-if="it.sub" class="ml-2 font-sans text-xs text-text-muted">{{ it.sub }}</span></span>
          <span v-if="it.count != null" class="shrink-0 text-xs tabular-nums text-text-muted">{{ it.count }} colis</span>
        </div>
      </div>
    </div>
  </div>
</template>
