import { CLIENT_EVENTS, SERVER_EVENTS, ErrorCode } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { gameManager } from '../game/index.js'
import { lastChatTime } from './gameHandlers.js'
import bcrypt from 'bcrypt'
import type { Room } from '@draw-and-guess/shared'

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
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRoomHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.CREATE_ROOM, async ({ nickname, roomName, maxPlayers, password }: { nickname: string; roomName?: string; maxPlayers?: number; password?: string }) => {
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
        password ?? ''
      )

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

    const kicked = roomManager.kickPlayer(roomId, hostId, playerId)
    if (!kicked) return

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })

    io.to(playerId).emit(SERVER_EVENTS.KICKED, { reason: '你被房主移出了房间' })
  })

  socket.on(CLIENT_EVENTS.START_GAME, () => {
    console.log(`[Room] START_GAME received from socket ${socket.id}`)
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) {
      console.log(`[Room] START_GAME rejected: missing roomId or playerId`)
      return
    }

    // Reset any lingering game state (e.g. after game_over) before starting fresh
    gameManager.resetGame(roomId)

    const result = roomManager.startGame(roomId, playerId)
    console.log(`[Room] START_GAME result: success=${result.success}, error=${result.error}`)

    if (!result.success) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, result.error!)
      return
    }

    const room = roomManager.getRoomById(roomId)
    if (room) {
      io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
      gameManager.startRound(roomId)
    }
  })

  socket.on('disconnect', () => {
    const { roomId, playerId, isSpectator } = socket.data
    console.log(`[Socket] Disconnect: ${socket.id}, roomId=${roomId}, playerId=${playerId}, isSpectator=${isSpectator}`)

    if (!roomId || !playerId) return

    if (isSpectator) {
      handleLeave(io, socket)
      return
    }

    console.log(`[Room] Starting disconnect timer for player ${playerId}`)
    roomManager.startDisconnectTimer(playerId)
    lastChatTime.delete(playerId)
  })

  socket.on(CLIENT_EVENTS.RESTORE_SESSION, ({ roomName, playerId }: { roomName: string; playerId: string }) => {
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

    // 恢复会话后如果游戏进行中，重新发送游戏状态（词语、笔画、计时器等）
    gameManager.restorePlayerState(room.id, player.id)

    io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
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

  const room = roomManager.getRoomById(roomId)
  if (room) {
    socket.leave(room.code)
  }

  if (!room) return

  if (room.players.length === 0) {
    // 所有人退出 → 立即清理房间和游戏数据
    gameManager.resetGame(roomId)
    roomManager.dismissRoom(roomId)
  } else {
    io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
  }
}
