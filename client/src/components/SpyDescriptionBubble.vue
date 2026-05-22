<template>
  <div class="desc-bubble" :class="{ mine: isMine, system: isSystem }">
    <span class="desc-author">{{ isSystem ? '📢' : description.nickname }}</span>
    <span class="desc-text">{{ isSystem ? description.text : description.text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  description: { nickname: string; text: string }
  isMine: boolean
  isSystem?: boolean
}>()
</script>

<style scoped>
.desc-bubble {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-warm);
  font-size: 14px;
  transition: var(--transition);
}

.desc-bubble.mine {
  background: var(--color-accent-pale);
}

.desc-bubble.system {
  background: transparent;
  opacity: 0.7;
  font-style: italic;
}

.desc-author {
  font-weight: 600;
  color: var(--color-primary-dark);
  white-space: nowrap;
  min-width: 48px;
}

.desc-text {
  color: var(--color-text);
  line-height: 1.5;
}
</style>
