<template>
  <div class="toolbar">
    <div class="tool-group">
      <button
        :class="{ active: canvasStore.tool === 'brush' }"
        @click="canvasStore.setTool('brush')"
      >
        画笔
      </button>
      <button
        :class="{ active: canvasStore.tool === 'eraser' }"
        @click="canvasStore.setTool('eraser')"
      >
        橡皮擦
      </button>
    </div>

    <div class="tool-group colors">
      <button
        v-for="color in canvasStore.PRESET_COLORS"
        :key="color"
        :class="['color-btn', { active: canvasStore.color === color && canvasStore.tool === 'brush' }]"
        :style="{ backgroundColor: color }"
        @click="selectColor(color)"
      />
    </div>

    <div class="tool-group widths">
      <button
        v-for="(size, name) in canvasStore.WIDTH_PRESETS"
        :key="name"
        :class="{ active: canvasStore.width === size && canvasStore.tool === 'brush' }"
        @click="selectWidth(size)"
      >
        <span class="width-dot" :style="{ width: size * 2 + 'px', height: size * 2 + 'px' }" />
      </button>
    </div>

    <div class="tool-group">
      <button class="btn-clear" @click="handleClear">
        清空画布
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
  gap: 1.5rem;
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-wrap: wrap;
  align-items: center;
}

.tool-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.tool-group button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-group button.active {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}

.tool-group button:hover:not(.active) {
  background: #f5f5f5;
}

.colors {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.color-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #ddd;
  cursor: pointer;
  transition: transform 0.2s;
}

.color-btn.active {
  border-color: #4a90d9;
  transform: scale(1.1);
}

.color-btn:hover:not(.active) {
  transform: scale(1.05);
}

.widths {
  display: flex;
  gap: 0.5rem;
}

.width-dot {
  display: block;
  background: #333;
  border-radius: 50%;
}

.btn-clear {
  background: #ff4444 !important;
  color: #fff !important;
  border-color: #ff4444 !important;
}

.btn-clear:hover {
  background: #cc0000 !important;
}
</style>