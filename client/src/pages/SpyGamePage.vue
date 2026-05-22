<template>
  <div class="spy-game" @click="handleGlobalClick">
    <div class="game-header">
      <button class="btn-exit" @click="handleLeave">←</button>
      <SpyPhaseBanner
        :phase="store.phase"
        :speaker-name="store.currentSpeakerNickname"
        :time-left="store.timeLeft"
      />
      <div class="header-right">
        <span class="round-info">第 {{ store.round }}/{{ store.totalRounds }} 轮</span>
        <button class="btn-trophy" @click.stop="showScoreboard = !showScoreboard">🏆</button>
        <VoiceControls />
      </div>
    </div>

    <div class="game-area">
      <aside class="sidebar-left">
        <Scoreboard />
      </aside>

      <div class="game-center" :class="centerClass">
        <!-- 词语展示阶段 -->
        <div v-if="store.phase === 'word_distribution'" class="word-reveal-area">
          <SpyWordCard
            :word="store.myWord"
            :is-spy="store.isSpy"
            @revealed="onWordRevealed"
          />
        </div>

        <!-- 描述/投票 阶段 -->
        <template v-else-if="store.phase === 'describing' || store.phase === 'voting' || store.phase === 'reveal'">
          <SpyPlayerRing
            :players="store.players"
            :speaker-id="store.currentSpeaker?.playerId"
            :speaking-peers="webrtcPeers"
            :local-player-id="roomStore.currentPlayerId ?? ''"
            :selected-id="selectedVoteTarget"
            :has-voted="store.hasVoted"
            :phase="store.phase"
            @vote="(id: string) => handleVote(id)"
          />

          <div class="desc-list" v-if="store.descriptions.length > 0">
            <SpyDescriptionBubble
              v-for="d in store.descriptions"
              :key="d.playerId + d.round + d.timestamp"
              :description="d"
              :is-mine="d.playerId === roomStore.currentPlayerId"
            />
          </div>

          <div v-if="store.phase === 'voting' && !store.hasVoted" class="vote-prompt">
            点击上方玩家头像投票
          </div>
        </template>

        <!-- 回合结束 -->
        <div v-else-if="store.phase === 'round_end'" class="round-end-area">
          <div class="end-title">🔄 回合结束</div>
          <div v-if="store.lastEliminated" class="end-eliminated">
            {{ getPlayerName(store.lastEliminated) }} 被淘汰了！
          </div>
        </div>

        <!-- 游戏结束 -->
        <div v-else-if="store.phase === 'game_over'" class="game-over-area">
          <div class="go-title">🏆 游戏结束</div>
          <div class="go-winner">
            <span v-if="store.winner === 'civilian'">🎉 平民获胜！</span>
            <span v-else>🕵️ 卧底获胜！</span>
          </div>
          <div class="go-scores">
            <div v-for="s in store.scores" :key="s.playerId" class="go-score-row">
              <span>{{ s.nickname }}</span>
              <span>{{ s.score }} 分</span>
            </div>
          </div>
          <button class="btn-back-lobby" @click="handleLeave">返回大厅</button>
        </div>

        <!-- 空闲 -->
        <div v-else class="idle-area">
          <p>等待游戏开始...</p>
        </div>
      </div>

      <div class="sidebar-right">
        <ChatPanel />
      </div>
    </div>

    <!-- 底部操作区 -->
    <div class="game-footer">
      <div v-if="store.phase === 'describing' && store.isMyTurnToSpeak && !store.hasDescribed" class="description-input">
        <input
          ref="descInput"
          v-model="descText"
          placeholder="描述你的词语（不要说原词！）"
          maxlength="100"
          @keyup.enter="submitDesc"
        />
        <button class="btn-send" @click="submitDesc" :disabled="!descText.trim()">发送</button>
        <span class="desc-hint">也可以用语音描述</span>
      </div>

      <div v-else-if="store.phase === 'describing' && !store.isMyTurnToSpeak && !store.hasDescribed" class="waiting-hint">
        等待 {{ store.currentSpeakerNickname }} 描述...
      </div>

      <div v-else-if="store.phase === 'voting' && store.hasVoted" class="waiting-hint">
        ✅ 已投票，等待其他人...
      </div>
    </div>

    <!-- 移动端积分榜弹窗 -->
    <Transition name="fade">
      <div v-if="showScoreboard" class="scoreboard-overlay" @click.self="showScoreboard = false">
        <div class="scoreboard-modal">
          <div class="scoreboard-modal-header">
            <span>🏆 积分榜</span>
            <button class="scoreboard-modal-close" @click.stop="showScoreboard = false">✕</button>
          </div>
          <Scoreboard />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useSpyStore } from '@/stores/spy'
import { useWebRTC } from '@/composables/useWebRTC'
import SpyWordCard from '@/components/SpyWordCard.vue'
import SpyPlayerRing from '@/components/SpyPlayerRing.vue'
import SpyDescriptionBubble from '@/components/SpyDescriptionBubble.vue'
import SpyPhaseBanner from '@/components/SpyPhaseBanner.vue'
import Scoreboard from '@/components/Scoreboard.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import VoiceControls from '@/components/VoiceControls.vue'

const router = useRouter()
const roomStore = useRoomStore()
const store = useSpyStore()
const { speakingPeers: webrtcPeers } = useWebRTC()

const descText = ref('')
const descInput = ref<HTMLInputElement | null>(null)
const showScoreboard = ref(false)
const selectedVoteTarget = ref('')

const centerClass = computed(() => ({
  'center-desc': store.phase === 'describing',
  'center-vote': store.phase === 'voting',
}))

onMounted(() => {
  document.body.style.overflow = 'hidden'
  store.setupSocketListeners()
})

onUnmounted(() => {
  document.body.style.overflow = ''
  store.teardownSocketListeners()
})

watch(() => store.isMyTurnToSpeak, (val) => {
  if (val && store.phase === 'describing') {
    nextTick(() => descInput.value?.focus())
  }
})

function onWordRevealed() {}

function submitDesc() {
  const text = descText.value.trim()
  if (!text) return
  store.submitDescription(text)
  descText.value = ''
}

function handleVote(playerId: string) {
  if (store.hasVoted) return
  selectedVoteTarget.value = playerId
  store.vote(playerId)
}

function handleLeave() {
  roomStore.leaveRoom()
  router.push('/')
}

function getPlayerName(id: string): string {
  return store.players.find(p => p.id === id)?.nickname ?? id
}

function handleGlobalClick() {}
</script>

<style scoped>
.spy-game {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: var(--color-bg);
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  flex-shrink: 0;
  gap: 8px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
}

.btn-exit {
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: var(--transition);
}

.btn-exit:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.round-info {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-family: var(--font-number);
}

.btn-trophy {
  border: none;
  background: var(--color-bg-warm);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  display: none;
}

.game-area {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar-left {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border-light);
  overflow-y: auto;
  padding: 12px;
}

.game-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
  gap: 12px;
}

.sidebar-right {
  width: 260px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
}

.game-footer {
  flex-shrink: 0;
  padding: 10px 16px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.description-input {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  max-width: 500px;
}

.description-input input {
  flex: 1;
  padding: 8px 14px;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 14px;
  outline: none;
  transition: var(--transition);
}

.description-input input:focus {
  border-color: var(--color-primary-dark);
  box-shadow: 0 0 0 3px rgba(232, 133, 108, 0.15);
}

.btn-send {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 8px 20px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-weight: 600;
  transition: var(--transition);
}

.btn-send:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-send:disabled {
  opacity: 0.4;
}

.desc-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.waiting-hint {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.word-reveal-area {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.desc-list {
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.vote-prompt {
  color: var(--color-gold);
  font-weight: 600;
  font-size: 14px;
  margin-top: 8px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.round-end-area,
.game-over-area,
.idle-area {
  text-align: center;
}

.end-title,
.go-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.end-eliminated {
  font-size: 16px;
  color: var(--color-danger);
}

.go-winner {
  font-size: 20px;
  font-weight: 600;
  margin: 12px 0;
}

.go-scores {
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.go-score-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-bg-warm);
  border-radius: var(--radius-sm);
  min-width: 200px;
  font-weight: 500;
}

.btn-back-lobby {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 10px 28px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-weight: 600;
  margin-top: 16px;
  transition: var(--transition);
}

.btn-back-lobby:hover {
  background: var(--color-primary-dark);
}

.scoreboard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scoreboard-modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 20px;
  min-width: 260px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.scoreboard-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}

.scoreboard-modal-close {
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1024px) {
  .sidebar-left { width: 180px; }
  .sidebar-right { width: 200px; }
}

@media (max-width: 767px) {
  .sidebar-left {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 15;
    transform: translateX(-110%);
    transition: transform 0.3s ease;
    width: 260px;
    background: var(--color-surface);
  }

  .sidebar-left.open {
    transform: translateX(0);
  }

  .sidebar-right {
    display: none;
  }

  .btn-trophy {
    display: block;
  }

  .description-input {
    max-width: 100%;
  }
}
</style>
