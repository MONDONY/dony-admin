<script setup lang="ts">
import { computed } from 'vue'
import UserListSection from '@/features/user-profile/components/UserListSection.vue'
import UserWalletTab from '@/features/wallet/components/UserWalletTab.vue'
import { paymentColumns, paymentLink } from '@/features/user-profile/lib/sectionColumns'
import { gate, paymentsOfPartyRoute, toHref, walletsOfPartyRoute } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ userId: string }>()
const auth = useAuthStore()

/** Vers Transactions, filtré sur la personne (PAYMENT_VIEW) : tous ses paiements, son portefeuille. */
const href = (route: ReturnType<typeof paymentsOfPartyRoute>) => {
  const r = gate(auth.can, 'PAYMENT_VIEW', route)
  return r ? toHref(r) : null
}
const allPaymentsHref = computed(() => href(paymentsOfPartyRoute(props.userId)))
const walletHref = computed(() => href(walletsOfPartyRoute(props.userId)))
const linkClass = 'inline-flex min-h-10 items-center rounded-btn px-2 text-sm font-medium text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100'
</script>

<template>
  <div class="flex flex-col gap-5">
    <UserWalletTab :user-id="userId" />
    <UserListSection title="Paiements" :user-id="userId" section="payments" :columns="paymentColumns" :link-for="paymentLink" empty-label="Aucun paiement pour ce compte">
      <template v-if="allPaymentsHref || walletHref" #action>
        <div class="flex flex-wrap items-center gap-1">
          <NuxtLink v-if="allPaymentsHref" :to="allPaymentsHref" data-test="user-payments-all-link" :class="linkClass">Tous ses paiements</NuxtLink>
          <NuxtLink v-if="walletHref" :to="walletHref" data-test="user-wallet-link" :class="linkClass">Son portefeuille</NuxtLink>
        </div>
      </template>
    </UserListSection>
  </div>
</template>
