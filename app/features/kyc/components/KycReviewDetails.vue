<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { kycActorLabel, kycDecisionMeta, kycHistoryActionLabel } from '@/features/kyc/types/index'
import type { AdminKycDetail } from '@/features/users/types/index'

/**
 * Lien vers la session chez le fournisseur, décision admin et historique d'un dossier KYC.
 * Partagé par la fiche latérale de /kyc et l'onglet KYC de la fiche utilisateur. Un ancien
 * back n'envoie ni décision ni historique : les sections se replient sans bruit.
 */
defineProps<{ kyc: AdminKycDetail }>()

function fmt(d: string | null | undefined) { return d ? new Date(d).toLocaleString('fr-FR') : 'Date inconnue' }
</script>

<template>
  <div class="space-y-5">
    <a
      v-if="kyc.providerSessionUrl" :href="kyc.providerSessionUrl" target="_blank" rel="noopener noreferrer"
      data-test="kyc-provider-link"
      class="inline-flex items-center rounded-btn border border-border px-3 py-2 text-sm font-medium text-primary transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
    >Voir la session chez le fournisseur</a>

    <section>
      <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-2">Décision admin</h3>
      <div v-if="kyc.decisionKind" data-test="kyc-decision" class="rounded-card border border-border px-3 py-2 text-sm space-y-1">
        <StatusBadge v-bind="kycDecisionMeta(kyc.decisionKind)" />
        <p data-test="kyc-decision-by" class="text-text-muted tabular-nums">
          Par {{ kyc.decidedByAdminEmail ?? 'un administrateur inconnu' }}, le {{ fmt(kyc.decidedAt) }}
        </p>
        <p v-if="kyc.decisionReason" data-test="kyc-decision-reason" class="text-pretty break-words">
          Motif : {{ kyc.decisionReason }}
        </p>
      </div>
      <p v-else data-test="kyc-no-decision" class="text-sm text-text-muted">Aucune décision manuelle.</p>
    </section>

    <section v-if="kyc.history" data-test="kyc-history">
      <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-2">Historique</h3>
      <ol v-if="kyc.history.length" class="space-y-2">
        <li
          v-for="(h, i) in kyc.history" :key="`${h.at}-${i}`" :data-test="`kyc-history-item-${i}`"
          class="border-l-2 border-border pl-3 text-sm"
        >
          <div class="font-medium">{{ kycHistoryActionLabel(h.action) }}</div>
          <div class="text-xs text-text-muted tabular-nums">
            {{ fmt(h.at) }} · {{ kycActorLabel(h.actorKind) }}<template v-if="h.actorEmail"> ({{ h.actorEmail }})</template>
          </div>
          <p v-if="h.detail" class="mt-0.5 text-xs text-text-muted text-pretty break-words">{{ h.detail }}</p>
        </li>
      </ol>
      <p v-else data-test="kyc-history-empty" class="text-sm text-text-muted">Aucun événement.</p>
    </section>
  </div>
</template>
