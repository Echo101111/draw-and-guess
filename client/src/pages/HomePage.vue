<template>
  <div class="home-page">
    <div class="top-actions">
      <button class="btn-contribute" @click="showContribute = true" title="贡献词库">
        <span>✏️</span>
        <span class="action-label">贡献词库</span>
      </button>
      <button class="btn-changelog" @click="loadChangelog(); showChangelog = true" title="更新日志">
        <span class="changelog-icon">📋</span>
        <span class="changelog-label">更新日志</span>
      </button>
      <button class="btn-feedback" @click="showFeedback = true" title="反馈建议">
        <span class="feedback-icon">💬</span>
        <span class="feedback-label">反馈建议</span>
      </button>
    </div>

    <Transition name="changelog">
      <div v-if="showChangelog" class="changelog-overlay" @click.self="showChangelog = false">
        <div class="changelog-modal">
          <div class="changelog-header">
            <div class="changelog-header-left">
              <span class="changelog-header-icon">📋</span>
              <span>更新日志</span>
            </div>
            <button class="changelog-close" @click="showChangelog = false" title="关闭">✕</button>
          </div>
          <div class="changelog-body" v-html="renderedChangelog" />
        </div>
      </div>
    </Transition>

    <Transition name="contribute">
      <div v-if="showContribute" class="contribute-overlay" @click.self="showContribute = false">
        <div class="contribute-modal">
          <div class="contribute-header">
            <div class="contribute-header-left">
              <span class="contribute-header-icon">✏️</span>
              <span>贡献词库</span>
            </div>
            <button class="contribute-close" @click="showContribute = false" title="关闭">✕</button>
          </div>
          <div class="contribute-body">
            <div class="contribute-desc">将你想在游戏中看到的词语永久加入词库</div>

            <div class="field">
              <label for="contribute-words">
                词语（每行一个，最多 20 个）
                <span class="hint-icon" title="每行一个词语。如需添加近义词，在词后加 | 并用逗号分隔多个近义词&#10;示例：&#10;  电饭煲 | 电饭锅&#10;  猫 | 猫咪,小花猫">ⓘ</span>
              </label>
              <div class="input-wrap">
                <textarea
                  id="contribute-words"
                  v-model="contributeWords"
                  class="contribute-textarea"
                  placeholder="长颈鹿&#10;电饭煲 | 电饭锅&#10;猫 | 猫咪,小花猫"
                  rows="5"
                />
              </div>
              <div class="contribute-tip">💡 每行一个词，近义词用 | 分隔，多个用 ,（选填）</div>
            </div>

            <div class="field-row">
              <div class="field field-half">
                <label for="contribute-category">分类</label>
                <div class="input-wrap">
                  <input
                    id="contribute-category"
                    v-model="contributeCategory"
                    type="text"
                    placeholder="如：动物、食物、自定义…"
                    maxlength="20"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    <option value="动物" />
                    <option value="食物" />
                    <option value="日常物品" />
                    <option value="自然" />
                    <option value="交通工具" />
                    <option value="体育运动" />
                    <option value="角色" />
                    <option value="职业" />
                  </datalist>
                </div>
              </div>
            </div>

            <div class="contribute-actions">
              <button
                class="btn-contribute-submit"
                :disabled="contributeLoading"
                @click="handleContributeSubmit"
              >
                <span v-if="contributeLoading" class="btn-loading" />
                <span v-else>📤 提交（{{ wordCount }} 个词）</span>
              </button>
            </div>

            <Transition name="fade">
              <div v-if="contributeMessage" :class="['contribute-feedback', contributeSuccess ? 'feedback-success' : 'feedback-error']">
                {{ contributeMessage }}
              </div>
            </Transition>

          </div>
        </div>
      </div>
    </Transition>

    <Transition name="feedback">
      <div v-if="showFeedback" class="feedback-overlay" @click.self="showFeedback = false">
        <div class="feedback-modal">
          <div class="feedback-header">
            <div class="feedback-header-left">
              <span class="feedback-header-icon">💬</span>
              <span>反馈建议</span>
            </div>
            <button class="feedback-close" @click="showFeedback = false" title="关闭">✕</button>
          </div>
          <div class="feedback-body">
            <div class="feedback-desc">告诉我们你的想法，帮助我们做得更好</div>
            <div class="field">
              <label for="feedback-text">你的建议</label>
              <div class="input-wrap">
                <textarea
                  id="feedback-text"
                  v-model="feedbackText"
                  class="feedback-textarea"
                  placeholder="请描述你的建议、bug 反馈或任何想法…"
                  rows="4"
                  maxlength="1000"
                />
              </div>
              <div class="feedback-counter">{{ feedbackText.length }}/1000</div>
            </div>
            <div class="feedback-actions">
              <button
                class="btn-feedback-submit"
                :disabled="feedbackLoading || !feedbackText.trim()"
                @click="handleFeedbackSubmit"
              >
                <span v-if="feedbackLoading" class="btn-loading" />
                <span v-else>📤 提交反馈</span>
              </button>
            </div>
            <Transition name="fade">
              <div v-if="feedbackMessage" :class="['contribute-feedback', feedbackSuccess ? 'feedback-success' : 'feedback-error']">
                {{ feedbackMessage }}
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>

    <div class="hero">
      <div class="hero-icon">🎉</div>
      <h1 class="hero-title">Oiiiii早春</h1>
      <p class="hero-subtitle">你画我猜 · 谁是卧底</p>
    </div>

    <div class="card-container">
      <div class="tab-bar">
        <button
          :class="['tab-btn', { active: activeTab === 'create' }]"
          @click="activeTab = 'create'"
        >
          <span class="tab-icon">🏠</span>
          创建房间
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'list' }]"
          @click="activeTab = 'list'"
        >
          <span class="tab-icon">📋</span>
          房间列表
        </button>
      </div>

      <form v-if="activeTab === 'create'" class="form-card" @submit.prevent="handleCreate">
        <div class="field">
          <label for="nickname-create">你的昵称</label>
          <div class="input-wrap">
            <span class="input-icon">✏️</span>
            <input
              id="nickname-create"
              v-model="nickname"
              type="text"
              placeholder="1-10个字符"
              :maxlength="NICKNAME_MAX_LENGTH"
              required
            />
          </div>
        </div>

        <div class="field">
          <label for="room-name">房间名称</label>
          <div class="input-wrap">
            <span class="input-icon">📋</span>
            <input
              id="room-name"
              v-model="createRoomName"
              type="text"
              placeholder="默认：房间"
              :maxlength="ROOM_NAME_MAX_LENGTH"
            />
          </div>
        </div>

        <div class="field">
          <label for="password-create">房间密码</label>
          <div class="input-wrap">
            <span class="input-icon">🔒</span>
            <input
              id="password-create"
              v-model="password"
              type="password"
              placeholder="无密码"
              :maxlength="PASSWORD_MAX_LENGTH"
            />
          </div>
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          <span v-if="isLoading" class="btn-loading" />
          <span v-else>🏠 创建房间</span>
        </button>
      </form>

      <div v-else class="room-list-wrap">
        <div class="room-list-header">
          <span>共 {{ rooms.length }} 个房间</span>
          <button class="btn-refresh" @click="fetchRoomList" title="刷新">🔄</button>
        </div>

        <div v-if="rooms.length === 0" class="empty-rooms">
          <div class="empty-rooms-icon">🏠</div>
          <div class="empty-rooms-text">暂无可用房间</div>
          <div class="empty-rooms-desc">创建一个房间，邀请好友一起玩吧！</div>
        </div>

        <div v-else class="room-list">
          <button
            v-for="room in rooms"
            :key="room.code"
            class="room-card"
            @click="openJoinRoom(room)"
          >
            <div class="room-card-left">
              <span class="room-card-icon">{{ room.gameType === 'spy' ? '🕵️' : '🎨' }}</span>
            </div>
            <div class="room-card-mid">
              <div class="room-card-name">{{ room.name }}</div>
              <div class="room-card-meta">
                <span :class="['room-card-state', room.state]">
                  {{ room.state === 'playing' ? '🎮 游戏中' : '🏠 等待中' }}
                </span>
              </div>
            </div>
            <div class="room-card-right">
              <span class="room-card-players">👥 {{ room.playerCount }}</span>
              <span class="room-card-lock">{{ room.hasPassword ? '🔒' : '🔓' }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="showJoinModal" class="join-overlay" @click.self="showJoinModal = false">
        <div class="join-modal">
          <div class="join-modal-header">
            <div class="join-modal-header-left">
              <span>{{ joinModalRoom?.gameType === 'spy' ? '🕵️' : '🎨' }}</span>
              <span>加入「{{ joinModalRoom?.name }}」</span>
            </div>
            <button class="join-modal-close" @click="showJoinModal = false" title="关闭">✕</button>
          </div>
          <form class="join-modal-body" @submit.prevent="confirmJoinRoom">
            <div class="field">
              <label for="join-nickname">你的昵称</label>
              <div class="input-wrap">
                <span class="input-icon">✏️</span>
                <input
                  id="join-nickname"
                  v-model="joinModalNickname"
                  type="text"
                  placeholder="1-10个字符"
                  :maxlength="NICKNAME_MAX_LENGTH"
                  required
                />
              </div>
            </div>

            <div v-if="joinModalRoom?.hasPassword" class="field">
              <label for="join-password">房间密码</label>
              <div class="input-wrap">
                <span class="input-icon">🔒</span>
                <input
                  id="join-password"
                  v-model="joinModalPassword"
                  type="password"
                  placeholder="输入密码"
                  :maxlength="PASSWORD_MAX_LENGTH"
                />
              </div>
            </div>

            <button type="submit" class="btn-primary" :disabled="isLoading">
              <span v-if="isLoading" class="btn-loading" />
              <span v-else>🚪 加入房间</span>
            </button>
          </form>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <p v-if="errorMessage" class="error-toast">{{ errorMessage }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { connectSocket, clearSession, loadNickname } from '@/composables/useSocket'
import { getSocket } from '@/composables/useSocket'
import { CLIENT_EVENTS, SERVER_EVENTS, NICKNAME_MAX_LENGTH, ROOM_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, CONTRIBUTE_SUCCESS_MS, TOAST_LOBBY_ERROR_MS, ROOM_LIST_REFRESH_MS } from '@draw-and-guess/shared'
import type { GameType } from '@draw-and-guess/shared'

interface RoomListItem {
  code: string
  name: string
  state: string
  playerCount: number
  gameType: GameType
  hasPassword: boolean
}

const router = useRouter()
const roomStore = useRoomStore()

const showChangelog = ref(false)
const changelogMd = ref('')
const changelogLoading = ref(false)

const showContribute = ref(false)
const contributeWords = ref('')
const contributeCategory = ref<string>('')
const contributeLoading = ref(false)
const contributeMessage = ref<string | null>(null)
const contributeSuccess = ref(false)
let contributeTimer: ReturnType<typeof setTimeout> | null = null

const showFeedback = ref(false)
const feedbackText = ref('')
const feedbackLoading = ref(false)
const feedbackMessage = ref<string | null>(null)
const feedbackSuccess = ref(false)
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const wordCount = computed(() => {
  return contributeWords.value.split('\n').map(s => s.trim()).filter(Boolean).length
})

function resetContributeForm() {
  contributeWords.value = ''
  contributeCategory.value = ''
  contributeLoading.value = false
  contributeMessage.value = null
  contributeSuccess.value = false
}

async function handleContributeSubmit() {
  const rawLines = contributeWords.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (rawLines.length === 0) {
    contributeMessage.value = '请至少输入一个词语'
    contributeSuccess.value = false
    return
  }

  if (!contributeCategory.value.trim()) {
    contributeMessage.value = '请填写分类'
    contributeSuccess.value = false
    return
  }

  const words: string[] = []
  const synonyms: Record<string, string[]> = {}
  for (const line of rawLines) {
    const parts = line.split('|').map(s => s.trim())
    const word = parts[0]
    if (!word) continue
    words.push(word)
    if (parts.length > 1) {
      synonyms[word] = parts[1].split(',').map(s => s.trim()).filter(Boolean)
    }
  }

  contributeLoading.value = true
  contributeMessage.value = null

  try {
    const res = await fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        words,
        category: contributeCategory.value,
        synonyms: Object.keys(synonyms).length > 0 ? synonyms : undefined,
      }),
    })

    if (!res.ok) {
      let errMsg = `服务器错误 (${res.status})`
      // eslint-disable-next-line no-empty
      try { const d = await res.json(); if (d.message) errMsg = d.message } catch {}
      contributeSuccess.value = false
      contributeMessage.value = errMsg
      return
    }
    const data = await res.json()
    contributeSuccess.value = data.success
    let msg = data.message
    if (data.details) msg += `\n${data.details}`
    contributeMessage.value = msg

    if (data.success) {
      contributeWords.value = ''
      if (contributeTimer) clearTimeout(contributeTimer)
      contributeTimer = setTimeout(() => {
        showContribute.value = false
        resetContributeForm()
      }, CONTRIBUTE_SUCCESS_MS)
    }
  } catch (e) {
    contributeSuccess.value = false
    contributeMessage.value = '提交失败，请检查网络连接 (' + e + ')'
  } finally {
    contributeLoading.value = false
  }
}

async function handleFeedbackSubmit() {
  if (!feedbackText.value.trim()) return
  feedbackLoading.value = true
  feedbackMessage.value = null
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: feedbackText.value.trim() }),
    })
    if (!res.ok) {
      let errMsg = `服务器错误 (${res.status})`
      // eslint-disable-next-line no-empty
      try { const d = await res.json(); if (d.message) errMsg = d.message } catch {}
      feedbackSuccess.value = false
      feedbackMessage.value = errMsg
      return
    }
    const data = await res.json()
    feedbackSuccess.value = data.success
    feedbackMessage.value = data.message
    if (data.success) {
      feedbackText.value = ''
      if (feedbackTimer) clearTimeout(feedbackTimer)
      feedbackTimer = setTimeout(() => {
        showFeedback.value = false
        feedbackMessage.value = null
      }, 2000)
    }
  } catch (e) {
    feedbackSuccess.value = false
    feedbackMessage.value = '提交失败，请检查网络连接 (' + e + ')'
  } finally {
    feedbackLoading.value = false
  }
}

let errorTimer: ReturnType<typeof setTimeout> | null = null

function renderMarkdown(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) {
        return `<h1>${line.slice(2)}</h1>`
      }
      if (line.startsWith('## ')) {
        return `<h2>${line.slice(3)}</h2>`
      }
      if (line.startsWith('- ')) {
        const content = line.slice(2).trim()
        const featMatch = content.match(/^Feat[：:]\s*/)
        if (featMatch) {
          return `<li><span class="tag tag-feat">🆕 新增功能</span> ${content.slice(featMatch[0].length)}</li>`
        }
        const fixMatch = content.match(/^Fix[：:]\s*/)
        if (fixMatch) {
          return `<li><span class="tag tag-fix">🔧 修复bug</span> ${content.slice(fixMatch[0].length)}</li>`
        }
        const perfMatch = content.match(/^Perf[：:]\s*/)
        if (perfMatch) {
          return `<li><span class="tag tag-perf">⚡ 性能优化</span> ${content.slice(perfMatch[0].length)}</li>`
        }
        const otherMatch = content.match(/^(Style|Docs|Chore|Refactor)[：:]\s*/)
        if (otherMatch) {
          return `<li><span class="tag tag-style">🎨 样式优化</span> ${content.slice(otherMatch[0].length)}</li>`
        }
        return `<li>${content}</li>`
      }
      if (line.trim() === '') {
        return '</ul><ul>'
      }
      return line
    })
    .join('')
    .replace(/<\/ul><ul><\/ul><ul>/g, '</ul><ul>')
    .replace(/^<ul>/, '<ul>')
    .replace(/<\/ul>$/, '</ul>')
}

const renderedChangelog = computed(() => changelogMd.value ? renderMarkdown(changelogMd.value) : '<p>加载中…</p>')

async function loadChangelog() {
  if (changelogMd.value) return
  changelogLoading.value = true
  try {
    const mod = await import('../../../CHANGELOG.md?raw')
    changelogMd.value = mod.default
  } finally {
    changelogLoading.value = false
  }
}

const activeTab = ref<'create' | 'list'>('create')
const nickname = ref('')
const createRoomName = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// Room list
const rooms = ref<RoomListItem[]>([])

const joinModalRoom = ref<RoomListItem | null>(null)
const showJoinModal = ref(false)
const joinModalNickname = ref('')
const joinModalPassword = ref('')

function handleRoomList(data: { rooms: RoomListItem[] }) {
  rooms.value = data.rooms
}
let refreshTimer: ReturnType<typeof setInterval> | null = null

watch(() => roomStore.error, (newError) => {
  errorMessage.value = newError
  if (newError) {
    isLoading.value = false
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { errorMessage.value = null; errorTimer = null }, TOAST_LOBBY_ERROR_MS)
  }
})

watch(() => roomStore.room, (newRoom) => {
  if (newRoom && roomStore.currentPlayerId) {
    const prefix = newRoom.gameType === 'spy' ? '/spy' : '/draw'
    router.push(`${prefix}/lobby/${newRoom.code}`)
  }
})

watch(activeTab, (tab) => {
  if (tab === 'list') {
    fetchRoomList()
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

function fetchRoomList() {
  const socket = getSocket()
  if (socket?.connected) {
    socket.emit(CLIENT_EVENTS.LIST_ROOMS)
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer = setInterval(fetchRoomList, ROOM_LIST_REFRESH_MS)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function openJoinRoom(room: RoomListItem) {
  const savedNickname = loadNickname()
  if (!room.hasPassword && savedNickname) {
    // 无密码 + 有昵称 → 直接加入
    doJoinRoom(room.code, savedNickname)
    return
  }
  // 有密码 or 无昵称 → 弹窗
  joinModalRoom.value = room
  joinModalNickname.value = savedNickname
  joinModalPassword.value = ''
  showJoinModal.value = true
}

async function confirmJoinRoom() {
  if (!joinModalRoom.value || !joinModalNickname.value.trim()) return
  isLoading.value = true
  errorMessage.value = null
  await roomStore.joinRoom(
    joinModalRoom.value.code,
    joinModalNickname.value.trim(),
    joinModalPassword.value || undefined,
  )
  isLoading.value = false
  if (!roomStore.error) {
    showJoinModal.value = false
  }
}

async function doJoinRoom(roomCode: string, nicknameToUse: string) {
  isLoading.value = true
  errorMessage.value = null
  try {
    await roomStore.joinRoom(roomCode, nicknameToUse)
  } finally {
    isLoading.value = false
  }
}

async function handleCreate() {
  if (!nickname.value.trim()) return
  isLoading.value = true
  errorMessage.value = null

  await roomStore.createRoom(nickname.value.trim(), {
    roomName: createRoomName.value.trim() || undefined,
    password: password.value || undefined,
  })
}

onUnmounted(() => {
  if (errorTimer) clearTimeout(errorTimer)
  if (contributeTimer) clearTimeout(contributeTimer)
  if (feedbackTimer) clearTimeout(feedbackTimer)
  stopAutoRefresh()
  const socket = getSocket()
  if (socket) socket.off(SERVER_EVENTS.ROOM_LIST, handleRoomList)
})

onMounted(() => {
  document.title = 'Oiiiii早春 - 派对游戏'
  clearSession()
  connectSocket()
  nickname.value = loadNickname()

  const socket = getSocket()
  socket.off(SERVER_EVENTS.ROOM_LIST, handleRoomList)
  socket.on(SERVER_EVENTS.ROOM_LIST, handleRoomList)
})
</script>

<style scoped>
.home-page {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  padding: 1.5rem 1rem;
  overflow: hidden;
}

.hero {
  text-align: center;
  animation: heroFadeIn 0.8s ease-out;
  flex-shrink: 0;
}

.hero-icon {
  font-size: 2.8rem;
  line-height: 1;
  animation: bounce 2s ease-in-out infinite;
}

.hero-title {
  font-family: var(--font-title);
  font-size: 2.5rem;
  color: var(--color-text);
  letter-spacing: 0.05em;
  text-shadow: 0 2px 4px rgba(180, 140, 110, 0.2);
  line-height: 1.2;
  margin-top: 0.4rem;
}

.hero-subtitle {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  margin-top: 0.3rem;
}

.card-container {
  width: 100%;
  max-width: 360px;
  animation: slideUp 0.6s ease-out 0.2s both;
  flex-shrink: 0;
  margin-top: 1rem;
}

.tab-bar {
  display: flex;
  background: var(--color-border-light);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 3px;
  margin-bottom: 0.75rem;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.55rem 1rem;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.tab-btn.active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.tab-btn:hover:not(.active) {
  color: var(--color-text);
}

.tab-icon {
  font-size: 1rem;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background: var(--color-surface);
  padding: 1.1rem 1.25rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.field label {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  padding-left: 0.2rem;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.7rem;
  font-size: 0.9rem;
  line-height: 1;
  pointer-events: none;
}

.field input,
.field select {
  width: 100%;
  padding: 0.55rem 0.7rem 0.55rem 2.2rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: var(--transition);
  -webkit-appearance: none;
  appearance: none;
}

.field select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%238B7A6A' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2.2rem;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: var(--shadow-glow);
}

.field input::placeholder {
  color: var(--color-text-muted);
}

.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.65rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  margin-top: 0.15rem;
  letter-spacing: 0.03em;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(232, 133, 108, 0.35);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-loading {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.error-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-danger-light);
  color: var(--color-danger);
  padding: 0.6rem 1.25rem;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(217, 117, 107, 0.2);
  z-index: 100;
}

/* ─── Room List ─── */
.room-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 380px;
}

.room-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  padding: 0 0.2rem;
}

.btn-refresh {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  transition: var(--transition);
  padding: 0.2rem;
  border-radius: 50%;
  line-height: 1;
}

.btn-refresh:hover {
  color: var(--color-primary);
  transform: rotate(180deg);
}

.empty-rooms {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 2.5rem 1rem;
  color: var(--color-text-muted);
}

.empty-rooms-icon {
  font-size: 2.5rem;
  opacity: 0.6;
}

.empty-rooms-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.empty-rooms-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
  padding-right: 0.2rem;
}

.room-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  width: 100%;
  text-align: left;
}

.room-card:hover {
  border-color: var(--color-primary-light);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.room-card:active {
  transform: translateY(0);
}

.room-card-left {
  flex-shrink: 0;
}

.room-card-icon {
  font-size: 1.4rem;
}

.room-card-mid {
  flex: 1;
  min-width: 0;
}

.room-card-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card-meta {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.15rem;
}

.room-card-state {
  font-size: 0.68rem;
  font-weight: 500;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-full);
}

.room-card-state.lobby {
  background: var(--color-accent-pale);
  color: var(--color-accent);
}

.room-card-state.playing {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.room-card-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.room-card-players {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.room-card-lock {
  font-size: 0.8rem;
}

/* ─── Join Modal ─── */
.join-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 55, 40, 0.4);
  backdrop-filter: blur(5px);
}

.join-modal {
  width: 90%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #FFFDF8 0%, #FFF8F0 100%);
  border-radius: var(--radius-xl);
  box-shadow: 0 12px 48px rgba(74, 55, 40, 0.2);
  border: 1px solid rgba(244, 162, 97, 0.12);
  position: relative;
  overflow: hidden;
}

.join-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-primary-light));
  z-index: 1;
}

.join-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.7rem;
  flex-shrink: 0;
}

.join-modal-header-left {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text);
  letter-spacing: 0.03em;
}

.join-modal-close {
  width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.25s;
  font-size: 0.85rem;
  line-height: 1;
}

.join-modal-close:hover {
  background: var(--color-border-light);
  color: var(--color-text);
  transform: rotate(90deg);
}

.join-modal-body {
  padding: 0.25rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

@keyframes heroFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── Top Actions ─── */
.top-actions {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-changelog,
.btn-contribute {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
  font-weight: 500;
}

.btn-changelog:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  box-shadow: 0 4px 16px rgba(244, 162, 97, 0.2);
  transform: translateY(-1px);
}

.btn-contribute:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 4px 16px rgba(232, 133, 108, 0.2);
  transform: translateY(-1px);
}

.btn-feedback {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
  font-weight: 500;
}

.btn-feedback:hover {
  border-color: var(--color-success);
  color: var(--color-success);
  box-shadow: 0 4px 16px rgba(126, 184, 122, 0.2);
  transform: translateY(-1px);
}

.btn-changelog:active,
.btn-contribute:active,
.btn-feedback:active {
  transform: translateY(0);
}

.changelog-icon,
.feedback-icon { font-size: 0.85rem; }
.changelog-label,
.feedback-label,
.action-label { font-size: 0.78rem; }

.changelog-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 55, 40, 0.4);
  backdrop-filter: blur(5px);
}

.changelog-modal {
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #FFFDF8 0%, #FFF8F0 100%);
  border-radius: var(--radius-xl);
  box-shadow: 0 12px 48px rgba(74, 55, 40, 0.2);
  border: 1px solid rgba(244, 162, 97, 0.12);
  position: relative;
  overflow: hidden;
}

/* Decorative top gradient bar */
.changelog-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-primary-light));
  z-index: 1;
}

.changelog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.7rem;
  flex-shrink: 0;
}

.changelog-header-left {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text);
  letter-spacing: 0.03em;
}

.changelog-header-icon {
  font-size: 1rem;
  line-height: 1;
}

.changelog-close {
  width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.25s;
  font-size: 0.85rem;
  line-height: 1;
}

.changelog-close:hover {
  background: var(--color-border-light);
  color: var(--color-text);
  transform: rotate(90deg);
}

.changelog-body {
  padding: 0.25rem 1.25rem 1.25rem;
  overflow-y: auto;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--color-text);
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.changelog-body::-webkit-scrollbar {
  width: 5px;
}

.changelog-body::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.changelog-body h1 {
  display: none;
}

.changelog-body h2 {
  font-family: var(--font-title);
  font-size: 1.05rem;
  color: var(--color-primary-dark);
  margin: 1.25rem 0 0.5rem;
  padding: 0 0 0.3rem 0;
  border-bottom: 2px solid var(--color-accent-pale);
  letter-spacing: 0.04em;
}

.changelog-body h2:first-of-type {
  margin-top: 0.2rem;
}

.changelog-body ul {
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem;
}

.changelog-body li {
  position: relative;
  padding: 0.45rem 0 0.45rem 1rem;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  border-left: 2px solid transparent;
  padding-left: 0.85rem;
  margin-left: 0.25rem;
  transition: border-color 0.2s;
}

.changelog-body li:hover {
  border-left-color: var(--color-accent);
}

/* Tags for Feat / Fix / Perf / Style */
.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.08rem 0.45rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  vertical-align: middle;
  margin-right: 0.3rem;
  line-height: 1.5;
  white-space: nowrap;
}

.tag-feat {
  background: var(--color-accent-pale);
  color: #D68A4A;
  border: 1px solid rgba(244, 162, 97, 0.25);
}

.tag-fix {
  background: rgba(217, 117, 107, 0.07);
  color: #C96A5E;
  border: 1px solid rgba(217, 117, 107, 0.18);
}

.tag-perf {
  background: rgba(126, 184, 122, 0.08);
  color: #6AA866;
  border: 1px solid rgba(126, 184, 122, 0.2);
}

.tag-style {
  background: var(--color-border-light);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

/* Changelog overlay animation */
.changelog-enter-active {
  transition: opacity 0.3s ease;
}

.changelog-enter-active .changelog-modal {
  animation: modalEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.changelog-leave-active {
  transition: opacity 0.2s ease;
}

.changelog-leave-active .changelog-modal {
  animation: modalExit 0.2s ease-in;
}

.changelog-enter-from,
.changelog-leave-to {
  opacity: 0;
}

@keyframes modalEnter {
  from { opacity: 0; transform: scale(0.85) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes modalExit {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.9) translateY(10px); }
}

/* ─── Contribute ─── */
.contribute-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 55, 40, 0.4);
  backdrop-filter: blur(5px);
}

.contribute-modal {
  width: 90%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #FFFDF8 0%, #FFF8F0 100%);
  border-radius: var(--radius-xl);
  box-shadow: 0 12px 48px rgba(74, 55, 40, 0.2);
  border: 1px solid rgba(244, 162, 97, 0.12);
  position: relative;
  overflow: hidden;
}

.contribute-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-primary-light));
  z-index: 1;
}

.contribute-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.7rem;
  flex-shrink: 0;
}

.contribute-header-left {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text);
  letter-spacing: 0.03em;
}

.contribute-header-icon {
  font-size: 1rem;
  line-height: 1;
}

.contribute-close {
  width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.25s;
  font-size: 0.85rem;
  line-height: 1;
}

.contribute-close:hover {
  background: var(--color-border-light);
  color: var(--color-text);
  transform: rotate(90deg);
}

.contribute-body {
  padding: 0.25rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.contribute-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-bottom: 0.25rem;
}

.contribute-textarea {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: var(--transition);
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  line-height: 1.6;
}

.contribute-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: var(--shadow-glow);
}

.contribute-textarea::placeholder {
  color: var(--color-text-muted);
}

.field-row {
  display: flex;
  gap: 0.65rem;
}

.field-half {
  flex: 1;
}

.btn-contribute-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  width: 100%;
  padding: 0.65rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  letter-spacing: 0.03em;
}

.btn-contribute-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(232, 133, 108, 0.35);
}

.btn-contribute-submit:active:not(:disabled) {
  transform: translateY(0);
}

.btn-contribute-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.contribute-tip {
  font-size: 0.78rem;
  color: var(--color-muted);
  margin-top: 0.3rem;
}

.hint-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 0.7rem;
  color: var(--color-muted);
  cursor: help;
  vertical-align: middle;
  margin-left: 0.25rem;
}

.contribute-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

.contribute-feedback {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 500;
  text-align: center;
  transition: var(--transition);
}

.feedback-success {
  background: var(--color-success-bg);
  color: #5a9a56;
  border: 1px solid rgba(126, 184, 122, 0.2);
}

.feedback-error {
  background: var(--color-danger-light);
  color: var(--color-danger);
  border: 1px solid rgba(217, 117, 107, 0.2);
}

/* Contribute overlay animation */
.contribute-enter-active {
  transition: opacity 0.3s ease;
}

.contribute-enter-active .contribute-modal {
  animation: modalEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.contribute-leave-active {
  transition: opacity 0.2s ease;
}

.contribute-leave-active .contribute-modal {
  animation: modalExit 0.2s ease-in;
}

.contribute-enter-from,
.contribute-leave-to {
  opacity: 0;
}

/* ─── Feedback Modal ─── */
.feedback-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 55, 40, 0.4);
  backdrop-filter: blur(5px);
}

.feedback-modal {
  width: 90%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #FFFDF8 0%, #FFF8F0 100%);
  border-radius: var(--radius-xl);
  box-shadow: 0 12px 48px rgba(74, 55, 40, 0.2);
  border: 1px solid rgba(126, 184, 122, 0.12);
  position: relative;
  overflow: hidden;
}

.feedback-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-success), #8BC34A, var(--color-success));
  z-index: 1;
}

.feedback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.7rem;
  flex-shrink: 0;
}

.feedback-header-left {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text);
  letter-spacing: 0.03em;
}

.feedback-header-icon {
  font-size: 1rem;
  line-height: 1;
}

.feedback-close {
  width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.25s;
  font-size: 0.85rem;
  line-height: 1;
}

.feedback-close:hover {
  background: var(--color-border-light);
  color: var(--color-text);
  transform: rotate(90deg);
}

.feedback-body {
  padding: 0.25rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feedback-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-bottom: 0.25rem;
}

.feedback-textarea {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: var(--transition);
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  line-height: 1.6;
}

.feedback-textarea:focus {
  outline: none;
  border-color: var(--color-success);
  background: var(--color-surface);
  box-shadow: 0 0 0 3px rgba(126, 184, 122, 0.12);
}

.feedback-textarea::placeholder {
  color: var(--color-text-muted);
}

.feedback-counter {
  text-align: right;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  padding: 0.2rem 0.2rem 0;
}

.feedback-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

.btn-feedback-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  width: 100%;
  padding: 0.65rem;
  background: linear-gradient(135deg, var(--color-success), #6AA866);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  letter-spacing: 0.03em;
}

.btn-feedback-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(126, 184, 122, 0.35);
}

.btn-feedback-submit:active:not(:disabled) {
  transform: translateY(0);
}

.btn-feedback-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Feedback overlay animation */
.feedback-enter-active {
  transition: opacity 0.3s ease;
}

.feedback-enter-active .feedback-modal {
  animation: modalEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.feedback-leave-active {
  transition: opacity 0.2s ease;
}

.feedback-leave-active .feedback-modal {
  animation: modalExit 0.2s ease-in;
}

.feedback-enter-from,
.feedback-leave-to {
  opacity: 0;
}

/* ─── Error toast (keep original transition) ─── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

/* ─── Mobile ─── */
@media (max-width: 480px) {
  .home-page {
    padding: 1.5rem 1rem;
  }

  .hero-icon {
    font-size: 2.8rem;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .top-actions {
    top: 0.5rem;
    right: 0.5rem;
    gap: 0.35rem;
  }

  .btn-changelog,
  .btn-contribute,
  .btn-feedback {
    padding: 0.35rem 0.65rem;
    font-size: 0.75rem;
  }

  .contribute-modal {
    max-width: 100%;
    margin: 0 0.5rem;
  }

  .contribute-body {
    padding: 0.25rem 1rem 1rem;
  }

  .field-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .contribute-textarea {
    font-size: 0.84rem;
  }
}

@media (max-width: 480px) {
  .hero-icon {
    font-size: 2.2rem;
  }

  .hero-title {
    font-size: 2rem;
    margin-top: 0.3rem;
  }

  .hero-subtitle {
    font-size: 0.85rem;
  }

  .card-container {
    max-width: 100%;
    margin-top: 1rem;
  }

  .form-card {
    padding: 0.9rem 1rem;
    gap: 0.5rem;
  }

  .tab-bar {
    margin-bottom: 0.6rem;
  }

  .tab-btn {
    font-size: 0.82rem;
    padding: 0.45rem 0.65rem;
  }

  .field input,
  .field select {
    padding: 0.5rem 0.6rem 0.5rem 2rem;
    font-size: 0.84rem;
  }

  .btn-primary {
    padding: 0.55rem;
    font-size: 0.85rem;
  }

  .hero-subtitle {
    display: none;
  }
}

@media (max-height: 640px) {
  .home-page {
    padding: 0.75rem 0.75rem;
  }

  .hero-icon {
    font-size: 2rem;
  }

  .hero-title {
    font-size: 1.8rem;
    margin-top: 0.2rem;
  }

  .hero-subtitle {
    display: none;
  }

  .card-container {
    margin-top: 0.75rem;
  }

  .form-card {
    padding: 0.75rem 1rem;
    gap: 0.4rem;
  }

  .field input,
  .field select {
    padding: 0.4rem 0.6rem 0.4rem 1.8rem;
    font-size: 0.8rem;
  }

  .field label {
    font-size: 0.72rem;
  }

  .btn-primary {
    padding: 0.5rem;
    font-size: 0.82rem;
  }

  .tab-bar {
    margin-bottom: 0.5rem;
    padding: 2px;
  }

  .tab-btn {
    padding: 0.35rem 0.5rem;
    font-size: 0.78rem;
  }
}
</style>
