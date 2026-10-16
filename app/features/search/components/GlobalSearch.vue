<script setup lang="ts">
import {
  ArrowRight, CreditCard, FileText, Flag, LifeBuoy, Loader2, Package, Route as RouteIcon, Search, User, Wallet,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useGlobalSearch, MIN_DATA_QUERY } from '../composables/useGlobalSearch'
import type { SearchGroup } from '../services/globalSearchService'

const ICONS: Record<SearchGroup | 'page', Component> = {
  page: ArrowRight,
  users: User,
  bids: Package,
  announcements: RouteIcon,
  requests: FileText,
  payments: CreditCard,
  walletRefunds: Wallet,
  reports: Flag,
  support: LifeBuoy,
}

interface Entry { key: string; kind: SearchGroup | 'page'; title: string; subtitle?: string | null; to: RouteLocationRaw }

const router = useRouter()
const { query, pages, groups, searching, reset } = useGlobalSearch()
const open = ref(false)
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
const isMac = ref(false)

const pageEntries = computed<Entry[]>(() => pages.value.map(p => ({
  key: `page:${p.key}`, kind: 'page', title: p.label, subtitle: p.parent ?? null, to: p.to,
})))
const sections = computed(() => {
  const out: { key: string; label: string; entries: Entry[]; loading?: boolean; failed?: boolean }[] = []
  if (pageEntries.value.length) out.push({ key: 'pages', label: 'Pages', entries: pageEntries.value })
  for (const g of groups.value) {
    if (g.loading || g.failed || g.items.length) {
      out.push({
        key: g.group, label: g.label, loading: g.loading, failed: g.failed,
        entries: g.items.map(i => ({ key: i.key, kind: i.group, title: i.title, subtitle: i.subtitle, to: i.to })),
      })
    }
  }
  return out
})
const flat = computed(() => sections.value.flatMap(s => s.entries))
const dataQuery = computed(() => query.value.trim().length >= MIN_DATA_QUERY)
const nothingFound = computed(() => dataQuery.value && !searching.value && flat.value.length === 0)

watch(flat, () => { if (active.value >= flat.value.length) active.value = 0 })
watch(query, () => { active.value = 0 })

async function show() {
  if (open.value) return
  open.value = true
  await nextTick()
  input.value?.focus()
}
function hide() {
  open.value = false
  reset()
}
async function go(entry: Entry | undefined) {
  if (!entry) return
  hide()
  await router.push(entry.to)
}
function move(delta: number) {
  if (!flat.value.length) return
  active.value = (active.value + delta + flat.value.length) % flat.value.length
  void nextTick(() => {
    list.value?.querySelector(`[data-index="${active.value}"]`)?.scrollIntoView({ block: 'nearest' })
  })
}
function onInputKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  else if (e.key === 'Enter') { e.preventDefault(); void go(flat.value[active.value]) }
  else if (e.key === 'Escape') { e.preventDefault(); hide() }
}
function indexOf(entry: Entry) { return flat.value.indexOf(entry) }

/** ⌘K / Ctrl+K partout ; « / » hors d'un champ de saisie. */
function onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (open.value) hide()
    else void show()
    return
  }
  const target = e.target as HTMLElement | null
  const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  if (e.key === '/' && !typing && !open.value) {
    e.preventDefault()
    void show()
  }
}
onMounted(() => {
  isMac.value = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))

defineExpose({ show, hide })
</script>

<template>
  <button
    type="button"
    data-test="global-search-trigger"
    aria-label="Rechercher dans l’admin"
    class="group flex h-9 items-center gap-2 rounded-btn bg-surface-elevated px-3 text-sm text-text-muted transition-[background-color,color,scale] duration-150 hover:text-text active:scale-[0.96] md:w-72"
    @click="show"
  >
    <Search class="h-4 w-4 shrink-0" />
    <span class="hidden flex-1 text-left md:inline">Rechercher…</span>
    <kbd class="hidden rounded border border-border px-1.5 py-0.5 font-sans text-[11px] leading-none md:inline">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
  </button>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
        data-test="global-search-overlay"
        @mousedown.self="hide"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Recherche globale"
          class="palette w-full max-w-xl overflow-hidden rounded-2xl bg-surface"
        >
          <div class="flex items-center gap-3 px-4">
            <Search class="h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref="input"
              v-model="query"
              data-test="global-search-input"
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-results"
              :aria-activedescendant="flat[active] ? `gs-${active}` : undefined"
              autocomplete="off"
              spellcheck="false"
              placeholder="Utilisateur, n° DON-…, trajet, paiement, page…"
              class="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-text-muted"
              @keydown="onInputKey"
            >
            <Loader2 v-if="searching" class="h-4 w-4 shrink-0 animate-spin text-text-muted" data-test="global-search-loading" />
            <kbd class="rounded border border-border px-1.5 py-0.5 text-[11px] leading-none text-text-muted">échap</kbd>
          </div>

          <div id="global-search-results" ref="list" role="listbox" class="max-h-[60vh] overflow-y-auto border-t border-border py-2">
            <section v-for="section in sections" :key="section.key" class="px-2 pb-1" :data-test="`global-search-section-${section.key}`">
              <h3 class="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {{ section.label }}
                <span v-if="section.failed" class="normal-case tracking-normal">· indisponible</span>
              </h3>
              <p v-if="section.loading" class="px-2 py-1.5 text-sm text-text-muted">Recherche…</p>
              <button
                v-for="entry in section.entries"
                :id="`gs-${indexOf(entry)}`"
                :key="entry.key"
                type="button"
                role="option"
                :aria-selected="indexOf(entry) === active"
                :data-index="indexOf(entry)"
                :data-test="`global-search-item-${entry.key}`"
                :class="['flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-100', indexOf(entry) === active ? 'bg-surface-elevated' : '']"
                @mousemove="active = indexOf(entry)"
                @click="go(entry)"
              >
                <component :is="ICONS[entry.kind]" class="h-4 w-4 shrink-0 text-text-muted" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium tabular-nums">{{ entry.title }}</span>
                  <span v-if="entry.subtitle" class="block truncate text-xs text-text-muted tabular-nums">{{ entry.subtitle }}</span>
                </span>
                <ArrowRight v-if="indexOf(entry) === active" class="h-3.5 w-3.5 shrink-0 text-text-muted" />
              </button>
            </section>

            <p v-if="nothingFound" class="px-4 py-6 text-center text-sm text-text-muted" data-test="global-search-empty">
              Aucun résultat pour « {{ query.trim() }} »
            </p>
            <p v-else-if="!dataQuery" class="px-4 pb-2 pt-1 text-xs text-text-muted text-pretty">
              Tapez au moins {{ MIN_DATA_QUERY }} caractères pour chercher aussi dans les données : nom, téléphone (+33…), e-mail, n° de suivi DON-…, identifiant, ville.
            </p>
          </div>

          <div class="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-text-muted">
            <span><kbd class="font-sans">↑</kbd> <kbd class="font-sans">↓</kbd> naviguer</span>
            <span><kbd class="font-sans">↵</kbd> ouvrir</span>
            <span><kbd class="font-sans">/</kbd> ou {{ isMac ? '⌘' : 'Ctrl' }} K pour ouvrir</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette {
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.06),
    0 12px 24px -6px rgb(0 0 0 / 0.18),
    0 32px 64px -12px rgb(0 0 0 / 0.22);
}
</style>
