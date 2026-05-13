<template>
  <div class="home-page">
    <button class="btn-changelog" @click="showChangelog = true" title="更新日志">
      <span class="changelog-icon">📋</span>
      <span class="changelog-label">更新日志</span>
    </button>

    <Transition name="fade">
      <div v-if="showChangelog" class="changelog-overlay" @click.self="showChangelog = false">
        <div class="changelog-modal">
          <div class="changelog-header">
            <span>📋 更新日志</span>
            <button class="changelog-close" @click="showChangelog = false">✕</button>
          </div>
          <div class="changelog-body" v-html="renderedChangelog" />
        </div>
      </div>
    </Transition>

    <div class="hero">
      <div class="hero-icon">🎨</div>
      <h1 class="hero-title">你画我猜</h1>
      <p class="hero-subtitle">和朋友一起，画出快乐时光</p>
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
          :class="['tab-btn', { active: activeTab === 'join' }]"
          @click="activeTab = 'join'"
        >
          <span class="tab-icon">🚪</span>
          加入房间
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
              maxlength="10"
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
              maxlength="20"
            />
          </div>
        </div>

        <div class="field">
          <label for="max-players">最大人数</label>
          <div class="input-wrap">
            <span class="input-icon">👥</span>
            <select id="max-players" v-model="maxPlayers">
              <option v-for="n in 10" :key="n" :value="n * 5">{{ n * 5 }} 人</option>
            </select>
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
              maxlength="20"
            />
          </div>
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          <span v-if="isLoading" class="btn-loading" />
          <span v-else>🏠 创建房间</span>
        </button>
      </form>

      <form v-else class="form-card" @submit.prevent="handleJoin">
        <div class="field">
          <label for="nickname-join">你的昵称</label>
          <div class="input-wrap">
            <span class="input-icon">✏️</span>
            <input
              id="nickname-join"
              v-model="nickname"
              type="text"
              placeholder="1-10个字符"
              maxlength="10"
              required
            />
          </div>
        </div>

        <div class="field">
          <label for="room-name-join">房间名称</label>
          <div class="input-wrap">
            <span class="input-icon">🔑</span>
            <input
              id="room-name-join"
              v-model="joinRoomName"
              type="text"
              placeholder="输入房间名称"
              maxlength="20"
              required
            />
          </div>
        </div>

        <div class="field">
          <label for="password-join">房间密码</label>
          <div class="input-wrap">
            <span class="input-icon">🔒</span>
            <input
              id="password-join"
              v-model="password"
              type="password"
              placeholder="无密码"
              maxlength="20"
            />
          </div>
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          <span v-if="isLoading" class="btn-loading" />
          <span v-else>🚪 加入房间</span>
        </button>
      </form>
    </div>

    <Transition name="fade">
      <p v-if="errorMessage" class="error-toast">{{ errorMessage }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import changelogMd from '../../../CHANGELOG.md?raw'

const router = useRouter()
const roomStore = useRoomStore()

const showChangelog = ref(false)

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
        return `<li>${line.slice(2)}</li>`
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

const renderedChangelog = computed(() => renderMarkdown(changelogMd))

const activeTab = ref<'create' | 'join'>('create')
const nickname = ref('')
const createRoomName = ref('')
const joinRoomName = ref('')
const maxPlayers = ref(50)
const password = ref('')
const isLoading = ref(false)

const errorMessage = ref<string | null>(null)

watch(() => roomStore.error, (newError) => {
  errorMessage.value = newError
  if (newError) {
    isLoading.value = false
    setTimeout(() => { errorMessage.value = null }, 4000)
  }
})

watch(() => roomStore.room, (newRoom) => {
  if (newRoom && roomStore.currentPlayerId) {
    router.push(`/lobby/${newRoom.code}`)
  }
})

function handleCreate() {
  if (!nickname.value.trim()) return
  isLoading.value = true
  errorMessage.value = null
  roomStore.createRoom(nickname.value.trim(), {
    roomName: createRoomName.value.trim() || undefined,
    maxPlayers: maxPlayers.value,
    password: password.value || undefined,
  })
  setTimeout(() => {
    if (!roomStore.room) isLoading.value = false
  }, 5000)
}

function handleJoin() {
  if (!nickname.value.trim() || !joinRoomName.value.trim()) return
  isLoading.value = true
  errorMessage.value = null
  roomStore.joinRoom(joinRoomName.value.trim(), nickname.value.trim(), password.value || undefined)
  setTimeout(() => {
    if (!roomStore.room) isLoading.value = false
  }, 5000)
}
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
  margin-top: 1.25rem;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

/* ─── Changelog ─── */
.btn-changelog {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition);
  box-shadow: var(--shadow-sm);
}

.btn-changelog:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: var(--shadow-glow);
}

.changelog-icon { font-size: 0.9rem; }

.changelog-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
}

.changelog-modal {
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  animation: popIn 0.3s ease-out;
}

.changelog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--color-border-light);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
  flex-shrink: 0;
}

.changelog-close {
  background: transparent;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  line-height: 1;
}

.changelog-close:hover {
  background: var(--color-border-light);
  color: var(--color-text);
}

.changelog-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--color-text);
}

.changelog-body h1 {
  display: none;
}

.changelog-body h2 {
  font-family: var(--font-title);
  font-size: 1rem;
  color: var(--color-primary);
  margin: 1rem 0 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid var(--color-border-light);
}

.changelog-body h2:first-of-type {
  margin-top: 0;
}

.changelog-body ul {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
}

.changelog-body li {
  position: relative;
  padding: 0.2rem 0 0.2rem 1rem;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.changelog-body li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.6rem;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
  opacity: 0.6;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* ─── Mobile ─── */
@media (max-width: 480px) {
  .home-page {
    padding: 1rem 0.75rem;
  }

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
