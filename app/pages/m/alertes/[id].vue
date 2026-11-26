<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { alertSeverityMeta } from '@/features/alerts/components/alertSeverity'
import { useMobileAlertDetail } from '@/features/mobile/composables/useMobileAlertDetail'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'ALERT_VIEW', pageTitle: 'Alerte' })

const route = useRoute()
const {
  alert, guide, facts, isLoading, error, notFound, claimBusy, claimError, claimedBy, canClaim, canRelease, load, claim, release,
} = useMobileAlertDetail(computed(() => route.params?.id))
const severity = computed(() => (alert.value ? alertSeverityMeta(alert.value.severity) : null))
const tone = computed(() => ({ danger: 'bg-danger/15 text-danger', warning: 'bg-warning/15 text-warning', info: 'bg-primary/10 text-primary' }[severity.value?.tone ?? 'info']))

onMounted(load)
</script>

<template>
  <div>
    <NuxtLink to="/m/alertes" class="mb-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary">Alertes</NuxtLink>

    <p v-if="notFound" data-test="alert-not-found" class="text-sm text-text-muted">Alerte introuvable.</p>
    <p v-else-if="error" data-test="alert-error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else-if="isLoading && !alert" class="text-sm text-text-muted">Chargement…</p>

    <article v-else-if="alert && guide" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <span data-test="tag-severity" class="rounded-full px-3 py-1 text-xs font-bold" :class="tone">{{ severity?.label }}</span>
        <span data-test="tag-category" class="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-muted">{{ guide.category }}</span>
      </div>
      <h2 data-test="alert-title" class="font-display text-xl font-bold text-text">{{ guide.title }}</h2>

      <section v-if="facts.length" data-test="facts" class="rounded-xl border border-border bg-surface px-3 py-2">
        <dl class="divide-y divide-border">
          <div v-for="f in facts" :key="f.key" class="flex justify-between gap-4 py-2 text-sm">
            <dt class="text-text-muted">{{ f.label }}</dt>
            <dd class="min-w-0 break-words text-right font-semibold text-text">{{ f.value }}</dd>
          </div>
        </dl>
      </section>

      <section data-test="explanation" class="rounded-xl border border-border bg-surface px-3 py-3">
        <h3 class="text-sm font-bold text-text">Pourquoi c’est important</h3>
        <p class="mt-1 text-sm text-text-muted">{{ guide.explanation }}</p>
      </section>

      <section data-test="desktop-steps" class="rounded-xl border border-dashed border-border px-3 py-3">
        <h3 class="text-sm font-bold text-text">Ensuite, sur l’ordinateur</h3>
        <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-muted">
          <li v-for="(step, i) in guide.actions" :key="i">{{ step }}</li>
        </ol>
      </section>

      <div class="sticky -mx-4 bottom-0 -mb-4 space-y-2 border-t border-border bg-surface px-4 py-3">
        <p v-if="claimedBy" data-test="claimed-by" class="text-sm font-semibold text-text">Pris en charge par {{ claimedBy }}</p>
        <p v-if="claimError" data-test="claim-error" class="text-sm text-danger" role="alert">{{ claimError }}</p>
        <button
          v-if="canClaim" type="button" data-test="claim-button" :disabled="claimBusy"
          class="min-h-[48px] w-full whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
          @click="claim"
        >J’ai vu, je m’en occupe</button>
        <button
          v-if="canRelease" type="button" data-test="release-button" :disabled="claimBusy"
          class="min-h-[48px] w-full whitespace-nowrap rounded-xl border border-border bg-surface px-4 text-sm font-bold text-text disabled:opacity-60"
          @click="release"
        >Libérer</button>
      </div>
    </article>
  </div>
</template>
