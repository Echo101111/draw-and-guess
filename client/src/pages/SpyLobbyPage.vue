<template>
  <div class="spy-lobby">
    <div class="lobby-header">
      <button class="btn-back" @click="handleLeave">← 返回</button>
      <div class="lobby-title-area">
        <h1>🕵️ 谁是卧底</h1>
        <span class="room-name">房间：{{ roomStore.room?.name }}</span>
      </div>
      <div class="header-actions">
        <button class="btn-copy" @click="copyLink">📋 复制链接</button>
        <VoiceControls />
      </div>
    </div>

    <div class="lobby-body">
      <div class="player-section">
        <h2>玩家列表 ({{ players.length }}/{{ roomStore.room?.maxPlayers }})</h2>
        <TransitionGroup name="list" tag="div" class="player-list">
          <div v-for="p in players" :key="p.id" class="player-item">
            <span class="player-avatar">{{ p.nickname[0] }}</span>
            <span class="player-name">{{ p.nickname }}</span>
            <span v-if="p.isOwner" class="player-badge">👑</span>
            <button
              v-if="roomStore.isOwner && p.id !== roomStore.currentPlayerId"
              class="btn-kick"
              @click="kickPlayer(p.id)"
            >
              踢出
            </button>
          </div>
        </TransitionGroup>
      </div>

      <div class="config-section" v-if="roomStore.isOwner">
        <h2>游戏设置</h2>
        <div class="config-grid">
          <div class="config-field">
            <label>总轮数</label>
            <select v-model.number="spyConfig.totalRounds">
              <option v-for="n in [3,4,5,6,8,10]" :key="n" :value="n">{{ n }} 轮</option>
            </select>
          </div>
          <div class="config-field">
            <label>描述时间</label>
            <select v-model.number="spyConfig.descriptionTime">
              <option :value="15">15 秒</option>
              <option :value="20">20 秒</option>
              <option :value="30">30 秒</option>
              <option :value="45">45 秒</option>
              <option :value="60">60 秒</option>
            </select>
          </div>
          <div class="config-field">
            <label>投票时间</label>
            <select v-model.number="spyConfig.voteTime">
              <option :value="10">10 秒</option>
              <option :value="15">15 秒</option>
              <option :value="20">20 秒</option>
              <option :value="30">30 秒</option>
            </select>
          </div>
        </div>
      </div>

      <div class="info-section">
        <p><strong>玩法：</strong>每人获得一个词语（卧底的是不同的近义词），轮流描述自己的词语（不能说原词），投票找出卧底！</p>
        <p class="min-hint" v-if="players.length < 4">⚠️ 至少需要 4 名玩家</p>
      </div>

      <div class="action-section">
        <button
          v-if="roomStore.isOwner"
          class="btn-start"
          :disabled="players.length < 4"
          @click="handleStart"
        >
          🚀 开始游戏
        </button>
        <button class="btn-leave" @click="handleLeave">离开房间</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import VoiceControls from '@/components/VoiceControls.vue'
import { getSocket } from '@/composables/useSocket'
import { CLIENT_EVENTS } from '@draw-and-guess/shared'

const router = useRouter()
const roomStore = useRoomStore()

const players = roomStore.players

const spyConfig = reactive({
  totalRounds: 5,
  descriptionTime: 30,
  voteTime: 20,
})

onMounted(() => {
  document.body.style.overflow = 'hidden'
})

watch(() => roomStore.room?.state, (newState) => {
  if (newState === 'playing') {
    router.push(`/spy/game/${roomStore.roomName}`)
  }
})

function handleStart() {
  const socket = getSocket()
  socket?.emit(CLIENT_EVENTS.SPY_UPDATE_CONFIG, { config: { ...spyConfig } })
  setTimeout(() => {
    roomStore.startGame()
  }, 100)
}

function handleLeave() {
  roomStore.leaveRoom()
  document.body.style.overflow = ''
  router.push('/')
}

function kickPlayer(playerId: string) {
  roomStore.kickPlayer(playerId)
}

function copyLink() {
  const url = window.location.href
  navigator.clipboard.writeText(url).then(() => {
    alert('链接已复制！')
  })
}
</script>

<style scoped>
.spy-lobby {
  min-height: 100vh;
  background: var(--color-bg);
  padding: 16px;
  max-width: 640px;
  margin: 0 auto;
}

.lobby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
}

.lobby-title-area {
  text-align: center;
}

.lobby-title-area h1 {
  font-family: var(--font-title);
  font-size: 28px;
  color: var(--color-primary-dark);
  margin: 0;
}

.room-name {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.btn-back {
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.btn-back:hover {
  background: var(--color-bg-warm);
}

.btn-copy {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 12px;
  transition: var(--transition);
}

.btn-copy:hover {
  background: var(--color-bg-warm);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.lobby-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.player-section h2,
.config-section h2 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--color-text);
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.player-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent-pale);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
}

.player-name {
  flex: 1;
  font-weight: 500;
}

.player-badge {
  font-size: 16px;
}

.btn-kick {
  border: none;
  background: var(--color-danger-light);
  color: var(--color-danger);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
}

.config-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-field label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.config-field select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 14px;
  cursor: pointer;
}

.info-section {
  background: var(--color-accent-pale);
  padding: 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.6;
}

.min-hint {
  color: var(--color-danger);
  font-weight: 600;
  margin-top: 6px;
}

.action-section {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 8px 0;
}

.btn-start {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 12px 40px;
  border-radius: var(--radius-full);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.btn-start:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-start:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-leave {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  padding: 12px 24px;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: var(--transition);
}

.btn-leave:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
