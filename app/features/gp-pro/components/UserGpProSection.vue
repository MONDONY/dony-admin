<script setup lang="ts">
import { computed, ref } from 'vue'
import GpProDecisionDialog from './GpProDecisionDialog.vue'
import { gpProService } from '@/features/gp-pro/services/gpProService'
import { useGpProAction } from '@/features/gp-pro/composables/useGpProAction'
import { GP_PRO_UNAVAILABLE, fmtDate } from '@/features/gp-pro/types/index'

/**
 * Badge GP Pro sur la fiche utilisateur : l'accorder sans demande, ou le retirer avec un
 * motif. Montée par la fiche seulement avec GP_PRO_REVIEW et un back qui expose `gpPro`.
 * Après un geste (ou un conflit), le parent relit la fiche (`changed`).
 */
const props = defineProps<{
  userId: string
  userName: string
  gpPro: boolean
  gpProGrantedAt?: string | null
  kycStatus: string
  /** Statut du compte : seul un compte ACTIVE peut recevoir le badge. */
  status: string
}>()
const emit = defineEmits<{ changed: [] }>()

const action = useGpProAction({ onStale: () => emit('changed') })
const mode = ref<'grant' | 'revoke' | null>(null)

const kycVerified = computed(() => props.kycStatus === 'VERIFIED')
const active = computed(() => props.status === 'ACTIVE')
const grantBlocked = computed(() => {
  if (!kycVerified.value) return 'Identité non vérifiée : GP Pro ne peut pas être accordé.'
  if (!active.value) return 'Compte inactif (hors service ou en cours de suppression) : GP Pro ne peut pas être accordé.'
  return null
})

function openDialog(next: 'grant' | 'revoke') {
  action.clearError()
  mode.value = next
}

async function onSubmit(text: string) {
  const ok = mode.value === 'grant'
    ? await action.run(() => gpProService.grant(props.userId, text || null))
    : await action.run(() => gpProService.revoke(props.userId, text))
  if (ok || action.unavailable.value) mode.value = null
  if (ok) emit('changed')
}

const btn = 'rounded-btn px-4 py-2 text-sm border border-border transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100'
</script>

<template>
  <section data-test="gp-pro-section" class="mt-4 space-y-2">
    <p class="text-text-muted">
      GP Pro —
      <span data-test="gp-pro-state" :class="gpPro ? 'font-medium text-success' : ''">
        {{ gpPro ? `actif depuis le ${fmtDate(gpProGrantedAt)}` : 'non attribué' }}
      </span>
    </p>
    <p v-if="action.unavailable.value" data-test="gp-pro-section-unavailable" class="text-xs text-text-muted">{{ GP_PRO_UNAVAILABLE }}</p>
    <template v-else>
      <div class="flex items-center gap-2">
        <button
          v-if="!gpPro" type="button" data-test="action-grant-gp-pro" :disabled="action.busy.value || grantBlocked !== null"
          :class="btn" @click="openDialog('grant')"
        >Accorder GP Pro</button>
        <button
          v-else type="button" data-test="action-revoke-gp-pro" :disabled="action.busy.value"
          :class="btn" @click="openDialog('revoke')"
        >Retirer GP Pro</button>
      </div>
      <p v-if="!gpPro && grantBlocked" data-test="gp-pro-grant-blocked" class="text-xs text-text-muted text-pretty">{{ grantBlocked }}</p>
      <p
        v-if="action.error.value && mode === null" data-test="gp-pro-section-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger text-pretty"
      >{{ action.error.value }}</p>
    </template>

    <GpProDecisionDialog
      :open="mode !== null" :mode="mode ?? 'grant'" :user-name="userName"
      :busy="action.busy.value" :error="action.error.value"
      @submit="onSubmit" @cancel="mode = null"
    />
  </section>
</template>
