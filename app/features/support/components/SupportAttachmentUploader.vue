<script setup lang="ts">
import { ref, computed } from 'vue'
import { supportService } from '@/features/support/services/supportService'

const MAX_ITEMS = 4

type ItemStatus = 'uploading' | 'ready' | 'error'

interface UploadItem {
  id: string
  file: File
  status: ItemStatus
  key?: string
  previewUrl: string
}

const emit = defineEmits<{
  change: [keys: string[]]
  busy: [value: boolean]
}>()

const items = ref<UploadItem[]>([])
const inputRef = ref<HTMLInputElement | null>(null)

const readyKeys = computed(() =>
  items.value.filter(i => i.status === 'ready' && i.key).map(i => i.key!),
)

const isFull = computed(() => items.value.length >= MAX_ITEMS)

const uploadingCount = ref(0)

function triggerBusy(delta: number) {
  uploadingCount.value += delta
  emit('busy', uploadingCount.value > 0)
}

async function handleFiles(files: File[]) {
  const remaining = MAX_ITEMS - items.value.length
  const toProcess = files.slice(0, remaining)

  for (const file of toProcess) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const previewUrl = URL.createObjectURL(file)
    const item: UploadItem = { id, file, status: 'uploading', previewUrl }
    items.value.push(item)

    triggerBusy(+1)
    supportService.uploadAttachment(file).then((result) => {
      const found = items.value.find(i => i.id === id)
      if (found) {
        found.status = 'ready'
        found.key = result.key
      }
      emit('change', readyKeys.value)
    }).catch(() => {
      const found = items.value.find(i => i.id === id)
      if (found) {
        found.status = 'error'
      }
      emit('change', readyKeys.value)
    }).finally(() => {
      triggerBusy(-1)
    })
  }
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  handleFiles(Array.from(input.files))
  // Reset so same file can be re-selected after removal
  input.value = ''
}

function removeItem(id: string) {
  const item = items.value.find(i => i.id === id)
  if (item) {
    URL.revokeObjectURL(item.previewUrl)
    items.value = items.value.filter(i => i.id !== id)
    emit('change', readyKeys.value)
  }
}

function openPicker() {
  inputRef.value?.click()
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <!-- Vignettes -->
    <div
      v-for="item in items"
      :key="item.id"
      class="relative h-16 w-16 flex-shrink-0 rounded-md border border-border overflow-hidden"
    >
      <img
        :src="item.previewUrl"
        :alt="item.file.name"
        class="h-full w-full object-cover"
        :class="{ 'opacity-40': item.status === 'uploading' || item.status === 'error' }"
      >
      <!-- Indicateur de statut -->
      <div
        v-if="item.status === 'uploading'"
        class="absolute inset-0 flex items-center justify-center"
        aria-label="Envoi en cours"
      >
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
      <div
        v-else-if="item.status === 'error'"
        class="absolute inset-0 flex items-center justify-center bg-danger/20"
      >
        <span class="text-xs font-bold text-danger">!</span>
      </div>
      <!-- Bouton de retrait -->
      <button
        type="button"
        data-testid="remove-item"
        class="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
        aria-label="Retirer cette image"
        @click="removeItem(item.id)"
      >
        <span class="text-[10px] leading-none">x</span>
      </button>
    </div>

    <!-- Bouton d'ajout -->
    <button
      v-if="!isFull"
      type="button"
      data-testid="add-image-btn"
      class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border text-text-muted hover:border-primary hover:text-primary"
      aria-label="Ajouter une image"
      @click="openPicker"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
    </button>

    <!-- Indicateur plafond atteint (bouton desactive) -->
    <button
      v-else
      type="button"
      data-testid="add-image-btn"
      disabled
      class="flex h-16 w-16 flex-shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-dashed border-border opacity-30"
      aria-label="Limite de 4 images atteinte"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
    </button>

    <!-- Input file cache -->
    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onInputChange"
    >
  </div>
</template>
