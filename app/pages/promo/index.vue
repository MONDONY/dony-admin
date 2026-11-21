<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PromoTable from '@/features/promo/components/PromoTable.vue'
import PromoForm from '@/features/promo/components/PromoForm.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { usePromoCodes } from '@/features/promo/composables/usePromoCodes'
import { PROMO_ORIGIN_FILTERS, type AdminPromoCode, type PromoCodeInput, type PromoStatus } from '@/features/promo/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'PROMO_MANAGE', pageTitle: 'Codes promo', pageSubtitle: 'Gestion des codes de réduction' })

const { codes, isLoading, totalPages, currentPage, filters, actionError, fetchCodes, goToPage, setStatusFilter, setOriginFilter, clearActionError, create, update, setStatus, remove } = usePromoCodes()

const tabs: { value: PromoStatus | null; label: string }[] = [
  { value: null, label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'DISABLED', label: 'Désactivés' },
]

const showForm = ref(false)
const editing = ref<AdminPromoCode | null>(null)
const pendingRemoveId = ref<string | null>(null)

function openCreate() {
  editing.value = null
  showForm.value = true
}
function openEdit(id: string) {
  editing.value = codes.value.find((c) => c.id === id) ?? null
  showForm.value = true
}
async function onSubmit(input: PromoCodeInput) {
  clearActionError()
  if (editing.value) await update(editing.value.id, input)
  else await create(input)
  // Un refus (409) laisse le formulaire ouvert, le message s'affiche au-dessus du tableau.
  if (actionError.value) return
  showForm.value = false
  editing.value = null
}
async function toggleStatus(code: AdminPromoCode) {
  await setStatus(code.id, code.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')
}
async function confirmRemove() {
  if (pendingRemoveId.value) await remove(pendingRemoveId.value)
  pendingRemoveId.value = null
}

const formKey = computed(() => editing.value?.id ?? 'new')

onMounted(fetchCodes)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div class="flex gap-1" role="group" aria-label="Statut">
          <button
            v-for="t in tabs" :key="String(t.value)" type="button" :data-test="`promo-tab-${t.value}`"
            :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
              filters.status === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
            @click="setStatusFilter(t.value)"
          >{{ t.label }}</button>
        </div>
        <div class="flex items-center gap-1" role="group" aria-label="Origine">
          <span class="mr-1 text-xs uppercase text-text-muted">Origine</span>
          <button
            v-for="o in PROMO_ORIGIN_FILTERS" :key="o.value" type="button" :data-test="`promo-origin-${o.value}`"
            :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
              filters.origin === o.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
            @click="setOriginFilter(o.value)"
          >{{ o.label }}</button>
        </div>
      </div>
      <button
        type="button" data-test="new-promo"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90"
        @click="openCreate"
      >Nouveau code</button>
    </div>

    <p
      v-if="actionError" data-test="promo-action-error" role="alert"
      class="mb-4 rounded-card bg-danger/15 px-4 py-2 text-sm text-danger"
    >{{ actionError }}</p>

    <PromoTable
      :codes="codes" :loading="isLoading"
      @edit="openEdit" @remove="(id) => pendingRemoveId = id" @toggle-status="toggleStatus"
    />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <PromoForm
      v-if="showForm" :key="formKey" :editing="editing"
      @submit="onSubmit" @cancel="showForm = false; editing = null"
    />

    <ConfirmActionDialog
      :open="pendingRemoveId !== null"
      title="Supprimer le code promo"
      message="Le code ne pourra plus être utilisé. Action irréversible."
      confirm-label="Supprimer"
      @confirm="confirmRemove"
      @cancel="pendingRemoveId = null"
    />
  </div>
</template>
