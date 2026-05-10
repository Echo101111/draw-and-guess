<template>
  <div class="answer-input">
    <input
      v-model="answer"
      type="text"
      placeholder="输入你的答案..."
      :disabled="disabled"
      maxlength="50"
      @keyup.enter="handleSubmit"
    />
    <button :disabled="disabled" @click="handleSubmit">
      提交
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

  gameStore.submitAnswer(answer.value)
  answer.value = ''
}
</script>

<style scoped>
.answer-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.answer-input input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.answer-input input:focus {
  outline: none;
  border-color: #4a90d9;
}

.answer-input input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.answer-input button {
  padding: 0.75rem 1.5rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.answer-input button:hover:not(:disabled) {
  background: #3a7fc9;
}

.answer-input button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>