<script setup lang="ts">
import { applicantName } from '@/features/gp-pro/lib/gpProWorkbench'
import type { AdminGpProReviewRow } from '@/features/gp-pro/types/index'

/** Côté décision d'un titulaire à revoir : le retrait du badge passe par la fiche utilisateur. */
defineProps<{ row: AdminGpProReviewRow | null; userId: string }>()
</script>

<template>
  <aside aria-label="Décision" class="flex min-w-0 flex-col gap-3" data-test="gp-pro-review-panel">
    <section class="rounded-card border border-border bg-surface p-4">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Retrait du badge</h3>
      <NuxtLink
        :to="`/users?open=${userId}`" data-test="gp-pro-review-remove-link"
        class="flex items-start justify-between gap-2 rounded-btn bg-danger/10 px-4 py-2.5 text-left text-sm font-medium text-danger transition-[background-color,scale] hover:bg-danger/20 active:scale-[0.96]"
      >
        <span>Retirer le badge<span class="block text-xs font-normal opacity-80">Depuis la fiche utilisateur, motif obligatoire</span></span>
        <span aria-hidden="true">↗</span>
      </NuxtLink>
    </section>

    <section class="rounded-card border border-border bg-surface p-4" data-test="gp-pro-review-account">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Compte</h3>
      <p class="mt-1 text-sm font-semibold">{{ row ? applicantName(row) : `Titulaire ${userId.slice(0, 8)}` }}</p>
      <p class="text-sm text-text-muted">Titulaire du badge GP Pro</p>
      <NuxtLink
        :to="`/users?open=${userId}`" :data-test="`gp-pro-review-open-${userId}`"
        class="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
      >Ouvrir la fiche utilisateur ›</NuxtLink>
    </section>
  </aside>
</template>
