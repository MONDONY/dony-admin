// @ts-check
import { createRequire } from 'node:module'
import withNuxt from './.nuxt/eslint.config.mjs'

// Resolve TypeScript-eslint packages from the transitively-installed location
// (@typescript-eslint/* ships with @nuxt/eslint-config but is not a direct dep of dony-admin)
const _require = createRequire(import.meta.url)
const tsParserPath = 'node_modules/.pnpm/@typescript-eslint+parser@8.59.3_eslint@10.3.0_jiti@2.7.0__typescript@6.0.3/node_modules/@typescript-eslint/parser/dist/index.js'
const tsPluginPath = 'node_modules/.pnpm/@typescript-eslint+eslint-plugin@8.59.3_@typescript-eslint+parser@8.59.3_eslint@10.3.0__80497659fb9a4eea504aca5562850d79/node_modules/@typescript-eslint/eslint-plugin/dist/index.js'
const tsParser = _require('./' + tsParserPath)
const tsPlugin = _require('./' + tsPluginPath)

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
