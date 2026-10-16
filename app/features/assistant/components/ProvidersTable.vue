<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-vue-next'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { providerStatus } from '@/features/assistant/utils/providerStatus'
import type { AdminProvider, ProviderTestResult } from '@/features/assistant/types'

const props = defineProps<{ providers: AdminProvider[]; testResults: Record<string, ProviderTestResult>; testingIds: ReadonlySet<string>; moving?: boolean }>()
const emit = defineEmits<{
  move: [from: number, to: number]
  toggle: [provider: AdminProvider]
  test: [id: string]
  edit: [provider: AdminProvider]
  delete: [provider: AdminProvider]
}>()

const dragIndex = ref<number | null>(null)
const nf = new Intl.NumberFormat('fr-FR')

function host(url: string): string {
  try { return new URL(url).host } catch { return url }
}

function usage(p: AdminProvider): string {
  const ok = p.stats.successesToday
  const succeeded = `${nf.format(ok)} ${ok > 1 ? 'réussies' : 'réussie'}`
  return p.dailyRequestLimit === null
    ? `${nf.format(p.stats.requestsToday)} · sans limite · ${succeeded}`
    : `${nf.format(p.stats.requestsToday)} / ${nf.format(p.dailyRequestLimit)} · ${succeeded}`
}

function onDragStart(e: DragEvent, index: number, id: string) {
  if (props.moving) { dragIndex.value = null; return }
  dragIndex.value = index
  // Firefox ne démarre pas un glisser sans donnée dans dataTransfer.
  e.dataTransfer?.setData('text/plain', id)
}

function testLine(r: ProviderTestResult): string {
  if (!r.ok) return `Échec : ${r.error ?? 'erreur inconnue'}`
  return r.sample ? `OK en ${r.latencyMs} ms : ${r.sample}` : `OK en ${r.latencyMs} ms`
}

function onDrop(to: number) {
  if (props.moving) { dragIndex.value = null; return }
  if (dragIndex.value !== null && dragIndex.value !== to) emit('move', dragIndex.value, to)
  dragIndex.value = null
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table class="w-full min-w-[900px]">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium"><span class="sr-only">Ordre</span></th>
          <th class="px-4 py-2 font-medium">Fournisseur</th>
          <th class="px-4 py-2 font-medium">Clé</th>
          <th class="px-4 py-2 font-medium text-right">Aujourd'hui</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium">Actif</th>
          <th class="px-4 py-2 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(p, i) in providers" :key="p.id" :data-test="`provider-row-${p.slug}`" :draggable="!moving"
          class="border-t border-border align-top" :class="dragIndex === i ? 'opacity-50' : ''"
          @dragstart="onDragStart($event, i, p.id)" @dragover.prevent @drop.prevent="onDrop(i)" @dragend="dragIndex = null"
        >
          <td class="px-4 py-3">
            <div class="flex items-center gap-1 text-text-muted">
              <GripVertical class="size-4 cursor-grab" aria-hidden="true" />
              <button
type="button" :data-test="`provider-up-${p.slug}`" :disabled="moving || i === 0" :aria-label="`Monter ${p.name}`"
                class="rounded-btn p-1 hover:bg-surface-elevated disabled:opacity-30" @click="emit('move', i, i - 1)"><ArrowUp class="size-4" /></button>
              <button
type="button" :data-test="`provider-down-${p.slug}`" :disabled="moving || i === providers.length - 1" :aria-label="`Descendre ${p.name}`"
                class="rounded-btn p-1 hover:bg-surface-elevated disabled:opacity-30" @click="emit('move', i, i + 1)"><ArrowDown class="size-4" /></button>
            </div>
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ i + 1 }}. {{ p.name }}</div>
            <div class="text-xs text-text-muted">{{ p.model }} · {{ host(p.baseUrl) }}</div>
            <p
v-if="testResults[p.id]" :data-test="`provider-test-result-${p.slug}`" role="status"
              class="mt-1 text-xs" :class="testResults[p.id]!.ok ? 'text-text' : 'text-danger'">
              {{ testLine(testResults[p.id]!) }}
            </p>
          </td>
          <td class="px-4 py-3 text-sm tabular-nums">••••{{ p.apiKeyLast4 }}</td>
          <td class="px-4 py-3 text-sm text-right tabular-nums">{{ usage(p) }}</td>
          <td class="px-4 py-3 text-sm" :title="p.stats.lastError ?? undefined">
            <StatusBadge :label="providerStatus(p).label" :tone="providerStatus(p).tone" />
          </td>
          <td class="px-4 py-3">
            <button
type="button" role="switch" :data-test="`provider-toggle-${p.slug}`" :aria-checked="p.enabled" :aria-label="`Activer ${p.name}`"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-[background-color,scale] duration-200 active:scale-[0.96] before:absolute before:-inset-2 before:content-['']"
              :class="p.enabled ? 'bg-primary' : 'bg-border'" @click="emit('toggle', p)">
              <span
aria-hidden="true" class="inline-block size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
                :class="p.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'" />
            </button>
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
type="button" :data-test="`provider-test-${p.slug}`" :disabled="testingIds.has(p.id)"
              class="rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-40" @click="emit('test', p.id)">
              {{ testingIds.has(p.id) ? 'Test…' : 'Tester' }}</button>
            <button type="button" :data-test="`provider-edit-${p.slug}`" class="ml-1 rounded-btn px-3 py-1.5 text-sm text-primary hover:bg-surface-elevated" @click="emit('edit', p)">Modifier</button>
            <button type="button" :data-test="`provider-delete-${p.slug}`" class="ml-1 rounded-btn px-3 py-1.5 text-sm text-danger hover:bg-surface-elevated" @click="emit('delete', p)">Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="providers.length === 0" data-test="providers-empty" class="p-6 text-center text-sm text-text-muted">Aucun fournisseur. Ajoutez-en un pour activer l'assistant.</p>
  </div>
</template>
