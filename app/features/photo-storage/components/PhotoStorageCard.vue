<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { HardDrive, Play, RefreshCw } from 'lucide-vue-next'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { usePhotoStorage } from '@/features/photo-storage/composables/usePhotoStorage'
import { formatBytes, formatDuration, formatUtc } from '@/features/photo-storage/utils/format'
import type { PhotoPurgeRun } from '@/features/photo-storage/types/index'

const { status, unavailable, loading, error, notice, launching, load, runPurge, reconcile } = usePhotoStorage()

const HISTORY_SIZE = 5
const BULK_PHRASE = 'SUPPRESSION MASSIVE'

const historyOpen = ref(false)
const dialogOpen = ref(false)
const allowBulk = ref(false)

const disabled = computed(() => loading.value || launching.value || !!status.value?.running)
const lastPurge = computed(() => status.value?.lastPurges[0] ?? null)
const lastReconcile = computed(() => status.value?.lastReconciles[0] ?? null)
const purgeHistory = computed(() => status.value?.lastPurges.slice(0, HISTORY_SIZE) ?? [])
const reconcileHistory = computed(() => status.value?.lastReconciles.slice(0, HISTORY_SIZE) ?? [])
// Fermé quel que soit l'état connu de la purge : le statut affiché peut être périmé (le
// formulaire des réglages, sur la même page, peut activer la purge sans que la carte le sache).
const bulkPhrase = computed(() => (allowBulk.value ? BULK_PHRASE : undefined))

function summary(r: PhotoPurgeRun): string {
  return r.dryRun
    ? `${r.eligible} photos seraient supprimées`
    : `${r.deleted} supprimées, ${r.failed} échecs`
}

/** Ligne d'un passage : début, mode, durée, résultat. */
function describe(r: PhotoPurgeRun): string {
  return [formatUtc(r.startedAt), r.dryRun ? 'à blanc' : 'réel', formatDuration(r.startedAt, r.finishedAt), summary(r)]
    .join(' · ')
}

function openReconcile() {
  allowBulk.value = false
  dialogOpen.value = true
  void load()
}

function confirmReconcile() {
  dialogOpen.value = false
  void reconcile(allowBulk.value)
}

onMounted(() => { void load() })

// La page recharge la carte après l'enregistrement de `photo_purge_enabled`.
defineExpose({ refresh: load })
</script>

<template>
  <section data-test="photo-storage-card" class="bg-surface border border-border rounded-card p-5">
    <p v-if="unavailable" class="text-sm text-text-muted">Indisponible sur cette version du serveur</p>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 font-display text-base font-semibold">
          <HardDrive :size="18" aria-hidden="true" />
          Stockage photos
        </h2>
        <div v-if="status" class="flex items-center gap-2">
          <StatusBadge
            :label="status.purgeEnabled ? 'Purge active' : 'À blanc'"
            :tone="status.purgeEnabled ? 'danger' : 'neutral'"
          />
          <span class="text-xs text-text-muted tabular-nums">Délai : {{ status.retentionDays }} jours</span>
        </div>
      </div>

      <p
        v-if="notice" data-test="photo-storage-notice" role="status"
        class="mt-3 rounded-btn border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary text-pretty"
      >{{ notice }}</p>
      <p
        v-if="error" data-test="photo-storage-error"
        class="mt-3 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <template v-if="status">
        <p data-test="volumes" class="mt-3 text-sm text-text-muted tabular-nums">
          Envoyées sur 24 h : {{ status.uploads24h }} photos, {{ formatBytes(status.bytes24h) }}
          · Envoyées sur 7 j : {{ status.uploads7d }} photos, {{ formatBytes(status.bytes7d) }}
        </p>

        <dl class="mt-4 space-y-3 text-sm">
          <div data-test="last-purge">
            <dt class="text-xs font-medium text-text-muted uppercase tracking-wider">Dernière purge</dt>
            <dd v-if="lastPurge" class="tabular-nums">
              {{ describe(lastPurge) }}
              <span v-if="lastPurge.error" class="block text-danger">{{ lastPurge.error }}</span>
            </dd>
            <dd v-else class="text-text-muted">Aucune</dd>
          </div>
          <div data-test="last-reconcile">
            <dt class="text-xs font-medium text-text-muted uppercase tracking-wider">Dernier rapprochement</dt>
            <dd v-if="lastReconcile" class="tabular-nums">
              {{ describe(lastReconcile) }}
              <span v-if="lastReconcile.error" class="block text-danger">{{ lastReconcile.error }}</span>
            </dd>
            <dd v-else class="text-text-muted">Aucun</dd>
          </div>
        </dl>

        <button
          type="button" data-test="history-toggle"
          class="mt-3 text-xs text-primary transition-colors hover:underline"
          :aria-expanded="historyOpen"
          @click="historyOpen = !historyOpen"
        >{{ historyOpen ? 'Masquer l’historique' : 'Afficher l’historique' }}</button>

        <div v-if="historyOpen" data-test="history" class="mt-2 grid gap-3 text-xs sm:grid-cols-2">
          <ul class="space-y-1">
            <li class="font-medium text-text-muted">Purges</li>
            <li v-for="(r, i) in purgeHistory" :key="`p${i}`" data-test="history-purge" class="tabular-nums">
              {{ describe(r) }}
              <span v-if="r.error" class="text-danger"> · {{ r.error }}</span>
            </li>
            <li v-if="!purgeHistory.length" class="text-text-muted">Aucune</li>
          </ul>
          <ul class="space-y-1">
            <li class="font-medium text-text-muted">Rapprochements</li>
            <li v-for="(r, i) in reconcileHistory" :key="`r${i}`" data-test="history-reconcile" class="tabular-nums">
              {{ describe(r) }}
              <span v-if="r.error" class="text-danger"> · {{ r.error }}</span>
            </li>
            <li v-if="!reconcileHistory.length" class="text-text-muted">Aucun</li>
          </ul>
        </div>
      </template>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button" data-test="run-purge" :disabled="disabled"
          class="inline-flex items-center gap-2 rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
          @click="runPurge"
        >
          <Play :size="14" aria-hidden="true" />
          Lancer la purge maintenant
        </button>
        <button
          type="button" data-test="run-reconcile" :disabled="disabled"
          class="inline-flex items-center gap-2 rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
          @click="openReconcile"
        >
          <Play :size="14" aria-hidden="true" />
          Lancer le contrôle complet
        </button>
        <button
          type="button" data-test="refresh" :disabled="loading"
          class="inline-flex items-center gap-2 rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
          @click="load"
        >
          <RefreshCw :size="14" aria-hidden="true" />
          Actualiser
        </button>
        <span
          v-if="status?.running" data-test="running" role="status"
          class="self-center text-sm text-text-muted"
        >Passage en cours…</span>
      </div>

      <ConfirmActionDialog
        :open="dialogOpen"
        title="Lancer le contrôle complet"
        message="Le contrôle complet compare le stockage et la base, puis traite les photos orphelines."
        confirm-label="Lancer le contrôle"
        :confirmation-phrase="bulkPhrase"
        @confirm="confirmReconcile"
        @cancel="dialogOpen = false"
      >
        <label class="mb-4 flex items-start gap-2 text-sm">
          <input v-model="allowBulk" type="checkbox" data-test="allow-bulk" class="mt-0.5">
          <span class="text-pretty">Autoriser une suppression massive (premier passage après l’historique)</span>
        </label>
      </ConfirmActionDialog>
    </template>
  </section>
</template>
