<template>
  <div v-if="isVoiceActive" class="voice-controls">
    <button
      class="vc-btn"
      :class="{ muted: isMuted }"
      @click="toggleMute"
      :title="isMuted ? '取消静音' : '静音'"
    >
      <span>{{ isMuted ? '🔇' : '🎤' }}</span>
    </button>
    <button
      class="vc-btn"
      :class="{ muted: isDeafened }"
      @click="toggleDeafen"
      :title="isDeafened ? '取消全体静音' : '全体静音'"
    >
      <span>{{ isDeafened ? '🔈' : '🔊' }}</span>
    </button>
    <button class="vc-btn leave" @click="leaveVoice" title="离开语音">
      <span>📞</span>
    </button>
    <span class="vc-peers">{{ peerCount }} 人在线</span>
  </div>
  <button v-else class="vc-join-btn" @click="joinVoice" title="加入语音">
    <span>🎤 加入语音</span>
  </button>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useWebRTC } from '@/composables/useWebRTC'

const {
  isMuted, isDeafened, isVoiceActive, peerCount,
  joinVoice, leaveVoice, toggleMute, toggleDeafen,
  setupSignaling, teardownSignaling,
} = useWebRTC()

onMounted(() => {
  setupSignaling()
})

onUnmounted(() => {
  teardownSignaling()
})
</script>

<style scoped>
.voice-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  padding: 4px 12px;
  box-shadow: var(--shadow-sm);
}

.vc-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.vc-btn:hover {
  background: var(--color-bg-warm);
}

.vc-btn.muted {
  background: var(--color-danger-light);
}

.vc-btn.leave {
  color: var(--color-danger);
}

.vc-join-btn {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: var(--transition);
}

.vc-join-btn:hover {
  background: var(--color-primary-dark);
}

.vc-peers {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 4px;
}
</style>
