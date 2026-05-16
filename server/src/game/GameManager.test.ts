import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GameManager } from './GameManager.js'
import { roomManager } from '../rooms/index.js'
import { SERVER_EVENTS } from '@draw-and-guess/shared'

const mockExceptEmit = vi.fn()
const mockExceptTo = vi.fn().mockReturnValue({ emit: mockExceptEmit })
const mockExcept = vi.fn().mockReturnValue({ to: mockExceptTo })
const mockEmit = vi.fn()
const mockTo = vi.fn().mockReturnValue({ emit: mockEmit })

Object.defineProperty(global, 'io', {
  value: { to: mockTo, except: mockExcept },
  writable: true,
})

let _counter = 0
function nextId(): string {
  return String(++_counter)
}

async function setupGame(opts?: { players?: number }): Promise<{
  roomId: string
  hostId: string
  playerIds: string[]
}> {
  const id = nextId()
  const { room, player: host } = await roomManager.createRoom('H' + id, 'R' + id, 8, '')
  roomManager.updatePlayerSession(room.id, host.id, 'sock-h')
  const ids = [host.id]
  const count = opts?.players ?? 2
  for (let i = 2; i <= count; i++) {
    const r = await roomManager.joinRoom(room.code, '', 'P' + i + id)
    if ('player' in r) {
      roomManager.updatePlayerSession(room.id, r.player.id, 'sock-' + i)
      ids.push(r.player.id)
    }
  }
  roomManager.startGame(room.id, host.id)
  return { roomId: room.id, hostId: host.id, playerIds: ids }
}

describe('GameManager', () => {
  let gameManager: GameManager

  beforeEach(() => {
    vi.clearAllMocks()
    gameManager = new GameManager()
  })

  afterEach(() => {
    gameManager.destroy()
    for (const r of roomManager.getAllRooms()) {
      roomManager.dismissRoom(r.id)
    }
  })

  describe('clearCanvas', () => {
    it('should return false for non-existent room', () => {
      expect(gameManager.clearCanvas('bad-id', 'p1', 'sock')).toBe(false)
    })

    it('should reject clear from non-drawer', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      // non-drawer (just a random id not in playerIds)
      expect(gameManager.clearCanvas(roomId, 'non-drawer-id', 'sock')).toBe(false)
    })

    it('should allow drawer to clear canvas', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const drawerId = gameManager.getCurrentDrawerId(roomId)!
      gameManager.handleDrawStroke(roomId, drawerId, 'sock', [
        { x: 0.1, y: 0.1 },
      ], '#000', 4, 'brush', 1)
      await new Promise((r) => setTimeout(r, 10))
      const result = gameManager.clearCanvas(roomId, drawerId, 'sock')
      expect(result).toBe(true)
      expect(gameManager.getStrokes(roomId)).toHaveLength(0)
    })
  })

  describe('handleDrawStroke', () => {
    it('should not throw for non-existent room', () => {
      expect(() => {
        gameManager.handleDrawStroke('bad', 'p1', 's1', [], '#000', 4, 'brush')
      }).not.toThrow()
    })

    it('should reject stroke from non-drawer', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      gameManager.handleDrawStroke(roomId, 'non-drawer-id', 'sock', [
        { x: 0.1, y: 0.1 },
      ], '#000', 4, 'brush', 1)
      expect(gameManager.getStrokes(roomId)).toHaveLength(0)
    })

    it('should accept stroke from current drawer', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const drawerId = gameManager.getCurrentDrawerId(roomId)!
      gameManager.handleDrawStroke(roomId, drawerId, 'sock', [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
      ], '#000', 4, 'brush', 1)
      expect(gameManager.getStrokes(roomId).length).toBeGreaterThan(0)
    })

    it('should append points to existing stroke with same strokeSeq', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const drawerId = gameManager.getCurrentDrawerId(roomId)!
      gameManager.handleDrawStroke(roomId, drawerId, 'sock', [
        { x: 0.1, y: 0.1 },
      ], '#000', 4, 'brush', 42)
      const before = gameManager.getStrokes(roomId)[0].points.length
      await new Promise((r) => setTimeout(r, 10))
      gameManager.handleDrawStroke(roomId, drawerId, 'sock', [
        { x: 0.2, y: 0.2 },
      ], '#000', 4, 'brush', 42)
      const after = gameManager.getStrokes(roomId)[0].points.length
      expect(after).toBeGreaterThan(before)
    })
  })

  describe('submitAnswer', () => {
    it('should return incorrect for non-existent room', () => {
      expect(gameManager.submitAnswer('bad', 'p1', 'test').correct).toBe(false)
    })

    it('should return incorrect when room is not playing', async () => {
      const id = nextId()
      const { room } = await roomManager.createRoom('H' + id, 'R' + id, 8, '')
      roomManager.updatePlayerSession(room.id, room.players[0].id, 'sock')
      expect(gameManager.submitAnswer(room.id, room.players[0].id, 'x').correct).toBe(false)
    })

    it('should reject already-guessed player', async () => {
      const { roomId, playerIds } = await setupGame()
      gameManager.startRound(roomId)
      const guesser = playerIds[1] ?? playerIds[0]
      const room = roomManager.getRoomById(roomId)!
      room.players.find((p) => p.id === guesser)!.hasGuessedCorrectly = true
      expect(gameManager.submitAnswer(roomId, guesser, room.currentWord!).correct).toBe(false)
    })

    it('should return correct when answer matches', async () => {
      const { roomId, playerIds } = await setupGame()
      gameManager.startRound(roomId)
      const guesser = playerIds[1] ?? playerIds[0]
      const room = roomManager.getRoomById(roomId)!
      await new Promise((r) => setTimeout(r, 210))
      const result = gameManager.submitAnswer(roomId, guesser, room.currentWord!)
      expect(result.correct).toBe(true)
      expect(result.score).toBeGreaterThan(0)
    })

    it('should give drawer 50 bonus points', async () => {
      const { roomId, playerIds } = await setupGame()
      gameManager.startRound(roomId)
      const guesser = playerIds[1] ?? playerIds[0]
      const room = roomManager.getRoomById(roomId)!
      const drawerId = gameManager.getCurrentDrawerId(roomId)!
      await new Promise((r) => setTimeout(r, 210))
      gameManager.submitAnswer(roomId, guesser, room.currentWord!)
      const drawer = room.players.find((p) => p.id === drawerId)!
      expect(drawer.score).toBe(50)
    })
  })

  describe('startRound', () => {
    it('should fail for non-existent room', () => {
      expect(gameManager.startRound('bad')).toBe(false)
    })

    it('should succeed with valid playing room', async () => {
      const { roomId } = await setupGame()
      expect(gameManager.startRound(roomId)).toBe(true)
      expect(gameManager.getCurrentDrawerId(roomId)).toBeTruthy()
    })

    it('should set room currentWord', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const room = roomManager.getRoomById(roomId)!
      expect(room.currentWord).toBeTruthy()
      expect(room.currentWord!.length).toBeGreaterThan(0)
    })

    it('should reset all players hasGuessedCorrectly', async () => {
      const { roomId } = await setupGame({ players: 3 })
      gameManager.startRound(roomId)
      const room = roomManager.getRoomById(roomId)!
      for (const p of room.players) {
        expect(p.hasGuessedCorrectly).toBe(false)
      }
    })

    it('should emit ROUND_START_TO_DRAWER', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const calls = mockEmit.mock.calls.filter(
        (c: unknown[]) => c[0] === SERVER_EVENTS.ROUND_START_TO_DRAWER,
      )
      expect(calls.length).toBeGreaterThanOrEqual(1)
      expect((calls[0][1] as Record<string, unknown>).word).toBeTruthy()
    })
  })

  describe('endRound', () => {
    it('should emit ROUND_END on timeout', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      vi.clearAllMocks()
      gameManager.endRound(roomId, 'timeout')
      const calls = mockEmit.mock.calls.filter(
        (c: unknown[]) => c[0] === SERVER_EVENTS.ROUND_END,
      )
      expect(calls.length).toBeGreaterThanOrEqual(1)
      expect((calls[0][1] as Record<string, unknown>).reason).toBe('timeout')
    })

    it('should include current word in ROUND_END', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const room = roomManager.getRoomById(roomId)!
      const word = room.currentWord!
      vi.clearAllMocks()
      gameManager.endRound(roomId, 'timeout')
      const calls = mockEmit.mock.calls.filter(
        (c: unknown[]) => c[0] === SERVER_EVENTS.ROUND_END,
      )
      expect((calls[0][1] as Record<string, unknown>).word).toBe(word)
    })
  })

  describe('endGame', () => {
    it('should emit GAME_OVER with winner', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const room = roomManager.getRoomById(roomId)!
      room.players[0].score = 300
      room.players[1].score = 100
      vi.clearAllMocks()
      gameManager.endGame(roomId)
      const calls = mockEmit.mock.calls.filter(
        (c: unknown[]) => c[0] === SERVER_EVENTS.GAME_OVER,
      )
      expect(calls.length).toBeGreaterThanOrEqual(1)
      expect((calls[0][1] as Record<string, unknown>).winner).toBe(room.players[0].nickname)
    })

    it('should set room state to gameover', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      gameManager.endGame(roomId)
      expect(roomManager.getRoomById(roomId)!.state).toBe('gameover')
    })
  })

  describe('resetGame', () => {
    it('should clear drawer, strokes and reset to lobby', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      await new Promise((r) => setTimeout(r, 10))
      gameManager.resetGame(roomId)
      expect(gameManager.getCurrentDrawerId(roomId)).toBeUndefined()
      expect(gameManager.getStrokes(roomId)).toHaveLength(0)
      expect(roomManager.getRoomById(roomId)!.state).toBe('lobby')
    })
  })

  describe('restorePlayerState', () => {
    it('should not throw for missing room', () => {
      expect(() => gameManager.restorePlayerState('bad', 'p1')).not.toThrow()
    })

    it('should send ROUND_START to guesser', async () => {
      const { roomId, playerIds } = await setupGame()
      gameManager.startRound(roomId)
      const guesser = playerIds[1] ?? playerIds[0]
      vi.clearAllMocks()
      gameManager.restorePlayerState(roomId, guesser)
      const calls = mockEmit.mock.calls.filter(
        (c: unknown[]) => c[0] === SERVER_EVENTS.ROUND_START,
      )
      expect(calls.length).toBeGreaterThanOrEqual(1)
    })

    it('should send word to reconnecting drawer', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const drawerId = gameManager.getCurrentDrawerId(roomId)!
      vi.clearAllMocks()
      gameManager.restorePlayerState(roomId, drawerId)
      const calls = mockEmit.mock.calls.filter(
        (c: unknown[]) => c[0] === SERVER_EVENTS.ROUND_START_TO_DRAWER,
      )
      expect(calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('getScoreboard', () => {
    it('should sort by score descending', () => {
      const gm = gameManager as unknown as {
        getScoreboard: (r: { players: Array<{ id: string; nickname: string; score: number }> }) => Array<{ score: number }>
      }
      const scores = gm.getScoreboard({
        players: [
          { id: 'a', nickname: 'A', score: 100 },
          { id: 'b', nickname: 'B', score: 300 },
          { id: 'c', nickname: 'C', score: 200 },
        ],
      })
      expect(scores[0].score).toBe(300)
      expect(scores[1].score).toBe(200)
      expect(scores[2].score).toBe(100)
    })
  })

  describe('prune', () => {
    it('should remove stale player timestamps', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const gm = gameManager as unknown as {
        lastDrawTime: Map<string, number>
        lastAnswerTime: Map<string, number>
        prune: () => void
      }
      gm.lastDrawTime.set('stale-player', Date.now())
      gm.lastAnswerTime.set('stale-player', Date.now())
      gm.prune()
      expect(gm.lastDrawTime.has('stale-player')).toBe(false)
      expect(gm.lastAnswerTime.has('stale-player')).toBe(false)
    })

    it('should keep active player timestamps', async () => {
      const { roomId, playerIds } = await setupGame()
      gameManager.startRound(roomId)
      const gm = gameManager as unknown as {
        lastDrawTime: Map<string, number>
        prune: () => void
      }
      gm.lastDrawTime.set(playerIds[0], Date.now())
      gm.prune()
      expect(gm.lastDrawTime.has(playerIds[0])).toBe(true)
    })
  })

  describe('sendSpectatorSnapshot', () => {
    it('should send scoreboard and timer to spectator', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      vi.clearAllMocks()
      gameManager.sendSpectatorSnapshot(roomId, 'spectator-1')
      const scoreCall = mockEmit.mock.calls.find(
        (c: unknown[]) => c[0] === SERVER_EVENTS.SCOREBOARD_UPDATE,
      )
      const timerCall = mockEmit.mock.calls.find(
        (c: unknown[]) => c[0] === SERVER_EVENTS.TIMER_SYNC,
      )
      expect(scoreCall).toBeTruthy()
      expect(timerCall).toBeTruthy()
    })
  })

  describe('sendGameStateSnapshot', () => {
    it('should not throw for missing room', () => {
      expect(() => gameManager.sendGameStateSnapshot('bad', 'p1')).not.toThrow()
    })

    it('should include currentWord for drawer', async () => {
      const { roomId } = await setupGame()
      gameManager.startRound(roomId)
      const drawerId = gameManager.getCurrentDrawerId(roomId)!
      vi.clearAllMocks()
      gameManager.sendGameStateSnapshot(roomId, drawerId)
      const calls = mockEmit.mock.calls.filter(
        (c: unknown[]) => c[0] === SERVER_EVENTS.GAME_STATE_SNAPSHOT,
      )
      expect(calls.length).toBeGreaterThanOrEqual(1)
      expect((calls[0][1] as Record<string, unknown>).currentWord).toBeTruthy()
    })
  })
})
