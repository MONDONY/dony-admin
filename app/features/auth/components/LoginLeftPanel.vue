<script setup lang="ts">
const items = [
  {
    icon: '🔒',
    iconStyle: 'background:rgb(var(--primary-rgb)/0.12);',
    title: 'Paiements sécurisés via Stripe',
    subtitle: 'Fonds en séquestre jusqu\'à la livraison confirmée',
  },
  {
    icon: '✓',
    iconStyle: 'background:rgb(var(--success-rgb)/0.12);color:var(--success);',
    title: 'Identité vérifiée (KYC)',
    subtitle: 'Tous les membres sont validés avant d\'accéder à la plateforme',
  },
  {
    icon: '📱',
    iconStyle: 'background:rgb(var(--accent-rgb)/0.12);',
    title: 'Connexion par code SMS',
    subtitle: 'Sans mot de passe — plus simple, plus sûr',
  },
]
</script>

<template>
  <div class="w-1/2 shrink-0 bg-bg border-r border-border flex flex-col p-10 relative overflow-hidden">
    <!-- Glow blobs -->
    <div
      aria-hidden="true"
      class="absolute pointer-events-none"
      style="top:-60px;right:-60px;width:260px;height:260px;border-radius:50%;background:rgb(var(--primary-rgb)/0.10);filter:blur(60px);"
    />
    <div
      aria-hidden="true"
      class="absolute pointer-events-none"
      style="bottom:-40px;left:-40px;width:200px;height:200px;border-radius:50%;background:rgb(var(--accent-rgb)/0.07);filter:blur(50px);"
    />

    <!-- Logo -->
    <div class="relative flex items-center gap-2">
      <img src="/logos/logo-yadony.png" alt="Yadony" class="h-7 w-auto" />
      <span
        class="text-xs font-bold px-2.5 py-0.5 rounded-full border"
        style="background:rgb(var(--primary-rgb)/0.15);color:var(--primary);border-color:rgb(var(--primary-rgb)/0.3);"
      >ADMIN</span>
    </div>

    <!-- Mascotte -->
    <div class="relative flex-1 flex items-center justify-center py-6">
      <img
        src="/mascots/securise.png"
        alt="Mascotte Yadony avec bouclier de sécurité vérifié"
        class="w-48 h-48 object-contain"
      />
    </div>

    <!-- Items de réassurance -->
    <div class="relative flex flex-col gap-3">
      <div
        v-for="item in items"
        :key="item.title"
        data-test="security-item"
        class="flex items-center gap-3 p-3 rounded-card border border-border"
        style="background:rgb(var(--surface-rgb)/0.5);"
      >
        <div
          class="w-8 h-8 rounded-[8px] flex items-center justify-center text-sm shrink-0"
          :style="item.iconStyle"
        >{{ item.icon }}</div>
        <div>
          <p class="text-xs font-semibold text-text">{{ item.title }}</p>
          <p class="text-[11px] text-subtle leading-snug mt-0.5">{{ item.subtitle }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
