<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TopupCodesTable from '@/features/topup-codes/components/TopupCodesTable.vue'
import TopupCodeForm from '@/features/topup-codes/components/TopupCodeForm.vue'
import TopupCodeRedemptionsPanel from '@/features/topup-codes/components/TopupCodeRedemptionsPanel.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useTopupCodes } from '@/features/topup-codes/composables/useTopupCodes'
import type { AdminTopupCode, TopupCodeDisplayStatus, TopupCodeInput } from '@/features/topup-codes/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'TOPUP_CODE_MANAGE', pageTitle: 'Codes de recharge', pageSubtitle: 'Crédits du solde réservés aux commissions' })

const { codes, isLoading, error, totalPages, currentPage, filters, fetchCodes, goToPage, setStatusFilter, create, revoke, generateCode } = useTopupCodes()

const tabs: { value: TopupCodeDisplayStatus | null; label: string }[] = [
  { value: null, label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'EXHAUSTED', label: 'Épuisés' },
  { value: 'EXPIRED', label: 'Expirés' },
  { value: 'REVOKED', label: 'Révoqués' },
]

const showForm = ref(false)
/** Code tout juste créé : seul moment où son texte est connu, le back ne le stocke que haché. */
const issued = ref<AdminTopupCode | null>(null)
const issuedCopied = ref(false)
const pendingRevoke = ref<AdminTopupCode | null>(null)
const selected = ref<AdminTopupCode | null>(null)

async function onSubmit(input: TopupCodeInput) {
  try {
    const created = await create(input)
    showForm.value = false
    issuedCopied.value = false
    issued.value = created.code ? created : null
  } catch { /* error affiché dans le bandeau, le formulaire reste ouvert */ }
}
async function copyIssued() {
  if (!issued.value?.code) return
  try { await navigator.clipboard.writeText(issued.value.code); issuedCopied.value = true } catch { issuedCopied.value = false }
}
async function confirmRevoke() {
  const target = pendingRevoke.value
  pendingRevoke.value = null
  if (target) { try { await revoke(target.id) } catch { /* bandeau */ } }
}

onMounted(fetchCodes)
</script>

<template>
  <div>
    <p
      v-if="error" data-test="topup-error" role="alert"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="t in tabs" :key="String(t.value)" type="button" :data-test="`topup-tab-${t.value}`"
          :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
            filters.status === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="setStatusFilter(t.value)"
        >{{ t.label }}</button>
      </div>
      <button
        type="button" data-test="new-topup-code"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90"
        @click="showForm = true"
      >Nouveau code</button>
    </div>

    <TopupCodesTable
      :codes="codes" :loading="isLoading"
      @revoke="(c) => pendingRevoke = c" @show-redemptions="(c) => selected = c"
    />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <TopupCodeForm v-if="showForm" :generate="generateCode" @submit="onSubmit" @cancel="showForm = false" />

    <TopupCodeRedemptionsPanel :code="selected" @close="selected = null" />

    <div
      v-if="issued" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="topup-issued"
    >
      <div role="dialog" aria-modal="true" aria-label="Code créé" class="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-xl">
        <h2 class="font-display text-lg font-semibold mb-1">Code créé</h2>
        <p class="text-sm text-text-muted text-pretty mb-3">
          Copiez-le maintenant : pour votre sécurité, Yadony ne le conserve pas en clair et ne pourra plus l’afficher en entier.
        </p>
        <p class="rounded-btn border border-border bg-bg px-3 py-2 font-mono text-lg font-semibold text-center select-all" data-test="topup-issued-code">{{ issued.code }}</p>
        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button" data-test="topup-issued-copy"
            class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated" @click="copyIssued"
          >{{ issuedCopied ? 'Copié' : 'Copier' }}</button>
          <button
            type="button" data-test="topup-issued-close"
            class="rounded-btn px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90" @click="issued = null"
          >J’ai copié le code</button>
        </div>
      </div>
    </div>

    <ConfirmActionDialog
      :open="pendingRevoke !== null"
      title="Révoquer le code"
      message="Plus personne ne pourra l’utiliser. Les crédits déjà versés restent acquis."
      confirm-label="Révoquer"
      @confirm="confirmRevoke"
      @cancel="pendingRevoke = null"
    />
  </div>
</template>
