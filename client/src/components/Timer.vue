<template>
  <div class="timer">
    <span class="time" :class="{ warning: timeLeft <= 10 }">
      {{ formatTime(timeLeft) }}
    </span>
    <span class="round">第 {{ currentRound }} / {{ totalRounds }} 轮</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()

const timeLeft = computed(() => gameStore.timeLeft)
const currentRound = computed(() => gameStore.currentRound)
const totalRounds = computed(() => gameStore.totalRounds)

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
  gap: 0.25rem;
  padding: 0.75rem 1.5rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.time {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  font-variant-numeric: tabular-nums;
}

.time.warning {
  color: #ff4444;
  animation: pulse 1s infinite;
}

.round {
  font-size: 0.9rem;
  color: #666;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>