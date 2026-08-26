<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { impactLabel, DELETION_REASONS } from '@/features/users/impactLabels'
import { deletionConfirmationPhrase } from '@/features/users/deletionTarget'
import type {
  AdminDeletionReasonCode, DeletionImpact, ImpactFinding,
} from '@/features/users/types/index'

const props = defineProps<{
  open: boolean
  user: { id: string; firstName: string | null; lastName: string | null; email: string | null }
  impact: DeletionImpact | null
  isLoading: boolean
  busy: boolean
  error: string | null
}>()
const emit = defineEmits<{ confirm: [AdminDeletionReasonCode, string]; cancel: [] }>()

const reasonCode = ref<AdminDeletionReasonCode | ''>('')
const reason = ref('')
const confirmation = ref('')

/* Réinitialise les champs à chaque ouverture */
watch(() => props.open, (o) => {
  if (o) { reasonCode.value = ''; reason.value = ''; confirmation.value = '' }
})

const phrase = computed(() => deletionConfirmationPhrase(props.user))

const bySeverity = (s: string): ImpactFinding[] =>
  props.impact?.findings.filter(f => f.severity === s) ?? []

const canConfirm = computed(() =>
  reasonCode.value !== ''
  && reason.value.trim().length > 0
  && confirmation.value.trim() === phrase.value.trim()
  && !props.busy,
)

function onConfirm() {
  if (canConfirm.value) emit('confirm', reasonCode.value as AdminDeletionReasonCode, reason.value)
}
</script>

<template>
  <!--
    Backdrop : transition CSS interruptible (principe Interruptible Animations).
    Opacity seul sur le fond pour ne pas perturber le positionnement.
  -->
  <Transition name="backdrop">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      @click.self="emit('cancel')"
    >
      <!--
        Carte : transition d'entrée/sortie combinée opacity + translateY (Split & Stagger non
        applicable ici car c'est une carte unique, mais on anime la carte elle-même).
        Rayon extérieur : rounded-2xl (16px). Padding interne 0 — les sections portent leur propre
        padding. Ombre multi-couches (Shadows over Borders).
      -->
      <Transition name="dialog">
        <div
          v-if="open"
          class="
            flex max-h-[90vh] w-full max-w-lg flex-col
            rounded-2xl overflow-hidden
            bg-surface
            shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_4px_16px_-2px_rgba(0,0,0,0.12),0px_16px_48px_0px_rgba(0,0,0,0.08)]
          "
        >
          <!-- En-tête — séparateur par border-b (divider, pas depth) -->
          <header class="border-b border-border px-6 py-4">
            <!--
              text-wrap: balance sur le titre (principe Typography).
              antialiased appliqué sur body globalement — hérité ici.
            -->
            <h2 class="font-display text-lg font-semibold [text-wrap:balance]">
              Supprimer définitivement ce compte
            </h2>
            <p class="mt-0.5 text-sm text-text-muted [text-wrap:pretty]">
              Le compte sera anonymisé et banni. Cette action est irréversible.
            </p>
          </header>

          <!-- Corps scrollable -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <p v-if="isLoading" class="text-sm text-text-muted">Analyse en cours…</p>

            <template v-else-if="impact">
              <!-- Constats BLOCKING — rayon interne rounded-lg (concentric: 2xl card → lg blocs) -->
              <section v-if="bySeverity('BLOCKING').length" class="mb-5">
                <h3 class="mb-2 text-sm font-semibold text-danger">
                  Suppression impossible en l'état
                </h3>
                <div
                  v-for="f in bySeverity('BLOCKING')"
                  :key="f.code"
                  :data-test="`finding-${f.code}`"
                  class="mb-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5"
                >
                  <p class="text-sm font-medium text-danger">
                    {{ impactLabel(f.code).title }}<span v-if="f.count > 1" class="tabular-nums"> ({{ f.count }})</span>
                  </p>
                  <p class="mt-0.5 text-xs text-text-muted [text-wrap:pretty]">
                    {{ impactLabel(f.code).detail }}
                  </p>
                </div>
              </section>

              <!-- Constats WARNING avec contreparties -->
              <section v-if="bySeverity('WARNING').length" class="mb-5">
                <h3 class="mb-2 text-sm font-semibold text-warning">
                  Conséquences sur d'autres comptes
                </h3>
                <details
                  v-for="f in bySeverity('WARNING')"
                  :key="f.code"
                  :data-test="`finding-${f.code}`"
                  class="mb-2 rounded-lg border border-border px-3 py-2.5 open:pb-3"
                >
                  <summary class="cursor-pointer select-none text-sm font-medium">
                    {{ impactLabel(f.code).title }}
                    <span class="tabular-nums text-text-muted"> — {{ f.count }}</span>
                  </summary>
                  <p class="mt-1.5 text-xs text-text-muted [text-wrap:pretty]">
                    {{ impactLabel(f.code).detail }}
                  </p>
                  <ul v-if="f.parties.length" class="mt-2 space-y-1">
                    <li v-for="p in f.parties" :key="p.userId">
                      <!--
                        Lien vers la fiche dans un nouvel onglet : l'administrateur prévient
                        quelqu'un sans perdre l'écran de suppression en cours.
                        min-h-[40px] pour respecter la surface minimale WCAG (Minimum Hit Area).
                      -->
                      <a
                        :href="`/siragbe/users?query=${p.userId}`"
                        target="_blank"
                        rel="noopener"
                        :data-test="`party-${p.userId}`"
                        class="inline-flex min-h-[40px] items-center text-sm text-primary hover:underline"
                      >{{ p.displayName }}</a>
                    </li>
                  </ul>
                </details>
              </section>

              <!-- Constats INFO — discrets -->
              <details v-if="bySeverity('INFO').length" class="mb-2 text-sm text-text-muted">
                <summary class="cursor-pointer select-none">Informations complémentaires</summary>
                <p
                  v-for="f in bySeverity('INFO')"
                  :key="f.code"
                  :data-test="`finding-${f.code}`"
                  class="mt-1 text-xs [text-wrap:pretty]"
                >
                  {{ impactLabel(f.code).title }} —
                  <span class="tabular-nums">{{ f.count }}</span>.
                  {{ impactLabel(f.code).detail }}
                </p>
              </details>
            </template>

            <!--
              Zone de confirmation : absente du DOM si un constat bloque.
              Un obstacle doit se lire comme un obstacle — pas une confirmation grisée.
            -->
            <div
              v-if="impact && !impact.blocked"
              data-test="deletion-confirm-zone"
              class="mt-4 space-y-3 border-t border-border pt-4"
            >
              <!-- Motif -->
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted">Motif</label>
                <select
                  v-model="reasonCode"
                  data-test="deletion-reason-code"
                  class="w-full rounded-lg border border-border bg-bg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="" disabled>Choisir un motif…</option>
                  <option
                    v-for="r in DELETION_REASONS"
                    :key="r.value"
                    :value="r.value"
                  >{{ r.label }}</option>
                </select>
              </div>

              <!-- Détail du motif -->
              <textarea
                v-model="reason"
                data-test="deletion-reason"
                rows="3"
                placeholder="Détail du motif (obligatoire, conservé dans le journal d'audit)"
                class="w-full rounded-lg border border-border bg-bg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />

              <!-- Phrase de confirmation -->
              <div>
                <label class="mb-1 block text-xs font-medium text-text-muted">
                  Saisissez « {{ phrase }} » pour confirmer
                </label>
                <input
                  v-model="confirmation"
                  data-test="deletion-confirmation-input"
                  type="text"
                  autocomplete="off"
                  class="w-full rounded-lg border border-border bg-bg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
              </div>
            </div>

            <!-- Message d'erreur renvoyé par le back -->
            <p
              v-if="error"
              data-test="deletion-error"
              class="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger [text-wrap:pretty]"
            >{{ error }}</p>
          </div>

          <!-- Pied de page -->
          <footer class="flex justify-end gap-2 border-t border-border px-6 py-4">
            <!--
              active:scale-[0.96] : retour tactile sur les boutons (Scale on Press).
              transition-[transform,opacity] ciblé, jamais transition-all (No transition: all).
            -->
            <button
              type="button"
              data-test="deletion-cancel"
              class="
                min-h-[40px] rounded-lg border border-border px-4 py-2 text-sm
                transition-[transform,box-shadow] duration-150 ease-out
                hover:bg-surface-elevated
                active:scale-[0.96]
              "
              @click="emit('cancel')"
            >Annuler</button>

            <button
              v-if="impact && !impact.blocked"
              type="button"
              data-test="deletion-confirm"
              :disabled="!canConfirm"
              class="
                min-h-[40px] rounded-lg bg-danger px-4 py-2 text-sm text-white
                transition-[transform,opacity] duration-150 ease-out
                hover:bg-danger/90
                active:not-disabled:scale-[0.96]
                disabled:opacity-40 disabled:cursor-not-allowed
              "
              @click="onConfirm"
            >Supprimer définitivement</button>
          </footer>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/*
 * Transition backdrop : fondu simple, interruptible (CSS transition).
 * Durée d'entrée 200ms, sortie 150ms (Exit subtler than enter).
 */
.backdrop-enter-active {
  transition: opacity 200ms ease-out;
}
.backdrop-leave-active {
  transition: opacity 150ms ease-in;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/*
 * Transition carte : combinaison opacity + translateY (enter/exit split).
 * Entrée : 250ms ease-out depuis y+12px.
 * Sortie : 150ms ease-in vers y-8px (plus subtile, ne vole pas l'attention).
 */
.dialog-enter-active {
  transition: opacity 250ms ease-out, transform 250ms ease-out;
}
.dialog-leave-active {
  transition: opacity 150ms ease-in, transform 150ms ease-in;
}
.dialog-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.dialog-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
