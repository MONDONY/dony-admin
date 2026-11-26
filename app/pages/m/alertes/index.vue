<script setup lang="ts">
import { computed, onMounted } from 'vue'
import MobileAlertCard from '@/features/mobile/components/MobileAlertCard.vue'
import MobileNotificationSummary from '@/features/mobile/components/MobileNotificationSummary.vue'
import { useMobileAlertList } from '@/features/mobile/composables/useMobileAlertList'

// Le fil porte toutes les nouveautés (filtrées par le back selon les droits) et leurs pushs mènent ici :
// un seul de ces droits ouvre la page. La fiche d'une alerte (/m/alertes/<id>) reste ALERT_VIEW.
// Liste écrite en clair (macro extraite à la compilation) ; le test vérifie qu'elle égale ALERTS_FEED_PERMISSIONS.
definePageMeta({
  layout: 'mobile',
  middleware: 'admin-only',
  permissionAnyOf: ['ALERT_VIEW', 'DISPUTE_VIEW', 'USER_KYC', 'PAYMENT_VIEW', 'REPORT_VIEW', 'USER_GDPR_DELETE', 'SUPPORT_TICKET_VIEW'],
  pageTitle: 'Alertes',
})

const route = useRoute()
const rawItem = computed(() => route.query?.item)
const {
  ready, canViewAlerts, chips, chip, sorted, isLoading, error, feed, feedSettled, feedError, isUnread, item, itemInvalid, itemNotification,
  load, selectChip,
} = useMobileAlertList(rawItem)

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <section v-if="item || itemInvalid" data-test="item-detail" class="space-y-2">
      <MobileNotificationSummary v-if="itemNotification" :item="itemNotification" :linked="false" />
      <p v-else-if="item && !feedSettled" data-test="item-loading" class="px-3 py-4 text-sm text-text-muted">Chargement…</p>
      <p v-else data-test="item-empty" class="rounded-xl border border-border bg-surface px-3 py-4 text-sm text-text-muted">
        Cette nouveauté n’est plus dans votre fil. Retrouvez-la sur l’ordinateur.
      </p>
      <p class="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-text-muted">
        À traiter sur ordinateur : cette nouveauté se gère depuis la console, pas depuis le mobile.
      </p>
    </section>

    <!-- Avant le montage (rendu serveur sans auth) : rien qui dépende des droits. -->
    <p v-if="!ready" class="text-sm text-text-muted">Chargement…</p>
    <template v-else>
      <template v-if="canViewAlerts">
        <div class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Statut des alertes">
          <button
            v-for="c in chips" :key="c.key" type="button" role="tab" data-test="alert-chip"
            :data-chip="c.key" :aria-selected="chip === c.key"
            class="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold"
            :class="chip === c.key ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text'"
            @click="selectChip(c.key)"
          >{{ c.label }}</button>
        </div>

        <p v-if="error" data-test="alerts-error" class="text-sm text-danger" role="alert">{{ error }}</p>
        <p v-else-if="isLoading && !sorted.length" class="text-sm text-text-muted">Chargement…</p>
        <p v-else-if="!sorted.length" data-test="alerts-empty" class="text-sm text-text-muted">Aucune alerte dans cette liste.</p>
        <ul v-else class="space-y-2">
          <li v-for="a in sorted" :key="a.id"><MobileAlertCard :alert="a" /></li>
        </ul>
      </template>

      <section v-if="feed.length" aria-labelledby="autres-nouveautes" class="space-y-2">
        <h2 id="autres-nouveautes" class="text-sm font-bold text-text">{{ canViewAlerts ? 'Autres nouveautés' : 'Nouveautés' }}</h2>
        <ul class="space-y-2">
          <li v-for="n in feed" :key="n.id"><MobileNotificationSummary :item="n" :read="!isUnread(n)" /></li>
        </ul>
      </section>
      <!-- Sans ALERT_VIEW, le fil est tout l'écran : son chargement, son échec et son vide se disent. -->
      <template v-else-if="!canViewAlerts">
        <p v-if="feedError" data-test="feed-error" class="text-sm text-danger" role="alert">{{ feedError }}</p>
        <p v-else-if="!feedSettled" class="text-sm text-text-muted">Chargement…</p>
        <p v-else data-test="feed-empty" class="text-sm text-text-muted">Aucune nouveauté dans votre fil pour le moment.</p>
      </template>
    </template>
  </div>
</template>
