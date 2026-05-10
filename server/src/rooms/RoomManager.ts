import { randomUUID } from 'crypto'
import type { Player, Room, RoomErrorPayload } from '@draw-and-guess/shared'
import { ErrorCode } from '@draw-and-guess/shared'

const ROOM_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const ROOM_CODE_LENGTH = 6

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return code
}

function createPlayer(nickname: string, isOwner = false): Player {
  return {
    id: randomUUID(),
    nickname,
    sessionId: '',
    isOwner,
    score: 0,
    hasGuessedCorrectly: false,
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
  }
}

function createRoom(name: string, maxPlayers: number, password: string, owner: Player): Room {
  return {
    id: randomUUID(),
    code: '',
    name,
    password,
    state: 'lobby',
    maxPlayers,
    players: [owner],
    currentWord: null,
    currentRound: 0,
    totalRounds: 10,
    roundStartTime: null,
    roundDuration: 90,
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  private codeToRoomId = new Map<string, string>()
  private dismissTimers = new Map<string, NodeJS.Timeout>()

  createRoom(
    nickname: string,
    roomName: string,
    maxPlayers: number,
    password: string
  ): { room: Room; player: Player } {
    const owner = createPlayer(nickname, true)
    const room = createRoom(roomName, maxPlayers, password, owner)

    // Generate unique room code
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateRoomCode()
      if (!this.codeToRoomId.has(code)) {
        room.code = code
        break
      }
    }

    if (!room.code) {
      throw new Error('Failed to generate unique room code')
    }

    this.rooms.set(room.id, room)
    this.codeToRoomId.set(room.code, room.id)
    return { room, player: owner }
  }

  joinRoom(
    code: string,
    password: string,
    nickname: string
  ): { room: Room; player: Player } | { error: RoomErrorPayload } {
    const roomId = this.codeToRoomId.get(code.toLowerCase())
    if (!roomId) {
      return { error: { code: ErrorCode.ROOM_NOT_FOUND, message: '房间不存在或已结束' } }
    }

    const room = this.rooms.get(roomId)!
    if (room.players.length >= room.maxPlayers) {
      return { error: { code: ErrorCode.ROOM_FULL, message: '房间人数已满' } }
    }

    if (room.password && room.password !== password) {
      return { error: { code: ErrorCode.ROOM_PASSWORD_WRONG, message: '密码错误' } }
    }

    const nicknameTaken = room.players.some((p) => p.nickname === nickname)
    if (nicknameTaken) {
      return { error: { code: ErrorCode.NICKNAME_TAKEN, message: '该昵称已被使用，请换一个名字' } }
    }

    const player = createPlayer(nickname, false)
    room.players.push(player)

    this.cancelDismissTimer(room.id)
    return { room, player }
  }

  leaveRoom(roomId: string, playerId: string): { kicked: boolean; ownerChanged: boolean } {
    const room = this.rooms.get(roomId)
    if (!room) return { kicked: false, ownerChanged: false }

    const playerIndex = room.players.findIndex((p) => p.id === playerId)
    if (playerIndex === -1) return { kicked: false, ownerChanged: false }

    const player = room.players[playerIndex]
    const wasOwner = player.isOwner
    room.players.splice(playerIndex, 1)

    let ownerChanged = false
    if (wasOwner && room.players.length > 0) {
      room.players[0].isOwner = true
      ownerChanged = true
    }

    if (room.players.length === 0) {
      this.startDismissTimer(room.id)
    }

    return { kicked: true, ownerChanged }
  }

  kickPlayer(roomId: string, hostId: string, targetId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false

    const host = room.players.find((p) => p.id === hostId)
    if (!host?.isOwner) return false

    if (hostId === targetId) return false

    const targetIndex = room.players.findIndex((p) => p.id === targetId)
    if (targetIndex === -1) return false

    room.players.splice(targetIndex, 1)

    if (room.players.length === 0) {
      this.startDismissTimer(room.id)
    }

    return true
  }

  startGame(roomId: string, hostId: string): { success: boolean; error?: RoomErrorPayload } {
    const room = this.rooms.get(roomId)
    if (!room) {
      return { success: false, error: { code: ErrorCode.ROOM_NOT_FOUND, message: '房间不存在' } }
    }

    const host = room.players.find((p) => p.id === hostId)
    if (!host?.isOwner) {
      return { success: false, error: { code: ErrorCode.NOT_ROOM_OWNER, message: '只有房主可以开始游戏' } }
    }

    if (room.players.length < 2) {
      return { success: false, error: { code: ErrorCode.GAME_NOT_IN_LOBBY, message: '至少需要2名玩家才能开始游戏' } }
    }

    room.state = 'playing'
    room.currentRound = 1
    room.players.forEach((p) => {
      p.score = 0
      p.hasGuessedCorrectly = false
    })
    return { success: true }
  }

  updatePlayerSession(roomId: string, playerId: string, sessionId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === playerId)
    if (player) {
      player.sessionId = sessionId
    }
  }

  findPlayerBySession(sessionId: string): { room: Room; player: Player } | null {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.sessionId === sessionId)
      if (player) {
        return { room, player }
      }
    }
    return null
  }

  getRoomByCode(code: string): Room | null {
    const roomId = this.codeToRoomId.get(code.toLowerCase())
    return roomId ? this.rooms.get(roomId) ?? null : null
  }

  getRoomById(id: string): Room | null {
    return this.rooms.get(id) ?? null
  }

  updatePlayerState(roomId: string, playerId: string, updates: Partial<Pick<Player, 'score' | 'hasGuessedCorrectly'>>): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === playerId)
    if (player) {
      Object.assign(player, updates)
    }
  }

  private startDismissTimer(roomId: string): void {
    this.cancelDismissTimer(roomId)
    const timer = setTimeout(() => {
      this.dismissRoom(roomId)
    }, 30_000)
    this.dismissTimers.set(roomId, timer)
  }

  private cancelDismissTimer(roomId: string): void {
    const timer = this.dismissTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      this.dismissTimers.delete(roomId)
    }
  }

  dismissRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    this.cancelDismissTimer(roomId)
    this.codeToRoomId.delete(room.code)
    this.rooms.delete(roomId)
  }

  resetGameState(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.state = 'lobby'
    room.currentRound = 0
    room.currentWord = null
    room.roundStartTime = null
    room.players.forEach((p) => {
      p.score = 0
      p.hasGuessedCorrectly = false
    })
  }
}

export const roomManager = new RoomManager()