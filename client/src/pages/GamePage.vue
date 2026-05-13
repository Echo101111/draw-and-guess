<template>
  <div class="game-page">
    <header class="game-header">
      <div class="header-left">
        <div class="room-badge">
          <span class="badge-icon">🎮</span>
          <span class="badge-code">{{ roomName }}</span>
        </div>
      </div>
      <div class="header-center">
        <Timer v-if="gameStore.state === 'playing'" />
      </div>
      <div class="header-right">
        <button class="btn-leave" @click="handleLeave">离开</button>
      </div>
    </header>

    <main class="game-content">
      <aside class="sidebar sidebar-left" :class="{ open: showSidebar === 'left' }">
        <div class="sidebar-toggle sidebar-toggle-left" @click="toggleSidebar('left')">
          <span>🏆</span>
          <span class="toggle-label">积分</span>
        </div>
        <Scoreboard />
      </aside>

      <div class="game-area">
        <div v-if="gameStore.state === 'idle'" class="waiting">
          <div class="waiting-icon">🎨</div>
          <p>等待游戏开始...</p>
          <button
            v-if="roomStore.isOwner"
            class="btn-start-game"
            :disabled="roomStore.players.length < 2"
            @click="handleStartGame"
          >
            <span>{{ roomStore.players.length < 2 ? '等待更多玩家...' : '开始游戏' }}</span>
          </button>
        </div>

        <div v-else-if="gameStore.state === 'playing'" class="playing">
          <Transition name="pop">
            <div v-if="showDrawerAlert" class="drawer-alert" @click="closeDrawerAlert">
              <div class="drawer-alert-box" @click="closeDrawerAlert">
                <button class="drawer-alert-close" @click="closeDrawerAlert" title="关闭">✕</button>
                <div class="drawer-alert-icon">🎨</div>
                <div class="drawer-alert-text">轮到你了！</div>
                <div class="drawer-alert-sub">你是画师，开始画画吧</div>
              </div>
            </div>
          </Transition>
          <div class="role-info">
            <span v-if="gameStore.myRole === 'drawer'" class="role-badge drawer-badge">
              <span class="role-icon">🖌️</span> <span class="role-text">你在画画</span>
            </span>
            <span v-else-if="gameStore.myRole === 'guesser'" class="role-badge guesser-badge">
              <span class="role-icon">💡</span> <span class="role-text">你在猜题</span>
            </span>
            <span v-else class="role-badge spectator-badge">
              <span class="role-icon">👀</span> <span class="role-text">观战中</span>
            </span>
          </div>

          <div class="word-card">
            <template v-if="gameStore.myRole === 'drawer'">
              <span class="word-label">你要画的词</span>
              <span class="word-value">{{ gameStore.currentWord }}</span>
            </template>
            <template v-else>
              <span class="word-label">正在画的是</span>
              <span class="word-hint">{{ gameStore.drawerNickname }}</span>
            </template>
          </div>

          <div class="mobile-scores">
            <Scoreboard />
          </div>

          <GameCanvas :readonly="gameStore.myRole !== 'drawer'" />

          <div v-if="gameStore.myRole === 'drawer'" class="toolbar-container">
            <Toolbar />
          </div>

          <div v-if="gameStore.myRole === 'guesser'" class="answer-container">
            <AnswerInput :disabled="gameStore.hasGuessedCorrectly" />
          </div>

          <div class="inline-chat-wrap" :class="{ collapsed: !chatExpanded }">
            <div class="inline-chat-header" @click="chatExpanded = !chatExpanded">
              <span class="inline-chat-title">💬 聊天</span>
              <div class="inline-chat-preview" v-if="!chatExpanded && gameStore.chatMessages.length > 0">
                <span class="inline-chat-preview-text">{{ gameStore.chatMessages[gameStore.chatMessages.length - 1].text }}</span>
              </div>
              <span class="inline-chat-arrow" :class="{ open: chatExpanded }">▲</span>
            </div>
            <div class="inline-chat-body" v-show="chatExpanded">
              <ChatPanel />
            </div>
          </div>

          <Transition name="pop">
            <div v-if="gameStore.hasGuessedCorrectly" class="guessed-notice">
              <span>🎉 猜对了！</span>
            </div>
          </Transition>
        </div>

        <div v-else-if="gameStore.state === 'round_end'" class="round-transition">
          <div class="rt-content">
            <div class="rt-piece" :style="{ animationDelay: '0s' }">
              <div class="rt-round-label">第 {{ transitionRound }} / {{ transitionTotalRounds }} 轮</div>
            </div>
            <div class="rt-piece" :style="{ animationDelay: '0.25s' }">
              <div class="rt-answer-label">答案是</div>
              <div class="rt-word">{{ transitionWord }}</div>
            </div>
            <div class="rt-piece" :style="{ animationDelay: '0.6s' }">
              <div class="rt-reason-tag">{{ reasonText }}</div>
            </div>
            <div class="rt-piece rt-next-row" :style="{ animationDelay: '1.1s' }">
              <div class="rt-next-label">下一位画师</div>
              <div class="rt-next-name">{{ transitionNextDrawer }}</div>
            </div>
            <div class="rt-piece" :style="{ animationDelay: '1.8s' }">
              <div class="rt-countdown">
                <span class="rt-dot"></span>
                <span>准备中</span>
                <span class="rt-dot"></span>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="gameStore.state === 'game_over'" class="game-over">
          <div class="trophy-icon">🏆</div>
          <h2>游戏结束</h2>
          <div class="winner-section" v-if="gameStore.scores.length > 0">
            <span class="winner-label">获胜者</span>
            <span class="winner-name">{{ gameStore.scores[0].nickname }}</span>
          </div>
          <div class="final-scores">
            <h3>最终排名</h3>
            <Scoreboard />
          </div>
          <div class="game-over-actions">
            <button v-if="roomStore.isOwner" class="btn-restart" @click="handleRestartGame">重新开始</button>
            <button class="btn-back-lobby" @click="handleBackToLobby">返回房间</button>
            <button class="btn-leave-game" @click="handleLeave">离开游戏</button>
          </div>
        </div>
      </div>

      <aside class="sidebar sidebar-right" :class="{ open: showSidebar === 'right' }">
        <ChatPanel />
      </aside>

      <div v-if="showSidebar" class="sidebar-overlay" @click="showSidebar = null" />
    </main>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

const roomName = computed(() => route.params.roomName as string)
const showSidebar = ref<'left' | 'right' | null>(null)
const chatExpanded = ref(true)
const showDrawerAlert = ref(false)

const transitionWord = computed(() => gameStore.transitionData?.word ?? '')
const transitionRound = computed(() => gameStore.transitionData?.round ?? gameStore.currentRound)
const transitionTotalRounds = computed(() => gameStore.transitionData?.totalRounds ?? gameStore.totalRounds)
const transitionNextDrawer = computed(() => gameStore.transitionData?.nextDrawer?.nickname ?? '')

const reasonText = computed(() => {
  const reason = gameStore.transitionData?.reason
  if (reason === 'timeout') return '时间到'
  if (reason === 'all_guessed') return '全部猜对'
  return '本轮结束'
})

function closeDrawerAlert() {
  showDrawerAlert.value = false
  document.title = 'Draw & Guess'
}

watch(() => gameStore.myRole, (role) => {
  if (role === 'drawer') {
    showDrawerAlert.value = true
    document.title = '🎨 轮到你了！ - Draw & Guess'
  } else {
    closeDrawerAlert()
  }
})

// 新轮次开始时重置 alert 状态，同一个人再次当画师也能显示
watch(() => gameStore.currentRound, () => {
  if (gameStore.myRole === 'drawer' && gameStore.state === 'playing') {
    showDrawerAlert.value = true
    document.title = '🎨 轮到你了！ - Draw & Guess'
  }
})

function toggleSidebar(side: 'left' | 'right') {
  showSidebar.value = showSidebar.value === side ? null : side
}

onMounted(() => {
  const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin
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
  router.push(`/lobby/${roomName.value}`)
}

function handleRestartGame() {
  gameStore.resetGame()
  roomStore.startGame()
}

function handleStartGame() {
  roomStore.startGame()
}
</script>

<style scoped>
.game-page {
  position: relative;
  z-index: 1;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Header ─── */
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.25rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;
}

.header-center {
  flex: 1;
  justify-content: center;
}

.room-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  background: var(--color-accent-pale);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
}

.badge-icon { font-size: 0.9rem; }

.badge-code {
  font-family: var(--font-number);
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.1em;
}

.btn-leave {
  padding: 0.4rem 1rem;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: var(--transition);
}

.btn-leave:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text);
  background: var(--color-bg);
}

/* ─── Main layout ─── */
.game-content {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar :deep(*) {
  min-height: 0;
}

.sidebar-toggle {
  display: none;
}

.sidebar-overlay {
  display: none;
}

@media (max-width: 767px) {
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 45;
    background: rgba(74, 55, 40, 0.3);
    backdrop-filter: blur(2px);
  }
}

.game-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.playing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
}

.waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--color-text-muted);
  gap: 0.75rem;
}

.waiting-icon {
  font-size: 2.5rem;
  animation: bounce 2s ease-in-out infinite;
}

.btn-start-game {
  margin-top: 0.5rem;
  padding: 0.7rem 2rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.btn-start-game:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(232, 133, 108, 0.3);
}

.btn-start-game:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.role-info {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.role-badge {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 600;
}

.role-icon { font-size: 1rem; }
.role-text { font-size: 0.82rem; }

.drawer-badge {
  background: var(--color-accent-pale);
  color: var(--color-accent);
}

.guesser-badge {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.spectator-badge {
  background: var(--color-border-light);
  color: var(--color-text-secondary);
}

.word-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.4rem 1.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.word-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.word-value {
  font-family: var(--font-title);
  font-size: 1.4rem;
  color: var(--color-primary);
  letter-spacing: 0.05em;
  line-height: 1.2;
}

.word-hint {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.toolbar-container,
.answer-container {
  width: 100%;
  max-width: 800px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-scores {
  display: none;
}

.guessed-notice {
  padding: 0.4rem 1.25rem;
  background: var(--color-success-bg);
  color: var(--color-success);
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.85rem;
  border: 1px solid rgba(126, 184, 122, 0.3);
  flex-shrink: 0;
}

/* ─── Round Transition ─── */
.round-transition {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.rt-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.rt-piece {
  opacity: 0;
  transform: translateY(16px);
  animation: rtFadeIn 0.35s ease-out forwards;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

@keyframes rtFadeIn {
  to { opacity: 1; transform: translateY(0); }
}

.rt-round-label {
  font-family: var(--font-number);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.rt-answer-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.rt-word {
  font-family: var(--font-title);
  font-size: 2.2rem;
  color: var(--color-text);
  letter-spacing: 0.08em;
  line-height: 1.2;
  padding: 0.3rem 1.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 2px solid var(--color-accent);
  animation: rtWordPulse 2s ease-in-out infinite;
}

@keyframes rtWordPulse {
  0%, 100% { box-shadow: var(--shadow-md); }
  50% { box-shadow: 0 0 0 4px rgba(244, 162, 97, 0.15), 0 4px 20px rgba(244, 162, 97, 0.2); }
}

.rt-reason-tag {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  padding: 0.2rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border-light);
}

.rt-next-row {
  gap: 0.15rem;
}

.rt-next-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.rt-next-name {
  font-family: var(--font-title);
  font-size: 1.4rem;
  color: var(--color-primary-dark);
  font-weight: 600;
}

.rt-countdown {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  animation: rtPulse 1.2s ease-in-out infinite;
}

.rt-dot {
  display: inline-block;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--color-text-muted);
}

@keyframes rtPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.game-over {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-light);
  width: 100%;
  max-width: 400px;
  animation: popIn 0.4s ease-out;
}

.trophy-icon { font-size: 3rem; }

.game-over h2 {
  font-family: var(--font-title);
  font-size: 1.6rem;
  color: var(--color-text);
}

.winner-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.5rem 1.5rem;
  background: var(--color-gold-bg);
  border-radius: var(--radius-md);
}

.winner-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.winner-name {
  font-family: var(--font-title);
  font-size: 1.3rem;
  color: var(--color-gold);
}

.final-scores { width: 100%; }

.final-scores h3 {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  text-align: center;
}

.game-over-actions {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.btn-back-lobby {
  flex: 1;
  padding: 0.6rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.btn-back-lobby:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(232, 133, 108, 0.3);
}

.btn-restart {
  flex: 1;
  padding: 0.6rem;
  background: linear-gradient(135deg, var(--color-accent), var(--color-gold));
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.btn-restart:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(244, 162, 97, 0.3);
}

.btn-leave-game {
  padding: 0.6rem 1.25rem;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: var(--transition);
}

.btn-leave-game:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

/* ─── Drawer Alert ─── */
.drawer-alert {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 55, 40, 0.25);
  backdrop-filter: blur(3px);
}

.drawer-alert-box {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.5rem 2.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  border: 2px solid var(--color-accent);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.drawer-alert-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  transition: var(--transition);
  line-height: 1;
}

.drawer-alert-close:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.drawer-alert-icon {
  font-size: 2.5rem;
  animation: bounce 1s ease-in-out infinite alternate;
}

.drawer-alert-text {
  font-family: var(--font-title);
  font-size: 1.4rem;
  color: var(--color-accent);
  font-weight: 700;
}

.drawer-alert-sub {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

/* ─── Animations ─── */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: var(--shadow-lg); }
  50% { box-shadow: 0 0 0 4px rgba(244, 162, 97, 0.15), 0 8px 32px rgba(244, 162, 97, 0.2); }
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.pop-enter-active { animation: popIn 0.3s ease-out; }
.pop-leave-active { animation: popIn 0.3s ease-in reverse; }

/* ─── Tablet (768px–1024px) ─── */
@media (max-width: 1024px) {
  .game-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .sidebar {
    width: 200px;
  }
}

/* ─── Mobile (< 768px) ─── */
@media (max-width: 767px) {
  .game-header {
    padding: 0.4rem 0.6rem;
  }

  .room-badge {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
  }

  .badge-code {
    font-size: 0.75rem;
  }

  .btn-leave {
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
  }

  .game-content {
    flex-direction: column;
    padding: 0.4rem;
    gap: 0.4rem;
  }

  .sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 85vw;
    max-width: 300px;
    z-index: 50;
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
  }

  .sidebar-left {
    left: 0;
    transform: translateX(-110%);
  }

  .sidebar-left.open {
    transform: translateX(0);
  }

  .sidebar-right {
    display: none;
  }

  .sidebar-right.open {
    transform: translateX(0);
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition: var(--transition);
    z-index: 40;
  }

  .sidebar-toggle:active {
    transform: scale(0.95);
  }

  .sidebar-toggle-left {
    position: fixed;
    left: 0.5rem;
    bottom: 0.9rem;
  }

  .sidebar-toggle-right {
    display: none;
  }

  .toggle-label {
    display: none;
  }

  .playing {
    gap: 0;
    min-height: 0;
    overflow: hidden;
    justify-content: flex-start;
    padding-bottom: 0;
  }

  .mobile-scores {
    display: flex;
    width: 100%;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .mobile-scores :deep(.scoreboard) {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.5rem;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: var(--color-accent-pale);
    overflow-x: auto;
  }

  .mobile-scores :deep(.scoreboard-header) {
    display: none;
  }

  .mobile-scores :deep(.score-list) {
    flex-direction: row;
    padding: 0;
    gap: 0.5rem;
  }

  .mobile-scores :deep(.score-item) {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.1rem 0.3rem;
    font-size: 0.7rem;
    background: transparent;
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }

  .mobile-scores :deep(.score-item.first) {
    background: rgba(255, 215, 0, 0.12);
  }

  .mobile-scores :deep(.rank-medal) {
    width: auto;
    height: auto;
    font-size: 0.7rem;
  }

  .mobile-scores :deep(.nickname) {
    flex: none;
    font-size: 0.7rem;
    max-width: 3.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-scores :deep(.score) {
    font-size: 0.7rem;
  }

  .toolbar-container,
  .answer-container {
    max-width: 100%;
    flex-shrink: 0;
  }

  .word-card {
    padding: 0.15rem 0.8rem;
    flex-shrink: 0;
    flex-direction: row;
    gap: 0.4rem;
    border-radius: var(--radius-full);
  }

  .word-label {
    font-size: 0.7rem;
  }

  .word-value {
    font-size: 1rem;
  }

  .word-hint {
    font-size: 0.8rem;
  }

  .role-info {
    flex-shrink: 0;
  }

  .role-badge {
    padding: 0.15rem 0.6rem;
    font-size: 0.75rem;
  }

  .role-icon { font-size: 0.85rem; }
  .role-text { font-size: 0.75rem; }

  .game-over {
    padding: 1rem;
    margin: 0 auto;
  }

  .game-over h2 {
    font-size: 1.3rem;
  }

  .role-badge {
    padding: 0.25rem 0.75rem;
  }

  .role-text { font-size: 0.75rem; }

  /* ─── Round transition mobile ─── */
  .rt-round-label { font-size: 1.1rem; }
  .rt-word { font-size: 1.4rem; padding: 0.2rem 1rem; }
  .rt-next-name { font-size: 1.1rem; }
  .rt-reason-tag { font-size: 0.75rem; }
  .rt-countdown { font-size: 0.78rem; }

  .inline-chat-wrap {
    width: 100%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--color-border-light);
    background: var(--color-surface);
    max-height: 35vh;
  }

  .inline-chat-wrap.collapsed {
    max-height: none;
  }

  .inline-chat-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
    flex-shrink: 0;
    min-height: 2rem;
  }

  .inline-chat-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
  }

  .inline-chat-preview {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inline-chat-preview-text {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .inline-chat-preview-text::before {
    content: '· ';
    color: var(--color-text-muted);
  }

  .inline-chat-arrow {
    font-size: 0.6rem;
    color: var(--color-text-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .inline-chat-arrow.open {
    transform: rotate(180deg);
  }

  .inline-chat-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .inline-chat-body :deep(.chat-panel) {
    border: none;
    border-radius: 0;
    box-shadow: none;
    height: 100%;
  }

  .inline-chat-body :deep(.chat-header) {
    display: none;
  }

  .inline-chat-body :deep(.messages) {
    max-height: calc(35vh - 3rem);
    padding: 0.25rem 0.5rem;
  }

  .inline-chat-body :deep(.input-row) {
    padding: 0.35rem 0.5rem;
    border-top: 1px solid var(--color-border-light);
  }
}
</style>
