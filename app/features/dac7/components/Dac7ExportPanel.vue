<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDac7Export } from '@/features/dac7/composables/useDac7Export'
import { DAC7_UNAVAILABLE, blockerInfo, partialMayHelp } from '@/features/dac7/types/index'
import type { Dac7ExportMode } from '@/features/dac7/types/index'

/**
 * Génération du fichier de la DGFiP et du CSV de contrôle. Le fichier est téléchargé, jamais
 * envoyé : l'avertissement du haut reste affiché en permanence.
 */
const props = defineProps<{
  year: number
  /** Nombre de blocages signalés par la synthèse (indication seulement : le serveur reste juge). */
  blockersCount?: number
}>()

const emit = defineEmits<{ busy: [value: boolean] }>()

const exporter = useDac7Export()
const mode = ref<Dac7ExportMode>('FULL')

const MODES: { value: Dac7ExportMode; label: string; help: string }[] = [
  { value: 'FULL', label: 'Complet', help: 'Tous les voyageurs déclarables. Refusé tant qu’il reste un blocage.' },
  { value: 'PARTIAL', label: 'Partiel', help: 'Voyageurs complets seulement. Les autres sont listés dans le CSV de contrôle.' },
]

const blockerList = computed(() => (exporter.blockers.value ?? []).map(blockerInfo))
const excludedLabel = computed(() => {
  const n = exporter.result.value?.excluded
  return n && n > 0 ? `${n} voyageur${n > 1 ? 's' : ''} exclu${n > 1 ? 's' : ''} du fichier : voir le CSV de contrôle.` : null
})

// Les échecs et blocages valent pour une année ; le dernier fichier téléchargé, lui, reste signalé
// (il est déjà sur le disque) jusqu'au prochain export ou à la sortie de la page.
watch(() => props.year, () => exporter.resetFailures())
// La page verrouille le sélecteur d'année tant qu'un fichier se génère : un résultat tardif ne
// peut ainsi jamais s'afficher dans la vue d'une autre année.
watch(() => exporter.busy.value || exporter.csvBusy.value, v => emit('busy', v))

const refusedTitle = computed(() => exporter.blockedMode.value === 'PARTIAL'
  ? 'Export partiel refusé : des points restent à régler.'
  : 'Export complet refusé : des points restent à régler.')
const suggestPartial = computed(() => exporter.blockedMode.value === 'FULL' && partialMayHelp(exporter.blockers.value ?? []))
</script>

<template>
  <section aria-label="Export du fichier" data-test="dac7-export-panel" class="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
    <h2 class="font-display text-lg font-bold">Fichier pour la DGFiP</h2>

    <p
      data-test="dac7-export-warning" role="note"
      class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-text text-pretty"
    >Le fichier doit être déposé par vous sur impots.gouv.fr (Télé-TD). Yadony ne l’envoie jamais.</p>

    <p v-if="blockersCount" data-test="dac7-export-hint" class="text-sm text-text-muted text-pretty">
      La synthèse signale {{ blockersCount }} blocage{{ blockersCount > 1 ? 's' : '' }} : le mode Complet sera refusé.
    </p>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Mode</legend>
      <label v-for="m in MODES" :key="m.value" class="flex cursor-pointer items-start gap-2 text-sm">
        <input
          v-model="mode" type="radio" name="dac7-mode" :value="m.value" :data-test="`dac7-mode-${m.value}`"
          class="mt-1"
        >
        <span>
          <span class="font-medium">{{ m.label }}</span>
          <span class="block text-xs text-text-muted text-pretty">{{ m.help }}</span>
        </span>
      </label>
    </fieldset>

    <div class="flex flex-wrap gap-2">
      <button
        type="button" data-test="dac7-export-run" :disabled="exporter.busy.value || exporter.csvBusy.value"
        class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40"
        @click="exporter.run(year, mode)"
      >{{ exporter.busy.value ? 'Génération…' : 'Exporter le fichier' }}</button>
      <button
        type="button" data-test="dac7-export-csv" :disabled="exporter.busy.value || exporter.csvBusy.value"
        class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
        @click="exporter.runControl(year)"
      >CSV de contrôle</button>
    </div>

    <p v-if="exporter.unavailable.value" data-test="dac7-unavailable" class="text-sm text-text-muted">{{ DAC7_UNAVAILABLE }}</p>
    <p
      v-if="exporter.error.value" data-test="dac7-export-error" role="alert"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ exporter.error.value }}</p>

    <div
      v-if="exporter.blockers.value" data-test="dac7-export-blocked" role="alert"
      class="rounded-card border border-danger/30 bg-danger/5 p-4"
    >
      <p class="text-sm font-semibold text-danger">{{ refusedTitle }}</p>
      <ul v-if="blockerList.length" class="mt-2 flex flex-col gap-2">
        <li v-for="b in blockerList" :key="b.code" :data-test="`dac7-export-blocker-${b.code}`">
          <p class="text-sm font-medium">{{ b.title }}</p>
          <p class="text-sm text-text-muted text-pretty">{{ b.explanation }}</p>
        </li>
      </ul>
      <p v-if="suggestPartial" class="mt-2 text-sm text-text-muted text-pretty">Vous pouvez aussi choisir le mode Partiel.</p>
    </div>

    <div v-if="exporter.result.value" data-test="dac7-export-result" role="status" class="flex flex-col gap-2 rounded-card border border-border bg-bg p-4">
      <p class="text-sm text-pretty">
        Fichier de l’année {{ exporter.result.value.year }} téléchargé :
        <span class="break-all font-mono text-xs">{{ exporter.result.value.filename }}</span>
      </p>
      <p
        v-if="exporter.result.value.filenameFallback" data-test="dac7-filename-fallback"
        class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text text-pretty"
      >Nom de fichier inconnu : renommez-le selon la règle de nommage de la DGFiP avant tout test.</p>
      <div
        v-if="exporter.result.value.encrypted === false" data-test="dac7-unencrypted-banner"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-danger"
      >
        <p class="text-sm font-semibold">Fichier non chiffré, ne pas déposer</p>
        <p class="text-xs text-pretty">Il contient des données personnelles en clair : supprimez-le de votre ordinateur.</p>
      </div>
      <p v-else-if="exporter.result.value.encrypted === true" class="text-sm text-success">Fichier chiffré.</p>
      <p
        v-else data-test="dac7-export-encryption-unknown"
        class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text text-pretty"
      >Le serveur n’a pas indiqué si le fichier est chiffré : vérifiez-le avant tout dépôt.</p>
      <p v-if="excludedLabel" data-test="dac7-export-excluded" class="text-sm text-text-muted text-pretty">{{ excludedLabel }}</p>
    </div>
  </section>
</template>
