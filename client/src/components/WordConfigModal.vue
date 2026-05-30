<template>
  <Transition name="fade">
    <div v-if="show" class="word-config-overlay" @click.self="$emit('close')">
      <div class="word-config-modal">
        <div class="word-config-modal-header">
          <span>⚙️ 词库设置</span>
          <button class="word-config-modal-close" @click="$emit('close')">✕</button>
        </div>
        <div class="word-config-modal-body">
          <div class="toggle-row">
            <label class="toggle-label">
              <span class="toggle-track">
                <input type="checkbox" v-model="useSystemWords" class="toggle-input" />
                <span class="toggle-slider" />
              </span>
              <span class="toggle-text">使用系统词库</span>
            </label>
          </div>

          <div class="status-section">
            <div v-if="useSystemWords" class="status-msg status-on">
              <span class="status-icon">📦</span>
              <span>系统词库已启用（涵盖所有内置分类）</span>
            </div>
            <div v-else class="status-msg status-off">
              <div class="status-row">
                <span class="status-icon">📦</span>
                <span>贡献词汇: <strong>{{ contributedCount }}</strong> 个可用</span>
              </div>
              <div v-if="fetchError" class="warning-msg">
                ⚠️ 无法获取贡献词数量，请稍后重试
              </div>
              <div v-else-if="contributedCount === 0" class="warning-msg">
                🚫 暂无贡献词汇，请先在首页贡献词库
              </div>
              <div v-else-if="contributedCount < requiredCount" class="warning-msg">
                ⚠️ 贡献词汇 ({{ contributedCount }}) 不足 ({{ requiredCount }})，游戏过程中可能出现重复词
              </div>
              <div v-else class="info-msg">
                ✅ 贡献词汇充足
              </div>
              <div class="calc-hint">
                预计 {{ totalRounds }} 轮 × 每轮 5 选 1 = 需要 {{ requiredCount }} 个不重复词
              </div>
            </div>
          </div>

          <button class="btn-save-custom" @click="saveConfig">保存配置</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoomStore } from '@/stores/room'
import { WORD_SELECTION_OPTIONS_COUNT } from '@draw-and-guess/shared'
import type { RoomWordConfig } from '@draw-and-guess/shared'

const props = defineProps<{
  show: boolean
  initialConfig?: Partial<RoomWordConfig> | null
}>()

const emit = defineEmits<{
  close: []
  save: [config: Partial<RoomWordConfig>]
}>()

const roomStore = useRoomStore()

const useSystemWords = ref(true)
const contributedCount = ref(0)
const fetchError = ref(false)

const players = computed(() => roomStore.room?.players?.length ?? 0)
const roundsPerPlayer = computed(() => roomStore.room?.roundsPerPlayer ?? 2)
const totalRounds = computed(() => Math.max(1, players.value * roundsPerPlayer.value))
const requiredCount = computed(() => totalRounds.value * WORD_SELECTION_OPTIONS_COUNT)

watch(() => props.show, async (val) => {
  if (!val) return

  useSystemWords.value = props.initialConfig?.useSystemWords ?? true

  if (!useSystemWords.value) {
    await fetchContributedCount()
  }
})

watch(useSystemWords, async (val) => {
  if (!val && props.show) {
    await fetchContributedCount()
  }
})

async function fetchContributedCount() {
  fetchError.value = false
  try {
    const res = await fetch('/api/words')
    const data = await res.json()
    contributedCount.value = data?.total ?? data?.words?.length ?? 0
  } catch {
    fetchError.value = true
    contributedCount.value = 0
  }
}

function saveConfig() {
  emit('save', { useSystemWords: useSystemWords.value })
}
</script>

<style scoped>
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
  gap: 0.85rem;
}

.toggle-row {
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  user-select: none;
}

.toggle-track {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  width: 40px;
  height: 22px;
  background: var(--color-border);
  border-radius: 11px;
  transition: background 0.25s;
  position: relative;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.25s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.toggle-input:checked + .toggle-slider {
  background: var(--color-primary);
}

.toggle-input:checked + .toggle-slider::after {
  transform: translateX(18px);
}

.toggle-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
}

.status-section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.status-msg {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  font-size: 0.82rem;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.status-on {
  background: var(--color-accent-pale);
  color: var(--color-text);
}

.status-off {
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
  color: var(--color-text);
}

.status-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.warning-msg {
  color: #c96a5e;
  font-size: 0.78rem;
  padding: 0.4rem 0.5rem;
  background: rgba(217, 117, 107, 0.07);
  border-radius: 6px;
}

.info-msg {
  color: #5a9a56;
  font-size: 0.78rem;
  padding: 0.4rem 0.5rem;
  background: rgba(126, 184, 122, 0.08);
  border-radius: 6px;
}

.calc-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  padding-top: 0.1rem;
}

.btn-save-custom {
  margin-top: 0.25rem;
  padding: 0.5rem 0.8rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: var(--transition);
}

.btn-save-custom:hover {
  opacity: 0.9;
}
</style>
