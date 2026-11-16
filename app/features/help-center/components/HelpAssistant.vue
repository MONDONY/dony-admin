<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUpRight, BookOpen, FileText, RotateCcw, SendHorizontal, Sparkles, X } from 'lucide-vue-next'
import HelpMarkdown from '@/features/help-center/components/HelpMarkdown.vue'
import { QUESTION_MAX_LENGTH, useHelpAssistant } from '@/features/help-center/composables/useHelpAssistant'
import { articleRoute, searchRoute } from '@/features/help-center/lib/helpCategories'

/**
 * Bulle de l'assistant, en bas à droite de chaque page. Il répond à partir des fiches du centre
 * d'aide, avec des boutons vers les pages et les fiches qu'il a utilisées. La conversation suit
 * l'admin de page en page jusqu'au rechargement.
 */
const EXAMPLES = [
  'Comment voir les colis en cours ?',
  'Comment rembourser un expéditeur ?',
  'Comment suspendre un compte ?',
]
/** Sous ce nombre de questions restantes aujourd'hui, l'admin est prévenu. */
const LOW_REMAINING = 5

const a = useHelpAssistant()
const draft = ref('')
const input = ref<HTMLTextAreaElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const scroller = ref<HTMLElement | null>(null)

async function scrollToEnd() {
  await nextTick()
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}

async function submit(text = draft.value) {
  if (!text.trim() || a.pending.value) return
  draft.value = ''
  const sending = a.send(text)
  void scrollToEnd()
  await sending
  await scrollToEnd()
  input.value?.focus()
}

function onKeydown(e: KeyboardEvent) {
  // Entrée envoie, Maj+Entrée revient à la ligne ; pas pendant une composition (accents, IME).
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void submit()
  }
}

function close() {
  a.toggle(false)
  void nextTick(() => trigger.value?.focus())
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && a.open.value) close()
}

watch(a.open, async (o) => {
  if (!o) return
  await scrollToEnd()
  input.value?.focus()
})
onMounted(() => document.addEventListener('keydown', onDocumentKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown))
</script>

<template>
  <div class="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
    <Transition
      enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-y-2 scale-[0.98]"
      leave-active-class="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0 translate-y-1"
    >
      <section
        v-if="a.open.value" id="help-assistant-panel" role="dialog" aria-modal="false" aria-labelledby="help-assistant-title"
        data-test="help-assistant-panel"
        class="pointer-events-auto flex h-[min(640px,calc(100dvh-7rem))] w-[min(400px,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-sheet bg-surface shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-12px_rgb(0_0_0/0.35)]"
      >
        <header class="flex items-center gap-2 border-b border-border px-4 py-3">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles class="h-4 w-4" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 id="help-assistant-title" class="font-display text-sm font-bold">Assistant de la console</h2>
            <p class="text-xs text-text-muted">Répond à partir du centre d’aide</p>
          </div>
          <button
            v-if="a.messages.value.length" type="button" data-test="help-assistant-reset" title="Nouvelle conversation"
            aria-label="Nouvelle conversation" :disabled="a.pending.value"
            class="flex h-10 w-10 items-center justify-center rounded-btn text-text-muted transition-[background-color,transform] hover:bg-surface-elevated hover:text-text active:scale-[0.96] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            @click="a.reset()"
          ><RotateCcw class="h-4 w-4" aria-hidden="true" /></button>
          <button
            type="button" data-test="help-assistant-close" title="Fermer" aria-label="Fermer l’assistant"
            class="flex h-10 w-10 items-center justify-center rounded-btn text-text-muted transition-[background-color,transform] hover:bg-surface-elevated hover:text-text active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            @click="close"
          ><X class="h-4 w-4" aria-hidden="true" /></button>
        </header>

        <div ref="scroller" class="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" data-test="help-assistant-messages">
          <div v-if="!a.messages.value.length" data-test="help-assistant-empty">
            <p class="text-sm text-pretty">
              Bonjour ! Posez votre question en quelques mots, comme vous la poseriez à un collègue.
              Je vous explique les étapes et je vous donne le lien vers la bonne page.
            </p>
            <p class="mt-4 text-xs font-medium text-text-muted">Par exemple :</p>
            <div class="mt-2 flex flex-col items-start gap-2">
              <button
                v-for="ex in EXAMPLES" :key="ex" type="button" :data-test="`help-assistant-example`"
                class="min-h-10 rounded-btn bg-surface-elevated px-3 py-2 text-left text-sm transition-[background-color,transform] hover:bg-primary/10 hover:text-primary active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                @click="submit(ex)"
              >{{ ex }}</button>
            </div>
            <NuxtLink
              to="/aide" data-test="help-assistant-docs"
              class="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-btn text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            ><BookOpen class="h-4 w-4" aria-hidden="true" />Parcourir le centre d’aide</NuxtLink>
          </div>

          <template v-for="m in a.messages.value" :key="m.id">
            <div v-if="m.role === 'user'" class="flex justify-end">
              <p
                data-test="help-assistant-question"
                class="max-w-[85%] whitespace-pre-wrap break-words rounded-card rounded-br-xs bg-primary px-3.5 py-2 text-sm text-white"
              >{{ m.text }}</p>
            </div>
            <div v-else class="flex flex-col items-start gap-2" :data-test="m.failed ? 'help-assistant-failure' : 'help-assistant-answer'">
              <div
                :class="['max-w-[92%] rounded-card rounded-bl-xs px-3.5 py-2.5',
                         m.failed ? 'bg-danger/10 text-sm text-text' : 'bg-surface-elevated']"
              >
                <p v-if="m.failed" class="text-pretty">{{ m.text }}</p>
                <HelpMarkdown v-else compact :source="m.text" />
              </div>
              <div v-if="m.actions?.length" class="flex flex-wrap gap-2">
                <NuxtLink
                  v-for="r in m.actions" :key="r.path" :to="r.path" data-test="help-assistant-action"
                  class="inline-flex min-h-10 items-center gap-1.5 rounded-btn bg-primary px-3 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >{{ r.label }}<ArrowUpRight class="h-4 w-4" aria-hidden="true" /></NuxtLink>
              </div>
              <div v-if="m.sources?.length" class="w-full max-w-[92%]">
                <p class="text-xs text-text-muted">D’après le centre d’aide :</p>
                <ul class="mt-1 flex flex-col">
                  <li v-for="s in m.sources" :key="s.id">
                    <NuxtLink
                      :to="articleRoute(s.id)" data-test="help-assistant-source"
                      class="-mx-1 flex min-h-8 items-center gap-1.5 rounded-xs px-1 text-xs text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    ><FileText class="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span class="truncate">{{ s.title }}</span></NuxtLink>
                  </li>
                </ul>
              </div>
              <NuxtLink
                v-if="(m.failed || m.answered === false) && m.question" :to="searchRoute(m.question)" data-test="help-assistant-search-docs"
                class="inline-flex min-h-8 items-center gap-1.5 rounded-xs text-xs font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              ><BookOpen class="h-3.5 w-3.5" aria-hidden="true" />Chercher « {{ m.question }} » dans la doc</NuxtLink>
            </div>
          </template>

          <div v-if="a.pending.value" class="flex items-center gap-1 px-1" role="status" data-test="help-assistant-pending">
            <span class="sr-only">L’assistant rédige sa réponse…</span>
            <span v-for="i in 3" :key="i" class="h-2 w-2 animate-bounce rounded-full bg-text-muted/60 motion-reduce:animate-none" :style="{ animationDelay: `${(i - 1) * 120}ms` }" aria-hidden="true" />
          </div>
        </div>

        <form class="border-t border-border p-3" @submit.prevent="submit()">
          <div class="flex items-end gap-2 rounded-card bg-surface-elevated p-1.5 focus-within:ring-2 focus-within:ring-primary/30">
            <label for="help-assistant-input" class="sr-only">Votre question</label>
            <textarea
              id="help-assistant-input" ref="input" v-model="draft" data-test="help-assistant-input" rows="1"
              :maxlength="QUESTION_MAX_LENGTH" placeholder="Votre question…"
              class="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm [field-sizing:content] placeholder:text-text-muted focus:outline-none"
              @keydown="onKeydown"
            />
            <button
              type="submit" data-test="help-assistant-send" aria-label="Envoyer la question" :disabled="!draft.trim() || a.pending.value"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary text-white transition-[background-color,transform,opacity] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            ><SendHorizontal class="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <p class="mt-1.5 px-1 text-[11px] leading-snug text-text-muted text-pretty">
            N’écrivez pas d’email, de téléphone ni de nom. L’assistant peut se tromper : vérifiez dans la fiche citée.
            <span v-if="a.remaining.value !== null && a.remaining.value <= LOW_REMAINING" data-test="help-assistant-remaining" class="tabular-nums">
              {{ a.remaining.value }} question{{ a.remaining.value > 1 ? 's' : '' }} restante{{ a.remaining.value > 1 ? 's' : '' }} aujourd’hui.
            </span>
          </p>
        </form>
      </section>
    </Transition>

    <button
      ref="trigger" type="button" data-test="help-assistant-trigger"
      :aria-expanded="a.open.value" aria-controls="help-assistant-panel"
      :aria-label="a.open.value ? 'Fermer l’assistant' : 'Ouvrir l’assistant de la console'"
      class="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgb(var(--primary-rgb)/0.6)] transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      @click="a.open.value ? close() : a.toggle(true)"
    >
      <span class="relative h-5 w-5" aria-hidden="true">
        <Sparkles :class="['absolute inset-0 h-5 w-5 transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]', a.open.value ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0']" />
        <X :class="['absolute inset-0 h-5 w-5 transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]', a.open.value ? 'scale-100 opacity-100 blur-0' : 'scale-[0.25] opacity-0 blur-[4px]']" />
      </span>
      <span>{{ a.open.value ? 'Fermer' : 'Assistant' }}</span>
    </button>
  </div>
</template>
