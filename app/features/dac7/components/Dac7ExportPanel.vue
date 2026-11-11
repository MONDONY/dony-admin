<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
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
  /** Noms des voyageurs déjà chargés dans le tableau, par identifiant : sert à nommer les voyageurs d'un refus. */
  names?: Record<string, string>
}>()

const emit = defineEmits<{ busy: [value: boolean] }>()

const exporter = useDac7Export()
const mode = ref<Dac7ExportMode>('FULL')
const confirmingDeposit = ref(false)
const includeAlreadyExported = ref(false)
/** Numéro d'ordre de la déclaration : vide = valeur par défaut du serveur (0). */
const sequence = ref<number | string>('')
const sequenceValid = computed(() => sequence.value === '' || (Number.isInteger(sequence.value) && Number(sequence.value) >= 0))

async function onDeposit() {
  confirmingDeposit.value = false
  await exporter.markDeposited()
}

function runExport() {
  void exporter.run(props.year, mode.value, {
    sequence: sequence.value === '' ? undefined : Number(sequence.value),
    includeAlreadyExported: includeAlreadyExported.value,
  })
}

const MAX_NAMED = 20
/** Voyageurs d'un refus : le nom quand le tableau le connaît, sinon l'identifiant seul. */
const concerned = computed(() => {
  const ids = exporter.travelerIds.value
  const label = (id: string) => props.names?.[id] || id
  return { shown: ids.slice(0, MAX_NAMED).map(label), more: Math.max(0, ids.length - MAX_NAMED) }
})
const warningsLabel = computed(() => {
  const n = exporter.result.value?.warnings
  return n && n > 0 ? `${n} élément${n > 1 ? 's' : ''} à vérifier (remboursements, anomalies).` : null
})

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

    <label class="flex cursor-pointer items-start gap-2 text-sm">
      <input v-model="includeAlreadyExported" type="checkbox" data-test="dac7-include-exported" class="mt-1">
      <span>
        <span class="font-medium">Inclure les voyageurs déjà déposés cette année</span>
        <span class="block text-xs text-text-muted text-pretty">Sans cette case, un export Partiel écarte ceux déjà présents dans un fichier marqué comme déposé.</span>
      </span>
    </label>

    <details data-test="dac7-advanced" class="rounded-btn border border-border px-3 py-2 text-sm">
      <summary class="cursor-pointer font-medium">Avancé</summary>
      <label class="mt-2 flex flex-col gap-1 text-sm">
        <span>Numéro d’ordre de la déclaration</span>
        <input
          v-model.number="sequence" type="number" min="0" step="1" inputmode="numeric" data-test="dac7-sequence"
          placeholder="0" class="w-32 rounded-btn border border-border bg-bg p-2 text-sm tabular-nums"
        >
        <span class="text-xs text-text-muted text-pretty">Facultatif, 0 par défaut. À changer seulement pour un nouveau dépôt de la même année.</span>
        <span v-if="!sequenceValid" data-test="dac7-sequence-error" class="text-xs text-danger">Entrez un nombre entier, 0 ou plus.</span>
      </label>
    </details>

    <div class="flex flex-wrap gap-2">
      <button
        type="button" data-test="dac7-export-run" :disabled="exporter.busy.value || exporter.csvBusy.value || !sequenceValid"
        class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40"
        @click="runExport"
      >{{ exporter.busy.value ? 'Génération…' : 'Exporter le fichier' }}</button>
      <button
        type="button" data-test="dac7-export-csv" :disabled="exporter.busy.value || exporter.csvBusy.value"
        class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
        @click="exporter.runControl(year)"
      >CSV de contrôle</button>
    </div>

    <p data-test="dac7-export-deposit-help" class="text-xs text-text-muted text-pretty">
      Un fichier généré n’est pas considéré comme déposé tant que vous ne le marquez pas.
    </p>

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
      <p v-if="concerned.shown.length" data-test="dac7-export-travelers" class="mt-2 text-sm text-pretty">
        <span class="font-medium">Voyageurs concernés :</span>
        {{ concerned.shown.join(', ') }}<span v-if="concerned.more"> et {{ concerned.more }} autre{{ concerned.more > 1 ? 's' : '' }}</span>
      </p>
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
      <p v-if="warningsLabel" data-test="dac7-export-warnings" class="text-sm text-warning text-pretty">{{ warningsLabel }}</p>
      <p
        v-if="exporter.result.value.deposited" data-test="dac7-export-deposited"
        class="self-start rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"
      >Marqué comme déposé</p>
      <div v-else-if="exporter.result.value.runId" class="flex flex-col items-start gap-2">
        <button
          type="button" data-test="dac7-export-deposit" :disabled="exporter.depositBusy.value"
          class="rounded-btn border border-border px-3 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="confirmingDeposit = true"
        >J’ai déposé ce fichier sur Télé-TD</button>
        <p
          v-if="exporter.depositError.value" data-test="dac7-export-deposit-error" role="alert"
          class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
        >{{ exporter.depositError.value }}</p>
      </div>
    </div>
    <ConfirmActionDialog
      :open="confirmingDeposit" title="Marquer le fichier comme déposé"
      message="Les voyageurs de ce fichier seront exclus des prochains exports partiels."
      confirm-label="Marquer comme déposé" confirm-tone="primary"
      @confirm="onDeposit" @cancel="confirmingDeposit = false"
    />
  </section>
</template>
