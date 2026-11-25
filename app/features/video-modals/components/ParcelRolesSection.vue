<script setup lang="ts">
import { PARCEL_ROLES, type ParcelRole } from '@/features/video-modals/types/index'
import { parcelRoleLabel } from '@/features/video-modals/lib/labels'

/**
 * « Rôle sur le colis » : à qui le modal d'étape s'adresse. Aucune case cochée = tous les rôles. Le champ ne
 * s'affiche que lorsqu'au moins une étape du colis est cochée (sinon le back refuse le rôle).
 */
const props = defineProps<{ modelValue: ParcelRole[]; visible: boolean; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [roles: ParcelRole[]] }>()

function toggle(role: ParcelRole, checked: boolean) {
  const rest = props.modelValue.filter(r => r !== role)
  // Ordre stable (expéditeur, voyageur, destinataire), quel que soit l'ordre des clics.
  emit('update:modelValue', checked ? PARCEL_ROLES.filter(r => r === role || rest.includes(r)) : rest)
}
</script>

<template>
  <fieldset v-if="visible" data-test="vm-parcel-roles" class="mt-5">
    <legend class="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Rôle sur le colis</legend>
    <div class="flex flex-wrap gap-2">
      <label
        v-for="r in PARCEL_ROLES" :key="r" :data-test="`vm-parcel-role-${r}`"
        :class="['inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary',
                 modelValue.includes(r) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-surface-elevated']"
      >
        <input type="checkbox" class="sr-only" :checked="modelValue.includes(r)" @change="toggle(r, ($event.target as HTMLInputElement).checked)">
        {{ parcelRoleLabel(r) }}
      </label>
    </div>
    <p v-if="modelValue.length === 0" class="mt-2 text-xs text-text-muted">Aucun choix : visible par tous les rôles</p>
    <p v-if="error" data-test="vm-parcel-roles-error" class="mt-1 text-xs text-danger">{{ error }}</p>
  </fieldset>
</template>
