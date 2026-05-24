<template>
  <div class="lobby-page">
    <div class="lobby-card">
      <div class="lobby-header">
        <div class="header-icon">🕵️</div>
        <h1>谁是卧底</h1>
        <div class="room-code-badge">
          <span class="code-label">房间</span>
          <span class="code-value">{{ roomStore.roomName }}</span>
          <button class="code-copy" @click="copyLink" title="复制房间名称">📋</button>
        </div>
      </div>

      <div class="players-section">
        <div class="players-header">
          <h2>玩家</h2>
          <span class="player-count">{{ players.length }} 位玩家</span>
        </div>

        <div class="player-list">
          <TransitionGroup name="player">
            <div v-for="player in players" :key="player.id" class="player-card">
              <div class="player-avatar">{{ player.nickname.charAt(0) }}</div>
              <div class="player-info">
                <span class="player-name">{{ player.nickname }}</span>
                <div class="player-tags">
                  <span v-if="player.id === roomStore.currentPlayerId" class="tag tag-you">你</span>
                  <span v-if="player.isOwner" class="tag tag-owner">房主</span>
                </div>
              </div>
              <button
                v-if="roomStore.isOwner && player.id !== roomStore.currentPlayerId"
                class="btn-kick"
                @click="kickPlayer(player.id)"
                title="踢出"
              >
                ✕
              </button>
            </div>
          </TransitionGroup>
          <div v-if="players.length === 0" class="empty-players">等待玩家加入...</div>
        </div>
      </div>

      <div class="lobby-actions">
        <button
          v-if="roomStore.isOwner"
          class="btn-start"
          :disabled="players.length < 2"
          @click="handleStart"
        >
          <span class="btn-start-icon">{{ players.length < 2 ? '👥' : '🕵️' }}</span>
           {{ players.length < 2 ? '等待更多玩家...' : '开始游戏' }}
        </button>

        <div class="lobby-actions-secondary">
          <button
            v-if="roomStore.isOwner && roomStore.room?.state !== 'playing'"
            class="btn-secondary"
            @click="toggleGameType"
          >
            <span>{{ roomStore.room?.gameType === 'spy' ? '🎨' : '🕵️' }}</span>
            切换{{ roomStore.room?.gameType === 'spy' ? '你画我猜' : '谁是卧底' }}
          </button>
          <button v-if="roomStore.isOwner" class="btn-secondary" @click="showConfig = true">
            ⚙️ 游戏设置
          </button>
          <button v-if="roomStore.isOwner" class="btn-danger" @click="dismissRoom">
            🗑️ 解散房间
          </button>
          <button class="btn-secondary btn-leave" @click="handleLeave">离开房间</button>
        </div>
      </div>
    </div>

    <!-- 游戏设置弹窗 -->
    <Transition name="fade">
      <div v-if="showConfig" class="config-overlay" @click.self="showConfig = false">
        <div class="config-modal">
          <div class="config-modal-header">
            <span>⚙️ 游戏设置</span>
            <button class="config-close" @click="showConfig = false">✕</button>
          </div>
          <div class="config-modal-body">
            <div class="config-row">
              <div class="config-item">
                <label>总轮数</label>
                <select v-model.number="spyConfig.totalRounds">
                  <option :value="2">2 轮</option>
                  <option :value="3">3 轮</option>
                  <option :value="4">4 轮</option>
                  <option :value="5">5 轮</option>
                </select>
              </div>
              <div class="config-item">
                <label>描述时间</label>
                <select v-model.number="spyConfig.descriptionTime">
                  <option :value="15">15 秒</option>
                  <option :value="20">20 秒</option>
                  <option :value="30">30 秒</option>
                  <option :value="45">45 秒</option>
                  <option :value="60">60 秒</option>
                </select>
              </div>
              <div class="config-item">
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
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <p v-if="errorMessage" class="error-toast">{{ errorMessage }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useSpyStore } from '@/stores/spy'
import { getSocket } from '@/composables/useSocket'
import { CLIENT_EVENTS } from '@draw-and-guess/shared'

const router = useRouter()
const roomStore = useRoomStore()
const spyStore = useSpyStore()

const players = computed(() => roomStore.players)
const showConfig = ref(false)
const errorMessage = ref<string | null>(null)

const spyConfig = reactive({
  totalRounds: 3,
  descriptionTime: 30,
  voteTime: 20,
})



onMounted(() => {
  document.title = '🕵️ 谁是卧底 - Oiiiii早春'
  document.body.style.overflow = 'hidden'
  roomStore.setupSocketListeners()
  spyStore.setupSocketListeners()
})

onUnmounted(() => {
  document.title = 'Oiiiii早春 - 派对游戏'
})

watch(() => roomStore.room?.state, (newState) => {
  if (newState === 'playing') {
    router.push(`/spy/game/${roomStore.roomName}`)
  }
})

// 游戏类型切换 — 切为 draw 时重定向
watch(() => roomStore.room?.gameType, (gameType) => {
  if (gameType === 'draw' && roomStore.room) {
    router.push(`/draw/lobby/${roomStore.roomName}`)
  }
})

function toggleGameType() {
  const socket = getSocket()
  if (!socket?.connected) return
  const newType = roomStore.room?.gameType === 'spy' ? 'draw' : 'spy'
  socket.emit(CLIENT_EVENTS.UPDATE_GAME_TYPE, { gameType: newType })
}

function dismissRoom() {
  const socket = getSocket()
  if (socket?.connected) {
    socket.emit(CLIENT_EVENTS.DISMISS_ROOM)
  }
}

function handleStart() {
  const socket = getSocket()
  if (!socket?.connected) return
  socket.emit(CLIENT_EVENTS.SPY_UPDATE_CONFIG, { config: { ...spyConfig } })
  roomStore.startGame()
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
.lobby-page {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem 1rem;
}

.lobby-card {
  width: 100%;
  max-width: 480px;
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
  animation: slideUp 0.5s ease-out;
}

/* ---- Header ---- */
.lobby-header {
  text-align: center;
  padding: 2rem 2rem 1.5rem;
  background: linear-gradient(180deg, var(--color-accent-pale) 0%, var(--color-surface) 100%);
  border-bottom: 1px solid var(--color-border-light);
}

.header-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }

.lobby-header h1 {
  font-family: var(--font-title);
  font-size: 1.8rem;
  color: var(--color-text);
  margin-bottom: 0.75rem;
}

.room-code-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-surface);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
}

.code-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.code-value {
  font-family: var(--font-number);
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 0.15em;
}

.code-copy {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem;
  border-radius: 4px;
  transition: var(--transition);
  line-height: 1;
}

.code-copy:hover {
  background: var(--color-border-light);
}

/* ---- Players ---- */
.players-section { padding: 1.5rem 2rem; }

.players-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.players-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.player-count {
  font-family: var(--font-number);
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
  transition: var(--transition);
}

.player-card:hover {
  border-color: var(--color-border);
  box-shadow: var(--shadow-sm);
}

.player-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent-pale), var(--color-bg-warm));
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  overflow: hidden;
}

.player-avatar svg {
  width: 60%;
  height: 60%;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.player-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
}

.player-tags {
  display: flex;
  gap: 0.3rem;
}

.tag {
  font-size: 0.7rem;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-full);
  font-weight: 600;
}

.tag-you {
  background: var(--color-accent-pale);
  color: var(--color-accent);
}

.tag-owner {
  background: var(--color-gold-bg);
  color: var(--color-gold);
}

.btn-kick {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--color-danger-light);
  color: var(--color-danger);
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  transition: var(--transition);
  opacity: 0;
}

.player-card:hover .btn-kick {
  opacity: 1;
}

.btn-kick:hover {
  background: var(--color-danger);
  color: #fff;
}

.empty-players {
  text-align: center;
  color: var(--color-text-muted);
  padding: 2rem;
  font-size: 0.95rem;
}

/* ---- Actions ---- */
.lobby-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem 1.5rem 1.5rem;
  border-top: 1px solid var(--color-border-light);
}

.lobby-actions-secondary {
  display: flex;
  gap: 0.5rem;
}

.lobby-actions-secondary .btn-secondary {
  flex: 1;
}

.btn-start {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  letter-spacing: 0.03em;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(232, 133, 108, 0.35);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start-icon {
  font-size: 1.1rem;
}

.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.55rem 0.75rem;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.btn-secondary:hover {
  border-color: var(--color-accent);
  background: var(--color-bg-warm);
}

.btn-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.55rem 0.75rem;
  background: var(--color-surface);
  color: #e74c3c;
  border: 1.5px solid var(--color-danger-light);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.btn-danger:hover {
  background: #fef2f2;
  border-color: #e74c3c;
}

.btn-secondary.btn-leave:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: var(--color-danger-light);
}

/* ---- Config Modal ---- */
.config-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(4px);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.config-modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 360px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.config-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-light);
  font-weight: 700;
  font-size: 1rem;
}

.config-close {
  border: none;
  background: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.config-close:hover { background: var(--color-bg-warm); }

.config-modal-body {
  padding: 1.25rem;
}

.config-row {
  display: flex;
  gap: 12px;
}

.config-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-item label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.config-item select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: 14px;
  font-family: var(--font-number);
  color: var(--color-text);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23B5A392' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 24px;
}

/* ---- Toast ---- */
.error-toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-danger-light);
  color: var(--color-danger);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-full);
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(217, 117, 107, 0.2);
  z-index: 100;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

/* ---- Player animation ---- */
.player-enter-active,
.player-leave-active {
  transition: all 0.3s ease;
}
.player-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.player-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* ---- Mobile ---- */
@media (max-width: 480px) {
  .lobby-card {
    border-radius: var(--radius-lg);
  }

  .lobby-header {
    padding: 1.5rem 1rem 1rem;
  }

  .header-icon {
    font-size: 2rem;
  }

  .lobby-header h1 {
    font-size: 1.4rem;
  }

  .code-value {
    font-size: 1.1rem;
  }

  .players-section {
    padding: 1rem;
  }

  .lobby-actions {
    padding: 0.75rem 1rem 1rem;
  }

  .lobby-actions-secondary {
    flex-direction: column;
  }
}
</style>
