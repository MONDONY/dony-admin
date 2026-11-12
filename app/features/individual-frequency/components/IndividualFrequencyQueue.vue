<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useIndividualFrequencyDismiss } from '@/features/individual-frequency/composables/useIndividualFrequencyDismiss'
import { useIndividualFrequencyFlags } from '@/features/individual-frequency/composables/useIndividualFrequencyFlags'
import { frequencySummary } from '@/features/individual-frequency/types/index'
import type { IndividualFrequencyFlagRow } from '@/features/individual-frequency/types/index'
import { ageLabel, applicantName } from '@/features/gp-pro/lib/gpProWorkbench'
import { gate, toHref, userRoute } from '@/lib/adminLinks'
import { parseServerDate } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * File « Particuliers à confirmer », posée sous le poste GP Pro (mêmes droits : GP_PRO_REVIEW).
 * Un voyageur déclaré Particulier au-delà du seuil de trajets publiés dans le mois civil est signalé à l'équipe,
 * qui l'écarte quand rien ne la justifie. Une alerte ne bloque ni ne sanctionne jamais. Un ancien
 * back sans l'endpoint : la section disparaît, sans erreur.
 */
const auth = useAuthStore()
const flags = useIndividualFrequencyFlags()
const dismissal = useIndividualFrequencyDismiss({ onStale: () => { void flags.load() } })
const now = ref(Date.now())

/** Du plus ancien au plus récent ; une date illisible passe en dernier. */
const rows = computed(() => [...flags.items.value].sort((a, b) => {
  const x = parseServerDate(a.detectedAt)
  const y = parseServerDate(b.detectedAt)
  if (Number.isNaN(x)) return Number.isNaN(y) ? 0 : 1
  if (Number.isNaN(y)) return -1
  return x - y
}))

const canDismiss = computed(() => auth.can('GP_PRO_REVIEW') && !dismissal.unavailable.value)
const userLink = (r: IndividualFrequencyFlagRow) => {
  const route = gate(p => auth.can(p), 'USER_VIEW', userRoute(r.userId))
  return route ? toHref(route) : null
}

const pending = ref<IndividualFrequencyFlagRow | null>(null)
function ask(row: IndividualFrequencyFlagRow) {
  dismissal.clearError()
  pending.value = row
}
async function onConfirm() {
  const row = pending.value
  if (!row) return
  const ok = await dismissal.run(row.flagId)
  pending.value = null
  if (ok) await flags.load()
}

onMounted(() => { void flags.load() })
</script>

<template>
  <section
    v-if="!flags.unavailable.value" aria-label="Particuliers à confirmer" data-test="individual-frequency-queue"
    class="mt-6 flex flex-col overflow-hidden rounded-card border border-border bg-surface"
  >
    <header class="flex flex-col gap-1 border-b border-border px-5 py-4">
      <h2 class="flex items-baseline gap-2 font-display text-lg font-bold">
        Particuliers à confirmer
        <span class="text-sm tabular-nums text-text-muted" data-test="individual-frequency-count">{{ rows.length }}</span>
      </h2>
      <p class="text-sm text-text-muted text-pretty">
        Voyageurs déclarés Particulier qui dépassent le seuil de trajets publiés dans le mois civil. Aucun blocage, aucune sanction :
        l’alerte sert à vérifier son statut, et vous l’écartez quand elle ne justifie rien.
      </p>
    </header>

    <p
      v-if="dismissal.error.value" data-test="individual-frequency-error" role="alert"
      class="m-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ dismissal.error.value }}</p>

    <ul v-if="rows.length" class="divide-y divide-border" data-test="individual-frequency-list">
      <li
        v-for="r in rows" :key="r.flagId" :data-test="`individual-frequency-row-${r.flagId}`"
        class="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
      >
        <div class="min-w-0">
          <p class="flex items-baseline gap-2">
            <span :class="['truncate text-sm font-semibold', r.displayName ? '' : 'italic text-text-muted']">{{ applicantName(r) }}</span>
            <span v-if="ageLabel(r.detectedAt, now)" class="shrink-0 text-xs tabular-nums text-text-muted">{{ ageLabel(r.detectedAt, now) }}</span>
          </p>
          <p class="text-xs text-text-muted text-pretty">{{ frequencySummary(r) }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <NuxtLink
            v-if="userLink(r)" :to="userLink(r)!" :data-test="`individual-frequency-open-${r.userId}`"
            class="text-sm text-primary underline-offset-2 hover:underline"
          >Ouvrir la fiche</NuxtLink>
          <button
            v-if="canDismiss" type="button" :data-test="`individual-frequency-dismiss-${r.flagId}`" :disabled="dismissal.busy.value"
            class="rounded-btn border border-border px-3 py-1.5 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
            @click="ask(r)"
          >Écarter</button>
        </div>
      </li>
    </ul>
    <StateBlock
      :loading="flags.isLoading.value && rows.length === 0" :error="flags.error.value" :empty="!flags.isLoading.value && !flags.error.value && rows.length === 0"
      empty-label="Aucun particulier à confirmer" empty-test="individual-frequency-empty" @retry="flags.load()"
    />

    <ConfirmActionDialog
      :open="pending !== null" title="Écarter l’alerte"
      :message="`${pending ? applicantName(pending) : ''} ne sera plus signalé tant que son nombre de trajets du mois reste au-dessus du seuil. Aucun statut n’est modifié.`"
      confirm-label="Écarter" confirm-tone="primary"
      @confirm="onConfirm" @cancel="pending = null"
    />
  </section>
</template>
