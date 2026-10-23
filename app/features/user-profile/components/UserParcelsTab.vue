<script setup lang="ts">
import UserListSection from '@/features/user-profile/components/UserListSection.vue'
import {
  parcelColumns, parcelLink, requestColumns, requestLink, tripColumns, tripLink,
} from '@/features/user-profile/lib/sectionColumns'

defineProps<{ userId: string }>()
</script>

<template>
  <div class="flex flex-col gap-5">
    <UserListSection title="Colis" :user-id="userId" section="parcels" :columns="parcelColumns" :link-for="parcelLink" empty-label="Aucun colis pour ce compte" />
    <UserListSection title="Trajets" :user-id="userId" section="trips" :columns="tripColumns" :link-for="tripLink" empty-label="Aucun trajet pour ce compte" />
    <UserListSection title="Demandes d’envoi" :user-id="userId" section="requests" :columns="requestColumns" :link-for="requestLink" empty-label="Aucune demande d’envoi pour ce compte" />
  </div>
</template>
