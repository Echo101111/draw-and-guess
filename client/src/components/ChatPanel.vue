<template>
  <div class="chat-panel">
    <div class="chat-header">
      <span class="chat-icon">💬</span>
      <span>聊天</span>
    </div>

    <div ref="messagesRef" class="messages">
      <div
        v-for="msg in gameStore.chatMessages"
        :key="msg.id"
        :class="['message', { 'is-system': msg.isSystem }]"
      >
        <template v-if="msg.isSystem">
          <span class="sys-text">{{ msg.text }}</span>
        </template>
        <template v-else>
          <span class="msg-nickname">{{ msg.nickname }}</span>
          <span class="msg-text">{{ msg.text }}</span>
        </template>
        <span class="msg-time">{{ formatTime(msg.timestamp) }}</span>
      </div>
    </div>

    <div class="input-row">
      <div class="input-wrap">
        <input
          v-model="inputText"
          type="text"
          placeholder="发送消息..."
          maxlength="200"
          @keyup.enter="handleSend"
        />
      </div>
      <button @click="handleSend">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()
const inputText = ref('')
const messagesRef = ref<HTMLElement | null>(null)

function handleSend() {
  if (!inputText.value.trim()) return
  gameStore.sendChat(inputText.value.trim())
  inputText.value = ''
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

onMounted(() => {
  nextTick(scrollToBottom)
})

watch(() => gameStore.chatMessages.length, () => {
  nextTick(scrollToBottom)
})
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
  height: 100%;
  min-height: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border-light);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
  flex-shrink: 0;
}

.chat-icon {
  font-size: 1rem;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.message {
  padding: 0.4rem 0.65rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  line-height: 1.4;
  background: var(--color-bg);
}

.message.is-system {
  background: transparent;
  text-align: center;
  padding: 0.3rem 0.5rem;
}

.sys-text {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-style: italic;
}

.sys-text::before {
  content: '📢 ';
}

.msg-nickname {
  font-weight: 600;
  color: var(--color-primary);
  margin-right: 0.4rem;
}

.msg-text {
  color: var(--color-text);
}

.msg-time {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.7rem;
  margin-top: 0.15rem;
  font-family: var(--font-number);
}

.input-row {
  display: flex;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.input-wrap {
  flex: 1;
}

.input-row input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: var(--transition);
}

.input-row input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: var(--shadow-glow);
}

.input-row input::placeholder {
  color: var(--color-text-muted);
}

.input-row button {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: var(--transition);
  white-space: nowrap;
}

.input-row button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(232, 133, 108, 0.3);
}

@media (max-width: 767px) {
  .chat-panel {
    min-height: 200px;
    height: 100%;
    max-height: calc(100vh - 2rem);
    border-radius: var(--radius-md);
  }

  .chat-header {
    padding: 0.6rem 0.75rem;
    font-size: 0.85rem;
  }

  .messages {
    padding: 0.5rem;
  }

  .message {
    font-size: 0.8rem;
    padding: 0.35rem 0.5rem;
  }

  .input-row {
    padding: 0.5rem 0.6rem;
  }

  .input-row input {
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
  }

  .input-row button {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>
