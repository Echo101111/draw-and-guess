import { CLIENT_EVENTS, SERVER_EVENTS, ErrorCode } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { gameManager } from '../game/index.js'
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

    try {
      const { room, player } = await roomManager.createRoom(
        trimmedNickname,
        roomName?.trim() || '房间',
        maxPlayers ?? 50,
        password ?? ''
      )

      socket.data.roomId = room.id
      socket.data.playerId = player.id
      socket.data.roomCode = room.code
      roomManager.updatePlayerSession(room.id, player.id, socket.id)

      socket.join(room.code)

      socket.emit(SERVER_EVENTS.ROOM_CREATED, {
        roomCode: room.code,
        roomId: room.id,
        playerId: player.id,
        isOwner: true,
      })
    } catch {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.ROOM_NOT_FOUND,
        message: '创建房间失败，请重试',
      })
    }
  })

  socket.on(CLIENT_EVENTS.JOIN_ROOM, async ({ roomCode, password, nickname }: { roomCode: string; password?: string; nickname: string }) => {
    const trimmedNickname = nickname.trim()
    if (!trimmedNickname || trimmedNickname.length > 10) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: ErrorCode.NICKNAME_TAKEN,
        message: '昵称长度需在1-10字符之间',
      })
      return
    }

    const result = await roomManager.joinRoom(roomCode, password ?? '', trimmedNickname)

    if ('error' in result) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, result.error)
      return
    }

    const { room, player } = result
    socket.data.roomId = room.id
    socket.data.playerId = player.id
    socket.data.roomCode = room.code
    roomManager.updatePlayerSession(room.id, player.id, socket.id)

    socket.join(room.code)

    socket.emit(SERVER_EVENTS.ROOM_JOINED, {
      room: getPlayerRoomData(room),
      playerId: player.id,
      isOwner: player.isOwner,
    })

    socket.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
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
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const result = roomManager.startGame(roomId, playerId)

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
    handleLeave(io, socket)
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleLeave(io: any, socket: any): void {
  const { roomId, playerId } = socket.data
  if (!roomId || !playerId) return

  const result = roomManager.leaveRoom(roomId, playerId)
  if (!result.kicked) return

  socket.leave(socket.data.roomCode)

  const room = roomManager.getRoomById(roomId)
  if (room) {
    io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, { room: getPlayerRoomData(room) })
  }
}