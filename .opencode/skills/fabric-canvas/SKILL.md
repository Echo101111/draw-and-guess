---
name: fabric-canvas
description: 处理 draw-and-guess 项目中 Fabric.js 画布相关问题。包括画布初始化、笔画渲染、坐标归一化、触摸事件、响应式适配、工具栏交互。当涉及 GameCanvas.vue、canvas store、Toolbar.vue 或 Fabric.js 相关代码时使用。
---

## Fabric.js 版本与导入

项目使用 Fabric 5.x module 导入方式：

```typescript
import { fabric } from 'fabric'
// 不要用 import * as fabric
```

类型声明在 `client/src/types/fabric.d.ts`，声明了 `fabric.Canvas`、`fabric.Path`、`IObjectOptions`。

运行时类型引用使用：
```typescript
type FabricCanvas = InstanceType<typeof fabric.Canvas>
type FabricPath = InstanceType<typeof fabric.Path>
```

## 坐标归一化

所有坐标在发送到服务端前归一化到 `0-1` 范围，接收时还原：

```typescript
// 发送端（emitStroke）
const cw = fabricCanvas.width ?? 1
const ch = fabricCanvas.height ?? 1
gameStore.drawStroke(
  newPoints.map((p) => ({ x: p.x / cw, y: p.y / ch })),
  color, width, tool, strokeSeq
)

// 渲染端（renderCompletedStrokes）
const pathData = stroke.points
  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * cw} ${p.y * ch}`)
  .join(' ')
```

这确保手机端和桌面端画布尺寸不同时坐标正确。

## 画布初始化

`GameCanvas.vue` 中初始化：

```typescript
fabricCanvas = new fabric.Canvas(canvasRef.value, {
  width: Math.floor(initialWidth),
  height: initialHeight,
  backgroundColor: '#ffffff',
  isDrawingMode: false,
  selection: false,
})
```

## 事件处理

**鼠标事件**（桌面端）：
- `mouse:down` → `handleMouseDown` → `startStroke` + 设置 `strokeSeq`
- `mouse:move` → `handleMouseMove` → `continueStroke` + 16ms 节流发送
- `mouse:up` → `handleMouseUp` → 发送剩余点 + `endStroke`

**触摸事件**（移动端）：
- 使用原生 `touchstart`/`touchmove`/`touchend` 事件（`passive: false`）
- 手动计算触摸点在 canvas 上的坐标：`touch.clientX - rect.left`
- 绕过 Fabric.js 的 touch→mouse 转换，确保移动端可靠

```typescript
function touchEventPoint(touch: Touch): Point {
  const rect = canvasRef.value!.getBoundingClientRect()
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
}
```

CSS `touch-action: none` 在 canvas 容器和 `<html>` 上都必须设置，防止 iOS 双击缩放。

## 笔画渲染

两个独立渲染路径：

1. **已完成笔画**（`renderCompletedStrokes`）：清空画布，遍历 `canvasStore.strokes` 全部重绘
2. **当前笔画**（`renderCurrentStroke`）：从 `canvasStore.currentStroke` 实时渲染正在画的线条

橡皮擦效果：将笔画颜色设为 `#ffffff`，宽度为普通笔画的 3 倍。

## 响应式适配

使用 `ResizeObserver` 自动适配容器尺寸：

```typescript
resizeObserver = new ResizeObserver(() => {
  if (canvasStore.isDrawing) {
    pendingResize = true  // 绘画中延迟调整
  } else {
    resizeCanvas()
  }
})
```

- **桌面端（≥768px）**：维持 4:3 比例，最大宽度 800px
- **移动端（<768px）**：填满容器，无宽高比约束
- 绘画过程中容器变化时标记 `pendingResize`，笔触结束后执行

## Canvas Store 状态管理

`client/src/stores/canvas.ts` 管理画布本地状态：

```typescript
strokes       // 已完成笔画数组
tool          // 'brush' | 'eraser'
color         // 12 色预设
width         // 3 档粗细（2/4/8）
isDrawing     // 是否正在绘画
currentStroke // 当前笔画点序列
```

## 工具栏交互

`Toolbar.vue` 中的关键操作：

```typescript
// 选择颜色时自动切回画笔
function selectColor(color: string) {
  canvasStore.setTool('brush')
  canvasStore.setColor(color)
}

// 选择粗细时自动切回画笔
function selectWidth(width: number) {
  canvasStore.setTool('brush')
  canvasStore.setWidth(width)
}

// 清空：直接操作，无确认弹窗
function handleClear() {
  canvasStore.clearCanvas()
  gameStore.clearCanvas()
}
```

## 笔画同步

本地 strokes ↔ 远程 strokes 通过 watcher 双向同步：

```typescript
// gameStore.strokes → canvasStore.strokes（服务端广播到达时）
watch(() => gameStore.strokes, () => {
  canvasStore.syncStrokes(gameStore.strokes)
}, { deep: true })

// 本店清空或笔画结束时驱动重绘
watch(() => canvasStore.strokes, () => {
  if (fabricCanvas) renderCompletedStrokes()
}, { deep: true })
```

## 常见问题排查

| 现象 | 原因与修复 |
|------|-----------|
| 笔画画不出来 | 检查 `gameStore.isMyTurn` 是否为 `true` |
| 移动端点击变缩放 | 检查 `touch-action: manipulation` 设在 `<html>` 上 |
| 桌面端鼠标画偏 | 检查 `getPointer(e.e)` 参数是否正确 |
| 重新调整大小 | 检查 `ResizeObserver` 的 `pendingResize` 逻辑 |
| 画布与容器比例不一致 | 检查 `resizeCanvas()` 的宽高计算 |
| 笔画闪烁 | 检查服务端是否 `socket.broadcast.to` 排除了画师 |
