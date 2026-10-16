<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Wrench, X } from 'lucide-vue-next'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import BroadcastUserPicker from '@/features/broadcast/components/BroadcastUserPicker.vue'
import { useMaintenance } from '@/features/maintenance/composables/useMaintenance'
import { formatLocal, isoToLocalInput, localInputToIso } from '@/features/maintenance/utils/datetime'
import { useAuthStore } from '@/stores/auth'

/**
 * Mode maintenance : tant qu'il est actif, l'application mobile et le portail pro
 * n'affichent plus que l'écran de maintenance (l'API répond 503), sauf pour les comptes
 * exemptés. Activer demande de saisir MAINTENANCE : le geste coupe le service à tout le monde.
 */
const ENABLE_PHRASE = 'MAINTENANCE'
const DEFAULT_MESSAGE = 'L’application est en maintenance, revenez plus tard.'
const MESSAGE_MAX = 300
const NOTE_MAX = 120

const { state, unavailable, loading, busy, error, load, update, addExemption, removeExemption } = useMaintenance()
const auth = useAuthStore()

const message = ref('')
const endLocal = ref('')
const enableOpen = ref(false)
const disableOpen = ref(false)
const exemptUserId = ref('')
const exemptNote = ref('')

const enabled = computed(() => state.value?.enabled === true)
const exemptions = computed(() => state.value?.exemptions ?? [])

// Le formulaire reflète l'état serveur à chaque rechargement ou écriture.
watch(state, (s) => {
  message.value = s?.message ?? ''
  endLocal.value = isoToLocalInput(s?.estimatedEndAt ?? null)
}, { immediate: true })

function payload(nextEnabled: boolean) {
  return {
    enabled: nextEnabled,
    message: message.value.trim() || null,
    estimatedEndAt: nextEnabled ? localInputToIso(endLocal.value) : null,
  }
}

function confirmEnable() {
  enableOpen.value = false
  void update(payload(true))
}

function confirmDisable() {
  disableOpen.value = false
  void update(payload(false))
}

function saveMessage() {
  void update(payload(true))
}

async function addExempt() {
  if (!exemptUserId.value) return
  const ok = await addExemption(exemptUserId.value, exemptNote.value.trim() || null)
  if (ok) {
    exemptUserId.value = ''
    exemptNote.value = ''
  }
}

onMounted(() => { void load() })
</script>

<template>
  <section data-test="maintenance-card" class="bg-surface border border-border rounded-card p-5">
    <p v-if="unavailable" class="text-sm text-text-muted">Indisponible sur cette version du serveur</p>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 font-display text-base font-semibold">
          <Wrench :size="18" aria-hidden="true" />
          Mode maintenance
        </h2>
        <StatusBadge
          v-if="state" data-test="maintenance-badge"
          :label="enabled ? 'En maintenance' : 'Application ouverte'"
          :tone="enabled ? 'danger' : 'success'"
        />
      </div>

      <p class="mt-2 text-sm text-text-muted text-pretty">
        Pendant la maintenance, l’application et le portail pro n’affichent plus qu’un écran
        « en maintenance ». Les paiements en cours, les webhooks et cet admin continuent de fonctionner.
      </p>

      <p
        v-if="error" data-test="maintenance-error" role="alert"
        class="mt-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <p v-if="loading && !state" class="mt-3 text-sm text-text-muted">Chargement…</p>

      <template v-if="state">
        <p
          v-if="enabled" data-test="maintenance-since"
          class="mt-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger tabular-nums"
        >
          Maintenance active depuis le {{ formatLocal(state.startedAt) }}<template v-if="state.estimatedEndAt">,
            retour prévu le {{ formatLocal(state.estimatedEndAt) }}</template>.
        </p>

        <div class="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label class="block text-sm text-text-muted">
            Message affiché aux utilisateurs
            <textarea
              v-model="message" data-test="maintenance-message" rows="2" :maxlength="MESSAGE_MAX"
              :placeholder="DEFAULT_MESSAGE" :disabled="busy"
              class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-40"
            />
            <span class="mt-1 block text-xs tabular-nums">Facultatif, {{ message.length }}/{{ MESSAGE_MAX }}. Vide : texte par défaut.</span>
          </label>
          <label class="block text-sm text-text-muted">
            Retour estimé (facultatif)
            <input
              v-model="endLocal" data-test="maintenance-end" type="datetime-local" :disabled="busy"
              class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text tabular-nums disabled:opacity-40"
            >
          </label>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-if="!enabled" type="button" data-test="maintenance-enable" :disabled="busy"
            class="rounded-btn bg-danger px-4 py-2 text-sm text-white transition-[background-color,transform] hover:bg-danger/90 active:scale-[0.97] disabled:opacity-40"
            @click="enableOpen = true"
          >Activer la maintenance</button>
          <template v-else>
            <button
              type="button" data-test="maintenance-save" :disabled="busy"
              class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
              @click="saveMessage"
            >Enregistrer le message</button>
            <button
              type="button" data-test="maintenance-disable" :disabled="busy"
              class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40"
              @click="disableOpen = true"
            >Rouvrir l’application</button>
          </template>
        </div>

        <div class="mt-6 border-t border-border pt-4">
          <h3 class="text-sm font-semibold">Comptes autorisés pendant la maintenance</h3>
          <p class="mt-1 text-xs text-text-muted text-pretty">
            Ces comptes gardent l’accès à l’application pour vérifier votre travail avant de rouvrir.
          </p>

          <ul v-if="exemptions.length" data-test="maintenance-exemptions" class="mt-3 divide-y divide-border rounded-btn border border-border">
            <li
              v-for="e in exemptions" :key="e.userId" :data-test="`maintenance-exemption-${e.userId}`"
              class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ e.displayName ?? e.userId }}</span>
                <span v-if="e.note" class="block truncate text-xs text-text-muted">{{ e.note }}</span>
              </span>
              <button
                type="button" :data-test="`maintenance-exemption-remove-${e.userId}`" :disabled="busy"
                :aria-label="`Retirer ${e.displayName ?? e.userId}`"
                class="shrink-0 rounded-btn p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-danger disabled:opacity-40"
                @click="removeExemption(e.userId)"
              ><X :size="16" aria-hidden="true" /></button>
            </li>
          </ul>
          <p v-else data-test="maintenance-exemptions-empty" class="mt-3 text-sm text-text-muted">Aucun compte autorisé.</p>

          <div class="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <BroadcastUserPicker
              v-model="exemptUserId" label="Ajouter un compte" :can-search="auth.can('USER_VIEW')" :disabled="busy"
            />
            <label class="block text-sm text-text-muted">
              Note
              <input
                v-model="exemptNote" data-test="maintenance-exempt-note" type="text" :maxlength="NOTE_MAX"
                placeholder="Testeur, propriétaire…" :disabled="busy"
                class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-40"
              >
            </label>
            <button
              type="button" data-test="maintenance-exempt-add" :disabled="busy || !exemptUserId"
              class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
              @click="addExempt"
            >Ajouter</button>
          </div>
        </div>
      </template>
    </template>

    <ConfirmActionDialog
      :open="enableOpen"
      title="Activer la maintenance ?"
      message="Tous les utilisateurs, sauf les comptes autorisés, verront immédiatement l’écran de maintenance et ne pourront plus rien faire dans l’application."
      confirm-label="Activer"
      :confirmation-phrase="ENABLE_PHRASE"
      @confirm="confirmEnable" @cancel="enableOpen = false"
    />
    <ConfirmActionDialog
      :open="disableOpen"
      title="Rouvrir l’application ?"
      message="L’écran de maintenance disparaîtra et les utilisateurs retrouveront l’application là où ils l’avaient laissée."
      confirm-label="Rouvrir"
      confirm-tone="primary"
      @confirm="confirmDisable" @cancel="disableOpen = false"
    />
  </section>
</template>
