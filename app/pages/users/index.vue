<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, watch } from 'vue'
import UserFilters from '@/features/users/components/UserFilters.vue'
import UserTable from '@/features/users/components/UserTable.vue'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import UserDeletionDialog from '@/features/users/components/UserDeletionDialog.vue'
import UserRecetteBulkBar from '@/features/users/components/UserRecetteBulkBar.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useUsers } from '@/features/users/composables/useUsers'
import { useUserDetail } from '@/features/users/composables/useUserDetail'
import { useUserKyc } from '@/features/users/composables/useUserKyc'
import { useUserDeletion } from '@/features/users/composables/useUserDeletion'
import { useRecetteBulk } from '@/features/users/composables/useRecetteBulk'
import type { AdminDeletionReasonCode, AdminKycDetail, UserStatusFilter } from '@/features/users/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'USER_VIEW', pageTitle: 'Utilisateurs', pageSubtitle: 'Recherche & modération des comptes' })

const route = useRoute()
const {
  users, isLoading, totalPages, totalElements, currentPage, filters,
  fetchUsers, goToPage, setStatusFilter, setSearch, setRecetteFilter,
} = useUsers()
const detail = useUserDetail()
const kyc = useUserKyc()
const deletion = useUserDeletion()
const deletionOpen = ref(false)

// Mode recette en masse (yadony-back#465) : super-admin en staging seulement, sinon rien.
const recette = useRecetteBulk()
const recetteAvailable = recette.available
// Un filtre change l'ensemble visé : la sélection repart de zéro plutôt que de viser des
// comptes que l'admin ne voit plus.
async function onStatusFilter(s: UserStatusFilter) { recette.clear(); await setStatusFilter(s) }
async function onSearch(q: string) { recette.clear(); await setSearch(q) }
async function onRecetteFilter(v: boolean) { recette.clear(); await setRecetteFilter(v ? true : null) }
async function applyRecette(enabled: boolean) { if (await recette.apply(enabled)) await fetchUsers() }
// Mode constaté fermé (409) : le filtre caché ne doit pas rester appliqué.
watch(recetteAvailable, (ok) => { if (!ok && filters.recetteTester) void setRecetteFilter(null) })
onBeforeUnmount(recette.dispose)

async function openUser(id: string) { await detail.open(id) }
async function afterAction() { await fetchUsers() }

/** Décision KYC : la fiche KYC est remplacée, puis la fiche et la liste relues (statut KYC). */
async function onKycDecided(updated: AdminKycDetail) {
  kyc.set(updated)
  if (detail.user.value) await detail.open(detail.user.value.id)
  await afterAction()
}

async function openDeletion() {
  if (!detail.user.value) return
  deletionOpen.value = true
  await deletion.loadImpact(detail.user.value.id)
}

function closeDeletion() {
  deletionOpen.value = false
  deletion.reset()
}

async function confirmDeletion(reasonCode: AdminDeletionReasonCode, reason: string) {
  if (!detail.user.value) return
  const id = detail.user.value.id
  const ok = await deletion.remove(id, reasonCode, reason)
  // On ne ferme qu'en cas de succès : sur un refus, l'erreur doit rester lisible
  // à l'écran plutôt que de disparaître avec le dialogue.
  if (!ok) return
  closeDeletion()
  detail.close()
  await fetchUsers()
}

onMounted(async () => {
  void recette.load()
  // Initialise le filtre de recherche depuis le paramètre d'URL ?query=<uuid>
  // afin que les liens de contreparties dans UserDeletionDialog ouvrent la liste filtrée.
  // L'accès optionnel (?.) protège contre un contexte de montage sans objet query
  // (tests unitaires, SSR partiel, navigation directe sans paramètres).
  const q = route.query?.query
  if (q && typeof q === 'string') {
    await setSearch(q)
  } else {
    await fetchUsers()
  }
  // ?open=<uuid> (lien depuis l'onglet Portefeuilles des transactions) : ouvre la fiche.
  const openId = route.query?.open
  if (openId && typeof openId === 'string') await openUser(openId)
})
</script>

<template>
  <div>
    <UserFilters
      :model-status="filters.status" :model-query="filters.query"
      :show-recette="recetteAvailable" :model-recette="filters.recetteTester === true"
      @update:status="onStatusFilter" @update:query="onSearch" @update:recette="onRecetteFilter"
    />
    <p
      v-if="recette.feedback.value" data-test="recette-bulk-feedback"
      :role="recette.feedback.value.tone === 'error' ? 'alert' : 'status'"
      class="mb-3 rounded-btn border px-3 py-2 text-sm text-pretty"
      :class="recette.feedback.value.tone === 'success'
        ? 'border-success/40 bg-success/10 text-success'
        : 'border-danger/40 bg-danger/10 text-danger'"
    >{{ recette.feedback.value.text }}</p>
    <Transition
      enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition-[opacity,transform] duration-150 ease-out"
      leave-to-class="opacity-0 -translate-y-0.5"
    >
      <UserRecetteBulkBar
        v-if="recetteAvailable && recette.count.value > 0"
        :count="recette.count.value" :total-matching="totalElements"
        :busy="recette.busy.value" :selecting-all="recette.selectingAll.value" :truncated="recette.truncated.value"
        @apply="applyRecette" @clear="recette.clear" @select-all-matching="recette.selectAllMatching(filters)"
      />
    </Transition>
    <UserTable
      :users="users" :loading="isLoading"
      :selectable="recetteAvailable" :selected-ids="recette.selected.value"
      @select="openUser" @toggle="recette.toggle" @toggle-page="recette.togglePage"
    />
    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <UserDetailPanel
      v-if="detail.user.value"
      :user="detail.user.value" :open="detail.user.value !== null"
      :error="detail.error.value" :busy="detail.busy.value"
      :kyc="kyc.kyc.value" :kyc-loading="kyc.isLoading.value" :kyc-error="kyc.error.value"
      :cancel-deletion-unavailable="detail.cancelDeletionUnavailable.value"
      :cancel-deletion-reason-error="detail.cancelDeletionReasonError.value"
      @close="detail.close"
      @cancel-deletion="async (r) => { if (await detail.cancelDeletion(r)) await afterAction() }"
      @suspend="async (r) => { await detail.suspend(r); await afterAction() }"
      @ban="async (r) => { await detail.ban(r); await afterAction() }"
      @unsuspend="async () => { await detail.unsuspend(); await afterAction() }"
      @suspend-publishing="async (r) => { await detail.suspendPublishing(r); await afterAction() }"
      @lift-publishing="async () => { await detail.liftPublishing(); await afterAction() }"
      @set-commission="async (rate) => { await detail.setCommissionRate(rate); await afterAction() }"
      @mute-messaging="async (durationHours, reason) => { await detail.muteMessaging(durationHours, reason); await afterAction() }"
      @unmute-messaging="async () => { await detail.unmuteMessaging(); await afterAction() }"
      @open-kyc="() => { if (!detail.user.value) return; kyc.load(detail.user.value.id) }"
      @reset-kyc="async (reason) => { if (!detail.user.value) return; const id = detail.user.value.id; await kyc.reset(id, reason); await detail.open(id); await afterAction() }"
      @kyc-decided="onKycDecided"
      @kyc-stale="() => { if (detail.user.value) kyc.refresh(detail.user.value.id) }"
      @grant-pro="async (reason) => { await detail.grantPro(reason); await afterAction() }"
      @revoke-pro="async () => { await detail.revokePro(); await afterAction() }"
      @request-delete="openDeletion"
    />

    <UserDeletionDialog
      v-if="detail.user.value"
      :open="deletionOpen"
      :user="detail.user.value"
      :impact="deletion.impact.value"
      :is-loading="deletion.isLoading.value"
      :busy="deletion.busy.value"
      :error="deletion.error.value"
      @confirm="confirmDeletion"
      @cancel="closeDeletion"
    />
  </div>
</template>
