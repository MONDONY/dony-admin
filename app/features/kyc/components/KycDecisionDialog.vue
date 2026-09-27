<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KycDecisionCode } from '@/features/kyc/types/index'
import {
  KYC_APPROVE_REASON_MIN, KYC_DECISION_CODES, KYC_REASON_MAX, KYC_REJECT_REASON_MIN, KYC_REVOKE_REASON_MIN,
  kycDecisionCodeUserMessage, reasonLengthValid,
} from '@/features/kyc/types/index'

export type KycDecisionMode = 'approve' | 'reject' | 'revoke'
export interface KycDecisionPayload { code?: string; reason: string }

const props = defineProps<{
  open: boolean
  mode: KycDecisionMode
  /** Nom à ressaisir pour confirmer une révocation. */
  userName: string
  providerSessionUrl?: string | null
  /** Catalogue proposé (servi par le back, ou liste locale en repli). */
  codes?: readonly KycDecisionCode[]
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ submit: [payload: KycDecisionPayload]; cancel: [] }>()

const reason = ref('')
const code = ref('')
const checked = ref(false)
const confirmName = ref('')
watch(() => props.open, (o) => {
  if (o) { reason.value = ''; code.value = ''; checked.value = false; confirmName.value = '' }
}, { immediate: true })

const codeOptions = computed(() => props.codes?.length ? props.codes : KYC_DECISION_CODES)
// Catalogue réaligné (400 `kyc-reject-code-invalid`) : un code choisi qui n'y figure plus est vidé.
watch(codeOptions, (opts) => {
  if (code.value && !opts.some((c) => c.value === code.value)) code.value = ''
})

const TITLES: Record<KycDecisionMode, string> = {
  approve: 'Valider l’identité',
  reject: 'Refuser la vérification',
  revoke: 'Révoquer l’identité validée',
}
const SUBMIT_LABELS: Record<KycDecisionMode, string> = {
  approve: 'Valider l’identité',
  reject: 'Refuser',
  revoke: 'Révoquer l’identité',
}

const minLength = computed(() => ({
  approve: KYC_APPROVE_REASON_MIN, reject: KYC_REJECT_REASON_MIN, revoke: KYC_REVOKE_REASON_MIN,
}[props.mode]))
const needsCode = computed(() => props.mode !== 'approve')
const reasonLength = computed(() => reason.value.trim().length)
const reasonValid = computed(() => reasonLengthValid(reason.value, minLength.value))
const reasonHint = computed(() => {
  if (reasonLength.value > KYC_REASON_MAX) return `Le motif ne peut pas dépasser ${KYC_REASON_MAX} caractères.`
  if (!reasonValid.value) return `Au moins ${minLength.value} caractères : il est journalisé avec votre identifiant.`
  return 'Journalisé avec votre identifiant.'
})
const reasonLabel = computed(() => props.mode === 'approve' ? 'Motif (obligatoire)' : 'Motif interne (obligatoire)')
const reasonPlaceholder = computed(() => ({
  approve: 'Ce que vous avez contrôlé chez le fournisseur',
  reject: 'Ce qui ne va pas dans le dossier, pour l’équipe',
  revoke: 'Pourquoi cette identité ne peut plus être considérée comme vérifiée',
}[props.mode]))
const userMessage = computed(() => {
  if (!code.value) return null
  return codeOptions.value.find((c) => c.value === code.value)?.userMessage ?? kycDecisionCodeUserMessage(code.value)
})
// Comparaison après trim, sensible à la casse : même règle que la double confirmation RGPD.
const nameMatches = computed(() => confirmName.value.trim() === props.userName.trim())

const canSubmit = computed(() => {
  if (props.busy || !reasonValid.value) return false
  if (needsCode.value && !code.value) return false
  if (props.mode === 'approve' && !checked.value) return false
  if (props.mode === 'revoke' && !nameMatches.value) return false
  return true
})

function onSubmit() {
  if (!canSubmit.value) return
  const payload: KycDecisionPayload = needsCode.value
    ? { code: code.value, reason: reason.value.trim() }
    : { reason: reason.value.trim() }
  emit('submit', payload)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="kyc-dialog" role="dialog" aria-modal="true" aria-labelledby="kyc-dialog-title"
      class="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 id="kyc-dialog-title" class="font-display text-lg font-semibold mb-3 text-balance">{{ TITLES[mode] }}</h2>

      <div
        v-if="mode === 'approve'" data-test="kyc-approve-reminder"
        class="mb-4 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text text-pretty"
      >
        Ne validez qu’après avoir contrôlé vous-même les pièces et le selfie chez le fournisseur.
        La validation débloque les publications, les paiements et les versements de cet utilisateur.
        <a
          v-if="providerSessionUrl" :href="providerSessionUrl" target="_blank" rel="noopener noreferrer"
          data-test="kyc-dialog-provider-link" class="mt-1 block font-medium text-primary underline-offset-2 hover:underline"
        >Ouvrir la session chez le fournisseur</a>
      </div>

      <div
        v-if="mode === 'revoke'" data-test="kyc-revoke-warning" role="alert"
        class="mb-4 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >
        <p class="font-semibold">Geste lourd, à réserver à une fraude ou une erreur avérée.</p>
        <p class="mt-1">
          Les nouvelles publications, les paiements et les versements de cet utilisateur seront bloqués
          tant qu’il n’aura pas refait une vérification validée. Les envois en cours ne sont pas annulés :
          suivez-les à part.
        </p>
      </div>

      <p v-if="mode === 'reject'" class="mb-4 text-sm text-text-muted text-pretty">
        Seul le libellé du code choisi est montré à l’utilisateur. Le motif interne n’est pas envoyé à l’utilisateur :
        il reste dans le journal d’audit.
      </p>

      <label v-if="mode === 'approve'" class="mb-4 flex items-start gap-2 text-sm cursor-pointer select-none">
        <input v-model="checked" data-test="kyc-checked" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0">
        <span class="text-pretty">J’ai contrôlé les pièces d’identité et le selfie chez le fournisseur.</span>
      </label>

      <div v-if="needsCode" class="mb-4">
        <label class="mb-1 block text-xs text-text-muted" for="kyc-code">
          {{ mode === 'reject' ? 'Code de refus' : 'Code de révocation' }} (montré à l’utilisateur)
        </label>
        <select
          id="kyc-code" v-model="code" data-test="kyc-code"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
        >
          <option value="" disabled>Choisir un code…</option>
          <option v-for="c in codeOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <p
          v-if="userMessage" data-test="kyc-code-user-message"
          class="mt-2 rounded-btn bg-surface-elevated px-3 py-2 text-xs text-text-muted text-pretty"
        >L’utilisateur lira : « {{ userMessage }} »</p>
      </div>

      <label class="block text-xs text-text-muted" for="kyc-reason">{{ reasonLabel }}</label>
      <textarea
        id="kyc-reason" v-model="reason" data-test="kyc-reason" rows="3" :placeholder="reasonPlaceholder"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
      />
      <div class="mb-4 flex items-start justify-between gap-3 text-xs">
        <span data-test="kyc-reason-hint" class="text-text-muted text-pretty">{{ reasonHint }}</span>
        <span
          data-test="kyc-reason-count" class="shrink-0 tabular-nums"
          :class="reasonLength > KYC_REASON_MAX ? 'text-danger' : 'text-text-muted'"
        >{{ reasonLength }} / {{ KYC_REASON_MAX }}</span>
      </div>

      <div v-if="mode === 'revoke'" class="mb-4">
        <label class="mb-1 block text-xs text-text-muted" for="kyc-confirm-name">
          Saisissez « {{ userName }} » pour confirmer
        </label>
        <input
          id="kyc-confirm-name" v-model="confirmName" data-test="kyc-confirm-name" type="text" autocomplete="off"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
        >
      </div>

      <p
        v-if="error" data-test="kyc-dialog-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="kyc-dialog-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated transition-colors"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="kyc-dialog-submit" :disabled="!canSubmit"
          class="rounded-btn px-4 py-2 text-sm text-white transition-[background-color,scale] active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          :class="mode === 'approve' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'"
          @click="onSubmit"
        >{{ busy ? 'En cours…' : SUBMIT_LABELS[mode] }}</button>
      </div>
    </div>
  </div>
</template>
