<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoomStore } from '@/stores/room'

onMounted(() => {
  useRoomStore().setupSocketListeners()
})
</script>

<template>
  <div class="app-wrapper">
    <div class="bg-decoration">
      <div class="blob blob-1" />
      <div class="blob blob-2" />
      <div class="blob blob-3" />
    </div>
    <router-view />
  </div>
</template>

<style>
:root {
  --color-bg: #FFF8F0;
  --color-bg-warm: #FFF0E0;
  --color-surface: #FFFFFF;
  --color-primary: #E8856C;
  --color-primary-dark: #D4705A;
  --color-primary-light: #F5A88E;
  --color-accent: #F4A261;
  --color-accent-light: #FBD5A4;
  --color-accent-pale: #FDEBD8;
  --color-text: #4A3728;
  --color-text-secondary: #8B7A6A;
  --color-text-muted: #B5A392;
  --color-border: #F0E4D8;
  --color-border-light: #F7EFE6;
  --color-success: #7EB87A;
  --color-success-bg: #E8F5E6;
  --color-danger: #D9756B;
  --color-danger-light: #FDE8E5;
  --color-info: #5B9BD5;
  --color-info-light: #E3F0FB;
  --color-warning: #E6A23C;
  --color-warning-light: #FDF6E3;
  --color-gold: #F5B342;
  --color-gold-bg: #FEF3D5;
  --shadow-sm: 0 2px 8px rgba(180, 140, 110, 0.10);
  --shadow-md: 0 4px 16px rgba(180, 140, 110, 0.12);
  --shadow-lg: 0 8px 32px rgba(180, 140, 110, 0.15);
  --shadow-glow: 0 0 20px rgba(232, 133, 108, 0.2);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;
  --font-title: 'ZCOOL QingKe HuangYou', cursive;
  --font-heading: 'Noto Sans SC', sans-serif;
  --font-body: 'Noto Sans SC', sans-serif;
  --font-number: 'Nunito', sans-serif;
  --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  touch-action: manipulation;
  overscroll-behavior: none;
}

body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text);
  height: 100vh;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

.app-wrapper {
  position: relative;
  min-height: 100vh;
}

.bg-decoration {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}

.blob-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #FBD5A4, #F4A261);
  top: -200px;
  right: -200px;
  animation: blobFloat 20s ease-in-out infinite;
}

.blob-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #FDEBD8, #E8856C);
  bottom: -150px;
  left: -150px;
  animation: blobFloat 25s ease-in-out infinite reverse;
}

.blob-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #FBD5A4, #FDEBD8);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: blobFloat 15s ease-in-out infinite 5s;
}

@keyframes blobFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

input, select, button, textarea {
  font-family: inherit;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
</style>
