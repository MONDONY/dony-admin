<script setup lang="ts">
import { ageLabel, applicantName } from '@/features/gp-pro/lib/gpProWorkbench'
import { fmtDate, reviewReasonLabel } from '@/features/gp-pro/types/index'
import type { AdminGpProReviewRow } from '@/features/gp-pro/types/index'

/**
 * Titulaire du badge signalé par la revue automatique, au centre du poste. Une alerte n'agit
 * jamais seule : l'admin l'écarte (une par une), ou retire le badge depuis la fiche utilisateur.
 * Le serveur ne sert que le nom et les alertes : le détail se lit sur la fiche.
 */
defineProps<{
  /** Ligne de la file ; absente quand le titulaire est ouvert par lien profond et n'est plus à revoir. */
  row: AdminGpProReviewRow | null
  userId: string
  canDismiss: boolean
  busy?: boolean
  error?: string | null
  now?: number
}>()
const emit = defineEmits<{ dismiss: [flagId: string] }>()
</script>

<template>
  <section aria-label="Titulaire" class="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface" data-test="gp-pro-review-case">
    <header class="border-b border-border px-5 py-4">
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="row" class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning" data-test="gp-pro-review-count">{{ (row.flags ?? []).length }} alerte{{ (row.flags ?? []).length > 1 ? 's' : '' }}</span>
      </div>
      <h2 class="mt-2 font-display text-xl font-bold text-balance" data-test="gp-pro-review-title">{{ row ? applicantName(row) : `Titulaire ${userId.slice(0, 8)}` }}</h2>
      <p v-if="row?.detectedAt" class="mt-0.5 text-sm tabular-nums text-text-muted" data-test="gp-pro-review-since">
        À revoir depuis le {{ fmtDate(row.detectedAt) }}<template v-if="ageLabel(row.detectedAt, now)"> · {{ ageLabel(row.detectedAt, now) }}</template>
      </p>
    </header>

    <div class="flex flex-col gap-5 p-5">
      <p class="rounded-card border border-info/40 bg-info/10 px-4 py-3 text-sm text-pretty">
        <b>Une alerte ne retire jamais le badge.</b> Écartez celle qui ne justifie rien : elle ne revient que sur un nouveau motif. Le retrait se fait depuis la fiche utilisateur.
      </p>

      <p
        v-if="error" data-test="gp-pro-review-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>

      <p v-if="!row" data-test="gp-pro-review-gone" class="rounded-card border border-border px-4 py-3 text-sm text-text-muted text-pretty">
        Ce titulaire n’a plus d’alerte ouverte, ou elle n’est pas dans la page affichée.
      </p>

      <section v-else>
        <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Alertes ouvertes</h3>
        <ul class="divide-y divide-border rounded-card border border-border">
          <li v-for="f in row.flags ?? []" :key="f.flagId" class="flex items-center justify-between gap-3 px-4 py-3" :data-test="`gp-pro-flag-${f.flagId}`">
            <span class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">{{ reviewReasonLabel(f.reason) }}</span>
            <button
              v-if="canDismiss" type="button" :data-test="`gp-pro-dismiss-${f.flagId}`" :disabled="busy"
              class="rounded-btn border border-border px-3 py-1.5 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
              @click="emit('dismiss', f.flagId)"
            >Écarter</button>
          </li>
        </ul>
        <p class="mt-2 text-xs text-text-muted">Chaque alerte s’écarte à part.</p>
      </section>

      <section class="rounded-card border border-border px-4 py-3 text-sm text-pretty">
        Le détail de ses notes, de ses litiges et de ses trajets se lit sur sa fiche utilisateur.
      </section>
    </div>
  </section>
</template>
