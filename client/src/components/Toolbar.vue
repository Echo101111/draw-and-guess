<template>
  <div class="toolbar-wrap">
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

      <div class="divider hide-mobile" />

      <div class="tool-group colors hide-mobile">
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
        <button class="tool-btn" @click="handleUndo" title="撤销 (Ctrl+Z)">
          <span class="tool-icon">↩️</span>
          <span class="tool-label">撤销</span>
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

    <div class="mobile-colors-row">
      <button
        v-for="c in canvasStore.PRESET_COLORS"
        :key="c"
        :class="['color-btn', { active: canvasStore.color === c && canvasStore.tool === 'brush' }]"
        :style="{ backgroundColor: c }"
        :title="c"
        @click="selectColor(c)"
      />
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
  canvasStore.clearCanvas()
  gameStore.clearCanvas()
}

function handleUndo() {
  gameStore.undoStroke()
}
</script>

<style scoped>
.toolbar-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
}

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
  flex-shrink: 0;
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

.mobile-colors-row {
  display: none;
}

.hide-mobile {
  display: flex;
}

/* ─── Mobile ─── */
@media (max-width: 600px) {
  .toolbar-wrap {
    gap: 0.25rem;
  }

  .toolbar {
    gap: 0.15rem;
    padding: 0.3rem 0.4rem;
    border-radius: var(--radius-md);
    flex-wrap: nowrap;
    justify-content: center;
  }

  .tool-group {
    flex-shrink: 0;
  }

  .divider {
    height: 18px;
    flex-shrink: 0;
  }

  .tool-btn {
    padding: 0.25rem 0.35rem;
    font-size: 0.7rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tool-icon {
    font-size: 0.85rem;
  }

  .tool-label {
    display: none;
  }

  .width-btn {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .btn-clear {
    padding: 0.25rem 0.35rem;
  }

  .hide-mobile {
    display: none;
  }

  .mobile-colors-row {
    display: flex;
    gap: 0.3rem;
    padding: 0.2rem 0.4rem;
    background: var(--color-surface);
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border-light);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    align-items: center;
    justify-content: flex-start;
  }

  .mobile-colors-row::-webkit-scrollbar {
    display: none;
  }

  .mobile-colors-row .color-btn {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
}
</style>
