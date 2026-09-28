<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoShowDecisionDialog from './NoShowDecisionDialog.vue'
import type { AdminNoShow, NoShowDecideFn, NoShowDecision, NoShowParty } from '@/features/incidents/types/index'
import {
  amountLabel, bidStatusLabel, disputeHref, disputeLinkLabel, formatDateTime, noShowSentence, noShowStatusMeta, noShowTitle,
  partyLabel, partyRoleLabel, paymentStatusLabel, remainingMeta, scopeMeta, shortId, tripLabel,
} from './noShowLabels'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  row: AdminNoShow
  /** Enregistre la décision ; le résultat dit quoi afficher (succès ou erreur dans le dialogue). */
  decide: NoShowDecideFn
  now?: number
}>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const canResolve = computed(() => auth.can('DISPUTE_RESOLVE'))
const pending = ref<NoShowDecision | null>(null)
const busy = ref(false)
const actionError = ref<string | null>(null)
const success = ref<string | null>(null)
const panel = ref<HTMLElement | null>(null)

watch(() => props.row.id, () => { success.value = null; pending.value = null; actionError.value = null })
onMounted(async () => { await nextTick(); panel.value?.focus() })

const remaining = computed(() => remainingMeta(props.row, props.now ?? Date.now()))
const facts = computed(() => {
  const r = props.row
  const deadline = formatDateTime(r.contestationDeadline)
  const answer = remaining.value ? `${remaining.value.label}${deadline ? ` (jusqu’au ${deadline})` : ''}` : deadline
  return [
    { key: 'created', label: 'Déclarée le', value: formatDateTime(r.createdAt) },
    { key: 'answer', label: 'Réponse attendue', value: answer, urgent: remaining.value?.urgent ?? false },
    { key: 'trip', label: 'Trajet', value: tripLabel(r.trip) },
    { key: 'handover', label: 'Remise prévue', value: formatDateTime(r.handoverAt) },
    { key: 'amount', label: 'Montant et paiement', value: amountLabel(r) },
    { key: 'payment', label: 'État du paiement', value: paymentStatusLabel(r.paymentStatus) },
    { key: 'bid', label: 'Statut du colis', value: bidStatusLabel(r.bidStatus) },
  ].filter((f) => !!f.value)
})
const parties = computed(() => ([
  { key: 'declarant', title: 'Déclare l’absence', party: props.row.declarant },
  { key: 'accused', title: 'Déclaré absent', party: props.row.accused },
] as { key: string; title: string; party: NoShowParty | null }[]).filter((p) => p.party))

function open(decision: NoShowDecision) { actionError.value = null; pending.value = decision }
function cancel() { if (!busy.value) { pending.value = null; actionError.value = null } }
async function submit(reason: string) {
  if (!pending.value) return
  busy.value = true; actionError.value = null
  try {
    const res = await props.decide(pending.value, reason)
    if (res.ok) { pending.value = null; success.value = res.message }
    else actionError.value = res.message
  } finally { busy.value = false }
}
function onEscape() { if (!pending.value) emit('close') }
</script>

<template>
  <div data-test="noshow-backdrop" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside
      ref="panel" data-test="noshow-panel" tabindex="-1" aria-labelledby="noshow-panel-title" role="dialog"
      class="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-border bg-surface p-6 focus:outline-none"
      @keydown.esc="onEscape"
    >
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge v-if="row.scope" v-bind="scopeMeta(row.scope)" />
        <StatusBadge v-bind="noShowStatusMeta(row.status)" />
      </div>
      <h2 id="noshow-panel-title" class="font-display text-xl font-bold text-balance">{{ noShowTitle(row) }}</h2>
      <p v-if="row.legacy" class="mt-1 text-sm text-text-muted text-pretty">{{ noShowSentence(row) }}</p>
      <p
        v-if="row.legacy" data-test="noshow-legacy-note"
        class="mt-3 rounded-xs bg-surface-elevated px-3 py-2 text-xs text-text-muted text-pretty"
      >Serveur pas encore à jour : informations réduites, seule l’absence de l’expéditeur au départ peut être confirmée.</p>

      <p
        v-if="success" data-test="noshow-success" role="status"
        class="mt-4 rounded-xs border border-success/40 bg-success/10 px-3 py-2 text-sm text-success text-pretty"
      >{{ success }}</p>

      <dl class="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div v-for="f in facts" :key="f.key" :data-test="`noshow-fact-${f.key}`">
          <dt class="text-xs text-text-muted">{{ f.label }}</dt>
          <dd :class="['tabular-nums', f.urgent ? 'font-medium text-danger' : '']">{{ f.value }}</dd>
        </div>
      </dl>

      <section v-if="parties.length" class="mt-6">
        <h3 class="mb-2 text-xs font-medium uppercase text-text-muted">Parties</h3>
        <ul class="space-y-2">
          <li v-for="p in parties" :key="p.key" class="flex items-center justify-between gap-3 rounded-xs bg-surface-elevated px-3 py-2 text-sm">
            <div class="min-w-0">
              <p class="text-xs text-text-muted">{{ p.title }} · {{ partyRoleLabel(p.party!.role) }}</p>
              <p class="truncate font-medium">{{ partyLabel(p.party!) }}</p>
            </div>
            <NuxtLink
              v-if="p.party!.userId" :to="`/users?open=${p.party!.userId}`" :data-test="`noshow-${p.key}-link`"
              class="shrink-0 text-sm text-primary hover:underline"
            >Voir la fiche</NuxtLink>
          </li>
        </ul>
      </section>

      <section class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <NuxtLink :to="`/colis?open=${row.bidId}`" data-test="noshow-bid-link" class="text-primary hover:underline">Ouvrir le colis {{ shortId(row.bidId) }}</NuxtLink>
        <NuxtLink
          v-if="row.dispute" :to="disputeHref(row.dispute)" data-test="noshow-dispute-link"
          class="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/25"
        >{{ disputeLinkLabel(row.dispute) }} : l’ouvrir</NuxtLink>
      </section>

      <div class="mt-auto flex flex-wrap gap-2 pt-8">
        <template v-if="canResolve">
          <button
            v-if="row.canConfirm" type="button" data-test="noshow-confirm"
            class="rounded-btn bg-danger px-4 py-2 text-sm text-white transition-[background-color,transform] hover:bg-danger/90 active:scale-[0.96]"
            @click="open('confirm')"
          >Confirmer l’absence</button>
          <button
            v-if="row.canReject" type="button" data-test="noshow-reject"
            class="rounded-btn bg-primary/15 px-4 py-2 text-sm text-primary transition-[background-color,transform] hover:bg-primary/25 active:scale-[0.96]"
            @click="open('reject')"
          >Rejeter la déclaration</button>
        </template>
        <button
          type="button" data-test="noshow-close"
          class="ml-auto rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.96]"
          @click="emit('close')"
        >Fermer</button>
      </div>

      <NoShowDecisionDialog
        v-if="pending" :open="true" :decision="pending" :row="row" :busy="busy" :error="actionError"
        @submit="submit" @cancel="cancel"
      />
    </aside>
  </div>
</template>
