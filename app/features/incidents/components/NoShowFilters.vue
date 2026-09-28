<script setup lang="ts">
import { computed } from 'vue'
import type { NoShowScopeFilter, NoShowStatusFilter } from '@/features/incidents/types/index'

const props = defineProps<{ status: NoShowStatusFilter; scope: NoShowScopeFilter }>()
const emit = defineEmits<{ 'update:status': [s: NoShowStatusFilter]; 'update:scope': [s: NoShowScopeFilter] }>()

type Group = 'pending' | 'contested' | 'decided' | 'all'
const GROUPS: { key: Group; label: string; status: NoShowStatusFilter }[] = [
  { key: 'pending', label: 'En attente', status: 'PENDING_CONFIRMATION' },
  { key: 'contested', label: 'Contestés', status: 'CONTESTED' },
  // Le back filtre un seul statut à la fois : « Tranchés » ouvre sur les absences confirmées.
  { key: 'decided', label: 'Tranchés', status: 'CONFIRMED' },
  { key: 'all', label: 'Tous', status: 'ALL' },
]
const DECIDED: { key: string; label: string; status: NoShowStatusFilter }[] = [
  { key: 'confirmed', label: 'Absence confirmée', status: 'CONFIRMED' },
  { key: 'resolved', label: 'Résolus', status: 'RESOLVED' },
]
const SCOPES: { value: NoShowScopeFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'HANDOVER', label: 'Départ' },
  { value: 'DELIVERY', label: 'Arrivée' },
]

const group = computed<Group>(() => {
  if (props.status === 'PENDING_CONFIRMATION') return 'pending'
  if (props.status === 'CONTESTED') return 'contested'
  if (props.status === 'ALL') return 'all'
  return 'decided'
})
function pickGroup(g: (typeof GROUPS)[number]) {
  if (g.key === group.value) return
  emit('update:status', g.status)
}
function pickStatus(s: NoShowStatusFilter) { if (s !== props.status) emit('update:status', s) }
function pickScope(s: NoShowScopeFilter) { if (s !== props.scope) emit('update:scope', s) }

const pill = (active: boolean) => [
  'rounded-full px-3 py-1.5 text-sm transition-[background-color,color,transform] active:scale-[0.96]',
  active ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text',
]
</script>

<template>
  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap gap-1" role="group" aria-label="Statut">
        <button
          v-for="g in GROUPS" :key="g.key" type="button" :data-test="`noshow-status-${g.key}`"
          :aria-pressed="group === g.key" :class="pill(group === g.key)" @click="pickGroup(g)"
        >{{ g.label }}</button>
      </div>
      <div v-if="group === 'decided'" class="flex flex-wrap gap-1" role="group" aria-label="Décision">
        <button
          v-for="d in DECIDED" :key="d.key" type="button" :data-test="`noshow-decided-${d.key}`"
          :aria-pressed="status === d.status"
          :class="['rounded-full border px-3 py-1 text-xs transition-[background-color,color,transform] active:scale-[0.96]',
                   status === d.status ? 'border-primary bg-primary/15 text-primary' : 'border-border text-text-muted hover:text-text']"
          @click="pickStatus(d.status)"
        >{{ d.label }}</button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Moment de l’absence">
      <span class="mr-1 text-xs text-text-muted">Moment</span>
      <button
        v-for="s in SCOPES" :key="s.value" type="button" :data-test="`noshow-scope-${s.value}`"
        :aria-pressed="scope === s.value" :class="pill(scope === s.value)" @click="pickScope(s.value)"
      >{{ s.label }}</button>
    </div>
  </div>
</template>
