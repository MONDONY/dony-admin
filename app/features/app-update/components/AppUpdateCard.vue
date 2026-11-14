<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Smartphone } from 'lucide-vue-next'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { BUILD_MAX, BUILD_MIN, useAppUpdate } from '@/features/app-update/composables/useAppUpdate'

/**
 * Mise à jour de l'app : `recommendedBuild` (Firebase Remote Config) pilote le bandeau
 * « Nouvelle version disponible » chez les utilisateurs dont le build installé est inférieur.
 * `minSupportedBuild` (verrou de version minimale) reste en lecture seule.
 */
const { state, unavailable, loading, busy, error, loadFailed, load, save } = useAppUpdate()

const input = ref<string | number>('')
const confirmOpen = ref(false)

// Le champ reflète la valeur serveur à chaque chargement ou écriture.
watch(state, (s) => { input.value = s ? String(s.recommendedBuild) : '' }, { immediate: true })

const current = computed(() => state.value?.recommendedBuild ?? null)

const parsed = computed<number | null>(() => {
  const raw = String(input.value).trim()
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= BUILD_MIN && n <= BUILD_MAX ? n : null
})
const invalid = computed(() => String(input.value).trim() !== '' && parsed.value === null)
const unchanged = computed(() => parsed.value !== null && parsed.value === current.value)
const canSave = computed(() => !busy.value && parsed.value !== null && !unchanged.value)

// Baisser la valeur retire le bandeau aux builds situés entre la nouvelle et l'ancienne valeur.
const lowering = computed(() => parsed.value !== null && current.value !== null && parsed.value < current.value)
const loweringMessage = computed(() =>
  lowering.value
    ? `Tu baisses la valeur : le bandeau ne s’affichera plus pour les builds entre ${parsed.value} et ${current.value}.`
    : '',
)

const confirmMessage = computed(() => {
  if (parsed.value === null) return ''
  const base = parsed.value === 0
    ? 'Le bandeau de mise à jour sera désactivé pour tout le monde.'
    : `Les utilisateurs dont le build installé est inférieur à ${parsed.value} verront le bandeau de mise à jour.`
  return lowering.value ? `${base} ${loweringMessage.value}` : base
})

async function confirmSave() {
  confirmOpen.value = false
  if (parsed.value !== null) await save(parsed.value)
}

onMounted(() => { void load() })
</script>

<template>
  <section data-test="app-update-card" class="bg-surface border border-border rounded-card p-5">
    <p v-if="unavailable" data-test="app-update-unavailable" class="text-sm text-text-muted">
      Indisponible sur cette version du serveur
    </p>

    <template v-else>
      <h2 class="flex items-center gap-2 font-display text-base font-semibold">
        <Smartphone :size="18" aria-hidden="true" />
        Mise à jour de l’app
      </h2>

      <p class="mt-2 text-sm text-text-muted text-pretty">
        Le bandeau « Nouvelle version disponible » s’affiche chez les utilisateurs dont le numéro de
        build installé est inférieur au build recommandé. 0 désactive le bandeau.
      </p>

      <p
        v-if="error" data-test="app-update-error" role="alert"
        class="mt-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <p v-if="loading && !state" data-test="app-update-loading" class="mt-3 text-sm text-text-muted">Chargement…</p>

      <button
        v-if="loadFailed && !state" type="button" data-test="app-update-retry"
        class="mt-3 rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.97]"
        @click="load"
      >Réessayer</button>

      <template v-if="state">
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p class="text-sm text-text-muted">Build recommandé actuel</p>
            <p data-test="app-update-current" class="font-display text-4xl font-semibold tabular-nums">
              {{ state.recommendedBuild }}
            </p>
            <p v-if="state.recommendedBuild === 0" data-test="app-update-disabled" class="text-xs text-text-muted">
              Bandeau désactivé
            </p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Build minimal supporté (lecture seule)</p>
            <p data-test="app-update-min" class="font-display text-4xl font-semibold tabular-nums text-text-muted">
              {{ state.minSupportedBuild }}
            </p>
            <p class="text-xs text-text-muted">Verrou de version minimale, non modifiable ici.</p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-end gap-2">
          <label class="block text-sm text-text-muted">
            Nouveau build recommandé
            <input
              v-model="input" data-test="app-update-input" type="number" inputmode="numeric"
              :min="BUILD_MIN" :max="BUILD_MAX" step="1" :disabled="busy"
              class="mt-1 block w-40 rounded-btn border border-border bg-bg p-2 text-sm text-text tabular-nums disabled:opacity-40"
            >
          </label>
          <button
            type="button" data-test="app-update-save" :disabled="!canSave"
            class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40"
            @click="confirmOpen = true"
          >{{ busy ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>

        <p v-if="invalid" data-test="app-update-invalid" class="mt-2 text-xs text-danger">
          Saisis un nombre entier entre {{ BUILD_MIN }} et {{ BUILD_MAX }}.
        </p>
        <p
          v-if="lowering" data-test="app-update-lowering" role="status"
          class="mt-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
        >{{ loweringMessage }}</p>
      </template>

      <div data-test="app-update-help" class="mt-5 rounded-btn border border-border bg-bg px-3 py-2 text-sm text-text-muted text-pretty">
        <p class="font-semibold text-text">Quand régler cette valeur ?</p>
        <p class="mt-1">
          À régler APRÈS la publication de la version sur l’App Store et Google Play, avec le numéro
          de build de cette version (ex. 1082 pour la 1.0.6). Avant la publication, le bandeau
          enverrait les gens vers un store qui n’a pas encore la version.
        </p>
        <p class="mt-1">
          La valeur est lue au prochain lancement de l’app (délai de lecture de 60 minutes par défaut).
        </p>
      </div>
    </template>

    <ConfirmActionDialog
      :open="confirmOpen"
      title="Changer le build recommandé ?"
      :message="confirmMessage"
      confirm-label="Enregistrer"
      confirm-tone="primary"
      @confirm="confirmSave" @cancel="confirmOpen = false"
    />
  </section>
</template>
