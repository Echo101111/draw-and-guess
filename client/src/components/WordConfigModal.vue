<template>
  <Transition name="fade">
    <div v-if="show" class="word-config-overlay" @click.self="$emit('close')">
      <div class="word-config-modal">
        <div class="word-config-modal-header">
          <span>⚙️ 词库设置</span>
          <button class="word-config-modal-close" @click="$emit('close')">✕</button>
        </div>
        <div class="word-config-modal-body">
          <div class="word-config-field">
            <label>自定义词汇（留空则使用系统词库，配置 N 个词 = N 轮）</label>
            <div class="custom-words-list">
              <div v-for="(item, index) in words" :key="index" class="custom-word-row">
                <input v-model="item.word" type="text" placeholder="词汇" maxlength="20" class="word-input" />
                <select v-model="item.category" class="cat-select">
                  <option v-for="opt in CATEGORIES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  <option value="__custom__">自定义...</option>
                </select>
                <input v-if="item.category === '__custom__'" v-model="item.customText" type="text" placeholder="输入分类" class="cat-input" />
                <button class="btn-remove-word" @click="removeWord(index)" :disabled="words.length <= 1">✕</button>
              </div>
            </div>
            <button type="button" class="btn-add-word" @click="addWord">+ 添加词汇</button>
            <div v-if="wordCount > 0" class="word-count-hint">
              共 {{ wordCount }} 个词汇 → {{ wordCount }} 轮
            </div>
          </div>
          <div class="word-config-field">
            <label>出现词汇类型</label>
            <div class="category-toggles">
              <button
                v-for="opt in CATEGORIES"
                :key="opt.value"
                :class="['cat-toggle', { active: enabledCategories.includes(opt.value as string) }]"
                @click="toggleCategory(opt.value as string)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <div v-if="customCategories.length > 0" class="word-config-field">
            <button class="collapsible-header" @click="showCustomCats = !showCustomCats">
              <span>{{ showCustomCats ? '▼' : '▶' }} 用户贡献词库</span>
              <span class="collapsible-sub">（{{ customCategories.length }} 个分类）</span>
            </button>
            <div v-if="showCustomCats" class="category-toggles" style="margin-top:0.3rem">
              <button
                v-for="cat in customCategories"
                :key="cat"
                :class="['cat-toggle cat-toggle-custom', { active: enabledCustomCats.includes(cat) }]"
                @click="toggleCustomCat(cat)"
              >
                {{ cat }}
              </button>
            </div>
          </div>
          <div class="word-config-field">
            <label class="checkbox-label">
              <input type="checkbox" v-model="looseMatching" />
              宽松匹配（接受同义词/近似答案）
            </label>
          </div>
          <button class="btn-save-custom" @click="saveConfig">保存配置</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CATEGORIES } from '@draw-and-guess/shared'
import type { RoomWordConfig, CustomWord, WordCategory } from '@draw-and-guess/shared'

const props = defineProps<{
  show: boolean
  initialConfig?: Partial<RoomWordConfig> | null
}>()

const emit = defineEmits<{
  close: []
  save: [config: Partial<RoomWordConfig>]
}>()

const words = ref<{ word: string; category: string; customText: string }[]>([
  { word: '', category: 'animals', customText: '' },
])
const looseMatching = ref(false)
const enabledCategories = ref<string[]>([])
const enabledCustomCats = ref<string[]>([])
const customCategories = ref<string[]>([])
const showCustomCats = ref(false)

watch(() => props.show, async (val) => {
  if (val) {
    // 加载用户贡献的分类
    try {
      const res = await fetch('/api/words')
      const data = await res.json()
      const cats = new Set<string>()
      for (const w of (data.words ?? [])) {
        if (w.category) cats.add(w.category)
      }
      customCategories.value = [...cats].sort()
    } catch {
      customCategories.value = []
    }
  }

  if (val && props.initialConfig) {
    const wc = props.initialConfig
    if (wc.customWords && wc.customWords.length > 0) {
      words.value = wc.customWords.map((w: CustomWord) => ({
        word: w.word,
        category: CATEGORIES.some(o => o.value === w.category) ? w.category : '__custom__',
        customText: CATEGORIES.some(o => o.value === w.category) ? '' : w.category,
      }))
    } else {
      words.value = [{ word: '', category: 'animals', customText: '' }]
    }
    looseMatching.value = wc.looseMatching ?? false
    enabledCategories.value = wc.enabledCategories?.length
      ? wc.enabledCategories.map(c => c as string)
      : []
    enabledCustomCats.value = wc.enabledCustomCategories?.length
      ? [...wc.enabledCustomCategories]
      : []
  }
})

const wordCount = computed(() => words.value.filter(w => w.word.trim()).length)

function addWord() {
  words.value.push({ word: '', category: 'animals', customText: '' })
}

function removeWord(index: number) {
  words.value.splice(index, 1)
}

function toggleCategory(value: string) {
  const i = enabledCategories.value.indexOf(value)
  if (i >= 0) {
    enabledCategories.value.splice(i, 1)
  } else {
    enabledCategories.value.push(value)
  }
}

function toggleCustomCat(value: string) {
  const i = enabledCustomCats.value.indexOf(value)
  if (i >= 0) {
    enabledCustomCats.value.splice(i, 1)
  } else {
    enabledCustomCats.value.push(value)
  }
}

function saveConfig() {
  const customWords = words.value
    .filter(w => w.word.trim())
    .map(w => ({
      word: w.word.trim(),
      category: w.category === '__custom__' ? w.customText.trim() : w.category,
    }))
    .filter((w): w is CustomWord => w.word !== '' && w.category !== '')
  emit('save', {
    customWords,
    looseMatching: looseMatching.value,
    enabledCategories: enabledCategories.value as WordCategory[],
    enabledCustomCategories: enabledCustomCats.value,
  })
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

.btn-save-custom {
  margin-top: 0.35rem;
  padding: 0.4rem 0.8rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
}

.btn-save-custom:hover {
  opacity: 0.9;
}

.custom-words-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.custom-word-row {
  display: flex;
  gap: 0.3rem;
  align-items: stretch;
}

.custom-word-row .word-input {
  flex: 2;
  min-width: 0;
  padding: 0.35rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.76rem;
}

.custom-word-row .cat-select {
  flex: 1.5;
  min-width: 0;
  padding: 0.35rem 0.3rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.74rem;
  background: #fff;
}

.custom-word-row .cat-input {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.74rem;
}

.custom-word-row .btn-remove-word {
  padding: 0.2rem 0.45rem;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  cursor: pointer;
}

.custom-word-row .btn-remove-word:hover:not(:disabled) {
  color: #e74c3c;
  border-color: rgba(231, 76, 60, 0.25);
}

.custom-word-row .btn-remove-word:disabled {
  opacity: 0.3;
  cursor: default;
}

.btn-add-word {
  margin-top: 0.25rem;
  padding: 0.3rem 0.7rem;
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  cursor: pointer;
  width: 100%;
}

.btn-add-word:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.word-count-hint {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  margin-top: 0.2rem;
}

.word-config-field > .checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.76rem;
  color: var(--color-text);
  font-weight: 400;
  cursor: pointer;
}

.word-config-field > .checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
  accent-color: var(--color-accent);
}

.category-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.cat-toggle {
  padding: 0.3rem 0.5rem;
  border: 1.5px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  cursor: pointer;
  transition: var(--transition);
}

.cat-toggle.active {
  background: var(--color-accent-pale);
  border-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: 600;
}

.cat-toggle:hover:not(.active) {
  border-color: var(--color-accent-light);
  color: var(--color-text);
}

.cat-toggle-custom.active {
  background: var(--color-success-bg);
  border-color: var(--color-success);
  color: #5a9a56;
}

.collapsible-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0;
  background: none;
  border: none;
  font-size: 0.74rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-weight: 500;
}

.collapsible-header:hover {
  color: var(--color-text);
}

.collapsible-sub {
  font-weight: 400;
  font-size: 0.68rem;
  color: var(--color-text-muted);
}
</style>