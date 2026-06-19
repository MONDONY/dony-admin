<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PromoTable from '@/features/promo/components/PromoTable.vue'
import PromoForm from '@/features/promo/components/PromoForm.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { usePromoCodes } from '@/features/promo/composables/usePromoCodes'
import type { AdminPromoCode, PromoCodeInput } from '@/features/promo/types/index'

definePageMeta({ middleware: 'admin-only', pageTitle: 'Codes promo', pageSubtitle: 'Gestion des codes de réduction' })

const { codes, isLoading, totalPages, currentPage, filters, fetchCodes, goToPage, setActiveFilter, create, update, remove } = usePromoCodes()

const tabs: { value: boolean | null; label: string }[] = [
  { value: null, label: 'Tous' },
  { value: true, label: 'Actifs' },
  { value: false, label: 'Inactifs' },
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
  if (editing.value) await update(editing.value.id, input)
  else await create(input)
  showForm.value = false
  editing.value = null
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
      <div class="flex gap-1">
        <button
          v-for="t in tabs" :key="String(t.value)" type="button" :data-test="`promo-tab-${t.value}`"
          :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
            filters.active === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="setActiveFilter(t.value)"
        >{{ t.label }}</button>
      </div>
      <button
        type="button" data-test="new-promo"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90"
        @click="openCreate"
      >Nouveau code</button>
    </div>

    <PromoTable :codes="codes" :loading="isLoading" @edit="openEdit" @remove="(id) => pendingRemoveId = id" />

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
