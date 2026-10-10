<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminBidParty } from '@/features/bids/types/index'
import { kycStatusMeta } from '@/features/kyc/types/index'
import { mobileMoneyLabel, stripeAccountLabel, userStatusMeta } from '@/features/bids/lib/bidLabels'
import { useAuthStore } from '@/stores/auth'

/**
 * Une personne du colis. `party` absent (ancien back) : seul le nom de la fiche s'affiche.
 * Les statuts nuls viennent d'un admin sans USER_VIEW : le back ne les envoie pas.
 */
const props = defineProps<{
  role: 'sender' | 'traveler'
  title: string
  party?: AdminBidParty | null
  fallbackName?: string | null
}>()
const emit = defineEmits<{ contact: [recipient: { id: string; name: string }] }>()
const auth = useAuthStore()

const name = computed(() => props.party?.name ?? props.fallbackName ?? null)
const canOpen = computed(() => !!props.party?.id && auth.can('USER_VIEW'))
const canContact = computed(() => !!props.party?.id && auth.can('SUPPORT_TICKET_MANAGE'))
const details = computed(() => props.party != null && props.party.kycStatus !== null)
const isTraveler = computed(() => props.role === 'traveler')
</script>

<template>
  <div :data-test="`party-${role}`" class="rounded-card bg-surface-elevated p-3">
    <p class="text-xs font-medium text-text-muted">{{ title }}</p>
    <div class="mt-0.5 flex flex-wrap items-baseline gap-x-2">
      <NuxtLink
        v-if="canOpen && party" :to="{ path: '/users', query: { query: party.id, open: party.id } }"
        :data-test="`party-${role}-link`" class="font-medium text-primary hover:underline"
      >{{ name ?? party.id.slice(0, 8) }}</NuxtLink>
      <span v-else class="font-medium">{{ name ?? '—' }}</span>
      <span v-if="party?.username" class="text-xs text-text-muted">@{{ party.username }}</span>
    </div>
    <template v-if="details && party">
      <dl class="mt-2 grid grid-cols-1 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-2">
        <div><dt class="text-text-muted">Téléphone</dt><dd class="tabular-nums" :data-test="`party-${role}-phone`">{{ party.phoneMasked ?? 'Non renseigné' }}</dd></div>
        <div v-if="party.status"><dt class="text-text-muted">Compte</dt><dd><StatusBadge v-bind="userStatusMeta(party.status)" /></dd></div>
        <div v-if="isTraveler && party.kycStatus" :data-test="`party-${role}-kyc`">
          <dt class="text-text-muted">Identité (KYC)</dt><dd><StatusBadge v-bind="kycStatusMeta(party.kycStatus)" /></dd>
        </div>
        <template v-if="isTraveler">
          <div :data-test="`party-${role}-stripe`">
            <dt class="text-text-muted">Stripe Connect</dt>
            <dd>
              <StatusBadge
                :label="party.stripeConnectUsable ? 'Utilisable' : 'Non utilisable'"
                :tone="party.stripeConnectUsable ? 'success' : 'warning'"
              />
              <span class="ml-1 text-text-muted">{{ stripeAccountLabel(party.stripeAccountStatus) }}</span>
            </dd>
          </div>
          <div :data-test="`party-${role}-mobile-money`">
            <dt class="text-text-muted">Mobile money</dt>
            <dd>{{ party.mobileMoneyUsable ? 'Utilisable' : mobileMoneyLabel(party.mobileMoneyStatus) }}</dd>
          </div>
        </template>
      </dl>
    </template>
    <p v-else-if="party" class="mt-1 text-xs text-text-muted text-pretty" :data-test="`party-${role}-restricted`">
      Coordonnées et statuts réservés aux admins qui consultent les fiches utilisateur.
    </p>
    <button
      v-if="canContact && party" type="button" :data-test="`party-${role}-contact`"
      class="mt-2 inline-flex min-h-10 items-center rounded-btn px-3 text-xs font-medium text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96]"
      @click="emit('contact', { id: party.id, name: name ?? party.id.slice(0, 8) })"
    >Écrire via le support</button>
  </div>
</template>
