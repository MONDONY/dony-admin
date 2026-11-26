<script setup lang="ts">
import { computed, onMounted } from 'vue'
import MobileAlertCard from '@/features/mobile/components/MobileAlertCard.vue'
import MobileNotificationSummary from '@/features/mobile/components/MobileNotificationSummary.vue'
import { useMobileAlertList } from '@/features/mobile/composables/useMobileAlertList'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'ALERT_VIEW', pageTitle: 'Alertes' })

const route = useRoute()
const rawItem = computed(() => route.query?.item)
const {
  chips, chip, sorted, isLoading, error, feed, isUnread, item, itemInvalid, itemNotification, load, selectChip,
} = useMobileAlertList(rawItem)

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <section v-if="item || itemInvalid" data-test="item-detail" class="space-y-2">
      <MobileNotificationSummary v-if="itemNotification" :item="itemNotification" :linked="false" />
      <p v-else data-test="item-empty" class="rounded-xl border border-border bg-surface px-3 py-4 text-sm text-text-muted">
        Cette nouveauté n’est plus dans votre fil. Retrouvez-la sur l’ordinateur.
      </p>
      <p class="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-text-muted">
        À traiter sur ordinateur : cette nouveauté se gère depuis la console, pas depuis le mobile.
      </p>
    </section>

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

    <section v-if="feed.length" aria-labelledby="autres-nouveautes" class="space-y-2">
      <h2 id="autres-nouveautes" class="text-sm font-bold text-text">Autres nouveautés</h2>
      <ul class="space-y-2">
        <li v-for="n in feed" :key="n.id"><MobileNotificationSummary :item="n" :read="!isUnread(n)" /></li>
      </ul>
    </section>
  </div>
</template>
