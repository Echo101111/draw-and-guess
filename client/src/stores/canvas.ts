import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Stroke } from '@draw-and-guess/shared'

export const useCanvasStore = defineStore('canvas', () => {
  const strokes = ref<Stroke[]>([])
  const tool = ref<'brush' | 'eraser'>('brush')
  const color = ref('#000000')
  const width = ref(4)

  // Phase 0: 只定义结构，不实现业务逻辑
  // 后续 Phase 实现: addStroke, clearCanvas

  return {
    strokes,
    tool,
    color,
    width,
  }
})