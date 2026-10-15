<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { ReportRatingPreview, ReportTargetAuthor } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'

/**
 * Avis signalé, affiché dans la colonne Cible : sans lui, l'admin ne voyait que l'identifiant
 * de l'avis et devait l'exclure ou le supprimer sans l'avoir lu.
 */
const props = defineProps<{
  reportId: string
  preview: ReportRatingPreview
  author?: ReportTargetAuthor | null
}>()
const auth = useAuthStore()
const stars = computed(() => Math.min(5, Math.max(0, Math.round(props.preview.stars))))
const date = computed(() => new Date(props.preview.createdAt).toLocaleDateString('fr-FR'))
function userLink(id: string) { return { path: '/users', query: { query: id, open: id } } }
const canOpenUsers = computed(() => auth.can('USER_VIEW'))
</script>

<template>
  <div
    :data-test="`report-rating-${reportId}`"
    class="mt-1.5 max-w-sm rounded border border-border bg-surface-elevated px-2.5 py-2 text-xs"
  >
    <div class="flex items-center gap-2">
      <span
        class="tracking-wide text-warning" :aria-label="`${stars} étoile${stars > 1 ? 's' : ''} sur 5`"
        :data-test="`report-rating-stars-${reportId}`"
      ><span aria-hidden="true">{{ '★'.repeat(stars) }}<span class="text-text-muted/40">{{ '★'.repeat(5 - stars) }}</span></span></span>
      <span class="text-text-muted tabular-nums">{{ date }}</span>
      <StatusBadge
        v-if="preview.excludedFromAverage" :data-test="`report-rating-excluded-${reportId}`"
        label="Exclu de la moyenne" tone="neutral"
      />
    </div>
    <p
      v-if="preview.comment" :data-test="`report-rating-comment-${reportId}`"
      class="mt-1 whitespace-pre-line text-pretty text-sm text-text"
    >«&nbsp;{{ preview.comment }}&nbsp;»</p>
    <p v-else class="mt-1 italic text-text-muted">Sans commentaire</p>
    <div v-if="author" class="mt-1.5 text-text-muted">
      Écrit par
      <NuxtLink
        v-if="canOpenUsers" :to="userLink(author.userId)" :data-test="`report-rating-author-${reportId}`"
        class="text-primary underline-offset-2 hover:underline"
      >{{ author.name ?? 'son auteur' }}</NuxtLink>
      <span v-else>{{ author.name ?? 'son auteur' }}</span>
    </div>
    <NuxtLink
      v-if="preview.ratedUserId && canOpenUsers" :to="userLink(preview.ratedUserId)"
      :data-test="`report-rating-rated-${reportId}`"
      class="mt-1 inline-block text-primary underline-offset-2 hover:underline"
    >Fiche de {{ preview.ratedUserName ?? 'la personne notée' }}</NuxtLink>
  </div>
</template>
