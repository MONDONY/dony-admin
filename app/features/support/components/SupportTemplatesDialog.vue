<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { templateError, TEMPLATE_CONTENT_MAX, TEMPLATE_LABEL_MAX } from '@/features/support/lib/supportWorkbench'
import type { SupportReplyTemplate } from '@/features/support/types/index'

/**
 * Gestion des réponses types : la liste, avec modifier et supprimer, et l'ajout d'une nouvelle. Le
 * serveur fait foi : la liste est relue après chaque geste par l'appelant, qui dit si le geste a abouti.
 */
const props = withDefaults(defineProps<{
  open: boolean
  templates: SupportReplyTemplate[]
  busy?: boolean
  error?: string | null
}>(), { busy: false, error: null })
const emit = defineEmits<{
  close: []
  create: [label: string, content: string]
  update: [id: string, label: string, content: string]
  remove: [id: string]
}>()
useEscapeClose(() => { if (props.open) emit('close') })

/** `null` = ajout d'une nouvelle réponse ; un identifiant = modification de celle-là. */
const editing = ref<string | null | undefined>(undefined)
const label = ref('')
const content = ref('')
const confirmingRemove = ref<string | null>(null)
const problem = computed(() => (label.value || content.value ? templateError(label.value, content.value) : null))
const canSave = computed(() => !props.busy && !templateError(label.value, content.value))

watch(() => props.open, (o) => { if (!o) cancel() })
// Une liste qui change après un geste réussi referme le formulaire.
watch(() => props.templates, () => { if (!props.error) cancel() })

function startNew() { editing.value = null; label.value = ''; content.value = '' }
function startEdit(t: SupportReplyTemplate) { editing.value = t.id; label.value = t.label; content.value = t.content }
function cancel() { editing.value = undefined; label.value = ''; content.value = ''; confirmingRemove.value = null }
function save() {
  if (!canSave.value) return
  if (editing.value === null) emit('create', label.value.trim(), content.value.trim())
  else if (typeof editing.value === 'string') emit('update', editing.value, label.value.trim(), content.value.trim())
}
function remove(id: string) {
  if (confirmingRemove.value !== id) { confirmingRemove.value = id; return }
  confirmingRemove.value = null
  emit('remove', id)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
    <div
      data-test="templates-dialog" role="dialog" aria-modal="true" aria-labelledby="templates-title"
      class="flex max-h-[85vh] w-full max-w-xl flex-col rounded-card bg-surface p-6 shadow-[0_0_0_1px_rgb(var(--border-rgb)),0_12px_32px_rgba(0,0,0,0.18)]"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="templates-title" class="font-display text-lg font-semibold text-balance">Réponses types</h2>
          <p class="mt-1 text-sm text-text-muted text-pretty">Proposées à tous les agents au-dessus de la zone de réponse. Les modifications valent pour tout le monde.</p>
        </div>
        <button type="button" data-test="templates-close" class="rounded-btn px-2 py-1 text-sm text-text-muted hover:text-text" aria-label="Fermer" @click="emit('close')">✕</button>
      </div>

      <ul class="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" data-test="templates-list">
        <li v-for="t in templates" :key="t.id" class="rounded-btn border border-border p-3" :data-test="`template-${t.id}`">
          <template v-if="editing === t.id">
            <label :for="`tl-${t.id}`" class="sr-only">Libellé</label>
            <input :id="`tl-${t.id}`" v-model="label" data-test="template-label" :maxlength="TEMPLATE_LABEL_MAX" class="w-full rounded-btn border border-border bg-bg px-2 py-1.5 text-sm">
            <label :for="`tc-${t.id}`" class="sr-only">Texte</label>
            <textarea :id="`tc-${t.id}`" v-model="content" data-test="template-content" rows="4" :maxlength="TEMPLATE_CONTENT_MAX" class="mt-2 w-full rounded-btn border border-border bg-bg p-2 text-sm" />
          </template>
          <template v-else>
            <p class="text-sm font-semibold">{{ t.label }}</p>
            <p class="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-text-muted">{{ t.content }}</p>
            <div class="mt-2 flex gap-3 text-xs">
              <button type="button" :data-test="`template-edit-${t.id}`" :disabled="busy" class="text-primary hover:underline" @click="startEdit(t)">Modifier</button>
              <button
                type="button" :data-test="`template-remove-${t.id}`" :disabled="busy"
                :class="confirmingRemove === t.id ? 'font-medium text-danger' : 'text-text-muted hover:text-danger'" @click="remove(t.id)"
              >{{ confirmingRemove === t.id ? 'Confirmer la suppression' : 'Supprimer' }}</button>
            </div>
          </template>
        </li>
        <li v-if="templates.length === 0 && editing !== null" data-test="templates-empty" class="text-sm text-text-muted">Aucune réponse type : ajoutez la première.</li>
        <li v-if="editing === null" class="rounded-btn border border-primary/40 p-3" data-test="template-new-form">
          <label for="tl-new" class="sr-only">Libellé</label>
          <input id="tl-new" v-model="label" data-test="template-label" placeholder="Libellé (ex. Clôture)" :maxlength="TEMPLATE_LABEL_MAX" class="w-full rounded-btn border border-border bg-bg px-2 py-1.5 text-sm">
          <label for="tc-new" class="sr-only">Texte</label>
          <textarea id="tc-new" v-model="content" data-test="template-content" rows="4" placeholder="Texte inséré dans la réponse" :maxlength="TEMPLATE_CONTENT_MAX" class="mt-2 w-full rounded-btn border border-border bg-bg p-2 text-sm" />
        </li>
      </ul>

      <p v-if="problem" data-test="template-problem" class="mt-2 text-xs text-warning">{{ problem }}</p>
      <p v-if="error" data-test="templates-error" role="alert" class="mt-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>

      <div class="mt-4 flex justify-end gap-2">
        <template v-if="editing !== undefined">
          <button type="button" data-test="template-cancel" class="rounded-btn border border-border px-4 py-2 text-sm hover:bg-surface-elevated" @click="cancel">Annuler</button>
          <button
            type="button" data-test="template-save" :disabled="!canSave"
            class="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40" @click="save"
          >{{ busy ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </template>
        <button
          v-else type="button" data-test="template-new"
          class="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90" @click="startNew"
        >Nouvelle réponse type</button>
      </div>
    </div>
  </div>
</template>
