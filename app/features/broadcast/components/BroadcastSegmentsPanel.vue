<script setup lang="ts">
import { ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import type { BroadcastSegment } from '@/features/broadcast/types/index'

defineProps<{ segments: BroadcastSegment[]; loading?: boolean; error?: string | null }>()
const emit = defineEmits<{
  rename: [segment: BroadcastSegment, name: string]
  'edit-rule': [segment: BroadcastSegment]
  remove: [id: string]
}>()

const renamingId = ref<string | null>(null)
const draftName = ref('')
const toDelete = ref<BroadcastSegment | null>(null)

function startRename(s: BroadcastSegment) {
  renamingId.value = s.id
  draftName.value = s.name
}
function saveRename(s: BroadcastSegment) {
  const name = draftName.value.trim()
  if (!name || name === s.name) return
  emit('rename', s, name)
  renamingId.value = null
}
function confirmDelete() {
  if (toDelete.value) emit('remove', toDelete.value.id)
  toDelete.value = null
}

const btn = 'whitespace-nowrap rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-40'
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR')
</script>

<template>
  <section class="rounded-card border border-border bg-surface p-6" aria-labelledby="segments-title">
    <h2 id="segments-title" class="font-display text-lg font-semibold mb-3 text-balance">Segments enregistrés</h2>

    <p v-if="error" data-test="segments-error" role="alert" class="mb-3 text-sm text-danger">{{ error }}</p>
    <p v-if="loading" class="text-sm text-text-muted">Chargement…</p>
    <p v-else-if="segments.length === 0" data-test="segments-empty" class="text-sm text-text-muted text-pretty">
      Aucun segment pour le moment. Construisez une cible, puis enregistrez-la pour la réutiliser.
    </p>

    <ul v-else class="divide-y divide-border">
      <li v-for="s in segments" :key="s.id" :data-test="`segment-row-${s.id}`" class="flex flex-wrap items-center gap-3 py-3">
        <div class="min-w-0 flex-1">
          <template v-if="renamingId === s.id">
            <input
              v-model="draftName" :data-test="`rename-input-${s.id}`" type="text" maxlength="80"
              :aria-label="`Nouveau nom du segment ${s.name}`"
              class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
              @keydown.enter.prevent="saveRename(s)" @keydown.esc.stop="renamingId = null"
            >
          </template>
          <template v-else>
            <p class="truncate font-medium">{{ s.name }}</p>
            <p v-if="s.description" class="truncate text-sm text-text-muted">{{ s.description }}</p>
            <p class="text-xs text-text-muted tabular-nums">Modifié le {{ fmt(s.updatedAt) }}</p>
          </template>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <template v-if="renamingId === s.id">
            <button
              type="button" :data-test="`rename-save-${s.id}`" :class="btn"
              :disabled="!draftName.trim() || draftName.trim() === s.name" @click="saveRename(s)"
            >Enregistrer</button>
            <button type="button" :data-test="`rename-cancel-${s.id}`" :class="btn" @click="renamingId = null">Annuler</button>
          </template>
          <template v-else>
            <button type="button" :data-test="`rename-${s.id}`" :class="btn" :aria-label="`Renommer ${s.name}`" @click="startRename(s)">Renommer</button>
            <button type="button" :data-test="`edit-rule-${s.id}`" :class="btn" :aria-label="`Modifier la règle de ${s.name}`" @click="emit('edit-rule', s)">Modifier la règle</button>
            <button
              type="button" :data-test="`delete-${s.id}`" :aria-label="`Supprimer ${s.name}`"
              :class="[btn, 'text-danger']" @click="toDelete = s"
            >Supprimer</button>
          </template>
        </div>
      </li>
    </ul>

    <ConfirmActionDialog
      :open="toDelete !== null"
      title="Supprimer le segment"
      :message="`Le segment « ${toDelete?.name ?? ''} » ne sera plus proposé. L’historique des envois déjà partis garde sa règle.`"
      confirm-label="Supprimer"
      @confirm="confirmDelete"
      @cancel="toDelete = null"
    />
  </section>
</template>
