import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Point } from '@draw-and-guess/shared'

export const useCanvasStore = defineStore('canvas', () => {
  const strokes = ref<Array<{ points: Point[]; color: string; width: number; tool: string }>>([])
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

  function endStroke(canvasWidth?: number, canvasHeight?: number) {
    if (!isDrawing.value || currentStroke.value.length === 0) return

    const cw = canvasWidth ?? 1
    const ch = canvasHeight ?? 1

    strokes.value.push({
      points: currentStroke.value.map((p) => ({
        x: p.x / cw,
        y: p.y / ch,
      })),
      color: tool.value === 'eraser' ? '#ffffff' : color.value,
      width: tool.value === 'eraser' ? width.value * 3 : width.value,
      tool: tool.value,
    })

    currentStroke.value = []
    isDrawing.value = false
  }

  function clearCanvas() {
    strokes.value = []
    currentStroke.value = []
    isDrawing.value = false
  }

  function syncStrokes(newStrokes: Array<{ playerId: string; points: Point[]; color: string; width: number; tool: string }>) {
    strokes.value = newStrokes.map((s) => ({
      points: s.points,
      color: s.color,
      width: s.width,
      tool: s.tool,
    }))
  }

  return {
    strokes,
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
    endStroke,
    clearCanvas,
    syncStrokes,
  }
})