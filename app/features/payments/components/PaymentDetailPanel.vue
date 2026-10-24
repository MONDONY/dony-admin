<script setup lang="ts">
import { useEscapeClose } from '@/composables/useEscapeClose'
import { computed, nextTick, ref, watch } from 'vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import PayoutOverrideDialog from './PayoutOverrideDialog.vue'
import PaymentDrawerHeader from './PaymentDrawerHeader.vue'
import PaymentAlertBanner from './PaymentAlertBanner.vue'
import PaymentActionsMenu from './PaymentActionsMenu.vue'
import PaymentSummaryTab from './PaymentSummaryTab.vue'
import PaymentMoneyTab from './PaymentMoneyTab.vue'
import PaymentTimelineTab from './PaymentTimelineTab.vue'
import PaymentIncidentsTab from './PaymentIncidentsTab.vue'
import PaymentReferencesTab from './PaymentReferencesTab.vue'
import { paymentActions, type PaymentActionId } from '@/features/payments/lib/paymentActions'
import { isPaymentHeld } from '@/features/payments/types/index'
import type { AdminPaymentDetail, PayoutAction, PayoutOverride } from '@/features/payments/types/index'
import type { PayoutOverrideRequest } from '@/features/payments/composables/usePaymentDetail'
import { useAuthStore } from '@/stores/auth'

export type PaymentDrawerTab = 'summary' | 'money' | 'timeline' | 'incidents' | 'references'

/**
 * Tiroir paiement : coquille (en-tête, bandeau « ce qui bloque », menu « Actions », cinq onglets)
 * et dialogues des gestes. Les gestes, leurs gardes et la logique de dérogation (409 de blocage,
 * refus du motif) sont ceux de l'ancien panneau ; il émet les mêmes événements.
 */
const props = defineProps<{
  payment: AdminPaymentDetail; open: boolean; error?: string | null; busy?: boolean
  /** 409 de blocage reçu du back : le geste concerné repasse par la dérogation. */
  overrideRequest?: PayoutOverrideRequest | null
  /** Refus du motif de dérogation (422) : le dialogue reste ouvert pour corriger. */
  overrideError?: string | null
  /** Onglet affiché (`?section=`) ; absent ou inconnu : Résumé. */
  section?: string | null
}>()
// Les deux gestes qui paient le voyageur émettent la dérogation quand il y en a une, rien sinon.
const emit = defineEmits<{
  close: []; 'force-release': [override?: PayoutOverride]; refund: []; 'retry-payout': [override?: PayoutOverride]; 'retry-refund': []
  'override-dismiss': []
  /** Resynchronisation Stripe effectuée : la fiche est à recharger. */
  resynced: []
  /** Onglet choisi par l'admin (l'URL suit). */
  'update:section': [section: PaymentDrawerTab]
}>()
/** Le tiroir est lui-même un dialogue modal : sa racine permet à Échap de le fermer. */
const drawer = ref<HTMLElement | null>(null)
useEscapeClose(() => emit('close'), () => props.open, () => drawer.value)

type PendingAction = 'release' | 'refund' | 'retry-payout' | 'retry-refund'

const auth = useAuthStore()
const pending = ref<PendingAction | null>(null)

// ---- Onglets ----
const TABS: TabItem<PaymentDrawerTab>[] = [
  { id: 'summary', label: 'Résumé' },
  { id: 'money', label: 'Argent' },
  { id: 'timeline', label: 'Chronologie' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'references', label: 'Références' },
]
const requested = ref<string>(props.section ?? 'summary')
watch(() => props.section, (s) => { requested.value = s ?? 'summary' })
const active = computed<PaymentDrawerTab>(() => TABS.find(t => t.id === requested.value)?.id ?? 'summary')
// Onglet demandé inconnu : l'onglet affiché est renvoyé, l'URL suit.
watch([requested, active], ([wanted, shown]) => {
  if (wanted === shown) return
  requested.value = shown
  emit('update:section', shown)
}, { immediate: true })
function selectTab(id: PaymentDrawerTab) {
  requested.value = id
  emit('update:section', id)
}

// ---- Gestes ----
/** Paiement retenu : le déblocage et la relance passent d'emblée par la dérogation. */
const held = computed(() => isPaymentHeld(props.payment))
const actions = computed(() => paymentActions(props.payment, p => auth.can(p), held.value))

const DIALOGS: Record<PendingAction, { title: string; message: string; confirmLabel: string; requireReason: boolean }> = {
  release: { title: 'Débloquer le paiement', message: 'Le paiement sera libéré au voyageur.', confirmLabel: 'Débloquer', requireReason: true },
  refund: { title: 'Rembourser l\'expéditeur', message: 'Le paiement sera remboursé.', confirmLabel: 'Rembourser', requireReason: true },
  'retry-payout': {
    title: 'Relancer le versement',
    message: 'Un nouveau versement mobile money du même montant sera envoyé au voyageur. Le serveur le refuse si la dernière tentative n\'a pas échoué.',
    confirmLabel: 'Relancer le versement',
    requireReason: false,
  },
  'retry-refund': {
    title: 'Relancer le remboursement',
    message: 'Un nouveau remboursement mobile money du dépôt d\'origine sera envoyé à l\'expéditeur. Le serveur le refuse si la dernière tentative n\'a pas échoué.',
    confirmLabel: 'Relancer le remboursement',
    requireReason: false,
  },
}
const dialog = computed(() => DIALOGS[pending.value ?? 'release'])

/**
 * Sans retenue : le dialogue habituel, sans case ni corps ; la dérogation n'apparaît qu'après un
 * 409 de blocage (`overrideRequest`), jamais d'avance face à un ancien back.
 */
const overridePending = ref<PayoutAction | null>(null)
watch(() => props.overrideRequest, (r) => { overridePending.value = r?.action ?? null }, { immediate: true })

/** Geste choisi dans le menu ou le bandeau ; un geste impossible n'arrive jamais jusqu'ici. */
function onAct(id: PaymentActionId) {
  const a = actions.value.find(x => x.id === id)
  if (!a?.enabled || props.busy) return
  if ((id === 'release' || id === 'retry-payout') && a.override) overridePending.value = id
  else pending.value = id
}
// Le dialogue reste ouvert pendant l'appel : il ne se ferme qu'une fois la réponse reçue, et
// reste ouvert (saisie conservée) si le serveur refuse le motif. Toute autre issue le ferme :
// succès, ou erreur affichée dans le bandeau du panneau.
const overrideSubmitted = ref(false)
function confirmOverride(override: PayoutOverride) {
  overrideSubmitted.value = true
  if (overridePending.value === 'release') emit('force-release', override)
  else emit('retry-payout', override)
}
watch(() => props.busy, (now, before) => {
  if (!before || now || !overrideSubmitted.value) return
  overrideSubmitted.value = false
  if (!props.overrideError) overridePending.value = null
})
function cancelOverride() {
  overrideSubmitted.value = false
  overridePending.value = null
  emit('override-dismiss')
}

/**
 * Blocages montrés dans la dérogation : ceux du 409 s'il les énumère, sinon déduits de son
 * code, sinon lus sur le paiement (gel du voyageur, plus litige bancaire s'il y en a un).
 */
const overrideBlockers = computed<string[]>(() => {
  const r = props.overrideRequest
  if (r?.blockers.length) return r.blockers
  if (r?.code === 'payment-disputed') return ['DISPUTED']
  if (r?.code === 'payout-beneficiary-held') return ['BENEFICIARY_HELD']
  return props.payment.disputed ? ['BENEFICIARY_HELD', 'DISPUTED'] : ['BENEFICIARY_HELD']
})
const overrideHoldReasons = computed<string[]>(() => {
  if (props.overrideRequest?.holdReasons.length) return props.overrideRequest.holdReasons
  return props.payment.beneficiaryHoldReason ? [props.payment.beneficiaryHoldReason] : []
})

function confirm() {
  // Sans argument : la forme émise par le dialogue habituel reste celle d'avant.
  if (pending.value === 'release') emit('force-release')
  else if (pending.value === 'refund') emit('refund')
  else if (pending.value === 'retry-payout') emit('retry-payout')
  else if (pending.value === 'retry-refund') emit('retry-refund')
  pending.value = null
}

/** Modale fermée (confirmation, dérogation) : le focus revient sur « Actions », jamais sur <body>. */
const actionsMenu = ref<{ focus: () => void } | null>(null)
function refocusActions() { void nextTick(() => actionsMenu.value?.focus()) }
watch([pending, overridePending], ([p, o], [pb, ob]) => { if ((pb || ob) && !p && !o) refocusActions() })

// ---- Copie ----
const copied = ref<string | null>(null)
watch(() => props.payment.id, () => { copied.value = null; pending.value = null })
async function copy(key: string, value: string) {
  try { await navigator.clipboard.writeText(value); copied.value = key } catch { copied.value = null }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside
      ref="drawer"
      class="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-surface"
      role="dialog" aria-modal="true" aria-labelledby="payment-detail-title" data-test="payment-detail"
    >
      <PaymentDrawerHeader :payment="payment" :copied="copied" @copy="copy" @close="emit('close')">
        <template #actions>
          <PaymentActionsMenu ref="actionsMenu" :actions="actions" :busy="busy" @act="onAct" />
        </template>
      </PaymentDrawerHeader>

      <div class="flex flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        <!-- Résultat d'un geste : au-dessus des onglets, visible quel que soit l'onglet. -->
        <p v-if="error" data-test="payment-error" role="alert" class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>
        <PaymentAlertBanner :payment="payment" :actions="actions" @act="onAct" />

        <div>
          <TabBar
            variant="underline" test-prefix="payment-tab" id-prefix="payment-tab" aria-label="Sections de la fiche paiement"
            :tabs="TABS" :model-value="active" @update:model-value="selectTab"
          />
          <div :id="`payment-panel-${active}`" role="region" :aria-labelledby="`payment-tab-${active}`" class="pt-5" :data-test="`payment-panel-${active}`">
            <PaymentSummaryTab v-if="active === 'summary'" :payment="payment" />
            <PaymentMoneyTab v-else-if="active === 'money'" :payment="payment" @resynced="emit('resynced')" />
            <PaymentTimelineTab v-else-if="active === 'timeline'" :payment="payment" />
            <PaymentIncidentsTab v-else-if="active === 'incidents'" :payment="payment" />
            <PaymentReferencesTab v-else :payment="payment" :copied="copied" @copy="copy" />
          </div>
        </div>

        <div class="mt-auto pt-2">
          <button
            type="button" data-test="payment-close"
            class="inline-flex min-h-10 items-center rounded-btn border border-border px-4 text-sm transition-[background-color,transform] hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
            @click="emit('close')"
          >Fermer</button>
        </div>
      </div>

      <ConfirmActionDialog
        :open="pending !== null"
        :title="dialog.title"
        :message="dialog.message"
        :confirm-label="dialog.confirmLabel"
        :require-reason="dialog.requireReason"
        @confirm="confirm"
        @cancel="pending = null"
      />
      <PayoutOverrideDialog
        :open="overridePending !== null"
        :action="overridePending ?? 'release'"
        :blockers="overrideBlockers"
        :hold-reasons="overrideHoldReasons"
        :error="overrideError ?? null"
        :busy="busy"
        @confirm="confirmOverride"
        @cancel="cancelOverride"
      />
    </aside>
  </div>
</template>
