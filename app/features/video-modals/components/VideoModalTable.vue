<script setup lang="ts">
import ActiveSwitch from '@/features/video-modals/components/ActiveSwitch.vue'
import VideoModalStats from '@/features/video-modals/components/VideoModalStats.vue'
import { AUDIENCE_LABELS, TRIGGER_SHORT_LABELS, type AdminVideoModal } from '@/features/video-modals/types/index'

defineProps<{ items: AdminVideoModal[]; busy?: boolean }>()
const emit = defineEmits<{
  'toggle-active': [modal: AdminVideoModal, active: boolean]
  'new-version': [modal: AdminVideoModal]
  remove: [modal: AdminVideoModal]
}>()

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : null)
const triggers = (m: AdminVideoModal) => (m.triggers ?? []).map(t => TRIGGER_SHORT_LABELS[t] ?? t)
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border">
    <table class="w-full text-sm">
      <thead class="border-b border-border text-left text-text-muted">
        <tr>
          <th class="px-4 py-3 font-medium">Nom</th>
          <th class="px-4 py-3 font-medium">Actif</th>
          <th class="px-4 py-3 font-medium">Déclencheurs</th>
          <th class="px-4 py-3 font-medium">Version</th>
          <th class="px-4 py-3 font-medium">Résultats</th>
          <th class="px-4 py-3 font-medium"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in items" :key="m.id" :data-test="`vm-row-${m.id}`" class="border-b border-border align-top last:border-0">
          <td class="px-4 py-3">
            <NuxtLink :to="`/modals-video/${m.id}`" class="font-semibold hover:text-primary hover:underline">{{ m.name || m.titleFr }}</NuxtLink>
            <span class="block text-xs text-text-muted">{{ m.titleFr }}</span>
          </td>
          <td class="px-4 py-3">
            <ActiveSwitch
              :model-value="m.active" :disabled="busy" :label="m.active ? `Désactiver ${m.name}` : `Activer ${m.name}`"
              @update:model-value="(v: boolean) => emit('toggle-active', m, v)"
            />
          </td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap gap-1">
              <span v-for="t in triggers(m)" :key="t" class="whitespace-nowrap rounded-full bg-surface-elevated px-2 py-0.5 text-xs">{{ t }}</span>
            </div>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="font-semibold tabular-nums">v{{ m.version }}</span>
            <span v-if="fmtDate(m.versionPublishedAt)" class="text-xs text-text-muted"> · {{ fmtDate(m.versionPublishedAt) }}</span>
            <span class="block text-xs text-text-muted">{{ AUDIENCE_LABELS[m.audience]?.label ?? m.audience }}</span>
          </td>
          <td class="px-4 py-3"><VideoModalStats :stats="m.stats" compact /></td>
          <td class="px-4 py-3">
            <div class="flex justify-end gap-1">
              <NuxtLink
                :to="`/modals-video/${m.id}`" :data-test="`vm-edit-${m.id}`"
                class="whitespace-nowrap rounded-btn px-2.5 py-1.5 text-sm hover:bg-surface-elevated"
              >Modifier</NuxtLink>
              <button
                type="button" :data-test="`vm-version-${m.id}`" :disabled="busy"
                class="whitespace-nowrap rounded-btn px-2.5 py-1.5 text-sm text-primary hover:bg-primary/10 disabled:opacity-40"
                @click="emit('new-version', m)"
              >Nouvelle version</button>
              <button
                type="button" :data-test="`vm-remove-${m.id}`" :disabled="busy"
                class="whitespace-nowrap rounded-btn px-2.5 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-40"
                @click="emit('remove', m)"
              >Supprimer</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
