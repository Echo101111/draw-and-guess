import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RoomManager } from './RoomManager.js'
import { ErrorCode } from '@draw-and-guess/shared'

const mockEmit = vi.fn()
const mockTo = vi.fn().mockReturnValue({ emit: mockEmit })
const mockSocketsGet = vi.fn()

Object.defineProperty(global, 'io', {
  value: { to: mockTo, sockets: { sockets: { get: mockSocketsGet } } },
  writable: true,
})

describe('RoomManager', () => {
  let roomManager: RoomManager

  beforeEach(() => {
    roomManager = new RoomManager()
    mockSocketsGet.mockReset()
  })

  describe('createRoom', () => {
    it('should create a room with owner as player', async () => {
      const result = await roomManager.createRoom('Host', 'Test Room', 8, '')
      expect(result.room.name).toBe('Test Room')
      expect(result.room.players).toHaveLength(1)
      expect(result.room.players[0].nickname).toBe('Host')
      expect(result.room.players[0].isOwner).toBe(true)
    })

    it('should use room name as code and prevent duplicates', async () => {
      const result1 = await roomManager.createRoom('Host1', 'Room1', 8, '')
      const result2 = await roomManager.createRoom('Host2', 'Room2', 8, '')
      expect(result1.room.code).toBe('Room1')
      expect(result2.room.code).toBe('Room2')
      await expect(roomManager.createRoom('Host3', 'Room1', 8, '')).rejects.toThrow('该房间名称已被使用')
    })

    it('should hash password when provided', async () => {
      const result = await roomManager.createRoom('Host', 'Test Room', 8, 'secret')
      expect(result.room.password).not.toBe('secret')
      expect(result.room.password.length).toBeGreaterThan(0)
    })
  })

  describe('getRoomById', () => {
    it('should find created room by id', async () => {
      const created = await roomManager.createRoom('Host', 'Test Room', 8, '')
      const room = roomManager.getRoomById(created.room.id)
      expect(room).not.toBeNull()
      expect(room?.id).toBe(created.room.id)
    })

    it('should return null for non-existent room', () => {
      const room = roomManager.getRoomById('non-existent')
      expect(room).toBeNull()
    })
  })

  describe('getRoomByName', () => {
    it('should find room by name (case-insensitive)', async () => {
      await roomManager.createRoom('Host', 'My Room', 8, '')
      const room = roomManager.getRoomByName('my room')
      expect(room).not.toBeNull()
      expect(room?.name).toBe('My Room')
    })

    it('should return null for non-existent room', () => {
      const room = roomManager.getRoomByName('nonexistent')
      expect(room).toBeNull()
    })
  })

  describe('getAllRooms', () => {
    it('should return empty array when no rooms', () => {
      const rooms = roomManager.getAllRooms()
      expect(rooms).toHaveLength(0)
    })

    it('should return created rooms', async () => {
      await roomManager.createRoom('Host1', 'Room1', 8, '')
      const rooms = roomManager.getAllRooms()
      expect(rooms.length).toBeGreaterThan(0)
    })
  })

  describe('cleanup on player removal', () => {
    it('should clean up playerSocketMap on leaveRoom', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'Cleanup_Room', 8, '')
      roomManager.updatePlayerSocket(player.id, 'socket1')
      expect(roomManager.getPlayerSocketId(player.id)).toBe('socket1')
      roomManager.leaveRoom(room.id, player.id)
      expect(roomManager.getPlayerSocketId(player.id)).toBeUndefined()
    })

    it('should clean up playerSocketMap on dismissRoom', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'Dismiss_Room', 8, '')
      roomManager.updatePlayerSocket(player.id, 'socket1')
      roomManager.dismissRoom(room.id)
      expect(roomManager.getPlayerSocketId(player.id)).toBeUndefined()
      expect(roomManager.getRoomById(room.id)).toBeNull()
    })
  })

  describe('joinRoom', () => {
    it('should return ROOM_NOT_FOUND for non-existent room', async () => {
      const result = await roomManager.joinRoom('NoSuchRoom', '', 'Player')
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.code).toBe(ErrorCode.ROOM_NOT_FOUND)
      }
    })

    it('should return ROOM_FULL when at max capacity', async () => {
      await roomManager.createRoom('Host', 'FullRoom', 2, '')
      await roomManager.joinRoom('FullRoom', '', 'Player2')
      const result = await roomManager.joinRoom('FullRoom', '', 'Player3')
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.code).toBe(ErrorCode.ROOM_FULL)
      }
    })

    it('should return NICKNAME_TAKEN for duplicate nickname', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'NickDup', 8, '')
      roomManager.updatePlayerSession(room.id, player.id, 'session-abc')
      roomManager.updatePlayerSocket(player.id, 'mock-socket-id')
      mockSocketsGet.mockReturnValue({ connected: true })
      const result = await roomManager.joinRoom('NickDup', '', 'Host')
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.code).toBe(ErrorCode.NICKNAME_TAKEN)
      }
    })

    it('should auto-clean stale disconnected player with same nickname', async () => {
      await roomManager.createRoom('Host', 'StaleRoom', 8, '')
      // Host joins as "Host" - no socket mapping (implies disconnected)
      const result = await roomManager.joinRoom('StaleRoom', '', 'Host')
      expect('error' in result).toBe(false)
    })

    it('should return ROOM_PASSWORD_WRONG for wrong password', async () => {
      await roomManager.createRoom('Host', 'PwRoom', 8, 'secret')
      const result = await roomManager.joinRoom('PwRoom', 'wrong', 'Player')
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.code).toBe(ErrorCode.ROOM_PASSWORD_WRONG)
      }
    })

    it('should join with correct password', async () => {
      await roomManager.createRoom('Host', 'PwRoom2', 8, 'secret')
      const result = await roomManager.joinRoom('PwRoom2', 'secret', 'Player')
      expect('error' in result).toBe(false)
      expect('player' in result).toBe(true)
    })
  })

  describe('leaveRoom', () => {
    it('should transfer ownership when owner leaves', async () => {
      const { room } = await roomManager.createRoom('Host', 'OwnerLeave', 8, '')
      const r2 = await roomManager.joinRoom('OwnerLeave', '', 'Player2')
      if ('error' in r2) throw new Error('join failed')
      roomManager.leaveRoom(room.id, room.players[0].id)
      const updated = roomManager.getRoomById(room.id)!
      expect(updated.players[0].isOwner).toBe(true)
    })

    it('should start dismiss timer when last player leaves', async () => {
      // Notes: dismissTimer is private and triggers 30s timeout. We test that room still exists immediately after leave.
      const { room, player } = await roomManager.createRoom('Host', 'LastLeave', 8, '')
      roomManager.leaveRoom(room.id, player.id)
      // Room should still exist (30s timer active), but empty
      const r = roomManager.getRoomById(room.id)
      expect(r).not.toBeNull()
      expect(r!.players).toHaveLength(0)
      // Cleanup
      roomManager.dismissRoom(room.id)
    })
  })

  describe('kickPlayer', () => {
    it('should reject kick from non-owner', async () => {
      const { room } = await roomManager.createRoom('Host', 'KickRoom', 8, '')
      const r2 = await roomManager.joinRoom('KickRoom', '', 'Player2')
      if ('error' in r2) throw new Error('join failed')
      // Player2 tries to kick Host
      expect(roomManager.kickPlayer(room.id, r2.player.id, room.players[0].id)).toBe(false)
    })

    it('should prevent self-kick', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'SelfKick', 8, '')
      expect(roomManager.kickPlayer(room.id, player.id, player.id)).toBe(false)
    })

    it('should allow owner to kick player', async () => {
      const { room, player: host } = await roomManager.createRoom('Host', 'KickOk', 8, '')
      const r2 = await roomManager.joinRoom('KickOk', '', 'Player2')
      if ('error' in r2) throw new Error('join failed')
      expect(roomManager.kickPlayer(room.id, host.id, r2.player.id)).toBe(true)
    })
  })

  describe('startGame', () => {
    it('should reject start from non-owner', async () => {
      const { room } = await roomManager.createRoom('Host', 'StartGame', 8, '')
      const r2 = await roomManager.joinRoom('StartGame', '', 'Player2')
      if ('error' in r2) throw new Error('join failed')
      const result = roomManager.startGame(room.id, r2.player.id)
      expect(result.success).toBe(false)
    })

    it('should reject start with fewer than 2 players', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'SoloRoom', 8, '')
      const result = roomManager.startGame(room.id, player.id)
      expect(result.success).toBe(false)
    })

    it('should set state to playing and reset scores', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'PlayRoom', 8, '')
      const r2 = await roomManager.joinRoom('PlayRoom', '', 'Player2')
      if ('error' in r2) throw new Error('join failed')
      const result = roomManager.startGame(room.id, player.id)
      expect(result.success).toBe(true)
      const updated = roomManager.getRoomById(room.id)!
      expect(updated.state).toBe('playing')
      expect(updated.currentRound).toBe(1)
      for (const p of updated.players) {
        expect(p.score).toBe(0)
      }
    })
  })

  describe('findPlayerBySession', () => {
    it('should find player by session id', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'SessRoom', 8, '')
      roomManager.updatePlayerSession(room.id, player.id, 'session-abc')
      const result = roomManager.findPlayerBySession('session-abc')
      expect(result).not.toBeNull()
      expect(result!.player.id).toBe(player.id)
    })

    it('should return null for unknown session', () => {
      expect(roomManager.findPlayerBySession('nonexistent')).toBeNull()
    })
  })

  describe('resetGameState', () => {
    it('should reset room to lobby with cleared scores', async () => {
      const { room, player } = await roomManager.createRoom('Host', 'ResetRoom', 8, '')
      const r2 = await roomManager.joinRoom('ResetRoom', '', 'Player2')
      if ('error' in r2) throw new Error('join failed')
      roomManager.startGame(room.id, player.id)
      roomManager.resetGameState(room.id)
      const updated = roomManager.getRoomById(room.id)!
      expect(updated.state).toBe('lobby')
      expect(updated.currentRound).toBe(0)
    })
  })
})