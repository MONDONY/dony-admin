<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import {
  AFRICA_DEFAULT_CALLING_CODES,
  callingCodeLabel,
  cleanCallingCode,
  countryName,
  newCallingCodeError,
  normalizeCallingCodes,
  parseCallingCodes,
  serializeCallingCodes,
} from '@/features/settings/lib/callingCodes'

/**
 * Édition d'une liste d'indicatifs téléphoniques (réglage de type `CALLING_CODES`) : une puce
 * supprimable par indicatif, avec le nom du pays, et un champ pour en ajouter un. La valeur reste
 * la chaîne du back (`"225,221"`) : le formulaire parent la valide, la compare à la valeur en
 * place et l'envoie telle quelle, par le même chemin que les autres réglages.
 */
const props = defineProps<{ modelValue: string; settingKey: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const codes = computed(() => parseCallingCodes(props.modelValue))
const input = ref('')
const inputError = computed(() => newCallingCodeError(input.value, codes.value))
const candidate = computed(() => cleanCallingCode(input.value))
const canAdd = computed(() => candidate.value !== '' && inputError.value === null)
// Aperçu du pays reconnu, pour qu'une faute de frappe (« 252 » au lieu de « 225 ») se voie avant l'ajout.
const preview = computed(() => (canAdd.value ? countryName(candidate.value) : null))
const isAfricaDefault = computed(
  () => normalizeCallingCodes(props.modelValue) === AFRICA_DEFAULT_CALLING_CODES,
)

// Pendant un appel (`disabled`), les commandes sont désactivées dans le DOM : aucun geste n'arrive ici.
function add() {
  if (!canAdd.value) return
  emit('update:modelValue', serializeCallingCodes([...codes.value, candidate.value]))
  input.value = ''
}
function remove(code: string) {
  emit('update:modelValue', serializeCallingCodes(codes.value.filter((c) => c !== code)))
}
function resetAfrica() {
  emit('update:modelValue', AFRICA_DEFAULT_CALLING_CODES)
}
</script>

<template>
  <div class="space-y-3" :data-test="`calling-codes-${settingKey}`">
    <ul v-if="codes.length" class="flex flex-wrap gap-2" aria-label="Indicatifs bloqués">
      <li
        v-for="code in codes" :key="code" :data-test="`calling-code-chip-${code}`"
        class="inline-flex items-center gap-1 rounded-full border border-border bg-bg py-1 pl-3 pr-1 text-sm"
      >
        <span class="whitespace-nowrap tabular-nums">{{ callingCodeLabel(code) }}</span>
        <button
          type="button" :data-test="`calling-code-remove-${code}`" :disabled="disabled"
          :aria-label="`Retirer ${callingCodeLabel(code)}`"
          class="grid h-6 w-6 place-items-center rounded-full text-text-muted transition-[background-color,color,transform] hover:bg-surface-elevated hover:text-danger active:scale-[0.9] disabled:opacity-40"
          @click="remove(code)"
        >
          <X class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else class="text-sm text-text-muted" data-test="calling-codes-empty">
      Aucun pays bloqué : les SMS partent vers tous les indicatifs.
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-text-muted" aria-hidden="true">+</span>
      <input
        v-model="input" data-test="calling-code-input" type="text" inputmode="numeric" autocomplete="off"
        maxlength="6" placeholder="Indicatif, ex. 225" aria-label="Indicatif à bloquer" :disabled="disabled"
        class="w-40 rounded-btn border border-border bg-bg p-2 text-sm tabular-nums disabled:opacity-40"
        @keydown.enter.prevent="add"
      >
      <button
        type="button" data-test="calling-code-add" :disabled="disabled || !canAdd"
        class="rounded-btn border border-border px-3 py-2 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
        @click="add"
      >Ajouter</button>
      <span v-if="preview" class="text-xs text-text-muted" data-test="calling-code-preview">{{ preview }}</span>
      <button
        v-if="!isAfricaDefault" type="button" data-test="calling-code-reset-africa" :disabled="disabled"
        class="ml-auto whitespace-nowrap text-xs font-medium text-primary hover:underline disabled:opacity-40"
        @click="resetAfrica"
      >Remettre la liste Afrique</button>
    </div>
    <p v-if="inputError" class="text-xs text-danger" role="alert" data-test="calling-code-input-error">{{ inputError }}</p>
  </div>
</template>
