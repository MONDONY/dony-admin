<script setup lang="ts">
import { computed, ref } from 'vue'
import GpProDecisionDialog from './GpProDecisionDialog.vue'
import { gpProService } from '@/features/gp-pro/services/gpProService'
import { useGpProAction } from '@/features/gp-pro/composables/useGpProAction'
import { GP_PRO_UNAVAILABLE } from '@/features/gp-pro/types/index'
import type { AdminGpProApplicationDetail } from '@/features/gp-pro/types/index'
import { useAuthStore } from '@/stores/auth'

/**
 * Décision d'une demande GP Pro (accepter, refuser) et lien vers le compte. Les décisions sont
 * exécutées ici ; le parent relit la demande et la file (`decided`, `stale`).
 */
const props = defineProps<{
  applicationId: string
  detail: AdminGpProApplicationDetail
  /** Nom affiché dans la fenêtre de décision. */
  title: string
}>()
const emit = defineEmits<{ decided: []; stale: [] }>()
const auth = useAuthStore()

const action = useGpProAction({ onStale: () => emit('stale') })
const mode = ref<'approve' | 'reject' | null>(null)

const isPending = computed(() => props.detail.status === 'PENDING')
const kycVerified = computed(() => props.detail.kycStatus === 'VERIFIED')
const canDecide = computed(() => auth.can('GP_PRO_REVIEW') && isPending.value && !action.unavailable.value)

function openDialog(next: 'approve' | 'reject') {
  action.clearError()
  mode.value = next
}

/**
 * Raccourcis du poste (A, R) : même conditions que les boutons. Accepter reste fermé tant que
 * l'identité n'est pas vérifiée.
 */
function startDecision(kind: 'approve' | 'reject') {
  if (action.busy.value || !canDecide.value) return
  if (kind === 'approve' && !kycVerified.value) return
  openDialog(kind)
}
/** Une fenêtre de saisie est ouverte : le poste suspend alors J / K, A et R. */
const dialogOpen = () => mode.value !== null
defineExpose({ startDecision, dialogOpen })

async function onSubmit(reason: string) {
  const id = props.applicationId
  const ok = mode.value === 'approve'
    ? await action.run(() => gpProService.approve(id))
    : await action.run(() => gpProService.reject(id, reason))
  // Succès ou endpoint absent : le dialogue n'a plus lieu d'être. Sur un refus du back, il
  // reste ouvert pour que le message se lise à côté de la saisie.
  if (ok || action.unavailable.value) mode.value = null
  if (ok) emit('decided')
}

const btn = 'flex w-full items-start justify-between gap-2 rounded-btn px-4 py-2.5 text-left text-sm font-medium transition-[background-color,scale] active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100'
</script>

<template>
  <aside aria-label="Décision" class="flex min-w-0 flex-col gap-3" data-test="gp-pro-decision-panel">
    <section v-if="isPending" data-test="gp-pro-actions" class="rounded-card border border-border bg-surface p-4">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Décision</h3>
      <p v-if="action.unavailable.value" data-test="gp-pro-actions-unavailable" class="mb-3 text-xs text-text-muted">{{ GP_PRO_UNAVAILABLE }}</p>
      <div v-if="canDecide" class="flex flex-col gap-2">
        <button
          type="button" data-test="gp-pro-approve" :disabled="action.busy.value || !kycVerified"
          :class="[btn, 'bg-success/15 text-success hover:bg-success/25']"
          @click="openDialog('approve')"
        >
          <span>Accepter<span v-if="kycVerified" class="block text-xs font-normal opacity-80">Le badge s’affiche aussitôt</span></span>
          <span class="text-xs opacity-70">{{ kycVerified ? 'A ›' : 'Verrouillé' }}</span>
        </button>
        <button
          type="button" data-test="gp-pro-reject" :disabled="action.busy.value"
          :class="[btn, 'bg-danger/15 text-danger hover:bg-danger/25']"
          @click="openDialog('reject')"
        >
          <span>Refuser<span class="block text-xs font-normal opacity-80">Motif obligatoire, lu par la personne</span></span>
          <span class="text-xs opacity-70">R ›</span>
        </button>
      </div>
      <p v-if="canDecide && !kycVerified" data-test="gp-pro-approve-kyc-hint" class="mt-2 text-xs text-text-muted text-pretty">
        Acceptation impossible : l’identité n’est plus vérifiée. Refuser reste possible, avec un motif.
      </p>
      <p v-else-if="canDecide" class="mt-2 text-xs text-text-muted text-pretty">
        Accepter prévient la personne par notification et e-mail. Refuser lui laisse refaire une demande tout de suite.
      </p>
    </section>

    <section class="rounded-card border border-border bg-surface p-4" data-test="gp-pro-account">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Compte</h3>
      <p class="mt-1 text-sm font-semibold">{{ title }}</p>
      <NuxtLink
        :to="`/users?open=${detail.userId}`" data-test="gp-pro-user-link"
        class="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
      >Ouvrir la fiche utilisateur ›</NuxtLink>
    </section>

    <GpProDecisionDialog
      :open="mode !== null" :mode="mode ?? 'approve'" :user-name="title"
      :busy="action.busy.value" :error="action.error.value"
      @submit="onSubmit" @cancel="mode = null"
    />
  </aside>
</template>
