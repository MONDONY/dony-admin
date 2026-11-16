<script setup lang="ts">
import { computed } from 'vue'
import { Info, TriangleAlert } from 'lucide-vue-next'
import HelpInline from '@/features/help-center/components/HelpInline.vue'
import { parseHelpMarkdown } from '@/features/help-center/lib/helpMarkdown'

/**
 * Rendu d'une fiche ou d'une réponse de l'assistant. Aucun `v-html` : le texte est lu en blocs
 * (titres, listes, encadrés) et chaque lien devient un lien interne de la console.
 * `compact` : bulles du chat, sans titres de grande taille.
 */
const props = withDefaults(defineProps<{ source: string; compact?: boolean }>(), { compact: false })
const emit = defineEmits<{ navigate: [] }>()
const blocks = computed(() => parseHelpMarkdown(props.source))
</script>

<template>
  <div :class="['text-pretty', compact ? 'space-y-2 text-sm' : 'space-y-4 text-[15px] leading-relaxed']" data-test="help-markdown">
    <template v-for="(b, i) in blocks" :key="i">
      <h2
        v-if="b.kind === 'heading' && b.level === 2"
        :class="['font-display font-bold text-balance', compact ? 'text-sm' : 'pt-2 text-lg']"
      ><HelpInline :inlines="b.inlines" @navigate="emit('navigate')" /></h2>
      <h3
        v-else-if="b.kind === 'heading'"
        :class="['font-display font-semibold text-balance', compact ? 'text-sm' : 'text-base']"
      ><HelpInline :inlines="b.inlines" @navigate="emit('navigate')" /></h3>
      <p v-else-if="b.kind === 'paragraph'"><HelpInline :inlines="b.inlines" @navigate="emit('navigate')" /></p>
      <ol v-else-if="b.kind === 'list' && b.ordered" :class="['list-decimal space-y-1.5 marker:font-semibold marker:text-primary', compact ? 'pl-5' : 'pl-6']">
        <li v-for="(item, j) in b.items" :key="j" class="pl-1"><HelpInline :inlines="item" @navigate="emit('navigate')" /></li>
      </ol>
      <ul v-else-if="b.kind === 'list'" :class="['list-disc space-y-1.5 marker:text-text-muted', compact ? 'pl-5' : 'pl-6']">
        <li v-for="(item, j) in b.items" :key="j" class="pl-1"><HelpInline :inlines="item" @navigate="emit('navigate')" /></li>
      </ul>
      <div
        v-else-if="b.kind === 'callout'" :data-test="`help-callout-${b.tone}`"
        :class="['flex gap-3 rounded-btn px-4 py-3', b.tone === 'warning' ? 'bg-danger/10 text-text' : 'bg-primary/5 text-text']"
      >
        <TriangleAlert v-if="b.tone === 'warning'" class="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <Info v-else class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p><HelpInline :inlines="b.inlines" @navigate="emit('navigate')" /></p>
      </div>
    </template>
  </div>
</template>
