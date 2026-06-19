<script setup lang="ts">
import { ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { userStatusMeta } from './userStatus'
import type { AdminUserDetail } from '@/features/users/types/index'

const props = defineProps<{ user: AdminUserDetail; open: boolean }>()
const emit = defineEmits<{ close: []; suspend: [reason: string]; ban: [reason: string]; unsuspend: [] }>()

type Pending = 'suspend' | 'ban' | null
const pending = ref<Pending>(null)
const fullName = () => [props.user.firstName, props.user.lastName].filter(Boolean).join(' ') || '—'
function confirmReason(reason: string) {
  if (pending.value === 'suspend') emit('suspend', reason)
  else if (pending.value === 'ban') emit('ban', reason)
  pending.value = null
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside class="h-full w-full max-w-md bg-surface border-l border-border overflow-y-auto p-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="font-display text-xl font-bold">{{ fullName() }}</h2>
          <p class="text-sm text-text-muted tabular-nums">{{ user.phoneNumber }}</p>
        </div>
        <StatusBadge v-bind="userStatusMeta(user.status)" />
      </div>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><dt class="text-text-muted">Email</dt><dd>{{ user.email ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Ville</dt><dd>{{ user.city ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">KYC</dt><dd>{{ user.kycStatus }}</dd></div>
        <div><dt class="text-text-muted">Stripe</dt><dd>{{ user.stripeAccountStatus ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Trajets</dt><dd class="tabular-nums">{{ user.totalTrips }}</dd></div>
        <div><dt class="text-text-muted">Envois</dt><dd class="tabular-nums">{{ user.totalShipments }}</dd></div>
        <div><dt class="text-text-muted">No-shows</dt><dd class="tabular-nums">{{ user.noShowCount }}</dd></div>
        <div><dt class="text-text-muted">Annulations</dt><dd class="tabular-nums">{{ user.cancellationCount }}</dd></div>
      </dl>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="user.status === 'ACTIVE'" type="button" data-test="action-suspend"
          class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30"
          @click="pending = 'suspend'"
        >Suspendre</button>
        <button
          v-if="user.status === 'ACTIVE'" type="button" data-test="action-ban"
          class="rounded-btn px-4 py-2 text-sm bg-danger/20 text-danger hover:bg-danger/30"
          @click="pending = 'ban'"
        >Bannir</button>
        <button
          v-if="user.status === 'SUSPENDED'" type="button" data-test="action-unsuspend"
          class="rounded-btn px-4 py-2 text-sm bg-success/20 text-success hover:bg-success/30"
          @click="emit('unsuspend')"
        >Réactiver</button>
        <button
          type="button" data-test="action-close"
          class="rounded-btn px-4 py-2 text-sm border border-border ml-auto"
          @click="emit('close')"
        >Fermer</button>
      </div>

      <ConfirmActionDialog
        :open="pending !== null"
        :title="pending === 'ban' ? 'Bannir ce compte' : 'Suspendre ce compte'"
        :message="pending === 'ban' ? 'Le compte sera banni définitivement.' : 'Le compte sera suspendu.'"
        :confirm-label="pending === 'ban' ? 'Bannir' : 'Suspendre'"
        :require-reason="true"
        @confirm="confirmReason"
        @cancel="pending = null"
      />
    </aside>
  </div>
</template>
