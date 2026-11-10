<script setup lang="ts">
import { computed } from 'vue'
import type { SummaryPart } from '@/features/video-modals/lib/summary'
import type { AudienceEstimate } from '@/features/video-modals/types/index'

/**
 * « En clair » : la phrase générée à partir des réglages, puis l'estimation d'audience (comptes concernés,
 * et part retenue par le tirage). Couleurs unies : marine, or pour les réglages mis en avant.
 */
const props = defineProps<{
  parts: SummaryPart[]
  priority: number | string
  samplePercent: number | string
  /** Estimation possible : conditions complètes et réglages valides. */
  ready: boolean
  loading: boolean
  error: string | null
  result: AudienceEstimate | null
  /** Les situations sont vérifiées par le serveur : l'estimation n'en tient pas compte. */
  hasSituations?: boolean
}>()
const emit = defineEmits<{ retry: [] }>()

const nf = new Intl.NumberFormat('fr-FR')
const sampled = computed(() => typeof props.samplePercent === 'number' && props.samplePercent < 100)
</script>

<template>
  <div data-test="vm-summary" class="rounded-card bg-[#041D54] px-6 py-5 text-[15px] leading-relaxed text-white">
    <p>
      <b class="font-extrabold">En clair :</b>
      <span data-test="vm-summary-text">
        {{ ' ' }}<template v-for="(p, i) in parts" :key="i"><b v-if="p.strong" class="font-bold text-[#FFC23D]">{{ p.text }}</b><template v-else>{{ p.text }}</template></template>
      </span>
    </p>
    <div class="mt-4 flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-white/20 pt-4 text-sm" data-test="vm-estimate">
      <template v-if="!ready">
        <p data-test="vm-estimate-hint" class="text-white/80">Complétez le ciblage pour estimer le nombre de comptes concernés.</p>
      </template>
      <template v-else-if="loading">
        <p data-test="vm-estimate-loading" role="status" class="flex items-center gap-2 text-white/80">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
          Estimation en cours…
        </p>
      </template>
      <template v-else-if="error">
        <p data-test="vm-estimate-error" role="alert" class="flex flex-wrap items-center gap-3 text-white">
          <span>{{ error }}</span>
          <button
            type="button" data-test="vm-estimate-retry"
            class="whitespace-nowrap rounded-btn border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
            @click="emit('retry')"
          >Réessayer</button>
        </p>
      </template>
      <template v-else-if="result">
        <div data-test="vm-estimate-accounts">
          <b class="block text-2xl font-bold tabular-nums">≈ {{ nf.format(result.accounts) }}</b>comptes concernés
        </div>
        <div v-if="sampled" data-test="vm-estimate-sample">
          <b class="block text-2xl font-bold tabular-nums">≈ {{ nf.format(result.afterSample) }}</b>après le tirage à {{ samplePercent }} %
        </div>
      </template>
      <div data-test="vm-summary-priority">
        <b class="block text-2xl font-bold tabular-nums">{{ priority === '' ? 0 : priority }}</b>priorité
      </div>
    </div>
    <p v-if="ready && !loading && !error && result" data-test="vm-estimate-note" class="mt-3 text-xs text-white/70">
      Seulement des comptes : les visiteurs sans compte ne sont pas comptés.<template v-if="hasSituations"> Les situations sont vérifiées par le serveur à chaque ouverture : elles ne sont pas dans ce nombre.</template>
    </p>
  </div>
</template>
