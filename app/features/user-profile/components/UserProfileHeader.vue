<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { userStatusMeta, placeLabel } from '@/features/bids/lib/bidLabels'
import type { AdminUserDetail } from '@/features/users/types/index'

const props = defineProps<{ user: AdminUserDetail }>()

const fullName = computed(() => [props.user.firstName, props.user.lastName].filter(Boolean).join(' ').trim())
const displayName = computed(() => fullName.value || props.user.email?.trim() || props.user.id.slice(0, 8))
const initials = computed(() => {
  const letters = [props.user.firstName, props.user.lastName].map(s => s?.trim().charAt(0) ?? '').join('').toUpperCase()
  return letters || displayName.value.charAt(0).toUpperCase()
})
const KYC_LABELS = {
  VERIFIED: { label: 'Identité vérifiée', tone: 'success' as const },
  PENDING: { label: 'Identité en cours', tone: 'warning' as const },
  REJECTED: { label: 'Identité refusée', tone: 'danger' as const },
  NOT_STARTED: { label: 'Identité non vérifiée', tone: 'neutral' as const },
} as Record<string, { label: string, tone: 'success' | 'warning' | 'danger' | 'neutral' }>
const kycLabel = computed(() => KYC_LABELS[props.user.kycStatus] ?? { label: props.user.kycStatus || 'Identité inconnue', tone: 'neutral' as const })
const roleLabel = computed(() => {
  const sender = props.user.roles.includes('ROLE_SENDER')
  const traveler = props.user.roles.includes('ROLE_TRAVELER')
  if (sender && traveler) return 'Voyageur et expéditeur'
  if (traveler) return 'Voyageur'
  if (sender) return 'Expéditeur'
  return null
})
const place = computed(() => (props.user.city || props.user.country) ? placeLabel(props.user.city, props.user.country) : null)
const created = computed(() => new Date(props.user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))
const commission = computed(() => props.user.commissionRateOverride === null || props.user.commissionRateOverride === undefined
  ? 'taux global'
  : `${props.user.commissionRateOverride} %`)

const copied = ref(false)
async function copyId() {
  try {
    await navigator.clipboard.writeText(props.user.id)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* presse-papiers refusé : l'identifiant reste lisible à l'écran */ }
}
</script>

<template>
  <section class="flex flex-wrap items-center justify-between gap-5 rounded-card border border-border bg-surface p-6" data-test="profile-header">
    <div class="flex min-w-0 items-center gap-4">
      <div
        data-test="profile-avatar" aria-hidden="true"
        class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-white"
      >{{ initials }}</div>
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 data-test="profile-name" class="text-2xl font-extrabold text-balance break-words">{{ displayName }}</h2>
          <StatusBadge v-bind="userStatusMeta(user.status)" />
          <StatusBadge v-bind="kycLabel" />
          <StatusBadge v-if="roleLabel" :label="roleLabel" />
          <StatusBadge v-if="user.gpPro" label="GP Pro" tone="info" />
          <StatusBadge v-if="user.isProAccount" label="Compte PRO" tone="info" />
        </div>
        <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-muted">
          <span>{{ user.phoneNumber }}</span>
          <span v-if="user.email">{{ user.email }}</span>
          <span v-if="place">{{ place }}</span>
          <span>Inscrit le {{ created }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-text-muted">
          <span class="inline-flex items-center gap-2">
            <span class="break-all">ID : {{ user.id }}</span>
            <span class="sr-only" aria-live="polite">{{ copied ? 'ID copié' : '' }}</span>
            <button
              type="button" data-test="copy-id"
              class="rounded-btn border border-border px-2 py-0.5 transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
              @click="copyId"
            >{{ copied ? 'Copié' : 'Copier l’ID' }}</button>
          </span>
          <span>Commission : {{ commission }}</span>
        </div>
      </div>
    </div>
    <div data-test="profile-actions-slot" class="flex flex-wrap gap-2" />
  </section>
</template>
