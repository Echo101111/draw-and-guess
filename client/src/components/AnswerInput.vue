<template>
  <div class="answer-input">
    <div class="input-wrap">
      <span class="input-icon">💬</span>
      <input
        v-model="answer"
        type="text"
        placeholder="输入你的答案..."
        :disabled="disabled"
        maxlength="50"
        @keyup.enter="handleSubmit"
      />
    </div>
    <button :disabled="disabled" @click="handleSubmit">
      猜！
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'

const props = defineProps<{
  disabled?: boolean
}>()

const gameStore = useGameStore()
const answer = ref('')

function handleSubmit() {
  if (!answer.value.trim() || props.disabled) return
  gameStore.submitAnswer(answer.value.trim())
  answer.value = ''
}
</script>

<style scoped>
.answer-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
  width: 100%;
}

.input-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.85rem;
  font-size: 1rem;
  pointer-events: none;
}

.answer-input input {
  width: 100%;
  padding: 0.7rem 0.85rem 0.7rem 2.6rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: var(--transition);
}

.answer-input input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: var(--shadow-glow);
}

.answer-input input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-border-light);
}

.answer-input input::placeholder {
  color: var(--color-text-muted);
}

.answer-input button {
  padding: 0.7rem 1.5rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: var(--transition);
  white-space: nowrap;
}

.answer-input button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(232, 133, 108, 0.3);
}

.answer-input button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .answer-input {
    padding: 0.4rem;
    border-radius: var(--radius-md);
  }

  .answer-input input {
    padding: 0.55rem 0.65rem 0.55rem 2.2rem;
    font-size: 0.85rem;
  }

  .input-icon {
    left: 0.65rem;
    font-size: 0.85rem;
  }

  .answer-input button {
    padding: 0.55rem 1rem;
    font-size: 0.85rem;
  }
}
</style>
