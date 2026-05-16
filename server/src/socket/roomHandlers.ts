import { CLIENT_EVENTS, SERVER_EVENTS, ErrorCode } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { gameManager } from '../game/index.js'
import { lastChatTime } from './gameHandlers.js'
import { validateCustomWords } from '../data/wordValidator.js'
import bcrypt from 'bcrypt'
import type { Room, RoomWordConfig } from '@draw-and-guess/shared'

function getPlayerRoomData(room: Room) {
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
    })),
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    wordConfig: room.wordConfig,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRoomHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.CREATE_ROOM, async ({ nickname, roomName, maxPlayers, password, wordConfig }: { nickname: string; roomName?: string; maxPlayers?: number; password?: string; wordConfig?: RoomWordConfig }) => {
    const trimmedNickname = nickname.trim()
    if (!trimmedNickname || trimmedNickname.length > 10) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.NICKNAME_TAKEN,
        message: '昵称长度需在1-10字符之间',
      })
      return
    }

    const trimmedName = roomName?.trim() || '房间'
    if (trimmedName.length > 20) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.NICKNAME_TAKEN,
        message: '房间名称不能超过20个字符',
      })
      return
    }

    try {
      const { room, player } = await roomManager.createRoom(
        trimmedNickname,
        trimmedName,
        maxPlayers ?? 50,
        password ?? '',
        wordConfig
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(global as any).metrics.roomsCreated++

      console.log(`[Room] Created: "${room.name}" (${room.id}) by ${trimmedNickname}`)
      console.log(`[Room] Total rooms: ${roomManager.getAllRooms().length}`)

      // 离开旧的 socket 频道（如果有）
      if (socket.data.roomName) {
        socket.leave(socket.data.roomName)
      }
      if (socket.data.playerId) {
        socket.leave(socket.data.playerId)
      }

      socket.data.roomId = room.id
      socket.data.playerId = player.id
      socket.data.roomName = room.name
      roomManager.updatePlayerSession(room.id, player.id, socket.id)
      roomManager.updatePlayerSocket(player.id, socket.id)

      socket.join(room.code)
      socket.join(player.id)

      socket.emit(SERVER_EVENTS.ROOM_CREATED, {
        room: getPlayerRoomData(room),
        roomCode: room.code,
        roomId: room.id,
        playerId: player.id,
        isOwner: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建房间失败，请重试'
      console.error('[Room] Create failed:', message)
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.ROOM_NOT_FOUND,
        message,
      })
    }
  })

  socket.on(CLIENT_EVENTS.JOIN_ROOM, async ({ roomName, password, nickname }: { roomName: string; password?: string; nickname: string }) => {
    console.log(`[Room] Join attempt: "${roomName}" by ${nickname}`)
    console.log(`[Room] Total rooms: ${roomManager.getAllRooms().length}`)

    const trimmedNickname = nickname.trim()
    if (!trimmedNickname || trimmedNickname.length > 10) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.NICKNAME_TAKEN,
        message: '昵称长度需在1-10字符之间',
      })
      return
    }

    if (!roomName.trim()) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.ROOM_NOT_FOUND,
        message: '请输入房间名称',
      })
      return
    }

    const result = await roomManager.joinRoom(roomName, password ?? '', trimmedNickname)

    if ('error' in result) {
      console.log(`[Room] Join failed: "${roomName}" - ${result.error.message}`)
      socket.emit(SERVER_EVENTS.ROOM_ERROR, result.error)
      return
    }

    const { room, player } = result
    // 离开旧的 socket 频道（如果有）
    if (socket.data.roomName) {
      socket.leave(socket.data.roomName)
    }
    if (socket.data.playerId) {
      socket.leave(socket.data.playerId)
    }
    socket.data.roomId = room.id
    socket.data.playerId = player.id
    socket.data.roomName = room.name
    roomManager.updatePlayerSession(room.id, player.id, socket.id)
    roomManager.updatePlayerSocket(player.id, socket.id)

    socket.join(room.code)
    socket.join(player.id)

    socket.emit(SERVER_EVENTS.ROOM_JOINED, {
      room: getPlayerRoomData(room),
      playerId: player.id,
      isOwner: player.isOwner,
    })

    socket.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })

    // 游戏进行中：新玩家以观战者加入，可看画板和聊天，下一轮自动参与
    if (room.state === 'playing') {
      gameManager.sendSpectatorSnapshot(room.id, player.id)
    }
  })

  socket.on(CLIENT_EVENTS.LEAVE_ROOM, () => {
    handleLeave(io, socket)
  })

  socket.on(CLIENT_EVENTS.KICK_PLAYER, ({ playerId }: { playerId: string }) => {
    const { roomId, playerId: hostId } = socket.data
    if (!roomId) return

    try {
      const kicked = roomManager.kickPlayer(roomId, hostId, playerId)
      if (!kicked) return

      const room = roomManager.getRoomById(roomId)
      if (!room) return

      lastChatTime.delete(playerId)

      const kickedSocketId = roomManager.getPlayerSocketId(playerId)
      const kickedSocket = kickedSocketId ? io.sockets.sockets.get(kickedSocketId) : undefined
      if (kickedSocket) {
        kickedSocket.leave(room.code)
        delete kickedSocket.data.roomId
        delete kickedSocket.data.playerId
        delete kickedSocket.data.roomName
        delete kickedSocket.data.isSpectator
      }

      io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
      io.to(playerId).emit(SERVER_EVENTS.KICKED, { reason: '你被房主移出了房间' })
    } catch (err) {
      console.error('[KickPlayer] Error:', err)
    }
  })

  socket.on(CLIENT_EVENTS.START_GAME, () => {
    console.log(`[Room] START_GAME received from socket ${socket.id}`)
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) {
      console.log(`[Room] START_GAME rejected: missing roomId or playerId`)
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.ROOM_NOT_FOUND,
        message: '连接已断开，请刷新页面重新加入房间',
      })
      return
    }

    try {
      gameManager.resetGame(roomId)

      const result = roomManager.startGame(roomId, playerId)
      console.log(`[Room] START_GAME result: success=${result.success}, error=${result.error}`)

      if (!result.success) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, result.error!)
        return
      }

      const currentRoom = roomManager.getRoomById(roomId)
      if (currentRoom) {
        io.to(currentRoom.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(currentRoom) })
        gameManager.startRound(roomId)
      }
    } catch (err) {
      console.error('[StartGame] Error:', err)
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { code: ErrorCode.GAME_NOT_IN_LOBBY, message: '开始游戏失败，请重试' })
    }
  })

  socket.on(CLIENT_EVENTS.UPDATE_WORD_CONFIG, ({ wordConfig }: { wordConfig?: Partial<RoomWordConfig> }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === playerId)
    if (!player?.isOwner) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { code: ErrorCode.NOT_ROOM_OWNER, message: '只有房主可以修改词库设置' })
      return
    }

    if (room.state !== 'lobby' && room.state !== 'gameover') {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, { code: ErrorCode.GAME_NOT_IN_LOBBY, message: '游戏开始后无法修改词库设置' })
      return
    }

    if (wordConfig) {
      if (wordConfig.customWords) {
        const result = validateCustomWords(wordConfig.customWords)
        if (!result.valid) {
          socket.emit(SERVER_EVENTS.ROOM_ERROR, { code: ErrorCode.INVALID_WORD_CONFIG, message: result.error! })
          return
        }
        room.wordConfig.customWords = result.words!
      }
      if (wordConfig.looseMatching !== undefined) {
        room.wordConfig.looseMatching = wordConfig.looseMatching
      }
    }

    io.to(room.code).emit(SERVER_EVENTS.WORD_CONFIG_UPDATED, { wordConfig: room.wordConfig })
  })

  socket.on('disconnect', () => {
    try {
      const { roomId, playerId, isSpectator } = socket.data
      console.log(`[Socket] Disconnect: ${socket.id}, roomId=${roomId}, playerId=${playerId}, isSpectator=${isSpectator}`)

      if (!roomId || !playerId) return

      if (isSpectator) {
        handleLeave(io, socket)
        return
      }

      if (!roomManager.isPlayerSocketActive(playerId, socket.id)) return

      console.log(`[Room] Starting disconnect timer for player ${playerId}`)
      roomManager.markPlayerDisconnected(playerId)
      roomManager.startDisconnectTimer(playerId)
      lastChatTime.delete(playerId)
    } catch (err) {
      console.error('[Disconnect] Error:', err)
    }
  })

  socket.on(CLIENT_EVENTS.RESTORE_SESSION, ({ roomName, playerId }: { roomName: string; playerId: string }) => {
    try {
      const room = roomManager.getRoomByName(roomName)
      if (!room) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: '房间不存在或已结束',
        })
        return
      }

      const player = room.players.find((p) => p.id === playerId)
      if (!player) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: '无法恢复会话，请重新加入',
        })
        return
      }

      roomManager.cancelDisconnectTimer(playerId)
      roomManager.updatePlayerSession(room.id, playerId, socket.id)
      roomManager.updatePlayerSocket(playerId, socket.id)

      socket.data.roomId = room.id
      socket.data.playerId = playerId
      socket.data.roomName = room.name

      socket.join(room.code)
      socket.join(playerId)

      socket.emit(SERVER_EVENTS.SESSION_RESTORED, {
        room: getPlayerRoomData(room),
        playerId: player.id,
        isOwner: player.isOwner,
      })

      gameManager.restorePlayerState(room.id, player.id)

      io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
    } catch (err) {
      console.error('[RestoreSession] Error:', err)
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.ROOM_NOT_FOUND,
        message: '会话恢复失败，请重新加入',
      })
    }
  })

  socket.on(CLIENT_EVENTS.JOIN_AS_SPECTATOR, async ({ roomName, password }: { roomName: string; password?: string }) => {
    try {
      const room = roomManager.getRoomByName(roomName)
      if (!room) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: '房间不存在',
        })
        return
      }

      if (room.password && !(await bcrypt.compare(password ?? '', room.password))) {
        socket.emit(SERVER_EVENTS.ROOM_ERROR, {
          code: ErrorCode.ROOM_PASSWORD_WRONG,
          message: '密码错误',
        })
        return
      }

      socket.data.roomId = room.id
      socket.data.roomName = room.name
      socket.data.isSpectator = true

      socket.join(room.code)

      socket.emit(SERVER_EVENTS.SPECTATOR_JOINED, {
        room: getPlayerRoomData(room),
        isPlaying: room.state === 'playing',
      })
    } catch (err) {
      console.error('[Spectator] Join failed:', err)
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.ROOM_NOT_FOUND,
        message: '加入观战失败，请重试',
      })
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleLeave(io: any, socket: any): void {
  const { roomId, playerId } = socket.data
  if (!roomId || !playerId) return

  const result = roomManager.leaveRoom(roomId, playerId)
  if (!result.removed) return

  lastChatTime.delete(playerId)
  roomManager.cancelDisconnectTimer(playerId)

  const room = roomManager.getRoomById(roomId)
  if (room) {
    socket.leave(room.code)
    socket.leave(playerId)

    if (room.players.length === 0) {
      roomManager.dismissRoom(roomId)
    } else {
      io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
    }
  }

  delete socket.data.roomId
  delete socket.data.playerId
  delete socket.data.roomName
}
