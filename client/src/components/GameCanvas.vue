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
let lastEmitPointCount = 0
let resizeObserver: ResizeObserver | null = null
let currentPathObject: FabricPath | null = null
let pendingResize = false
let strokeSeq = 0
const EMIT_INTERVAL = 16
const strokePathMap = new Map<string, FabricPath>()

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
  strokeSeq++
  const point = touchEventPoint(e.touches[0])
  canvasStore.startStroke(point)
  lastEmitTime = Date.now()
  lastEmitPointCount = 0
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
  finalizeStroke()
  renderCompletedStrokes()
  if (pendingResize) { pendingResize = false; resizeCanvas() }
}

function handleMouseDown(e: { e: MouseEvent }) {
  if (props.readonly || !gameStore.isMyTurn) return
  strokeSeq++
  const point = getCanvasPoint(e)
  canvasStore.startStroke(point)
  lastEmitTime = Date.now()
  lastEmitPointCount = 0
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
  finalizeStroke()
  renderCompletedStrokes()
  if (pendingResize) { pendingResize = false; resizeCanvas() }
}

function simplifyPath(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points
  const [start, end] = [points[0], points[points.length - 1]]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const segLen = dx * dx + dy * dy

  let maxDist = 0
  let maxIdx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const dist = segLen === 0
      ? Math.hypot(points[i].x - start.x, points[i].y - start.y)
      : Math.abs(dy * points[i].x - dx * points[i].y + end.x * start.y - end.y * start.x) / Math.sqrt(segLen)
    if (dist > maxDist) { maxDist = dist; maxIdx = i }
  }

  if (maxDist < epsilon) return [start, end]

  const left = simplifyPath(points.slice(0, maxIdx + 1), epsilon)
  const right = simplifyPath(points.slice(maxIdx), epsilon)
  return [...left.slice(0, -1), ...right]
}

function emitStroke() {
  const allPoints = canvasStore.currentStroke
  if (allPoints.length === 0 || !fabricCanvas) return
  let newPoints = allPoints.slice(lastEmitPointCount)
  if (newPoints.length === 0) return
  if (newPoints.length > 10) {
    newPoints = simplifyPath(newPoints, 2)
  }
  lastEmitPointCount = allPoints.length
  const cw = fabricCanvas.width ?? 1
  const ch = fabricCanvas.height ?? 1
  gameStore.drawStroke(
    newPoints.map((p) => ({ x: p.x / cw, y: p.y / ch })),
    canvasStore.tool === 'eraser' ? '#ffffff' : canvasStore.color,
    canvasStore.tool === 'eraser' ? canvasStore.width * 3 : canvasStore.width,
    canvasStore.tool,
    strokeSeq
  )
}

function finalizeStroke() {
  if (canvasStore.currentStroke.length === 0 || !fabricCanvas) return
  const cw = fabricCanvas.width ?? 1
  const ch = fabricCanvas.height ?? 1
  gameStore.addCompletedStroke(
    canvasStore.currentStroke.map((p) => ({ x: p.x / cw, y: p.y / ch })),
    canvasStore.tool === 'eraser' ? '#ffffff' : canvasStore.color,
    canvasStore.tool === 'eraser' ? canvasStore.width * 3 : canvasStore.width,
    canvasStore.tool
  )
  canvasStore.currentStroke = []
  canvasStore.isDrawing = false
}

function renderCompletedStrokes() {
  if (!fabricCanvas) return
  const cw = fabricCanvas.width ?? 1
  const ch = fabricCanvas.height ?? 1

  fabricCanvas.clear()
  fabricCanvas.backgroundColor = '#ffffff'
  strokePathMap.clear()

  for (const stroke of gameStore.strokes) {
    if (stroke.points.length === 0) continue
    if (stroke.points.length === 1) {
      const p = stroke.points[0]
      const radius = stroke.width / 2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const circle = new (fabric as any).Circle({
        left: p.x * cw - radius,
        top: p.y * ch - radius,
        radius,
        fill: stroke.color,
        selectable: false,
        evented: false,
      })
      fabricCanvas.add(circle)
      continue
    }
    const pathData = stroke.points
      .map((p: Point, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x * cw} ${p.y * ch}`)
      .join(' ')
    const path = new fabric.Path(pathData, {
      stroke: stroke.color,
      strokeWidth: stroke.width,
      fill: null,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: false,
      evented: false,
    })
    fabricCanvas.add(path)
    if (stroke.strokeSeq !== undefined) {
      strokePathMap.set(`${stroke.playerId}:${stroke.strokeSeq}`, path)
    }
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

  if (canvasStore.currentStroke.length === 1) {
    const p = canvasStore.currentStroke[0]
    const circleColor = canvasStore.tool === 'eraser' ? '#ffffff' : canvasStore.color
    const circleRadius = (canvasStore.tool === 'eraser' ? canvasStore.width * 3 : canvasStore.width) / 2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPathObject = new (fabric as any).Circle({
      left: p.x - circleRadius,
      top: p.y - circleRadius,
      radius: circleRadius,
      fill: circleColor,
      selectable: false,
      evented: false,
    })
    fabricCanvas.add(currentPathObject!)
    fabricCanvas.renderAll()
    return
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
      selectable: false,
      evented: false,
    })
    fabricCanvas.add(currentPathObject)
  }

  fabricCanvas.renderAll()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyIncrementalStroke(data: any) {
  if (!fabricCanvas) return
  const cw = fabricCanvas.width ?? 1
  const ch = fabricCanvas.height ?? 1
  const key = data.strokeSeq !== undefined ? `${data.playerId}:${data.strokeSeq}` : undefined
  const existing = key ? strokePathMap.get(key) : undefined
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentPath = existing.get('path') as any
    if (currentPath) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newPoints = data.points.map((p: any) => ['L', p.x * cw, p.y * ch])
      existing.set('path', [...currentPath, ...newPoints])
      existing.setCoords()
      fabricCanvas.renderAll()
      return
    }
  }
  renderCompletedStrokes()
}

function resizeCanvas() {
  if (!fabricCanvas || !containerRef.value) return

  const containerWidth = containerRef.value.clientWidth
  const containerHeight = containerRef.value.clientHeight

  if (containerWidth <= 0 || containerHeight <= 0) return

  // Always fill container without aspect ratio constraint (same as mobile)
  // Avoids dead zones where events don't reach the canvas
  let width = Math.floor(containerWidth)
  let height = Math.floor(containerHeight)

  if (fabricCanvas.width === width && fabricCanvas.height === height) return

  fabricCanvas.setWidth(width)
  fabricCanvas.setHeight(height)
  renderCompletedStrokes()
}

watch(() => gameStore.strokeVersion, () => {
  if (!fabricCanvas) return
  if (gameStore.pendingStrokeUpdate) {
    applyIncrementalStroke(gameStore.pendingStrokeUpdate)
    gameStore.pendingStrokeUpdate = null
  }
  if (gameStore.pendingFullRedraw) {
    strokePathMap.clear()
    renderCompletedStrokes()
    gameStore.pendingFullRedraw = false
  }
})

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
    renderCompletedStrokes()
  }
}

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  const initialWidth = containerRef.value.clientWidth
  const initialHeight = containerRef.value.clientHeight

  fabricCanvas = new fabric.Canvas(canvasRef.value, {
    width: Math.floor(initialWidth),
    height: Math.floor(initialHeight),
    backgroundColor: '#ffffff',
    isDrawingMode: false,
    selection: false,
  })

  fabricCanvas.on('mouse:down', handleMouseDown)
  fabricCanvas.on('mouse:move', handleMouseMove)
  fabricCanvas.on('mouse:up', handleMouseUp)

  // 原生触摸事件绕过 Fabric.js 的 touch→mouse 转换
  canvasRef.value.addEventListener('touchstart', handleTouchStart, { passive: false })
  canvasRef.value.addEventListener('touchmove', handleTouchMove, { passive: false })
  canvasRef.value.addEventListener('touchend', handleTouchEnd, { passive: false })

  resizeObserver = new ResizeObserver(() => {
    if (canvasStore.isDrawing) {
      pendingResize = true
    } else {
      resizeCanvas()
    }
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
  box-sizing: border-box;
  margin: 0 auto;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: visible;
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
  border-radius: var(--radius-md);
  overflow: hidden;
}

@media (max-width: 768px) {
  .game-canvas {
    border-radius: 0;
    border-width: 1px 0;
    max-width: 100%;
    min-height: 0;
  }

  .game-canvas canvas {
    border-radius: 0;
  }
}
</style>
