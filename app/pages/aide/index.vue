<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronRight, Lock, Sparkles } from 'lucide-vue-next'
import StateBlock from '@/components/ui/StateBlock.vue'
import HelpSearchBox from '@/features/help-center/components/HelpSearchBox.vue'
import { useHelpAssistant } from '@/features/help-center/composables/useHelpAssistant'
import { useHelpContents } from '@/features/help-center/composables/useHelpContents'
import { useHelpSearch } from '@/features/help-center/composables/useHelpSearch'
import { articleRoute, categoryIcon } from '@/features/help-center/lib/helpCategories'
import { HELP_UNAVAILABLE } from '@/features/help-center/types'

definePageMeta({
  middleware: 'admin-only',
  pageTitle: 'Centre d’aide',
  pageSubtitle: 'Toutes les fonctionnalités de la console, expliquées pas à pas',
})

const route = useRoute()
const router = useRouter()
const help = useHelpContents()
const search = useHelpSearch()
const assistant = useHelpAssistant()
const box = ref<InstanceType<typeof HelpSearchBox> | null>(null)

const searching = computed(() => search.query.value.trim().length > 0)
const noResult = computed(() => searching.value && !search.isLoading.value && !search.error.value
  && search.answeredFor.value !== null && search.results.value.length === 0)

/** La recherche vit dans l'URL (?q=) : lien partageable, retour arrière qui la retrouve. */
function writeUrl(q: string) {
  const query = { ...(route.query ?? {}) } as Record<string, string>
  if (q.trim()) query.q = q.trim()
  else delete query.q
  void router.replace({ query })
}
function onType(text: string) {
  search.type(text)
  writeUrl(text)
}
async function onSubmit(text: string) {
  writeUrl(text)
  await search.now(text)
}
function onClear() {
  search.clear()
  writeUrl('')
}
/** Aucun résultat : la même question part à l'assistant, qui ouvre sa bulle. */
async function askAssistant() {
  const q = search.query.value
  assistant.toggle(true)
  await assistant.send(q)
}

onMounted(async () => {
  const q = typeof route.query?.q === 'string' ? route.query.q : ''
  await Promise.all([help.load(), q ? search.now(q) : Promise.resolve()])
  if (!q) box.value?.focus()
})
// Lien ?q= suivi page ouverte (bulle de l'assistant, autre fiche).
watch(() => route.query?.q, (q) => {
  const text = typeof q === 'string' ? q : ''
  if (text !== search.query.value) void search.now(text)
})
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-8 pb-10">
    <section class="rounded-sheet bg-gradient-to-br from-primary/10 via-surface to-surface p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.15)] sm:p-8">
      <h2 class="font-display text-2xl font-bold text-balance">Comment pouvons-nous vous aider ?</h2>
      <p class="mt-1 max-w-2xl text-sm text-text-muted text-pretty">
        Cherchez un sujet, parcourez les rubriques, ou posez votre question à l’assistant.
        Chaque fiche explique les gestes un par un et ouvre directement la bonne page.
      </p>
      <HelpSearchBox
        ref="box" class="mt-5" :model-value="search.query.value" :loading="search.isLoading.value"
        @type="onType" @submit="onSubmit" @clear="onClear"
      />
      <button
        type="button" data-test="help-open-assistant"
        class="mt-3 inline-flex min-h-10 items-center gap-2 rounded-btn px-3 text-sm font-medium text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="assistant.toggle(true)"
      ><Sparkles class="h-4 w-4" aria-hidden="true" />Poser une question à l’assistant</button>
    </section>

    <p v-if="help.unavailable.value" data-test="help-unavailable" class="rounded-card border border-border bg-surface p-6 text-sm text-text-muted">
      {{ HELP_UNAVAILABLE }}
    </p>

    <!-- Résultats de recherche -->
    <section v-else-if="searching" aria-labelledby="help-results-title" data-test="help-results">
      <h2 id="help-results-title" class="sr-only">Résultats de la recherche</h2>
      <p v-if="search.error.value" role="alert" data-test="help-search-error" class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        {{ search.error.value }}
      </p>
      <p
        v-else-if="search.answeredFor.value && search.results.value.length" role="status"
        class="mb-3 text-sm text-text-muted tabular-nums"
      >{{ search.results.value.length }} fiche{{ search.results.value.length > 1 ? 's' : '' }} pour « {{ search.answeredFor.value }} »</p>
      <ul v-if="search.results.value.length" class="flex flex-col gap-2">
        <li v-for="r in search.results.value" :key="r.id">
          <NuxtLink
            :to="articleRoute(r.id)" :data-test="`help-result-${r.id}`"
            class="group flex items-start gap-4 rounded-card bg-surface p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] transition-[box-shadow,transform] hover:shadow-[0_0_0_1px_rgb(var(--primary-rgb)/0.35),0_6px_16px_-8px_rgb(0_0_0/0.2)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <component :is="categoryIcon(r.category)" class="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-balance group-hover:text-primary">{{ r.title }}</span>
                <span class="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">{{ help.categoryLabel(r.category) }}</span>
                <span v-if="!r.accessible" class="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
                  <Lock class="h-3 w-3" aria-hidden="true" />Page réservée à d’autres rôles
                </span>
              </p>
              <p class="mt-1 text-sm text-text-muted text-pretty">{{ r.snippet }}</p>
            </div>
            <ChevronRight class="mt-1 h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <div v-else-if="noResult" data-test="help-no-result" class="rounded-card bg-surface p-6 text-center shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
        <p class="font-medium">Aucune fiche ne parle de « {{ search.answeredFor.value }} ».</p>
        <p class="mt-1 text-sm text-text-muted text-pretty">Essayez avec d’autres mots, ou posez la question telle quelle à l’assistant.</p>
        <button
          type="button" data-test="help-no-result-ask"
          class="mt-4 inline-flex min-h-10 items-center gap-2 rounded-btn bg-primary px-4 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="askAssistant"
        ><Sparkles class="h-4 w-4" aria-hidden="true" />Demander à l’assistant</button>
      </div>
    </section>

    <!-- Rubriques -->
    <template v-else>
      <StateBlock :loading="help.isLoading.value" :error="help.error.value" @retry="help.load(true)" />
      <div v-if="help.sections.value.length" class="grid gap-4 md:grid-cols-2" data-test="help-sections">
        <section
          v-for="s in help.sections.value" :key="s.id" :aria-labelledby="`help-cat-${s.id}`" :data-test="`help-section-${s.id}`"
          class="rounded-card bg-surface p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]"
        >
          <h2 :id="`help-cat-${s.id}`" class="flex items-center gap-2 font-display text-base font-bold">
            <span class="flex h-8 w-8 items-center justify-center rounded-xs bg-primary/10 text-primary">
              <component :is="categoryIcon(s.id)" class="h-4 w-4" aria-hidden="true" />
            </span>
            {{ s.label }}
            <span class="ml-auto text-xs font-normal text-text-muted tabular-nums">{{ s.articles.length }} fiche{{ s.articles.length > 1 ? 's' : '' }}</span>
          </h2>
          <ul class="mt-3 flex flex-col">
            <li v-for="a in s.articles" :key="a.id">
              <NuxtLink
                :to="articleRoute(a.id)" :data-test="`help-article-link-${a.id}`" :title="a.summary"
                class="group -mx-2 flex min-h-10 items-center gap-2 rounded-xs px-2 py-1.5 text-sm transition-colors hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span class="min-w-0 flex-1 text-pretty group-hover:text-primary">{{ a.title }}</span>
                <Lock v-if="!a.accessible" class="h-3.5 w-3.5 shrink-0 text-text-muted" aria-label="Page réservée à d’autres rôles" />
                <ChevronRight class="h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
