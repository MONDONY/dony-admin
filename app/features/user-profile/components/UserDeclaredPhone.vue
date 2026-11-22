<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { usersService } from '@/features/users/services/usersService'
import { useAuthStore } from '@/stores/auth'
import type { AdminUserDetail } from '@/features/users/types/index'

const props = defineProps<{ user: AdminUserDetail }>()
/** La fiche appartient à la page : elle reçoit le détail renvoyé par le serveur. */
const emit = defineEmits<{ updated: [detail: AdminUserDetail] }>()

const auth = useAuthStore()

// Niveau local : la pastille change dès la réponse, même avant que la page ait remplacé la fiche.
const level = ref(props.user.declaredPhoneLevel ?? null)
watch(() => props.user.declaredPhoneLevel, (l) => { level.value = l ?? null })

const phone = computed(() => props.user.declaredPhone?.trim() || null)
const canVerify = computed(() => level.value === 'DECLARED' && auth.can('USER_PHONE_VERIFY'))
const badge = computed(() => level.value === 'YADONY_VERIFIED'
  ? { label: 'Vérifié par Yadony', tone: 'success' as const }
  : { label: 'Non vérifié', tone: 'neutral' as const })

const confirming = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

const MESSAGES: Record<string, string> = {
  'declared-phone-changed': 'Le numéro a changé depuis l’ouverture de la fiche. Rechargez la page.',
  'declared-phone-conflict': 'Ce numéro appartient déjà à un autre compte. Il ne peut pas être validé.',
  'declared-phone-missing': 'Aucun numéro déclaré à valider.',
  'declared-phone-held-by-unregistered-account': 'Ce numéro est déjà associé à un compte non finalisé. Il ne peut pas être validé pour l’instant. Contactez l’équipe technique.',
  'declared-phone-unavailable': 'Service indisponible pour le moment. Réessayez dans quelques minutes.',
  'phone-already-set': 'Ce compte a déjà un numéro vérifié par SMS.',
}
const FALLBACK = 'Impossible de valider ce numéro.'
const errorMessage = (e: unknown) => MESSAGES[(e as { data?: { code?: string } } | undefined)?.data?.code ?? ''] ?? FALLBACK

function open() { error.value = null; confirming.value = true }

async function onConfirm() {
  const shown = phone.value
  confirming.value = false
  if (!shown || busy.value) return
  busy.value = true
  error.value = null
  try {
    // Le corps est le numéro affiché à l'admin, pas celui que la fiche aurait depuis.
    const detail = await usersService.verifyDeclaredPhone(props.user.id, shown)
    level.value = detail.declaredPhoneLevel ?? 'YADONY_VERIFIED'
    emit('updated', detail)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section
    v-if="phone && level" data-test="declared-phone-block"
    class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-border bg-surface px-4 py-3 text-sm"
  >
    <span class="text-text-muted">Numéro déclaré (sans SMS)</span>
    <span data-test="declared-phone" class="font-semibold tabular-nums">{{ phone }}</span>
    <StatusBadge data-test="declared-phone-badge" v-bind="badge" />
    <button
      v-if="canVerify" type="button" data-test="declared-phone-verify" :disabled="busy"
      class="rounded-btn border border-border px-3 py-1 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
      @click="open"
    >Valider ce numéro</button>
    <p v-if="error" data-test="declared-phone-error" role="alert" class="basis-full text-sm text-danger text-pretty">{{ error }}</p>
    <ConfirmActionDialog
      :open="confirming" title="Valider ce numéro ?" confirm-label="Valider" confirm-tone="primary"
      :message="`Appelez ${phone} avant de valider : le badge « Vérifié par Yadony » atteste que vous avez vérifié à la main que la personne possède ce numéro. Ce n’est pas une preuve par SMS, et le numéro ne sert jamais à se connecter ni à payer.`"
      @confirm="onConfirm" @cancel="confirming = false"
    />
  </section>
</template>
