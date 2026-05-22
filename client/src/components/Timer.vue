<template>
  <div class="timer">
    <div class="timer-ring" :class="{ warning: timeLeft <= 10 }">
      <svg viewBox="0 0 54 54" class="ring-svg">
        <circle cx="27" cy="27" r="23" class="ring-bg" />
        <circle
          cx="27" cy="27" r="23"
          class="ring-progress"
          :style="ringStyle"
          transform="rotate(-90, 27, 27)"
        />
      </svg>
      <span class="time">{{ formatTime(timeLeft) }}</span>
    </div>
    <span class="round">第 {{ currentRound }} / {{ totalRounds }} 轮</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDrawGameStore } from '@/stores/drawGame'

const gameStore = useDrawGameStore()

const timeLeft = computed(() => gameStore.timeLeft)
const currentRound = computed(() => gameStore.currentRound)
const totalRounds = computed(() => gameStore.totalRounds)

const maxTime = computed(() => gameStore.totalTime || 90)

const ringStyle = computed(() => {
  const circumference = 2 * Math.PI * 23
  const progress = Math.max(0, timeLeft.value / maxTime.value)
  const offset = circumference * (1 - progress)
  return {
    strokeDasharray: `${circumference}`,
    strokeDashoffset: `${offset}`,
  }
})

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.timer-ring {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.ring-bg {
  fill: none;
  stroke: var(--color-border-light);
  stroke-width: 4;
}

.ring-progress {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.timer-ring.warning .ring-progress {
  stroke: var(--color-danger);
}

.time {
  font-family: var(--font-number);
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--color-text);
  z-index: 1;
  font-variant-numeric: tabular-nums;
}

.timer-ring.warning .time {
  color: var(--color-danger);
  animation: pulse 1s ease-in-out infinite;
}

.round {
  font-family: var(--font-number);
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 480px) {
  .timer-ring {
    width: 36px;
    height: 36px;
  }

  .time {
    font-size: 0.75rem;
  }

  .round {
    font-size: 0.6rem;
  }
}
</style>
