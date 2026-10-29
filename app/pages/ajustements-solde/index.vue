<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useAdjustmentApprovals } from '@/features/wallet/composables/useAdjustmentApprovals'
import { formatMajorAmount } from '@/features/finance/types/index'
import type { AdminWalletAdjustmentRequest } from '@/features/wallet/types/index'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  middleware: 'admin-only', permission: 'WALLET_ADJUST',
  pageTitle: 'Corrections à approuver', pageSubtitle: 'Corrections de solde au-delà de 100 €, à valider par un second admin',
})

const auth = useAuthStore()
const approvals = useAdjustmentApprovals()
const pendingReject = ref<AdminWalletAdjustmentRequest | null>(null)
const pendingApprove = ref<AdminWalletAdjustmentRequest | null>(null)

/** Le back refuse aussi (403) : le bouton l'annonce avant le clic. */
const isOwn = (r: AdminWalletAdjustmentRequest) => r.requestedBy === auth.user?.id
/** L'auteur peut retirer sa propre demande : même appel que le rejet, libellés adaptés. */
const rejectingOwn = computed(() => pendingReject.value !== null && isOwn(pendingReject.value))

async function confirmApprove() {
  const target = pendingApprove.value
  pendingApprove.value = null
  if (target) await approvals.approve(target.id)
}
async function confirmReject(note: string) {
  const target = pendingReject.value
  pendingReject.value = null
  if (target) await approvals.reject(target.id, note)
}

function fmtDate(d: string) { return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }
function amountLabel(r: AdminWalletAdjustmentRequest) {
  return `${r.direction === 'CREDIT' ? '+' : '−'}${formatMajorAmount(r.amount, r.currency)}`
}

onMounted(() => approvals.load(0))
</script>

<template>
  <div>
    <p
      v-if="approvals.error.value" data-test="approvals-error" role="alert"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ approvals.error.value }}</p>
    <p
      v-if="approvals.success.value" data-test="approvals-success" role="status"
      class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
    >{{ approvals.success.value }}</p>

    <p v-if="approvals.isLoading.value" class="text-sm text-text-muted">Chargement…</p>
    <p
      v-else-if="approvals.requests.value.length === 0" data-test="approvals-empty"
      class="text-sm text-text-muted"
    >Aucune correction en attente.</p>

    <div v-else class="overflow-x-auto rounded-card border border-border">
      <table class="w-full text-sm">
        <thead class="bg-surface-elevated text-left text-xs text-text-muted">
          <tr>
            <th class="px-4 py-2">Demandée le</th>
            <th class="px-4 py-2">Utilisateur</th>
            <th class="px-4 py-2 text-right">Montant</th>
            <th class="px-4 py-2 text-right">Équivalent</th>
            <th class="px-4 py-2">Motif</th>
            <th class="px-4 py-2">Par</th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in approvals.requests.value" :key="r.id" :data-test="`approval-row-${r.id}`"
            class="border-t border-border align-top"
          >
            <td class="px-4 py-3 whitespace-nowrap tabular-nums">{{ fmtDate(r.createdAt) }}</td>
            <td class="px-4 py-3">
              <NuxtLink :to="`/users/${r.userId}`" class="text-primary hover:underline">Fiche</NuxtLink>
            </td>
            <td
              class="px-4 py-3 text-right tabular-nums font-medium"
              :class="r.direction === 'CREDIT' ? 'text-success' : 'text-danger'"
              :data-test="`approval-amount-${r.id}`"
            >{{ amountLabel(r) }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-text-muted">{{ formatMajorAmount(r.eurEquivalent, 'EUR') }}</td>
            <td class="px-4 py-3 max-w-xs text-pretty">{{ r.reason }}</td>
            <td class="px-4 py-3 text-text-muted">{{ r.requestedByEmail ?? 'Admin inconnu' }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  type="button" :data-test="`approval-approve-${r.id}`"
                  :disabled="isOwn(r) || approvals.busyId.value === r.id"
                  :title="isOwn(r) ? 'Vous ne pouvez pas approuver votre propre correction' : undefined"
                  class="rounded-btn px-3 py-1.5 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
                  @click="pendingApprove = r"
                >Approuver</button>
                <button
                  type="button" :data-test="`approval-reject-${r.id}`"
                  :disabled="approvals.busyId.value === r.id"
                  class="rounded-btn px-3 py-1.5 text-sm border border-border hover:bg-surface-elevated disabled:opacity-40"
                  @click="pendingReject = r"
                >{{ isOwn(r) ? 'Retirer' : 'Rejeter' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationControls
      v-if="approvals.totalPages.value > 1" class="mt-4"
      :page="approvals.currentPage.value" :total-pages="approvals.totalPages.value"
      @change="approvals.load"
    />

    <ConfirmActionDialog
      :open="pendingApprove !== null" title="Approuver la correction"
      :message="pendingApprove ? `${amountLabel(pendingApprove)} sera écrit sur le solde de l'utilisateur, au nom de ${pendingApprove.requestedByEmail ?? 'son auteur'}.` : ''"
      confirm-label="Approuver" confirm-tone="primary"
      @confirm="confirmApprove" @cancel="pendingApprove = null"
    />
    <ConfirmActionDialog
      :open="pendingReject !== null"
      :title="rejectingOwn ? 'Retirer votre correction' : 'Rejeter la correction'"
      :message="rejectingOwn
        ? 'Rien ne sera écrit sur le solde. Indiquez pourquoi vous la retirez.'
        : 'Rien ne sera écrit sur le solde. Indiquez pourquoi à l\'auteur de la demande.'"
      :confirm-label="rejectingOwn ? 'Retirer' : 'Rejeter'" require-reason
      @confirm="confirmReject" @cancel="pendingReject = null"
    />
  </div>
</template>
