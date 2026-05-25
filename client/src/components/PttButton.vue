<template>
  <div
    class="ptt-wrap"
    @pointerdown.prevent="onPointerDown"
    @pointerup.prevent="onPointerUp"
    @pointerleave="onPointerLeave"
    @touchcancel="onTouchCancel"
  >
    <button
      ref="btnRef"
      class="ptt-btn"
      :class="{ active: isPressed, disabled: disabled }"
      :disabled="disabled"
    >
      <span v-if="timeoutWarn" class="ptt-warn">⏱ 即将松开</span>
      <span v-else-if="isPressed" class="ptt-active">🟢 正在发言...</span>
      <span v-else class="ptt-idle">🎤 按住说话</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useWebRTC } from '@/composables/useWebRTC'
import { PTT_TIMEOUT_MS, PTT_WARN_BEFORE_MS } from '@draw-and-guess/shared'

const props = withDefaults(defineProps<{
  disabled?: boolean
}>(), {
  disabled: false,
})

const { startPtt, stopPtt } = useWebRTC()

const isPressed = ref(false)
const timeoutWarn = ref(false)
const btnRef = ref<HTMLElement | null>(null)

let pttTimer: ReturnType<typeof setTimeout> | null = null
let warnTimer: ReturnType<typeof setTimeout> | null = null
let globalUpHandler: ((e: PointerEvent) => void) | null = null

function clearTimers() {
  if (pttTimer !== null) {
    clearTimeout(pttTimer)
    pttTimer = null
  }
  if (warnTimer !== null) {
    clearTimeout(warnTimer)
    warnTimer = null
  }
}

function release() {
  if (!isPressed.value) return
  isPressed.value = false
  timeoutWarn.value = false
  clearTimers()
  stopPtt()
  removeGlobalListener()
}

function removeGlobalListener() {
  if (globalUpHandler) {
    document.removeEventListener('pointerup', globalUpHandler)
    globalUpHandler = null
  }
}

function onPointerDown() {
  if (props.disabled) return
  isPressed.value = true
  timeoutWarn.value = false
  startPtt()
  clearTimers()

  warnTimer = setTimeout(() => {
    timeoutWarn.value = true
  }, PTT_TIMEOUT_MS - PTT_WARN_BEFORE_MS)

  pttTimer = setTimeout(() => {
    timeoutWarn.value = false
    release()
  }, PTT_TIMEOUT_MS)

  // Global pointerup catch: if finger releases outside the button
  removeGlobalListener()
  globalUpHandler = (e: PointerEvent) => {
    if (e.button !== 0) return
    release()
  }
  document.addEventListener('pointerup', globalUpHandler, { once: true })
}

function onPointerUp() {
  if (!isPressed.value) return
  release()
}

function onPointerLeave() {
  if (!isPressed.value) return
  release()
}

function onTouchCancel() {
  if (!isPressed.value) return
  release()
}

onUnmounted(() => {
  clearTimers()
  removeGlobalListener()
})
</script>

<style scoped>
.ptt-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

.ptt-btn {
  width: 100%;
  max-width: 320px;
  padding: 14px 24px;
  border: 3px solid var(--color-primary);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-primary-dark);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
  position: relative;
  overflow: hidden;
}

.ptt-btn:hover:not(.disabled) {
  background: var(--color-accent-pale);
}

.ptt-btn.active {
  background: var(--color-success);
  border-color: var(--color-success-dark);
  color: white;
  transform: scale(1.03);
  box-shadow: 0 0 0 4px rgba(126, 184, 122, 0.25), 0 4px 12px rgba(126, 184, 122, 0.3);
}

.ptt-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--color-border);
}

.ptt-idle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.ptt-active {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  animation: pttPulse 1.2s ease-in-out infinite;
}

.ptt-warn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  animation: pttWarn 0.5s ease-in-out infinite alternate;
}

@keyframes pttPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pttWarn {
  0% { opacity: 0.5; transform: scale(0.98); }
  100% { opacity: 1; transform: scale(1.02); }
}
</style>
