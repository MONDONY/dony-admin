<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useIndividualFrequencyDismiss } from '@/features/individual-frequency/composables/useIndividualFrequencyDismiss'
import { frequencySummary } from '@/features/individual-frequency/types/index'
import type { IndividualFrequencyAlert } from '@/features/individual-frequency/types/index'
import { useAuthStore } from '@/stores/auth'

/**
 * Bandeau de la fiche utilisateur : ce voyageur déclaré Particulier dépasse le seuil de trajets
 * avec colis. Absent sans alerte (et avec un ancien back, qui n'envoie pas le champ). L'alerte ne
 * bloque rien ; « Écarter » (GP_PRO_REVIEW) la ferme, puis le parent relit la fiche (`changed`).
 */
const props = defineProps<{ alert?: IndividualFrequencyAlert | null }>()
const emit = defineEmits<{ changed: [] }>()

const auth = useAuthStore()
const dismissal = useIndividualFrequencyDismiss({ onStale: () => emit('changed') })
const confirming = ref(false)

const visible = computed(() => !!props.alert?.flagId)
const canDismiss = computed(() => auth.can('GP_PRO_REVIEW') && !dismissal.unavailable.value)

function ask() {
  dismissal.clearError()
  confirming.value = true
}
async function onConfirm() {
  const flagId = props.alert?.flagId
  if (!flagId) return
  const ok = await dismissal.run(flagId)
  confirming.value = false
  if (ok) emit('changed')
}
</script>

<template>
  <div
    v-if="visible && alert" data-test="user-individual-frequency" role="status"
    class="rounded-card border border-warning/30 bg-warning/5 px-4 py-3 text-sm"
  >
    <p class="font-medium text-warning text-pretty" data-test="user-individual-frequency-text">{{ frequencySummary(alert) }}</p>
    <p class="mt-1 text-xs text-text-muted text-pretty">
      Aucun blocage automatique : le voyageur est invité à confirmer son statut. Écartez l’alerte si rien ne la justifie.
    </p>
    <p
      v-if="dismissal.error.value" data-test="user-individual-frequency-error" role="alert"
      class="mt-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger text-pretty"
    >{{ dismissal.error.value }}</p>
    <button
      v-if="canDismiss" type="button" data-test="user-individual-frequency-dismiss" :disabled="dismissal.busy.value"
      class="mt-2 rounded-btn border border-border px-3 py-1.5 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
      @click="ask"
    >Écarter</button>

    <ConfirmActionDialog
      :open="confirming" title="Écarter l’alerte"
      message="Ce voyageur ne sera plus signalé tant que son nombre de trajets reste au-dessus du seuil. Aucun statut n’est modifié."
      confirm-label="Écarter" confirm-tone="primary"
      @confirm="onConfirm" @cancel="confirming = false"
    />
  </div>
</template>
