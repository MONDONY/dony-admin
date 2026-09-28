<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import { isUuid, userDisplayName, useUserSearch } from '@/features/broadcast/composables/useUserSearch'
import type { AdminUserListItem } from '@/features/users/types/index'

/**
 * Choix du destinataire d'une notification ciblée : recherche par nom, téléphone ou email
 * (droit USER_VIEW), ou identifiant collé tel quel. `modelValue` est l'identifiant retenu,
 * vide tant qu'aucun compte n'est choisi.
 */
const props = defineProps<{ modelValue: string; canSearch?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const inputId = useId()
const term = ref('')
const selectedName = ref<string | null>(null)
const { results, searching, searched, error, search, resolveName, clear } = useUserSearch()

let timer: ReturnType<typeof setTimeout> | null = null
function cancelTimer() { if (timer) { clearTimeout(timer); timer = null } }
onBeforeUnmount(cancelTimer)

function onInput(e: Event) {
  term.value = (e.target as HTMLInputElement).value
  cancelTimer()
  if (isUuid(term.value)) {
    clear()
    selectedName.value = null
    emit('update:modelValue', term.value.trim())
    return
  }
  if (!props.canSearch) return
  timer = setTimeout(() => { search(term.value) }, 300)
}

function choose(u: AdminUserListItem) {
  cancelTimer()
  selectedName.value = userDisplayName(u)
  clear()
  term.value = ''
  emit('update:modelValue', u.id)
}

function change() {
  selectedName.value = null
  term.value = ''
  emit('update:modelValue', '')
}

// Identifiant reçu de l'extérieur (lien depuis la fiche utilisateur, UUID collé) : on retrouve
// son nom pour que l'admin voie QUI il va notifier, pas seulement un identifiant.
watch(() => props.modelValue, async (id) => {
  if (!id) { selectedName.value = null; return }
  if (selectedName.value || !props.canSearch) return
  const name = await resolveName(id)
  if (props.modelValue === id && name) selectedName.value = name
}, { immediate: true })
</script>

<template>
  <div class="text-sm text-text-muted">
    <label :for="inputId" class="block">Destinataire</label>
    <div
      v-if="modelValue" data-test="broadcast-user-selected"
      class="mt-1 flex items-center justify-between gap-3 rounded-btn border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <span class="min-w-0">
        <span class="block truncate font-medium text-text">{{ selectedName ?? modelValue }}</span>
        <span v-if="selectedName" class="block truncate font-mono text-xs text-text-muted">{{ modelValue }}</span>
      </span>
      <button
        type="button" data-test="broadcast-user-clear" :disabled="disabled"
        class="shrink-0 rounded-btn border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-elevated disabled:opacity-40"
        @click="change"
      >Changer</button>
    </div>
    <template v-else>
      <input
        :id="inputId" data-test="broadcast-user-search" type="search" :value="term" :disabled="disabled"
        autocomplete="off"
        :placeholder="canSearch ? 'Nom, téléphone, email ou identifiant' : 'Identifiant du compte (UUID)'"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-40"
        @input="onInput"
      >
      <p v-if="!canSearch" data-test="broadcast-user-uuid-hint" class="mt-1 text-xs text-pretty">
        Collez l’identifiant du compte : la recherche par nom demande l’accès aux utilisateurs.
      </p>
      <p v-else-if="searching" class="mt-1 text-xs">Recherche…</p>
      <p v-else-if="error" data-test="broadcast-user-search-error" role="alert" class="mt-1 text-xs text-danger">{{ error }}</p>
      <p v-else-if="searched && results.length === 0" data-test="broadcast-user-search-empty" class="mt-1 text-xs">
        Aucun utilisateur ne correspond.
      </p>
      <ul
        v-if="results.length > 0" data-test="broadcast-user-results"
        class="mt-1 overflow-hidden rounded-btn border border-border bg-surface"
      >
        <li v-for="u in results" :key="u.id" class="border-b border-border last:border-0">
          <button
            type="button" :data-test="`broadcast-user-result-${u.id}`"
            class="w-full px-3 py-2 text-left transition-colors hover:bg-surface-elevated"
            @click="choose(u)"
          >
            <span class="block font-medium text-text">{{ userDisplayName(u) }}</span>
            <span class="block text-xs tabular-nums">{{ [u.email, u.phoneNumber].filter(Boolean).join(' · ') }}</span>
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>
