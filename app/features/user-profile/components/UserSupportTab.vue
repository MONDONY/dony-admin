<script setup lang="ts">
import UserListSection from '@/features/user-profile/components/UserListSection.vue'
import UserSupportConversations from '@/features/support/components/UserSupportConversations.vue'
import { auditColumns } from '@/features/user-profile/lib/sectionColumns'
import { useAuthStore } from '@/stores/auth'

defineProps<{ userId: string }>()
const auth = useAuthStore()
</script>

<template>
  <div class="flex flex-col gap-5">
    <UserSupportConversations v-if="auth.can('SUPPORT_TICKET_VIEW')" :user-id="userId" />
    <UserListSection
      v-if="auth.can('AUDIT_VIEW')"
      title="Gestes des administrateurs sur ce compte"
      hint="Seuls les gestes enregistrés sur le compte lui-même apparaissent (identité, portefeuille, avis et signalements ont leur propre historique)."
      section="audit"
      :user-id="userId"
      :columns="auditColumns"
      empty-label="Aucun geste enregistré sur ce compte."
    />
  </div>
</template>
