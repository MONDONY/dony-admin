// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default withNuxt(
  // For plain TypeScript files: use @typescript-eslint/parser directly
  {
    files: ['**/*.ts'],
    plugins: { '@typescript-eslint': tsPlugin },
    languageOptions: {
      parser: tsParser,
    },
  },
  // For Vue files: vue-eslint-parser (already set by @nuxt/eslint-config) is the main parser;
  // set @typescript-eslint/parser for the inner <script lang="ts"> blocks
  {
    files: ['**/*.vue'],
    plugins: { '@typescript-eslint': tsPlugin },
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  // Suppress warnings/errors in pre-existing generated UI components (shadcn-vue)
  {
    files: ['app/components/ui/**'],
    rules: {
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-self-closing': 'off',
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
  // Suppress import/first in dual-script Vue files (valid <script>+<script setup> pattern)
  {
    files: ['app/features/auth/components/CountrySelector.vue'],
    rules: {
      'import/first': 'off',
    },
  },
  // Suppress no-unused-vars in type declaration files (interface augmentation is used by TS)
  {
    files: ['app/types/**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  // Test files: suppress unused imports that existed before this task
  {
    files: ['tests/**/*.ts'],
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  // Nuxt auto-import globals for Nuxt composables/utilities used without explicit import
  {
    files: ['app/**/*.{ts,vue}'],
    languageOptions: {
      globals: Object.fromEntries([
        'navigateTo', 'definePageMeta', 'useRoute', 'useRuntimeConfig',
        'useNuxtApp', '$fetch', 'defineNuxtRouteMiddleware', 'defineNuxtPlugin',
        'ref', 'computed', 'reactive', 'watch', 'watchEffect',
        'onMounted', 'onUnmounted', 'onBeforeMount', 'onBeforeUnmount',
        'nextTick', 'useHead', 'useSeoMeta',
      ].map(g => [g, 'readonly'])),
    },
  },
)
