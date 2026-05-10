<template>
  <div class="scoreboard">
    <h3>积分榜</h3>
    <ul class="score-list">
      <li
        v-for="entry in sortedScores"
        :key="entry.playerId"
        :class="{ highlight: entry.rank === 1 }"
      >
        <span class="rank">{{ entry.rank }}</span>
        <span class="nickname">{{ entry.nickname }}</span>
        <span class="score">{{ entry.score }} 分</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()

const sortedScores = computed(() => {
  return [...gameStore.scores].sort((a, b) => a.rank - b.rank)
})
</script>

<style scoped>
.scoreboard {
  background: #fff;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
}

.scoreboard h3 {
  margin-bottom: 0.75rem;
  color: #333;
}

.score-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.score-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 6px;
}

.score-list li.highlight {
  background: #fff3cd;
  border: 2px solid #ffd700;
}

.rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #666;
  color: #fff;
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: bold;
}

.score-list li.highlight .rank {
  background: #ffd700;
  color: #333;
}

.nickname {
  flex: 1;
  font-weight: 500;
}

.score {
  color: #4a90d9;
  font-weight: bold;
}
</style>