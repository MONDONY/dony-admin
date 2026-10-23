<script setup lang="ts">
import { computed, watch } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import ShortcutsHelp from '@/components/layout/ShortcutsHelp.vue'
import { backTarget, buildCrumbs, canGoBackInApp } from '@/components/layout/breadcrumb'
import { useBreadcrumbLabel } from '@/composables/useBreadcrumbLabel'
import { useGlobalShortcuts } from '@/composables/useShortcuts'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const crumbLabel = useBreadcrumbLabel()
const meta = computed(() => ({
  title: (route.meta.pageTitle as string) ?? 'Yadony ADMIN',
  subtitle: route.meta.pageSubtitle as string | undefined,
  crumbs: buildCrumbs(route.path, route.meta.pageTitle as string | undefined, crumbLabel.label.value),
  backTo: backTarget(route.path),
}))
// Le libellé d'une fiche (nom de l'utilisateur) ne doit pas déborder sur la page suivante.
watch(() => route.path, () => crumbLabel.clear())

// « Retour » : l'écran précédent de l'admin quand il existe (garde filtres et onglets), sinon la liste parente.
function goBack() {
  const fallback = meta.value.backTo
  if (canGoBackInApp(window.history.state, route.path)) router.back()
  else if (fallback) void router.push(fallback)
}

useGlobalShortcuts({ navigate: to => router.push(to), can: p => auth.can(p) })
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <AppTopbar :title="meta.title" :subtitle="meta.subtitle" :crumbs="meta.crumbs" :back-to="meta.backTo" @back="goBack" />
      <main class="flex-1 overflow-y-auto p-6">
        <slot />
      </main>
    </div>
    <ClientOnly><ShortcutsHelp /></ClientOnly>
  </div>
</template>
