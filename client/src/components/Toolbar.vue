<template>
  <div class="toolbar">
    <div class="tool-group">
      <button
        :class="['tool-btn', { active: canvasStore.tool === 'brush' }]"
        @click="canvasStore.setTool('brush')"
        title="画笔"
      >
        <span class="tool-icon">✏️</span>
        <span class="tool-label">画笔</span>
      </button>
      <button
        :class="['tool-btn', { active: canvasStore.tool === 'eraser' }]"
        @click="canvasStore.setTool('eraser')"
        title="橡皮擦"
      >
        <span class="tool-icon">🧹</span>
        <span class="tool-label">橡皮</span>
      </button>
    </div>

    <div class="divider" />

    <div class="tool-group colors">
      <button
        v-for="c in canvasStore.PRESET_COLORS"
        :key="c"
        :class="['color-btn', { active: canvasStore.color === c && canvasStore.tool === 'brush' }]"
        :style="{ backgroundColor: c }"
        :title="c"
        @click="selectColor(c)"
      />
    </div>

    <div class="divider" />

    <div class="tool-group widths">
      <button
        v-for="(size, name) in canvasStore.WIDTH_PRESETS"
        :key="name"
        :class="['width-btn', { active: canvasStore.width === size }]"
        @click="selectWidth(size)"
        :title="name"
      >
        <span
          class="width-dot"
          :style="{
            width: size * 2 + 2 + 'px',
            height: size * 2 + 2 + 'px',
          }"
        />
      </button>
    </div>

    <div class="divider" />

    <div class="tool-group">
      <button class="tool-btn btn-clear" @click="handleClear" title="清空画布">
        <span class="tool-icon">🗑️</span>
        <span class="tool-label">清空</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasStore } from '@/stores/canvas'
import { useGameStore } from '@/stores/game'

const canvasStore = useCanvasStore()
const gameStore = useGameStore()

function selectColor(color: string) {
  canvasStore.setTool('brush')
  canvasStore.setColor(color)
}

function selectWidth(width: number) {
  canvasStore.setTool('brush')
  canvasStore.setWidth(width)
}

function handleClear() {
  if (confirm('确定要清空画布吗？')) {
    canvasStore.clearCanvas()
    gameStore.clearCanvas()
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.tool-group {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

.divider {
  width: 1px;
  height: 28px;
  background: var(--color-border-light);
  flex-shrink: 0;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.65rem;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  transition: var(--transition);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.tool-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.tool-btn.active {
  background: var(--color-accent-pale);
  border-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: 600;
}

.tool-icon {
  font-size: 1rem;
}

.tool-label {
  font-weight: 500;
}

.colors {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.color-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  cursor: pointer;
  transition: var(--transition);
  padding: 0;
}

.color-btn.active {
  border-color: var(--color-primary);
  transform: scale(1.15);
  box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-primary);
}

.color-btn:hover:not(.active) {
  transform: scale(1.1);
}

.widths {
  display: flex;
  gap: 0.35rem;
}

.width-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  transition: var(--transition);
}

.width-btn:hover {
  background: var(--color-bg);
}

.width-btn.active {
  background: var(--color-accent-pale);
  border-color: var(--color-accent);
}

.width-dot {
  display: block;
  background: var(--color-text);
  border-radius: 50%;
}

.btn-clear:hover {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

/* ─── Mobile ─── */
@media (max-width: 600px) {
  .toolbar {
    gap: 0.35rem;
    padding: 0.4rem 0.5rem;
    border-radius: var(--radius-md);
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    justify-content: flex-start;
  }

  .toolbar::-webkit-scrollbar {
    display: none;
  }

  .divider {
    height: 20px;
  }

  .tool-btn {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .tool-icon {
    font-size: 0.85rem;
  }

  .tool-label {
    font-size: 0.75rem;
  }

  .color-btn {
    width: 22px;
    height: 22px;
  }

  .width-btn {
    width: 28px;
    height: 28px;
  }
}
</style>
