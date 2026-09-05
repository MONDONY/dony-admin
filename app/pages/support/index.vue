<script setup lang="ts">
import { onMounted } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import SupportTicketThread from '@/features/support/components/SupportTicketThread.vue'
import SupportTicketsTable from '@/features/support/components/SupportTicketsTable.vue'
import { useSupportTickets } from '@/features/support/composables/useSupportTickets'
import type { SupportStatusFilter, SupportTicketScope } from '@/features/support/types/index'
import { STATUS_LABELS } from '@/features/support/utils/format'

definePageMeta({
  middleware: 'admin-only',
  permission: 'SUPPORT_TICKET_VIEW',
  pageTitle: 'Support',
  pageSubtitle: 'Tickets utilisateurs & réponses',
})

const SCOPES: { key: SupportTicketScope, label: string }[] = [
  { key: 'unassigned', label: 'Non assignés' },
  { key: 'mine', label: 'Mes tickets' },
  { key: 'all', label: 'Tous' },
]

const s = useSupportTickets()

onMounted(() => s.fetchTickets())
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1 rounded-md border border-border bg-surface p-1">
        <button
          v-for="scope in SCOPES"
          :key="scope.key"
          type="button"
          :class="[
            'rounded px-3 py-1.5 text-sm font-medium',
            s.scope.value === scope.key
              ? 'bg-primary text-white'
              : 'text-text-muted hover:text-text',
          ]"
          @click="s.setScope(scope.key)"
        >
          {{ scope.label }}
        </button>
      </div>
      <select
        :value="s.statusFilter.value"
        class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
        aria-label="Filtrer par statut"
        @change="s.setStatusFilter(($event.target as HTMLSelectElement).value as SupportStatusFilter)"
      >
        <option value="TOUS">Tous les statuts</option>
        <option v-for="(label, code) in STATUS_LABELS" :key="code" :value="code">
          {{ label }}
        </option>
      </select>
    </div>

    <p v-if="s.error.value" class="mb-3 text-sm text-danger">{{ s.error.value }}</p>

    <SupportTicketsTable
      :tickets="s.tickets.value"
      :loading="s.isLoading.value"
      @select="s.openTicket"
    />
    <div class="mt-4">
      <PaginationControls
        :page="s.currentPage.value"
        :total-pages="s.totalPages.value"
        @change="s.goToPage"
      />
    </div>

    <!-- Panneau détail -->
    <div
      v-if="s.selected.value || s.isDetailLoading.value"
      class="fixed inset-0 z-40 bg-black/30"
      @click.self="s.closeTicket()"
    >
      <aside class="absolute inset-y-0 right-0 w-full max-w-xl border-l border-border bg-surface shadow-xl">
        <p v-if="s.isDetailLoading.value" class="p-6 text-center text-sm text-text-muted">
          Chargement…
        </p>
        <SupportTicketThread
          v-else-if="s.selected.value"
          :ticket="s.selected.value"
          :acting="s.isActing.value"
          :action-error="s.actionError.value"
          @close="s.closeTicket()"
          @assign="s.assign"
          @reassign="s.reassign"
          @reply="s.reply"
          @resolve="s.resolve"
        />
      </aside>
    </div>
  </div>
</template>
