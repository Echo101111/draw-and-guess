import { defineStore } from 'pinia'
import { ref } from 'vue'
import { PRESET_COLORS, WIDTH_PRESETS } from '@draw-and-guess/shared'
import type { Point } from '@draw-and-guess/shared'

export const useCanvasStore = defineStore('canvas', () => {
  const tool = ref<'brush' | 'eraser'>('brush')
  const color = ref('#000000')
  const width = ref<number>(WIDTH_PRESETS.medium)
  const isDrawing = ref(false)
  const currentStroke = ref<Point[]>([])

  function setTool(newTool: 'brush' | 'eraser') {
    tool.value = newTool
  }

  function setColor(newColor: string) {
    color.value = newColor
  }

  function setWidth(newWidth: number) {
    width.value = newWidth
  }

  function startStroke(point: Point) {
    isDrawing.value = true
    currentStroke.value = [point]
  }

  function continueStroke(point: Point) {
    if (!isDrawing.value) return
    currentStroke.value.push(point)
  }

  function clearCanvas() {
    currentStroke.value = []
    isDrawing.value = false
  }

  return {
    tool,
    color,
    width,
    isDrawing,
    currentStroke,
    PRESET_COLORS,
    WIDTH_PRESETS,
    setTool,
    setColor,
    setWidth,
    startStroke,
    continueStroke,
    clearCanvas,
  }
})
