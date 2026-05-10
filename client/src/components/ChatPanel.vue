<template>
  <div class="chat-panel">
    <div ref="messagesRef" class="messages">
      <div
        v-for="msg in gameStore.chatMessages"
        :key="msg.id"
        :class="['message', { system: msg.isSystem }]"
      >
        <span class="nickname">{{ msg.isSystem ? '' : msg.nickname + ': ' }}</span>
        <span class="text">{{ msg.text }}</span>
        <span class="time">{{ formatTime(msg.timestamp) }}</span>
      </div>
    </div>
    <div class="input-row">
      <input
        v-model="inputText"
        type="text"
        placeholder="发送消息..."
        maxlength="200"
        @keyup.enter="handleSend"
      />
      <button @click="handleSend">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()
const inputText = ref('')
const messagesRef = ref<HTMLElement | null>(null)

function handleSend() {
  if (!inputText.value.trim()) return
  gameStore.sendChat(inputText.value)
  inputText.value = ''
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

watch(() => gameStore.chatMessages.length, async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
})
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 300px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  font-size: 0.9rem;
  line-height: 1.4;
}

.message .nickname {
  font-weight: 600;
  color: #4a90d9;
}

.message .text {
  color: #333;
}

.message .time {
  margin-left: 0.5rem;
  color: #999;
  font-size: 0.75rem;
}

.message.system {
  color: #888;
  font-style: italic;
}

.message.system .text::before {
  content: '[系统] ';
}

.input-row {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #eee;
}

.input-row input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.input-row input:focus {
  outline: none;
  border-color: #4a90d9;
}

.input-row button {
  padding: 0.5rem 1rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.input-row button:hover {
  background: #3a7fc9;
}
</style>