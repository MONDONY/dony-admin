<script setup lang="ts">
import { ArrowRight, Plus, Trash2 } from 'lucide-vue-next'
import type { CorridorDraft } from '@/features/video-modals/lib/form'
import { CORRIDORS_MAX } from '@/features/video-modals/types/index'

/**
 * « Trajet ou colis précis » : liste de corridors (départ, arrivée), de 10 au plus. Un côté peut rester vide
 * (n'importe lequel). Liste vide = tous les trajets et colis. Ne joue que pour les moments qui transmettent
 * un corridor : recherche, favori, consultation répétée, formulaire abandonné, trajet ou demande publié.
 */
defineProps<{
  corridors: CorridorDraft[]
  /** Un moment qui transmet un corridor est coché : sinon la liste n'a aucun effet. */
  applies: boolean
  error?: string
}>()
const emit = defineEmits<{
  add: []
  remove: [index: number]
  set: [index: number, side: keyof CorridorDraft, value: string]
}>()

const inputClass = 'w-full rounded-btn border border-border bg-bg p-2 text-sm'
</script>

<template>
  <fieldset data-test="vm-corridors">
    <legend class="mb-1 text-xs font-bold uppercase tracking-wide text-text-muted">Trajet ou colis précis</legend>
    <p class="mb-2 text-xs text-text-muted text-pretty">
      Le modal ne s’ouvre que si le trajet ou le colis concerné correspond à une ligne. Ville ou pays, sans tenir compte des accents ni des majuscules.
      Un côté vide veut dire « n’importe lequel ».
    </p>
    <p v-if="corridors.length === 0" data-test="vm-corridors-empty" class="mb-2 text-sm text-text-muted">Aucune ligne : tous les trajets et colis sont concernés.</p>

    <div
      v-for="(c, i) in corridors" :key="i" :data-test="`vm-corridor-${i}`"
      class="mb-2 grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
    >
      <input
        :value="c.from" :data-test="`vm-corridor-from-${i}`" type="text" aria-label="Départ" placeholder="Départ : Paris, France…" autocomplete="off" :class="inputClass"
        @input="emit('set', i, 'from', ($event.target as HTMLInputElement).value)"
      >
      <ArrowRight class="hidden h-4 w-4 text-text-muted sm:block" aria-hidden="true" />
      <input
        :value="c.to" :data-test="`vm-corridor-to-${i}`" type="text" aria-label="Arrivée" placeholder="Arrivée : Abidjan, Côte d’Ivoire…" autocomplete="off" :class="inputClass"
        @input="emit('set', i, 'to', ($event.target as HTMLInputElement).value)"
      >
      <button
        type="button" :data-test="`vm-corridor-remove-${i}`" aria-label="Retirer ce trajet"
        class="flex h-9 w-9 items-center justify-center rounded-btn text-text-muted hover:bg-surface-elevated hover:text-danger"
        @click="emit('remove', i)"
      ><Trash2 class="h-4 w-4" aria-hidden="true" /></button>
    </div>

    <button
      type="button" data-test="vm-corridor-add" :disabled="corridors.length >= CORRIDORS_MAX"
      class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-40"
      @click="emit('add')"
    ><Plus class="h-4 w-4" aria-hidden="true" />Ajouter un trajet</button>
    <span class="ml-2 text-xs tabular-nums text-text-muted" data-test="vm-corridor-count">{{ corridors.length }} / {{ CORRIDORS_MAX }}</span>

    <p v-if="corridors.length > 0 && !applies" data-test="vm-corridors-inactive" class="mt-2 text-xs text-warning text-pretty">
      Sans effet pour l’instant : cochez un moment de recherche, de favori, de consultation, de formulaire abandonné, ou de trajet ou demande publié.
    </p>
    <p v-if="error" data-test="vm-corridors-error" class="mt-1 text-xs text-danger">{{ error }}</p>
  </fieldset>
</template>
