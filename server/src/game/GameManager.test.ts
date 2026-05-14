import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameManager } from './GameManager.js'

const mockEmit = vi.fn()
const mockTo = vi.fn().mockReturnValue({ emit: mockEmit })

Object.defineProperty(global, 'io', {
  value: { to: mockTo },
  writable: true,
})

describe('GameManager', () => {
  let gameManager: GameManager

  beforeEach(() => {
    vi.clearAllMocks()
    gameManager = new GameManager()
  })

  describe('clearCanvas', () => {
    it('should return false for non-existent room', () => {
      const result = gameManager.clearCanvas('non-existent', 'player', 'socket1')
      expect(result).toBe(false)
    })
  })

  describe('handleDrawStroke', () => {
    it('should return without io for non-existent room', () => {
      // Should not throw
      expect(() => {
        gameManager.handleDrawStroke('non-existent', 'player', 'socket1', [], '#000', 4, 'brush')
      }).not.toThrow()
    })
  })

  describe('submitAnswer', () => {
    it('should return incorrect for non-existent room', () => {
      const result = gameManager.submitAnswer('non-existent', 'player', 'test')
      expect(result.correct).toBe(false)
    })
  })
})