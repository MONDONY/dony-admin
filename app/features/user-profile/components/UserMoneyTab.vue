<script setup lang="ts">
import UserListSection from '@/features/user-profile/components/UserListSection.vue'
import UserWalletTab from '@/features/wallet/components/UserWalletTab.vue'
import { paymentColumns, paymentLink } from '@/features/user-profile/lib/sectionColumns'

defineProps<{ userId: string }>()
</script>

<template>
  <div class="flex flex-col gap-5">
    <UserWalletTab :user-id="userId" />
    <UserListSection title="Paiements" :user-id="userId" section="payments" :columns="paymentColumns" :link-for="paymentLink" empty-label="Aucun paiement pour ce compte" />
  </div>
</template>
