<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { ArrowLeft, ArrowUpRight, ChevronRight, Lock, Sparkles } from 'lucide-vue-next'
import StateBlock from '@/components/ui/StateBlock.vue'
import HelpMarkdown from '@/features/help-center/components/HelpMarkdown.vue'
import { useHelpArticle } from '@/features/help-center/composables/useHelpArticle'
import { useHelpAssistant } from '@/features/help-center/composables/useHelpAssistant'
import { articleRoute, categoryIcon } from '@/features/help-center/lib/helpCategories'

definePageMeta({
  middleware: 'admin-only',
  pageTitle: 'Centre d’aide',
  pageSubtitle: 'Toutes les fonctionnalités de la console, expliquées pas à pas',
})

const route = useRoute()
const help = useHelpArticle()
const assistant = useHelpAssistant()
const idParam = () => (typeof route.params?.id === 'string' ? route.params.id : '')

useHead(() => ({ title: help.article.value ? `${help.article.value.title} · Aide` : 'Centre d’aide' }))

onMounted(() => { if (idParam()) void help.load(idParam()) })
watch(() => route.params?.id, (id) => { if (typeof id === 'string' && id) void help.load(id) })
</script>

<template>
  <div class="mx-auto max-w-3xl pb-10">
    <NuxtLink
      to="/aide" data-test="help-back"
      class="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-btn px-2 text-sm text-text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    ><ArrowLeft class="h-4 w-4" aria-hidden="true" />Toutes les fiches</NuxtLink>

    <StateBlock :loading="help.isLoading.value && !help.article.value" :error="help.error.value" @retry="help.load(idParam())" />
    <div v-if="help.notFound.value" data-test="help-not-found" class="mt-4 rounded-card bg-surface p-6 text-center shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <p class="font-medium">Cette fiche n’existe pas ou a été renommée.</p>
      <NuxtLink to="/aide" class="mt-3 inline-flex min-h-10 items-center rounded-btn px-3 text-sm font-medium text-primary hover:bg-primary/10">Chercher dans le centre d’aide</NuxtLink>
    </div>

    <article v-if="help.article.value" :key="help.article.value.id" class="help-article mt-2" data-test="help-article">
      <p class="flex items-center gap-1.5 text-sm font-medium text-primary">
        <component :is="categoryIcon(help.article.value.category)" class="h-4 w-4" aria-hidden="true" />
        {{ help.article.value.categoryLabel }}
      </p>
      <h2 class="mt-1 font-display text-3xl font-bold leading-tight text-balance" data-test="help-article-title">{{ help.article.value.title }}</h2>
      <p class="mt-2 text-base text-text-muted text-pretty">{{ help.article.value.summary }}</p>

      <div v-if="help.article.value.routes.length" class="mt-5 flex flex-wrap gap-2" data-test="help-article-routes">
        <NuxtLink
          v-for="(r, i) in help.article.value.routes" :key="r.path" :to="r.path" :data-test="`help-route-${i}`"
          :class="['inline-flex min-h-10 items-center gap-1.5 rounded-btn px-4 text-sm font-medium transition-[background-color,transform] active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                   i === 0 ? 'bg-primary text-white hover:bg-primary/90' : 'bg-primary/10 text-primary hover:bg-primary/15']"
        >{{ r.label }}<ArrowUpRight class="h-4 w-4" aria-hidden="true" /></NuxtLink>
      </div>
      <p
        v-if="!help.article.value.accessible" data-test="help-article-locked"
        class="mt-5 flex items-start gap-2 rounded-btn bg-surface-elevated px-4 py-3 text-sm text-text-muted text-pretty"
      >
        <Lock class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Votre rôle ne donne pas accès à cette page. Vous pouvez lire la fiche pour comprendre le fonctionnement ; demandez à un administrateur pour agir.
      </p>

      <HelpMarkdown class="mt-8" :source="help.article.value.body" />

      <section v-if="help.article.value.related.length" class="mt-10 border-t border-border pt-6" aria-labelledby="help-related-title">
        <h2 id="help-related-title" class="font-display text-base font-bold">Fiches proches</h2>
        <ul class="mt-3 grid gap-2 sm:grid-cols-2">
          <li v-for="r in help.article.value.related" :key="r.id">
            <NuxtLink
              :to="articleRoute(r.id)" :data-test="`help-related-${r.id}`"
              class="group flex h-full items-start gap-2 rounded-card bg-surface p-3 text-sm shadow-[0_0_0_1px_rgb(0_0_0/0.06)] transition-shadow hover:shadow-[0_0_0_1px_rgb(var(--primary-rgb)/0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span class="min-w-0 flex-1">
                <span class="block font-medium text-pretty group-hover:text-primary">{{ r.title }}</span>
                <span class="mt-0.5 line-clamp-2 block text-xs text-text-muted">{{ r.summary }}</span>
              </span>
              <ChevronRight class="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <div class="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-card bg-primary/5 px-5 py-4">
        <p class="text-sm text-pretty">Cette fiche ne répond pas à votre question ?</p>
        <button
          type="button" data-test="help-article-ask"
          class="inline-flex min-h-10 items-center gap-2 rounded-btn bg-surface px-4 text-sm font-medium text-primary shadow-[0_0_0_1px_rgb(var(--primary-rgb)/0.3)] transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          @click="assistant.toggle(true)"
        ><Sparkles class="h-4 w-4" aria-hidden="true" />Demander à l’assistant</button>
      </div>
    </article>
  </div>
</template>

<style scoped>
/* Entrée de la fiche : titre puis contenu, en léger décalé ; rien quand l'utilisateur réduit les animations. */
.help-article > * { animation: help-in 220ms cubic-bezier(0.2, 0, 0, 1) both; }
.help-article > *:nth-child(2) { animation-delay: 40ms; }
.help-article > *:nth-child(n + 3) { animation-delay: 80ms; }
@keyframes help-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .help-article > * { animation: none; }
}
</style>
