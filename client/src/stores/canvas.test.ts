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

  describe('currentStroke', () => {
    it('should start empty', () => {
      const store = useCanvasStore()
      expect(store.isDrawing).toBe(false)
      expect(store.currentStroke).toHaveLength(0)
    })

    it('should record points on start and continue', () => {
      const store = useCanvasStore()
      store.startStroke({ x: 0, y: 0 })
      expect(store.isDrawing).toBe(true)
      expect(store.currentStroke).toHaveLength(1)

      store.continueStroke({ x: 10, y: 10 })
      expect(store.currentStroke).toHaveLength(2)
    })

    it('should not continue if not drawing', () => {
      const store = useCanvasStore()
      store.continueStroke({ x: 10, y: 10 })
      expect(store.currentStroke).toHaveLength(0)
    })
  })

  describe('clearCanvas', () => {
    it('should reset current stroke and drawing state', () => {
      const store = useCanvasStore()
      store.startStroke({ x: 0, y: 0 })
      store.continueStroke({ x: 10, y: 10 })

      store.clearCanvas()
      expect(store.currentStroke).toHaveLength(0)
      expect(store.isDrawing).toBe(false)
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
