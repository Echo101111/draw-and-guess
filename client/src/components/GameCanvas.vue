<template>
  <div ref="containerRef" class="game-canvas">
    <canvas ref="canvasRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { fabric } from 'fabric'
import { useCanvasStore } from '@/stores/canvas'
import { useGameStore } from '@/stores/game'
import type { Point } from '@draw-and-guess/shared'

type FabricCanvas = InstanceType<typeof fabric.Canvas>
type FabricPath = InstanceType<typeof fabric.Path>

const props = defineProps<{
  readonly?: boolean
}>()

const canvasStore = useCanvasStore()
const gameStore = useGameStore()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let fabricCanvas: FabricCanvas | null = null
let lastEmitTime = 0
let resizeObserver: ResizeObserver | null = null
let currentPathObject: FabricPath | null = null
const EMIT_INTERVAL = 16
const CANVAS_RATIO = 4 / 3

function getCanvasPoint(e: { e: MouseEvent | Touch }): Point {
  const pointer = fabricCanvas?.getPointer(e.e as unknown as MouseEvent)
  if (!pointer) return { x: 0, y: 0 }
  return { x: pointer.x, y: pointer.y }
}

// 原生触摸处理（绕过 Fabric.js 触摸→鼠标转换，确保移动端可靠）
function touchEventPoint(touch: Touch): Point {
  if (!canvasRef.value) return { x: 0, y: 0 }
  const rect = canvasRef.value.getBoundingClientRect()
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
}

function handleTouchStart(e: TouchEvent) {
  e.preventDefault()
  if (props.readonly || !gameStore.isMyTurn) return
  if (!canvasRef.value) return
  const point = touchEventPoint(e.touches[0])
  canvasStore.startStroke(point)
  lastEmitTime = Date.now()
  renderCurrentStroke()
}

function handleTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (props.readonly || !gameStore.isMyTurn) return
  if (!canvasStore.isDrawing) return
  if (!canvasRef.value) return
  const point = touchEventPoint(e.touches[0])
  canvasStore.continueStroke(point)
  renderCurrentStroke()
  const now = Date.now()
  if (now - lastEmitTime >= EMIT_INTERVAL && canvasStore.currentStroke.length > 0) {
    emitStroke()
    lastEmitTime = now
  }
}

function handleTouchEnd(e: TouchEvent) {
  e.preventDefault()
  if (props.readonly || !gameStore.isMyTurn) return
  if (canvasStore.currentStroke.length > 0) emitStroke()
  canvasStore.endStroke(fabricCanvas?.width, fabricCanvas?.height)
  renderCompletedStrokes()
}

function handleMouseDown(e: { e: MouseEvent }) {
  if (props.readonly || !gameStore.isMyTurn) return
  const point = getCanvasPoint(e)
  canvasStore.startStroke(point)
  renderCurrentStroke()
}

function handleMouseMove(e: { e: MouseEvent }) {
  if (props.readonly || !gameStore.isMyTurn) return
  if (!canvasStore.isDrawing) return
  const point = getCanvasPoint(e)
  canvasStore.continueStroke(point)
  renderCurrentStroke()
  const now = Date.now()
  if (now - lastEmitTime >= EMIT_INTERVAL && canvasStore.currentStroke.length > 0) {
    emitStroke()
    lastEmitTime = now
  }
}

function handleMouseUp() {
  if (props.readonly || !gameStore.isMyTurn) return
  if (canvasStore.currentStroke.length > 0) emitStroke()
  canvasStore.endStroke(fabricCanvas?.width, fabricCanvas?.height)
  renderCompletedStrokes()
}

function emitStroke() {
  const points = canvasStore.currentStroke
  if (points.length === 0 || !fabricCanvas) return
  const cw = fabricCanvas.width ?? 1
  const ch = fabricCanvas.height ?? 1
  gameStore.drawStroke(
    points.map((p) => ({ x: p.x / cw, y: p.y / ch })),
    canvasStore.tool === 'eraser' ? '#ffffff' : canvasStore.color,
    canvasStore.tool === 'eraser' ? canvasStore.width * 3 : canvasStore.width,
    canvasStore.tool
  )
}

function renderCompletedStrokes() {
  if (!fabricCanvas) return
  const cw = fabricCanvas.width ?? 1
  const ch = fabricCanvas.height ?? 1

  fabricCanvas.clear()
  fabricCanvas.backgroundColor = '#ffffff'

  for (const stroke of canvasStore.strokes) {
    if (stroke.points.length < 2) continue
    const pathData = stroke.points
      .map((p: Point, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x * cw} ${p.y * ch}`)
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

  currentPathObject = null
  renderCurrentStroke()
}

function renderCurrentStroke() {
  if (!fabricCanvas) return

  if (currentPathObject) {
    fabricCanvas.remove(currentPathObject)
    currentPathObject = null
  }

  if (canvasStore.currentStroke.length >= 2) {
    const currentPathData = canvasStore.currentStroke
      .map((p: Point, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')
    const currentColor = canvasStore.tool === 'eraser' ? '#ffffff' : canvasStore.color
    const currentWidth = canvasStore.tool === 'eraser' ? canvasStore.width * 3 : canvasStore.width
    currentPathObject = new fabric.Path(currentPathData, {
      stroke: currentColor,
      strokeWidth: currentWidth,
      fill: null,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    })
    fabricCanvas.add(currentPathObject)
  }

  fabricCanvas.renderAll()
}

function resizeCanvas() {
  if (!fabricCanvas || !containerRef.value) return

  const containerWidth = containerRef.value.clientWidth
  const containerHeight = containerRef.value.clientHeight

  if (containerWidth <= 0 || containerHeight <= 0) return

  let width: number
  let height: number

  // Narrow screens (mobile): fill container without aspect ratio constraint
  // Avoids dead zones where touch events don't reach the canvas
  if (containerWidth < 768) {
    width = containerWidth
    height = containerHeight
  } else {
    // Desktop/tablet: maintain 4:3 aspect ratio
    width = containerWidth
    height = width / CANVAS_RATIO
    if (height > containerHeight) {
      height = containerHeight
      width = height * CANVAS_RATIO
    }
  }

  width = Math.floor(width)
  height = Math.floor(height)

  if (fabricCanvas.width === width && fabricCanvas.height === height) return

  fabricCanvas.setWidth(width)
  fabricCanvas.setHeight(height)
  renderCompletedStrokes()
}

watch(() => gameStore.strokes, () => {
  canvasStore.syncStrokes(gameStore.strokes)
  renderCompletedStrokes()
}, { deep: true })

watch(() => gameStore.currentWord, () => {
  if (gameStore.currentWord !== null && gameStore.isMyTurn) {
    canvasStore.clearCanvas()
    if (fabricCanvas) renderCompletedStrokes()
  }
})

// 在 canvas 初始化前可能已有笔画到达 gameStore.strokes（路由跳转窗口期），
// 初始化后同步一次确保不丢失
function syncExistingStrokes() {
  if (gameStore.strokes.length > 0) {
    canvasStore.syncStrokes(gameStore.strokes)
    renderCompletedStrokes()
  }
}

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  const initialWidth = Math.min(containerRef.value.clientWidth, 800)
  const initialHeight = Math.floor(initialWidth / CANVAS_RATIO)

  fabricCanvas = new fabric.Canvas(canvasRef.value, {
    width: Math.floor(initialWidth),
    height: initialHeight,
    backgroundColor: '#ffffff',
    isDrawingMode: false,
  })

  fabricCanvas.on('mouse:down', handleMouseDown)
  fabricCanvas.on('mouse:move', handleMouseMove)
  fabricCanvas.on('mouse:up', handleMouseUp)

  // 原生触摸事件绕过 Fabric.js 的 touch→mouse 转换
  canvasRef.value.addEventListener('touchstart', handleTouchStart, { passive: false })
  canvasRef.value.addEventListener('touchmove', handleTouchMove, { passive: false })
  canvasRef.value.addEventListener('touchend', handleTouchEnd, { passive: false })

  resizeObserver = new ResizeObserver(() => {
    resizeCanvas()
  })
  resizeObserver.observe(containerRef.value)

  renderCompletedStrokes()
  syncExistingStrokes()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (fabricCanvas) {
    fabricCanvas.off('mouse:down')
    fabricCanvas.off('mouse:move')
    fabricCanvas.off('mouse:up')
    fabricCanvas.dispose()
    fabricCanvas = null
  }

  if (canvasRef.value) {
    canvasRef.value.removeEventListener('touchstart', handleTouchStart)
    canvasRef.value.removeEventListener('touchmove', handleTouchMove)
    canvasRef.value.removeEventListener('touchend', handleTouchEnd)
  }
})
</script>

<style scoped>
.game-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 800px;
  box-sizing: border-box;
  margin: 0 auto;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  background: #fff;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.game-canvas canvas {
  display: block;
  cursor: crosshair;
  touch-action: none;
}

@media (max-width: 768px) {
  .game-canvas {
    border-radius: 0;
    border-width: 1px 0;
    max-width: 100%;
    min-height: 0;
  }
}
</style>
