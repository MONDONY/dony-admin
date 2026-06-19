export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxtjs/tailwindcss', '@pinia/nuxt'],
  components: [
    { path: '~/components', pathPrefix: false },
  ],
  typescript: {
    strict: true,
    typeCheck: false,
  },
  ssr: true,
  css: ['~~/assets/css/main.css'],
  vite: {
    optimizeDeps: {
      include: ['firebase/app', 'firebase/auth', 'clsx', 'tailwind-merge', 'class-variance-authority', 'radix-vue', 'lucide-vue-next'],
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: '',
      firebaseApiKey: '',
      firebaseAuthDomain: '',
      firebaseProjectId: '',
      firebaseAppId: '',
    },
  },
  app: {
    head: {
      title: 'dony ADMIN',
      htmlAttrs: { lang: 'fr' },
      script: [
        {
          innerHTML: `(function(){var s=localStorage.getItem('dony-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark');}})();`,
          type: 'text/javascript',
          tagPosition: 'head',
        }
      ],
    },
  },
})
