import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Point } from '@draw-and-guess/shared'

export const useCanvasStore = defineStore('canvas', () => {
  const tool = ref<'brush' | 'eraser'>('brush')
  const color = ref('#000000')
  const width = ref(4)
  const isDrawing = ref(false)
  const currentStroke = ref<Point[]>([])

  const PRESET_COLORS = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#88ff00',
    '#0088ff', '#ff0088',
  ]

  const WIDTH_PRESETS = {
    thin: 2,
    medium: 4,
    thick: 8,
  }

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
