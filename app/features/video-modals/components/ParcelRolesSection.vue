<script setup lang="ts">
import { computed } from 'vue'
import { PARCEL_ROLES, type ParcelRole } from '@/features/video-modals/types/index'
import { parcelRoleLabel, triggerChipLabel } from '@/features/video-modals/lib/labels'

/**
 * « Rôle sur le colis » : à qui le modal d'étape s'adresse. Aucune case cochée = tous les rôles. Le champ ne
 * s'affiche que lorsqu'au moins une étape du colis est cochée (sinon le back refuse le rôle). Un rôle inconnu
 * venu d'un back plus récent reste affiché, coché et conservé.
 */
const props = defineProps<{ modelValue: ParcelRole[]; visible: boolean; error?: string; otherTriggers?: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [roles: ParcelRole[]] }>()

const known = PARCEL_ROLES as readonly string[]
const options = computed<string[]>(() => [...PARCEL_ROLES, ...props.modelValue.filter(r => !known.includes(r))])

function toggle(role: string, checked: boolean) {
  const rest = props.modelValue.filter(r => r !== role)
  // Ordre stable (expéditeur, voyageur, destinataire, puis les inconnus), quel que soit l'ordre des clics.
  const order = [...options.value, ...(options.value.includes(role) ? [] : [role])]
  emit('update:modelValue', order.filter(r => (r === role ? checked : rest.includes(r as ParcelRole))) as ParcelRole[])
}
</script>

<template>
  <fieldset v-if="visible" data-test="vm-parcel-roles" class="mt-5">
    <legend class="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Rôle sur le colis</legend>
    <div class="flex flex-wrap gap-2">
      <label
        v-for="r in options" :key="r" :data-test="`vm-parcel-role-${r}`"
        :class="['inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary',
                 modelValue.includes(r as ParcelRole) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-surface-elevated']"
      >
        <input type="checkbox" class="sr-only" :checked="modelValue.includes(r as ParcelRole)" @change="toggle(r, ($event.target as HTMLInputElement).checked)">
        {{ parcelRoleLabel(r) }}
      </label>
    </div>
    <p v-if="modelValue.length === 0" class="mt-2 text-xs text-text-muted">Aucun choix : visible par tous les rôles</p>
    <p v-if="error" data-test="vm-parcel-roles-error" class="mt-1 text-xs text-danger">{{ error }}</p>
    <p
      v-if="otherTriggers && otherTriggers.length > 0" data-test="vm-parcel-mixed-warning" role="status"
      class="mt-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text text-pretty"
    >
      Ce modal s’ouvre aussi hors d’un colis ({{ otherTriggers.map(triggerChipLabel).join(', ') }}) : le rôle n’y est pas vérifié, les variables y restent entre accolades et les boutons du colis y ferment le modal.
      Pour ne l’ouvrir qu’à l’étape du colis, décochez les autres déclencheurs.
    </p>
  </fieldset>
</template>
