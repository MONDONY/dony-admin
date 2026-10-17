<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GP_PRO_NOTE_MAX, GP_PRO_REASON_MAX, GP_PRO_REASON_MIN, reasonValid } from '@/features/gp-pro/types/index'

export type GpProDecisionMode = 'approve' | 'reject' | 'grant' | 'revoke'

/**
 * Confirmation d'une décision GP Pro. Refus et retrait exigent un motif, que l'utilisateur
 * lit (push, e-mail, écran GP Pro). L'attribution directe accepte une note interne facultative.
 */
const props = defineProps<{
  open: boolean
  mode: GpProDecisionMode
  userName: string
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ submit: [text: string]; cancel: [] }>()

const text = ref('')
watch(() => props.open, (o) => { if (o) text.value = '' }, { immediate: true })

const TITLES: Record<GpProDecisionMode, string> = {
  approve: 'Accepter la demande GP Pro',
  reject: 'Refuser la demande GP Pro',
  grant: 'Accorder GP Pro',
  revoke: 'Retirer GP Pro',
}
const SUBMIT: Record<GpProDecisionMode, string> = {
  approve: 'Accepter', reject: 'Refuser', grant: 'Accorder GP Pro', revoke: 'Retirer le badge',
}
const MESSAGES: Record<GpProDecisionMode, string> = {
  approve: 'Le badge GP Pro s’affichera aussitôt sur le profil et les trajets. La personne est prévenue par notification et par e-mail. Les justificatifs sont supprimés.',
  reject: 'La personne est prévenue avec ce motif et peut refaire une demande tout de suite. Les justificatifs sont supprimés.',
  grant: 'Le badge s’affichera aussitôt, sans demande de la personne, qui est prévenue par notification et par e-mail.',
  revoke: 'Le badge disparaît aussitôt. La personne est prévenue avec ce motif et peut refaire une demande.',
}

const needsReason = computed(() => props.mode === 'reject' || props.mode === 'revoke')
const hasNote = computed(() => props.mode === 'grant')
const length = computed(() => text.value.trim().length)
const max = computed(() => (hasNote.value ? GP_PRO_NOTE_MAX : GP_PRO_REASON_MAX))
const hint = computed(() => {
  if (length.value > max.value) return `Pas plus de ${max.value} caractères.`
  if (needsReason.value && length.value < GP_PRO_REASON_MIN) return `Au moins ${GP_PRO_REASON_MIN} caractères.`
  return needsReason.value ? 'Envoyé à l’utilisateur, et journalisé.' : 'Note interne, jamais envoyée à l’utilisateur.'
})
const canSubmit = computed(() => {
  if (props.busy) return false
  if (needsReason.value) return reasonValid(text.value)
  if (hasNote.value) return length.value <= GP_PRO_NOTE_MAX
  return true
})

function onSubmit() {
  if (canSubmit.value) emit('submit', text.value.trim())
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="gp-pro-dialog" role="dialog" aria-modal="true" aria-labelledby="gp-pro-dialog-title"
      class="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 id="gp-pro-dialog-title" class="font-display text-lg font-semibold mb-1 text-balance">{{ TITLES[mode] }}</h2>
      <p class="mb-1 text-sm font-medium" data-test="gp-pro-dialog-user">{{ userName }}</p>
      <p class="mb-4 text-sm text-text-muted text-pretty">{{ MESSAGES[mode] }}</p>

      <template v-if="needsReason || hasNote">
        <label class="block text-xs text-text-muted" for="gp-pro-text">
          {{ needsReason ? 'Motif communiqué à l’utilisateur (obligatoire)' : 'Note interne (facultative)' }}
        </label>
        <textarea
          id="gp-pro-text" v-model="text" data-test="gp-pro-text" rows="3"
          class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
        />
        <div class="mb-4 flex items-start justify-between gap-3 text-xs">
          <span data-test="gp-pro-hint" class="text-text-muted text-pretty">{{ hint }}</span>
          <span
            data-test="gp-pro-count" class="shrink-0 tabular-nums"
            :class="length > max ? 'text-danger' : 'text-text-muted'"
          >{{ length }} / {{ max }}</span>
        </div>
      </template>

      <p
        v-if="error" data-test="gp-pro-dialog-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="gp-pro-dialog-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated transition-colors"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="gp-pro-dialog-submit" :disabled="!canSubmit"
          class="rounded-btn px-4 py-2 text-sm text-white transition-[background-color,scale] active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          :class="needsReason ? 'bg-danger hover:bg-danger/90' : 'bg-success hover:bg-success/90'"
          @click="onSubmit"
        >{{ busy ? 'En cours…' : SUBMIT[mode] }}</button>
      </div>
    </div>
  </div>
</template>
