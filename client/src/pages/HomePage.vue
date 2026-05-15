<template>
  <div class="home-page">
    <button class="btn-changelog" @click="loadChangelog(); showChangelog = true" title="更新日志">
      <span class="changelog-icon">📋</span>
      <span class="changelog-label">更新日志</span>
    </button>

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

        <div class="word-config-section">
          <button type="button" class="word-config-toggle" @click="showWordConfig = !showWordConfig">
            <span class="toggle-icon">⚙️</span>
            <span>词库设置</span>
            <span class="toggle-arrow">{{ showWordConfig ? '▾' : '▸' }}</span>
          </button>
          <div v-if="showWordConfig" class="word-config-panel">
            <div class="word-config-field">
              <label>词库预设</label>
              <select v-model="selectedPreset" @change="applyPreset">
                <option value="">默认（全部启用）</option>
                <option v-for="p in WORD_PRESETS" :key="p.name" :value="p.name">{{ p.label }}</option>
              </select>
            </div>

            <div class="word-config-field">
              <label>分类选择</label>
              <div class="checkbox-group">
                <label v-for="cat of WORD_CATEGORIES_DISPLAY" :key="cat.key" class="checkbox-label">
                  <input type="checkbox" :value="cat.key" v-model="wordConfig.categoryFilter" />
                  {{ cat.label }}
                </label>
              </div>
            </div>

            <div class="word-config-field">
              <label>难度范围</label>
              <div class="checkbox-group inline">
                <label class="checkbox-label"><input type="checkbox" value="easy" v-model="wordConfig.difficultyFilter" /> 简单</label>
                <label class="checkbox-label"><input type="checkbox" value="medium" v-model="wordConfig.difficultyFilter" /> 中等</label>
                <label class="checkbox-label"><input type="checkbox" value="hard" v-model="wordConfig.difficultyFilter" /> 困难</label>
              </div>
            </div>

            <div class="word-config-field">
              <label>可画性要求：{{ wordConfig.minDrawability }}</label>
              <div class="slider-wrap">
                <span class="slider-label">抽象</span>
                <input type="range" v-model.number="wordConfig.minDrawability" min="1" max="5" step="1" />
                <span class="slider-label">具象</span>
              </div>
            </div>

            <div class="word-config-field">
              <label>自定义词汇（每行一个或逗号分隔，至少5个）</label>
              <textarea v-model="customWordsRaw" rows="3" placeholder="例如：奥特曼, 皮卡丘, 柯南, 路飞, 鸣人" />
            </div>

            <div class="word-config-field">
              <label class="checkbox-label">
                <input type="checkbox" v-model="wordConfig.useOnlyCustomWords" />
                仅使用自定义词
              </label>
            </div>

            <div class="word-config-field">
              <label class="checkbox-label">
                <input type="checkbox" v-model="wordConfig.looseMatching" />
                宽松匹配（接受同义词/近似答案）
              </label>
            </div>
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
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { connectSocket, clearSession } from '@/composables/useSocket'
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

const WORD_PRESETS = [
  { name: 'concrete', label: '万物具象', config: { minDrawability: 4, difficultyFilter: ['easy', 'medium'] } as Partial<RoomWordConfig> },
  { name: 'hardcore', label: '高手挑战', config: { minDrawability: 1, difficultyFilter: ['medium', 'hard'] } as Partial<RoomWordConfig> },
  { name: 'kids', label: '亲子模式', config: { minDrawability: 5, difficultyFilter: ['easy'], categoryFilter: ['animals', 'food', 'daily'] } as Partial<RoomWordConfig> },
  { name: 'foodie', label: '美食特辑', config: { categoryFilter: ['food'], minDrawability: 3 } as Partial<RoomWordConfig> },
]

const router = useRouter()
const roomStore = useRoomStore()

const showChangelog = ref(false)
const changelogMd = ref('')
const changelogLoading = ref(false)

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

const activeTab = ref<'create' | 'join'>('create')
const nickname = ref('')
const createRoomName = ref('')
const joinRoomName = ref('')
const maxPlayers = ref(50)
const password = ref('')
const isLoading = ref(false)
const showWordConfig = ref(false)
const selectedPreset = ref('')
const customWordsRaw = ref('')

const ALL_CATEGORIES: RoomWordConfig['categoryFilter'] = ['animals', 'food', 'daily', 'nature', 'vehicles', 'sports', 'characters']

const wordConfig = ref<RoomWordConfig>({
  categoryFilter: ALL_CATEGORIES,
  difficultyFilter: [],
  minDrawability: 1,
  customWords: [],
  useOnlyCustomWords: false,
  looseMatching: false,
  preset: null,
})

function applyPreset() {
  const preset = WORD_PRESETS.find(p => p.name === selectedPreset.value)
  if (!preset) {
    wordConfig.value = {
      categoryFilter: ALL_CATEGORIES,
      difficultyFilter: [],
      minDrawability: 1,
      customWords: [],
      useOnlyCustomWords: false,
      looseMatching: false,
      preset: null,
    }
    return
  }
  wordConfig.value = {
    categoryFilter: ALL_CATEGORIES,
    difficultyFilter: [],
    minDrawability: 1,
    customWords: [],
    useOnlyCustomWords: false,
    looseMatching: false,
    preset: selectedPreset.value,
    ...preset.config,
  }
}

const errorMessage = ref<string | null>(null)

watch(() => roomStore.error, (newError) => {
  errorMessage.value = newError
  if (newError) {
    isLoading.value = false
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { errorMessage.value = null; errorTimer = null }, 4000)
  }
})

watch(() => roomStore.room, (newRoom) => {
  if (newRoom && roomStore.currentPlayerId) {
    router.push(`/lobby/${newRoom.code}`)
  }
})

async function handleCreate() {
  if (!nickname.value.trim()) return
  isLoading.value = true
  errorMessage.value = null
  const config = { ...wordConfig.value }
  if (customWordsRaw.value.trim()) {
    config.customWords = customWordsRaw.value
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
      .map((word) => ({ word }))
  }
  await roomStore.createRoom(nickname.value.trim(), {
    roomName: createRoomName.value.trim() || undefined,
    maxPlayers: maxPlayers.value,
    password: password.value || undefined,
    wordConfig: config,
  })
}

async function handleJoin() {
  if (!nickname.value.trim() || !joinRoomName.value.trim()) return
  isLoading.value = true
  errorMessage.value = null
  await roomStore.joinRoom(joinRoomName.value.trim(), nickname.value.trim(), password.value || undefined)
}

onUnmounted(() => {
  if (errorTimer) clearTimeout(errorTimer)
})

onMounted(() => {
  clearSession()
  connectSocket()
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

/* ─── Changelog ─── */
.btn-changelog {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
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

.btn-changelog:active {
  transform: translateY(0);
}

.changelog-icon { font-size: 0.85rem; }
.changelog-label { font-size: 0.78rem; }

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

/* ─── Word Config Panel ─── */
.word-config-section {
  margin-top: 0.25rem;
}

.word-config-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-warm);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.word-config-toggle:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-pale);
}

.toggle-icon {
  font-size: 0.9rem;
}

.toggle-arrow {
  margin-left: auto;
  font-size: 0.7rem;
}

.word-config-panel {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-warm);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.word-config-field label {
  display: block;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.word-config-field select {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.78rem;
  background: #fff;
  color: var(--color-text);
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.8rem;
}

.checkbox-group.inline {
  gap: 0.5rem 1rem;
}

.checkbox-label {
  display: inline-flex !important;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.76rem !important;
  color: var(--color-text) !important;
  font-weight: 400 !important;
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

.word-config-panel textarea {
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.76rem;
  font-family: inherit;
  resize: vertical;
  background: #fff;
  color: var(--color-text);
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
