<template>
  <div class="lobby-page">
    <div class="lobby-header">
      <h1>{{ room?.name ?? '房间' }}</h1>
      <p class="room-code">房间码: {{ roomCode }}</p>
    </div>

    <div class="lobby-content">
      <div class="players-section">
        <h2>玩家列表 ({{ players.length }}/{{ room?.maxPlayers ?? 50 }})</h2>
        <ul class="player-list">
          <li v-for="player in players" :key="player.id" class="player-item">
            <span class="player-name">
              {{ player.nickname }}
              <span v-if="player.isOwner" class="owner-badge">房主</span>
              <span v-if="player.id === currentPlayerId" class="you-badge">你</span>
            </span>
            <button
              v-if="isOwner && player.id !== currentPlayerId"
              class="btn-kick"
              @click="handleKick(player.id)"
            >
              踢出
            </button>
          </li>
        </ul>
      </div>

      <div class="actions">
        <button
          v-if="isOwner"
          class="btn-start"
          :disabled="players.length < 2 || gameState === 'playing'"
          @click="handleStartGame"
        >
          {{ players.length < 2 ? '等待更多玩家...' : '开始游戏' }}
        </button>

        <button class="btn-leave" @click="handleLeave">离开房间</button>
      </div>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()

const roomCode = computed(() => route.params.roomCode as string)

const room = computed(() => roomStore.room)
const players = computed(() => roomStore.players)
const currentPlayerId = computed(() => roomStore.currentPlayerId)
const isOwner = computed(() => roomStore.isOwner)
const gameState = computed(() => room.value?.state)

const errorMessage = ref<string | null>(null)

watch(() => roomStore.error, (newError) => {
  errorMessage.value = newError
})

watch(room, (newRoom) => {
  if (newRoom?.state === 'playing') {
    router.push(`/game/${roomCode.value}`)
  }
}, { immediate: true })

onMounted(() => {
  roomStore.setupSocketListeners()
})

function handleKick(playerId: string) {
  roomStore.kickPlayer(playerId)
}

function handleStartGame() {
  roomStore.startGame()
}

function handleLeave() {
  roomStore.leaveRoom()
  router.push('/')
}
</script>

<style scoped>
.lobby-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  gap: 2rem;
}

.lobby-header {
  text-align: center;
}

.lobby-header h1 {
  font-size: 2rem;
  color: #333;
}

.room-code {
  font-size: 1.2rem;
  color: #666;
  margin-top: 0.5rem;
}

.lobby-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  width: 100%;
  max-width: 500px;
}

.players-section {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.players-section h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: #333;
}

.player-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.player-name {
  font-size: 1rem;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.owner-badge {
  background: #ffd700;
  color: #333;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.you-badge {
  background: #4a90d9;
  color: #fff;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.btn-kick {
  padding: 0.375rem 0.75rem;
  background: #e53935;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-kick:hover {
  background: #c62828;
}

.actions {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.btn-start {
  flex: 1;
  padding: 1rem;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-start:hover:not(:disabled) {
  background: #43a047;
}

.btn-start:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-leave {
  padding: 1rem 2rem;
  background: #fff;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
}

.btn-leave:hover {
  background: #f5f5f5;
}

.error {
  color: #e53935;
  padding: 0.75rem;
  background: #ffebee;
  border-radius: 8px;
}
</style>