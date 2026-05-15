<template>
  <div class="lobby-page">
    <div class="lobby-card">
      <div class="lobby-header">
        <div class="header-icon">🎮</div>
        <h1>{{ room?.name ?? '游戏房间' }}</h1>
        <div class="room-code-badge">
          <span class="code-label">房间名称</span>
          <span class="code-value">{{ roomName }}</span>
          <button class="code-copy" @click="copyRoomName" title="复制房间名称">📋</button>
        </div>
      </div>

      <div class="players-section">
        <div class="players-header">
          <h2>玩家</h2>
          <span class="player-count">{{ players.length }} / {{ room?.maxPlayers ?? 50 }}</span>
        </div>

        <div class="player-list">
          <TransitionGroup name="player">
            <div v-for="player in players" :key="player.id" class="player-card">
              <div class="player-avatar">
                {{ player.nickname.charAt(0) }}
              </div>
              <div class="player-info">
                <span class="player-name">{{ player.nickname }}</span>
                <div class="player-tags">
                  <span v-if="player.id === currentPlayerId" class="tag tag-you">你</span>
                  <span v-if="player.isOwner" class="tag tag-owner">房主</span>
                </div>
              </div>
              <button
                v-if="isOwner && player.id !== currentPlayerId"
                class="btn-kick"
                @click="handleKick(player.id)"
                title="踢出"
              >
                ✕
              </button>
            </div>
          </TransitionGroup>

          <div v-if="players.length === 0" class="empty-players">
            等待玩家加入...
          </div>
        </div>
      </div>

      <div class="lobby-actions">
        <button
          v-if="isOwner"
          class="btn-start"
          :disabled="players.length < 2 || gameState === 'playing'"
          @click="handleStartGame"
        >
          <span class="btn-start-icon">{{ players.length < 2 ? '👥' : '🎯' }}</span>
          {{ players.length < 2 ? '等待更多玩家...' : '开始游戏' }}
        </button>

        <button v-if="isOwner" class="btn-word-config" @click="showWordConfig = true">
          ⚙️ 词库设置
        </button>

        <button class="btn-leave" @click="handleLeave">
          离开房间
        </button>
      </div>

      <Transition name="fade">
        <div v-if="showWordConfig" class="word-config-overlay" @click.self="showWordConfig = false">
          <div class="word-config-modal">
            <div class="word-config-modal-header">
              <span>⚙️ 词库设置</span>
              <button class="word-config-modal-close" @click="showWordConfig = false">✕</button>
            </div>
            <div class="word-config-modal-body">
              <div class="word-config-field">
                <label>分类选择</label>
                <div class="checkbox-group">
                  <label v-for="cat of WORD_CATEGORIES_DISPLAY" :key="cat.key" class="checkbox-label">
                    <input type="checkbox" :value="cat.key" v-model="editableWordConfig.categoryFilter" @change="onConfigChange" />
                    {{ cat.label }}
                  </label>
                </div>
              </div>

              <div class="word-config-field">
                <label>难度范围</label>
                <div class="checkbox-group inline">
                  <label class="checkbox-label"><input type="checkbox" value="easy" v-model="editableWordConfig.difficultyFilter" @change="onConfigChange" /> 简单</label>
                  <label class="checkbox-label"><input type="checkbox" value="medium" v-model="editableWordConfig.difficultyFilter" @change="onConfigChange" /> 中等</label>
                  <label class="checkbox-label"><input type="checkbox" value="hard" v-model="editableWordConfig.difficultyFilter" @change="onConfigChange" /> 困难</label>
                </div>
              </div>

              <div class="word-config-field">
                <label>可画性要求：{{ editableWordConfig.minDrawability }}</label>
                <div class="slider-wrap">
                  <span class="slider-label">抽象</span>
                  <input type="range" v-model.number="editableWordConfig.minDrawability" min="1" max="5" step="1" @change="onConfigChange" />
                  <span class="slider-label">具象</span>
                </div>
              </div>

              <div class="word-config-field">
                <label>自定义词汇（每行一个或逗号分隔，至少5个）</label>
                <textarea v-model="lobbyCustomWordsRaw" rows="3" placeholder="例如：奥特曼, 皮卡丘, 柯南" />
                <button class="btn-save-custom" @click="onCustomWordsSave">保存自定义词汇</button>
              </div>

              <div class="word-config-field">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="editableWordConfig.useOnlyCustomWords" @change="onConfigChange" />
                  仅使用自定义词
                </label>
              </div>

              <div class="word-config-field">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="editableWordConfig.looseMatching" @change="onConfigChange" />
                  宽松匹配（接受同义词/近似答案）
                </label>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <Transition name="fade">
      <p v-if="errorMessage" class="error-toast">{{ errorMessage }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useGameStore } from '@/stores/game'
import type { RoomWordConfig } from '@draw-and-guess/shared'

const WORD_CATEGORIES_DISPLAY = [
  { key: 'animals', label: '动物' } as const,
  { key: 'food', label: '食物' } as const,
  { key: 'daily', label: '日常物品' } as const,
  { key: 'nature', label: '自然植物' } as const,
  { key: 'vehicles', label: '交通工具' } as const,
  { key: 'sports', label: '体育运动' } as const,
  { key: 'characters', label: '人物角色' } as const,
]
const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()

const roomName = computed(() => route.params.roomName as string)

const room = computed(() => roomStore.room)
const players = computed(() => roomStore.players)
const currentPlayerId = computed(() => roomStore.currentPlayerId)
const isOwner = computed(() => roomStore.isOwner)
const gameState = computed(() => room.value?.state)

const errorMessage = ref<string | null>(null)
const showWordConfig = ref(false)
const lobbyCustomWordsRaw = ref('')

const editableWordConfig = ref<RoomWordConfig>({
  categoryFilter: ['animals', 'food', 'daily', 'nature', 'vehicles', 'sports', 'characters'],
  difficultyFilter: [],
  minDrawability: 1,
  customWords: [],
  useOnlyCustomWords: false,
  looseMatching: false,
  preset: null,
})

// Sync word config from room store
watch(() => room.value?.wordConfig, (wc) => {
  if (wc) {
    editableWordConfig.value = { ...wc, customWords: [...wc.customWords] }
  }
}, { immediate: true })

function onConfigChange() {
  const { customWords: _cw, ...rest } = editableWordConfig.value
  void _cw
  roomStore.updateWordConfig(rest)
}

function onCustomWordsSave() {
  roomStore.updateWordConfig({}, lobbyCustomWordsRaw.value)
}

// If room name in URL doesn't match stored room, redirect
watch(() => roomStore.room?.code, (code) => {
  if (code && code !== roomName.value) {
    router.replace(`/lobby/${code}`)
  }
})

watch(() => roomStore.error, (newError) => {
  errorMessage.value = newError
  if (newError) {
    setTimeout(() => { errorMessage.value = null }, 4000)
  }
})

watch(room, (newRoom) => {
  if (newRoom?.state === 'playing') {
    useGameStore().setupSocketListeners()
    router.push(`/game/${roomName.value}`)
  }
}, { immediate: true })

onMounted(() => {
  roomStore.setupSocketListeners()
  // 不注册 gameStore 监听器 — 游戏事件在 GamePage 渲染后才绑定
  // 这样避免路由跳转（Lobby → Game）时 socket.off/on 重注册导致事件丢失
})

function copyRoomName() {
  const text = roomName.value
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {})
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

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

.lobby-header {
  text-align: center;
  padding: 2rem 2rem 1.5rem;
  background: linear-gradient(180deg, var(--color-accent-pale) 0%, var(--color-surface) 100%);
  border-bottom: 1px solid var(--color-border-light);
}

.header-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

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

.players-section {
  padding: 1.5rem 2rem;
}

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
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  flex-shrink: 0;
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

.lobby-actions {
  padding: 1.5rem 2rem;
  display: flex;
  gap: 0.75rem;
  border-top: 1px solid var(--color-border-light);
}

.btn-start {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.85rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
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
  font-size: 1.2rem;
}

.btn-leave {
  padding: 0.85rem 1.5rem;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: var(--transition);
}

.btn-leave:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text);
  background: var(--color-bg);
}

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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.btn-word-config {
  padding: 0.6rem 1rem;
  background: var(--color-bg-warm);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.btn-word-config:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.btn-save-custom {
  margin-top: 0.35rem;
  padding: 0.3rem 0.8rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.72rem;
  cursor: pointer;
}

/* ─── Word Config Modal ─── */
.word-config-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.word-config-modal {
  background: #fff;
  border-radius: 14px;
  width: min(420px, 90vw);
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.18);
}

.word-config-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--color-border-light);
  font-weight: 600;
  font-size: 0.95rem;
}

.word-config-modal-close {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0.2rem;
}

.word-config-modal-body {
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.word-config-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.word-config-field > label {
  font-size: 0.74rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.8rem;
}

.checkbox-group.inline {
  gap: 0.5rem 1rem;
}

.checkbox-label {
  display: inline-flex !important;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.76rem;
  color: var(--color-text);
  font-weight: 400;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
  accent-color: var(--color-accent);
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slider-label {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.slider-wrap input[type="range"] {
  flex: 1;
  accent-color: var(--color-accent);
  height: 4px;
}

.word-config-field textarea {
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.76rem;
  font-family: inherit;
  resize: vertical;
}

/* ─── Mobile ─── */
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
    padding: 1rem;
    flex-direction: column;
  }

  .btn-leave {
    width: 100%;
    text-align: center;
  }
}
</style>
