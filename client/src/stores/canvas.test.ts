import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from './canvas'

describe('canvas store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('tool', () => {
    it('should default to brush', () => {
      const store = useCanvasStore()
      expect(store.tool).toBe('brush')
    })

    it('should set tool to eraser', () => {
      const store = useCanvasStore()
      store.setTool('eraser')
      expect(store.tool).toBe('eraser')
    })

    it('should switch back to brush', () => {
      const store = useCanvasStore()
      store.setTool('eraser')
      store.setTool('brush')
      expect(store.tool).toBe('brush')
    })
  })

  describe('color', () => {
    it('should default to black', () => {
      const store = useCanvasStore()
      expect(store.color).toBe('#000000')
    })

    it('should set color', () => {
      const store = useCanvasStore()
      store.setColor('#ff0000')
      expect(store.color).toBe('#ff0000')
    })
  })

  describe('width', () => {
    it('should default to 4', () => {
      const store = useCanvasStore()
      expect(store.width).toBe(4)
    })

    it('should set width', () => {
      const store = useCanvasStore()
      store.setWidth(8)
      expect(store.width).toBe(8)
    })
  })

  describe('strokes', () => {
    it('should start empty', () => {
      const store = useCanvasStore()
      expect(store.strokes).toHaveLength(0)
    })

    it('should add stroke when ending', () => {
      const store = useCanvasStore()
      store.startStroke({ x: 0, y: 0 })
      store.continueStroke({ x: 10, y: 10 })
      store.endStroke()

      expect(store.strokes).toHaveLength(1)
      expect(store.strokes[0].points).toHaveLength(2)
    })

    it('should not add empty stroke', () => {
      const store = useCanvasStore()
      store.endStroke()
      expect(store.strokes).toHaveLength(0)
    })

    it('should use eraser color when tool is eraser', () => {
      const store = useCanvasStore()
      store.setTool('eraser')
      store.startStroke({ x: 0, y: 0 })
      store.continueStroke({ x: 10, y: 10 })
      store.endStroke()

      expect(store.strokes[0].tool).toBe('eraser')
    })

    it('should use current color for brush', () => {
      const store = useCanvasStore()
      store.setColor('#ff0000')
      store.startStroke({ x: 0, y: 0 })
      store.endStroke()

      expect(store.strokes[0].color).toBe('#ff0000')
    })
  })

  describe('clearCanvas', () => {
    it('should clear all strokes', () => {
      const store = useCanvasStore()
      store.startStroke({ x: 0, y: 0 })
      store.endStroke()
      store.startStroke({ x: 10, y: 10 })
      store.endStroke()

      store.clearCanvas()
      expect(store.strokes).toHaveLength(0)
    })

    it('should reset current stroke', () => {
      const store = useCanvasStore()
      store.startStroke({ x: 0, y: 0 })
      store.continueStroke({ x: 10, y: 10 })

      store.clearCanvas()
      expect(store.currentStroke).toHaveLength(0)
    })
  })

  describe('syncStrokes', () => {
    it('should replace strokes', () => {
      const store = useCanvasStore()
      store.startStroke({ x: 0, y: 0 })
      store.endStroke()

      store.syncStrokes([
        { playerId: '1', points: [{ x: 100, y: 100 }], color: '#000000', width: 4, tool: 'brush' },
      ])

      expect(store.strokes).toHaveLength(1)
      expect(store.strokes[0].points[0].x).toBe(100)
    })
  })

  describe('WIDTH_PRESETS', () => {
    it('should have thin, medium, thick', () => {
      const store = useCanvasStore()
      expect(store.WIDTH_PRESETS.thin).toBe(2)
      expect(store.WIDTH_PRESETS.medium).toBe(4)
      expect(store.WIDTH_PRESETS.thick).toBe(8)
    })
  })
})