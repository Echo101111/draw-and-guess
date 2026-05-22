import { CLIENT_EVENTS, SERVER_EVENTS } from '@draw-and-guess/shared'
import { spyGameManager } from '../game/SpyGameManager.js'
import { roomManager } from '../rooms/index.js'
import type { SpyGameConfig } from '@draw-and-guess/shared'

export function registerSpyGameHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.SPY_START_GAME, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const room = roomManager.getRoomById(roomId)
    if (!room || room.gameType !== 'spy') return

    const result = roomManager.startGame(roomId, playerId)
    if (!result.success) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, result.error!)
      return
    }
    io.to(room.code).emit(SERVER_EVENTS.ROOM_UPDATED, {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        state: room.state,
        maxPlayers: room.maxPlayers,
        players: room.players.map(p => ({
          id: p.id, nickname: p.nickname, isOwner: p.isOwner,
          score: p.score, hasGuessedCorrectly: p.hasGuessedCorrectly,
        })),
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        wordConfig: room.wordConfig,
        gameType: room.gameType,
      },
    })
    spyGameManager.startRound(roomId)
  })

  socket.on(CLIENT_EVENTS.SPY_SUBMIT_DESCRIPTION, ({ text }: { text: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const result = spyGameManager.submitDescription(roomId, playerId, text)
    if (!result.success) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: 'SPY_ERROR',
        message: result.error ?? '操作失败',
      })
    }
  })

  socket.on(CLIENT_EVENTS.SPY_VOTE, ({ targetId }: { targetId: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const result = spyGameManager.vote(roomId, playerId, targetId)
    if (!result.success) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: 'SPY_ERROR',
        message: result.error ?? '投票失败',
      })
    }
  })

  socket.on(CLIENT_EVENTS.SPY_READY_NEXT_ROUND, () => {
    const { roomId } = socket.data
    if (!roomId) return
    spyGameManager.startRound(roomId)
  })

  socket.on(CLIENT_EVENTS.SPY_UPDATE_CONFIG, ({ config }: { config: Partial<SpyGameConfig> }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const player = room.players.find(p => p.id === playerId)
    if (!player?.isOwner) return

    spyGameManager.updateGameConfig(roomId, config)
    io.to(room.code).emit(SERVER_EVENTS.SPY_GAME_CONFIG_UPDATED, {
      config: spyGameManager.getGameConfig(roomId),
    })
  })

  socket.on(CLIENT_EVENTS.REQUEST_GAME_STATE, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const room = roomManager.getRoomById(roomId)
    if (!room || room.gameType !== 'spy') return

    spyGameManager.sendGameStateSnapshot(roomId, playerId)
  })

  socket.on('disconnect', () => {
    const { roomId, playerId, isSpectator } = socket.data
    if (!roomId || !playerId || isSpectator) return

    const room = roomManager.getRoomById(roomId)
    if (!room || room.gameType !== 'spy') return

    spyGameManager.handlePlayerDisconnect(roomId, playerId)
  })
}
