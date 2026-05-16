import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from './game'
import { SERVER_EVENTS, CLIENT_EVENTS } from '@draw-and-guess/shared'

const listeners = new Map<string, (...args: unknown[]) => void>()
const mockEmit = vi.fn()
const mockSocket = {
  on: (ev: string, fn: (...args: unknown[]) => void) => { listeners.set(ev, fn) },
  off: vi.fn(),
  emit: mockEmit,
  once: vi.fn(),
  connected: true,
}

vi.mock('@/composables/useSocket', () => ({
  getSocket: () => mockSocket,
}))

vi.mock('@/stores/room', () => ({
  useRoomStore: () => ({
    currentPlayerId: 'mock-player-1',
  }),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    clearCanvas: vi.fn(),
  }),
}))

function triggerEvent(event: string, data: unknown) {
  listeners.get(event)?.(data)
}

describe('game store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listeners.clear()
    vi.clearAllMocks()
  })

  describe('setupSocketListeners', () => {
    it('should handle ROUND_START for guesser', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.ROUND_START, {
        round: 1,
        totalRounds: 10,
        timeLeft: 90,
        drawer: { id: 'drawer-1', nickname: 'Artist' },
        wordLength: 3,
        wordCategory: '动物',
      })

      expect(store.state).toBe('playing')
      expect(store.currentRound).toBe(1)
      expect(store.timeLeft).toBe(90)
      expect(store.myRole).toBe('guesser')
      expect(store.wordLength).toBe(3)
      expect(store.wordCategory).toBe('动物')
    })

    it('should handle ROUND_START_TO_DRAWER', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.ROUND_START_TO_DRAWER, {
        round: 1,
        totalRounds: 10,
        timeLeft: 90,
        word: '大象',
        wordLength: 2,
        wordCategory: '动物',
      })

      expect(store.myRole).toBe('drawer')
      expect(store.currentWord).toBe('大象')
      expect(store.wordLength).toBe(2)
    })

    it('should handle DRAW_STROKE new stroke', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.DRAW_STROKE, {
        playerId: 'other-player',
        points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
        color: '#ff0000',
        width: 4,
        tool: 'brush',
        strokeSeq: 1,
      })

      expect(store.strokes.length).toBe(1)
      expect(store.pendingFullRedraw).toBe(true)
      expect(store.strokeVersion).toBe(1)
    })

    it('should handle DRAW_STROKE allStrokes', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      const batchStrokes = [
        { playerId: 'p1', points: [{ x: 0, y: 0 }], color: '#000', width: 4, tool: 'brush', strokeSeq: 1 },
      ]

      triggerEvent(SERVER_EVENTS.DRAW_STROKE, {
        allStrokes: true,
        strokes: batchStrokes,
      })

      expect(store.strokes).toEqual(batchStrokes)
      expect(store.pendingFullRedraw).toBe(true)
    })

    it('should handle CANVAS_CLEARED', () => {
      const store = useGameStore()
      store.setupSocketListeners()
      // Add some strokes first
      triggerEvent(SERVER_EVENTS.DRAW_STROKE, {
        playerId: 'p1',
        points: [{ x: 0, y: 0 }],
        color: '#000', width: 4, tool: 'brush', strokeSeq: 1,
      })

      triggerEvent(SERVER_EVENTS.CANVAS_CLEARED, {})

      expect(store.strokes).toHaveLength(0)
    })

    it('should handle ANSWER_RESULT for self', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.ANSWER_RESULT, {
        playerId: 'mock-player-1',
        nickname: 'Me',
        correct: true,
      })

      expect(store.hasGuessedCorrectly).toBe(true)
    })

    it('should handle SCOREBOARD_UPDATE', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      const scores = [
        { playerId: 'a', nickname: 'A', score: 200, rank: 1 },
        { playerId: 'b', nickname: 'B', score: 100, rank: 2 },
      ]
      triggerEvent(SERVER_EVENTS.SCOREBOARD_UPDATE, { scores })

      expect(store.scores).toEqual(scores)
    })

    it('should handle TIMER_SYNC', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.TIMER_SYNC, { timeLeft: 42 })

      expect(store.timeLeft).toBe(42)
    })

    it('should handle ROUND_END and set transitionData', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.ROUND_END, {
        word: '熊猫',
        reason: 'timeout',
        round: 3,
        totalRounds: 10,
        nextDrawer: { id: 'next-id', nickname: 'Next' },
      })

      expect(store.state).toBe('round_end')
      expect(store.transitionData?.word).toBe('熊猫')
      expect(store.transitionData?.reason).toBe('timeout')
    })

    it('should handle GAME_OVER', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.GAME_OVER, {
        roomId: 'room-1',
        finalScores: [{ playerId: 'a', nickname: 'Winner', score: 500, rank: 1 }],
        winner: 'Winner',
      })

      expect(store.state).toBe('game_over')
      expect(store.scores).toHaveLength(1)
    })

    it('should handle CHAT_MESSAGE', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.CHAT_MESSAGE, {
        playerId: 'p2',
        nickname: 'Chatter',
        text: 'Hello!',
        isSystem: false,
        timestamp: 1234567890,
      })

      expect(store.chatMessages.length).toBe(1)
      expect(store.chatMessages[0].text).toBe('Hello!')
    })

    it('should handle GAME_STATE_SNAPSHOT', () => {
      const store = useGameStore()
      store.setupSocketListeners()

      triggerEvent(SERVER_EVENTS.GAME_STATE_SNAPSHOT, {
        currentRound: 3,
        totalRounds: 10,
        timeLeft: 50,
        drawer: { id: 'drawer-1', nickname: 'Artist' },
        strokes: [],
        scores: [],
        currentWord: undefined,
        wordLength: 4,
        wordCategory: undefined,
      })

      expect(store.state).toBe('playing')
      expect(store.currentRound).toBe(3)
      expect(store.timeLeft).toBe(50)
    })
  })

  describe('submitAnswer', () => {
    it('should emit SUBMIT_ANSWER event', () => {
      const store = useGameStore()
      store.setupSocketListeners()
      // Manually set state so canSubmitAnswer is true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).state = 'playing'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).myRole = 'guesser'
      store.submitAnswer('test answer')

      expect(mockEmit).toHaveBeenCalledWith(
        CLIENT_EVENTS.SUBMIT_ANSWER,
        { answer: 'test answer' },
      )
    })
  })

  describe('sendChat', () => {
    it('should emit CHAT_MESSAGE event', () => {
      const store = useGameStore()
      store.setupSocketListeners()
      store.sendChat('hello world')
      expect(mockEmit).toHaveBeenCalledWith(
        CLIENT_EVENTS.CHAT_MESSAGE,
        { text: 'hello world' },
      )
    })
  })

  describe('resetGame', () => {
    it('should reset all state to defaults', () => {
      const store = useGameStore()
      store.setupSocketListeners()
      // Set some state
      triggerEvent(SERVER_EVENTS.ROUND_START_TO_DRAWER, {
        round: 5, totalRounds: 10, timeLeft: 30, word: 'test', wordLength: 4,
      })

      store.resetGame()

      expect(store.state).toBe('idle')
      expect(store.currentRound).toBe(0)
      expect(store.myRole).toBe('spectator')
      expect(store.strokes).toHaveLength(0)
      expect(store.chatMessages).toHaveLength(0)
      expect(store.currentWord).toBeNull()
    })
  })
})
