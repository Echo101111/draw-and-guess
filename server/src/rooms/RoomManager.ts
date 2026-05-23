import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'
import type { Player, Room, RoomErrorPayload, RoomWordConfig, GameType } from '@draw-and-guess/shared'
import { ErrorCode, SERVER_EVENTS, DEFAULT_WORD_CONFIG } from '@draw-and-guess/shared'

const BCRYPT_ROUNDS = 6

function createPlayer(nickname: string, isOwner = false): Player {
  const trimmed = nickname.trim()
  if (!trimmed || trimmed.length > 10) {
    throw new Error('昵称长度需在1-10字符之间')
  }
  return {
    id: randomUUID(),
    nickname: trimmed,
    sessionId: '',
    isOwner,
    score: 0,
    hasGuessedCorrectly: false,
    avatar: Math.floor(Math.random() * 50),
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
  }
}

function createRoom(name: string, maxPlayers: number, password: string, owner: Player, wordConfig: RoomWordConfig, gameType: GameType): Room {
  return {
    id: randomUUID(),
    code: name,
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
    wordConfig,
    gameType,
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  private nameToRoomId = new Map<string, string>()
  private dismissTimers = new Map<string, NodeJS.Timeout>()
  private disconnectTimers = new Map<string, NodeJS.Timeout>()
  private playerToRoomId = new Map<string, string>()
  private playerSocketMap = new Map<string, string>()
  private onDismissCallbacks: Array<(roomId: string) => void> = []
  private onPlayerRemovedCallbacks: Array<(playerId: string, roomId: string) => void> = []
  private RECONNECT_TIMEOUT = 60_000

  onDismissed(callback: (roomId: string) => void): void {
    this.onDismissCallbacks.push(callback)
  }

  onPlayerRemoved(callback: (playerId: string, roomId: string) => void): void {
    this.onPlayerRemovedCallbacks.push(callback)
  }

  async createRoom(
    nickname: string,
    roomName: string,
    maxPlayers: number,
    password: string,
    wordConfig?: RoomWordConfig,
    gameType: GameType = 'draw'
  ): Promise<{ room: Room; player: Player }> {
    const trimmedName = roomName.trim()
    if (!trimmedName) {
      throw new Error('Room name is required')
    }

    if (trimmedName.length > 20) {
      throw new Error('房间名称不能超过20个字符')
    }

    if (password && (password.length < 4 || password.length > 100)) {
      throw new Error('密码长度需在4-100字符之间')
    }

    // Check name uniqueness (case-insensitive)
    const normalizedName = trimmedName.toLowerCase()
    if (this.nameToRoomId.has(normalizedName)) {
      throw new Error('该房间名称已被使用，请换一个名字')
    }

    const owner = createPlayer(nickname, true)
    const hashedPassword = password ? await bcrypt.hash(password, BCRYPT_ROUNDS) : ''
    const room = createRoom(trimmedName, maxPlayers, hashedPassword, owner, wordConfig ?? DEFAULT_WORD_CONFIG, gameType)

    this.rooms.set(room.id, room)
    this.nameToRoomId.set(normalizedName, room.id)
    this.playerToRoomId.set(owner.id, room.id)
    return { room, player: owner }
  }

  async joinRoom(
    roomName: string,
    password: string,
    nickname: string
  ): Promise<{ room: Room; player: Player } | { error: RoomErrorPayload }> {
    const roomId = this.nameToRoomId.get(roomName.trim().toLowerCase())
    if (!roomId) {
      return { error: { code: ErrorCode.ROOM_NOT_FOUND, message: '房间不存在或已结束' } }
    }

    const room = this.rooms.get(roomId)!
    if (room.players.length >= room.maxPlayers) {
      return { error: { code: ErrorCode.ROOM_FULL, message: '房间人数已满' } }
    }

    if (room.password && !(await bcrypt.compare(password, room.password))) {
      return { error: { code: ErrorCode.ROOM_PASSWORD_WRONG, message: '密码错误' } }
    }

    const nicknameTaken = room.players.some(
      (p) => p.nickname.toLowerCase() === nickname.toLowerCase() && p.sessionId,
    )
    if (nicknameTaken) {
      return { error: { code: ErrorCode.NICKNAME_TAKEN, message: '该昵称已被使用，请换一个名字' } }
    }

    const player = createPlayer(nickname, false)
    room.players.push(player)
    this.playerToRoomId.set(player.id, room.id)

    this.cancelDismissTimer(room.id)
    return { room, player }
  }

  leaveRoom(roomId: string, playerId: string): { removed: boolean; ownerChanged: boolean } {
    const room = this.rooms.get(roomId)
    if (!room) return { removed: false, ownerChanged: false }

    const playerIndex = room.players.findIndex((p) => p.id === playerId)
    if (playerIndex === -1) return { removed: false, ownerChanged: false }

    const player = room.players[playerIndex]
    const wasOwner = player.isOwner
    room.players.splice(playerIndex, 1)
    this.cleanupPlayer(player.id)

    let ownerChanged = false
    if (wasOwner && room.players.length > 0) {
      room.players[0].isOwner = true
      ownerChanged = true
    }

    if (room.players.length === 0) {
      this.startDismissTimer(room.id)
    }

    this.onPlayerRemovedCallbacks.forEach((cb) => cb(playerId, roomId))
    return { removed: true, ownerChanged }
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
    this.cleanupPlayer(targetId)

    if (room.players.length === 0) {
      this.startDismissTimer(room.id)
    }

    this.onPlayerRemovedCallbacks.forEach((cb) => cb(targetId, roomId))
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

    if (room.state !== 'lobby' && room.state !== 'gameover') {
      return { success: false, error: { code: ErrorCode.GAME_NOT_IN_LOBBY, message: '游戏已在进行中' } }
    }

    const minPlayers = room.gameType === 'spy' ? 4 : 2
    if (room.players.length < minPlayers) {
      return { success: false, error: { code: ErrorCode.GAME_NOT_IN_LOBBY, message: `至少需要${minPlayers}名玩家才能开始游戏` } }
    }

    room.totalRounds = room.wordConfig.customWords.length > 0 ? room.wordConfig.customWords.length : 10
    room.state = 'playing'
    room.currentRound = 1
    room.players.forEach((p) => {
      p.score = 0
      p.hasGuessedCorrectly = false
    })
    return { success: true }
  }

  updatePlayerSession(roomId: string, playerId: string, sessionId: string): void {
    this.cancelDisconnectTimer(playerId)

    const room = this.rooms.get(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === playerId)
    if (player) {
      player.sessionId = sessionId
    }
  }

  updatePlayerSocket(playerId: string, socketId: string): void {
    this.playerSocketMap.set(playerId, socketId)
  }

  isPlayerSocketActive(playerId: string, socketId: string): boolean {
    return this.playerSocketMap.get(playerId) === socketId
  }

  private cleanupPlayer(playerId: string): void {
    this.playerToRoomId.delete(playerId)
    this.playerSocketMap.delete(playerId)
    this.cancelDisconnectTimer(playerId)
  }

  getPlayerSocketId(playerId: string): string | undefined {
    return this.playerSocketMap.get(playerId)
  }

  markPlayerDisconnected(playerId: string): void {
    const roomId = this.playerToRoomId.get(playerId)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    if (!room) return
    const player = room.players.find(p => p.id === playerId)
    if (player) player.sessionId = ''
  }

  startDisconnectTimer(playerId: string): void {
    this.cancelDisconnectTimer(playerId)
    const timer = setTimeout(() => {
      this.handleDisconnectTimeout(playerId)
    }, this.RECONNECT_TIMEOUT)
    this.disconnectTimers.set(playerId, timer)
  }

  cancelDisconnectTimer(playerId: string): void {
    const timer = this.disconnectTimers.get(playerId)
    if (timer) {
      clearTimeout(timer)
      this.disconnectTimers.delete(playerId)
    }
  }

  private handleDisconnectTimeout(playerId: string): void {
    this.disconnectTimers.delete(playerId)
    const roomId = this.playerToRoomId.get(playerId)
    if (!roomId) return

    const room = this.rooms.get(roomId)
    if (!room) return

    // 如果玩家已经重连（有活跃 socket），不踢出玩家
    const activeSocketId = this.playerSocketMap.get(playerId)
    if (activeSocketId) {
      const io = this.getIO()
      const activeSocket = io?.sockets.sockets.get(activeSocketId)
      if (activeSocket?.connected) {
        console.log(`[Room] Disconnect timer expired for ${playerId}, but player reconnected. Keeping.`)
        return
      }
    }

    const idx = room.players.findIndex((p) => p.id === playerId)
    if (idx === -1) return

    room.players.splice(idx, 1)
    this.cleanupPlayer(playerId)
    if (room.players.length > 0 && !room.players.some((p) => p.isOwner)) {
      room.players[0].isOwner = true
    }

    const io = this.getIO()
    if (io && room.players.length > 0) {
      io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: this.sanitizeRoom(room) })
    }

    if (room.players.length === 0) {
      this.startDismissTimer(room.id)
    }

    this.onPlayerRemovedCallbacks.forEach((cb) => cb(playerId, roomId))
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

  getRoomByName(name: string): Room | null {
    const roomId = this.nameToRoomId.get(name.trim().toLowerCase())
    return roomId ? this.rooms.get(roomId) ?? null : null
  }

  getRoomByCode(code: string): Room | null {
    return this.getRoomByName(code)
  }

  getRoomById(id: string): Room | null {
    return this.rooms.get(id) ?? null
  }

  getAllRooms(gameType?: GameType): Room[] {
    const rooms = Array.from(this.rooms.values())
    return gameType ? rooms.filter(r => r.gameType === gameType) : rooms
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
    for (const p of room.players) {
      this.playerToRoomId.delete(p.id)
      this.playerSocketMap.delete(p.id)
      this.cancelDisconnectTimer(p.id)
    }
    this.nameToRoomId.delete(room.code.toLowerCase())
    this.rooms.delete(roomId)
    this.onDismissCallbacks.forEach((cb) => cb(roomId))
  }

  resetGameState(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.state = 'lobby'
    room.currentRound = 0
    room.totalRounds = 10
    room.currentWord = null
    room.roundStartTime = null
    room.players.forEach((p) => {
      p.score = 0
      p.hasGuessedCorrectly = false
    })
  }

  private sanitizeRoom(room: Room) {
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      state: room.state,
      maxPlayers: room.maxPlayers,
      players: room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isOwner: p.isOwner,
        score: p.score,
        hasGuessedCorrectly: p.hasGuessedCorrectly,
        avatar: p.avatar,
      })),
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      wordConfig: room.wordConfig,
      gameType: room.gameType,
    }
  }

  private getIO() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (global as any).io
  }
}

export const roomManager = new RoomManager()
