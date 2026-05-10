<template>
  <div class="game-canvas">
    <canvas ref="canvasRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as fabric from 'fabric'
import { useCanvasStore } from '@/stores/canvas'
import { useGameStore } from '@/stores/game'
import type { Point } from '@draw-and-guess/shared'

const props = defineProps<{
  readonly?: boolean
}>()

const canvasStore = useCanvasStore()
const gameStore = useGameStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let fabricCanvas: fabric.Canvas | null = null
let lastEmitTime = 0
const EMIT_INTERVAL = 16

function getCanvasPoint(e: { e: MouseEvent }): Point {
  const pointer = fabricCanvas?.getPointer(e.e)
  if (!pointer) return { x: 0, y: 0 }
  return { x: pointer.x, y: pointer.y }
}

function handleMouseDown(e: { e: MouseEvent }) {
  if (props.readonly || !gameStore.isMyTurn) return

  const point = getCanvasPoint(e)
  canvasStore.startStroke(point)
  renderStroke()
}

function handleMouseMove(e: { e: MouseEvent }) {
  if (props.readonly || !gameStore.isMyTurn) return
  if (!canvasStore.isDrawing) return

  const point = getCanvasPoint(e)
  canvasStore.continueStroke(point)
  renderStroke()

  const now = Date.now()
  if (now - lastEmitTime >= EMIT_INTERVAL && canvasStore.currentStroke.length > 0) {
    emitStroke()
    lastEmitTime = now
  }
}

function handleMouseUp() {
  if (props.readonly || !gameStore.isMyTurn) return

  const stroke = canvasStore.currentStroke
  canvasStore.endStroke()

  if (stroke.length > 0) {
    emitStroke()
  }

  renderStroke()
}

function emitStroke() {
  const points = canvasStore.currentStroke
  if (points.length === 0) return

  gameStore.drawStroke(
    points,
    canvasStore.tool === 'eraser' ? '#ffffff' : canvasStore.color,
    canvasStore.tool === 'eraser' ? canvasStore.width * 3 : canvasStore.width,
    canvasStore.tool
  )
}

function renderStroke() {
  if (!fabricCanvas) return

  fabricCanvas.clear()

  fabricCanvas.backgroundColor = '#ffffff'

  for (const stroke of canvasStore.strokes) {
    if (stroke.points.length < 2) continue

    const pathData = stroke.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')

    const path = new fabric.Path(pathData, {
      stroke: stroke.color,
      strokeWidth: stroke.width,
      fill: null,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    })

    fabricCanvas.add(path)
  }

  if (canvasStore.currentStroke.length >= 2) {
    const currentPathData = canvasStore.currentStroke
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')

    const currentColor = canvasStore.tool === 'eraser' ? '#ffffff' : canvasStore.color
    const currentWidth = canvasStore.tool === 'eraser' ? canvasStore.width * 3 : canvasStore.width

    const currentPath = new fabric.Path(currentPathData, {
      stroke: currentColor,
      strokeWidth: currentWidth,
      fill: null,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    })

    fabricCanvas.add(currentPath)
  }

  fabricCanvas.renderAll()
}

watch(() => gameStore.strokes, () => {
  canvasStore.syncStrokes(gameStore.strokes)
  renderStroke()
}, { deep: true })

watch(() => gameStore.currentWord, () => {
  if (gameStore.currentWord !== null && gameStore.isMyTurn) {
    canvasStore.clearCanvas()
    renderStroke()
  }
})

onMounted(() => {
  if (!canvasRef.value) return

  fabricCanvas = new fabric.Canvas(canvasRef.value, {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
    isDrawingMode: false,
  })

  fabricCanvas.on('mouse:down', handleMouseDown)
  fabricCanvas.on('mouse:move', handleMouseMove)
  fabricCanvas.on('mouse:up', handleMouseUp)

  renderStroke()
})

onUnmounted(() => {
  if (fabricCanvas) {
    fabricCanvas.off('mouse:down')
    fabricCanvas.off('mouse:move')
    fabricCanvas.off('mouse:up')
    fabricCanvas.dispose()
    fabricCanvas = null
  }
})
</script>

<style scoped>
.game-canvas {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.game-canvas canvas {
  display: block;
  width: 100%;
  height: auto;
}
</style>