<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabBar from '@/components/ui/TabBar.vue'
import Dac7SellerDrawer from '@/features/dac7/components/Dac7SellerDrawer.vue'
import { useDac7Sellers } from '@/features/dac7/composables/useDac7Sellers'
import {
  DAC7_FILTERS, DAC7_UNAVAILABLE, NOT_AVAILABLE, eurLabel, fmtDay, identityHint, identityMeta, residencyMeta, solicitationMeta,
} from '@/features/dac7/types/index'
import type { Dac7Filter, Dac7Seller } from '@/features/dac7/types/index'

/**
 * Tableau des voyageurs de l'année : un filtre par point à régler, un tiroir par voyageur.
 * Jamais de numéro fiscal ici : seulement « fourni » ou « manquant ».
 */
const props = defineProps<{ year: number }>()
const emit = defineEmits<{ changed: []; loaded: [sellers: Dac7Seller[]] }>()

const sellers = useDac7Sellers()
const filter = ref<Dac7Filter>('ALL')
const selectedId = ref<string | null>(null)
const snapshot = ref<Dac7Seller | null>(null)

/** Le back omet les montants d'un voyageur dont la résidence est inconnue ou non déclarable : ce n'est pas zéro. */
const NOT_COMPUTED = 'non calculé'

const tabs = DAC7_FILTERS.map(f => ({ id: f.value, label: f.label }))
/** Le voyageur ouvert reste affiché même si un filtre le fait sortir de la liste. */
const selected = computed(() => {
  if (!selectedId.value) return null
  return sellers.items.value.find(s => s.userId === selectedId.value) ?? snapshot.value
})

async function reload() {
  await sellers.load(props.year, filter.value)
  // Le parent garde les noms pour nommer les voyageurs d'un refus d'export.
  emit('loaded', sellers.items.value)
}
function open(s: Dac7Seller) { snapshot.value = s; selectedId.value = s.userId }
function close() { selectedId.value = null; snapshot.value = null }
async function onChanged() { await reload(); emit('changed') }

onMounted(reload)
watch([() => props.year, filter], () => { close(); void reload() })
</script>

<template>
  <section aria-label="Voyageurs" data-test="dac7-sellers-panel" class="flex flex-col gap-3">
    <TabBar v-model="filter" :tabs="tabs" aria-label="Filtrer les voyageurs" test-prefix="dac7-filter" />

    <p v-if="sellers.unavailable.value" data-test="dac7-unavailable" class="rounded-card border border-border bg-surface p-6 text-sm text-text-muted">
      {{ DAC7_UNAVAILABLE }}
    </p>

    <div v-else class="overflow-hidden rounded-card border border-border bg-surface">
      <div class="overflow-x-auto">
        <table v-if="sellers.items.value.length" class="w-full min-w-[960px]">
          <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Voyageur</th>
              <th class="px-4 py-2 font-medium">Résidence</th>
              <th class="px-4 py-2 font-medium">Numéro fiscal</th>
              <th class="px-4 py-2 font-medium">Identité</th>
              <th class="px-4 py-2 font-medium">Sollicitation</th>
              <th class="px-4 py-2 font-medium">Rappels</th>
              <th class="px-4 py-2 font-medium">Dernière diligence</th>
              <th class="px-4 py-2 text-right font-medium">Opérations</th>
              <th class="px-4 py-2 text-right font-medium">Net</th>
              <th class="px-4 py-2 text-right font-medium">Commission</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in sellers.items.value" :key="s.userId" :data-test="`dac7-seller-row-${s.userId}`"
              class="border-b border-border last:border-b-0"
            >
              <td class="px-4 py-3 text-sm">
                <button
                  type="button" :data-test="`dac7-seller-open-${s.userId}`"
                  :class="['text-left font-medium underline-offset-2 hover:underline', s.displayName ? '' : 'italic text-text-muted']"
                  @click="open(s)"
                >{{ s.displayName || 'Nom non renseigné' }}</button>
                <StatusBadge v-if="s.alreadyExported" class="ml-2" label="Déjà déposé" tone="info" :data-test="`dac7-exported-${s.userId}`" />
              </td>
              <td class="px-4 py-3 text-sm">
                <span class="tabular-nums">{{ s.residenceCountry || NOT_AVAILABLE }}</span>
                <StatusBadge class="ml-2" v-bind="residencyMeta(s.residencyStatus)" />
              </td>
              <td class="px-4 py-3 text-sm">
                <StatusBadge :label="s.taxInfoProvided ? 'Fourni' : 'Manquant'" :tone="s.taxInfoProvided ? 'success' : 'warning'" />
              </td>
              <td class="px-4 py-3 text-sm">
                <StatusBadge v-bind="identityMeta(s.identityStatus)" />
                <span v-if="identityHint(s.identityStatus, s.identityReason)" :data-test="`dac7-identity-hint-${s.userId}`" class="mt-1 block text-xs text-text-muted text-pretty">{{ identityHint(s.identityStatus, s.identityReason) }}</span>
              </td>
              <td class="px-4 py-3 text-sm"><StatusBadge v-bind="solicitationMeta(s.solicitation)" /></td>
              <td class="px-4 py-3 text-sm tabular-nums">{{ s.remindersSent ?? 0 }} / 2</td>
              <td class="px-4 py-3 text-sm tabular-nums text-text-muted">{{ fmtDay(s.lastDiligenceAt) }}</td>
              <td class="px-4 py-3 text-right text-sm tabular-nums">{{ s.operations ?? NOT_COMPUTED }}</td>
              <td class="px-4 py-3 text-right text-sm tabular-nums">
                {{ s.netEur == null ? NOT_COMPUTED : eurLabel(s.netEur) }}
                <span v-if="s.netEur != null && s.eurComplete === false" class="block text-xs text-warning">partiel</span>
              </td>
              <td class="px-4 py-3 text-right text-sm tabular-nums">
                {{ s.commissionEur == null ? NOT_COMPUTED : eurLabel(s.commissionEur) }}
                <span v-if="s.commissionEur != null && s.commissionComplete === false" class="block text-xs text-warning">partielle</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StateBlock
        :loading="sellers.isLoading.value && sellers.items.value.length === 0" :error="sellers.error.value"
        :empty="!sellers.isLoading.value && !sellers.error.value && sellers.items.value.length === 0"
        empty-label="Aucun voyageur pour ce filtre" empty-test="dac7-sellers-empty" @retry="reload"
      />
    </div>

    <Dac7SellerDrawer v-if="selected" :key="selected.userId" :seller="selected" @close="close" @changed="onChanged" />
  </section>
</template>
