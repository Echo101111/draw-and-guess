<template>
  <div class="game-page">
    <header class="game-header">
      <div class="room-info">
        <h1>你画我猜</h1>
        <span class="room-code">房间: {{ roomCode }}</span>
      </div>
      <Timer v-if="gameStore.state === 'playing'" />
      <button class="btn-leave" @click="handleLeave">离开</button>
    </header>

    <main class="game-content">
      <aside class="sidebar left">
        <Scoreboard />
      </aside>

      <div class="game-area">
        <div v-if="gameStore.state === 'idle'" class="waiting">
          <p>等待游戏开始...</p>
        </div>

        <div v-else-if="gameStore.state === 'playing'" class="playing">
          <div class="role-info">
            <span v-if="gameStore.myRole === 'drawer'" class="role-badge drawer">
              你在画画
            </span>
            <span v-else-if="gameStore.myRole === 'guesser'" class="role-badge guesser">
              你在猜题
            </span>
            <span v-else class="role-badge spectator">
              观战中
            </span>
          </div>

          <div class="word-display" :class="{ drawer: gameStore.myRole === 'drawer' }">
            <span v-if="gameStore.myRole === 'drawer'" class="word">{{ gameStore.currentWord }}</span>
            <span v-else class="hint">画的是: {{ gameStore.drawerNickname }}</span>
          </div>

          <GameCanvas :readonly="gameStore.myRole !== 'drawer'" />

          <div v-if="gameStore.myRole === 'drawer'" class="toolbar-container">
            <Toolbar />
          </div>

          <div v-if="gameStore.myRole === 'guesser'" class="answer-container">
            <AnswerInput :disabled="gameStore.hasGuessedCorrectly" />
          </div>

          <div v-if="gameStore.hasGuessedCorrectly" class="guessed-notice">
            你已经猜对了！
          </div>
        </div>

        <div v-else-if="gameStore.state === 'round_end'" class="round-end">
          <h2>本轮结束</h2>
          <p>等待下一轮开始...</p>
        </div>

        <div v-else-if="gameStore.state === 'game_over'" class="game-over">
          <h2>游戏结束</h2>
          <div class="winner">
            <span v-if="gameStore.scores.length > 0">获胜者: {{ gameStore.scores[0].nickname }}</span>
          </div>
          <div class="final-scores">
            <h3>最终排名</h3>
            <Scoreboard />
          </div>
          <div class="game-over-actions">
            <button class="btn-back-lobby" @click="handleBackToLobby">返回房间</button>
            <button class="btn-leave" @click="handleLeave">离开游戏</button>
          </div>
        </div>
      </div>

      <aside class="sidebar right">
        <ChatPanel />
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useGameStore } from '@/stores/game'
import { connectSocket, disconnectSocket } from '@/composables/useSocket'
import Timer from '@/components/Timer.vue'
import Scoreboard from '@/components/Scoreboard.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import GameCanvas from '@/components/GameCanvas.vue'
import Toolbar from '@/components/Toolbar.vue'
import AnswerInput from '@/components/AnswerInput.vue'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()

const roomCode = computed(() => route.params.roomCode as string)

onMounted(() => {
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
  connectSocket(serverUrl)
  gameStore.setupSocketListeners()
})

onUnmounted(() => {
  gameStore.resetGame()
})

function handleLeave() {
  disconnectSocket()
  gameStore.resetGame()
  roomStore.leaveRoom()
  router.push('/')
}

function handleBackToLobby() {
  gameStore.resetGame()
  router.push(`/lobby/${roomCode.value}`)
}
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f0f0;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.room-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.room-info h1 {
  font-size: 1.5rem;
  color: #333;
}

.room-code {
  color: #666;
  font-size: 0.9rem;
}

.btn-leave {
  padding: 0.5rem 1rem;
  background: #fff;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
}

.btn-leave:hover {
  background: #f5f5f5;
}

.game-content {
  flex: 1;
  display: flex;
  gap: 1rem;
  padding: 1rem 2rem;
}

.sidebar {
  width: 280px;
  flex-shrink: 0;
}

.sidebar.left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.game-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.waiting {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #666;
}

.playing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.role-info {
  display: flex;
  justify-content: center;
}

.role-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.role-badge.drawer {
  background: #ffd700;
  color: #333;
}

.role-badge.guesser {
  background: #4a90d9;
  color: #fff;
}

.role-badge.spectator {
  background: #888;
  color: #fff;
}

.word-display {
  padding: 0.75rem 2rem;
  background: #fff;
  border-radius: 8px;
  font-size: 1.2rem;
}

.word-display .word {
  font-size: 1.5rem;
  font-weight: bold;
  color: #4a90d9;
}

.word-display .hint {
  color: #666;
}

.toolbar-container,
.answer-container {
  width: 100%;
  max-width: 800px;
  display: flex;
  justify-content: center;
}

.guessed-notice {
  padding: 0.75rem 1.5rem;
  background: #4caf50;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
}

.round-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  min-height: 400px;
  justify-content: center;
}

.round-end h2 {
  font-size: 2rem;
  color: #333;
}

.game-over {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: #fff;
  border-radius: 12px;
}

.game-over h2 {
  font-size: 2rem;
  color: #333;
}

.winner {
  font-size: 1.2rem;
  color: #ffd700;
  font-weight: bold;
}

.final-scores {
  width: 100%;
  max-width: 400px;
}

.game-over-actions {
  display: flex;
  gap: 1rem;
}

.btn-back-lobby {
  padding: 0.75rem 1.5rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-back-lobby:hover {
  background: #3a7fc9;
}
</style>