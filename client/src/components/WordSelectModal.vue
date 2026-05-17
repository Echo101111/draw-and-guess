<template>
  <div class="word-select-overlay">
    <div class="word-select-box">
      <div class="word-select-title">🎨 选一个词来画</div>
      <div class="word-select-sub">选择你最擅长的，开始创作吧</div>
      <div class="word-options">
        <button
          v-for="opt in options"
          :key="opt.word"
          class="word-option-btn"
          @click="$emit('select', opt.word)"
        >
          <span class="option-word">{{ opt.word }}</span>
          <span v-if="opt.category" class="option-category">{{ opt.category }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  options: Array<{ word: string; category?: string }>
}>()

defineEmits<{
  select: [word: string]
}>()
</script>

<style scoped>
.word-select-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 55, 40, 0.3);
  backdrop-filter: blur(4px);
}

.word-select-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 2rem;
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  border: 2px solid var(--color-accent);
  max-width: 360px;
  width: 85%;
  animation: popIn 0.35s ease-out;
}

.word-select-title {
  font-family: var(--font-title);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}

.word-select-sub {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 0.3rem;
}

.word-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.word-option-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 1rem;
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 1rem;
  transition: var(--transition);
  width: 100%;
}

.word-option-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-accent-pale);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(232, 133, 108, 0.15);
}

.option-word {
  font-family: var(--font-title);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.option-category {
  font-size: 0.72rem;
  color: var(--color-accent);
  background: var(--color-gold-bg);
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
</style>
