import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from './RoomManager.js'

describe('RoomManager', () => {
  let roomManager: RoomManager

  beforeEach(() => {
    roomManager = new RoomManager()
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
})