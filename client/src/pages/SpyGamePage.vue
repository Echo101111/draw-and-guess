<template>
  <div class="spy-game">
    <!-- ====== HEADER ====== -->
    <header class="game-header">
      <button class="btn-exit" @click="handleLeave">←</button>
      <div class="header-center">
        <span class="header-game">🕵️ 谁是卧底</span>
        <span class="header-round">第 {{ store.round }}/{{ store.totalRounds }} 轮</span>
      </div>
      <div class="header-right">
        <span v-if="store.timeLeft > 0" class="header-timer">⏱ {{ store.timeLeft }}s</span>
        <button class="btn-tab" :class="{ active: activeTab }" @click="switchTab">🏆</button>
      </div>
    </header>

    <!-- ====== PHASE BANNER ====== -->
    <div v-if="phaseLabel" class="phase-strip" :class="phaseClass">
      <span>{{ phaseLabel }}</span>
    </div>

    <!-- ====== CONTENT AREA ====== -->
    <div class="game-body">
      <!-- Desktop: left sidebar -->
      <aside class="sidebar-scores">
        <Scoreboard />
      </aside>

      <!-- Mobile: tab content -->
      <div v-if="activeTab" class="mobile-tab-content">
        <div class="tab-panel">
          <button class="tab-close" @click="activeTab = false">✕</button>
          <Scoreboard />
        </div>
      </div>

      <!-- CENTER: game content -->
      <div class="game-center">
        <!-- word_distribution -->
        <div v-if="store.phase === 'word_distribution'" class="center-card word-stage">
          <SpyWordCard
            :word="store.myWord"
            :is-spy="store.isSpy"
            @revealed="onWordRevealed"
          />
        </div>

        <!-- describing / voting / discussion / reveal  -->
        <template v-else-if="store.phase === 'describing' || store.phase === 'voting' || store.phase === 'discussion' || store.phase === 'reveal'">
          <!-- Word badge (persistent) -->
          <div class="word-badge" :class="{ spy: store.isSpy }">
            <span class="word-badge-label">你的词语</span>
            <span class="word-badge-text">{{ store.myWord }}</span>
            <span v-if="store.isSpy" class="word-badge-tag">🕵️ 卧底</span>
          </div>

          <!-- Player ring -->
          <div class="ring-section">
            <SpyPlayerRing
              :players="store.players"
              :speaker-id="store.currentSpeaker?.playerId"
              :local-player-id="roomStore.currentPlayerId ?? ''"
              :selected-id="selectedVoteTarget"
              :has-voted="store.hasVoted"
              :phase="store.phase"
              @vote="(id: string) => handleVote(id)"
            />
          </div>

          <!-- Descriptions / Chat unified stream -->
          <div v-if="conversationStream.length > 0" class="desc-section">
            <SpyDescriptionBubble
              v-for="item in conversationStream"
              :key="item.id"
              :description="{ nickname: item.nickname, text: item.text }"
              :is-mine="item.isMine"
              :is-system="item.isSystem"
            />
          </div>

          <!-- Vote panel -->
          <div v-if="store.phase === 'voting'" class="vote-panel">
            <!-- Countdown ring -->
            <div class="vote-countdown">
              <svg class="vote-ring" viewBox="0 0 60 60">
                <circle class="vote-ring-bg" cx="30" cy="30" r="26" />
                <circle
                  class="vote-ring-fg"
                  :class="{ urgent: store.timeLeft <= 5 }"
                  cx="30" cy="30" r="26"
                  :style="{ strokeDashoffset: voteRingOffset }"
                />
              </svg>
              <span class="vote-countdown-num">{{ store.timeLeft }}</span>
            </div>

            <!-- Prompt -->
            <div v-if="!store.hasVoted" class="vote-prompt">
              <span class="vote-prompt-icon">👆</span>
              <span>点击上方头像投票</span>
            </div>

            <!-- Progress -->
            <div v-else class="vote-progress">
              <div class="vote-progress-text">✅ 已投票</div>
              <div class="vote-progress-bar-wrap">
                <div
                  class="vote-progress-bar"
                  :style="{ width: voteProgressPct + '%' }"
                />
              </div>
              <div class="vote-progress-label">
                {{ store.votedCount }}/{{ store.totalVoters }} 人已投票
              </div>
            </div>
          </div>
        </template>

        <!-- round_end -->
        <div v-else-if="store.phase === 'round_end'" class="center-card result-stage">
          <div class="result-icon">🔄</div>
          <div class="result-title">回合结束</div>
          <div v-if="store.lastEliminated" class="result-eliminated">
            {{ getPlayerName(store.lastEliminated) }} 被淘汰
          </div>
        </div>

        <!-- game_over -->
        <div v-else-if="store.phase === 'game_over'" class="center-card result-stage">
          <div class="result-icon">🏆</div>
          <div class="result-title">游戏结束</div>
          <div class="result-winner">
            <span v-if="store.winner === 'civilian'">🎉 平民获胜</span>
            <span v-else>🕵️ 卧底获胜</span>
          </div>

          <!-- Word reveal -->
          <div v-if="store.civilianWord && store.spyWord" class="word-reveal">
            <div class="word-reveal-label">📖 词汇揭晓</div>
            <div class="word-reveal-cards">
              <div class="word-card civilian-card">
                <div class="word-card-header">👤 平民词</div>
                <div class="word-card-word">{{ store.civilianWord }}</div>
              </div>
              <div class="word-card-vs">🆚</div>
              <div class="word-card spy-card">
                <div class="word-card-header">
                  🕵️ 卧底词
                  <span class="word-card-spy-name">{{ spyPlayerName }}</span>
                </div>
                <div class="word-card-word">{{ store.spyWord }}</div>
              </div>
            </div>
          </div>

          <div class="score-list">
            <div v-for="s in store.scores" :key="s.playerId" class="score-row">
              <span class="score-rank">#{{ s.rank }}</span>
              <span class="score-name">{{ s.nickname }}</span>
              <span class="score-pts">{{ s.score }}分</span>
            </div>
          </div>
          <div class="go-actions">
            <button class="btn-primary" @click="handleRestart" v-if="roomStore.isOwner">🔄 再来一局</button>
            <button class="btn-secondary" @click="handleLeave">返回大厅</button>
          </div>
        </div>

        <!-- idle -->
        <div v-else class="center-card">
          <p class="idle-text">等待开始...</p>
        </div>
      </div>
    </div>

    <!-- ====== FOOTER ====== -->
    <footer class="game-footer">
      <!-- My turn to describe -->
      <div v-if="store.phase === 'describing' && store.isMyTurnToSpeak && !store.hasDescribed" class="footer-action">
        <div class="action-input-wrap">
          <input
            ref="descInput"
            v-model="descText"
            class="action-input"
            placeholder="描述你的词..."
            maxlength="100"
            @keyup.enter="submitDesc"
          />
          <button class="action-send" @click="submitDesc" :disabled="!descText.trim()">发送</button>
        </div>
        <span class="action-hint">💡 不要直接说出你的词语</span>
      </div>

      <!-- Waiting for speaker -->
      <div v-else-if="store.phase === 'describing' && !store.isMyTurnToSpeak && !store.hasDescribed" class="footer-status">
        <div class="status-speaker">
          <span class="status-dot" />
          <span>{{ store.currentSpeakerNickname }} 正在描述</span>
        </div>
      </div>

      <!-- Waiting for others after describing -->
      <div v-else-if="store.phase === 'describing' && store.hasDescribed" class="footer-status">
        <span>✅ 已描述，等待其他人...</span>
      </div>

      <!-- Discussion phase -->
      <div v-else-if="store.phase === 'discussion'" class="footer-action">
        <div class="action-input-wrap">
          <input
            ref="descInput"
            v-model="discussText"
            class="action-input"
            placeholder="自由讨论..."
            maxlength="200"
            @keyup.enter="sendDiscuss"
          />
          <button class="action-send" @click="sendDiscuss" :disabled="!discussText.trim()">发送</button>
        </div>
        <span class="action-hint">💡 描述词语或质疑其他人</span>
      </div>

      <!-- Voting done -->
      <div v-else-if="store.phase === 'voting' && store.hasVoted" class="footer-status">
        <span>✅ 已投票，等待结果...</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useSpyStore } from '@/stores/spy'
import SpyWordCard from '@/components/SpyWordCard.vue'
import SpyPlayerRing from '@/components/SpyPlayerRing.vue'
import SpyDescriptionBubble from '@/components/SpyDescriptionBubble.vue'
import Scoreboard from '@/components/Scoreboard.vue'

const router = useRouter()
const roomStore = useRoomStore()
const store = useSpyStore()

const descText = ref('')
const discussText = ref('')
const descInput = ref<HTMLInputElement | null>(null)
const selectedVoteTarget = ref('')
const activeTab = ref(false)

const PHASE_LABELS: Record<string, string> = {
  word_distribution: '🔍 查看你的词语',
  describing: '💬 描述阶段',
  discussion: '💭 自由讨论',
  voting: '🗳️ 投票阶段',
  reveal: '📊 结果揭晓',
}

const phaseLabel = computed(() => PHASE_LABELS[store.phase] ?? '')
const phaseClass = computed(() => {
  if (store.phase === 'voting') return 'phase-vote'
  if (store.phase === 'describing') return 'phase-desc'
  if (store.phase === 'discussion') return 'phase-discuss'
  return ''
})

const conversationStream = computed(() => {
  const items: Array<{
    id: string; nickname: string; text: string; isMine: boolean; isSystem: boolean; time: number
  }> = []

  for (const d of store.descriptions) {
    items.push({
      id: `desc-${d.playerId}-${d.round}-${d.timestamp}`,
      nickname: d.nickname,
      text: d.text,
      isMine: d.playerId === roomStore.currentPlayerId,
      isSystem: false,
      time: d.timestamp,
    })
  }

  for (const m of store.chatMessages) {
    items.push({
      id: `chat-${m.id}`,
      nickname: m.nickname ?? '系统',
      text: m.text,
      isMine: m.playerId === roomStore.currentPlayerId,
      isSystem: m.isSystem,
      time: m.timestamp,
    })
  }

  return items.sort((a, b) => a.time - b.time)
})

function switchTab() {
  activeTab.value = !activeTab.value
}

onMounted(() => {
  document.title = '🕵️ 谁是卧底 - Oiiiii早春'
  document.body.style.overflow = 'hidden'
  store.setupSocketListeners()
})

onUnmounted(() => {
  document.title = 'Oiiiii早春 - 派对游戏'
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

function sendDiscuss() {
  const text = discussText.value.trim()
  if (!text) return
  store.sendChat(text)
  discussText.value = ''
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

function handleRestart() {
  store.resetGame()
  roomStore.startGame()
}

function getPlayerName(id: string): string {
  return store.players.find(p => p.id === id)?.nickname ?? id
}

const spyPlayerName = computed(() => {
  return store.players.find(p => p.isSpy)?.nickname ?? ''
})

const voteRingOffset = computed(() => {
  const maxTime = store.voteTimeMax || 20
  const ratio = Math.min(store.timeLeft / maxTime, 1)
  const circumference = 2 * Math.PI * 26
  return circumference * (1 - ratio)
})

const voteProgressPct = computed(() => {
  if (store.totalVoters === 0) return 0
  return Math.round((store.votedCount / store.totalVoters) * 100)
})
</script>

<style scoped>
.spy-game {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-bg);
}

/* ====== HEADER ====== */
.game-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  gap: 8px;
}

.btn-exit {
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.btn-exit:hover { background: var(--color-danger-light); color: var(--color-danger); }

.header-center {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.header-game {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  white-space: nowrap;
}

.header-round {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-family: var(--font-number);
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-timer {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  font-family: var(--font-number);
  background: var(--color-bg-warm);
  padding: 2px 10px;
  border-radius: var(--radius-full);
}

.btn-tab {
  border: none;
  background: none;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0.5;
  transition: var(--transition);
}

.btn-tab.active { opacity: 1; background: var(--color-accent-pale); }

/* ====== PHASE BANNER ====== */
.phase-strip {
  text-align: center;
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--color-bg-warm);
  color: var(--color-text-secondary);
  transition: var(--transition);
}

.phase-strip.phase-desc { background: var(--color-accent-pale); color: var(--color-primary-dark); }
.phase-strip.phase-vote { background: var(--color-danger-light); color: var(--color-danger); }
.phase-strip.phase-discuss { background: var(--color-primary-light); color: white; }

/* ====== BODY ====== */
.game-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.sidebar-scores {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border-light);
  overflow-y: auto;
}

.game-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  gap: 8px;
}

/* ====== CENTER CARDS ====== */
.center-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  flex: 1;
}

.word-stage { gap: 16px; }

/* ====== PLAYER RING ====== */
.ring-section {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 8px 0;
  flex-shrink: 0;
}

/* ====== WORD BADGE ====== */
.word-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--color-accent-pale);
  border: 1px solid var(--color-accent-light);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.word-badge.spy {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
}

.word-badge-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.word-badge-text {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 1px;
}

.word-badge-tag {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-danger);
  background: var(--color-surface);
  padding: 1px 6px;
  border-radius: var(--radius-full);
}

/* ====== DESCRIPTIONS ====== */
.desc-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
  min-height: 60px;
  padding: 4px 0;
}

/* ====== VOTE HINT ====== */
/* ====== VOTE PANEL ====== */
.vote-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 280px;
  flex-shrink: 0;
  animation: votePanelIn 0.3s ease-out;
}

@keyframes votePanelIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.vote-countdown {
  position: relative;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vote-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.vote-ring-bg {
  fill: none;
  stroke: var(--color-border-light);
  stroke-width: 4;
}

.vote-ring-fg {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 163.36;
  transition: stroke-dashoffset 0.5s ease, stroke 0.3s;
}

.vote-ring-fg.urgent {
  stroke: var(--color-danger);
}

.vote-countdown-num {
  font-family: var(--font-number);
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--color-text);
  z-index: 1;
}

.vote-prompt {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  animation: votePulse 1.8s ease-in-out infinite;
}

.vote-prompt-icon {
  font-size: 1rem;
  animation: votePoint 1s ease-in-out infinite;
}

@keyframes votePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes votePoint {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.vote-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  animation: fadeSlideIn 0.3s ease-out;
}

.vote-progress-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-success);
}

.vote-progress-bar-wrap {
  width: 100%;
  height: 5px;
  background: var(--color-border-light);
  border-radius: 3px;
  overflow: hidden;
}

.vote-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
  border-radius: 3px;
  transition: width 0.4s ease;
}

.vote-progress-label {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  font-family: var(--font-number);
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ====== RESULTS ====== */
.result-stage { text-align: center; }

.result-icon { font-size: 3rem; margin-bottom: 4px; }

.result-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 4px;
}

.result-eliminated {
  font-size: 1rem;
  color: var(--color-danger);
  font-weight: 500;
}

.result-winner {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 8px 0 16px;
}

/* ====== WORD REVEAL ====== */
.word-reveal {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  animation: wordRevealIn 0.5s ease-out;
}

@keyframes wordRevealIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.word-reveal-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.word-reveal-cards {
  display: flex;
  align-items: center;
  gap: 10px;
}

.word-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  min-width: 100px;
}

.word-card.civilian-card {
  background: var(--color-accent-pale);
  border: 2px solid var(--color-accent-light);
}

.word-card.spy-card {
  background: var(--color-danger-light);
  border: 2px solid var(--color-danger);
}

.word-card-header {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

.word-card-spy-name {
  font-size: 0.68rem;
  color: var(--color-danger);
}

.word-card-word {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: 0.05em;
}

.word-card-vs {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.score-list {
  width: 100%;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--color-bg-warm);
  border-radius: var(--radius-sm);
}

.score-rank {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-primary);
  width: 24px;
}

.score-name { flex: 1; font-size: 0.9rem; font-weight: 500; }

.score-pts {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text);
  font-family: var(--font-number);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 10px 32px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: var(--transition);
}

.btn-primary:hover { background: var(--color-primary-dark); }

.btn-secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  padding: 10px 24px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: var(--transition);
}

.btn-secondary:hover { background: var(--color-bg-warm); }

.go-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.idle-text { color: var(--color-text-muted); font-size: 1rem; }

/* ====== MOBILE TAB OVERLAY ====== */
.mobile-tab-content {
  display: none;
}

.tab-panel {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  border: none;
  background: var(--color-surface);
  color: var(--color-text);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.chat-panel {
  padding: 0;
}

/* ====== FOOTER ====== */
.game-footer {
  flex-shrink: 0;
  padding: 8px 12px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-action {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.action-input-wrap {
  display: flex;
  width: 100%;
  gap: 6px;
  align-items: center;
}

.action-input {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.95rem;
  outline: none;
  background: var(--color-bg);
  transition: var(--transition);
}

.action-input:focus {
  border-color: var(--color-primary-dark);
  box-shadow: 0 0 0 3px rgba(232, 133, 108, 0.12);
}

.action-send {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 10px 22px;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.action-send:hover:not(:disabled) { background: var(--color-primary-dark); }
.action-send:disabled { opacity: 0.35; cursor: default; }

.action-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.footer-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  width: 100%;
  max-width: 520px;
}

/* ====== RESPONSIVE ====== */
@media (max-width: 767px) {
  .sidebar-scores {
    display: none;
  }

  .mobile-tab-content {
    display: block;
  }

  .game-center {
    padding: 8px 12px;
  }

  .header-game { display: none; }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .sidebar-scores { width: 160px; }
}
</style>
