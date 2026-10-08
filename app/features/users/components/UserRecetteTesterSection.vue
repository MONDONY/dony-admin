<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRecetteTester } from '@/features/users/composables/useRecetteTester'

/**
 * Section « Mode recette (staging) » de la fiche utilisateur (yadony-back#449). Montée par
 * la fiche seulement pour un super-admin (ADMIN_MANAGE) ; en prod elle se réduit à une ligne
 * discrète, et elle disparaît si la lecture échoue.
 */
const props = defineProps<{ userId: string }>()
const recette = useRecetteTester(props.userId)
const { status, busy, feedback, availability } = recette

/** Valeur demandée, en attente de confirmation ; null hors confirmation. */
const pendingValue = ref<boolean | null>(null)
const checked = computed(() => status.value?.recetteTester ?? false)

function onToggle() {
  if (busy.value) return
  pendingValue.value = !checked.value
}
async function confirmToggle() {
  const next = pendingValue.value
  pendingValue.value = null
  if (next === null) return
  await recette.setEnabled(next)
}

onMounted(() => { void recette.load() })
onBeforeUnmount(recette.dispose)
</script>

<template>
  <section
    v-if="availability !== 'hidden'" data-test="recette-section"
    class="mt-6 rounded-card border border-border p-4"
    :aria-busy="availability === 'loading' || busy"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-balance">Mode recette (staging)</h3>
      <span
        v-if="availability === 'open' && checked" data-test="recette-badge"
        class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
      >Testeur</span>
    </div>

    <p v-if="availability === 'loading'" data-test="recette-loading" class="mt-2 text-xs text-text-muted">Chargement…</p>

    <p v-else-if="availability === 'closed'" data-test="recette-closed" class="mt-2 text-xs text-text-muted">
      Indisponible hors staging.
    </p>

    <template v-else>
      <div class="mt-3 flex items-center justify-between gap-4">
        <label :for="`recette-switch-${userId}`" class="text-sm">Compte testeur</label>
        <button
          :id="`recette-switch-${userId}`" type="button" role="switch" data-test="recette-switch"
          :aria-checked="checked" :disabled="busy || pendingValue !== null"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-[background-color,scale] duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 before:absolute before:-inset-2 before:content-['']"
          :class="checked ? 'bg-primary' : 'bg-border'"
          @click="onToggle"
        >
          <span
            aria-hidden="true"
            class="inline-block size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
            :class="checked ? 'translate-x-[22px]' : 'translate-x-0.5'"
          />
        </button>
      </div>
      <p class="mt-2 text-xs text-text-muted text-pretty">
        Permet à ce compte, en staging uniquement, de valider une remise avant le départ du trajet et d’être destinataire de son propre colis. Chaque utilisation est tracée.
      </p>
      <p v-if="busy" data-test="recette-busy" class="mt-2 text-xs text-text-muted">Enregistrement…</p>

      <div
        v-if="pendingValue !== null" data-test="recette-confirm"
        class="mt-3 rounded-btn bg-surface-elevated px-3 py-2 text-sm"
      >
        <p class="text-pretty">
          {{ pendingValue ? 'Désigner ce compte comme testeur de recette ?' : 'Retirer le statut de testeur à ce compte ?' }}
        </p>
        <div class="mt-2 flex justify-end gap-2">
          <button
            type="button" data-test="recette-cancel"
            class="rounded-btn border border-border px-3 py-1.5 text-xs transition-[background-color,scale] hover:bg-surface active:scale-[0.96]"
            @click="pendingValue = null"
          >Annuler</button>
          <button
            type="button" data-test="recette-confirm-button"
            class="rounded-btn bg-primary px-3 py-1.5 text-xs text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96]"
            @click="confirmToggle"
          >{{ pendingValue ? 'Activer' : 'Désactiver' }}</button>
        </div>
      </div>
    </template>

    <p
      v-if="feedback" data-test="recette-feedback" :role="feedback.tone === 'error' ? 'alert' : 'status'"
      class="mt-3 rounded-btn border px-3 py-2 text-xs text-pretty"
      :class="feedback.tone === 'success'
        ? 'border-success/40 bg-success/10 text-success'
        : 'border-danger/40 bg-danger/10 text-danger'"
    >{{ feedback.text }}</p>
  </section>
</template>
