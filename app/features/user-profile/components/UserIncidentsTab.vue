<script setup lang="ts">
import UserListSection from '@/features/user-profile/components/UserListSection.vue'
import {
  cancellationColumns, disputeColumns, disputeLink, ratingColumns, reportColumns, reportLink,
} from '@/features/user-profile/lib/sectionColumns'
import { useAuthStore } from '@/stores/auth'

defineProps<{ userId: string }>()
const auth = useAuthStore()
</script>

<template>
  <div class="flex flex-col gap-5">
    <template v-if="auth.can('DISPUTE_VIEW')">
      <UserListSection title="Litiges" :user-id="userId" section="disputes" :columns="disputeColumns" :link-for="disputeLink" empty-label="Aucun litige pour ce compte" />
      <UserListSection title="Absences et annulations" :user-id="userId" section="cancellations" :columns="cancellationColumns" empty-label="Aucune absence ni annulation pour ce compte" />
    </template>
    <template v-if="auth.can('REPORT_VIEW')">
      <UserListSection
        title="Signalements reçus" hint="Signalements visant directement ce compte" :user-id="userId" section="reports"
        :extra="{ direction: 'RECEIVED' }" :columns="reportColumns" :link-for="reportLink" empty-label="Aucun signalement reçu"
      />
      <UserListSection
        title="Signalements envoyés" :user-id="userId" section="reports"
        :extra="{ direction: 'SENT' }" :columns="reportColumns" :link-for="reportLink" empty-label="Aucun signalement envoyé"
      />
    </template>
    <UserListSection v-if="auth.can('RATING_MODERATE')" title="Avis reçus" :user-id="userId" section="ratings" :columns="ratingColumns" empty-label="Aucun avis reçu" />
  </div>
</template>
