<script setup lang="ts">
import { computed, ref } from 'vue'
import AudienceConditionRow from '@/features/broadcast/components/AudienceConditionRow.vue'
import type { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import {
  RULE_MAX_CONDITIONS, RULE_MAX_DEPTH,
  type AudienceField, type RuleGroup, type RuleOp,
} from '@/features/broadcast/types/index'

const props = defineProps<{
  fields: AudienceField[]
  rule: ReturnType<typeof useAudienceRule>
  /** Groupe affiché (récursion) ; par défaut la racine. */
  group?: RuleGroup
  /** Profondeur du groupe affiché (la racine vaut 1). */
  depth?: number
}>()

const FAMILIES: Array<{ key: AudienceField['family']; label: string }> = [
  { key: 'STATUS', label: 'Statut du compte' },
  { key: 'ACTIVITY', label: 'Activité' },
  { key: 'GEO', label: 'Géographie' },
  { key: 'MONEY', label: 'Argent' },
]

const current = computed(() => props.group ?? props.rule.root.value)
const level = computed(() => props.depth ?? 1)
const isRoot = computed(() => current.value.id === props.rule.root.value.id)
const canNest = computed(() => level.value < RULE_MAX_DEPTH)
const full = computed(() => !props.rule.canAddCondition.value)
const pickerOpen = ref(false)
const addButton = ref<HTMLButtonElement | null>(null)
function closePicker() {
  pickerOpen.value = false
  addButton.value?.focus()
}
const groups = computed(() =>
  FAMILIES.map((f) => ({ ...f, fields: props.fields.filter((x) => x.family === f.key) }))
    .filter((f) => f.fields.length > 0))

function pick(key: string) {
  props.rule.addCondition(current.value.id, key)
  pickerOpen.value = false
}
const btn = 'whitespace-nowrap rounded-btn border border-border px-3 py-2 text-sm hover:bg-surface-elevated disabled:opacity-40'
</script>

<template>
  <div
    data-test="rule-group"
    :class="['space-y-3', isRoot ? '' : 'rounded-card border border-border bg-bg p-3']"
  >
    <div class="flex flex-wrap items-center gap-2">
      <select
        :value="current.op" aria-label="Opérateur du groupe" data-test="group-op"
        class="rounded-btn border border-border bg-bg p-2 text-sm"
        @change="rule.setOp(current.id, ($event.target as HTMLSelectElement).value as RuleOp)"
      >
        <option value="AND">Toutes les conditions (ET)</option>
        <option value="OR">Au moins une condition (OU)</option>
      </select>
      <button
        v-if="!isRoot" type="button" data-test="remove-group" :class="[btn, 'ml-auto']"
        @click="rule.remove(current.id)"
      >Retirer le groupe</button>
    </div>

    <p v-if="!isRoot && current.children.length === 0" class="text-sm text-warning">Ajoutez au moins une condition à ce groupe.</p>
    <p v-else-if="isRoot && current.children.length === 0" class="text-sm text-text-muted text-pretty">
      Sans condition, tous les comptes actifs sont ciblés.
    </p>

    <template v-for="child in current.children" :key="child.id">
      <AudienceConditionRow
        v-if="child.kind === 'condition'"
        :condition="child" :fields="fields"
        @update="(patch) => rule.update(child.id, patch)"
        @remove="rule.remove(child.id)"
      />
      <AudienceRuleBuilder v-else :fields="fields" :rule="rule" :group="child" :depth="level + 1" />
    </template>

    <div class="flex flex-wrap items-center gap-2">
      <button
        ref="addButton" type="button" data-test="add-condition" :disabled="full" :aria-expanded="pickerOpen" :class="btn"
        @click="pickerOpen = !pickerOpen"
      >Ajouter une condition</button>
      <button
        v-if="canNest" type="button" data-test="add-group" :disabled="full" :class="btn"
        @click="rule.addGroup(current.id)"
      >Ajouter un groupe</button>
      <span v-if="full && isRoot" data-test="max-conditions" role="status" class="text-sm text-warning">{{ RULE_MAX_CONDITIONS }} conditions au maximum</span>
    </div>

    <div v-if="pickerOpen && !full" data-test="field-picker" class="space-y-2 rounded-btn border border-border bg-surface p-3" @keydown.esc.stop="closePicker">
      <div v-for="family in groups" :key="family.key">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">{{ family.label }}</p>
        <div class="mt-1 flex flex-wrap gap-2">
          <button
            v-for="f in family.fields" :key="f.key" type="button" :data-test="`pick-field-${f.key}`"
            class="rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated"
            @click="pick(f.key)"
          >{{ f.label }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
