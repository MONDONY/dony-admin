<script setup lang="ts">
import { computed } from 'vue'
import { intMax } from '@/features/broadcast/composables/useAudienceRule'
import type { AudienceField, AudienceValueType, RuleCondition } from '@/features/broadcast/types/index'

const props = defineProps<{ condition: RuleCondition; fields: AudienceField[] }>()
const emit = defineEmits<{
  update: [patch: Partial<Pick<RuleCondition, 'field' | 'operator' | 'value'>>]
  remove: []
}>()

const CORRIDOR_SOURCES = [
  { key: 'PUBLISHED', label: 'a publié' },
  { key: 'REQUESTED', label: 'a demandé' },
  { key: 'ALERT', label: 'alerte' },
]
const control = 'rounded-btn border border-border bg-bg p-2 text-sm'

const field = computed(() => props.fields.find((f) => f.key === props.condition.field))
const operator = computed(() => field.value?.operators.find((o) => o.key === props.condition.operator))
const valueType = computed<AudienceValueType>(() => operator.value?.valueType ?? 'NONE')
const maxInt = computed(() => intMax(props.condition.operator))
const intInvalid = computed(() => {
  const v = props.condition.value
  return v !== null && v !== undefined && !(typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= maxInt.value)
})
const intHint = computed(() => `Nombre entier de 0 à ${maxInt.value.toLocaleString('fr-FR')}`)
const countries = computed(() => props.fields.find((f) => f.key === 'country')?.values ?? [])

interface CorridorValue { kind: 'CITY' | 'COUNTRY'; origin?: string | null; destination?: string | null; sources?: string[] | null }
const corridor = computed<CorridorValue>(() => {
  const v = props.condition.value as CorridorValue | null
  return v && typeof v === 'object' ? v : { kind: 'CITY' }
})
const corridorMissingBound = computed(() =>
  valueType.value === 'CORRIDOR'
  && ![corridor.value.origin, corridor.value.destination].some((b) => typeof b === 'string' && b.trim().length > 0))
const selectedSources = computed(() => corridor.value.sources ?? [])

function setCorridor(patch: Partial<CorridorValue>) {
  const next: CorridorValue = { ...corridor.value, ...patch }
  // Changer ville/pays rend les bornes déjà saisies invalides : on les efface.
  if (patch.kind && patch.kind !== corridor.value.kind) { next.origin = ''; next.destination = '' }
  emit('update', { value: next })
}
function toggleSource(key: string, on: boolean) {
  const set = new Set(selectedSources.value)
  if (on) set.add(key); else set.delete(key)
  setCorridor({ sources: set.size === 0 ? null : CORRIDOR_SOURCES.map((s) => s.key).filter((k) => set.has(k)) })
}
function toggleMulti(key: string, on: boolean) {
  const cur = Array.isArray(props.condition.value) ? (props.condition.value as string[]) : []
  const next = on ? [...cur, key] : cur.filter((k) => k !== key)
  emit('update', { value: next })
}
function onInt(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  emit('update', { value: raw === '' ? null : Number(raw) })
}
function onBoolean(e: Event) {
  const raw = (e.target as HTMLSelectElement).value
  emit('update', { value: raw === '' ? null : raw === 'true' })
}
</script>

<template>
  <div data-test="condition-row" class="flex flex-wrap items-start gap-2 rounded-btn border border-border bg-surface p-2">
    <select
      :value="condition.field" aria-label="Champ" data-test="condition-field" :class="control"
      @change="emit('update', { field: ($event.target as HTMLSelectElement).value })"
    >
      <option v-for="f in fields" :key="f.key" :value="f.key">{{ f.label }}</option>
    </select>

    <select
      v-if="field && field.operators.length > 0"
      :value="condition.operator" aria-label="Opérateur" data-test="condition-operator" :class="control"
      @change="emit('update', { operator: ($event.target as HTMLSelectElement).value })"
    >
      <option v-for="o in field.operators" :key="o.key" :value="o.key">{{ o.label }}</option>
    </select>

    <select
      v-if="valueType === 'BOOLEAN'"
      :value="condition.value === null || condition.value === undefined ? '' : String(condition.value)"
      aria-label="Valeur" data-test="value-boolean" :class="control" @change="onBoolean"
    >
      <option value="" disabled>Choisir</option>
      <option value="true">Oui</option>
      <option value="false">Non</option>
    </select>

    <select
      v-else-if="valueType === 'ENUM'"
      :value="(condition.value as string | null) ?? ''" aria-label="Valeur" data-test="value-enum" :class="control"
      @change="emit('update', { value: ($event.target as HTMLSelectElement).value || null })"
    >
      <option value="" disabled>Choisir</option>
      <option v-for="v in field?.values ?? []" :key="v.key" :value="v.key">{{ v.label }}</option>
    </select>

    <fieldset v-else-if="valueType === 'ENUM_MULTI'" class="flex max-h-40 min-w-0 flex-wrap gap-x-3 gap-y-1 overflow-y-auto" data-test="value-multi">
      <legend class="sr-only">Valeurs</legend>
      <label v-for="v in field?.values ?? []" :key="v.key" class="flex items-center gap-1 text-sm text-text">
        <input
          type="checkbox" :checked="Array.isArray(condition.value) && (condition.value as string[]).includes(v.key)"
          @change="toggleMulti(v.key, ($event.target as HTMLInputElement).checked)"
        >
        <span>{{ v.label }}</span>
      </label>
    </fieldset>

    <div v-else-if="valueType === 'INT'" class="flex flex-col gap-1">
      <input
        type="number" min="0" :max="maxInt" step="1" inputmode="numeric" aria-label="Valeur"
        :aria-invalid="intInvalid" :value="(condition.value as number | null) ?? ''" data-test="value-int"
        :class="[control, 'w-28 tabular-nums']" @input="onInt"
      >
      <p v-if="intInvalid" role="alert" data-test="int-error" class="text-sm text-warning">{{ intHint }}</p>
    </div>

    <input
      v-else-if="valueType === 'TEXT'"
      type="text" maxlength="100" aria-label="Valeur" :value="(condition.value as string | null) ?? ''"
      data-test="value-text" :class="control"
      @input="emit('update', { value: ($event.target as HTMLInputElement).value })"
    >

    <div v-else-if="valueType === 'CORRIDOR'" class="flex min-w-0 flex-1 flex-col gap-2" data-test="value-corridor">
      <div class="flex flex-wrap gap-2">
        <select
          :value="corridor.kind" aria-label="Type de lieu" data-test="corridor-kind" :class="control"
          @change="setCorridor({ kind: ($event.target as HTMLSelectElement).value as 'CITY' | 'COUNTRY' })"
        >
          <option value="CITY">Ville</option>
          <option value="COUNTRY">Pays</option>
        </select>
        <template v-if="corridor.kind === 'COUNTRY' && countries.length > 0">
          <select
            :value="corridor.origin ?? ''" aria-label="Pays de départ" data-test="corridor-origin" :class="control"
            @change="setCorridor({ origin: ($event.target as HTMLSelectElement).value })"
          >
            <option value="">Départ</option>
            <option v-for="c in countries" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
          <select
            :value="corridor.destination ?? ''" aria-label="Pays d’arrivée" data-test="corridor-destination" :class="control"
            @change="setCorridor({ destination: ($event.target as HTMLSelectElement).value })"
          >
            <option value="">Arrivée</option>
            <option v-for="c in countries" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
        </template>
        <template v-else>
          <input
            type="text" maxlength="100" placeholder="Départ" aria-label="Ville de départ" :value="corridor.origin ?? ''"
            data-test="corridor-origin" :class="control" @input="setCorridor({ origin: ($event.target as HTMLInputElement).value })"
          >
          <input
            type="text" maxlength="100" placeholder="Arrivée" aria-label="Ville d’arrivée" :value="corridor.destination ?? ''"
            data-test="corridor-destination" :class="control" @input="setCorridor({ destination: ($event.target as HTMLInputElement).value })"
          >
        </template>
      </div>
      <fieldset class="flex flex-wrap gap-x-3 gap-y-1">
        <legend class="sr-only">Sources</legend>
        <label v-for="s in CORRIDOR_SOURCES" :key="s.key" class="flex items-center gap-1 text-sm text-text">
          <input
            type="checkbox" :data-test="`corridor-source-${s.key}`" :checked="selectedSources.includes(s.key)"
            @change="toggleSource(s.key, ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ s.label }}</span>
        </label>
      </fieldset>
      <p v-if="corridorMissingBound" role="alert" data-test="corridor-error" class="text-sm text-warning">Indiquez un départ ou une arrivée</p>
    </div>

    <button
      type="button" data-test="remove-condition" aria-label="Retirer la condition"
      class="ml-auto whitespace-nowrap rounded-btn px-3 py-2 text-sm text-text-muted hover:bg-surface-elevated"
      @click="emit('remove')"
    >Retirer</button>
  </div>
</template>
