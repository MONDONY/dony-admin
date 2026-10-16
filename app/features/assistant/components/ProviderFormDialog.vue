<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { assistantProviderService } from '@/features/assistant/services/assistantProviderService'
import { PROVIDER_TEMPLATES, type AdminProvider } from '@/features/assistant/types'
import { extractProblemMessage } from '@/lib/problemDetail'
import { httpStatus, violationsByField } from '@/lib/violations'

const props = defineProps<{ open: boolean; provider: AdminProvider | null }>()
const emit = defineEmits<{ close: []; saved: [provider: AdminProvider] }>()

const baseId = useId()
const SHOWN_FIELDS = ['name', 'baseUrl', 'model', 'apiKey', 'dailyRequestLimit'] as const

const template = ref('')
const name = ref('')
const baseUrl = ref('')
const model = ref('')
const apiKey = ref('')
const limit = ref('')
const supportsJsonMode = ref(true)
const sending = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

const isEdit = computed(() => props.provider !== null)
const canSend = computed(() =>
  !sending.value && name.value.trim() !== '' && baseUrl.value.trim() !== '' && model.value.trim() !== ''
  && (isEdit.value || apiKey.value.trim() !== ''))

watch(() => [props.open, props.provider] as const, ([open, p]) => {
  if (!open) return
  template.value = ''
  name.value = p?.name ?? ''
  baseUrl.value = p?.baseUrl ?? ''
  model.value = p?.model ?? ''
  apiKey.value = ''
  limit.value = p?.dailyRequestLimit != null ? String(p.dailyRequestLimit) : ''
  supportsJsonMode.value = p?.supportsJsonMode ?? true
  error.value = null
  fieldErrors.value = {}
}, { immediate: true })

watch(template, (label) => {
  const t = PROVIDER_TEMPLATES.find((x) => x.label === label)
  if (!t) return
  if (!name.value.trim()) name.value = t.name
  baseUrl.value = t.baseUrl
  model.value = t.model
  supportsJsonMode.value = t.supportsJsonMode
})

function close() {
  if (!sending.value) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

async function send() {
  if (!canSend.value) return
  sending.value = true
  error.value = null
  fieldErrors.value = {}
  // v-model sur un input type="number" livre un nombre dès qu'une valeur est saisie : on normalise en texte.
  const rawLimit = String(limit.value).trim()
  const parsedLimit = rawLimit === '' ? null : Number(rawLimit)
  const payload = {
    name: name.value.trim(), baseUrl: baseUrl.value.trim(), model: model.value.trim(), apiKey: apiKey.value.trim(),
    supportsJsonMode: supportsJsonMode.value, dailyRequestLimit: parsedLimit, enabled: props.provider?.enabled ?? true,
  }
  try {
    const saved = props.provider
      ? await assistantProviderService.update(props.provider.id, payload)
      : await assistantProviderService.create(payload)
    emit('saved', saved)
  } catch (e) {
    const fields = violationsByField(e)
    if (httpStatus(e) === 422 && Object.keys(fields).length > 0) {
      const shown: Record<string, string> = {}
      const other: string[] = []
      for (const [k, v] of Object.entries(fields)) {
        if ((SHOWN_FIELDS as readonly string[]).includes(k)) shown[k] = v
        else other.push(v)
      }
      fieldErrors.value = shown
      error.value = other.length ? other.join(' ') : null
    } else {
      error.value = extractProblemMessage(e, "Impossible d'enregistrer le fournisseur")
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="close">
    <div
      data-test="provider-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${baseId}-title`"
      class="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
      @keydown="onKeydown"
    >
      <h2 :id="`${baseId}-title`" class="font-display text-lg font-semibold text-balance">
        {{ isEdit ? 'Modifier le fournisseur' : 'Ajouter un fournisseur' }}
      </h2>
      <p class="mb-4 text-sm text-text-muted text-pretty">
        Tout fournisseur compatible OpenAI.{{ isEdit ? '' : ' Placé en dernier dans l’ordre.' }}
      </p>

      <div class="space-y-3">
        <div v-if="!isEdit">
          <label :for="`${baseId}-template`" class="block text-xs text-text-muted">Partir d'un modèle</label>
          <select :id="`${baseId}-template`" v-model="template" data-test="provider-template" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text">
            <option value="">Aucun</option>
            <option v-for="t in PROVIDER_TEMPLATES" :key="t.label" :value="t.label">{{ t.label }}</option>
          </select>
        </div>

        <div>
          <label :for="`${baseId}-name`" class="block text-xs text-text-muted">Nom</label>
          <input :id="`${baseId}-name`" v-model="name" data-test="provider-name" type="text" maxlength="60" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60">
          <p v-if="fieldErrors.name" data-test="provider-field-error-name" class="mt-1 text-xs text-danger">{{ fieldErrors.name }}</p>
        </div>

        <div>
          <label :for="`${baseId}-url`" class="block text-xs text-text-muted">Adresse de l'API</label>
          <input :id="`${baseId}-url`" v-model="baseUrl" data-test="provider-base-url" type="url" placeholder="https://…" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60">
          <p v-if="fieldErrors.baseUrl" data-test="provider-field-error-baseUrl" class="mt-1 text-xs text-danger">{{ fieldErrors.baseUrl }}</p>
        </div>

        <div>
          <label :for="`${baseId}-model`" class="block text-xs text-text-muted">Modèle</label>
          <input :id="`${baseId}-model`" v-model="model" data-test="provider-model" type="text" maxlength="120" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60">
          <p v-if="fieldErrors.model" data-test="provider-field-error-model" class="mt-1 text-xs text-danger">{{ fieldErrors.model }}</p>
        </div>

        <div>
          <label :for="`${baseId}-key`" class="block text-xs text-text-muted">
            Clé d'API<span v-if="isEdit"> (actuelle : ••••{{ provider?.apiKeyLast4 }})</span>
          </label>
          <input :id="`${baseId}-key`" v-model="apiKey" data-test="provider-api-key" type="password" autocomplete="off" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60">
          <p v-if="isEdit" class="mt-1 text-xs text-text-muted">Laisser vide pour garder la clé actuelle. Changer l'adresse demande de ressaisir la clé.</p>
          <p v-if="fieldErrors.apiKey" data-test="provider-field-error-apiKey" class="mt-1 text-xs text-danger">{{ fieldErrors.apiKey }}</p>
        </div>

        <div>
          <label :for="`${baseId}-limit`" class="block text-xs text-text-muted">Limite de requêtes par jour (facultatif)</label>
          <input :id="`${baseId}-limit`" v-model="limit" data-test="provider-limit" type="number" min="1" placeholder="Sans limite" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text tabular-nums disabled:opacity-60">
          <p v-if="fieldErrors.dailyRequestLimit" data-test="provider-field-error-dailyRequestLimit" class="mt-1 text-xs text-danger">{{ fieldErrors.dailyRequestLimit }}</p>
        </div>

        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input v-model="supportsJsonMode" data-test="provider-json" type="checkbox" :disabled="sending" class="size-4">
          Mode JSON pris en charge
        </label>

        <p v-if="error" data-test="provider-error" role="alert" class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button type="button" data-test="provider-cancel" :disabled="sending"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated disabled:opacity-40" @click="close">Annuler</button>
        <button type="button" data-test="provider-submit" :disabled="!canSend"
          class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="send">{{ sending ? 'Enregistrement…' : (isEdit ? 'Enregistrer' : 'Ajouter') }}</button>
      </div>
    </div>
  </div>
</template>
