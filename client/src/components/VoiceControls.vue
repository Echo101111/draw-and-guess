<template>
  <!-- Error state: mic error + retry -->
  <div v-if="micError && !isVoiceActive" class="vc-error">
    <span class="vc-error-text">{{ micError }}</span>
    <button class="vc-retry-btn" @click="handleRetry">重试</button>
  </div>

  <!-- Disconnected: join button -->
  <button v-else-if="!isVoiceActive" class="vc-join-btn" @click="handleJoin">
    🎤 加入语音
  </button>

  <!-- Connected: voice bar -->
  <div v-else class="vc-bar">
    <button
      class="vc-btn"
      :class="{ muted: isMuted, forced: isForceMuted }"
      :disabled="isForceMuted"
      @click="toggleMute"
      :title="isForceMuted ? '阶段静音中' : (isMuted ? '取消静音' : '静音')"
    >
      <span class="vc-btn-icon">{{ isForceMuted ? '🔇' : (isMuted ? '🔇' : '🎤') }}</span>
      <span class="vc-btn-label">{{ isForceMuted ? '静音' : (isMuted ? '已静音' : '静音') }}</span>
    </button>

    <button
      class="vc-btn"
      :class="{ muted: isDeafened }"
      @click="toggleDeafen"
      :title="isDeafened ? '取消全体静音' : '全体静音'"
    >
      <span class="vc-btn-icon">{{ isDeafened ? '🔈' : '🔊' }}</span>
      <span class="vc-btn-label">{{ isDeafened ? '全静' : '收听' }}</span>
    </button>

    <button class="vc-btn vc-leave" @click="handleLeave" title="离开语音">
      <span class="vc-btn-icon">📞</span>
      <span class="vc-btn-label">退出</span>
    </button>

    <span class="vc-divider" />

    <button
      class="vc-talk-btn"
      :class="{ active: isPttActive }"
      :disabled="!canTalk"
      @click="handleTalkToggle"
    >
      <span>{{ isPttActive ? '🟢' : '🎤' }}</span>
      <span>{{ isPttActive ? '发言中' : '发言' }}</span>
    </button>

    <span class="vc-divider" />

    <span class="vc-peers">{{ peerCount }} 人</span>

    <span
      class="vc-quality"
      :class="'quality-' + connectionQuality"
      :title="qualityTitle"
    >📶</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWebRTC } from '@/composables/useWebRTC'

const props = withDefaults(defineProps<{
  canTalk?: boolean
}>(), {
  canTalk: false,
})

const {
  isMuted, isDeafened, isVoiceActive, isForceMuted, isPttActive,
  peerCount, micError, connectionQuality,
  joinVoice, leaveVoice, toggleMute, toggleDeafen, clearMicError,
  startPtt, stopPtt,
} = useWebRTC()

async function handleJoin() {
  clearMicError()
  await joinVoice()
}

function handleLeave() {
  leaveVoice()
}

function handleRetry() {
  clearMicError()
  handleJoin()
}

function handleTalkToggle() {
  if (!props.canTalk) return
  if (isPttActive.value) {
    stopPtt()
  } else {
    startPtt()
  }
}

const qualityTitle = computed(() => {
  if (connectionQuality.value === 'good') return '语音连接良好'
  if (connectionQuality.value === 'poor') return '语音连接不稳定'
  return '语音已断开'
})
</script>

<style scoped>
.vc-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  padding: 4px 10px;
  background: var(--color-danger-light);
  border-radius: var(--radius-md);
  max-width: 100%;
}

.vc-error-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-danger);
  font-weight: 500;
}

.vc-retry-btn {
  border: none;
  background: var(--color-danger);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}

.vc-retry-btn:hover {
  opacity: 0.85;
}

.vc-join-btn {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition: var(--transition);
}

.vc-join-btn:hover {
  background: var(--color-primary-dark);
}

.vc-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  background: linear-gradient(135deg, var(--color-accent-pale), var(--color-bg-warm));
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-full);
  padding: 3px 8px;
  box-shadow: var(--shadow-sm);
}

.vc-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  transition: var(--transition);
  white-space: nowrap;
}

.vc-btn:hover:not(:disabled) {
  background: var(--color-surface);
  color: var(--color-text);
}

.vc-btn.muted {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.vc-btn.forced {
  opacity: 0.35;
  cursor: not-allowed;
}

.vc-btn:disabled {
  cursor: not-allowed;
}

.vc-leave {
  color: var(--color-text-muted);
}

.vc-leave:hover:not(:disabled) {
  color: var(--color-danger) !important;
}

.vc-btn-icon {
  font-size: 13px;
  line-height: 1;
}

.vc-btn-label {
  font-size: 11px;
  font-weight: 600;
}

.vc-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border-light);
  margin: 0 4px;
}

.vc-talk-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  cursor: pointer;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  transition: var(--transition);
  white-space: nowrap;
}

.vc-talk-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.vc-talk-btn.active {
  background: var(--color-success);
  border-color: var(--color-success-dark);
  color: white;
}

.vc-talk-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vc-peers {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-number);
  white-space: nowrap;
}

.vc-quality {
  font-size: 11px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: var(--transition);
}

.vc-quality.quality-good {
  opacity: 1;
}

.vc-quality.quality-poor {
  opacity: 0.6;
  animation: qualityWarn 1.5s ease-in-out infinite;
}

.vc-quality.quality-disconnected {
  opacity: 0.3;
}

@keyframes qualityWarn {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
</style>
