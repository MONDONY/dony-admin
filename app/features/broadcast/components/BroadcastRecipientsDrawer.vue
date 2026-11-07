<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import { extractProblemMessageAsync } from '@/lib/problemDetail'
import type { BroadcastRecipient, BroadcastTarget } from '@/features/broadcast/types/index'

const PAGE_SIZE = 50

const props = defineProps<{ open: boolean; target: BroadcastTarget }>()
const emit = defineEmits<{ close: [] }>()

const rows = ref<BroadcastRecipient[]>([])
const total = ref(0)
const totalPages = ref(0)
const page = ref(0)
const loading = ref(false)
const exporting = ref(false)
const error = ref<string | null>(null)

// Une page lente d'un chargement précédent ne doit pas écraser la page affichée.
let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  error.value = null
  try {
    const res = await broadcastService.recipients(props.target, page.value, PAGE_SIZE)
    if (mine !== seq) return
    rows.value = res.content
    total.value = res.totalElements
    totalPages.value = res.totalPages
  } catch (e) {
    if (mine !== seq) return
    error.value = await extractProblemMessageAsync(e, 'Impossible de charger les destinataires')
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch(() => props.open, (o) => {
  if (o) { page.value = 0; void load() }
}, { immediate: true })

function goTo(p: number) {
  page.value = p
  void load()
}

async function exportCsv() {
  exporting.value = true
  error.value = null
  try {
    await broadcastService.downloadRecipientsCsv(props.target)
  } catch (e) {
    error.value = await extractProblemMessageAsync(e, 'Export impossible')
  } finally {
    exporting.value = false
  }
}

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => window.addEventListener('keydown', onEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', onEscape))

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR')
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/40" data-test="recipients-drawer">
    <aside
      role="dialog" aria-modal="true" aria-label="Liste des destinataires"
      class="flex h-full w-full max-w-2xl flex-col border-l border-border bg-surface shadow-xl"
    >
      <header class="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <h2 class="font-display text-lg font-semibold text-balance">Destinataires</h2>
        <span class="text-sm tabular-nums text-text-muted">{{ total }} au total</span>
        <div class="ml-auto flex items-center gap-2">
          <button
            type="button" data-test="export-csv" :disabled="exporting"
            class="whitespace-nowrap rounded-btn border border-border px-3 py-2 text-sm hover:bg-surface-elevated disabled:opacity-40"
            @click="exportCsv"
          >Exporter en CSV</button>
          <button
            type="button" data-test="close-drawer" aria-label="Fermer la liste"
            class="whitespace-nowrap rounded-btn border border-border px-3 py-2 text-sm hover:bg-surface-elevated"
            @click="emit('close')"
          >Fermer</button>
        </div>
      </header>

      <p
        v-if="error" data-test="recipients-error" role="alert"
        class="m-4 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>

      <div class="flex-1 overflow-auto">
        <p v-if="loading" class="p-4 text-sm text-text-muted">Chargement…</p>
        <p v-else-if="!error && rows.length === 0" data-test="recipients-empty" class="p-4 text-sm text-text-muted">
          Aucun destinataire pour ce ciblage.
        </p>
        <table v-else-if="rows.length > 0" class="w-full text-sm">
          <thead class="border-b border-border text-left text-text-muted">
            <tr>
              <th class="px-4 py-3 font-medium">Nom</th>
              <th class="px-4 py-3 font-medium">Pays</th>
              <th class="px-4 py-3 font-medium">Langue</th>
              <th class="px-4 py-3 font-medium">Push</th>
              <th class="px-4 py-3 font-medium">Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" data-test="recipient-row" class="border-b border-border last:border-0">
              <td class="px-4 py-3">{{ r.displayName }}</td>
              <td class="px-4 py-3 text-text-muted">{{ r.country ?? '-' }}</td>
              <td class="px-4 py-3 uppercase text-text-muted">{{ r.language }}</td>
              <td class="px-4 py-3">{{ r.pushReachable ? 'Oui' : 'Non' }}</td>
              <td class="px-4 py-3 tabular-nums">{{ fmt(r.signedUpAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="border-t border-border p-4">
        <PaginationControls :page="page" :total-pages="totalPages" @change="goTo" />
      </footer>
    </aside>
  </div>
</template>
